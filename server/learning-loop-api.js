import {assignedQuestionBanks,assertQuestionGrant} from './course-question-banks.js';
import {withGrantLease} from './course-grants.js';
import {readJSON,noStore} from './ncb-auth.js';
import {digest} from './content-service.js';
import {need,parse,sqlDB} from './data-control.js';
import {validatePractice,validateLoop,emptyLoop,loopAction,loopView} from '../src/studio/learning-loop.js';
import {validateUnit} from '../src/studio/programme.js';

export async function learningLoopAPI(req,env,{owner,principal=owner,siteOwner,store,resolve,now=()=>Date.now()}){
 need(siteOwner&&env.DB,'Open your private workspace to save a learning cycle.',401);
 const input=req.method==='GET'?Object.fromEntries(new URL(req.url).searchParams):await readJSON(req,5000);
 need(typeof input.bankId==='string'&&input.bankId.length<=100&&typeof input.bankHash==='string'&&/^[a-f0-9]{64}$/.test(input.bankHash),'Choose an exact reviewed learning cycle.');
 let j=await sqlDB(env.DB).one('SELECT * FROM workshop_jobs WHERE id=? AND owner=?',input.bankId,siteOwner),p=parse(j?.payload),assigned=null;
 if(!(j&&p.recordType==='creative'&&p.kind==='practice'&&p.learnerOwner===owner)){
  assigned=(await assignedQuestionBanks(env,principal,{id:input.bankId,hash:input.bankHash}))[0];
  need(assigned,'Learning cycle not found or assignment unavailable.',404);p=assigned.p;j={id:assigned.bank.id};
 }else need(j.status==='creative-published'&&j.draft&&await digest(j.draft)===input.bankHash,'This cycle changed or needs review. Reopen the reviewed version.',409);
 const execute=async()=>{
 if(assigned)await assertQuestionGrant(env,assigned.g);
 const pack=await resolve(p.packId,p.contentHash,req,env),programme=await store.latest('learner_profiles',owner,'studio');
 let unit;try{unit=validateUnit(parse(programme?.payload).studio.units.find(u=>u.packId===p.packId&&u.contentHash===p.contentHash),pack)}catch{need(false,'Reopen the saved programme before continuing this cycle.',409)}
 need(unit.activityKeys.includes(p.activityKey),'This cycle is outside your current programme focus.',409);
 const bank=assigned?assigned.bank:validatePractice(JSON.parse(j.draft),p),slot='loop-'+(await digest(j.id+':'+input.bankHash)).slice(0,59),row=await store.latest('learner_profiles',owner,slot);
 const state=row?parse(row.payload).loop:emptyLoop(bank,input.bankHash);
 need(state&&state.schemaVersion===1&&state.bankId===bank.id&&state.bankHash===input.bankHash&&Array.isArray(state.answers)&&state.answers.length<=4&&Array.isArray(state.help)&&state.help.length<=8,'The saved cycle could not be read. It has been preserved.',422);
 validateLoop(bank,input.bankHash,state);
 let version=row?.version||0,next=state;
 if(req.method==='POST'){
  need(Number.isInteger(input.expectedVersion)&&input.expectedVersion>=0&&input.expectedVersion===version,'A newer learning record exists. Refresh this cycle before answering.',409);
  need(input.action&&typeof input.action==='object'&&!Array.isArray(input.action),'Choose a learning action.');
  next=loopAction(bank,state,input.action,now());const saved=await store.write('learner_profiles',owner,slot,version,{loop:next,packId:p.packId,contentHash:p.contentHash,activityKey:p.activityKey},now());version=saved.version;
 }else need(req.method==='GET','Learning cycle route not found.',404);
 if(assigned)await assertQuestionGrant(env,assigned.g);
 return noStore({...loopView(bank,next,now()),version,activityKey:p.activityKey,assigned:!!assigned,...(assigned?{}:{profile:p.context.learner,profileChanged:JSON.stringify(p.context.learner)!==JSON.stringify({level:unit.profile.level,interests:unit.profile.interests.slice(0,2),focus:unit.profile.struggles.slice(0,500),goal:unit.profile.goal.slice(0,500)})})});
 };
 return assigned?withGrantLease(env,assigned.g,now,execute):execute();
}

export async function learningLoopSummaries(env,{siteOwner,owner,store,now,units}){
 if(!env.DB||!siteOwner)return [];
 if(!units){const programme=await store.latest('learner_profiles',owner,'studio');units=parse(programme?.payload).studio?.units||[];}
 const rows=await store.allRows('learner_profiles',owner),heads=new Map();
 for(const r of rows)if(r.slot_key.startsWith('loop-')&&(!heads.has(r.slot_key)||heads.get(r.slot_key).version<r.version))heads.set(r.slot_key,r);
 const summaries=[],counts=new Map(),jobs=await sqlDB(env.DB).all("SELECT * FROM workshop_jobs WHERE owner=? AND json_extract(payload,'$.recordType')='creative' AND json_extract(payload,'$.learnerOwner')=? ORDER BY created DESC",siteOwner,owner);
 for(const j of jobs){try{
  const p=parse(j.payload),identity=p.packId+':'+p.contentHash,count=(counts.get(identity)||0)+1;counts.set(identity,count);
  // Match the saved-request shelf's 40-record window and the current focus.
  if(count>40||j.status!=='creative-published'||!units.some(u=>u.packId===p.packId&&u.contentHash===p.contentHash&&u.activityKeys.includes(p.activityKey)))continue;
  if(p.recordType!=='creative'||p.kind!=='practice'||p.learnerOwner!==owner)continue;
  const bank=validatePractice(parse(j.draft),p),hash=await digest(j.draft),slot='loop-'+(await digest(j.id+':'+hash)).slice(0,59),row=heads.get(slot),saved=row?parse(row.payload):null;
  // An invalid saved attempt is never presented as a new unanswered cycle.
  const state=row?validateLoop(bank,hash,saved.loop):emptyLoop(bank,hash),view=loopView(bank,state,now);
  summaries.push({bankId:bank.id,bankHash:hash,packId:p.packId,contentHash:p.contentHash,activityKey:p.activityKey,title:bank.title,updated:Number(row?.updated_ms||j.updated),stage:view.route.stage,dueAt:state.dueAt,waiting:!!view.route.waiting,needsSupport:view.route.needsSupport,reason:view.route.reason,attempts:state.answers.length});
 }catch{ /* Unavailable banks and unreadable attempts stay out of recommendations. */ }}
 for(const {bank,p,hash,updated} of await assignedQuestionBanks(env,owner))try{
  if(!units.some(u=>u.packId===p.packId&&u.contentHash===p.contentHash&&u.activityKeys.includes(p.activityKey))||summaries.some(s=>s.bankId===bank.id&&s.bankHash===hash))continue;
  const slot='loop-'+(await digest(bank.id+':'+hash)).slice(0,59),row=heads.get(slot),state=row?validateLoop(bank,hash,parse(row.payload).loop):emptyLoop(bank,hash),view=loopView(bank,state,now);
  summaries.push({bankId:bank.id,bankHash:hash,...p,title:bank.title,updated:Number(row?.updated_ms||updated),stage:view.route.stage,dueAt:state.dueAt,waiting:!!view.route.waiting,needsSupport:view.route.needsSupport,reason:view.route.reason,attempts:state.answers.length});
 }catch{ /* Preserve unreadable attempts, without recommending them as fresh. */ }
 return summaries.sort((a,b)=>b.updated-a.updated);
}

export async function assignedLoopList(req,env,{owner,principal=owner,store,resolve}){
 need(req.method==='GET','Learning cycle route not found.',404);
 const input=Object.fromEntries(new URL(req.url).searchParams),pack=await resolve(input.packId,input.contentHash,req,env),row=await store.latest('learner_profiles',owner,'studio');
 let unit;try{unit=validateUnit(parse(row?.payload).studio.units.find(u=>u.packId===pack.id&&u.contentHash===input.contentHash),pack)}catch{need(false,'Open your saved programme before continuing.',409)}
 const banks=await assignedQuestionBanks(env,principal,{packId:input.packId,contentHash:input.contentHash});
 return noStore({jobs:banks.filter(b=>unit.activityKeys.includes(b.p.activityKey)).map(b=>({id:b.bank.id,draftHash:b.hash,kind:'practice',status:'published',readOnly:true,activityKey:b.p.activityKey,draft:{title:b.bank.title}}))});
}
