import test from 'node:test';
import assert from 'node:assert/strict';
import {courseDelivery,checkedDelivery,deliveryTasks,deliverCourse} from '../src/studio/course-delivery.js';
import {D1} from './helpers/media-storage.mjs';
import {pilotAPI,learnerOwner,workspaceIdentity} from '../server/pilot-access.js';
import {assignedChapters} from '../server/assignments.js';
import {sqlDB} from '../server/data-control.js';
import {digest} from '../server/content-service.js';
import {EXTENDED_PACKS} from '../src/game-modes/extended-packs.js';

function fixture(){
 const course={id:'course',plan:{id:'plan',hash:'plan-hash',links:[{objectiveId:'objective-1',id:'job-1',hash:'hash-1'},{objectiveId:'objective-2',id:'job-2',hash:'hash-2'}]}};
 const job={id:'plan',status:'approved',draftHash:'plan-hash',issues:[],draft:{steps:[{id:'objective-1',objective:'Explain steam power',topicId:'power'},{id:'objective-2',objective:'Compare factory work',topicId:'work'}]}};
 const chapters=[1,2].map(n=>({id:'job-'+n,hash:'hash-'+n,status:'published',title:'Chapter '+n}));
 const people={manages:true,accountReference:'teacher',roster:[{accountReference:'learner',label:'Test learner',role:'learner',status:'active',manager:'teacher'}]};
 return {course,job,chapters,people,notebook:{state:{courses:[course]},chapters},plans:{jobs:[job]}};
}
test('course delivery refuses partial, changed and unreviewed routes instead of sending the available subset',()=>{
 const f=fixture(),read=()=>courseDelivery(f.course,f.job,f.chapters);assert(read().ready);
 f.course.plan.links.pop();assert(!read().ready);assert.equal(read().steps[1].reason,'Activity not linked');
 assert.throws(()=>deliveryTasks(read(),f.people.roster),/every objective/);
 for(const change of [f=>f.job.status='review',f=>f.job.issues=['Source changed'],f=>f.course.plan.hash='old',f=>f.chapters[0].hash='new',f=>f.chapters[0].status='review',f=>f.chapters.splice(0,1),f=>f.job.draft.steps=[]]){const x=fixture();change(x);assert(!courseDelivery(x.course,x.job,x.chapters).ready)}
});
test('send preflight checks current published versions and active owned roster, not the visible stale selection',()=>{
 const f=fixture(),proposal={courseId:'course',planId:'plan',fingerprint:courseDelivery(f.course,f.job,f.chapters).fingerprint,selected:['learner']};assert.equal(checkedDelivery(proposal,f).length,2);
 for(const change of [f=>f.people.manages=false,f=>f.people.roster[0].manager='someone-else',f=>f.people.roster[0].status='revoked',f=>f.people.roster[0].role='teacher',f=>f.people.roster=[],f=>f.chapters[0].hash='revised',f=>f.job.issues=['Source changed'],f=>f.notebook.state.courses=[]]){const x=fixture();change(x);assert.throws(()=>checkedDelivery(proposal,x),/changed/)}
 assert.throws(()=>checkedDelivery({...proposal,selected:[]},f),/Choose/);
 const unlinked=fixture();unlinked.course.plan=null;assert.equal(courseDelivery(unlinked.course,unlinked.job,unlinked.chapters).reason,'Link an approved course route first.');assert.throws(()=>checkedDelivery(proposal,unlinked),/course or its reviewed material changed/);
});
test('tasks deduplicate shared chapters and recipients and bound work to twenty learners',()=>{
 const f=fixture();f.course.plan.links[1]={...f.course.plan.links[1],id:'job-1',hash:'hash-1'};const d=courseDelivery(f.course,f.job,f.chapters);
 assert.equal(deliveryTasks(d,[...f.people.roster,...f.people.roster]).length,1);
 assert.throws(()=>deliveryTasks(d,Array(21).fill(f.people.roster[0])),/20 learners/);
});
test('partial delivery stops on the first missing acknowledgement, preserves confirmations and retries only remaining exact tasks',async()=>{
 const f=fixture(),tasks=deliveryTasks(courseDelivery(f.course,f.job,f.chapters),[...f.people.roster,{accountReference:'second',label:'Second'}]),calls=[],updates=[];
 const first=await deliverCourse({tasks,send:async b=>{calls.push(b);if(calls.length===2)throw Error('Connection lost')},onUpdate:r=>updates.push(r)});
 assert.deepEqual(first.map(r=>r.status),['confirmed','unconfirmed','pending','pending']);assert.equal(calls.length,2);assert.equal(updates[0][0].status,'confirmed');assert.equal(updates[0][1].status,'pending');
 const retried=[];const second=await deliverCourse({tasks,previous:first,send:async b=>retried.push(b)});assert(second.every(r=>r.status==='confirmed'));assert.equal(retried.length,3);assert.deepEqual(retried[0],calls[1]);
 const changed=tasks.map(t=>({...t,key:t.key+'new',hash:'new'})),newCalls=[];await deliverCourse({tasks:changed,previous:second,send:async b=>newCalls.push(b)});assert.equal(newCalls.length,4,'Old receipts do not acknowledge a changed version');
});
test('leaving the view or changing account stops additional sends and suppresses late UI updates',async()=>{
 const f=fixture(),tasks=deliveryTasks(courseDelivery(f.course,f.job,f.chapters),f.people.roster);let active=true,calls=0,updates=0;
 const rows=await deliverCourse({tasks,isCurrent:()=>active,send:async()=>{calls++;active=false},onUpdate:()=>updates++});assert.equal(calls,1);assert.equal(updates,0);assert.deepEqual(rows.map(r=>r.status),['confirmed','pending']);
});
test('real assignment handler remains exact-version, idempotent and isolated when called by the batch sender',async()=>{
 const teacher={id:'batch-teacher',email:'batch-teacher@example.test',emailVerified:true},learner={id:'batch-learner',email:'batch-learner@example.test'},stranger={id:'batch-stranger',email:'batch-stranger@example.test'};
 const manager=await learnerOwner(teacher),recipient=await learnerOwner(learner),other=await learnerOwner(stranger),env={DB:new D1(),PILOT_ENABLED:'true',PILOT_ADMIN_OWNER:manager},db=sqlDB(env.DB),siteOwner=(await workspaceIdentity(teacher,env)).siteOwner;
 await db.run('INSERT INTO data_controls(scope,policy,updated) VALUES(?,?,?)','pilot-member:'+recipient,JSON.stringify({status:'active',role:'learner',manager,context:'school'}),1);
 const jobs=[];for(let i=1;i<=2;i++){const pack={...EXTENDED_PACKS.find(p=>p.template==='quiz-v1'),id:'generated-batch-'+i},draft=JSON.stringify(pack),hash=await digest(draft),id='batch-job-'+i;jobs.push({id,hash});await db.run('INSERT INTO workshop_jobs(id,owner,request_key,request_hash,status,payload,draft,created,updated) VALUES(?,?,?,?,?,?,?,?,?)',id,siteOwner,id,'hash','published','{}',draft,1,1)}
 const call=async body=>{const r=await pilotAPI(new Request('https://test.local/api/pilot',{method:'POST',headers:{Origin:'https://test.local','Content-Type':'application/json','X-Mosaic-Learner':teacher.id},body:JSON.stringify(body)}),env,{session:async()=>teacher,store:{latest:async()=>null}});const d=await r.json();if(!r.ok)throw Error(d.error);return d};
 const tasks=jobs.map(j=>({key:j.id,learner:recipient,jobId:j.id,hash:j.hash,status:'pending'}));let count=0;
 const partial=await deliverCourse({tasks,send:async b=>{await call(b);if(++count===2)throw Error('Acknowledgement lost')}});assert.equal(partial[1].status,'unconfirmed');assert.equal((await assignedChapters(env,recipient)).length,2,'The lost acknowledgement may already have assigned the chapter');
 const retry=await deliverCourse({tasks,previous:partial,send:call});assert(retry.every(r=>r.status==='confirmed'));assert.equal((await db.one("SELECT COUNT(*) AS n FROM data_controls WHERE scope LIKE 'assignment:%'")).n,2,'Retry reuses existing grant keys');
 assert.equal((await assignedChapters(env,other)).length,0);await assert.rejects(()=>call({action:'assign',accountReference:recipient,jobId:jobs[0].id,draftHash:'changed'}));
 await db.run('UPDATE data_controls SET policy=? WHERE scope=?',JSON.stringify({status:'active',role:'learner',manager:other,context:'school'}),'pilot-member:'+recipient);
 assert.equal((await assignedChapters(env,recipient)).length,0);await assert.rejects(()=>call({action:'assign',accountReference:recipient,jobId:jobs[0].id,draftHash:jobs[0].hash}));
});
