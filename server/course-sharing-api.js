import {assignmentSettings} from './assignment-settings.js';
import {attachLearningResources,availableLearningResources,preserveLearningResources} from './course-learning-resources.js';
import {attachQuestionBanks,availableQuestionBanks,preserveQuestionBanks} from './course-question-banks.js';
import {readJSON,noStore} from './ncb-auth.js';
import {sqlDB,parse,need,DAY,auditEvent} from './data-control.js';
import {digest} from './content-service.js';
import {admission} from './pilot-access.js';
import {assignedScores} from './assigned-scores.js';
import {planCurrent} from './course-plan-api.js';
import {validateCoursePlan} from '../src/studio/course-plan.js';
import {validateCourses} from '../src/studio/course-model.js';
import {validatePlayableContent} from '../src/game-modes/content-registry.js';
import {grantScope,consentScope,reportSlot,courseGrantId,memberBinding,withGrantLease,activeCourseGrant,grantChapters,learnerCourseGrants,publicCourseGrant,classGrantKey,classAssignable} from './course-grants.js';

const idOk=id=>typeof id==='string'&&/^[a-f0-9]{64}$/.test(id);
// "Help seen" receipts live with the teacher's feedback, in the organiser's own store.
// Each one names the exact update the learner sent (a digest of its sharing receipt), so a new update or stopping sharing clears it.
export const helpSeenSlot=id=>'helpseen-'+id.slice(0,55);
const HELP_NOTES={'check-in':'I’ll check in with you next lesson.',feedback:'I’ve left you feedback on your work.','try-again':'Have another go, then send me an update.'};
export async function readHelpSeen(env,store,g,receipt,now){
 if(!receipt)return null;
 try{
  const r=await store.latest('learner_profiles',g.owner,helpSeenSlot(g.id)),s=parse(r?.payload).helpSeen;
  if(!s||s.grantId!==g.id||s.revision!==g.revision||s.receipt!==await digest('help-seen:'+receipt))return null;
  const days=parse((await sqlDB(env.DB).one('SELECT policy FROM data_controls WHERE scope=?','learner:'+g.owner))?.policy).progressDays||0;
  if(days&&Number(r.updated_ms)+days*DAY<=now)return null;
  return {at:s.seenAt,note:HELP_NOTES[s.note]||null};
 }catch{return null}
}
const statuses=new Set(['not-started','started','practised']);
function cleanUpdates(updates,g){
 need(Array.isArray(updates)&&updates.length===g.steps.length,'Choose a status for each course objective.');
 need(new Set(updates.map(u=>u.objectiveId)).size===updates.length,'Keep each objective once.');
 return g.steps.map(s=>{const u=updates.find(u=>u.objectiveId===s.id);need(u&&statuses.has(u.status)&&typeof u.help==='boolean'&&Object.keys(u).every(k=>['objectiveId','status','help'].includes(k)),'Use only an objective status and help request.');return {objectiveId:s.id,status:u.status,help:u.help}});
}
async function reviewedRoute(env,{owner,siteOwner,store,courseId,planHash}){
 const db=sqlDB(env.DB),row=await store.latest('learner_profiles',owner,'courses'),course=row&&validateCourses(parse(row.payload).courses).courses.find(c=>c.id===courseId);
 need(course?.plan,'Choose a linked reviewed course route.',404);
 const job=await db.one('SELECT * FROM workshop_jobs WHERE id=? AND owner=?',course.plan.id,siteOwner),p=parse(job?.payload);
 need(job?.status==='plan-approved'&&p.recordType==='course-plan'&&p.learnerOwner===owner&&p.courseId===courseId,'The reviewed course route is unavailable.',409);
 const hash=await digest(job.draft);need(hash===planHash&&hash===course.plan.hash&&!(await planCurrent(db,siteOwner,job,course)).length,'Course or source versions changed. Review the current course first.',409);
 const plan=validateCoursePlan(parse(job.draft),p);need(plan.steps.length,'This course has no reviewed objectives.');const steps=[];
 for(const s of plan.steps){
  const link=course.plan.links.find(l=>l.objectiveId===s.id),j=link&&await db.one('SELECT * FROM workshop_jobs WHERE id=? AND owner=? AND status=?',link.id,siteOwner,'published');
  need(j?.draft&&await digest(j.draft)===link.hash,'Publish and link every objective before assigning the course.',409);
  const cp=parse(j.payload),pack=validatePlayableContent(parse(j.draft));need(!cp.recordType&&cp.goal===s.objective&&s.sourceRefs.every(id=>cp.evidence?.some(e=>e.id===id)),'An activity no longer matches its reviewed objective.',409);
  steps.push({id:s.id,objective:s.objective,topicTitle:course.topics.find(t=>t.id===s.topicId).title,jobId:j.id,hash:link.hash,title:pack.title});
 }
 return {courseId,title:course.title,planId:job.id,planHash:hash,sources:p.resourceVersions||[],steps};
}
export async function readSharedReport(env,store,g,now){
 const db=sqlDB(env.DB);
 try{return await withGrantLease(env,g,now,async state=>{
  if(!await activeCourseGrant(env,g)||!(await grantChapters(env,g)).length)return {state:'unavailable'};
  const before=await db.one('SELECT policy FROM data_controls WHERE scope=?',consentScope(g.id)),consent=parse(before?.policy);
  if(consent.revision!==g.revision||!consent.enabled)return {state:'off'};
  const row=await store.latest('learner_profiles',g.learner,reportSlot(g.id));
  if(!row)return {state:'unavailable'};const payload=parse(row.payload).report,days=parse(state.controls.learner.policy).progressDays||0;
  if(days&&Number(row.updated_ms)+days*DAY<=now())return {state:'expired'};
  need(payload?.grantId===g.id&&payload.revision===g.revision&&payload.receipt===consent.token&&payload.enabled===true&&row.version===consent.reportVersion,'Shared update unavailable.',503);
  const updates=cleanUpdates(payload.updates,g),after=await db.one('SELECT policy FROM data_controls WHERE scope=?',consentScope(g.id)),grant=await db.one('SELECT policy FROM data_controls WHERE scope=?',grantScope(g.id));
  // A withdrawal or version replacement while NCB was responding wins.
  if(after?.policy!==before.policy||parse(grant?.policy).revision!==g.revision||!await activeCourseGrant(env,parse(grant?.policy)))return {state:'off'};
  return {state:'shared',updated:Number(row.updated_ms),updates,receipt:consent.token};
 })}catch{return {state:'unavailable'}}
}
export async function courseSharingAPI(req,env,{owner,principal,siteOwner,store,access,now=()=>Date.now()}){
 const db=sqlDB(env.DB),input=req.method==='GET'?Object.fromEntries(new URL(req.url).searchParams):await readJSON(req,16000),manages=access.admitted&&['administrator','teacher','guardian'].includes(access.role);
 const load=async id=>{need(idOk(id),'Choose a course assignment.');const row=await db.one('SELECT * FROM data_controls WHERE scope=?',grantScope(id));need(row,'Course assignment unavailable.',404);return {row,g:{...parse(row.policy),id}}};
 if(req.method==='GET'&&input.view==='questions'){
  need(manages,'Only the current organiser can select reviewed question sets.',403);
  const route=await reviewedRoute(env,{owner,siteOwner,store,courseId:input.courseId,planHash:input.planHash});
  return noStore({steps:await availableQuestionBanks(env,{owner,siteOwner},route),learningResources:await availableLearningResources(env,{owner,siteOwner},route)});
 }
 if(req.method==='GET'&&input.view==='delivery'){
  need(manages,'Only the current organiser can prepare course delivery.',403);const learners=(input.learners||'').split(',');need(learners.length>0&&learners.length<=20&&learners.every(idOk),'Choose up to twenty learners.');
  const rows=await db.all("SELECT policy FROM data_controls WHERE scope LIKE 'course-grant:%' AND json_extract(policy,'$.manager')=? AND json_extract(policy,'$.siteOwner')=? AND json_extract(policy,'$.courseId')=? AND json_extract(policy,'$.learner') IN ("+learners.map(()=>'?').join(',')+')',principal,siteOwner,input.courseId||'',...learners);
  return noStore({assignments:rows.map(r=>{const g=parse(r.policy);return {learner:g.learner,revision:g.revision}})});
 }
 if(req.method==='GET'&&input.view==='organiser'){
  need(manages,'Only the current organiser can open shared updates.',403);need(!input.cursor||idOk(input.cursor),'Invalid report page.');
  const rows=await db.all("SELECT scope,policy FROM data_controls WHERE scope LIKE 'course-grant:%' AND json_extract(policy,'$.manager')=? AND json_extract(policy,'$.siteOwner')=? AND (?='' OR json_extract(policy,'$.courseId')=?) AND scope>? ORDER BY scope LIMIT 21",principal,siteOwner,input.courseId||'',input.courseId||'',input.cursor?grantScope(input.cursor):'');const assignments=[];
  for(const r of rows.slice(0,20)){const g={...parse(r.policy),id:r.scope.slice(13)},member=(await memberBinding(env,g.learner)).member,viaClass=!!g.classId&&member.manager!==principal,cm=viaClass?parse((await db.one('SELECT policy FROM data_controls WHERE scope=?','class-member:'+g.classId+':'+g.learner))?.policy):null;
   const available=await activeCourseGrant(env,g)&&!!(await grantChapters(env,g)).length;
   const {receipt,...report}=available?await readSharedReport(env,store,g,now):{state:'unavailable'};
   const helpSeen=report.state==='shared'&&report.updates.some(u=>u.help)?await readHelpSeen(env,store,g,receipt,now()):null;
   assignments.push({...publicCourseGrant(g),learner:viaClass?null:g.learner,label:!viaClass?(member.manager===principal?member.label||'Learner':'Learner no longer in your group'):cm?.status==='active'?(cm.label||'Learner')+' · '+(g.className||'class'):'Learner no longer in this class',revoked:!!g.revoked,available,report,helpSeen,scores:available&&!g.revoked?await assignedScores(env,store,g):{state:'unavailable',steps:[]}});
  }
  return noStore({assignments,nextCursor:rows.length>20?rows[19].scope.slice(13):null});
 }
 if(req.method==='GET'){
  const assignments=[];
  for(const g of await learnerCourseGrants(env,principal))if(await activeCourseGrant(env,g)){
   const available=!!(await grantChapters(env,g)).length;
   const control=await db.one('SELECT policy FROM data_controls WHERE scope=?',consentScope(g.id)),consent=parse(control?.policy);
   let report=null,version=0,storageAvailable=true;
   try{const row=await store.latest('learner_profiles',owner,reportSlot(g.id));version=row?.version||0;const saved=parse(row?.payload).report;if(saved?.revision===g.revision&&saved.grantId===g.id)report={updates:cleanUpdates(saved.updates,g)};}catch{storageAvailable=false}
   const sharing=consent.revision===g.revision&&consent.enabled===true,helpSeen=sharing&&report?.updates.some(u=>u.help)?await readHelpSeen(env,store,g,consent.token,now()):null;
   assignments.push({...publicCourseGrant(g),available,version,consentToken:consent.token||null,sharing,report,storageAvailable,helpSeen});
  }
  return noStore({assignments});
 }
 need(req.method==='POST','Course sharing route not found.',404);
 // One learner's grant. A class assignment passes `cls` ({c,m}); the class then
 // authorises the grant unless the learner is already in this organiser's group.
 const assignOne=async(base,learnerId,cls)=>{
  const learner=await admission(env,learnerId),inGroup=learner.admitted&&learner.role==='learner'&&learner.manager===principal;
  if(cls){need(learner.admitted,'Their access is paused or withdrawn.',409);need(learner.role==='learner','This is not a learner account.',409);need(classAssignable(learner,principal),'Their school or family organiser manages their access. Ask the administrator to move them to your group.',403);}
  else need(inGroup,'Choose an active learner in your group.',403);
  const route=structuredClone(base),id=await courseGrantId(principal,learnerId,route.courseId),scope=grantScope(id),saved=await db.one('SELECT policy FROM data_controls WHERE scope=?',scope),old=parse(saved?.policy);
  preserveQuestionBanks(route,old);preserveLearningResources(route,old);
  route.settings=assignmentSettings(input.settings??old.settings);
  await attachQuestionBanks(env,{owner,siteOwner},route,input.questionBanks);await attachLearningResources(env,{owner,siteOwner},route,input.learningResources);
  const via=cls&&!inGroup?{classId:cls.c.id,className:cls.c.name,classBinding:await classGrantKey(cls.c,cls.m)}:{};
  const bindings={learnerBinding:(await memberBinding(env,learnerId)).key,managerBinding:(await memberBinding(env,principal)).key},signature=await digest(JSON.stringify({...route,...bindings,...via}));
  if(saved&&!old.revoked&&old.signature===signature)return {status:'unchanged',assignment:publicCourseGrant({...old,id})};
  // A class send replaces versions it sent before, never one the teacher assigned to this learner individually.
  if(cls&&inGroup&&saved&&!old.revoked&&old.sentToClass!==cls.c.id&&await activeCourseGrant(env,{...old,id}))return {status:'kept'};
  if(!cls)need((input.expectedRevision||null)===(old.revision||null),'This assignment changed. Reload before replacing its reviewed version.',409);

  const g={...route,...bindings,...via,...(cls?{sentToClass:cls.c.id}:{}),owner,manager:principal,learner:learnerId,siteOwner,signature,revision:crypto.randomUUID(),assignedAt:now(),revoked:false};
  return withGrantLease(env,g,now,async()=>{
   need(await activeCourseGrant(env,g),'The learner group changed. Reload before assigning.',409);
   need((await grantChapters(env,g)).length,'The reviewed sources or chapters changed. Reload before assigning.',409);
   await attachQuestionBanks(env,{owner,siteOwner},route,input.questionBanks);await attachLearningResources(env,{owner,siteOwner},route,input.learningResources);
   // The cap is checked in the same SQL statement as the mutation, including
   // reactivating a withdrawn assignment. Independent requests cannot overfill it.
   const cap="(SELECT COUNT(*) FROM data_controls WHERE scope LIKE 'course-grant:%' AND json_extract(policy,'$.learner')=? AND json_extract(policy,'$.revoked')=0 AND scope!=?)<24";
   const value=JSON.stringify(g),r=saved?await db.run('UPDATE data_controls SET policy=?,updated=? WHERE scope=? AND policy=? AND '+cap,value,now(),scope,saved.policy,learnerId,scope):await db.run('INSERT OR IGNORE INTO data_controls(scope,policy,updated) SELECT ?,?,? WHERE '+cap,scope,value,now(),learnerId,scope);if(r.meta.changes!==1){const now2=parse((await db.one('SELECT policy FROM data_controls WHERE scope=?',scope))?.policy);if(!now2.revoked&&now2.signature===signature)return {status:'unchanged',assignment:publicCourseGrant({...now2,id})}}
   need(r.meta.changes===1,'The assignment changed or this learner has 24 courses. Reload and withdraw an old course if needed.',409);
   await db.run('DELETE FROM data_controls WHERE scope=?',consentScope(id));await auditEvent(env,'learner:'+owner,'course-assigned',{objectives:g.steps.length},now());
   return {status:'assigned',assignment:publicCourseGrant({...g,id})};
  });
 };
 if(input.action==='assign'){
  need(manages&&access.ageBand==='18plus','An adult organiser prepares course assignments.',403);need(idOk(input.learner),'Choose a learner in your group.');
  const learner=await admission(env,input.learner);need(learner.admitted&&learner.role==='learner'&&learner.manager===principal,'Choose an active learner in your group.',403);
  const r=await assignOne(await reviewedRoute(env,{owner,siteOwner,store,courseId:input.courseId,planHash:input.planHash}),input.learner,null);
  return noStore({assigned:true,assignment:r.assignment});
 }
 if(input.action==='assign-class'){
  need(manages&&access.ageBand==='18plus','An adult organiser prepares course assignments.',403);
  need(typeof input.classId==='string'&&/^[a-f0-9]{16}$/.test(input.classId),'Choose a class.');
  const c=parse((await db.one('SELECT policy FROM data_controls WHERE scope=?','class:'+input.classId))?.policy);
  need(c.owner===principal&&c.siteOwner===siteOwner,'Only this class’s teacher can assign work to it.',403);need(!c.archived,'This class is archived. Restore it before assigning new work.',409);
  // Pages of ten, ordered by the per-class handle so a learner leaving mid-send can't make the next page skip someone.
  const handle=async l=>(await digest('class-handle:'+c.id+':'+l)).slice(0,32);
  need(!input.cursor||/^[a-f0-9]{32}$/.test(input.cursor),'Invalid class page.');
  const all=[];for(const m of (await db.all("SELECT policy FROM data_controls WHERE scope LIKE ?",'class-member:'+c.id+':%')).map(r=>parse(r.policy)).filter(m=>m.status==='active'))all.push({...m,handle:await handle(m.learner)});
  all.sort((a,b)=>a.handle.localeCompare(b.handle));
  const rest=input.cursor?all.filter(m=>m.handle>input.cursor):all,page=rest.slice(0,10);
  const base=await reviewedRoute(env,{owner,siteOwner,store,courseId:input.courseId,planHash:input.planHash}),results=[];
  for(const m of page){
   const a=await admission(env,m.learner),own=a.admitted&&a.role==='learner'&&a.manager===principal;
   try{const r=await assignOne(base,m.learner,{c,m});results.push({label:m.label||'Learner',status:r.status,...(r.status==='kept'?{reason:'Has a version you assigned to them individually. Update it from your learner list.'}:{})})}
   // Outside the teacher's own group, only the "managed elsewhere" reason is shown; other details stay private.
   catch(e){results.push({label:m.label||'Learner',status:'skipped',reason:own||e.status===403?(e.status?e.message:'Could not assign. Try again.'):'Not assigned right now. Try sending again later.'})}
  }
  await auditEvent(env,'learner:'+owner,'class-course-assigned',{learners:results.filter(r=>r.status==='assigned').length},now());
  return noStore({results,learners:all.length,nextCursor:rest.length>10?page.at(-1).handle:null});
 }
 const {row,g}=await load(input.id);
 if(input.action==='revoke'){
  need(manages&&g.manager===principal&&g.siteOwner===siteOwner,'Only this course organiser can withdraw its assignment.',403);need(input.revision===g.revision,'The assignment changed. Reload before withdrawing it.',409);
  return withGrantLease(env,g,now,async()=>{const r=await db.run('UPDATE data_controls SET policy=?,updated=? WHERE scope=? AND policy=?',JSON.stringify({...g,revoked:true,revision:crypto.randomUUID()}),now(),row.scope,row.policy);need(r.meta.changes===1,'Assignment changed. Reload before continuing.',409);await db.run('DELETE FROM data_controls WHERE scope=?',consentScope(g.id));return noStore({revoked:true})});
 }
 if(input.action==='help-seen'){
  // Tells the learner their help request was seen. It is a receipt, not a reply or a grade.
  need(manages&&g.manager===principal&&g.siteOwner===siteOwner,'Only this course organiser can mark help as seen.',403);
  need(input.revision===g.revision&&await activeCourseGrant(env,g),'The assignment changed. Reload before continuing.',409);
  need(input.note==null||input.note===''||Object.hasOwn(HELP_NOTES,input.note),'Choose one of the short notes, or none.');
  const report=await readSharedReport(env,store,g,now);need(report.state==='shared'&&report.updates.some(u=>u.help),'The learner changed or stopped sharing this update.',409);
  const slot=helpSeenSlot(g.id),prev=await store.latest('learner_profiles',g.owner,slot);
  const helpSeen={schemaVersion:1,grantId:g.id,revision:g.revision,receipt:await digest('help-seen:'+report.receipt),seenAt:now(),note:input.note||null};
  await store.write('learner_profiles',g.owner,slot,prev?.version||0,{helpSeen},now());
  await auditEvent(env,'learner:'+owner,'help-seen',{},now());return noStore({seen:{at:helpSeen.seenAt,note:HELP_NOTES[helpSeen.note]||null}});
 }
 need(input.action==='share'&&g.learner===principal&&owner===principal,'Only the assigned learner can choose what to share.',403);
 need(input.revision===g.revision&&await activeCourseGrant(env,g),'This course assignment changed or was withdrawn.',409);need(typeof input.enabled==='boolean','Choose whether to share updates.');
 return withGrantLease(env,g,now,async()=>{
  const scope=consentScope(g.id),before=await db.one('SELECT policy FROM data_controls WHERE scope=?',scope),prior=parse(before?.policy),token=crypto.randomUUID(),reservation={revision:g.revision,token,enabled:false};
  let updates;
  if(input.enabled){need(Number.isInteger(input.expectedVersion)&&input.expectedVersion>=0,'Use the saved report version.');updates=cleanUpdates(input.updates,g);need((input.consentToken||null)===(prior.token||null),'Sharing changed on another device. Reload before sharing again.',409);need((await grantChapters(env,g)).length,'Course activities changed. Ask your organiser for a reviewed version.',409)}
  // Turning off always wins over an in-flight enable/update, even from a stale tab.
  const r=before?await db.run('UPDATE data_controls SET policy=?,updated=? WHERE scope=?'+(input.enabled?' AND policy=?':''),JSON.stringify(reservation),now(),scope,...(input.enabled?[before.policy]:[])):await db.run('INSERT OR IGNORE INTO data_controls(scope,policy,updated) VALUES(?,?,?)',scope,JSON.stringify(reservation),now());need(r.meta.changes===1,'Sharing changed. Reload to see its current state.',409);
  if(!input.enabled){await auditEvent(env,'learner:'+owner,'course-sharing-off',{},now());return noStore({sharing:false,consentToken:token,notice:'Sharing stopped. Saved updates remain private in Your data until you delete them or their retention period expires.'})}
  const report={schemaVersion:1,grantId:g.id,revision:g.revision,receipt:token,enabled:true,updates};
  const saved=await store.write('learner_profiles',owner,reportSlot(g.id),input.expectedVersion,{report},now());
  const latest=await db.one('SELECT policy FROM data_controls WHERE scope=?',grantScope(g.id));need(parse(latest?.policy).revision===g.revision&&await activeCourseGrant(env,g),'This assignment was withdrawn or changed while saving. Updates are private.',409);
  const committed=await db.run('UPDATE data_controls SET policy=?,updated=? WHERE scope=? AND policy=?',JSON.stringify({...reservation,enabled:true,reportVersion:saved.version}),now(),scope,JSON.stringify(reservation));need(committed.meta.changes===1,'Sharing was stopped or changed while saving. Reload before sharing again.',409);
  await auditEvent(env,'learner:'+owner,'course-sharing-on',{objectives:updates.length},now());return noStore({sharing:true,version:saved.version,consentToken:token});
 });
}
