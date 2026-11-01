import {readJSON,noStore} from './ncb-auth.js';
import {digest} from './content-service.js';
import {need,parse,sqlDB} from './data-control.js';
import {validatePractice,validateLoop,emptyLoop,loopAction,loopView} from '../src/studio/learning-loop.js';
import {validateUnit} from '../src/studio/programme.js';

export async function learningLoopAPI(req,env,{owner,siteOwner,store,resolve,now=()=>Date.now()}){
 need(siteOwner&&env.DB,'Open your private workspace to save a learning cycle.',401);
 const input=req.method==='GET'?Object.fromEntries(new URL(req.url).searchParams):await readJSON(req,5000);
 need(typeof input.bankId==='string'&&input.bankId.length<=100&&typeof input.bankHash==='string'&&/^[a-f0-9]{64}$/.test(input.bankHash),'Choose an exact reviewed learning cycle.');
 const j=await sqlDB(env.DB).one('SELECT * FROM workshop_jobs WHERE id=? AND owner=?',input.bankId,siteOwner),p=parse(j?.payload);
 need(j&&p.recordType==='creative'&&p.kind==='practice'&&p.learnerOwner===owner,'Learning cycle not found.',404);
 need(j.status==='creative-published'&&j.draft&&await digest(j.draft)===input.bankHash,'This cycle changed or needs review. Reopen the reviewed version.',409);
 const pack=await resolve(p.packId,p.contentHash,req,env),programme=await store.latest('learner_profiles',owner,'studio');
 let unit;try{unit=validateUnit(parse(programme?.payload).studio.units.find(u=>u.packId===p.packId&&u.contentHash===p.contentHash),pack)}catch{need(false,'Reopen the saved programme before continuing this cycle.',409)}
 need(unit.activityKeys.includes(p.activityKey),'This cycle is outside your current programme focus.',409);
 const bank=validatePractice(JSON.parse(j.draft),p),slot='loop-'+(await digest(j.id+':'+input.bankHash)).slice(0,59),row=await store.latest('learner_profiles',owner,slot);
 const state=row?parse(row.payload).loop:emptyLoop(bank,input.bankHash);
 need(state&&state.schemaVersion===1&&state.bankId===bank.id&&state.bankHash===input.bankHash&&Array.isArray(state.answers)&&state.answers.length<=4&&Array.isArray(state.help)&&state.help.length<=8,'The saved cycle could not be read. It has been preserved.',422);
 validateLoop(bank,input.bankHash,state);
 let version=row?.version||0,next=state;
 if(req.method==='POST'){
  need(Number.isInteger(input.expectedVersion)&&input.expectedVersion>=0&&input.expectedVersion===version,'A newer learning record exists. Refresh this cycle before answering.',409);
  need(input.action&&typeof input.action==='object'&&!Array.isArray(input.action),'Choose a learning action.');
  next=loopAction(bank,state,input.action,now());const saved=await store.write('learner_profiles',owner,slot,version,{loop:next,packId:p.packId,contentHash:p.contentHash,activityKey:p.activityKey},now());version=saved.version;
 }else need(req.method==='GET','Learning cycle route not found.',404);
 return noStore({...loopView(bank,next,now()),version,activityKey:p.activityKey,profile:p.context.learner,profileChanged:JSON.stringify(p.context.learner)!==JSON.stringify({level:unit.profile.level,interests:unit.profile.interests.slice(0,2),focus:unit.profile.struggles.slice(0,500),goal:unit.profile.goal.slice(0,500)})});
}

export async function learningLoopSummaries(env,{siteOwner,owner,store,now}){
 if(!env.DB||!siteOwner)return [];
 const rows=await store.allRows('learner_profiles',owner),heads=new Map();
 for(const r of rows)if(r.slot_key.startsWith('loop-')&&(!heads.has(r.slot_key)||heads.get(r.slot_key).version<r.version))heads.set(r.slot_key,r);
 const summaries=[],jobs=await sqlDB(env.DB).all("SELECT * FROM workshop_jobs WHERE owner=? AND status=? AND json_extract(payload,'$.kind')='practice' AND json_extract(payload,'$.learnerOwner')=?",siteOwner,'creative-published',owner),byId=new Map(jobs.map(j=>[j.id,j]));
 for(const row of [...heads.values()]){try{
  const saved=parse(row.payload),j=byId.get(saved.loop.bankId);if(!j)continue;
  const p=parse(j.payload);if(p.kind!=='practice'||p.learnerOwner!==owner||await digest(j.draft)!==saved.loop.bankHash)continue;
  const bank=validatePractice(parse(j.draft),p),state=validateLoop(bank,saved.loop.bankHash,saved.loop),view=loopView(bank,state,now);
  summaries.push({bankId:bank.id,packId:p.packId,contentHash:p.contentHash,activityKey:p.activityKey,title:bank.title,updated:Number(row.updated_ms),stage:view.route.stage,dueAt:state.dueAt,waiting:!!view.route.waiting,needsSupport:view.route.needsSupport,reason:view.route.reason,attempts:state.answers.length});
 }catch{ /* An unavailable historical bank never becomes a recommendation. */ }}
 return summaries.sort((a,b)=>b.updated-a.updated);
}
