import test from 'node:test';
import assert from 'node:assert/strict';
import {D1,Bucket} from './helpers/media-storage.mjs';
import {operationsAPI} from '../server/launch-operations.js';
import {RECOVERY_TABLES} from '../server/recovery-operations.js';

function fixture(){
 const DB=new D1(),BUCKET=new Bucket();
 DB.batch=async statements=>{DB.db.exec('BEGIN');try{const r=await Promise.all(statements.map(s=>s.all()));DB.db.exec('COMMIT');return r;}catch(e){DB.db.exec('ROLLBACK');throw e}};
 BUCKET.list=async()=>({objects:[...BUCKET.objects].map(([key,b])=>({key,size:b.length,etag:'test'})),truncated:false});
 const env={DB,BUCKET,MAINTENANCE_SECRET:'x'.repeat(40),MEDIA_WORKER_ENABLED:'true'},now=Date.now();
 DB.db.prepare('INSERT INTO data_controls(scope,updated) VALUES(?,?)').run('maintenance:media',now);
 DB.db.prepare('INSERT INTO data_events(id,scope,action,detail,created) VALUES(?,?,?,?,?)').run('retention','maintenance:retention','background-retention','{"status":"complete","more":false}',now);
 const store={latest:async()=>({payload:'private learner details',owner_key:'private'})};
 const request=(purpose='health-v1',extra={})=>new Request('https://mosaic.test/api/operations'+(extra.query||''),{method:extra.method||'GET',headers:{Authorization:'Bearer '+env.MAINTENANCE_SECRET,'X-Mosaic-Maintenance':purpose,...extra.headers}});
 return {env,now,store,request,call:(r)=>operationsAPI(r,env,{now:()=>now,store})};
}
test('operator health is content-free; dependency and stale worker failures are explicit',async()=>{
 const h=fixture();let r=await h.call(h.request());assert.equal(r.status,200);let x=await r.json();assert.equal(x.ok,true);assert(!JSON.stringify(x).includes('private'));
 h.store.latest=async()=>{throw Error('secret internal diagnostic')};h.env.DB.db.exec("UPDATE data_controls SET updated=0");
 x=await (await h.call(h.request())).json();assert.deepEqual(x.issues,['mediaWorker','learnerStorage']);assert(!JSON.stringify(x).includes('secret'));
});
test('fresh but failed or unfinished retention is not healthy',async()=>{
 const h=fixture();for(const detail of [{status:'attention',failed:1},{status:'complete',more:true}]){
  h.env.DB.db.prepare('UPDATE data_events SET detail=?').run(JSON.stringify(detail));
  const r=await (await h.call(h.request())).json();assert(r.issues.includes('retention'));
 }
});
test('health and export reject absent credentials, cross origin and writes',async()=>{
 const h=fixture();for(const purpose of ['health-v1','recovery-v1']){
  assert.equal((await h.call(h.request(purpose,{headers:{Authorization:''}}))).status,403);
  assert.equal((await h.call(h.request(purpose,{headers:{Origin:'https://evil.test'}}))).status,403);
  assert.equal((await h.call(h.request(purpose,{method:'POST'}))).status,405);
 }
});
test('snapshot restores exact tables, schema and saved bytes into independent storage',async()=>{
 const h=fixture();h.env.DB.db.prepare('INSERT INTO workshop_resources(id,owner,title,checksum,payload,status,created) VALUES(?,?,?,?,?,?,?)').run('r','owner','A source','abc','{"private":true}','reviewed',1);
 await h.env.BUCKET.put('sources/owner/r/original',new TextEncoder().encode('source bytes'));
 const res=await h.call(h.request('recovery-v1')),snapshot=await res.json();assert.equal(res.status,200);assert.deepEqual(Object.keys(snapshot.tables),RECOVERY_TABLES);
 const {DatabaseSync}=await import('node:sqlite'),restored=new DatabaseSync(':memory:');
 for(const s of snapshot.schema)restored.exec(s.sql);
 for(const [table,rows] of Object.entries(snapshot.tables))for(const row of rows){const cols=Object.keys(row);restored.prepare(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(()=>'?').join(',')})`).run(...Object.values(row));}
 for(const table of RECOVERY_TABLES)assert.deepEqual(restored.prepare(`SELECT * FROM ${table} ORDER BY 1`).all(),h.env.DB.db.prepare(`SELECT * FROM ${table} ORDER BY 1`).all());
 assert.equal(await (await h.call(h.request('recovery-v1',{query:'?object=sources/owner/r/original'}))).text(),'source bytes');
 assert.equal((await h.call(h.request('recovery-v1',{query:'?object=secret/config'}))).status,400);
 assert.equal((await h.call(h.request('recovery-v1',{query:'?object=narration/missing.mp3'}))).status,409);
 restored.close();
});
test('oversized or incomplete snapshots refuse to masquerade as a backup',async()=>{
 const h=fixture();h.env.BUCKET.list=async()=>({objects:[],truncated:true,cursor:'next'});assert.equal((await h.call(h.request('recovery-v1'))).status,413);
 h.env.DB.batch=async()=>[];assert.equal((await h.call(h.request('recovery-v1'))).status,503);
});
