import {validateCreative} from '../src/studio/creative-content.js';
import {activitiesOf} from '../src/studio/programme.js';
import {validatePlayableContent} from '../src/game-modes/content-registry.js';
import {bundlePublishedChapter} from './rpg-catalog.js';
import {draftHash} from '../src/game-modes/draft-engine.js';
import {digest} from './content-service.js';
import {need,parse,sqlDB} from './data-control.js';
import {learnerCourseGrants,grantChapters} from './course-grants.js';
export const PACKAGE_KINDS=['explore','practice','podcast','cartoon'];
export const publicLearningResource=r=>({id:r.id,hash:r.hash,kind:r.kind,title:r.title,packId:r.packId,contentHash:r.contentHash,activityKeys:r.activityKeys});
export function validateLearningSnapshot(r){const script=validateCreative(r.content,{id:r.id,kind:r.kind,storyVersion:r.content.schemaVersion,context:{evidence:r.content.sources,activities:[],story:r.content.story?{genre:r.content.story.genre,interest:r.content.story.interest}:undefined}});return script}
export async function reviewedLearningResource(env,ctx,step,id,hash){
 const db=sqlDB(env.DB),j=await db.one('SELECT * FROM workshop_jobs WHERE id=? AND owner=?',id,ctx.siteOwner),p=parse(j?.payload);
 need(j?.status==='creative-published'&&p.recordType==='creative'&&p.learnerOwner===ctx.owner&&PACKAGE_KINDS.includes(p.kind)&&j.draft&&await digest(j.draft)===hash,'Choose a current approved learning resource.',409);
 const chapter=await db.one('SELECT draft FROM workshop_jobs WHERE id=? AND owner=? AND status=?',step.jobId,ctx.siteOwner,'published');need(chapter?.draft&&await digest(chapter.draft)===step.hash,'The chapter changed.',409);
 const raw=validatePlayableContent(parse(chapter.draft)),pack=raw.template==='underlight-v1'?bundlePublishedChapter(raw):raw;
 const activityKeys=p.activityKey?[p.activityKey]:(p.context?.activities||[]).map(a=>a.key);
 need(p.packId===pack.id&&p.contentHash===draftHash(pack)&&activityKeys.length&&activityKeys.every(k=>activitiesOf(pack).some(a=>a.key===k)),'This resource belongs to a different chapter or focus.',409);
 const content=validateCreative(parse(j.draft),p);need(new TextEncoder().encode(JSON.stringify(content)).length<=24000&&await digest(JSON.stringify(content))===hash,'The resource is too large or changed after review.',409);
 return {id,hash,kind:p.kind,title:content.title,packId:p.packId,contentHash:p.contentHash,activityKeys,content};
}
export async function attachLearningResources(env,ctx,route,choices=[]){
 need(Array.isArray(choices)&&choices.length<=route.steps.length&&new Set(choices.map(x=>x.objectiveId)).size===choices.length,'Choose resources once per objective.');
 for(const choice of choices){const step=route.steps.find(s=>s.id===choice.objectiveId);need(step&&Array.isArray(choice.resources)&&choice.resources.length<=4&&new Set(choice.resources.map(r=>r.id)).size===choice.resources.length,'Choose up to four different resources per objective.');
  const resources=[];for(const r of choice.resources)resources.push(await reviewedLearningResource(env,ctx,step,r.id,r.hash));need(new Set(resources.map(r=>r.kind)).size===resources.length,'Choose at most one resource of each format per objective.');step.learningResources=resources;
 }return route;
}
export function preserveLearningResources(route,old){for(const step of route.steps){const prev=old.steps?.find(s=>s.id===step.id&&s.jobId===step.jobId&&s.hash===step.hash);if(prev?.learningResources)step.learningResources=structuredClone(prev.learningResources)}}
export async function availableLearningResources(env,ctx,route){
 const db=sqlDB(env.DB),result=[];
 for(const step of route.steps){const chapter=await db.one('SELECT draft FROM workshop_jobs WHERE id=? AND owner=? AND status=?',step.jobId,ctx.siteOwner,'published');const resources=[];
  if(chapter?.draft&&await digest(chapter.draft)===step.hash){const raw=validatePlayableContent(parse(chapter.draft)),pack=raw.template==='underlight-v1'?bundlePublishedChapter(raw):raw;
   const rows=await db.all("SELECT id,draft FROM workshop_jobs WHERE owner=? AND status='creative-published' AND json_extract(payload,'$.learnerOwner')=? AND json_extract(payload,'$.packId')=? AND json_extract(payload,'$.contentHash')=? AND json_extract(payload,'$.kind') IN ('practice','explore','podcast','cartoon') ORDER BY created DESC LIMIT 160",ctx.siteOwner,ctx.owner,pack.id,draftHash(pack));
   for(const j of rows)try{resources.push(publicLearningResource(await reviewedLearningResource(env,ctx,step,j.id,await digest(j.draft))))}catch(e){if(![400,409].includes(e.status))throw e}
  }result.push({objectiveId:step.id,resources});
 }return result;
}
export async function assignedLearningResources(env,principal,filter={}){const out=[],seen=new Set();for(const g of await learnerCourseGrants(env,principal)){if(!(await grantChapters(env,g)).length)continue;for(const r of g.steps.flatMap(s=>s.learningResources||[])){if(!Object.entries(filter).every(([k,v])=>r[k]===v)||seen.has(r.id+':'+r.hash))continue;try{const content=validateLearningSnapshot(r);need(await digest(JSON.stringify(content))===r.hash,'Changed resource.',409);seen.add(r.id+':'+r.hash);out.push({...r,content,g})}catch{}}}return out}
