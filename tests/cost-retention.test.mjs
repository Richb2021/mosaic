import test from 'node:test';
import assert from 'node:assert/strict';
import {D1,Bucket} from './helpers/media-storage.mjs';
import {sqlDB,readControls} from '../server/data-control.js';
import {metaUsage,costRates,estimateMicros,startCost,finishCost,costSummary} from '../server/cost-ledger.js';
import {creativeResult} from '../server/creative-provider.js';
import {maintenanceAPI,registerRetentionSubject} from '../server/background-retention.js';
test('token cache and UTF-8 byte costs use snapshot rates, idempotent receipts and explicit unknowns',async()=>{
 const env={DB:new D1()},now=10000,siteOwner='site',learnerOwner='learner',usage=metaUsage({input_tokens:1000,output_tokens:100,input_tokens_details:{cached_tokens:500}});
 assert.equal(estimateMicros('muse-wonder-1.0',usage,costRates(env)),4100);
 assert.equal(estimateMicros('s2.1-pro',{inputBytes:new TextEncoder().encode('é').length},costRates(env)),30);
 assert.equal(metaUsage({input_tokens:1,output_tokens:3,input_tokens_details:{cached_tokens:4}}),null);
 await startCost(env,{id:'a',siteOwner,learnerOwner,model:'muse-wonder-1.0',now});await finishCost(env,{id:'a',siteOwner,usage,now});
 env.COST_META_INPUT_PER_M='90';await startCost(env,{id:'a',siteOwner,learnerOwner,model:'muse-wonder-1.0',now});await finishCost(env,{id:'a',siteOwner,usage,now});await finishCost(env,{id:'a',siteOwner,status:'failed',now});
 await startCost(env,{id:'b',siteOwner,learnerOwner,model:'s2.1-pro',now});
 const result=await costSummary(env,{siteOwner,learnerOwner,now});assert.equal(result.rows.length,2);assert.equal(result.estimateUsd,0.0041);assert.equal(result.unpriced,1);assert.equal((await costSummary(env,{siteOwner,learnerOwner:'other',now})).rows.length,0);
 try{creativeResult({id:'resp_bad',status:'completed',usage:{input_tokens:5,output_tokens:8},output:[]},{kind:'tutor'})}catch(e){assert.equal(e.providerId,'resp_bad');assert.equal(e.usage.inputTokens,5)}
});
test('unattended retention clears aged R2 under saved policy, respects foreign scope and reports persisted result',async()=>{
 const now=10*86400000,env={DB:new D1(),BUCKET:new Bucket(),RETENTION_BACKGROUND_ENABLED:'true',MAINTENANCE_SECRET:'test-secret-'.repeat(4)},db=sqlDB(env.DB),siteOwner='site',owner='learner',store={allRows:async()=>[],deleteRows:async()=>{}};
 await registerRetentionSubject(env,{siteOwner,owner,now});const state=await readControls(env,siteOwner,owner,now);await db.run('UPDATE data_controls SET policy=? WHERE scope=?',JSON.stringify({mediaDays:7}),state.scopes.learner);
 await db.run('INSERT INTO retention_subjects(id,site_owner,learner_owner,updated) VALUES(?,?,?,?)','foreign-registration','other-site','foreign-learner',now);
 for(const [id,learner] of [['aged',owner],['foreign','other']]){await env.BUCKET.put(id,new Uint8Array([1,2,3]));await db.run('INSERT INTO media_assets(id,site_owner,learner_owner,script_id,script_hash,segment,object_key,status,bytes,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?)',id,siteOwner,learner,'fixture','hash',0,id,'ready',3,1,1)}
 const request=(method='POST',headers={},body)=>new Request('https://site.test/api/maintenance',{method,headers:{Authorization:'Bearer '+env.MAINTENANCE_SECRET,'X-Mosaic-Maintenance':'retention-v1',...headers},body});
 assert.equal((await maintenanceAPI(request('POST',{Origin:'https://evil.test'}),env,{store,now:()=>now})).status,403);
 assert.equal((await maintenanceAPI(request('POST',{},'{"delete":"all"}'),env,{store,now:()=>now})).status,400);
 const run=await (await maintenanceAPI(request(),env,{store,now:()=>now})).json();assert.equal(run.status,'complete');assert.equal(run.processed,2);assert.equal(await env.BUCKET.head('aged'),null);assert(await env.BUCKET.head('foreign'));
 const read=await (await maintenanceAPI(request('GET'),env,{store,now:()=>now})).json();assert.equal(read.lastRun.runId,run.runId);
});
test('failed background deletion remains visible and resumes without a new retention policy or inference',async()=>{
 const now=10*86400000,env={DB:new D1(),BUCKET:new Bucket(),RETENTION_BACKGROUND_ENABLED:'true',MAINTENANCE_SECRET:'test-secret-'.repeat(4)},db=sqlDB(env.DB),owner='a',siteOwner='s',store={allRows:async()=>[],deleteRows:async()=>{}};
 await registerRetentionSubject(env,{siteOwner,owner,now});const state=await readControls(env,siteOwner,owner,now);await db.run('UPDATE data_controls SET policy=? WHERE scope=?','{"mediaDays":7}',state.scopes.learner);
 await env.BUCKET.put('aged',new Uint8Array([1]));await db.run('INSERT INTO media_assets(id,site_owner,learner_owner,script_id,script_hash,segment,object_key,status,bytes,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?)','aged',siteOwner,owner,'fixture','hash',0,'aged','ready',1,1,1);
 const request=()=>new Request('https://site.test/api/maintenance',{method:'POST',headers:{Authorization:'Bearer '+env.MAINTENANCE_SECRET,'X-Mosaic-Maintenance':'retention-v1'}});env.BUCKET.failDelete=true;
 let result=await (await maintenanceAPI(request(),env,{store,now:()=>now})).json();assert.equal(result.status,'attention');assert.equal(result.failed,1);
 assert.deepEqual(result.errors,[{code:'storage-or-provider-unavailable'}]);assert.equal(result.pending,1);
 env.BUCKET.failDelete=false;result=await (await maintenanceAPI(request(),env,{store,now:()=>now+1})).json();assert.equal(result.status,'complete');assert.equal(await env.BUCKET.head('aged'),null);
});

test('a multi-batch retention sweep reuses one cutoff and terminates despite a moving clock',async()=>{
 const env={DB:new D1(),BUCKET:new Bucket(),RETENTION_BACKGROUND_ENABLED:'true',MAINTENANCE_SECRET:'test-secret-'.repeat(4)},store={allRows:async()=>[],deleteRows:async()=>{}};
 for(let i=0;i<7;i++)await registerRetentionSubject(env,{siteOwner:'personal:'+i,owner:String(i),now:10});
 const req=()=>new Request('https://site.test/api/maintenance',{method:'POST',headers:{Authorization:'Bearer '+env.MAINTENANCE_SECRET,'X-Mosaic-Maintenance':'retention-v1'}});
 const first=await (await maintenanceAPI(req(),env,{store,now:()=>10000})).json();assert.equal(first.processed,5);assert.equal(first.more,true);
 const second=await (await maintenanceAPI(req(),env,{store,now:()=>11000})).json();assert.equal(second.processed,2);assert.equal(second.more,false);
});
