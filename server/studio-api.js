import {assignedChapters} from './assignments.js';
import {learningLoopSummaries} from './learning-loop-api.js';
import {emptyStudio,unitKey,newUnit,applyUnitAction,makeProgramme,validateStudioShape} from '../src/studio/programme.js';
import {normaliseProfile,validPracticeRecord} from '../src/game-modes/learning-model.js';
import {draftHash} from '../src/game-modes/draft-engine.js';
import {validatePlayableContent} from '../src/game-modes/content-registry.js';
import {bundlePublishedChapter} from './rpg-catalog.js';
import {StoreError} from './ncb-store.js';
import {readJSON,noStore} from './ncb-auth.js';
const need=(ok,message,status=400)=>{if(!ok)throw new StoreError(message,status)};
export async function studioCatalog(req,env,included,siteOwner,learnerOwner){
 const items=included.map(pack=>({pack,origin:'Included reviewed activity',jobId:null}));
 const owner=siteOwner;
 if(owner&&env.DB){
  const rows=await env.DB.prepare('SELECT id,draft FROM workshop_jobs WHERE owner=? AND status=? ORDER BY updated DESC LIMIT 80').bind(owner,'published').all();
  for(const row of rows.results){try{const p=validatePlayableContent(JSON.parse(row.draft)),pack=p.template==='underlight-v1'?bundlePublishedChapter(p):p;if(pack)items.push({pack,jobId:row.id,origin:'Published from your reviewed material'});}catch{/* An invalid historical draft is never launchable. */}}
 }
 for(const row of await assignedChapters(env,learnerOwner)){try{const p=validatePlayableContent(JSON.parse(row.draft)),pack=p.template==='underlight-v1'?bundlePublishedChapter(p):p;items.push({pack,jobId:row.id,origin:'Assigned by your organiser',readOnly:true});}catch{}}
 return [...new Map(items.map(x=>[unitKey(x.pack),x])).values()];
}
export async function studioAPI(req,env,{path,store,owner,siteOwner,resolve,included,now}){
 if(req.method==='GET'&&path==='studio/catalog')return noStore({items:await studioCatalog(req,env,included,siteOwner,owner)});
 const row=await store.latest('learner_profiles',owner,'studio'),version=row?.version||0;
 let state;try{state=row?validateStudioShape(JSON.parse(row.payload).studio):emptyStudio();}catch{throw new StoreError('Your programme record could not be read. It has not been replaced.',422);}
 const readProfile=async()=>{try{const p=await store.latest('learner_profiles',owner,'profile');return normaliseProfile(p?JSON.parse(p.payload).profile:{})}catch(e){if(e instanceof StoreError)throw e;throw new StoreError('Your saved profile could not be read. Review or repair your preferences before creating or updating a programme.',422)}};
 const hydrate=async()=>{
  const saved=await store.list(owner),records=[];for(const r of saved)try{const v={...JSON.parse(r.payload),updated:Number(r.updated_ms)};if(validPracticeRecord(v))records.push(v);}catch{}
  const units=[];for(const unit of state.units){let pack;try{pack=await resolve(unit.packId,unit.contentHash,req,env)}catch{units.push({unit:{id:unit.id,packId:unit.packId,contentHash:unit.contentHash},unavailable:true});continue;}try{units.push({unit,programme:makeProgramme(pack,unit,records,now())});}catch{units.push({unit:{id:unit.id,packId:unit.packId,contentHash:unit.contentHash},unreadable:true});}}
  return {state,version,units,cycles:await learningLoopSummaries(env,{siteOwner,owner,store,now:now()})};
 };
 if(req.method==='GET'&&path==='studio')return noStore(await hydrate());
 need(req.method==='POST'&&path==='studio','Studio route not found.',404);
 const input=await readJSON(req,16000);need(['create','update','activate','remove'].includes(input.type),'Unknown programme request.');need(Number.isInteger(input.expectedVersion)&&input.expectedVersion>=0&&input.expectedVersion<2147483646,'Invalid programme version.');need(input.expectedVersion===version,'Your programme changed on another device. Reload it before making this change.',409);
 if(input.type==='activate'){need(state.units.some(u=>u.id===input.id),'Programme not found.');state={...state,active:input.id};}
 else if(input.type==='remove'){need(state.units.some(u=>u.id===input.id),'Programme not found.');state={...state,units:state.units.filter(u=>u.id!==input.id)};if(state.active===input.id)state.active=state.units[0]?.id||null;}
 else{
  need(typeof input.packId==='string'&&input.packId.length<=100&&typeof input.contentHash==='string'&&input.contentHash.length<=100,'Choose a valid activity.');
  const pack=await resolve(input.packId,input.contentHash,req,env),id=unitKey(pack),existing=state.units.find(u=>u.id===id);
  if(input.type==='create'){
   need(input.evidenceConfirmed===true,'Review the exact sources before creating a programme.');need(!existing,'A programme for this exact version already exists. Continue or remove it before starting again.',409);need(state.units.length<12,'Keep up to twelve programmes. Remove one before adding another.',409);
   const profile=await readProfile();
   state={...state,active:id,units:[newUnit(pack,profile,input.activityKeys,now()),...state.units]};
  }else{
   need(existing,'Create a programme before recording practice.');let action={...input.action};
   if(action.type==='replan'){action.profile=await readProfile();}
   state={...state,units:state.units.map(u=>u.id===id?applyUnitAction(u,pack,action,now()):u)};
  }
 }
 const saved=await store.write('learner_profiles',owner,'studio',version,{studio:state},now());return noStore({state,version:saved.version});
}
