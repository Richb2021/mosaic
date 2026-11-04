import test from 'node:test';
import assert from 'node:assert/strict';
import {sharingFixture} from './helpers/course-sharing.mjs';
import {learnerOwner,PILOT_NOTICE} from '../server/pilot-access.js';
import {parse} from '../server/data-control.js';

// Adds a self-directed adult (individual context, managed by someone else) and a class.
async function classFixture(){
 const h=await sharingFixture(),adult={id:'class-adult',email:'class-adult@example.test',emailVerified:true,name:'Ada Lovelace'};
 await h.db.run('INSERT INTO data_controls(scope,policy,updated) VALUES(?,?,?)','pilot-member:'+await learnerOwner(adult),JSON.stringify({role:'learner',manager:await learnerOwner(h.other),status:'active',joined:1,context:'individual',label:'Ada',managedApproval:false,authoringAllowed:true}),h.now());
 await h.store.write('learner_profiles',await learnerOwner(adult),'onboarding',0,{onboarding:{completed:true,version:PILOT_NOTICE,ageBand:'18plus'}},h.now());
 const c=(await h.call(h.teacher,'learning/classes',{action:'create',name:'Year 8 Science'})).class;
 for(const u of [h.learner,adult,h.second])assert.equal((await h.call(u,'learning/classes',{action:'join',code:c.code})).http,200);
 const assignClass=(extra={},u=h.teacher)=>h.call(u,'learning/course-sharing',{action:'assign-class',classId:c.id,courseId:h.course.id,planHash:h.planHash,...extra});
 const grants=async()=>(await h.db.all("SELECT scope,policy FROM data_controls WHERE scope LIKE 'course-grant:%'")).map(r=>parse(r.policy));
 return {...h,adult,c,assignClass,grants};
}

test('assigning a course to a class reaches the teacher’s group and self-directed adults, and skips learners another organiser manages', async () => {
 const h=await classFixture(),r=await h.assignClass();
 assert.equal(r.http,200,JSON.stringify(r));assert.equal(r.learners,3);
 const by=Object.fromEntries(r.results.map(x=>[x.label,x]));
 assert.equal(by['sharing-learner'].status,'assigned');assert.equal(by['Ada L.'].status,'assigned');
 assert.equal(by['sharing-second'].status,'skipped');assert.match(by['sharing-second'].reason,/school or family organiser/);
 const gs=await h.grants(),adultRef=await learnerOwner(h.adult),groupRef=await learnerOwner(h.learner),adultGrant=gs.find(g=>g.learner===adultRef),groupGrant=gs.find(g=>g.learner===groupRef);
 assert.equal(adultGrant.classId,h.c.id,'the class authorises the adult’s grant');assert.equal(groupGrant.classId,undefined,'the teacher’s own group keeps an ordinary grant');
 const mine=await h.call(h.adult,'learning/course-sharing');assert.equal(mine.assignments.length,1);assert.equal(mine.assignments[0].className,'Year 8 Science');
 const again=await h.assignClass();assert.deepEqual(again.results.map(x=>x.status).sort(),['skipped','unchanged','unchanged'],'resending the same version changes nothing');
 const report=await h.report(),row=report.assignments.find(a=>a.label.startsWith('Ada'));
 assert.equal(row.label,'Ada L. · Year 8 Science');assert.equal(row.learner,null,'teachers never receive a class learner’s account reference');
});

test('leaving, removal and deleting the class end class grants; the teacher’s own group keeps theirs', async () => {
 const h=await classFixture();await h.assignClass();
 assert.equal((await h.call(h.adult,'learning/classes',{action:'leave',id:h.c.id})).http,200);
 assert.equal((await h.call(h.adult,'learning/course-sharing')).assignments.length,0);
 const adultRef=await learnerOwner(h.adult);assert.equal((await h.grants()).find(g=>g.learner===adultRef).revoked,true);
 assert.equal((await h.call(h.learner,'learning/classes',{action:'leave',id:h.c.id})).http,200);
 assert.equal((await h.call(h.learner,'learning/course-sharing')).assignments.length,1,'a group learner’s course does not depend on the class');
 assert.equal((await h.call(h.adult,'learning/classes',{action:'join',code:h.c.code})).http,200);
 assert.equal((await h.call(h.adult,'learning/course-sharing')).assignments.length,0,'rejoining does not revive an old class grant');
 await h.assignClass();assert.equal((await h.call(h.adult,'learning/course-sharing')).assignments.length,1);
 const o=await h.call(h.teacher,'learning/classes?view=overview&id='+h.c.id),handle=o.learners.find(l=>l.label==='Ada L.').handle;
 assert.equal((await h.call(h.teacher,'learning/classes',{action:'remove',id:h.c.id,handle})).http,200);
 assert.equal((await h.call(h.adult,'learning/course-sharing')).assignments.length,0);
 await h.call(h.adult,'learning/classes',{action:'join',code:h.c.code});await h.assignClass();
 assert.equal((await h.call(h.teacher,'learning/classes',{action:'delete',id:h.c.id,confirmed:true})).http,200);
 assert.equal((await h.call(h.adult,'learning/course-sharing')).assignments.length,0);
 assert.ok((await h.grants()).filter(g=>g.classId).every(g=>g.revoked));
});

test('only the class teacher can assign, and not to an archived class', async () => {
 const h=await classFixture();
 assert.equal((await h.assignClass({},h.other)).http,403);
 assert.equal((await h.assignClass({},h.learner)).http,403);
 await h.call(h.teacher,'learning/classes',{action:'archive',id:h.c.id});
 assert.equal((await h.assignClass()).http,409);
});

test('the class overview shows who can receive class assignments', async () => {
 const h=await classFixture(),o=await h.call(h.teacher,'learning/classes?view=overview&id='+h.c.id);
 assert.deepEqual(Object.fromEntries(o.learners.map(l=>[l.label,l.group])),{'sharing-learner':'yours','Ada L.':'class','sharing-second':'elsewhere'});
});

test('an invitation can join a class, and several learners can be invited at once', async () => {
 const h=await classFixture(),newbie={id:'class-new',email:'New.Learner@example.test',emailVerified:true,name:'Nia Okafor'};
 const inv=await h.call(h.teacher,'pilot',{action:'invite',email:newbie.email,classId:h.c.id});assert.equal(inv.http,200,JSON.stringify(inv));assert.equal(inv.className,'Year 8 Science');
 const claim=await h.call(newbie,'pilot',{action:'claim',code:inv.code});assert.equal(claim.http,200);assert.equal(claim.joinedClass,true);
 await h.store.write('learner_profiles',await learnerOwner(newbie),'onboarding',0,{onboarding:{completed:true,version:PILOT_NOTICE,ageBand:'18plus'}},h.now());
 const mine=await h.call(newbie,'learning/classes');assert.deepEqual(mine.joined.map(j=>j.name),['Year 8 Science']);
 assert.equal((await h.call(h.teacher,'learning/classes?view=overview&id='+h.c.id)).learners.find(l=>l.label==='Nia O.').group,'yours');
 const many=await h.call(h.teacher,'pilot',{action:'invite-many',emails:['a@example.test','b@example.test','A@example.test '],classId:h.c.id});
 assert.equal(many.http,200);assert.equal(many.invites.length,2,'duplicates are merged');assert.ok(many.invites.every(i=>i.url.includes('#invite=')));
 assert.equal((await h.call(h.teacher,'pilot',{action:'invite-many',emails:['ok@example.test','not-an-email']})).http,400);
 assert.equal((await h.call(h.teacher,'pilot',{action:'invite-many',emails:Array.from({length:31},(_,i)=>i+'@example.test')})).http,400);
 const theirs=(await h.call(h.other,'learning/classes',{action:'create',name:'Their class'})).class;
 assert.equal((await h.call(h.teacher,'pilot',{action:'invite',email:'x@example.test',classId:theirs.id})).http,403,'only your own classes');
});
