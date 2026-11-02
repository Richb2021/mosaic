import test from 'node:test';
import assert from 'node:assert/strict';
import {sharingFixture} from './helpers/course-sharing.mjs';
import {learnerOwner} from '../server/pilot-access.js';
import {assignedChapters} from '../server/assignments.js';
import {reportSlot,consentScope,grantScope} from '../server/course-grants.js';
import {deletionPlan,startDeletion,enforceRetention} from '../server/data-lifecycle.js';
import {readControls,DAY} from '../server/data-control.js';

test('course grant validates complete current reviewed route, pins versions and exposes playable assigned chapters only',async()=>{
 const h=await sharingFixture();assert.equal((await h.assignCourse(h.second)).http,403);assert.equal((await h.assignCourse(h.learner,{planHash:'changed'})).http,409);
 await h.db.run('UPDATE workshop_jobs SET status=? WHERE id=?','review',h.chapters[1].id);assert.equal((await h.assignCourse()).http,409);
 await h.db.run('UPDATE workshop_jobs SET status=? WHERE id=?','published',h.chapters[1].id);const a=await h.assignCourse();assert.equal(a.http,200);assert.equal((await h.assignCourse()).assignment.revision,a.assignment.revision,'Lost acknowledgement retries preserve the same grant');
 const list=await h.own();assert.equal(list.assignments.length,1);assert.equal(list.assignments[0].sharing,false);assert(!JSON.stringify(list).includes('PRIVATE_PROFILE'));assert.equal((await assignedChapters(h.env,await learnerOwner(h.learner))).length,2);
 const catalog=await h.call(h.learner,'learning/studio/catalog');assert(catalog.items.find(i=>i.jobId===h.chapters[0].id)?.readOnly);assert.equal(catalog.items.find(i=>i.jobId===h.chapters[0].id).sourceHash,h.chapters[0].hash);
 await h.db.run('UPDATE workshop_resources SET checksum=? WHERE id=?','changed',h.resourceId);assert.equal((await h.own()).assignments[0].available,false);assert.equal((await assignedChapters(h.env,await learnerOwner(h.learner))).length,0);
});
test('sharing defaults off; only learner-selected status/help is visible to the exact current organiser',async()=>{
 const h=await sharingFixture();await h.assignCourse();assert.equal((await h.report()).assignments[0].report.state,'off');
 assert.equal((await h.call(h.learner,'learning/course-sharing?view=organiser&courseId='+h.course.id)).http,403);
 assert.equal((await h.call(h.other,'learning/course-sharing?view=organiser&courseId='+h.course.id)).assignments.length,0);
 assert.equal((await h.share()).http,200);const r=(await h.report()).assignments[0].report;assert.equal(r.state,'shared');assert.deepEqual(r.updates,[{objectiveId:'objective-1',status:'practised',help:false},{objectiveId:'objective-2',status:'started',help:true}]);assert.deepEqual(Object.keys(r).sort(),['state','updated','updates']);
 const g=(await h.own()).assignments[0];assert.equal((await h.call(h.other,'learning/course-sharing',{action:'share',id:g.id,revision:g.revision,enabled:false})).http,403);
 assert.equal((await h.call(h.learner,'learning/course-sharing',{action:'share',id:g.id,revision:g.revision,enabled:false})).http,200);assert.equal((await h.report()).assignments[0].report.state,'off');
});
test('withdrawal wins an in-flight enable and a stale tab cannot restore sharing',async()=>{
 const h=await sharingFixture();await h.assignCourse();const g=(await h.own()).assignments[0];
 h.store.beforeWrite=async()=>assert.equal((await h.call(h.learner,'learning/course-sharing',{action:'share',id:g.id,revision:g.revision,enabled:false})).http,200);
 assert.equal((await h.share()).http,409);assert.equal((await h.report()).assignments[0].report.state,'off');
 assert.equal((await h.share({consentToken:null})).http,409);assert.equal((await h.share()).http,200);
});
test('withdrawal during an organiser read suppresses the previously loaded NCB report',async()=>{
 const h=await sharingFixture();await h.assignCourse();await h.share();const g=(await h.own()).assignments[0];
 h.store.afterRead=()=>h.call(h.learner,'learning/course-sharing',{action:'share',id:g.id,revision:g.revision,enabled:false});
 assert.equal((await h.report()).assignments[0].report.state,'off');
});
test('unavailable NCB reports are not counted as inactivity; stopping sharing does not require reading the report',async()=>{
 const h=await sharingFixture();await h.assignCourse();await h.share();const g=(await h.own()).assignments[0];h.store.failReports=true;
 assert.equal((await h.report()).assignments[0].report.state,'unavailable');assert.equal((await h.own()).assignments[0].storageAvailable,false);
 assert.equal((await h.call(h.learner,'learning/course-sharing',{action:'share',id:g.id,revision:g.revision,enabled:false})).http,200);assert.equal((await h.report()).assignments[0].report.state,'off');
});
test('membership withdrawal and restoration never resurrect old course sharing',async()=>{
 const h=await sharingFixture();await h.assignCourse();await h.share();const accountReference=await learnerOwner(h.learner);
 assert.equal((await h.call(h.teacher,'pilot',{action:'revoke',accountReference})).http,200);assert.equal((await h.report()).assignments[0].report.state,'unavailable');
 assert.equal((await h.call(h.teacher,'pilot',{action:'restore-access',accountReference})).http,200);assert.equal((await h.own()).assignments.length,0);
 const prior=(await h.report()).assignments[0];const fresh=await h.assignCourse(h.learner,{expectedRevision:prior.revision});assert.equal(fresh.http,200);assert.notEqual(fresh.assignment.revision,prior.revision);assert.equal((await h.own()).assignments[0].sharing,false);
});
test('reassignment away and back invalidates the old binding even when manager identity matches again',async()=>{
 const h=await sharingFixture();await h.assignCourse();await h.share();const accountReference=await learnerOwner(h.learner);
 assert.equal((await h.call(h.teacher,'pilot',{action:'reassign',accountReference,manager:await learnerOwner(h.other)})).http,200);assert.equal((await h.report()).assignments[0].report.state,'unavailable');
 await h.call(h.teacher,'pilot',{action:'reassign',accountReference,manager:await learnerOwner(h.teacher)});assert.equal((await h.own()).assignments.length,0);
});
test('course withdrawal removes shared access but preserves private report and game data',async()=>{
 const h=await sharingFixture(),a=await h.assignCourse();await h.share();const id=a.assignment.id;
 assert.equal((await h.call(h.other,'learning/course-sharing',{action:'revoke',id,revision:a.assignment.revision})).http,403);
 assert.equal((await h.call(h.teacher,'learning/course-sharing',{action:'revoke',id,revision:a.assignment.revision})).http,200);assert.equal((await h.own()).assignments.length,0);assert.equal((await assignedChapters(h.env,await learnerOwner(h.learner))).length,0);assert(await h.store.latest('learner_profiles',await learnerOwner(h.learner),reportSlot(id)));
});
test('learner export includes reports and sharing settings; deletion removes grant/consent and all NCB report rows',async()=>{
 const h=await sharingFixture();await h.assignCourse();await h.share();const owner=await learnerOwner(h.learner),siteOwner='personal:'+owner,inv=await h.call(h.learner,'learning/data');
 const exp=await h.call(h.learner,'learning/data',{action:'export',epoch:inv.epoch});assert(exp.export.profiles.some(r=>r.slot.startsWith('course-report:')));assert.equal(exp.export.courseAssignments.length,1);assert.equal(exp.export.sharingSettings[0].enabled,true);
 const ctx={owner,siteOwner,store:h.store,now:h.now},plan=await deletionPlan(h.env,{...ctx,now:h.now(),mode:'learner'});assert.equal(plan.counts.courseAssignments,1);assert.equal(plan.counts.sharingSettings,1);await startDeletion(h.env,ctx,plan);
 assert.equal((await h.report()).assignments.length,0);assert.equal((await h.store.allRows('learner_profiles',owner)).length,0);
});
test('report retention hides expired updates and deletes NCB rows/consent without withdrawing the course',async()=>{
 const h=await sharingFixture();await h.assignCourse();await h.share();const owner=await learnerOwner(h.learner),siteOwner='personal:'+owner,state=await readControls(h.env,siteOwner,owner,h.now());
 await h.db.run('UPDATE data_controls SET policy=? WHERE scope=?',JSON.stringify({progressDays:7}),state.scopes.learner);h.advance(8*DAY);
 assert.equal((await h.report()).assignments[0].report.state,'expired');await enforceRetention(h.env,{owner,siteOwner,store:h.store,now:h.now},{force:true,strict:true});assert.equal((await h.report()).assignments[0].report.state,'off');
 assert.equal((await h.db.one("SELECT COUNT(*) AS n FROM data_controls WHERE scope LIKE 'course-grant:%'")).n,1);assert.equal((await h.db.one("SELECT COUNT(*) AS n FROM data_controls WHERE scope LIKE 'course-consent:%'")).n,0);
});
test('source cleanup includes course grants and consent; concurrent report leases block deletion safely',async()=>{
 const h=await sharingFixture(),a=await h.assignCourse();await h.share();const ctx={...h.identity,store:h.store,now:h.now};
 const plan=await deletionPlan(h.env,{...ctx,now:h.now(),mode:'resource',id:h.resourceId});assert.equal(plan.courseGrants.length,1);assert.equal(plan.courseConsents.length,1);
 let blocked=false;h.store.afterRead=async()=>{try{await startDeletion(h.env,ctx,plan)}catch(e){blocked=e.status===409}};assert.equal((await h.report()).assignments[0].report.state,'shared');assert(blocked);
 const fresh=await deletionPlan(h.env,{...ctx,now:h.now(),mode:'resource',id:h.resourceId});await startDeletion(h.env,ctx,fresh);assert.equal(await h.db.one('SELECT policy FROM data_controls WHERE scope=?',grantScope(a.assignment.id)),null);assert.equal(await h.db.one('SELECT policy FROM data_controls WHERE scope=?',consentScope(a.assignment.id)),null);
});
test('assignment cap is atomic and withdrawn rows do not hide active assignments',async()=>{
 const h=await sharingFixture(),a=await h.assignCourse(),saved=await h.db.one('SELECT policy FROM data_controls WHERE scope=?',grantScope(a.assignment.id)),g=JSON.parse(saved.policy);
 for(let i=0;i<30;i++){const id=i.toString(16).padStart(64,'0');await h.db.run('INSERT INTO data_controls(scope,policy,updated) VALUES(?,?,?)',grantScope(id),JSON.stringify({...g,courseId:'old-'+i,revoked:i>=23}),h.now())}
 assert.equal((await h.own()).assignments.length,24);
 await h.call(h.teacher,'learning/course-sharing',{action:'revoke',id:a.assignment.id,revision:a.assignment.revision});
 const changed=JSON.parse((await h.db.one('SELECT policy FROM data_controls WHERE scope=?',grantScope(a.assignment.id))).policy);
 const results=await Promise.all([h.assignCourse(h.learner,{expectedRevision:changed.revision}),h.assignCourse(h.learner,{expectedRevision:changed.revision})]);assert(results.every(r=>[200,409].includes(r.http)));assert(results.some(r=>r.http===200));
 assert.equal((await h.db.one("SELECT COUNT(*) AS n FROM data_controls WHERE scope LIKE 'course-grant:%' AND json_extract(policy,'$.revoked')=0")).n,24);
 assert.equal((await h.own()).assignments.length,24);
});
test('retention clears stranded consent when the NCB report was already removed',async()=>{
 const h=await sharingFixture(),a=await h.assignCourse();await h.share();const owner=await learnerOwner(h.learner),siteOwner='personal:'+owner,state=await readControls(h.env,siteOwner,owner,h.now());
 const row=await h.store.latest('learner_profiles',owner,reportSlot(a.assignment.id));await h.store.deleteRows('learner_profiles',owner,[row.id]);
 await h.db.run('UPDATE data_controls SET policy=? WHERE scope=?',JSON.stringify({progressDays:7}),state.scopes.learner);
 await enforceRetention(h.env,{owner,siteOwner,store:h.store,now:h.now},{force:true,strict:true});assert.equal(await h.db.one('SELECT policy FROM data_controls WHERE scope=?',consentScope(a.assignment.id)),null);assert.equal((await h.own()).assignments.length,1);
});
test('invalid report input cannot change existing sharing consent',async()=>{
 const h=await sharingFixture();await h.assignCourse();await h.share();assert.equal((await h.share({updates:[]})).http,400);assert.equal((await h.report()).assignments[0].report.state,'shared');
});

test('NCB report keys fit the real 64-character column without discarding identity bits',()=>{
 const id='ab'.repeat(32),slot=reportSlot(id);assert(slot.length<=64);assert.equal(Buffer.from(slot.slice(14),'base64url').toString('hex'),id);assert.notEqual(slot,reportSlot('ac'.repeat(32)));
});
test('replacing a reviewed route requires its previous revision and resets consent',async()=>{
 const h=await sharingFixture(),a=await h.assignCourse();await h.share();const j=await h.db.one('SELECT * FROM workshop_jobs WHERE id=?',h.course.plan.id),draft=JSON.parse(j.draft);draft.title='Living systems · revised route';const raw=JSON.stringify(draft),{digest}=await import('../server/content-service.js'),hash=await digest(raw);
 await h.db.run('UPDATE workshop_jobs SET draft=? WHERE id=?',raw,j.id);const row=await h.store.latest('learner_profiles',h.identity.owner,'courses'),payload=JSON.parse(row.payload);payload.courses.courses[0].plan.hash=hash;await h.store.write('learner_profiles',h.identity.owner,'courses',row.version,payload,h.now());
 assert.equal((await h.assignCourse(h.learner,{planHash:hash})).http,409);const changed=await h.assignCourse(h.learner,{planHash:hash,expectedRevision:a.assignment.revision});assert.equal(changed.http,200);assert.notEqual(changed.assignment.revision,a.assignment.revision);assert.equal((await h.report()).assignments[0].report.state,'off');assert.equal((await h.own()).assignments[0].report,null);
 assert.equal((await h.share({revision:a.assignment.revision})).http,409);assert.equal((await h.share()).http,200);
});
