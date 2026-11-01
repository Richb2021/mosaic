import {activitiesOf} from '../src/studio/programme.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {D1,Bucket} from './helpers/media-storage.mjs';
import {pilotAPI,learnerOwner,workspaceIdentity,PILOT_NOTICE} from '../server/pilot-access.js';
import {workshopGateway} from '../server/workshop-gateway.js';
import {learningAPI} from '../server/learning-api.js';
import {maintenanceAPI} from '../server/background-retention.js';
import {startCost,finishCost,budgetStatus} from '../server/cost-ledger.js';
import {EXTENDED_PACKS} from '../src/game-modes/extended-packs.js';
import {draftHash} from '../src/game-modes/draft-engine.js';
import {sqlDB} from '../server/data-control.js';
class Store{
 rows=new Map();
 async latest(t,o,s){return this.rows.get(t+o+s)||null}
 async list(o){return [...this.rows.values()].filter(r=>r.owner_key===o&&r.table==='learner_saves')}
 async allRows(t,o){return [...this.rows.values()].filter(r=>r.owner_key===o&&r.table===t)}
 async deleteRows(t,o,ids){for(const [key,r] of this.rows)if(r.table===t&&r.owner_key===o&&ids.includes(r.id))this.rows.delete(key)}
 async write(t,o,s,v,p,at){assert.equal((await this.latest(t,o,s))?.version||0,v);const r={table:t,owner_key:o,slot_key:s,version:v+1,payload:JSON.stringify(p),updated_ms:at,id:crypto.randomUUID()};this.rows.set(t+o+s,r);return r}
}
const user=id=>({id,email:id+'@example.test',name:id,emailVerified:true});
async function setup(){
 const admin=user('admin'),a=user('learner-a'),b=user('learner-b'),store=new Store(),env={DB:new D1(),BUCKET:new Bucket(),PILOT_ENABLED:'true',PILOT_ADMIN_OWNER:await learnerOwner(admin),MAINTENANCE_SECRET:'test-secret-'.repeat(4),RETENTION_BACKGROUND_ENABLED:'true'};
 const req=(u,path,body,headers={})=>new Request('https://game.test'+path,{method:body?'POST':'GET',headers:{Origin:'https://game.test','Content-Type':'application/json','X-Mosaic-Learner':u?.id||'','X-Lanternbound-Workshop':'1',...headers},body:body?JSON.stringify(body):undefined});
 const call=async(u,body)=>{const r=await pilotAPI(req(u,'/api/pilot',body),env,{session:async()=>u,store});return {status:r.status,...await r.json()}};
 const welcome=async(u,ageBand='18plus')=>call(u,{action:'onboarding',ageBand,confirmed:true,noticeVersion:PILOT_NOTICE,expectedVersion:0});
 const invite=async(u,extra={},manager=admin)=>{const i=await call(manager,{action:'invite',email:u.email,...extra});assert.equal(i.status,200,JSON.stringify(i));const accepted=await call(u,{action:'claim',code:i.code});assert.equal(accepted.status,200,JSON.stringify(accepted));return i};
 const workshop=async(u,path,body,headers={})=>{const r=await workshopGateway(req(u,'/api/workshop/'+path,body,headers),env,{session:async()=>u,store});return {status:r.status,...await r.json()}};
 const learning=async(u,path,body,headers={})=>{const r=await learningAPI(req(u,'/api/learning/'+path,body,headers),env,{session:async()=>u,store});return {status:r.status,...await r.json()}};
 return {admin,a,b,store,env,req,call,welcome,invite,workshop,learning};
}
test('verified NCB identity determines personal ownership; only explicit admin inherits legacy library',async()=>{
 const h=await setup(),db=sqlDB(h.env.DB);h.env.PILOT_KEEP_LEGACY_ADMIN_LIBRARY='true';await db.run('INSERT INTO data_controls(scope,policy,updated) VALUES(?,?,?)','maintenance:workspace','{"siteOwner":"legacy-owner"}',1);
 assert.equal((await workspaceIdentity(h.admin,h.env)).siteOwner,'legacy-owner');assert.equal((await workspaceIdentity(h.a,h.env)).siteOwner,'personal:'+await learnerOwner(h.a));
 assert.equal((await h.workshop(null,'library',null,{'oai-authenticated-user-id':'legacy-owner'})).status,401);
 await h.invite(h.a);assert.equal((await h.workshop(h.a,'library')).status,428);assert.equal((await h.welcome(h.a)).status,200);
 const source={title:'Private fixture notes',text:'These are synthetic source notes used to check the personal library boundary. They are not real educational claims. Each learner has an isolated library.'};
 const uploaded=await h.workshop(h.a,'resources',source,{'oai-authenticated-user-id':'legacy-owner'});assert.equal(uploaded.status,201);
 await h.invite(h.b);await h.welcome(h.b);
 const other=await h.workshop(h.b,'library',null,{'oai-authenticated-user-id':'legacy-owner'});assert.equal(other.resources.length,0);
 assert.equal((await h.workshop(h.b,'resources/'+uploaded.resource.id+'/review',{confirmed:true,checksum:uploaded.resource.checksum})).status,404);
 assert.equal((await h.workshop(h.a,'library',null,{'X-Mosaic-Learner':h.b.id})).status,401);
 assert.equal((await db.one('SELECT owner FROM workshop_resources WHERE id=?',uploaded.resource.id)).owner,'personal:'+await learnerOwner(h.a));
});
test('invitations bind email, role and verified manager; younger learners need managed approval',async()=>{
 const h=await setup(),i=await h.call(h.admin,{action:'invite',email:h.a.email});assert.equal((await h.call(h.b,{action:'claim',code:i.code})).status,403);
 assert.equal((await h.call(h.a,{action:'claim',code:i.code})).status,200);
 assert.equal((await h.welcome(h.a,'under13')).status,403);assert.equal((await h.welcome(h.a,'13to17')).status,403);
 const teacher=user('teacher');await h.invite(teacher,{role:'teacher',context:'school',managedApproval:true});await h.welcome(teacher);
 assert.equal((await h.call(teacher,{action:'invite',email:h.b.email,role:'teacher',context:'school',managedApproval:true})).status,403);
 assert.equal((await h.call(teacher,{action:'invite',email:h.b.email,context:'family',managedApproval:true})).status,403);
 assert.equal((await h.call(teacher,{action:'invite',email:h.b.email,context:'school'})).status,400);
 await h.invite(h.b,{context:'school',managedApproval:true,label:'Synthetic student'},teacher);assert.equal((await h.welcome(h.b,'under13')).status,200);
 assert.equal((await h.call(h.b)).onboarding.ageBand,'under13');assert.equal((await h.call(teacher)).roster.length,1);
 assert.equal((await h.call(teacher,{action:'revoke',accountReference:await learnerOwner(h.a)})).status,403);
 assert.equal((await h.call(h.admin,{action:'revoke',accountReference:await learnerOwner(teacher)})).status,200);
 assert.equal((await h.workshop(h.b,'library')).status,403);assert.equal((await h.learning(h.b,'data')).status,200);
});
test('assigned published chapters are readable and playable but never editable; revocation withdraws grant',async()=>{
 const h=await setup(),teacher=user('teacher');await h.invite(teacher,{role:'teacher',context:'school',managedApproval:true});await h.welcome(teacher);
 await h.invite(h.a,{context:'school',managedApproval:true},teacher);await h.welcome(h.a,'13to17');await h.invite(h.b);await h.welcome(h.b);
 const pack={...EXTENDED_PACKS.find(p=>p.template==='quiz-v1'),id:'generated-assignment'},ctx=await workspaceIdentity(teacher,h.env),db=sqlDB(h.env.DB);
 await db.run('INSERT INTO workshop_jobs(id,owner,request_key,request_hash,status,payload,draft,created,updated) VALUES(?,?,?,?,?,?,?,?,?)','assigned-job',ctx.siteOwner,'fixture','hash','review','{}',JSON.stringify(pack),1,1);
 const assignment={action:'assign',jobId:'assigned-job',accountReference:await learnerOwner(h.a)};
 assert.equal((await h.call(teacher,assignment)).status,404);await db.run('UPDATE workshop_jobs SET status=? WHERE id=?','published','assigned-job');assert.equal((await h.call(teacher,assignment)).status,200);
 const catalog=await h.learning(h.a,'studio/catalog');assert(catalog.items.some(x=>x.pack.id===pack.id&&x.readOnly));
 assert.equal((await h.workshop(h.a,'jobs/assigned-job')).job.draft.id,pack.id);assert.equal((await h.workshop(h.b,'jobs/assigned-job')).status,404);
 assert.equal((await h.workshop(h.a,'jobs/assigned-job/publish',{confirmed:true,draftHash:'fake'})).status,403);
 const started=await h.learning(h.a,'studio',{type:'create',expectedVersion:0,packId:pack.id,contentHash:draftHash(pack),evidenceConfirmed:true,activityKeys:activitiesOf(pack).map(a=>a.key)});
 assert.equal(started.status,200,JSON.stringify(started));
 await h.call(teacher,{action:'revoke',accountReference:await learnerOwner(h.a)});assert.equal((await h.workshop(h.a,'jobs/assigned-job')).status,403);
});
test('administrator pause, atomic daily reservations and unknown usage prevent unintended provider spending',async()=>{
 const h=await setup();await h.invite(h.a);await h.welcome(h.a);assert.equal((await h.call(h.a,{action:'pause',paused:true})).status,403);
 const payload={siteOwner:'personal:test',model:'s2.1-pro',request:{inputBytes:1000},now:Date.now()};h.env.PILOT_DAILY_BUDGET_USD='0.02';
 const results=await Promise.allSettled([startCost(h.env,{...payload,id:'a'}),startCost(h.env,{...payload,id:'b'})]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
 const id=results[0].status==='fulfilled'?'a':'b';await finishCost(h.env,{id,siteOwner:payload.siteOwner,status:'unknown'});assert.equal((await budgetStatus(h.env,payload.siteOwner)).allocatedUsd,.015);
 await assert.rejects(()=>startCost(h.env,{...payload,id:'c'}),e=>e.status===429);
 await finishCost(h.env,{id,siteOwner:payload.siteOwner,usage:{inputBytes:10}});assert.equal((await budgetStatus(h.env,payload.siteOwner)).allocatedUsd,.00015);
 await h.call(h.admin,{action:'pause',paused:true});await assert.rejects(()=>startCost(h.env,{...payload,id:'d'}),e=>e.status===503);assert.equal((await h.workshop(h.a,'library')).status,200);
 await h.call(h.admin,{action:'pause',paused:false});await startCost(h.env,{...payload,id:'e'});
});
test('maintenance requires an independent secret even when callers spoof site and purpose headers',async()=>{
 const h=await setup(),req=authorization=>new Request('https://game.test/api/maintenance',{headers:{'X-Mosaic-Maintenance':'retention-v1','oai-authenticated-user-id':'admin',...(authorization?{Authorization:authorization}:{})}});
 assert.equal((await maintenanceAPI(req(),h.env,{store:h.store})).status,403);
 assert.equal((await maintenanceAPI(req('Bearer wrong'),h.env,{store:h.store})).status,403);
 assert.equal((await maintenanceAPI(req('Bearer '+h.env.MAINTENANCE_SECRET),h.env,{store:h.store})).status,200);
});

test('account closure withdraws access, verifies learning cleanup and waits for separate provider deletion',async()=>{
 const h=await setup();await h.invite(h.a);await h.welcome(h.a);
 assert.equal((await h.call(h.admin,{action:'close',confirmed:true,confirmEmail:h.admin.email})).status,409);
 assert.equal((await h.call(h.a,{action:'close',confirmed:true,confirmEmail:h.b.email})).status,400);
 const closed=await h.call(h.a,{action:'close',confirmed:true,confirmEmail:h.a.email});assert.equal(closed.status,200,JSON.stringify(closed));assert.equal(closed.closure.status,'provider-pending');
 assert.equal((await h.workshop(h.a,'library')).status,403);assert.equal((await h.learning(h.a,'data')).status,200);
 assert.equal((await h.store.allRows('learner_profiles',await learnerOwner(h.a))).length,0);
 const admin=await h.call(h.admin);assert.equal(admin.operations.closures.length,1);assert(!('userId' in admin.operations.closures[0]));
});
test('managed authoring permission is organiser-owned, not unlocked by self-declared adulthood',async()=>{
 const h=await setup(),teacher=user('teacher');await h.invite(teacher,{role:'teacher',context:'school',managedApproval:true});await h.welcome(teacher);
 await h.invite(h.a,{context:'school',managedApproval:true},teacher);await h.welcome(h.a,'18plus');
 assert.equal((await h.workshop(h.a,'resources',{title:'Bypass',text:'Trying to bypass managed source authoring with a self-declared adult age band.'})).status,403);
 assert.equal((await h.learning(h.a,'creative',{action:'create'})).status,403);
 const before=await h.call(h.a);assert.equal((await h.call(h.a,{action:'onboarding',ageBand:'under13',confirmed:true,noticeVersion:PILOT_NOTICE,expectedVersion:before.version})).status,409);
 await h.invite(h.b,{context:'school',managedApproval:true,adultAuthor:true},teacher);await h.welcome(h.b,'18plus');
 assert.equal((await h.workshop(h.b,'resources',{title:'College adult',text:'These synthetic notes check that an organiser can explicitly authorise an adult learner to prepare their own source material.'})).status,201);
});
test('unverified email cannot consume an invitation; successful verification permits the same code',async()=>{
 const h=await setup(),i=await h.call(h.admin,{action:'invite',email:h.a.email});h.a.emailVerified=false;
 assert.equal((await h.call(h.a,{action:'claim',code:i.code})).status,403);h.a.emailVerified=true;assert.equal((await h.call(h.a,{action:'claim',code:i.code})).status,200);
});
test('explicit admin storage transfer preserves exact old namespace and retires the previous account',async()=>{
 const h=await setup(),old=await learnerOwner(h.a);h.env.PILOT_ADMIN_STORAGE_OWNER=old;h.env.PILOT_KEEP_LEGACY_ADMIN_LIBRARY='true';
 await sqlDB(h.env.DB).run('INSERT INTO data_controls(scope,policy,updated) VALUES(?,?,?)','maintenance:workspace','{"siteOwner":"legacy"}',1);
 await h.store.write('learner_profiles',old,'profile',0,{profile:{goal:'Keep my original goal'}},1);
 assert.deepEqual(await workspaceIdentity(h.admin,h.env),{owner:old,principal:await learnerOwner(h.admin),siteOwner:'legacy',admin:true});
 await h.welcome(h.admin);const journal=await h.learning(h.admin,'journal');assert.equal(journal.profile.goal,'Keep my original goal');
 assert.equal((await h.learning(h.a,'data')).status,403);assert.equal((await h.workshop(h.a,'library')).status,403);
});
test('unknown-member revocation cannot manufacture admission, and uninvited data requests do not register subjects',async()=>{
 const h=await setup();assert.equal((await h.call(h.admin,{action:'revoke',accountReference:await learnerOwner(h.a)})).status,404);
 assert.equal((await h.call(h.admin,{action:'restore-access',accountReference:await learnerOwner(h.a)})).status,403);
 assert.equal((await h.learning(h.a,'data')).status,403);assert.equal((await sqlDB(h.env.DB).one('SELECT COUNT(*) AS n FROM retention_subjects')).n,0);
});
test('budget typos disable generation while welcome and data controls remain usable',async()=>{
 const h=await setup();await h.invite(h.a);await h.welcome(h.a);h.env.PILOT_DAILY_BUDGET_USD='invalid';
 assert.equal((await h.call(h.a)).budget.configured,false);assert.equal((await h.learning(h.a,'data')).status,200);
 await assert.rejects(()=>startCost(h.env,{id:'bad-price',siteOwner:'x',model:'s2.1-pro',request:{inputBytes:1}}),e=>e.status===503);
});
test('organiser closure requires dependent transfer or closure; administrator can transfer without exposing progress',async()=>{
 const h=await setup(),teacher=user('teacher');await h.invite(teacher,{role:'teacher',context:'school',managedApproval:true});await h.welcome(teacher);await h.invite(h.a,{context:'school',managedApproval:true},teacher);await h.welcome(h.a,'13to17');
 assert.equal((await h.call(teacher,{action:'close',confirmEmail:teacher.email,confirmed:true})).status,409);assert.equal((await h.call(teacher)).admitted,true);
 assert.equal((await h.call(h.admin,{action:'reassign',accountReference:await learnerOwner(h.a),manager:await learnerOwner(h.admin)})).status,200);
 assert.equal((await h.call(teacher,{action:'close',confirmEmail:teacher.email,confirmed:true})).closure.status,'provider-pending');assert.equal((await h.learning(h.a,'journal')).status,200);
});
test('withdrawal cannot revive closing or closed membership tombstones',async()=>{
 const h=await setup(),owner=await learnerOwner(h.a),db=sqlDB(h.env.DB);
 for(const status of ['closing','closed']){
  const policy=JSON.stringify({status,manager:await learnerOwner(h.admin)});
  await db.run('INSERT INTO data_controls(scope,policy,updated) VALUES(?,?,?) ON CONFLICT(scope) DO UPDATE SET policy=excluded.policy','pilot-member:'+owner,policy,1);
  assert.equal((await h.call(h.admin,{action:'revoke',accountReference:owner})).status,409);
  assert.equal((await h.call(h.admin,{action:'restore-access',accountReference:owner})).status,403);
  assert.equal((await db.one('SELECT policy FROM data_controls WHERE scope=?','pilot-member:'+owner)).policy,policy);
 }
});
test('saved closure recovers from a finishing save without learner returning and removes sweep identifiers',async()=>{
 const {operationsAPI}=await import('../server/launch-operations.js'),{controlScopes}=await import('../server/data-control.js');
 const h=await setup();await h.invite(h.a);await h.welcome(h.a);await h.learning(h.a,'journal');
 const owner=await learnerOwner(h.a),ctx=await workspaceIdentity(h.a,h.env),db=sqlDB(h.env.DB),scopes=await controlScopes(ctx.siteOwner,owner);
 await db.run('INSERT INTO data_leases(id,scope,expires) VALUES(?,?,?)','still-saving',scopes.learner,Date.now()+60000);
 const close=await h.call(h.a,{action:'close',confirmed:true,confirmEmail:h.a.email});assert.equal(close.status,200);assert.equal(close.closure.status,'cleaning');
 await db.run('DELETE FROM data_leases WHERE id=?','still-saving');
 const maintenance=new Request('https://game.test/api/maintenance',{method:'POST',headers:{Authorization:'Bearer '+h.env.MAINTENANCE_SECRET,'X-Mosaic-Maintenance':'retention-v1'}});
 assert.equal((await maintenanceAPI(maintenance,h.env,{store:h.store})).status,200);
 assert.equal(JSON.parse((await db.one('SELECT policy FROM data_controls WHERE scope=?','pilot-close:'+owner)).policy).status,'provider-pending');
 const confirm=()=>new Request('https://game.test/api/operations',{method:'POST',headers:{Authorization:'Bearer '+h.env.MAINTENANCE_SECRET,'X-Mosaic-Maintenance':'closure-v1','Content-Type':'application/json'},body:JSON.stringify({action:'confirm-provider-deletion',accountReference:owner,providerDeleted:true})});
 assert.equal((await operationsAPI(confirm(),h.env)).status,200);assert.equal((await operationsAPI(confirm(),h.env)).status,200);
 assert.equal((await db.one('SELECT COUNT(*) AS n FROM retention_subjects WHERE learner_owner=?',owner)).n,0);
 assert.equal(await db.one('SELECT scope FROM data_controls WHERE scope=?',scopes.learner),null);assert.equal(await db.one('SELECT scope FROM data_controls WHERE scope=?',scopes.workspace),null);
});
test('uninvited closure cannot manufacture membership or a cleanup request',async()=>{
 const h=await setup(),owner=await learnerOwner(h.a),db=sqlDB(h.env.DB);
 assert.equal((await h.call(h.a,{action:'close',confirmed:true,confirmEmail:h.a.email})).status,403);
 assert.equal(await db.one('SELECT scope FROM data_controls WHERE scope=?','pilot-member:'+owner),null);
 assert.equal(await db.one('SELECT scope FROM data_controls WHERE scope=?','pilot-close:'+owner),null);
 await h.invite(h.a);assert.equal((await h.call(h.a)).admitted,true);
});
