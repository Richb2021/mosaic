import test from 'node:test';
import assert from 'node:assert/strict';
import {D1,Bucket} from './helpers/media-storage.mjs';
import {dataAPI,deletionPlan,startDeletion,enforceRetention,deleteProviderResponse} from '../server/data-lifecycle.js';
import {persistentAudio} from '../server/persistent-audio.js';
import {readControls,withDataGuard,sqlDB,DAY} from '../server/data-control.js';
import {generationBudget} from '../server/workshop-budget.js';
import {NCBStore} from '../server/ncb-store.js';
function setup(){
 let clock=200*DAY;const env={DB:new D1(),BUCKET:new Bucket(),WORKSHOP_GENERATION_LIMIT:'50',META_API_KEY:'fixture',FISH_AUDIO_API_KEY:'fixture',FISH_AUDIO_GUIDE_VOICE:'a'.repeat(32),FISH_AUDIO_LEARNER_VOICE:'b'.repeat(32)},db=sqlDB(env.DB),records={learner_profiles:[],learner_saves:[]};
 const store={allRows:async(table,owner)=>records[table].filter(r=>r.owner_key===owner),deleteRows:async(table,owner,ids)=>{records[table]=records[table].filter(r=>r.owner_key!==owner||!ids.includes(r.id));}};
 const ctx={owner:'learner-a',siteOwner:'site-a',store,now:()=>clock,removeProvider:async()=>{}},call=async(input,extra={})=>{
  const c={...ctx,...extra},state=await readControls(env,c.siteOwner,c.owner,clock);
  const req=new Request('https://test/api/learning/data',{method:input?'POST':'GET',...(input?{body:JSON.stringify({epoch:state.epoch,...input})}:{})});
  try{const r=await dataAPI(req,env,c);return {status:r.status,...(r.headers.get('content-type').startsWith('audio/')?{audio:await r.arrayBuffer()}:await r.json())};}catch(e){return {status:e.status||500,error:e.message}}
 };
 const job=async(id,kind='creative',owner='learner-a',site='site-a',extra={})=>{const p={recordType:kind,learnerOwner:owner,kind:'podcast',packId:'pack',...extra};if(kind==='game'){delete p.recordType;delete p.learnerOwner;}await db.run('INSERT INTO workshop_jobs(id,owner,request_key,request_hash,status,payload,draft,provider_id,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?)',id,site,id,'hash',kind==='creative'?'creative-published':'published',JSON.stringify(p),JSON.stringify({title:id,segments:[{speaker:'guide',text:'A reviewed passage.'}]}),'resp_'+id,clock,clock);return db.one('SELECT * FROM workshop_jobs WHERE id=?',id);};
 const asset=async(id,script='episode',owner='learner-a',site='site-a')=>{await env.BUCKET.put(id,new Uint8Array([73,68,51,0]));await db.run('INSERT INTO media_assets(id,site_owner,learner_owner,script_id,script_hash,segment,object_key,status,bytes,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?)',id,site,owner,script,'hash',0,id,'ready',4,clock,clock);};
 return {env,db,ctx,records,call,job,asset,setTime:t=>clock=t};
}
test('persistent narration survives a new request, consumes no additional budget, and isolates voice/script settings',async()=>{
 const h=setup(),j=await h.job('episode');let calls=0;const reserve=async(p,key,hash,status)=>{await h.db.run('INSERT INTO workshop_jobs(id,owner,request_key,request_hash,status,payload,created,updated) VALUES(?,?,?,?,?,?,?,?)',p.id,'site-a',key,hash,status,JSON.stringify(p),h.ctx.now(),h.ctx.now());return p};
 const args={env:h.env,siteOwner:'site-a',owner:'learner-a',j,draft:JSON.parse(j.draft),index:0,requestKey:'audio-one',requestHash:'h',reserve,speech:async()=>{calls++;return {bytes:new Uint8Array([73,68,51,0])}},now:h.ctx.now};
 let r=await persistentAudio(args);assert.equal(r.headers.get('x-mosaic-audio'),'generated-and-saved');assert.equal(calls,1);
 r=await persistentAudio({...args,requestKey:'audio-two'});assert.equal(r.headers.get('x-mosaic-audio'),'stored');assert.equal((await r.arrayBuffer()).byteLength,4);assert.equal(calls,1);assert.equal((await generationBudget(h.db.one,'site-a',h.env,h.ctx.now())).used,2);
 h.env.FISH_AUDIO_GUIDE_VOICE='c'.repeat(32);await persistentAudio({...args,requestKey:'audio-three'});assert.equal(calls,2);assert.equal(h.env.BUCKET.objects.size,2);
});
test('concurrent narration acquires a single cache slot and a failed save does not silently regenerate',async()=>{
 const h=setup(),j=await h.job('race');let release,calls=0;const gate=new Promise(r=>release=r);const args={env:h.env,...h.ctx,j,draft:JSON.parse(j.draft),index:0,requestKey:'race-one',requestHash:'h',reserve:async p=>p,speech:async()=>{calls++;await gate;return {bytes:new Uint8Array([73,68,51,0])}},now:h.ctx.now};
 const first=persistentAudio(args);while(!calls)await new Promise(r=>setTimeout(r,1));await assert.rejects(persistentAudio({...args,requestKey:'race-two'}),e=>e.status===409);release();await first;assert.equal(calls,1);
 h.env.BUCKET.objects.clear();await assert.rejects(persistentAudio({...args,requestKey:'race-three'}),e=>e.status===409);assert.equal(calls,1);
});
test('exports and media downloads are isolated by learner and Sites owner',async()=>{
 const h=setup();await h.job('mine');await h.job('foreign','creative','learner-b');await h.job('site-foreign','creative','learner-a','site-b');await h.asset('mine-media','mine');await h.asset('foreign-media','foreign','learner-b');
 h.records.learner_profiles.push({id:1,owner_key:'learner-a',slot_key:'profile',version:1,payload:'{"profile":{"goal":"Fixture"}}',updated_ms:h.ctx.now()},{id:2,owner_key:'learner-b',payload:'{}'});
 const r=await h.call({action:'export'});assert.equal(r.export.creative.length,1);assert.equal(r.export.media.length,1);assert.equal(r.export.profiles.length,1);assert.equal(JSON.stringify(r).includes('site-foreign'),false);
 assert.equal((await h.call({action:'download',id:'foreign-media'})).status,404);assert.equal((await h.call({action:'download',id:'mine-media'},{siteOwner:'site-b'})).status,404);
 assert.equal((await h.call({action:'download',id:'mine-media'})).audio.byteLength,4);
});
test('episode deletion cascades saved audio, preserves quota receipts and confirms provider cleanup',async()=>{
 const h=setup();await h.job('episode');await h.asset('media');await h.job('other','creative','learner-b');let removed=[];const p=(await h.call({action:'preview',mode:'episode',id:'episode'})).preview;assert.equal(p.counts.recordings,1);
 const r=await h.call({action:'delete',mode:'episode',id:'episode',hash:p.hash,confirmed:true},{removeProvider:async id=>removed.push(id)});assert.equal(r.operation.status,'complete');assert.deepEqual(removed,['resp_episode']);assert.equal(h.env.BUCKET.objects.size,0);
 const row=await h.db.one('SELECT * FROM workshop_jobs WHERE id=?','episode');assert.equal(row.status,'usage-only');assert.equal(row.draft,null);assert.equal(row.provider_id,null);assert.equal(row.payload,'{"recordType":"usage"}');assert.equal((await generationBudget(h.db.one,'site-a',h.env,h.ctx.now())).used,2);assert.equal((await h.call()).jobs.length,0);assert(await h.db.one('SELECT * FROM workshop_jobs WHERE id=?','other'));
});
test('failed byte deletion retains a resumable operation and blocks writes until confirmed',async()=>{
 const h=setup();await h.job('episode');await h.asset('media');h.env.BUCKET.failDelete=true;const p=(await h.call({action:'preview',mode:'episode',id:'episode'})).preview;
 assert.equal((await h.call({action:'delete',mode:'episode',id:'episode',hash:p.hash,confirmed:true})).status,503);
 const inv=await h.call(),op=inv.operations[0];assert.equal(op.status,'cleanup-pending');await assert.rejects(withDataGuard(new Request('https://test',{method:'POST'}),h.env,h.ctx,()=>new Response('bad')),e=>e.status===423);
 h.env.BUCKET.failDelete=false;assert.equal((await h.call({action:'resume',id:op.id})).operation.status,'complete');assert.equal(h.env.BUCKET.objects.size,0);
});
test('provider cleanup failure is explicit, retryable and never restores deleted local content',async()=>{
 const h=setup();await h.job('episode');const p=(await h.call({action:'preview',mode:'episode',id:'episode'})).preview;let r=await h.call({action:'delete',mode:'episode',id:'episode',hash:p.hash,confirmed:true},{removeProvider:async()=>{throw Error('offline')}});assert.equal(r.operation.status,'provider-pending');assert.equal((await h.call()).jobs.length,0);
 r=await h.call({action:'resume',id:r.operation.id});assert.equal(r.operation.status,'complete');
});
test('deletion waits for in-flight mutation leases and rejects stale tabs after cleanup',async()=>{
 const h=setup();await h.job('episode');const plan=await deletionPlan(h.env,{...h.ctx,mode:'episode',id:'episode',now:h.ctx.now()});let started,finish;const began=new Promise(r=>started=r),wait=new Promise(r=>finish=r);
 const ongoing=withDataGuard(new Request('https://test',{method:'POST',headers:{'X-Mosaic-Data-Epoch':'0:0'}}),h.env,h.ctx,async()=>{started();await wait;return new Response('saved')});await began;await assert.rejects(startDeletion(h.env,h.ctx,plan),e=>e.status===409);finish();await ongoing;
 await startDeletion(h.env,h.ctx,plan);await assert.rejects(withDataGuard(new Request('https://test',{method:'POST',headers:{'X-Mosaic-Data-Epoch':'0:0'}}),h.env,h.ctx,()=>new Response('bad')),e=>e.status===409);
});
test('learner deletion verifies all owned NCB versions and leaves sign-in and other learners untouched',async()=>{
 const h=setup();h.records.learner_profiles.push({id:1,owner_key:'learner-a',payload:'{}'},{id:2,owner_key:'learner-b',payload:'{}'});h.records.learner_saves.push({id:3,owner_key:'learner-a',payload:'{}'});await h.job('episode');const p=(await h.call({action:'preview',mode:'learner'})).preview;assert.equal(p.counts.learnerRows,2);assert.equal((await h.call({action:'delete',mode:'learner',hash:p.hash,confirmed:true})).operation.status,'complete');assert.equal(h.records.learner_profiles.length,1);assert.equal(h.records.learner_profiles[0].owner_key,'learner-b');assert.equal(h.records.learner_saves.length,0);assert.equal((await h.call()).resetMs,h.ctx.now());
});
test('source deletion follows derived chapters, episodes and recordings but preserves unrelated sources',async()=>{
 const h=setup();await h.db.run('INSERT INTO workshop_resources VALUES(?,?,?,?,?,?,?)','source','site-a','Fixture','checksum','{}','reviewed',h.ctx.now());await h.job('chapter','game','learner-a','site-a',{chapterId:'generated-fixture',resourceVersions:[{id:'source'}]});await h.job('episode','creative','learner-a','site-a',{packId:'generated-fixture'});await h.asset('media');
 const p=(await h.call({action:'preview',mode:'resource',id:'source'})).preview;assert.deepEqual(p.counts,{recordings:1,creative:1,chapters:1,resources:1,learnerRows:0,providerResponses:2,courseAssignments:0,sharingSettings:0,assignedQuestionSets:0,collections:0});assert.equal((await h.call({action:'delete',mode:'resource',id:'source',hash:p.hash,confirmed:true})).operation.status,'complete');assert.equal((await h.call()).resources.length,0);
});
test('retention uses creation age, purges on next access, does not count replay, and expires usage receipts',async()=>{
 const h=setup();await h.job('episode');await h.asset('media');assert.equal((await h.call({action:'retention',scope:'learner',policy:{mediaDays:7,creativeDays:30,progressDays:0}})).saved,true);h.setTime(208*DAY);await enforceRetention(h.env,h.ctx);assert.equal(h.env.BUCKET.objects.size,0);assert.equal((await h.call()).jobs.length,1);h.setTime(231*DAY);await enforceRetention(h.env,h.ctx);assert.equal((await h.call()).jobs.length,0);
});
test('delete confirmation binds the current inventory and rejects a changed plan',async()=>{
 const h=setup();await h.job('episode');const p=(await h.call({action:'preview',mode:'episode',id:'episode'})).preview;await h.asset('media');assert.equal((await h.call({action:'delete',mode:'episode',id:'episode',hash:p.hash,confirmed:true})).status,409);assert.equal((await h.call({action:'delete',mode:'episode',id:'episode',hash:p.hash,confirmed:false})).status,400);
});
test('provider deletion refuses redirects and requires exact acknowledgement, treating missing responses idempotently',async()=>{
 const env={META_API_KEY:'fixture'};let url;await deleteProviderResponse('resp_example',env,async(u,o)=>{url=u;assert.equal(o.method,'DELETE');assert.equal(o.redirect,'manual');return Response.json({id:'resp_example',deleted:true})});assert.equal(url,'https://api.meta.ai/v1/responses/resp_example');await deleteProviderResponse('resp_example',env,async()=>Response.json({error:{code:'response_not_found'}},{status:404}));await assert.rejects(deleteProviderResponse('resp_example',env,async()=>new Response('',{status:404})));await assert.rejects(deleteProviderResponse('resp_example',env,async()=>Response.json({id:'resp_other',deleted:true})));await assert.rejects(deleteProviderResponse('resp_example',env,async()=>new Response('',{status:302})));
});
test('NCB bulk deletion sends only verified owned row ids and verifies disappearance',async()=>{
 let rows=[{id:1,owner_key:'owner-a',slot_key:'x'},{id:2,owner_key:'owner-a',slot_key:'y'}],deleted;
 const store=new NCBStore({NCB_INSTANCE:'fixture',NCB_SECRET_KEY:'fixture'},async(url,o)=>{if(o.method==='DELETE'){assert.match(String(url),/\/bulk\/delete\/learner_profiles/);deleted=JSON.parse(o.body).ids;rows=rows.filter(r=>!deleted.includes(r.id));return Response.json({status:'success'})}return Response.json({status:'success',data:rows,metadata:{hasMore:false}})});
 await store.deleteRows('learner_profiles','owner-a',[1,999]);assert.deepEqual(deleted,[1]);assert.equal(rows.length,1);
});
test('a crash after the first cleanup lock has a persisted intent that resume can finish',async()=>{
 const h=setup();await h.job('episode');const plan=await deletionPlan(h.env,{...h.ctx,mode:'episode',id:'episode',now:h.ctx.now()}),state=await readControls(h.env,'site-a','learner-a',h.ctx.now()),op='cleanup-crash';
 await h.db.run('INSERT INTO data_operations(id,site_owner,learner_owner,scope,status,plan,created,updated) VALUES(?,?,?,?,?,?,?,?)',op,'site-a','learner-a',state.scopes.learner,'preparing',JSON.stringify(plan),h.ctx.now(),h.ctx.now());
 await h.db.run('UPDATE data_controls SET operation=?,epoch=epoch+1 WHERE scope=?',op,state.scopes.workspace);
 const r=await h.call({action:'resume',id:op});assert.equal(r.operation.status,'complete');assert.equal((await h.call()).jobs.length,0);assert.equal((await h.db.all('SELECT * FROM data_controls WHERE operation IS NOT NULL')).length,0);
});
test('resume unlocks a scope after a crash between local completion and lock release',async()=>{
 const h=setup(),state=await readControls(h.env,'site-a','learner-a',h.ctx.now()),id='cleanup-finished';
 const plan={localDone:true,providers:[],counts:{recordings:0},mode:'media'};
 await h.db.run('INSERT INTO data_operations(id,site_owner,learner_owner,scope,status,plan,created,updated) VALUES(?,?,?,?,?,?,?,?)',id,'site-a','learner-a',state.scopes.learner,'cleanup-pending',JSON.stringify(plan),h.ctx.now(),h.ctx.now());
 await h.db.run('UPDATE data_controls SET operation=? WHERE scope=?',id,state.scopes.learner);
 assert.equal((await h.call({action:'resume',id})).operation.status,'complete');assert.equal((await h.db.all('SELECT * FROM data_controls WHERE operation IS NOT NULL')).length,0);
});
test('automatic retention tolerates an in-flight write without failing the read or bumping epochs',async()=>{
 const h=setup();await h.asset('old');await h.call({action:'retention',scope:'learner',policy:{mediaDays:7}});h.setTime(208*DAY);const state=await readControls(h.env,'site-a','learner-a',h.ctx.now());
 await h.db.run('INSERT INTO data_leases(id,scope,expires) VALUES(?,?,?)','busy',state.scopes.learner,h.ctx.now()+60000);await enforceRetention(h.env,h.ctx);assert.equal((await readControls(h.env,'site-a','learner-a',h.ctx.now())).epoch,state.epoch);assert.equal(h.env.BUCKET.objects.size,1);
 await h.db.run('DELETE FROM data_leases WHERE id=?','busy');await enforceRetention(h.env,h.ctx);assert.equal(h.env.BUCKET.objects.size,0);
});
test('a failed personal cleanup never locks another learner in the same workspace',async()=>{
 const h=setup();await h.job('episode');await h.asset('media');h.env.BUCKET.failDelete=true;const plan=await deletionPlan(h.env,{...h.ctx,mode:'episode',id:'episode',now:h.ctx.now()});await assert.rejects(startDeletion(h.env,h.ctx,plan));
 const response=await withDataGuard(new Request('https://test',{method:'POST',headers:{'X-Mosaic-Data-Epoch':'0:0'}}),h.env,{...h.ctx,owner:'learner-b'},async()=>new Response('saved'));assert.equal(response.status,200);assert.equal((await h.call(null,{owner:'learner-b'})).operations.length,0);
});
test('a source cannot erase a different learner’s derived creative work',async()=>{
 const h=setup();await h.db.run('INSERT INTO workshop_resources VALUES(?,?,?,?,?,?,?)','source','site-a','Fixture','checksum','{}','reviewed',h.ctx.now());await h.job('chapter','game','learner-a','site-a',{chapterId:'generated-fixture',resourceVersions:[{id:'source'}]});await h.job('foreign-episode','creative','learner-b','site-a',{packId:'generated-fixture'});
 assert.equal((await h.call({action:'preview',mode:'resource',id:'source'})).status,409);assert(await h.db.one('SELECT id FROM workshop_jobs WHERE id=?','foreign-episode'));
});
test('normal retention evaluation is rate-limited, while an explicit data visit can check immediately',async()=>{
 const h=setup();let reads=0;const original=h.ctx.store.allRows;h.ctx.store.allRows=async(...args)=>{reads++;return original(...args)};await h.call({action:'retention',scope:'learner',policy:{progressDays:7}});await enforceRetention(h.env,h.ctx);assert.equal(reads,2);await enforceRetention(h.env,h.ctx);assert.equal(reads,2);await enforceRetention(h.env,h.ctx,{force:true});assert.equal(reads,4);
});
test('interrupted storage acknowledgement recovers existing bytes without another speech request',async()=>{
 const h=setup(),j=await h.job('recover');let calls=0;
 const args={env:h.env,...h.ctx,j,draft:JSON.parse(j.draft),index:0,requestKey:'recover-first',requestHash:'h',reserve:async p=>p,speech:async()=>{calls++;return {bytes:new Uint8Array([73,68,51,0])}},now:h.ctx.now};
 await persistentAudio(args);await h.db.run('UPDATE media_assets SET status=?','pending');h.setTime(200*DAY+61000);
 const replay=await persistentAudio({...args,requestKey:'recover-replay'});assert.equal(replay.headers.get('x-mosaic-audio'),'stored');assert.equal(calls,1);
 h.env.BUCKET.objects.clear();await h.db.run('UPDATE media_assets SET status=?,updated=?','pending',200*DAY);h.setTime(200*DAY+301000);
 await assert.rejects(persistentAudio({...args,requestKey:'recover-missing'}),e=>e.status===409);assert.equal(calls,1);assert.equal((await h.db.one('SELECT status FROM media_assets')).status,'failed');
});
test('progress retention removes all versions of expired slots while preserving a recently updated slot',async()=>{
 const h=setup();h.records.learner_saves.push({id:1,owner_key:'learner-a',slot_key:'old',updated_ms:190*DAY},{id:2,owner_key:'learner-a',slot_key:'old',updated_ms:191*DAY},{id:3,owner_key:'learner-a',slot_key:'recent',updated_ms:190*DAY},{id:4,owner_key:'learner-a',slot_key:'recent',updated_ms:199*DAY});
 await h.call({action:'retention',scope:'learner',policy:{progressDays:7}});await enforceRetention(h.env,h.ctx);
 assert.deepEqual(h.records.learner_saves.map(r=>r.id),[3,4]);assert.equal((await h.call()).resetKind,'expired');
});
