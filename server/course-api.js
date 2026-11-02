import {planCurrent} from './course-plan-api.js';
import {validateCoursePlan} from '../src/studio/course-plan.js';
import {RESOURCE_METADATA} from './resource-library.js';
import {emptyCourses,validateCourses,editCourses} from '../src/studio/course-model.js';
import {readJSON,noStore} from './ncb-auth.js';
import {sqlDB,parse,need} from './data-control.js';
import {digest} from './content-service.js';
import {validatePlayableContent} from '../src/game-modes/content-registry.js';
import {StoreError} from './ncb-store.js';

export async function courseAPI(req,env,{owner,siteOwner,store,access,now=()=>Date.now()}){
 need(env.DB&&siteOwner,'Sign in to open your course notebook.',401);
 const db=sqlDB(env.DB),row=await store.latest('learner_profiles',owner,'courses'),version=row?.version||0;
 let state;try{state=row?validateCourses(parse(row.payload).courses):emptyCourses()}catch{throw new StoreError('Your course notebook could not be read. It has not been replaced.',422)}
 const canAuthor=env.PILOT_ENABLED!=='true'||access.canAuthor&&access.ageBand==='18plus';
 if(req.method==='GET'){
  // Managed learners receive assignments through the catalogue, not the author's notebook.
  if(!canAuthor)return noStore({state:emptyCourses(),version:0,resources:[],chapters:[],canAuthor:false});
  const sourceIDs=[...new Set(state.courses.flatMap(c=>c.topics.flatMap(t=>t.resources.map(r=>r.id))))],resources=[];
  for(let start=0;start<sourceIDs.length;start+=50){const batch=sourceIDs.slice(start,start+50);resources.push(...await db.all(`SELECT ${RESOURCE_METADATA} FROM workshop_resources WHERE owner=? AND id IN (`+batch.map(()=>'?').join(',')+')',siteOwner,...batch));}
  const ids=[...new Set(state.courses.flatMap(c=>[...c.topics.flatMap(t=>t.chapters.map(j=>j.id)),...(c.plan?.links||[]).map(l=>l.id)]))];
  const chapters=[];
  for(let start=0;start<ids.length;start+=50){const batch=ids.slice(start,start+50),rows=await db.all('SELECT * FROM workshop_jobs WHERE owner=? AND id IN ('+batch.map(()=>'?').join(',')+')',siteOwner,...batch);
   for(const j of rows)if(j?.draft&&!parse(j.payload).recordType){try{const p=validatePlayableContent(JSON.parse(j.draft));chapters.push({id:j.id,title:p.title,status:j.status,hash:await digest(j.draft),template:p.template,packId:p.id});}catch{}}
  }
  return noStore({state,version,resources,chapters,canAuthor:true});
 }
 need(req.method==='POST','Course route not found.',404);need(canAuthor,'Your organiser prepares course material. Open your assigned activities to learn.',403);
 const input=await readJSON(req,7000);need(Number.isInteger(input.expectedVersion)&&input.expectedVersion===version,'Your course changed on another device. Reload before saving this edit.',409);
 let binding;
 if(input.type==='link-resource'){
  const r=await db.one('SELECT id,checksum FROM workshop_resources WHERE id=? AND owner=?',input.id,siteOwner);need(r,'Source not found in your library.',404);need(r.checksum===input.checksum,'This source changed. Review its current text before linking it.',409);binding={id:r.id,checksum:r.checksum};
 }
 if(['link-chapter','link-objective-chapter'].includes(input.type)){
  const j=await db.one('SELECT id,draft,status,payload FROM workshop_jobs WHERE id=? AND owner=?',input.id,siteOwner);need(j?.draft&&!parse(j.payload).recordType&&['review','published'].includes(j.status),'Choose a generated chapter ready for review or already published.',404);
  const hash=await digest(j.draft);need(hash===input.hash,'This chapter changed. Open its current review before linking it.',409);validatePlayableContent(JSON.parse(j.draft));binding={id:j.id,hash};
 }
 if(['link-plan','link-objective-chapter'].includes(input.type)){
  const c=state.courses.find(c=>c.id===input.courseId),planId=input.type==='link-plan'?input.id:c?.plan?.id;
  const j=await db.one('SELECT * FROM workshop_jobs WHERE id=? AND owner=?',planId||'',siteOwner),p=parse(j?.payload);
  need(c&&j?.status==='plan-approved'&&p.recordType==='course-plan'&&p.learnerOwner===owner&&p.courseId===c.id,'Choose an approved plan from this course.',404);
  const hash=await digest(j.draft);need(hash===(input.type==='link-plan'?input.hash:c.plan.hash),'The approved plan changed.',409);need(!(await planCurrent(db,siteOwner,j,c)).length,'Course evidence changed. Prepare a new plan.',409);
  const plan=validateCoursePlan(parse(j.draft),p);
  if(input.type==='link-plan')binding={id:j.id,hash};
  else {const objective=plan.steps.find(s=>s.id===input.objectiveId&&s.topicId===input.topicId);need(objective,'Choose an objective in this plan.');const chapter=await db.one('SELECT payload,draft,status FROM workshop_jobs WHERE id=? AND owner=?',input.id,siteOwner),cp=parse(chapter.payload);need(chapter.status==='published','Review and publish this chapter before linking it to an objective.',409);need(cp.goal===objective.objective&&objective.sourceRefs.every(id=>cp.evidence?.some(e=>e.id===id)),'Prepare this chapter from the objective and its exact evidence first.',409);}
 }
 let next;try{next=editCourses(state,input,binding)}catch(e){throw new StoreError(e.message,400)}
 const saved=await store.write('learner_profiles',owner,'courses',version,{courses:next},now());return noStore({state:next,version:saved.version});
}
