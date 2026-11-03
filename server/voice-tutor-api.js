import {readJSON,noStore} from './ncb-auth.js';
import {need,sqlDB,parse} from './data-control.js';
import {digest} from './content-service.js';
import {validateUnit} from '../src/studio/programme.js';
import {voiceDuration} from '../src/studio/voice-format.js';
import {creativePermissions} from './tutor-access.js';
import {transcribeFile,binaryDigest} from './knowledge-import.js';
import {generationBudget,GENERATION_ROWS,GENERATION_WINDOW_MS,budgetMessage} from './workshop-budget.js';
import {startCost,finishCost} from './cost-ledger.js';
export async function voiceTutorAPI(req,env,{owner,siteOwner,store,resolve,access,now=()=>Date.now(),transcribe=transcribeFile}){
 need(creativePermissions(env,access).canTutor,'Ask your organiser to enable tutor conversations in Welcome.',403);
 need(req.method==='POST','Voice input route not found.',404);
 const input=await readJSON(req,2600000),db=sqlDB(env.DB);
 need(input.permitted===true,'Confirm permission to send this recording to Fish Audio.');
 need(typeof input.requestKey==='string'&&/^[a-z0-9-]{1,80}$/.test(input.requestKey),'Use a valid voice request identity.');
 const pack=await resolve(input.packId,input.contentHash,req,env),row=await store.latest('learner_profiles',owner,'studio');
 let unit;try{unit=validateUnit(parse(row?.payload).studio.units.find(u=>u.packId===input.packId&&u.contentHash===input.contentHash),pack)}catch{need(false,'Reopen your saved programme before using voice input.',409)}
 need(unit.activityKeys.includes(input.activityKey),'Choose an activity in this programme.');
 need(typeof input.base64==='string'&&input.base64.length<=2560060&&/^[A-Za-z0-9+/]+={0,2}$/.test(input.base64),'Choose a short voice recording.');
 let bytes,seconds;try{bytes=Uint8Array.from(atob(input.base64),c=>c.charCodeAt(0));seconds=voiceDuration(bytes)}catch(e){need(false,e.message)}
 const p={recordType:'knowledge',kind:'transcript',voiceTutor:true,learnerOwner:owner,packId:input.packId,contentHash:input.contentHash,activityKey:input.activityKey,filename:'Tutor voice question.wav',fileHash:await binaryDigest(bytes),bytes:bytes.length,seconds};
 const hash=await digest(JSON.stringify(p)),key='tutor-input-'+input.requestKey;
 const result=j=>noStore({id:j.id,status:j.status.replace(/^knowledge-/,''),transcript:parse(j.draft).text||'',error:j.error||null});
 const prior=await db.one('SELECT * FROM workshop_jobs WHERE owner=? AND request_key=?',siteOwner,key);
 if(prior){need(prior.request_hash===hash,'This request identity belongs to another recording.',409);if(prior.status==='knowledge-starting'&&now()-prior.updated>4*60000){await db.run('UPDATE workshop_jobs SET status=?,error=?,updated=? WHERE id=? AND status=?','knowledge-interrupted','The transcription result was not confirmed. No replacement was sent.',now(),prior.id,'knowledge-starting');return result(await db.one('SELECT * FROM workshop_jobs WHERE id=?',prior.id))}return result(prior)}
 need(env.FISH_AUDIO_API_KEY,'Voice transcription is not connected. You can type your question.',503);
 const budget=await generationBudget(db.one,siteOwner,env,now());need(!budget.configurationError,budgetMessage(budget),503);need(budget.remaining>0,budgetMessage(budget),429);
 const id='knowledge-'+crypto.randomUUID();
 await db.run(`INSERT OR IGNORE INTO workshop_jobs(id,owner,request_key,request_hash,status,payload,created,updated) SELECT ?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM workshop_jobs WHERE owner=? AND created>? AND ${GENERATION_ROWS})<?`,id,siteOwner,key,hash,'knowledge-starting',JSON.stringify(p),now(),now(),siteOwner,now()-GENERATION_WINDOW_MS,budget.limit);
 const j=await db.one('SELECT * FROM workshop_jobs WHERE owner=? AND request_key=?',siteOwner,key);need(j&&j.request_hash===hash,'The request allowance or identity changed. Refresh before continuing.',409);if(j.id!==id)return result(j);
 try{
  await startCost(env,{id,siteOwner,learnerOwner:owner,model:'transcribe-1-pro',request:{seconds},now:now()});
  const out=await transcribe(bytes,{filename:'tutor-question.wav'},env);
  await finishCost(env,{id,siteOwner,usage:{seconds:out.duration,inputBytes:bytes.length},now:now()});
  need(typeof out.text==='string'&&out.text.trim()&&out.text.length<=1200,'The recording did not produce a short question. Please type or record a shorter question.',422);
  await db.run('UPDATE workshop_jobs SET status=?,draft=?,updated=? WHERE id=? AND owner=? AND status=?','knowledge-review',JSON.stringify({text:out.text,duration:seconds,language:out.language||null}),now(),id,siteOwner,'knowledge-starting');
 }catch(e){await finishCost(env,{id,siteOwner,status:'unknown',now:now()});await db.run('UPDATE workshop_jobs SET status=?,error=?,updated=? WHERE id=? AND owner=? AND status=?','knowledge-interrupted',e.status?e.message:'The transcription result was not confirmed. No automatic replacement was sent. You can type your question.',now(),id,siteOwner,'knowledge-starting')}
 return result(await db.one('SELECT * FROM workshop_jobs WHERE id=? AND owner=?',id,siteOwner));
}
