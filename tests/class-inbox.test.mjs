import test from 'node:test';
import assert from 'node:assert/strict';
import {sharingFixture} from './helpers/course-sharing.mjs';
import {exploreFixture} from './helpers/explore.mjs';
import {newUnit,activitiesOf} from '../src/studio/programme.js';
import {creativeContext,validateCreative} from '../src/studio/creative-content.js';
import {draftHash} from '../src/game-modes/draft-engine.js';
import {digest} from '../server/content-service.js';
import {learnerOwner,PILOT_NOTICE} from '../server/pilot-access.js';

// A class with: the teacher's own learner (with an Explore lesson in the course),
// a self-directed adult who joined by code, and a learner another organiser manages.
async function fixture(){
 const h=await sharingFixture(),pack=h.chapters[0].pack,unit=newUnit(pack,{level:'Starting out'},activitiesOf(pack).map(a=>a.key));
 const p={id:'inbox-explore',recordType:'creative',kind:'explore',learnerOwner:h.identity.owner,packId:pack.id,contentHash:draftHash(pack),activityKey:unit.activityKeys[0],context:creativeContext(pack,unit,'explore',unit.activityKeys[0])};
 const lesson=validateCreative(exploreFixture(p,['timeline','worked-example']),p),hash=await digest(JSON.stringify(lesson));
 await h.db.run('INSERT INTO workshop_jobs(id,owner,request_key,request_hash,status,payload,draft,created,updated) VALUES(?,?,?,?,?,?,?,?,?)',p.id,h.identity.siteOwner,p.id,'fixture','creative-published',JSON.stringify(p),JSON.stringify(lesson),h.now(),h.now());
 const adult={id:'inbox-adult',email:'inbox-adult@example.test',emailVerified:true,name:'Ada Lovelace'};
 await h.db.run('INSERT INTO data_controls(scope,policy,updated) VALUES(?,?,?)','pilot-member:'+await learnerOwner(adult),JSON.stringify({role:'learner',manager:await learnerOwner(h.other),status:'active',joined:1,context:'individual',label:'Ada',managedApproval:false}),h.now());
 await h.store.write('learner_profiles',await learnerOwner(adult),'onboarding',0,{onboarding:{completed:true,version:PILOT_NOTICE,ageBand:'18plus'}},h.now());
 const c=(await h.call(h.teacher,'learning/classes',{action:'create',name:'Year 8 Science'})).class;
 for(const u of [h.learner,adult,h.second])assert.equal((await h.call(u,'learning/classes',{action:'join',code:c.code})).http,200);
 const resources=[{objectiveId:'objective-1',resources:[{id:p.id,hash}]}];
 const sent=await h.call(h.teacher,'learning/course-sharing',{action:'assign-class',classId:c.id,courseId:h.course.id,planHash:h.planHash,learningResources:resources});assert.equal(sent.http,200,JSON.stringify(sent));
 await h.call(h.learner,'learning/studio',{type:'create',expectedVersion:0,packId:pack.id,contentHash:draftHash(pack),activityKeys:unit.activityKeys});
 assert.equal((await h.call(h.learner,'learning/explore',{lessonId:p.id,lessonHash:hash,expectedVersion:0,action:{type:'answer',id:'task-1',response:'half',unit:'',working:'Two equal parts make a whole.',confidence:'confident',criteria:[]}})).http,200);
 const mine=async u=>(await h.call(u,'learning/course-sharing')).assignments[0];
 const review=async(u,body)=>{const g=await mine(h.learner),base={id:g.id,revision:g.revision};return h.call(u,'learning/teacher-review'+(body?'':'?'+new URLSearchParams({...base,lessonId:p.id,lessonHash:hash})),body?{...base,...body}:undefined)};
 const submit=async()=>review(h.learner,{pendingVersion:(await review(h.learner)).pendingVersion,action:'submit',confirmed:true,lessonId:p.id,lessonHash:hash,answerIds:['task-1'],token:null});
 const shareAs=async(u,help=[false,true])=>{const g=await mine(u);return h.call(u,'learning/course-sharing',{action:'share',id:g.id,revision:g.revision,enabled:true,expectedVersion:g.version,consentToken:g.consentToken,updates:g.steps.map((s,i)=>({objectiveId:s.id,status:i?'started':'practised',help:help[i]}))})};
 const overview=()=>h.call(h.teacher,'learning/classes?view=overview&id='+c.id);
 const exportPage=(cursor='',u=h.teacher)=>h.call(u,'learning/classes?view=export&id='+c.id+(cursor?'&cursor='+cursor:''));
 return {...h,adult,c,mine,review,submit,shareAs,overview,exportPage};
}

test('the class inbox lists submitted work and help requests, and clears them when the teacher replies', async () => {
 const h=await fixture();
 assert.deepEqual((await h.overview()).inbox,[],'nothing is shared yet');
 assert.equal((await h.submit()).http,200);
 assert.equal((await h.shareAs(h.adult)).http,200);
 let o=await h.overview();
 assert.equal(o.counts.workToReview,1);assert.equal(o.counts.helpWaiting,1);
 // Regression: the overview used to read every shared update as unavailable.
 const adaRow=o.learners.find(l=>l.label==='Ada L.');assert.equal(adaRow.latest,'practised');assert.equal(adaRow.help,true);assert.ok(adaRow.lastShared);assert.equal(o.counts.sharing,1);
 const work=o.inbox.find(i=>i.kind==='work'),help=o.inbox.find(i=>i.kind==='help');
 assert.equal(work.label,'sharing-learner');assert.equal(work.done,false);assert.equal(work.assignment.title,h.course.title);
 assert.equal(help.label,'Ada L.');assert.deepEqual(help.objectives,['Explain habitat and population.']);assert.equal(help.assignment.className,'Year 8 Science');
 // Teacher replies to the work through the existing review route.
 const v=await h.review(h.teacher);assert.equal((await h.review(h.teacher,{action:'feedback',submissionHash:v.submissionHash,expectedVersion:0,strength:'You named the equal parts.',nextStep:'Try it with thirds.'})).http,200);
 // And marks the help request as seen with a short note.
 const seen=await h.call(h.teacher,'learning/course-sharing',{action:'help-seen',id:help.assignment.id,revision:help.assignment.revision,note:'check-in'});
 assert.equal(seen.http,200,JSON.stringify(seen));assert.match(seen.seen.note,/next lesson/);
 o=await h.overview();
 assert.equal(o.counts.workToReview,0);assert.equal(o.counts.helpWaiting,0);
 assert.ok(o.inbox.every(i=>i.done));assert.ok(o.inbox.find(i=>i.kind==='help').note);
 const ada=await h.mine(h.adult);assert.ok(ada.helpSeen,'the learner sees the receipt');assert.match(ada.helpSeen.note,/next lesson/);
 assert.ok(!JSON.stringify(o).includes(await learnerOwner(h.adult)),'no account references in the overview');
});

test('a new update or stopping sharing clears a help receipt', async () => {
 const h=await fixture();await h.shareAs(h.adult);
 const help=(await h.overview()).inbox.find(i=>i.kind==='help');
 await h.call(h.teacher,'learning/course-sharing',{action:'help-seen',id:help.assignment.id,revision:help.assignment.revision});
 assert.ok((await h.mine(h.adult)).helpSeen);assert.equal((await h.mine(h.adult)).helpSeen.note,null);
 assert.equal((await h.shareAs(h.adult,[true,true])).http,200,'the learner sends a new request');
 assert.equal((await h.mine(h.adult)).helpSeen,null);
 const fresh=(await h.overview()).inbox.find(i=>i.kind==='help');assert.equal(fresh.done,false);assert.equal(fresh.objectives.length,2);
 const g=await h.mine(h.adult);
 assert.equal((await h.call(h.adult,'learning/course-sharing',{action:'share',id:g.id,revision:g.revision,enabled:false,consentToken:g.consentToken,expectedVersion:g.version})).http,200);
 assert.equal((await h.overview()).inbox.length,0,'stopped sharing hides the request');
 assert.equal((await h.call(h.teacher,'learning/course-sharing',{action:'help-seen',id:g.id,revision:g.revision})).http,409);
});

test('only the course organiser can mark help as seen, with one of the short notes', async () => {
 const h=await fixture();await h.shareAs(h.adult);
 const help=(await h.overview()).inbox.find(i=>i.kind==='help'),body={action:'help-seen',id:help.assignment.id,revision:help.assignment.revision};
 assert.equal((await h.call(h.other,'learning/course-sharing',body)).http,403);
 assert.equal((await h.call(h.adult,'learning/course-sharing',body)).http,403);
 assert.equal((await h.call(h.teacher,'learning/course-sharing',{...body,note:'You are wrong'})).http,400);
 assert.equal((await h.call(h.teacher,'learning/course-sharing',{...body,revision:'stale'})).http,409);
});

test('the class export holds only shared data, never account references or leaderboard nicknames', async () => {
 const h=await fixture();
 await h.call(h.teacher,'learning/classes',{action:'leaderboard',id:h.c.id,enabled:true});
 await h.call(h.adult,'learning/classes',{action:'board',id:h.c.id,optIn:true,nickname:'River Fox'});
 await h.shareAs(h.adult);await h.submit();
 await h.call(h.adult,'learning/classes',{action:'share',id:h.c.id,key:'explain-1',title:'Food webs',text:'Energy moves from plants to rabbits.',confirmed:true});
 const e=await h.exportPage();assert.equal(e.http,200,JSON.stringify(e));assert.equal(e.learners,3);assert.equal(e.nextCursor,null);
 const ada=e.rows.filter(r=>r.learner==='Ada L.');
 assert.deepEqual(ada.map(r=>[r.objective,r.status,r.help]),[['Identify producers and consumers.','practised',false],['Explain habitat and population.','started',true]]);
 assert.equal(ada[0].group,'class');assert.equal(ada[0].explanations,1);
 const own=e.rows.filter(r=>r.learner==='sharing-learner');
 assert.equal(own.length,2,'one row per objective, so scores show even when updates are not shared');assert.ok(own.every(r=>r.sharing==='off'&&r.status===null),'not shared is blank, never "not started"');assert.ok(own[0].workSubmittedAt);assert.ok(own.every(r=>r.played===false&&r.answered===null),'no game played yet');
 const other=e.rows.find(r=>r.learner==='sharing-second');assert.equal(other.course,null);assert.equal(other.group,'elsewhere');
 const text=JSON.stringify(e);
 for(const u of [h.adult,h.learner,h.second])assert.ok(!text.includes(await learnerOwner(u)),'no account references');
 assert.ok(!text.includes('River Fox'),'leaderboard nicknames are not linked to names');
 assert.equal((await h.exportPage('',h.other)).http,403);assert.equal((await h.exportPage('',h.adult)).http,403);
});

test('the class export pages through large classes', async () => {
 const h=await fixture();
 for(let i=0;i<20;i++){const u={id:'bulk-'+i,email:'bulk-'+i+'@example.test',emailVerified:true,name:'Bulk '+String.fromCharCode(65+i)};
  await h.db.run('INSERT INTO data_controls(scope,policy,updated) VALUES(?,?,?)','pilot-member:'+await learnerOwner(u),JSON.stringify({role:'learner',manager:await learnerOwner(h.teacher),status:'active',joined:1,context:'school',label:u.name,managedApproval:true}),h.now());
  await h.store.write('learner_profiles',await learnerOwner(u),'onboarding',0,{onboarding:{completed:true,version:PILOT_NOTICE,ageBand:'13to17'}},h.now());
  assert.equal((await h.call(u,'learning/classes',{action:'join',code:h.c.code})).http,200);}
 const first=await h.exportPage();assert.ok(first.nextCursor);
 const second=await h.exportPage(first.nextCursor);assert.equal(second.nextCursor,null);
 const names=new Set([...first.rows,...second.rows].map(r=>r.learner));assert.equal(names.size,23);
 assert.equal((await h.exportPage('not-a-cursor')).http,400);
});

test('the class spreadsheet neutralises formulas and never shows missing data as "not started"', async () => {
 const {classCSV,cell,rowValues,exportName,COLUMNS}=await import('../src/studio/class-export.js');
 assert.equal(cell('=HYPERLINK("x")'),'"\'=HYPERLINK(""x"")"');assert.equal(cell('-2'),'"\'-2"');assert.equal(cell('@me'),'"\'@me"');assert.equal(cell('Ada'),'"Ada"');
 const off=rowValues({learner:'Ada L.',group:'class',joined:Date.UTC(2026,10,4),course:'Food webs',sharing:'off',status:null,help:null,explanations:0,explanationsAnswered:0});
 assert.equal(off[6],'Not shared');assert.equal(off[7],'');assert.equal(off[3],'2026-11-04');assert.equal(off[2],'Joined by code');
 assert.equal(rowValues({learner:'B',group:'yours',course:null})[6],'No course from you');
 assert.equal(rowValues({learner:'B',group:'yours',course:'C',sharing:'shared',status:'practised',help:true})[6],'Practised');
 const csv=classCSV([{learner:'=cmd',group:'yours',course:null}]);
 assert.ok(csv.startsWith('﻿"Learner"'));assert.equal(csv.trim().split('\r\n').length,2);assert.ok(csv.includes('"\'=cmd"'));assert.equal(COLUMNS.length,rowValues({}).length);
 assert.equal(exportName('Year 8 / Science!',Date.UTC(2026,10,4)),'year-8-science-shared-updates-2026-11-04.csv');
});

test('a course that is temporarily unavailable stays in the export as unavailable, never as "no course"', async () => {
 const h=await fixture();
 await h.db.run('UPDATE workshop_jobs SET status=? WHERE id=?','draft',h.chapters[1].id);
 const e=await h.exportPage(),ada=e.rows.filter(r=>r.learner==='Ada L.');
 assert.ok(ada.length>=1&&ada.every(r=>r.course===h.course.title&&r.sharing==='unavailable'));assert.ok(/^[a-f0-9]{6}$/.test(ada[0].key));
 const {rowValues}=await import('../src/studio/class-export.js');assert.equal(rowValues(ada[0])[6],'Not available right now');
});

test('deleting your learning data keeps the age range, so an under-18 cannot reset it, and Studio stays open', async () => {
 const {deletionPlan,startDeletion}=await import('../server/data-lifecycle.js');
 const h=await fixture(),owner=await learnerOwner(h.learner);
 const before=await h.store.latest('learner_profiles',owner,'onboarding');assert.ok(before);
 const ctx={owner,siteOwner:'personal:'+owner,store:h.store,now:h.now};
 const plan=await deletionPlan(h.env,{...ctx,mode:'learner',now:h.now()});await startDeletion(h.env,ctx,plan);
 const after=await h.store.latest('learner_profiles',owner,'onboarding');assert.ok(after,'setup record kept');assert.equal(JSON.parse(after.payload).onboarding.ageBand,'13to17');
 assert.equal((await h.call(h.learner,'learning/classes')).http,200,'Studio still opens');
 const closing=await deletionPlan(h.env,{...ctx,mode:'learner',closing:true,now:h.now()});
 assert.ok(closing.profiles.includes(after.id),'closing the account removes it');
});

test('teachers see scores on assigned games even when the learner shares nothing', async () => {
 const h=await fixture(),owner=await learnerOwner(h.learner),pack=h.chapters[0].pack,{draftHash}=await import('../src/game-modes/draft-engine.js');
 await h.store.write('learner_saves',owner,'record-1',0,{key:'record-1',summary:{packId:pack.id,title:pack.title,template:pack.template,contentHash:draftHash(pack),kind:'journey',completed:true,engagement:3,observations:[{key:'q1',correct:true,attempts:1,assisted:false,sources:[]},{key:'q2',correct:true,attempts:2,assisted:false,sources:[]},{key:'q3',correct:true,attempts:1,assisted:true,sources:[]}]}},h.now());
 const report=(await h.call(h.teacher,'learning/course-sharing?view=organiser&courseId='+h.course.id)).assignments.find(a=>a.label==='sharing-learner');
 assert.equal(report.report.state,'off','nothing shared');
 assert.deepEqual(report.scores.steps.map(s=>[s.played,s.completed,s.firstTry,s.answered,s.help]),[[true,true,1,3,1],[false,undefined,undefined,undefined,undefined]]);
 const o=await h.overview(),row=o.learners.find(l=>l.label==='sharing-learner');assert.deepEqual([row.scores.played,row.scores.total,row.scores.firstTry,row.scores.answered],[1,2,1,3]);
 const e=await h.exportPage(),r=e.rows.find(r=>r.learner==='sharing-learner'&&r.objective==='Identify producers and consumers.');assert.deepEqual([r.played,r.completed,r.firstTry,r.answered,r.helpUsed],[true,true,1,3,1]);
});
