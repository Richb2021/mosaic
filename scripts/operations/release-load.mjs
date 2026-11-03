// Bounded local HTTP acceptance. Real handlers + SQLite; simulated identity/NCB
// transport, never a production authentication bypass or capacity benchmark.
import {createServer} from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {writeFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import assert from 'node:assert/strict';
import {D1,Bucket} from '../../tests/helpers/media-storage.mjs';
import {NCBStore} from '../../server/ncb-store.js';
import {pilotAPI,learnerOwner,PILOT_NOTICE,workspaceIdentity} from '../../server/pilot-access.js';
import {learningAPI} from '../../server/learning-api.js';
import {workshopGateway} from '../../server/workshop-gateway.js';
import {sqlDB} from '../../server/data-control.js';
import {EXTENDED_PACKS} from '../../src/game-modes/extended-packs.js';
import {draftHash} from '../../src/game-modes/draft-engine.js';
import {newJourney,actJourney} from '../../src/game-modes/journey-engine.js';

const out=process.argv[2];assert(out,'Pass an evidence JSON path');
const user=id=>({id,email:id+'@example.test',name:id,emailVerified:true,token:crypto.randomUUID()});
const admin=user('release-admin'),teacher=user('release-teacher'),guardian=user('release-guardian');
const learners=Array.from({length:30},(_,i)=>({...user('release-learner-'+i),context:['individual','school','family'][i%3]}));
const identities=new Map([admin,teacher,guardian,...learners].map(u=>[u.token,u]));
const env={DB:new D1(),BUCKET:new Bucket(),PILOT_ENABLED:'true',PILOT_ADMIN_OWNER:await learnerOwner(admin)};
const provider=new DatabaseSync(':memory:');let providerCalls=0,offline=false;
for(const table of ['learner_profiles','learner_saves'])provider.exec(`CREATE TABLE ${table}(id INTEGER PRIMARY KEY,owner_key TEXT,slot_key TEXT,version INTEGER,payload TEXT,updated_ms INTEGER,UNIQUE(owner_key,slot_key,version))`);
const store=new NCBStore({NCB_INSTANCE:'synthetic',NCB_SECRET_KEY:'synthetic'},async(url,options)=>{
 providerCalls++;await new Promise(r=>setTimeout(r,8));if(offline)throw Error('Injected provider outage');
 const u=new URL(url),[action,table,id]=u.pathname.slice(1).split('/'),p=u.searchParams;
 assert(['learner_profiles','learner_saves'].includes(table));
 if(action==='create'){
  const x=JSON.parse(options.body);try{provider.prepare(`INSERT INTO ${table}(owner_key,slot_key,version,payload,updated_ms) VALUES(?,?,?,?,?)`).run(x.owner_key,x.slot_key,x.version,x.payload,x.updated_ms);return Response.json({status:'success'})}catch{return Response.json({status:'error'},{status:409})}
 }
 if(action==='delete'){provider.prepare(`DELETE FROM ${table} WHERE id=?`).run(Number(id));return Response.json({status:'success'})}
 if(action==='bulk')throw Error('Unused transport operation');
 assert.equal(action,'read');let rows=provider.prepare(`SELECT * FROM ${table} WHERE owner_key=?`).all(p.get('owner_key'));
 if(p.has('slot_key'))rows=rows.filter(r=>r.slot_key===p.get('slot_key'));
 if(p.has('version[lt]'))rows=rows.filter(r=>r.version<Number(p.get('version[lt]')));
 const sort=['id','version'].includes(p.get('sort'))?p.get('sort'):'id',sign=p.get('order')==='desc'?-1:1;rows.sort((a,b)=>sign*(a[sort]-b[sort]));
 const limit=Number(p.get('limit')||50),offset=(Number(p.get('page')||1)-1)*limit;
 return Response.json({status:'success',data:rows.slice(offset,offset+limit),metadata:{hasMore:rows.length>offset+limit}});
});
const timings=[],checks=[];let base;
const server=createServer(async(incoming,response)=>{try{
 const chunks=[];for await(const c of incoming)chunks.push(c);const body=Buffer.concat(chunks);
 const request=new Request(base+incoming.url,{method:incoming.method,headers:incoming.headers,...(body.length?{body}:{} )});
 const session=async()=>identities.get(incoming.headers.authorization?.replace(/^Bearer /,''))||null;
 const handler=incoming.url.startsWith('/api/pilot')?pilotAPI:incoming.url.startsWith('/api/workshop/')?workshopGateway:learningAPI;
 const result=await handler(request,env,{session,store});response.writeHead(result.status,Object.fromEntries(result.headers));response.end(Buffer.from(await result.arrayBuffer()));
 }catch{response.writeHead(500);response.end('{}')}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
const call=async(u,path,body)=>{const started=performance.now(),r=await fetch(base+'/api/'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+u.token,Origin:base,'Content-Type':'application/json','X-Mosaic-Learner':u.id,'X-Lanternbound-Workshop':'1'},body:body?JSON.stringify(body):undefined});const data=await r.json();timings.push({path:path.split('?')[0],status:r.status,ms:performance.now()-started});return {status:r.status,...data}};
const expect=async(p,status=200)=>{const r=await p;assert.equal(r.status,status,JSON.stringify(r));return r};
const invite=async(manager,u,extra={})=>{const i=await expect(call(manager,'pilot',{action:'invite',email:u.email,...extra}));await expect(call(u,'pilot',{action:'claim',code:i.code}));};
const welcome=(u,ageBand)=>expect(call(u,'pilot',{action:'onboarding',ageBand,noticeVersion:PILOT_NOTICE,confirmed:true,expectedVersion:0}));
const db=sqlDB(env.DB),packs=new Map(),percentile=(values,p)=>Math.round([...values].sort((a,b)=>a-b)[Math.ceil(values.length*p)-1]||0);
const report={kind:'local-http-synthetic-provider',started:new Date().toISOString(),identity:'injected synthetic identities; not live NCB sign-in',storage:'SQLite with NCB contract + real NCBStore adapter, 8ms simulated transport',learners:30,checks,stages:[],limitations:['Not production capacity, regional latency or physical-device evidence.','No real email verification, AI generation, paid rendering or real child accounts.']};
try{
 await welcome(admin,'18plus');
 for(const [u,role,context] of [[teacher,'teacher','school'],[guardian,'guardian','family']]){await invite(admin,u,{role,context,managedApproval:true});await welcome(u,'18plus')}
 for(const u of learners){const manager=u.context==='school'?teacher:u.context==='family'?guardian:admin;await invite(manager,u,{context:u.context,managedApproval:u.context!=='individual'});await expect(call(u,'learning/journal'),428);await welcome(u,u.context==='individual'?'18plus':u.context==='school'?'13to17':'under13');}
 checks.push('30 invitation/onboarding journeys: 10 adult individual, 10 school teen, 10 family under-13; unfinished onboarding denied');
 for(const manager of [admin,teacher,guardian]){const context=await workspaceIdentity(manager,env),pack={...structuredClone(EXTENDED_PACKS.find(p=>p.template==='quiz-v1')),id:'generated-'+manager.id},id='job-'+manager.id;
  await db.run('INSERT INTO workshop_jobs(id,owner,request_key,request_hash,status,payload,draft,created,updated) VALUES(?,?,?,?,?,?,?,?,?)',id,context.siteOwner,id,'fixture','published','{}',JSON.stringify(pack),Date.now(),Date.now());packs.set(manager.id,{pack,id});
 }
 for(const u of learners){const manager=u.context==='school'?teacher:u.context==='family'?guardian:admin;const {pack,id}=packs.get(manager.id);u.pack=pack;await expect(call(manager,'pilot',{action:'assign',accountReference:await learnerOwner(u),jobId:id}));await expect(call(u,'workshop/jobs/'+id));if(u.context!=='individual')await expect(call(u,'workshop/resources',{title:'Forbidden',text:'A managed learner cannot author this material.'}),403);}
 checks.push('Read-only assigned chapters available; child and teen authoring denied');
 for(const concurrency of [1,4,12]){
  const offset=timings.length,started=performance.now();let cursor=0;
  await Promise.all(Array.from({length:concurrency},async()=>{for(;;){const i=cursor++;if(i>=learners.length)break;const u=learners[i],journal=await expect(call(u,'learning/journal'));
   await expect(call(u,'learning/profile',{expectedVersion:journal.profileVersion,profile:{goal:u.id+' learns through stories',interests:['Football','Stories & animation'],formats:['quiz-v1']}}));
   const query='packId='+u.pack.id+'&contentHash='+draftHash(u.pack)+'&kind=journey',prior=await expect(call(u,'learning/save?'+query));
   const save=await expect(call(u,'learning/save',{packId:u.pack.id,contentHash:draftHash(u.pack),kind:'journey',expectedVersion:prior.save?.version||0,snapshot:actJourney(u.pack,newJourney(u.pack,17),{type:'travel',index:0})}));
   const restored=await expect(call(u,'learning/save?'+query));assert.deepEqual(restored.save.snapshot,save.save.snapshot);assert.equal((await expect(call(u,'learning/journal'))).profile.goal,u.id+' learns through stories');
  }}));
  const samples=timings.slice(offset),elapsed=performance.now()-started;report.stages.push({concurrency,requests:samples.length,elapsedMs:Math.round(elapsed),p50Ms:percentile(samples.map(s=>s.ms),.5),p95Ms:percentile(samples.map(s=>s.ms),.95),maxMs:Math.round(Math.max(...samples.map(s=>s.ms))),unexpectedErrors:samples.filter(s=>s.status!==200).length});
 }
 checks.push('Profile and validated game progress saved/restored for all contexts at concurrency 1, 4 and 12; owner isolation checked');
 const u=learners[0],before=await expect(call(u,'learning/journal'));
 const race=await Promise.all(Array.from({length:12},(_,i)=>call(u,'learning/profile',{expectedVersion:before.profileVersion,profile:{goal:'competing-'+i}})));
 assert.equal(race.filter(r=>r.status===200).length,1);assert.equal(race.filter(r=>r.status===409).length,11);checks.push('12 competing profile writes: one winner, 11 conflicts, no silent overwrite');
 offline=true;await expect(call(u,'learning/journal'),503);offline=false;assert.equal((await expect(call(u,'learning/journal'))).profileVersion,before.profileVersion+1);checks.push('Provider outage returns 503 and preserves saved progress after recovery');
 for(const u of [learners[1],learners[2]]){const manager=u.context==='school'?teacher:guardian,{id}=packs.get(manager.id),ref=await learnerOwner(u);
  await expect(call(manager,'pilot',{action:'revoke',accountReference:ref}));await expect(call(u,'learning/journal'),403);await expect(call(u,'learning/data'));
  await expect(call(manager,'pilot',{action:'restore-access',accountReference:ref}));await expect(call(u,'workshop/jobs/'+id),404);await expect(call(manager,'pilot',{action:'assign',accountReference:ref,jobId:id}));await expect(call(u,'workshop/jobs/'+id));
 }
 checks.push('School/family withdrawal denies learning but keeps data controls; restore requires explicit chapter reassignment');
 assert.equal((await db.one('SELECT COUNT(*) AS n FROM data_leases')).n,0);checks.push('No leaked data mutation leases');report.pass=true;
}catch(error){report.pass=false;report.failure=error.message;process.exitCode=1}finally{
 await new Promise(r=>server.close(r));report.finished=new Date().toISOString();report.totalRequests=timings.length;report.providerCalls=providerCalls;report.statuses=timings.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{});
 await mkdir(dirname(out),{recursive:true});await writeFile(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}
