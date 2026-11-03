import test from 'node:test';import assert from 'node:assert/strict';
import {sharingFixture} from './helpers/course-sharing.mjs';import {exploreFixture} from './helpers/explore.mjs';
import {newUnit,activitiesOf} from '../src/studio/programme.js';import {creativeContext,validateCreative} from '../src/studio/creative-content.js';import {draftHash} from '../src/game-modes/draft-engine.js';import {digest} from '../server/content-service.js';import {learnerOwner} from '../server/pilot-access.js';import {workSlot,workScope} from '../server/teacher-review.js';import {deletionPlan,startDeletion} from '../server/data-lifecycle.js';
async function fixture(){
 const h=await sharingFixture(),pack=h.chapters[0].pack,unit=newUnit(pack,{level:'Starting out'},activitiesOf(pack).map(a=>a.key)),p={id:'teacher-explore',recordType:'creative',kind:'explore',learnerOwner:h.identity.owner,packId:pack.id,contentHash:draftHash(pack),activityKey:unit.activityKeys[0],context:creativeContext(pack,unit,'explore',unit.activityKeys[0])},lesson=validateCreative(exploreFixture(p,['timeline','worked-example']),p),hash=await digest(JSON.stringify(lesson));
 await h.db.run('INSERT INTO workshop_jobs(id,owner,request_key,request_hash,status,payload,draft,created,updated) VALUES(?,?,?,?,?,?,?,?,?)',p.id,h.identity.siteOwner,p.id,'fixture','creative-published',JSON.stringify(p),JSON.stringify(lesson),h.now(),h.now());
 const a=await h.assignCourse(h.learner,{settings:{instructions:'Explain the evidence in your own words.',dueAt:h.now()+86400000},learningResources:[{objectiveId:'objective-1',resources:[{id:p.id,hash}]}]});assert.equal(a.http,200);
 await h.call(h.learner,'learning/studio',{type:'create',expectedVersion:0,packId:pack.id,contentHash:draftHash(pack),activityKeys:unit.activityKeys});
 const answer=await h.call(h.learner,'learning/explore',{lessonId:p.id,lessonHash:hash,expectedVersion:0,action:{type:'answer',id:'task-1',response:'half',unit:'',working:'Because two equal parts form a whole.',confidence:'confident',criteria:[]}});assert.equal(answer.http,200);
 const base={id:a.assignment.id,revision:a.assignment.revision},review=(u=h.learner,body)=>h.call(u,'learning/teacher-review'+(body?'':'?'+new URLSearchParams({...base,lessonId:p.id,lessonHash:hash})),body?{...base,...body}:undefined);
 const submit=async()=>review(h.learner,{pendingVersion:(await review()).pendingVersion,action:'submit',confirmed:true,lessonId:p.id,lessonHash:hash,answerIds:['task-1'],token:null});return {...h,review,submit,base,hash,p};
}
test('teacher review sends only selected saved work; exact organiser returns human feedback',async()=>{
 const h=await fixture();assert.equal((await h.review(h.teacher)).sharing,false);assert.equal((await h.review(h.other)).http,403);assert.equal((await h.review()).pending.length,1);
 assert.equal((await h.submit()).http,200);const v=await h.review(h.teacher);assert.equal(v.submission.answers.length,1);assert.equal(v.submission.answers[0].response,'half');assert(!JSON.stringify(v).includes('PRIVATE_PROFILE'));
 const sent=await h.review(h.teacher,{action:'feedback',submissionHash:v.submissionHash,expectedVersion:0,strength:'You identified the equal parts.',nextStep:'Compare two wholes of different sizes.'});assert.equal(sent.http,200);assert.equal((await h.review()).feedback.nextStep,'Compare two wholes of different sizes.');
 assert.equal((await h.review(h.teacher,{action:'feedback',submissionHash:v.submissionHash,expectedVersion:0,strength:'Old',nextStep:'Old'})).http,409);
 assert.equal((await h.review(h.learner,{action:'withdraw'})).http,200);assert.equal((await h.review(h.teacher)).submission,null);assert.equal((await h.submit()).http,409);
});
test('source changes and assignment withdrawal invalidate submitted work; learner deletion removes consent and NCB rows',async()=>{
 const h=await fixture();await h.submit();const owner=await learnerOwner(h.learner),ctx={owner,siteOwner:'personal:'+owner,store:h.store,now:h.now};
 const plan=await deletionPlan(h.env,{...ctx,now:h.now(),mode:'learner'});assert(plan.courseConsents.some(r=>r.scope===workScope(h.base.id)));await startDeletion(h.env,ctx,plan);assert.equal(await h.store.latest('learner_profiles',owner,workSlot(h.base.id)),null);assert.notEqual((await h.review(h.teacher)).http,200);
});
test('withdrawal wins in-flight submission; unselected or unsaved answers cannot be fabricated',async()=>{
 const h=await fixture(),write=h.store.write.bind(h.store);h.store.write=async(t,o,s,...args)=>{if(s===workSlot(h.base.id)){await h.review(h.learner,{action:'withdraw'})}return write(t,o,s,...args)};
 assert.equal((await h.submit()).http,409);assert.equal((await h.review(h.teacher)).sharing,false);
 assert.equal((await h.review(h.learner,{action:'submit',confirmed:true,lessonId:h.p.id,lessonHash:h.hash,answerIds:['task-4']})).http,409);
});
test('assignment instructions are pinned and due date remains informational',async()=>{const h=await fixture();const a=(await h.own()).assignments[0];assert.match(a.settings.instructions,/own words/);h.advance(2*86400000);assert.equal((await h.own()).assignments[0].available,true);const change=await h.assignCourse(h.learner,{settings:{instructions:'New instructions'},expectedRevision:a.revision});assert.equal(change.http,200);assert.notEqual(change.assignment.revision,a.revision);assert.equal((await h.review()).http,409)});
test('teacher feedback and saved answers respect retention before cleanup runs',async()=>{
 const h=await fixture();await h.submit();const v=await h.review(h.teacher);await h.review(h.teacher,{action:'feedback',submissionHash:v.submissionHash,expectedVersion:0,strength:'Equal parts identified.',nextStep:'Compare different wholes.'});
 await h.db.run('UPDATE data_controls SET policy=? WHERE scope=?',JSON.stringify({progressDays:1}),'learner:'+h.identity.owner);
 h.advance(2*86400000);const visible=await h.review();assert(visible.submission);assert.equal(visible.feedback,null);
 await h.db.run('UPDATE data_controls SET policy=? WHERE scope=?',JSON.stringify({progressDays:1}),'learner:'+await learnerOwner(h.learner));
 const expired=await h.review();assert.equal(expired.submission,null);assert.equal(expired.pending.length,0);
 await h.review(h.learner,{action:'withdraw'});const token=(await h.review()).token;assert.notEqual((await h.review(h.learner,{action:'submit',confirmed:true,lessonId:h.p.id,lessonHash:h.hash,answerIds:['task-1'],token})).http,200);
});
test('a changed saved answer cannot be shared using an earlier preview',async()=>{
 const h=await fixture(),preview=await h.review();const owner=await learnerOwner(h.learner),slot='explore-'+(await digest(h.p.id+':'+h.hash)).slice(0,56),r=await h.store.latest('learner_profiles',owner,slot),value=JSON.parse(r.payload);value.explore.answers[0].response='An answer changed on another device';await h.store.write('learner_profiles',owner,slot,r.version,value,h.now());
 const attempt=await h.review(h.learner,{action:'submit',confirmed:true,lessonId:h.p.id,lessonHash:h.hash,answerIds:['task-1'],token:preview.token,pendingVersion:preview.pendingVersion});assert.equal(attempt.http,409);assert.equal((await h.review(h.teacher)).submission,null);
});
