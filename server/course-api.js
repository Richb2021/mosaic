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
  const resources=(await db.all('SELECT * FROM workshop_resources WHERE owner=? ORDER BY created DESC LIMIT 40',siteOwner)).map(r=>({id:r.id,title:r.title,checksum:r.checksum,status:r.status,units:parse(r.payload).units||[]}));
  const ids=[...new Set(state.courses.flatMap(c=>c.topics.flatMap(t=>t.chapters.map(j=>j.id))))];
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
 if(input.type==='link-chapter'){
  const j=await db.one('SELECT id,draft,status,payload FROM workshop_jobs WHERE id=? AND owner=?',input.id,siteOwner);need(j?.draft&&!parse(j.payload).recordType&&['review','published'].includes(j.status),'Choose a generated chapter ready for review or already published.',404);
  const hash=await digest(j.draft);need(hash===input.hash,'This chapter changed. Open its current review before linking it.',409);validatePlayableContent(JSON.parse(j.draft));binding={id:j.id,hash};
 }
 let next;try{next=editCourses(state,input,binding)}catch(e){throw new StoreError(e.message,400)}
 const saved=await store.write('learner_profiles',owner,'courses',version,{courses:next},now());return noStore({state:next,version:saved.version});
}
