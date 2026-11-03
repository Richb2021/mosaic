import {readJSON,noStore} from './ncb-auth.js';
import {sqlDB,parse,need,DAY,auditEvent} from './data-control.js';
import {digest} from './content-service.js';
import {grantScope,withGrantLease,activeCourseGrant,grantChapters} from './course-grants.js';
import {validateExplore,validateExploreState} from '../src/studio/explore-model.js';
export const workScope=id=>'course-work:'+id;
export const workSlot=id=>'work-'+id.slice(0,59);
export const feedbackSlot=id=>'feedback-'+id.slice(0,55);
const text=(s,max)=>{need(typeof s==='string'&&s.trim()&&s.length<=max,'Write a concise response.');return s.trim()};
function lessons(g){
 const rows=g.steps.flatMap(s=>[s.questionBank,...(s.learningResources||[])].filter(Boolean));
 return [...new Map(rows.filter(r=>r.bank?.kind==='explore'||r.kind==='explore').map(r=>[r.id,r])).values()];
}
async function checkedLesson(g,id,hash){
 const r=lessons(g).find(r=>r.id===id&&r.hash===hash);need(r,'Choose a reviewed Explore lesson in this assignment.',404);
 const raw=r.bank||r.content;need(raw&&await digest(JSON.stringify(raw))===hash,'This lesson version changed.',409);
 return validateExplore(raw,{id:r.id,context:{evidence:raw.sources}});
}
export async function teacherReviewAPI(req,env,{owner,principal,siteOwner,store,access,now=()=>Date.now()}){
 const db=sqlDB(env.DB),input=req.method==='GET'?Object.fromEntries(new URL(req.url).searchParams):await readJSON(req,12000);
 need(typeof input.id==='string'&&/^[a-f0-9]{64}$/.test(input.id),'Choose an assignment.');
 const row=await db.one('SELECT policy FROM data_controls WHERE scope=?',grantScope(input.id)),g={...parse(row?.policy),id:input.id};
 const learner=g.learner===principal&&owner===principal,teacher=g.manager===principal&&g.siteOwner===siteOwner&&['teacher','guardian','administrator'].includes(access.role);
 need(learner||teacher,'Work is only available to its learner and current organiser.',403);
 need(input.revision===g.revision&&await activeCourseGrant(env,g),'This assignment changed or was withdrawn.',409);
 return withGrantLease(env,g,now,async state=>withGrantLease(env,{...g,learner:g.owner},now,async teacherState=>{
  const retained=(r,controls)=>{const days=parse(controls.learner.policy).progressDays||0;return r&&(!days||Number(r.updated_ms)+days*DAY>now())};
  const current=async()=>{const r=await db.one('SELECT policy FROM data_controls WHERE scope=?',grantScope(g.id));need(r?.policy===row.policy&&await activeCourseGrant(env,g)&&(await grantChapters(env,g)).length,'Assignment or reviewed sources changed. Reopen the course.',409)};
  const receipt=async()=>{const r=await db.one('SELECT policy FROM data_controls WHERE scope=?',workScope(g.id));return {raw:r?.policy,p:parse(r?.policy)}};
  if(req.method==='POST'&&input.action==='withdraw'){need(learner,'Only the learner can stop sharing their work.',403);await db.run('INSERT INTO data_controls(scope,policy,updated) VALUES(?,?,?) ON CONFLICT(scope) DO UPDATE SET policy=excluded.policy,updated=excluded.updated',workScope(g.id),JSON.stringify({enabled:false,revision:g.revision,token:crypto.randomUUID(),learner:g.learner}),now());return noStore({sharing:false})}
  await current();const before=await receipt(),p=before.p;
  const readWork=async()=>{
   if(!p.enabled||p.revision!==g.revision)return null;
   const r=await store.latest('learner_profiles',g.learner,workSlot(g.id)),w=parse(r?.payload).work;
   const days=parse(state.controls.learner.policy).progressDays||0;
   if(!w||r.version!==p.version||w.token!==p.token||w.revision!==g.revision||days&&Number(r.updated_ms)+days*DAY<=now())return null;
   const lesson=await checkedLesson(g,w.lessonId,w.lessonHash);
   need(await digest(JSON.stringify(w))===p.hash,'Submitted work is unavailable.',503);
   await current();need((await receipt()).raw===before.raw,'Sharing changed. Reload to see current work.',409);
   return {work:w,lesson};
  };
  if(req.method==='GET'){
   let pending=[],pendingVersion=null;
   if(learner&&input.lessonId){const lesson=await checkedLesson(g,input.lessonId,input.lessonHash),slot='explore-'+(await digest(input.lessonId+':'+input.lessonHash)).slice(0,56),r=await store.latest('learner_profiles',owner,slot);
    if(retained(r,state.controls)){pendingVersion=r.version;const s=validateExploreState(lesson,input.lessonHash,parse(r.payload).explore);pending=s.answers.map(a=>({id:a.id,prompt:lesson.assessment.find(q=>q.id===a.id).prompt,response:a.response,working:a.working,unit:a.unit,assisted:a.assisted}));}
   }
   const shared=await readWork();let feedback=null,feedbackVersion=0;
   if(shared){const r=await store.latest('learner_profiles',g.owner,feedbackSlot(g.id)),f=parse(r?.payload).feedback;feedbackVersion=r?.version||0;if(retained(r,teacherState.controls)&&f?.submissionHash===p.hash&&f.revision===g.revision)feedback=f;}
   await current();need((await receipt()).raw===before.raw,'Sharing changed. Reload to see current work.',409);
   return noStore({lessons:lessons(g).map(r=>({id:r.id,hash:r.hash,title:r.title})),pending,pendingVersion,token:p.token||null,sharing:!!shared,submissionHash:shared?p.hash:null,submission:shared?.work||null,lesson:shared?{...shared.lesson,assessment:shared.lesson.assessment.filter(q=>shared.work.answers.some(a=>a.id===q.id))}:null,feedback,feedbackVersion});
  }
  need(req.method==='POST','Review route not found.',404);
  if(input.action==='submit'){
   need(learner&&input.confirmed===true,'Preview and confirm the answers you want to send.',403);
   need((input.token||null)===(p.token||null),'Sharing changed on another device. Reload before sending.',409);
   const lesson=await checkedLesson(g,input.lessonId,input.lessonHash),ids=input.answerIds;
   need(Array.isArray(ids)&&ids.length>0&&ids.length<=6&&new Set(ids).size===ids.length,'Select the answers to send.');
   const r=await store.latest('learner_profiles',owner,'explore-'+(await digest(input.lessonId+':'+input.lessonHash)).slice(0,56));need(retained(r,state.controls),'Save your responses in Explore first.');need(input.pendingVersion===r.version,'These answers changed after your preview. Reload and review them before sending.',409);
   const saved=validateExploreState(lesson,input.lessonHash,parse(r.payload).explore);
   const answers=ids.map(id=>{const a=saved.answers.find(a=>a.id===id),q=lesson.assessment.find(q=>q.id===id);need(a&&q,'Only saved answers can be submitted.');return {id,prompt:q.prompt,response:a.response,working:a.working,unit:a.unit,assisted:a.assisted}});
   const token=crypto.randomUUID(),reservation={enabled:false,revision:g.revision,token,learner:g.learner},value=JSON.stringify(reservation);
   const change=before.raw?await db.run('UPDATE data_controls SET policy=?,updated=? WHERE scope=? AND policy=?',value,now(),workScope(g.id),before.raw):await db.run('INSERT OR IGNORE INTO data_controls(scope,policy,updated) VALUES(?,?,?)',workScope(g.id),value,now());need(change.meta.changes===1,'Sharing changed. Reload before sending.',409);
   const prior=await store.latest('learner_profiles',owner,workSlot(g.id)),work={schemaVersion:1,grantId:g.id,revision:g.revision,token,lessonId:input.lessonId,lessonHash:input.lessonHash,answers,submittedAt:now()},hash=await digest(JSON.stringify(work));
   const out=await store.write('learner_profiles',owner,workSlot(g.id),prior?.version||0,{work},now());await current();
   const committed=await db.run('UPDATE data_controls SET policy=?,updated=? WHERE scope=? AND policy=?',JSON.stringify({...reservation,enabled:true,version:out.version,hash}),now(),workScope(g.id),value);need(committed.meta.changes===1,'Sharing stopped while sending. The work remains private.',409);
   await auditEvent(env,'learner:'+owner,'work-submitted',{answers:answers.length},now());return noStore({shared:true});
  }
  need(input.action==='feedback'&&teacher,'Only the current organiser can send feedback.',403);
  const shared=await readWork();need(shared&&input.submissionHash===p.hash,'The learner changed or stopped sharing this work.',409);
  const feedback={schemaVersion:1,revision:g.revision,submissionHash:p.hash,strength:text(input.strength,1200),nextStep:text(input.nextStep,1200),sentAt:now(),authorRole:access.role};
  need(Number.isInteger(input.expectedVersion)&&input.expectedVersion>=0,'Reload feedback before saving.');
  await store.write('learner_profiles',g.owner,feedbackSlot(g.id),input.expectedVersion,{feedback},now());await current();need((await receipt()).raw===before.raw,'Sharing changed while saving. This feedback is hidden.',409);
  await auditEvent(env,'learner:'+owner,'feedback-sent',{},now());return noStore({sent:true});
 }));
}
