import test from 'node:test';
import assert from 'node:assert/strict';
import {sharingFixture} from './helpers/course-sharing.mjs';
import {newUnit,activitiesOf} from '../src/studio/programme.js';
import {creativeContext} from '../src/studio/creative-content.js';
import {validatePractice,LOOP_STAGES} from '../src/studio/learning-loop.js';
import {draftHash} from '../src/game-modes/draft-engine.js';
import {digest} from '../server/content-service.js';
import {learnerOwner} from '../server/pilot-access.js';
import {deletionPlan,startDeletion,enforceRetention,resumeDeletion} from '../server/data-lifecycle.js';
import {readControls} from '../server/data-control.js';
async function fixture(){
 const h=await sharingFixture(),pack=h.chapters[0].pack,unit=newUnit(pack,{goal:'PRIVATE_AUTHOR_GOAL'},activitiesOf(pack).map(a=>a.key)),p={id:'creative-shared-bank',kind:'practice',recordType:'creative',learnerOwner:h.identity.owner,packId:pack.id,contentHash:draftHash(pack),activityKey:unit.activityKeys[0],context:creativeContext(pack,unit,'practice',unit.activityKeys[0])};
 const refs=[p.context.evidence[0].id],bank=validatePractice({schemaVersion:1,id:p.id,kind:'practice',title:'Reviewed group questions',objective:'Explain the relationship.',explanation:p.context.evidence[0].excerpt,sourceRefs:refs,questions:LOOP_STAGES.map((stage,i)=>({stage,prompt:`Fresh group scenario ${i+1}?`,options:['Supported','Reversed','Unrelated'],answer:0,feedback:['Supported by the source.','Reverse the direction.','Compare with the evidence.'],hint:'Consider the direction.',sourceRefs:refs}))},p),hash=await digest(JSON.stringify(bank));
 await h.db.run('INSERT INTO workshop_jobs(id,owner,request_key,request_hash,status,payload,draft,created,updated) VALUES(?,?,?,?,?,?,?,?,?)',p.id,h.identity.siteOwner,p.id,'fixture','creative-published',JSON.stringify(p),JSON.stringify(bank),h.now(),h.now());
 const questionBanks=[{objectiveId:'objective-1',id:p.id,hash}],assign=extra=>h.assignCourse(h.learner,{questionBanks,...extra}),loop=(body,user=h.learner)=>h.call(user,'learning/loop'+(body?'':'?'+new URLSearchParams({bankId:p.id,bankHash:hash})),body?{bankId:p.id,bankHash:hash,...body}:undefined);
 const open=async()=>h.call(h.learner,'learning/studio',{expectedVersion:0,packId:pack.id,contentHash:draftHash(pack),type:'create',activityKeys:unit.activityKeys});
 return {...h,pack,p,bank,hash,questionBanks,assign,loop,open};
}
test('assigned bank is a frozen reviewed snapshot; current question only, own answers, own export, no author context',async()=>{
 const h=await fixture(),available=await h.call(h.teacher,'learning/course-sharing?'+new URLSearchParams({view:'questions',courseId:h.course.id,planHash:h.planHash}));assert.equal(available.http,200);assert.equal(available.steps[0].banks[0].id,h.bank.id);assert.equal(available.steps[1].banks.length,0);assert(!JSON.stringify(available).includes('PRIVATE_AUTHOR'));
 const a=await h.assign();assert.equal(a.http,200);assert.equal(a.assignment.steps[0].questionBank.questions,4);assert(!JSON.stringify(a).includes('Fresh group scenario'));assert.equal((await h.assign()).assignment.revision,a.assignment.revision);assert.equal((await h.assignCourse()).assignment.revision,a.assignment.revision,'Reopening delivery preserves a previously selected bank');
 assert.equal((await h.open()).http,200);
 const list=await h.call(h.learner,'learning/loop/banks?'+new URLSearchParams({packId:h.pack.id,contentHash:draftHash(h.pack)}));assert.equal(list.jobs[0].readOnly,true);assert.deepEqual(list.jobs[0].draft,{title:h.bank.title});
 let v=await h.loop();assert.equal(v.http,200);assert.equal(v.assigned,true);assert.equal(v.profile,undefined);assert.equal(v.question.answer,undefined);assert(!JSON.stringify(v).includes('Fresh group scenario 2'));
 v=await h.loop({expectedVersion:0,action:{type:'answer',stage:'diagnostic',answer:0,confidence:'confident'}});assert.equal(v.version,1);assert.equal(v.question.stage,'practice');assert.equal((await h.loop({expectedVersion:0,action:{type:'answer',stage:'diagnostic',answer:0,confidence:'confident'}})).http,409);
 assert.equal((await h.loop(null,h.second)).http,404);assert.equal((await h.loop(null,h.other)).http,404);
 await h.db.run('UPDATE workshop_jobs SET status=? WHERE id=?','creative-review',h.bank.id);assert.equal((await h.loop()).http,200,'Author re-opening does not mutate the frozen assignment');
 const inv=await h.call(h.learner,'learning/data'),exported=await h.call(h.learner,'learning/data',{action:'export',epoch:inv.epoch});assert.equal(exported.http,200);assert(!JSON.stringify(exported).includes('PRIVATE_AUTHOR'));assert(!JSON.stringify(exported).includes('Fresh group scenario 4'));assert(exported.export.profiles.some(r=>r.slot.startsWith('loop-')));
 assert.equal((await h.report()).assignments[0].report.state,'off');assert(!JSON.stringify(await h.report()).includes('diagnostic'));
 const rows=await h.store.allRows('learner_profiles',h.identity.owner);assert(!rows.some(r=>r.slot_key.startsWith('loop-')));
});
test('selection rejects cross-chapter, stale, unreviewed and malformed sets without changing the grant',async()=>{
 const h=await fixture();for(const qs of [[{...h.questionBanks[0],objectiveId:'objective-2'}],[{...h.questionBanks[0],hash:'f'.repeat(64)}],[...h.questionBanks,...h.questionBanks],[{...h.questionBanks[0],extra:true}]])assert.notEqual((await h.assign({questionBanks:qs})).http,200);
 assert.equal((await h.own()).assignments.length,0);
 await h.db.run('UPDATE workshop_jobs SET status=? WHERE id=?','creative-review',h.bank.id);assert.equal((await h.assign()).http,409);
});
test('withdrawal during a slow learner read suppresses the response; private answers survive withdrawal',async()=>{
 const h=await fixture(),g=(await h.assign()).assignment;await h.open();await h.loop({expectedVersion:0,action:{type:'answer',stage:'diagnostic',answer:0,confidence:'confident'}});
 const latest=h.store.latest.bind(h.store);let fired=false;h.store.latest=async(t,o,s)=>{const row=await latest(t,o,s);if(s.startsWith('loop-')&&!fired){fired=true;assert.equal((await h.call(h.teacher,'learning/course-sharing',{action:'revoke',id:g.id,revision:g.revision})).http,200)}return row};
 assert.equal((await h.loop()).http,409);assert.equal((await h.loop()).http,404);assert((await h.store.allRows('learner_profiles',await learnerOwner(h.learner))).some(r=>r.slot_key.startsWith('loop-')));
});
test('source changes remove access and deleting an original bank includes assigned snapshots in cleanup',async()=>{
 const h=await fixture();await h.assign();await h.open();const state=await readControls(h.env,h.identity.siteOwner,h.identity.owner,h.now());
 const plan=await deletionPlan(h.env,{owner:h.identity.owner,siteOwner:h.identity.siteOwner,store:h.store,now:h.now(),mode:'episode',id:h.bank.id});assert.equal(plan.courseGrants.length,0);assert.equal(plan.courseBankUpdates.length,1);await startDeletion(h.env,{owner:h.identity.owner,siteOwner:h.identity.siteOwner,store:h.store,now:h.now},plan);assert.equal((await h.own()).assignments.length,1);assert.equal((await h.own()).assignments[0].steps[0].questionBank,undefined);assert.equal((await h.call(h.learner,'learning/studio/catalog')).items.filter(i=>i.readOnly).length,2);assert.equal((await h.loop()).http,404);
 await h.db.run('UPDATE workshop_resources SET checksum=? WHERE id=?','changed',h.resourceId);assert.equal((await h.loop()).http,404);
});

test('explicit removal preserves games and a repeat delivery is idempotent',async()=>{
 const h=await fixture(),first=(await h.assign()).assignment;
 assert.equal((await h.assignCourse()).assignment.revision,first.revision);
 assert.equal((await h.assign({questionBanks:[{objectiveId:'objective-1',remove:true}]})).http,409);
 const removed=await h.assign({questionBanks:[{objectiveId:'objective-1',remove:true}],expectedRevision:first.revision});assert.equal(removed.http,200);assert.notEqual(removed.assignment.revision,first.revision);assert.equal(removed.assignment.steps[0].questionBank,undefined);assert.equal((await h.assignCourse()).assignment.revision,removed.assignment.revision);assert.equal((await h.call(h.learner,'learning/studio/catalog')).items.filter(i=>i.readOnly).length,2);
});


test('background episode retention prunes a bank while preserving the assigned course and its games',async()=>{
 const h=await fixture();await h.assign();await h.open();h.advance(6*86400000);
 await h.db.run('UPDATE workshop_jobs SET updated=? WHERE id=?',h.now(),'sharing-plan');h.advance(2*86400000);
 const state=await readControls(h.env,h.identity.siteOwner,h.identity.owner,h.now());
 await h.db.run('UPDATE data_controls SET policy=? WHERE scope=?',JSON.stringify({mediaDays:0,creativeDays:7,progressDays:0}),state.controls.learner.scope);
 const ctx={owner:h.identity.owner,siteOwner:h.identity.siteOwner,store:h.store,now:h.now};
 const a=await deletionPlan(h.env,{...ctx,now:h.now(),mode:'expired'}),b=await deletionPlan(h.env,{...ctx,now:h.now(),mode:'expired'});assert.equal(a.hash,b.hash,'Cleanup previews are deterministic');assert.equal(a.counts.assignedQuestionSets,1);
 await enforceRetention(h.env,ctx);const g=(await h.own()).assignments[0];assert(g.available);assert.equal(g.steps[0].questionBank,undefined);assert.equal((await h.call(h.learner,'learning/studio/catalog')).items.filter(i=>i.readOnly).length,2);assert.equal((await h.loop()).http,404);
});


test('reassigning a withdrawn course keeps its unchanged chapter questions',async()=>{
 const h=await fixture(),g=(await h.assign()).assignment;
 assert.equal((await h.call(h.teacher,'learning/course-sharing',{action:'revoke',id:g.id,revision:g.revision})).http,200);
 const saved=JSON.parse((await h.db.one('SELECT policy FROM data_controls WHERE scope=?','course-grant:'+g.id)).policy);
 const reassigned=await h.assignCourse(h.learner,{expectedRevision:saved.revision});assert.equal(reassigned.http,200);assert.equal(reassigned.assignment.steps[0].questionBank.id,h.bank.id);
 const {preserveQuestionBanks}=await import('../server/course-question-banks.js');
 const route={planHash:'changed-plan',steps:saved.steps.map(s=>{const copy={...s};delete copy.questionBank;return copy})};
 preserveQuestionBanks(route,saved);assert.equal(route.steps[0].questionBank.id,h.bank.id);
 route.steps[0].hash='changed-chapter';delete route.steps[0].questionBank;preserveQuestionBanks(route,saved);assert.equal(route.steps[0].questionBank,undefined);
});

test('missed snapshot CAS preserves the original, blocks delivery, and resumes idempotently',async()=>{
 const h=await fixture(),g=(await h.assign()).assignment,ctx={owner:h.identity.owner,siteOwner:h.identity.siteOwner,store:h.store,now:h.now};
 const plan=await deletionPlan(h.env,{...ctx,now:h.now(),mode:'episode',id:h.bank.id});
 const prepare=h.env.DB.prepare.bind(h.env.DB);let skipped=false,deliveryBlocked=false;
 h.env.DB.prepare=sql=>{const stmt=prepare(sql);if(sql==='UPDATE data_controls SET policy=?,updated=? WHERE scope=? AND policy=?')return {bind(...args){const bound=stmt.bind(...args);return {...bound,async run(){if(!skipped){skipped=true;const {withGrantLease}=await import('../server/course-grants.js');await assert.rejects(withGrantLease(h.env,{siteOwner:h.identity.siteOwner,learner:await learnerOwner(h.learner)},h.now,async()=>{}),e=>e.status===423);deliveryBlocked=true;return {meta:{changes:0}}}return bound.run()}}}};return stmt};
 await assert.rejects(startDeletion(h.env,ctx,plan),e=>e.status===503);assert(deliveryBlocked);assert.equal((await h.db.one('SELECT status FROM workshop_jobs WHERE id=?',h.bank.id)).status,'creative-published');
 const op=await h.db.one('SELECT * FROM data_operations WHERE status=?','cleanup-pending');assert.equal(JSON.parse(op.plan).localDone,undefined);
 // Simulate a successful write followed by a crash before localDone persisted.
 await h.db.run('UPDATE data_controls SET policy=? WHERE scope=?',plan.courseBankUpdates[0].nextPolicy,'course-grant:'+g.id);
 const done=await resumeDeletion(h.env,ctx,op);assert.equal(done.status,'complete');assert.equal((await h.own()).assignments[0].steps[0].questionBank,undefined);assert.equal((await h.db.one('SELECT status FROM workshop_jobs WHERE id=?',h.bank.id)).status,'usage-only');
});
