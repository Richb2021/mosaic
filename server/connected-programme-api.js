import {readJSON,noStore} from './ncb-auth.js';
import {sqlDB,parse,need,readControls,DAY} from './data-control.js';
import {digest} from './content-service.js';
import {validateUnit,makeProgramme} from '../src/studio/programme.js';
import {validateCreative} from '../src/studio/creative-content.js';
import {validateExploreState,emptyExplore,exploreView} from '../src/studio/explore-model.js';
import {validateLoop,emptyLoop,loopView} from '../src/studio/learning-loop.js';
import {validPracticeRecord} from '../src/game-modes/learning-model.js';
import {emptyConnected,validateConnected,connectedRoute,PROGRAMME_FORMATS} from '../src/studio/connected-programme.js';
import {assignedLearningResources} from './course-learning-resources.js';
import {assignedQuestionBanks,assertQuestionGrant} from './course-question-banks.js';
import {withGrantLease} from './course-grants.js';
export async function connectedProgrammeAPI(req,env,{owner,principal=owner,siteOwner,store,resolve,now=()=>Date.now()}){
 const db=sqlDB(env.DB),url=new URL(req.url),input=req.method==='GET'?Object.fromEntries(url.searchParams):await readJSON(req,12000),pack=await resolve(input.packId,input.contentHash,req,env),studio=await store.latest('learner_profiles',owner,'studio');
 let unit;try{unit=validateUnit(parse(studio?.payload).studio.units.find(u=>u.packId===input.packId&&u.contentHash===input.contentHash),pack)}catch{need(false,'Open this saved programme before connecting formats.',409)}
 const slot='programme-'+(await digest(unit.id)).slice(0,54),row=await store.latest('learner_profiles',owner,slot);let version=row?.version||0,state=row?validateConnected(parse(row.payload).connected):emptyConnected();
 const selectedLinks=input.action==='choose'?validateConnected({...state,formats:input.formats,links:input.links}).links:state.links;
 const resources=[],add=async r=>{if(!r.activityKeys?.length||!(['podcast','cartoon'].includes(r.kind)?r.activityKeys.some(k=>unit.activityKeys.includes(k)):r.activityKeys.every(k=>unit.activityKeys.includes(k)))||resources.some(v=>v.id===r.id&&v.hash===r.hash))return;
  let progress=null;const selected=selectedLinks.some(l=>l.id===r.id&&l.hash===r.hash);
  if(r.kind==='explore'&&selected){const k='explore-'+(await digest(r.id+':'+r.hash)).slice(0,56),saved=await store.latest('learner_profiles',owner,k),s=saved?validateExploreState(r.content,r.hash,parse(saved.payload).explore):emptyExplore(r.content,r.hash),view=exploreView(r.content,s);progress={complete:view.completed,attempts:s.answers.length,investigations:s.investigations.length,needsSupport:view.assessment.some(a=>a.result?.correct===false)||s.answers.some(a=>a.assisted||a.confidence!=='confident'),humanReview:view.assessment.some(a=>a.result?.status==='human-review'),reason:'First responses and help are recorded separately. Written reasoning still needs human review.'};}
  if(r.kind==='practice'&&selected){const k='loop-'+(await digest(r.id+':'+r.hash)).slice(0,59),saved=await store.latest('learner_profiles',owner,k),s=saved?validateLoop(r.content,r.hash,parse(saved.payload).loop):emptyLoop(r.content,r.hash),view=loopView(r.content,s,now());progress={complete:view.route.stage==='complete',attempts:s.answers.length,needsSupport:!!view.route.needsSupport,waiting:!!view.route.waiting,due:view.route.stage==='revisit'&&!view.route.waiting,dueAt:s.dueAt,reason:view.route.reason};}
  resources.push({...r,broaderFocus:r.activityKeys.some(k=>!unit.activityKeys.includes(k)),progress});
 };
 const jobs=await db.all("SELECT * FROM workshop_jobs WHERE owner=? AND status='creative-published' AND json_extract(payload,'$.recordType')='creative' AND json_extract(payload,'$.learnerOwner')=? AND json_extract(payload,'$.packId')=? AND json_extract(payload,'$.contentHash')=? ORDER BY created DESC LIMIT 160",siteOwner,owner,input.packId,input.contentHash);
 // A saved itinerary remains usable after its author creates more than one shelf of material.
 for(const link of state.links)if(!jobs.some(j=>j.id===link.id)){const j=await db.one("SELECT * FROM workshop_jobs WHERE id=? AND owner=? AND status='creative-published' AND json_extract(payload,'$.recordType')='creative' AND json_extract(payload,'$.learnerOwner')=? AND json_extract(payload,'$.packId')=? AND json_extract(payload,'$.contentHash')=?",link.id,siteOwner,owner,input.packId,input.contentHash);if(j)jobs.push(j)}
 for(const j of jobs){const p=parse(j.payload);if(!PROGRAMME_FORMATS.includes(p.kind))continue;try{const content=validateCreative(parse(j.draft),p);await add({id:j.id,hash:await digest(j.draft),kind:p.kind,title:content.title,activityKeys:p.activityKey?[p.activityKey]:p.context.activities.map(a=>a.key),content,siteOwner,author:owner})}catch{}}
 for(const r of await assignedLearningResources(env,principal,{packId:input.packId,contentHash:input.contentHash}))try{await add({...r,siteOwner:r.g.siteOwner,author:r.g.owner})}catch{}
 for(const r of await assignedQuestionBanks(env,principal,{packId:input.packId,contentHash:input.contentHash}))try{await add({id:r.bank.id,hash:r.hash,kind:r.bank.kind,title:r.bank.title,activityKeys:[r.p.activityKey],content:r.bank,g:r.g,siteOwner:r.g.siteOwner,author:r.g.owner})}catch{}
 if(input.resourceId){const r=resources.find(r=>r.id===input.resourceId&&r.hash===input.resourceHash);need(r&&state.links.some(l=>l.id===r.id&&l.hash===r.hash),'This linked resource is unavailable or changed. Refresh your programme.',409);need(['podcast','cartoon'].includes(r.kind),'Open this resource through its learning activity.',400);
  const execute=async()=>{if(r.g)await assertQuestionGrant(env,r.g);
   if(input.audioIndex!==undefined){const i=Number(input.audioIndex);need(Number.isInteger(i)&&i>=0&&i<r.content.segments.length,'Choose an episode segment.');need(env.BUCKET,'Stored narration is unavailable.',503);
    const asset=await db.one("SELECT * FROM media_assets WHERE site_owner=? AND learner_owner=? AND script_id=? AND script_hash=? AND segment=? AND status='ready' ORDER BY updated DESC LIMIT 1",r.siteOwner,r.author,r.id,r.hash,i);need(asset,'No saved narration for this segment. Use the transcript or ask its author to prepare the audio.',404);
    const {controls}=await readControls(env,r.siteOwner,r.author,now()),days=parse(controls.learner.policy).mediaDays||0;need(!days||asset.created+days*DAY>now(),'This recording reached its retention limit.',410);
    const object=await env.BUCKET.get(asset.object_key);need(object,'Saved narration unavailable. No regeneration was requested.',404);if(r.g)await assertQuestionGrant(env,r.g);return new Response(object.body,{headers:{'Content-Type':'audio/mpeg','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Mosaic-Audio':'stored'}});
   }
   if(r.g)await assertQuestionGrant(env,r.g);return noStore({script:r.content,assigned:!!r.g});
  };return r.g?withGrantLease(env,r.g,now,execute):execute();
 }
 if(req.method==='POST'){
  need(Number.isInteger(input.expectedVersion)&&input.expectedVersion===version,'Your programme choices changed on another device. Refresh before saving; your draft is kept.',409);
  if(input.action==='choose'){const clean=validateConnected({...state,formats:input.formats,links:input.links});for(const l of clean.links)need(resources.some(r=>r.id===l.id&&r.hash===l.hash&&r.kind===l.kind),'A chosen resource changed or needs review.',409);state=clean;}
  else if(input.action==='reflect-media'){const r=resources.find(r=>r.id===input.id&&r.hash===input.hash&&['podcast','cartoon'].includes(r.kind));need(r&&state.links.some(l=>l.id===r.id&&l.hash===r.hash),'Choose an available linked episode.',409);state=validateConnected({...state,media:[...state.media.filter(m=>m.id!==r.id||m.hash!==r.hash),{id:r.id,hash:r.hash,used:input.used,reflection:input.reflection}]});}
  else need(false,'Choose a programme action.');
  const saved=await store.write('learner_profiles',owner,slot,version,{connected:state,packId:input.packId,contentHash:input.contentHash},now());version=saved.version;
 }
 const records=[];for(const r of await store.list(owner))try{const value={...parse(r.payload),updated:Number(r.updated_ms)};if(validPracticeRecord(value))records.push(value)}catch{}
 const base=makeProgramme(pack,unit,records,now()),route=connectedRoute({unit,base,state,resources});
 return noStore({state,version,route,resources:resources.map(({content,g,siteOwner,author,...r})=>({...r,assigned:!!g}))});
}
