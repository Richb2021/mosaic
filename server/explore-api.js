import {tutorSupportSince} from './tutor-support.js';
import {assignedQuestionBanks,assertQuestionGrant} from './course-question-banks.js';
import {withGrantLease} from './course-grants.js';
import {readJSON,noStore} from './ncb-auth.js';
import {digest} from './content-service.js';
import {need,parse,sqlDB} from './data-control.js';
import {validateUnit} from '../src/studio/programme.js';
import {validateExplore,validateExploreState,emptyExplore,exploreAction,exploreView} from '../src/studio/explore-model.js';

export async function exploreAPI(req,env,{owner,principal=owner,siteOwner,store,resolve,now=()=>Date.now()}){
 need(siteOwner&&env.DB,'Open your learning workspace.',401);
 const input=req.method==='GET'?Object.fromEntries(new URL(req.url).searchParams):await readJSON(req,14000);
 need(typeof input.lessonId==='string'&&input.lessonId.length<=100&&typeof input.lessonHash==='string'&&/^[a-f0-9]{64}$/.test(input.lessonHash),'Choose an exact reviewed lesson.');
 let j=await sqlDB(env.DB).one('SELECT * FROM workshop_jobs WHERE id=? AND owner=?',input.lessonId,siteOwner),p=parse(j?.payload),assigned;
 if(!(j&&p.recordType==='creative'&&p.kind==='explore'&&p.learnerOwner===owner)){
  assigned=(await assignedQuestionBanks(env,principal,{id:input.lessonId,hash:input.lessonHash})).find(q=>q.bank.kind==='explore');
  need(assigned,'Lesson not found or assignment unavailable.',404);p=assigned.p;
 }else need(j.status==='creative-published'&&j.draft&&await digest(j.draft)===input.lessonHash,'This lesson changed or needs review.',409);
 const execute=async()=>{
  if(assigned)await assertQuestionGrant(env,assigned.g);
  const pack=await resolve(p.packId,p.contentHash,req,env),programme=await store.latest('learner_profiles',owner,'studio');
  let unit;try{unit=validateUnit(parse(programme?.payload).studio.units.find(u=>u.packId===p.packId&&u.contentHash===p.contentHash),pack)}catch{need(false,'Reopen this saved programme before continuing.',409)}
  need(unit.activityKeys.includes(p.activityKey),'This lesson is outside your programme focus.',409);
  const lesson=assigned?assigned.bank:validateExplore(parse(j.draft),p),slot='explore-'+(await digest(input.lessonId+':'+input.lessonHash)).slice(0,56),row=await store.latest('learner_profiles',owner,slot);
  let state=row?validateExploreState(lesson,input.lessonHash,parse(row.payload).explore):emptyExplore(lesson,input.lessonHash),version=row?.version||0;
  if(req.method==='POST'){
   need(Number.isInteger(input.expectedVersion)&&input.expectedVersion===version,'A newer lesson record exists. Refresh before saving; your typed response is still here.',409);
   if(input.action?.type==='answer'&&await tutorSupportSince(env,{siteOwner,owner,packId:p.packId,contentHash:p.contentHash,activityKey:p.activityKey,since:state.answers.at(-1)?.at||0}))state=exploreAction(lesson,state,{type:'help',id:input.action.id},now());
   state=exploreAction(lesson,state,input.action,now());
   const saved=await store.write('learner_profiles',owner,slot,version,{explore:state,packId:p.packId,contentHash:p.contentHash,activityKey:p.activityKey},now());version=saved.version;
  }else need(req.method==='GET','Lesson route not found.',404);
  if(assigned)await assertQuestionGrant(env,assigned.g);
  return noStore({...exploreView(lesson,state),version,assigned:!!assigned,reviewerSawAnswers:!assigned});
 };
 return assigned?withGrantLease(env,assigned.g,now,execute):execute();
}
