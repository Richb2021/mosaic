import test from 'node:test';
import assert from 'node:assert/strict';
import {D1,Bucket} from './helpers/media-storage.mjs';
import {pilotAPI,learnerOwner,PILOT_NOTICE} from '../server/pilot-access.js';
import {startCost,budgetStatus} from '../server/cost-ledger.js';
import {generationBudget,budgetMessage} from '../server/workshop-budget.js';
import {allowancePolicy,ALLOWANCE_HINT} from '../server/allowance.js';
import {sqlDB} from '../server/data-control.js';
const HOUR=3600000;
class Store{
 rows=new Map();
 async latest(t,o,s){return this.rows.get(t+o+s)||null}
 async list(){return []}
 async allRows(){return []}
 async deleteRows(){}
 async write(t,o,s,v,p,at){const r={table:t,owner_key:o,slot_key:s,version:v+1,payload:JSON.stringify(p),updated_ms:at,id:crypto.randomUUID()};this.rows.set(t+o+s,r);return r}
}
const user=id=>({id,email:id+'@example.test',name:'Synthetic '+id,emailVerified:true});
async function setup(){
 const admin=user('admin'),a=user('learner-a'),b=user('learner-b'),teacher=user('teacher'),store=new Store();
 const env={DB:new D1(),BUCKET:new Bucket(),PILOT_ENABLED:'true',PILOT_ADMIN_OWNER:await learnerOwner(admin),PILOT_DAILY_BUDGET_USD:'0.02',PILOT_GLOBAL_DAILY_BUDGET_USD:'0.05',WORKSHOP_GENERATION_LIMIT:'2',PILOT_SUPPORT_EMAIL:'help@example.test'};
 const req=(u,body)=>new Request('https://game.test/api/pilot',{method:body?'POST':'GET',headers:{Origin:'https://game.test','Content-Type':'application/json','X-Mosaic-Learner':u?.id||''},body:body?JSON.stringify(body):undefined});
 const call=async(u,body)=>{const r=await pilotAPI(req(u,body),env,{session:async()=>u,store});return {status:r.status,...await r.json()}};
 const join=async(u,extra={},manager=admin,ageBand='18plus')=>{const i=await call(manager,{action:'invite',email:u.email,...extra});assert.equal(i.status,200,JSON.stringify(i));assert.equal((await call(u,{action:'claim',code:i.code})).status,200);assert.equal((await call(u,{action:'onboarding',ageBand,confirmed:true,noticeVersion:PILOT_NOTICE,expectedVersion:0})).status,200)};
 await join(a,{label:'Ada'});await join(b);await join(teacher,{role:'teacher',context:'school',managedApproval:true});
 const ref={a:await learnerOwner(a),b:await learnerOwner(b),teacher:await learnerOwner(teacher)};
 return {admin,a,b,teacher,env,call,join,ref,db:sqlDB(env.DB)};
}
const spend=(siteOwner,id,now=Date.now())=>({id,siteOwner,model:'s2.1-pro',request:{inputBytes:1000},now});// reserves $0.015

test('an allowance raises personal spending and generation limits but never past the app-wide cap',async()=>{
 const h=await setup(),site='personal:'+h.ref.a,other='personal:'+h.ref.b;
 await startCost(h.env,spend(site,'a1'));
 await assert.rejects(()=>startCost(h.env,spend(site,'a2')),e=>e.status===429&&e.message.includes(ALLOWANCE_HINT)&&!/everyone/.test(e.message));
 assert.equal((await generationBudget(h.db.one,site,h.env,Date.now())).limit,2);
 const set=await h.call(h.admin,{action:'allowance-set',accountReference:h.ref.a,preset:'custom',custom:{dailyUsd:0.5,generations:30},hours:24});
 assert.equal(set.status,200,JSON.stringify(set));assert.equal(set.allowance.label,'Custom');
 const g=await generationBudget(h.db.one,site,h.env,Date.now());assert.equal(g.limit,30);assert.equal(g.remaining,30);assert.equal(g.allowance.label,'Custom');
 assert.equal((await generationBudget(h.db.one,other,h.env,Date.now())).limit,2);
 await startCost(h.env,spend(site,'a2'));
 let status=await budgetStatus(h.env,site);assert.equal(status.limitUsd,0.5);assert.equal(status.allowance.label,'Custom');assert.equal(status.generations.limit,30);
 assert(Math.abs(status.remainingUsd-0.02)<1e-9,'remaining is capped by the app-wide limit');
 await startCost(h.env,spend(other,'b1'));// $0.045 of $0.05 now allocated
 await assert.rejects(()=>startCost(h.env,spend(site,'a3')),e=>e.status===429&&/for everyone/.test(e.message)&&/midnight UTC/.test(e.message));
 status=await budgetStatus(h.env,site);assert.equal(status.appLimitReached,false);assert.equal(status.aboutGenerations,0);
 // A paused workshop limit is never lifted by an allowance.
 h.env.WORKSHOP_GENERATION_LIMIT='0';assert.equal((await generationBudget(h.db.one,site,h.env,Date.now())).limit,0);
});

test('expired allowances are ignored for spending and generations',async()=>{
 const h=await setup(),site='personal:'+h.ref.a,start=Date.now();
 assert.equal((await h.call(h.admin,{action:'allowance-set',accountReference:h.ref.a,preset:'judge',hours:1})).status,200);
 assert.equal((await budgetStatus(h.env,site,start)).limitUsd,5);
 const later=start+2*HOUR;
 assert.equal((await budgetStatus(h.env,site,later)).limitUsd,0.02);assert.equal((await budgetStatus(h.env,site,later)).allowance,null);
 assert.equal((await generationBudget(h.db.one,site,h.env,later)).limit,2);
 await startCost(h.env,spend(site,'x1',later));await assert.rejects(()=>startCost(h.env,spend(site,'x2',later)),e=>e.status===429);
 assert.equal((await h.call(h.admin)).operations.allowances.length,1);
 for(const hours of [0,721,1.5])assert.equal((await h.call(h.admin,{action:'allowance-set',accountReference:h.ref.a,preset:'judge',hours})).status,400);
 assert.equal((await h.call(h.admin,{action:'allowance-set',accountReference:h.ref.a,custom:{dailyUsd:60,generations:10}})).status,400);
 assert.equal((await h.call(h.admin,{action:'allowance-set',accountReference:h.ref.a,custom:{dailyUsd:2,generations:501}})).status,400);
 assert.equal(allowancePolicy({preset:'extended'},{now:0,setBy:'x'}).expires,72*HOUR);
});

test('only the administrator can set, clear or decline allowances',async()=>{
 const h=await setup();
 for(const u of [h.teacher,h.a])for(const body of [{action:'allowance-set',accountReference:h.ref.b,preset:'judge'},{action:'allowance-clear',accountReference:h.ref.b},{action:'allowance-decline',accountReference:h.ref.b}])
  assert.equal((await h.call(u,body)).status,403,u.id+' '+body.action);
 assert.equal((await h.call(h.admin,{action:'allowance-set',accountReference:h.ref.b,preset:'extended'})).status,200);
 assert.equal((await budgetStatus(h.env,'personal:'+h.ref.b)).limitUsd,3);
 assert.equal((await h.call(h.teacher,{action:'allowance-clear',accountReference:h.ref.b})).status,403);
 assert.equal((await h.call(h.admin,{action:'allowance-clear',accountReference:h.ref.b})).status,200);
 assert.equal((await budgetStatus(h.env,'personal:'+h.ref.b)).limitUsd,0.02);
 assert.equal((await h.call(h.admin)).operations.allowances.length,0);
 const audit=await h.db.all("SELECT action FROM data_events WHERE scope=? ORDER BY created",'pilot-member:'+h.ref.b);
 assert(audit.some(x=>x.action==='allowance-set')&&audit.some(x=>x.action==='allowance-cleared'));
});

test('people can ask for more: one open request, updates, a daily limit, and approval or decline closes it',async()=>{
 const h=await setup();
 assert.equal((await h.call(h.a,{action:'allowance-request',reason:'free-money'})).status,400);
 assert.equal((await h.call(h.a,{action:'allowance-request',reason:'pay',note:'x'.repeat(301)})).status,400);
 const stranger=user('stranger');assert.equal((await h.call(stranger,{action:'allowance-request',reason:'judge'})).status,403);
 let r=await h.call(h.a,{action:'allowance-request',reason:'more',note:'Building a class quiz'});assert.equal(r.status,200,JSON.stringify(r));
 r=await h.call(h.a,{action:'allowance-request',reason:'judge',note:'Judging tonight'});assert.equal(r.status,200);
 let mine=await h.call(h.a);assert.equal(mine.allowanceRequest.status,'open');assert.equal(mine.allowanceRequest.reason,'judge');assert.equal(mine.operations,null);
 let ops=(await h.call(h.admin)).operations;assert.equal(ops.allowanceRequests.length,1);
 assert.deepEqual({...ops.allowanceRequests[0],created:0,updated:0},{accountReference:h.ref.a,name:'Ada',displayName:'Synthetic learner-a',email:'learner-a@example.test',reason:'judge',note:'Judging tonight',created:0,updated:0});
 assert.equal((await h.call(h.a,{action:'allowance-request',reason:'pay'})).status,200);
 const limited=await h.call(h.a,{action:'allowance-request',reason:'pay',note:'again'});assert.equal(limited.status,429);assert.match(limited.error,/help@example\.test/);
 const set=await h.call(h.admin,{action:'allowance-set',accountReference:h.ref.a,preset:'judge'});assert.equal(set.closedRequest,true);
 mine=await h.call(h.a);assert.equal(mine.allowanceRequest.status,'approved');assert.equal(mine.budget.allowance.label,'Judge');assert.equal(mine.budget.generations.limit,40);
 ops=(await h.call(h.admin)).operations;assert.equal(ops.allowanceRequests.length,0);assert.equal(ops.allowances.length,1);
 assert.equal(ops.allowances[0].accountReference,h.ref.a);assert.equal(ops.allowances[0].reason,'pay');assert.equal(ops.allowances[0].dailyUsd,5);
 const stored=JSON.parse((await h.db.one('SELECT policy FROM data_controls WHERE scope=?','allowance-request:personal:'+h.ref.a)).policy);assert.equal(stored.email,undefined,'closing drops contact details');
 assert.equal((await h.call(h.b,{action:'allowance-request',reason:'pay'})).status,200);
 assert.equal((await h.call(h.admin,{action:'allowance-decline',accountReference:h.ref.b})).status,200);
 assert.equal((await h.call(h.b)).allowanceRequest.status,'declined');assert.equal((await h.call(h.admin,{action:'allowance-decline',accountReference:h.ref.b})).status,404);
 assert.equal((await budgetStatus(h.env,'personal:'+h.ref.b)).allowance,null);
});

test('a teacher sees no allowance data or other people’s references; closing an account removes its request',async()=>{
 const h=await setup(),pupil=user('pupil');await h.join(pupil,{context:'school',managedApproval:true},h.teacher,'13to17');
 await h.call(h.a,{action:'allowance-request',reason:'pay',note:'Contact me'});await h.call(h.admin,{action:'allowance-set',accountReference:h.ref.b,preset:'judge'});
 const view=await h.call(h.teacher),text=JSON.stringify(view);
 assert.equal(view.operations,null);assert.equal(view.allowanceRequest,null);assert.equal(view.budget.allowance,null);assert.equal(view.roster.length,1);
 for(const secret of [h.ref.a,h.ref.b,'learner-a@example.test','allowanceRequests','Contact me'])assert(!text.includes(secret),secret);
 assert.equal((await h.call(h.a,{action:'close',confirmEmail:h.a.email,confirmed:true})).status,200);
 assert.equal(await h.db.one('SELECT scope FROM data_controls WHERE scope=?','allowance-request:personal:'+h.ref.a),null);
});

test('limit messages point people to the Welcome page',()=>{
 assert(budgetMessage({limit:10,used:10,remaining:0,nextAvailableAt:Date.now()}).endsWith(ALLOWANCE_HINT));
 assert.match(budgetMessage({limit:40,used:40,remaining:0,allowance:{label:'Judge'}}),/^Your Judge allowance of 40/);
 assert.equal(ALLOWANCE_HINT,'Ask for a higher allowance on the Welcome page.');
});
