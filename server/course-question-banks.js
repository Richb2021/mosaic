import {validateExplore} from '../src/studio/explore-model.js';
import {sqlDB,parse,need} from './data-control.js';
import {digest} from './content-service.js';
import {validatePractice} from '../src/studio/learning-loop.js';
import {draftHash} from '../src/game-modes/draft-engine.js';
import {validatePlayableContent} from '../src/game-modes/content-registry.js';
import {bundlePublishedChapter} from './rpg-catalog.js';
import {learnerCourseGrants,grantChapters,grantScope} from './course-grants.js';

export const publicQuestionBank=q=>({id:q.id,hash:q.hash,title:q.title,activityKey:q.activityKey,packId:q.packId,contentHash:q.contentHash,questions:q.bank?.assessment?.length||4,...(q.bank?.kind==='explore'?{kind:'explore'}:{})});
const playable=raw=>{const p=validatePlayableContent(parse(raw));return p.template==='underlight-v1'?bundlePublishedChapter(p):p};
// The organiser's validated content is copied once, without its authoring context.
// Runtime reads only this learner's existing course grant, never the author store.
export async function reviewedQuestionBank(env,{owner,siteOwner,step,id,hash}){
 need(typeof id==='string'&&id.length<=100&&typeof hash==='string'&&/^[a-f0-9]{64}$/.test(hash),'Choose an exact reviewed question set.');
 const db=sqlDB(env.DB),j=await db.one('SELECT * FROM workshop_jobs WHERE id=? AND owner=?',id,siteOwner),p=parse(j?.payload);
 need(j?.status==='creative-published'&&p.recordType==='creative'&&['practice','explore'].includes(p.kind)&&p.learnerOwner===owner&&j.draft&&await digest(j.draft)===hash,'The selected question set changed or needs review.',409);
 const chapter=await db.one('SELECT draft FROM workshop_jobs WHERE id=? AND owner=? AND status=?',step.jobId,siteOwner,'published');
 need(chapter?.draft&&await digest(chapter.draft)===step.hash,'The assigned chapter changed.',409);
 const pack=playable(chapter.draft);
 need(p.packId===pack.id&&p.contentHash===draftHash(pack)&&p.context?.activities?.some(a=>a.key===p.activityKey),'This question set belongs to another chapter or focus.',409);
 const bank=p.kind==='explore'?validateExplore(parse(j.draft),p):validatePractice(parse(j.draft),p);
 need(new TextEncoder().encode(JSON.stringify(bank)).length<=24000&&await digest(JSON.stringify(bank))===hash,'The reviewed question set is too large or changed.',409);
 return {id,hash,title:bank.title,activityKey:p.activityKey,packId:p.packId,contentHash:p.contentHash,bank};
}
export async function attachQuestionBanks(env,ctx,route,selected=[]){
 need(Array.isArray(selected)&&selected.length<=route.steps.length&&new Set(selected.map(q=>q.objectiveId)).size===selected.length,'Select at most one question set for each objective.');
 for(const choice of selected){
  need(choice&&Object.keys(choice).every(k=>(choice.remove===true?['objectiveId','remove']:['objectiveId','id','hash']).includes(k)),'Unexpected question set selection.');
  const step=route.steps.find(s=>s.id===choice.objectiveId);need(step,'Choose an objective in this reviewed course.');
  if(choice.remove===true){delete step.questionBank;continue}
  step.questionBank=await reviewedQuestionBank(env,{...ctx,step,...choice});
 }
 return route;
}
export async function availableQuestionBanks(env,ctx,route){
 const db=sqlDB(env.DB),steps=[];
 for(const step of route.steps){
  const chapter=await db.one('SELECT draft FROM workshop_jobs WHERE id=? AND owner=? AND status=?',step.jobId,ctx.siteOwner,'published');
  need(chapter?.draft&&await digest(chapter.draft)===step.hash,'The assigned chapter changed.',409);const pack=playable(chapter.draft);
  const rows=await db.all("SELECT id,draft FROM workshop_jobs WHERE owner=? AND status='creative-published' AND json_extract(payload,'$.kind') IN ('practice','explore') AND json_extract(payload,'$.learnerOwner')=? AND json_extract(payload,'$.packId')=? AND json_extract(payload,'$.contentHash')=? ORDER BY created DESC LIMIT 40",ctx.siteOwner,ctx.owner,pack.id,draftHash(pack)),banks=[];
  for(const j of rows)try{banks.push(publicQuestionBank(await reviewedQuestionBank(env,{...ctx,step,id:j.id,hash:await digest(j.draft)})))}catch(e){if(![400,409].includes(e.status))throw e}
  steps.push({objectiveId:step.id,banks});
 }
 return steps;
}
export async function assertQuestionGrant(env,g){
 const row=await sqlDB(env.DB).one('SELECT policy FROM data_controls WHERE scope=?',grantScope(g.id)),current=parse(row?.policy);
 need(current.revision===g.revision&&current.signature===g.signature&&(await grantChapters(env,current)).length,'This course assignment changed or was withdrawn. Reopen your assigned courses.',409);
}
export async function assignedQuestionBanks(env,learner,filter={}){
 const result=[],seen=new Set();
 for(const g of await learnerCourseGrants(env,learner)){
  const selected=g.steps.filter(s=>s.questionBank).map(s=>s.questionBank).filter(q=>Object.entries(filter).every(([k,v])=>q[k]===v));
  if(!selected.length||!(await grantChapters(env,g)).length)continue;
  for(const q of selected)try{
   need(q.bank&&await digest(JSON.stringify(q.bank))===q.hash,'Assigned question set changed.',409);
   const bank=(q.bank.kind==='explore'?validateExplore:validatePractice)(q.bank,{id:q.id,context:{evidence:q.bank.sources,activities:[]}}),key=q.id+':'+q.hash;
   if(!seen.has(key)){seen.add(key);result.push({g,bank,p:{packId:q.packId,contentHash:q.contentHash,activityKey:q.activityKey},hash:q.hash,updated:g.assignedAt})}
  }catch{ /* Invalid snapshots never reveal a partial bank. */ }
 }
 return result;
}

export function preserveQuestionBanks(route,previous){
 for(const step of route.steps){const old=previous.steps?.find(s=>s.id===step.id&&s.jobId===step.jobId&&s.hash===step.hash);if(old?.questionBank)step.questionBank=structuredClone(old.questionBank)}
}
export const signedCourseRoute=g=>({courseId:g.courseId,title:g.title,planId:g.planId,planHash:g.planHash,sources:g.sources,steps:g.steps,learnerBinding:g.learnerBinding,managerBinding:g.managerBinding});
