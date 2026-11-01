import {startCost,finishCost} from './cost-ledger.js';
import {readJSON,noStore} from './ncb-auth.js';
import {StoreError} from './ncb-store.js';
import {digest,MODEL} from './content-service.js';
import {generationBudget,GENERATION_ROWS,GENERATION_WINDOW_MS,budgetMessage} from './workshop-budget.js';
import {validateUnit,applyUnitAction} from '../src/studio/programme.js';
import {creativeContext,validateCreative,integrityResponse,CREATIVE_KINDS} from '../src/studio/creative-content.js';
import {submitCreative,checkCreative} from './creative-provider.js';
import {synthesizeSpeech,speechConfiguration} from './media-audio.js';
import {persistentAudio} from './persistent-audio.js';

const need=(ok,message,status=400)=>{if(!ok)throw new StoreError(message,status)};
const keyOK=x=>typeof x==='string'&&/^[a-z0-9-]{1,80}$/.test(x);
const KIND="json_extract(CASE WHEN json_valid(payload) THEN payload ELSE '{}' END,'$.recordType')";
const LEARNER="json_extract(CASE WHEN json_valid(payload) THEN payload ELSE '{}' END,'$.learnerOwner')";
const PACK="json_extract(CASE WHEN json_valid(payload) THEN payload ELSE '{}' END,'$.packId')";
const HASH="json_extract(CASE WHEN json_valid(payload) THEN payload ELSE '{}' END,'$.contentHash')";
export async function creativeAPI(req,env,{store,owner,resolve,now=()=>Date.now(),provider=submitCreative,reader=checkCreative,speech=synthesizeSpeech}){
 const input=req.method==='GET'?Object.fromEntries(new URL(req.url).searchParams):await readJSON(req,60000),siteOwner=req.headers.get('oai-authenticated-user-id');
 need(siteOwner&&siteOwner.length<=200,'Open your private Sites workspace to use the creative studio.',401);need(env.DB,'Creative storage is not connected.',503);
 need(typeof input.packId==='string'&&input.packId.length<=100&&typeof input.contentHash==='string'&&input.contentHash.length<=100,'Choose an exact reviewed programme.');
 const pack=await resolve(input.packId,input.contentHash,req,env),row=await store.latest('learner_profiles',owner,'studio');
 let unit;try{unit=validateUnit(JSON.parse(row.payload).studio.units.find(u=>u.packId===input.packId&&u.contentHash===input.contentHash),pack)}catch{throw new StoreError('Create or reopen the saved programme before using creative learning.',409)}
 const db=env.DB,one=(sql,...v)=>db.prepare(sql).bind(...v).first(),all=async(sql,...v)=>(await db.prepare(sql).bind(...v).all()).results,run=(sql,...v)=>db.prepare(sql).bind(...v).run();
 const recordAssistance=async key=>{
  if(unit.support.some(s=>s.key===key&&s.ai))return;
  const state=JSON.parse(row.payload).studio,next=applyUnitAction(unit,pack,{type:'support-ai',key},now());
  await store.write('learner_profiles',owner,'studio',row.version,{studio:{...state,units:state.units.map(u=>u.id===unit.id?next:u)}},now());
 };
 const load=async id=>{need(typeof id==='string'&&id.length<=100,'Choose a saved request.');const j=await one(`SELECT * FROM workshop_jobs WHERE id=? AND owner=? AND ${KIND}=? AND ${LEARNER}=? AND ${PACK}=? AND ${HASH}=?`,id,siteOwner,'creative',owner,input.packId,input.contentHash);need(j,'Creative request not found.',404);return j;};
 const publicJob=async j=>{const p=JSON.parse(j.payload);return {id:j.id,kind:p.kind,activityKey:p.activityKey,question:p.question,status:j.status.replace(/^creative-/,''),created:j.created,updated:j.updated,error:j.error,local:!!p.local,draft:j.draft?JSON.parse(j.draft):null,draftHash:j.draft?await digest(j.draft):null}};
 const result=async extra=>noStore({jobs:await Promise.all((await all(`SELECT * FROM workshop_jobs WHERE owner=? AND ${KIND}=? AND ${LEARNER}=? AND ${PACK}=? AND ${HASH}=? ORDER BY created DESC LIMIT 40`,siteOwner,'creative',owner,input.packId,input.contentHash)).map(publicJob)),budget:await generationBudget(one,siteOwner,env,now()),audioConfigured:!!env.BUCKET,...extra});
 const reserve=async(payload,requestKey,requestHash,status)=>{
  const budget=await generationBudget(one,siteOwner,env,now());need(!budget.configurationError,budgetMessage(budget),503);need(budget.remaining>0,budgetMessage(budget),429);
  await run(`INSERT OR IGNORE INTO workshop_jobs(id,owner,request_key,request_hash,status,payload,created,updated) SELECT ?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM workshop_jobs WHERE owner=? AND created>? AND ${GENERATION_ROWS})<?`,payload.id,siteOwner,requestKey,requestHash,status,JSON.stringify(payload),now(),now(),siteOwner,now()-GENERATION_WINDOW_MS,budget.limit);
  const saved=await one('SELECT * FROM workshop_jobs WHERE owner=? AND request_key=?',siteOwner,requestKey);need(saved,budgetMessage(await generationBudget(one,siteOwner,env,now())),429);need(saved.request_hash===requestHash,'This request identity belongs to different input.',409);return saved;
 };
 if(req.method==='GET')return result();
 need(req.method==='POST','Creative route not found.',404);
 if(new URL(req.url).pathname.endsWith('/audio')){
  const j=await load(input.id);need(j.status==='creative-published'&&j.draft,'Review this exact script before creating narration.',409);need(input.draftHash===await digest(j.draft),'This script changed. Reload before creating narration.',409);
  const p=JSON.parse(j.payload);need(['podcast','cartoon'].includes(p.kind),'Only reviewed podcast and cartoon scripts can be narrated.');const draft=validateCreative(JSON.parse(j.draft),p);need(Number.isInteger(input.index)&&input.index>=0&&input.index<draft.segments.length,'Choose an episode segment.');need(keyOK(input.requestKey),'Use a valid narration request identity.');
  const requestKey='audio-'+input.requestKey,requestHash=await digest(JSON.stringify({owner,id:j.id,hash:input.draftHash,index:input.index}));
  return persistentAudio({env,siteOwner,owner,j,draft,index:input.index,requestKey,requestHash,reserve,speech,now});
 }
 if(input.action==='create'){
  need(keyOK(input.requestKey)&&CREATIVE_KINDS.includes(input.kind),'Choose a learning format and request identity.');need(input.kind!=='tutor'||typeof input.question==='string'&&input.question.trim().length>0&&input.question.length<=1200,'Write a short question or your reasoning.');
  const context=creativeContext(pack,unit,input.kind,input.activityKey),question=input.kind==='tutor'?input.question.trim():null,requestKey='creative-'+input.requestKey;
  const requestHash=await digest(JSON.stringify({owner,packId:input.packId,hash:input.contentHash,kind:input.kind,activityKey:['tutor','practice'].includes(input.kind)?input.activityKey:null,question}));
  const existing=await one('SELECT * FROM workshop_jobs WHERE owner=? AND request_key=?',siteOwner,requestKey);if(existing){need(existing.request_hash===requestHash,'This request identity belongs to different input.',409);return result({jobId:existing.id})}
  const id='creative-'+crypto.randomUUID(),payload={id,recordType:'creative',learnerOwner:owner,packId:input.packId,contentHash:input.contentHash,kind:input.kind,activityKey:['tutor','practice'].includes(input.kind)?input.activityKey:null,question,context};
  const fixed=input.kind==='tutor'?integrityResponse(question):null;
  if(fixed){await recordAssistance(input.activityKey);payload.local=true;payload.revisionOf={localScaffold:true};const reply={...fixed,sources:[]};await run('INSERT OR IGNORE INTO workshop_jobs(id,owner,request_key,request_hash,status,payload,draft,created,updated) VALUES(?,?,?,?,?,?,?,?,?)',id,siteOwner,requestKey,requestHash,'creative-review',JSON.stringify(payload),JSON.stringify(reply),now(),now());const saved=await one('SELECT * FROM workshop_jobs WHERE owner=? AND request_key=?',siteOwner,requestKey);need(saved?.request_hash===requestHash,'This request identity belongs to different input.',409);return result({jobId:saved.id})}
  need(env.META_API_KEY,'Muse Wonder is not connected.',503);
  if(input.kind==='tutor'){const previous=await all(`SELECT payload,draft FROM workshop_jobs WHERE owner=? AND ${KIND}=? AND ${LEARNER}=? AND ${PACK}=? AND ${HASH}=? AND status=? ORDER BY created DESC LIMIT 6`,siteOwner,'creative',owner,input.packId,input.contentHash,'creative-review');payload.history=previous.map(r=>({p:JSON.parse(r.payload),d:r.draft?JSON.parse(r.draft):null})).filter(x=>x.p.kind==='tutor'&&x.p.activityKey===input.activityKey&&x.d).slice(0,4).reverse().map(x=>({learner:x.p.question,tutor:x.d.message}));}
  const saved=await reserve(payload,requestKey,requestHash,'creative-queued');return result({jobId:saved.id});
 }
 let j=await load(input.id),p=JSON.parse(j.payload);
 const settle=async(out,from)=>{
  await finishCost(env,{id:j.id,siteOwner,usage:out.usage,status:out.status,now:now()});
  const content=out.content?validateCreative(out.content,p):null,status=content?'review':out.status;need(['review','running','failed','interrupted'].includes(status),'Invalid Muse result.',502);
  await run('UPDATE workshop_jobs SET status=?,draft=?,provider_id=?,error=?,updated=? WHERE id=? AND owner=? AND status=?','creative-'+status,content?JSON.stringify(content):null,out.providerId||j.provider_id,out.error||null,now(),j.id,siteOwner,from);
 };
 const fail=async(error,from)=>{await finishCost(env,{id:j.id,siteOwner,usage:error.usage,status:'unknown',now:now()});const uncertain=['TypeError','TimeoutError','AbortError'].includes(error.name);await run('UPDATE workshop_jobs SET status=?,error=?,provider_id=?,updated=? WHERE id=? AND owner=? AND status=?',uncertain?'creative-interrupted':'creative-failed',uncertain?'The submission acknowledgement was lost. No automatic repeat was sent.':error.status?error.message:'The request could not be completed. No automatic repeat was sent.',error.providerId||j.provider_id,now(),j.id,siteOwner,from)};
 if(input.action==='run'){
  if(j.status!=='creative-queued')return result();
  if(p.kind==='tutor')await recordAssistance(p.activityKey);
  const lock=await run('UPDATE workshop_jobs SET status=?,updated=? WHERE id=? AND owner=? AND status=?','creative-starting',now(),j.id,siteOwner,'creative-queued');if(!lock.meta.changes)return result();
  try{await startCost(env,{id:j.id,siteOwner,learnerOwner:owner,model:MODEL,now:now()});await settle(await provider(p,env.META_API_KEY),'creative-starting')}catch(e){await fail(e,'creative-starting')}return result();
 }
 if(input.action==='check'){
  if(j.status==='creative-starting'&&now()-j.updated>60000){await run('UPDATE workshop_jobs SET status=?,error=?,updated=? WHERE id=? AND owner=? AND status=?','creative-interrupted','The submission acknowledgement was lost. No automatic repeat was sent.',now(),j.id,siteOwner,j.status);return result()}
  if(['creative-running','creative-interrupted','creative-failed'].includes(j.status)&&j.provider_id)try{const out=await reader(j.provider_id,p,env.META_API_KEY);if(out.status==='running'&&now()-j.created>30*60*1000){out.status='interrupted';out.error='This request has taken more than 30 minutes. Automatic checking has stopped. Check this saved request later; no replacement was sent.';}await settle(out,j.status)}catch(e){if([410,422].includes(e.status))await fail(e,j.status);else throw e}return result();
 }
 need(p.kind!=='tutor'&&!p.local,'Tutor replies cannot be edited or approved as reviewed content.');need(j.draft&&input.draftHash===await digest(j.draft),'The script changed. Reload before making this change.',409);
 if(input.action==='edit'){
  need(j.status==='creative-review','Reopen the reviewed script before editing.',409);const draft=validateCreative(input.draft,p);const saved=await run('UPDATE workshop_jobs SET draft=?,updated=? WHERE id=? AND owner=? AND status=? AND draft=?',JSON.stringify(draft),now(),j.id,siteOwner,j.status,j.draft);need(saved.meta.changes===1,'Another window saved this script first. Reload before changing it.',409);return result();
 }
 if(input.action==='review'||input.action==='reopen'){
  const review=input.action==='review';need(j.status===(review?'creative-review':'creative-published'),'This script is no longer in that state.',409);need(!review||input.confirmed===true,'Check the exact script before approval.');validateCreative(JSON.parse(j.draft),p);
  const saved=await run('UPDATE workshop_jobs SET status=?,updated=? WHERE id=? AND owner=? AND status=? AND draft=?',review?'creative-published':'creative-review',now(),j.id,siteOwner,j.status,j.draft);need(saved.meta.changes===1,'Another window changed this script first.',409);return result();
 }
 throw new StoreError('Creative route not found.',404);
}
