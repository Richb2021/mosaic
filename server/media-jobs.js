import {readJSON,noStore} from './ncb-auth.js';
import {sqlDB,parse,need,DAY,readControls,withDataGuard,auditEvent} from './data-control.js';
import {digest} from './content-service.js';
import {validateCreative} from '../src/studio/creative-content.js';
import {creativeAPI} from './creative-api.js';
import {canonicalPack} from './learning-api.js';
import {NCBStore} from './ncb-store.js';
import {requireAdmission} from './pilot-access.js';
const RECORD='media-render',LEASE=15*60000;
const publicJob=j=>{const p=parse(j.payload);return {id:j.id,status:j.status.slice(6),format:p.format,style:p.style,edition:p.edition,done:p.done||0,total:p.total,assetId:p.assetId||null,error:j.error||null,created:j.created,updated:j.updated}};
async function scriptFor(db,siteOwner,owner,id,hash,env,now){const j=await db.one('SELECT * FROM workshop_jobs WHERE id=? AND owner=?',id,siteOwner),p=parse(j?.payload);need(j?.status==='creative-published'&&p.recordType==='creative'&&p.learnerOwner===owner&&['podcast','cartoon'].includes(p.kind)&&await digest(j.draft)===hash,'The approved script changed or is unavailable.',409);const {controls}=await readControls(env,siteOwner,owner,now());const days=parse(controls.learner.policy).creativeDays||0;need(!days||j.updated+days*DAY>now(),'This script expired. Prepare a new reviewed script.',410);return {j,script:validateCreative(parse(j.draft),p)}}
export async function mediaJobsAPI(req,env,{owner,principal,siteOwner,access,now=()=>Date.now()}){
 const db=sqlDB(env.DB),input=req.method==='GET'?Object.fromEntries(new URL(req.url).searchParams):await readJSON(req,4000);
 need(access.canAuthor&&access.ageBand==='18plus','An adult author prepares recordings.',403);
 if(req.method==='GET'){const rows=await db.all("SELECT * FROM workshop_jobs WHERE owner=? AND json_extract(payload,'$.recordType')=? AND json_extract(payload,'$.learnerOwner')=? AND json_extract(payload,'$.scriptId')=? ORDER BY created DESC LIMIT 10",siteOwner,RECORD,owner,input.scriptId||'');return noStore({jobs:rows.map(publicJob),workerEnabled:env.MEDIA_WORKER_ENABLED==='true'})}
 need(req.method==='POST','Media job route not found.',404);
 if(input.action==='create'){
  need(env.MEDIA_WORKER_ENABLED==='true','Background media preparation is not connected.',503);
  const {script}=await scriptFor(db,siteOwner,owner,input.scriptId,input.scriptHash,env,now),format=input.format||'mp3',style=input.style||'anime',edition=input.edition??0;
  need(['mp3','mp4'].includes(format)&&['anime','paper','original'].includes(style)&&[0,1,2].includes(edition),'Choose a supported media format.');need(format!=='mp4'||script.kind==='cartoon','Video requires a cartoon script.');
  const state=await readControls(env,siteOwner,owner,now()),id='render-'+await digest(JSON.stringify([siteOwner,owner,input.scriptId,input.scriptHash,format,style,edition,state.epoch,'renderer-v1'])),prior=await db.one('SELECT * FROM workshop_jobs WHERE id=?',id);
  if(prior)return noStore({job:publicJob(prior)});
  const p={id,recordType:RECORD,revisionOf:{freeRender:true},learnerOwner:owner,principal,scriptId:input.scriptId,scriptHash:input.scriptHash,format,style,edition,epoch:state.epoch,total:script.segments.length,done:0};
  const r=await db.run("INSERT OR IGNORE INTO workshop_jobs(id,owner,request_key,request_hash,status,payload,created,updated) SELECT ?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM workshop_jobs WHERE owner=? AND json_extract(payload,'$.recordType')=? AND status IN ('media-queued','media-running'))<8",id,siteOwner,id,id,'media-queued',JSON.stringify(p),now(),now(),siteOwner,RECORD);need(r.meta.changes===1,'Eight media jobs are already waiting. Finish or cancel one before adding another.',429);
  return noStore({job:publicJob(await db.one('SELECT * FROM workshop_jobs WHERE id=?',id))});
 }
 const j=await db.one("SELECT * FROM workshop_jobs WHERE id=? AND owner=? AND json_extract(payload,'$.recordType')=? AND json_extract(payload,'$.learnerOwner')=?",input.id,siteOwner,RECORD,owner);need(j,'Media job not found.',404);
 if(input.action==='cancel'){await db.run("UPDATE workshop_jobs SET status='media-cancelled',updated=? WHERE id=? AND status IN ('media-queued','media-running','media-failed')",now(),j.id);return noStore({cancelled:true})}
 if(input.action==='retry'){need(['media-failed','media-cancelled'].includes(j.status),'This job is not waiting for retry.',409);const p=parse(j.payload);await scriptFor(db,siteOwner,owner,p.scriptId,p.scriptHash,env,now);const state=await readControls(env,siteOwner,owner,now());p.epoch=state.epoch;delete p.token;delete p.until;const changed=await db.run("UPDATE workshop_jobs SET status=?,payload=?,error=NULL,updated=? WHERE id=? AND status=? AND (SELECT COUNT(*) FROM workshop_jobs WHERE owner=? AND json_extract(payload,'$.recordType')=? AND status IN ('media-queued','media-running'))<8",'media-queued',JSON.stringify(p),now(),j.id,j.status,siteOwner,RECORD);need(changed.meta.changes===1,'The queue is full or this job changed. Refresh before retrying.',409);return noStore({queued:true})}
 need(false,'Unknown media action.');
}
export async function mediaWorkerAPI(req,env,{now=()=>Date.now(),store=new NCBStore(env),speech,resolve=canonicalPack}={}){try{
 need(env.MAINTENANCE_SECRET?.length>=32&&await digest(req.headers.get('Authorization')||'')===await digest('Bearer '+env.MAINTENANCE_SECRET)&&req.headers.get('X-Mosaic-Maintenance')==='media-v1','Media worker authorization required.',403);
 need(!req.headers.get('Origin')||req.headers.get('Origin')===new URL(req.url).origin,'Cross-origin worker request refused.',403);
 const db=sqlDB(env.DB),url=new URL(req.url),upload=url.searchParams.get('action')==='complete',input=upload?Object.fromEntries(url.searchParams):await readJSON(req,4000);need(req.method==='POST','Use a worker POST.');
 await db.run("INSERT INTO data_controls(scope,policy,updated) VALUES('maintenance:media','{}',?) ON CONFLICT(scope) DO UPDATE SET updated=excluded.updated",now());
 if(input.action==='claim'){
  const j=await db.one("SELECT * FROM workshop_jobs WHERE json_extract(payload,'$.recordType')=? AND (status='media-queued' OR (status='media-running' AND json_extract(payload,'$.until')<?)) ORDER BY created LIMIT 1",RECORD,now());if(!j)return noStore({job:null});
  const p={...parse(j.payload),token:crypto.randomUUID(),until:now()+LEASE};const r=await db.run('UPDATE workshop_jobs SET status=?,payload=?,updated=? WHERE id=? AND payload=? AND status=?','media-running',JSON.stringify(p),now(),j.id,j.payload,j.status);if(!r.meta.changes)return noStore({job:null});
  try{const access=await requireAdmission(env,p.principal,{store,onboarding:true,storageOwner:p.learnerOwner});need(access.canAuthor&&access.ageBand==='18plus','Author access changed.',403);const state=await readControls(env,j.owner,p.learnerOwner,now());need(state.epoch===p.epoch&&!Object.values(state.controls).some(c=>c.operation),'Media job expired after a data change.',409);const {script}=await scriptFor(db,j.owner,p.learnerOwner,p.scriptId,p.scriptHash,env,now);return noStore({job:{...publicJob({...j,payload:JSON.stringify(p),status:'media-running'}),token:p.token,script}})}catch{await db.run('UPDATE workshop_jobs SET status=?,error=?,updated=? WHERE id=? AND payload=?','media-failed','Source, account or retention settings changed. Review the saved job before retrying.',now(),j.id,JSON.stringify(p));return noStore({job:null,attention:true})}
 }
 need(typeof input.id==='string'&&typeof input.token==='string','Choose a claimed job.');const j=await db.one('SELECT * FROM workshop_jobs WHERE id=?',input.id),p=parse(j?.payload);
 const active=async()=>{const r=await db.one('SELECT * FROM workshop_jobs WHERE id=?',input.id),v=parse(r?.payload);need(r?.status==='media-running'&&v.token===input.token&&v.until>now(),'The job lease expired or was cancelled.',409);return r};
 await active();need(p.recordType===RECORD,'Invalid media record.');
 const access=await requireAdmission(env,p.principal,{store,onboarding:true,storageOwner:p.learnerOwner});need(access.canAuthor&&access.ageBand==='18plus','Author access changed.',403);
 const guard=new Request(req.url,{method:'POST',headers:{'X-Mosaic-Data-Epoch':p.epoch}});
 return await withDataGuard(guard,env,{owner:p.learnerOwner,siteOwner:j.owner,now},async()=>{
  const {j:scriptJob,script}=await scriptFor(db,j.owner,p.learnerOwner,p.scriptId,p.scriptHash,env,now);
  if(input.action==='renew'){const r=await active(),next={...parse(r.payload),until:now()+LEASE};await db.run('UPDATE workshop_jobs SET payload=?,updated=? WHERE id=? AND payload=?',JSON.stringify(next),now(),j.id,r.payload);return noStore({renewed:true})}
  if(input.action==='audio'){
   need(Number.isInteger(input.index)&&input.index>=0&&input.index<script.segments.length,'Choose an episode segment.');
   const sp=parse(scriptJob.payload),body={packId:sp.packId,contentHash:sp.contentHash,id:scriptJob.id,draftHash:p.scriptHash,index:input.index,requestKey:(await digest(j.id+':'+input.index)).slice(0,64)};
   const audio=await creativeAPI(new Request(new URL('/api/learning/creative/audio',req.url),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),env,{store,owner:p.learnerOwner,siteOwner:j.owner,resolve:(id,hash,r,e)=>resolve(id,hash,r,e,j.owner,p.learnerOwner),now,...(speech?{speech}:{})});
   const r=await active(),next={...parse(r.payload),done:Math.max(parse(r.payload).done||0,input.index+1),until:now()+LEASE};await db.run('UPDATE workshop_jobs SET payload=?,updated=? WHERE id=? AND payload=?',JSON.stringify(next),now(),j.id,r.payload);return audio;
  }
  if(input.action==='fail'){await db.run('UPDATE workshop_jobs SET status=?,error=?,updated=? WHERE id=? AND status=? AND json_extract(payload,\'$.token\')=?','media-failed','Preparation stopped. Retry reuses saved narration; unresolved voice requests need attention in Your data.',now(),j.id,'media-running',input.token);return noStore({failed:true})}
  need(input.action==='complete','Unknown worker action.');need(env.BUCKET,'Media storage unavailable.',503);
  const max=64*1024*1024;need(Number(req.headers.get('content-length'))<=max,'Rendered file too large.',413);
  const reader=req.body.getReader(),chunks=[];let size=0;for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>max){await reader.cancel();need(false,'Rendered file too large.',413)}chunks.push(value)}
  const bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length}need(size>12,'Rendered file is empty.');
  need(p.format==='mp4'?String.fromCharCode(...bytes.slice(4,8))==='ftyp':(bytes[0]===73&&bytes[1]===68&&bytes[2]===51)||(bytes[0]===255&&(bytes[1]&224)===224),'Unexpected rendered file type.');
  await active();const assetId=await digest(j.id+':'+crypto.randomUUID()),key='rendered/'+assetId+'.'+p.format,type=p.format==='mp4'?'video/mp4':'audio/mpeg';
  // Attempt-specific keys mean a losing completion can only remove its own bytes.
  await db.run('INSERT INTO media_assets(id,site_owner,learner_owner,script_id,script_hash,segment,object_key,status,bytes,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?)',assetId,j.owner,p.learnerOwner,p.scriptId,p.scriptHash,p.format==='mp4'?-1:-2,key,'preparing',size,now(),now());
  try{await env.BUCKET.put(key,bytes,{httpMetadata:{contentType:type}});await active();need((await env.BUCKET.head(key))?.size===size,'Rendered file verification failed.',503);
   await db.run('INSERT INTO media_assets(id,site_owner,learner_owner,script_id,script_hash,segment,object_key,status,bytes,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,bytes=excluded.bytes,updated=excluded.updated',assetId,j.owner,p.learnerOwner,p.scriptId,p.scriptHash,p.format==='mp4'?-1:-2,key,'ready',size,now(),now());
   const r=await active(),next={...parse(r.payload),assetId,done:script.segments.length};delete next.token;delete next.until;const saved=await db.run('UPDATE workshop_jobs SET status=?,payload=?,updated=? WHERE id=? AND payload=? AND status=?','media-complete',JSON.stringify(next),now(),j.id,r.payload,'media-running');need(saved.meta.changes===1,'Job changed before completion.',409);
  }catch(e){await env.BUCKET.delete(key);await db.run('DELETE FROM media_assets WHERE id=?',assetId);throw e}
  await auditEvent(env,'learner:'+p.learnerOwner,'media-prepared',{format:p.format,bytes:size},now());return noStore({complete:true,assetId});
 });
}catch(e){return noStore({error:e.status?e.message:'Media preparation is temporarily unavailable.'},e.status||503)}}
export async function mediaHealth(env,now=Date.now()){
 const db=sqlDB(env.DB),rows=await db.all("SELECT status,COUNT(*) AS count,MIN(created) AS oldest FROM workshop_jobs WHERE json_extract(payload,'$.recordType')=? GROUP BY status",RECORD),worker=await db.one("SELECT updated FROM data_controls WHERE scope='maintenance:media'"),retention=await db.one("SELECT created,detail FROM data_events WHERE scope='maintenance:retention' ORDER BY created DESC LIMIT 1");
 const stale=!worker||now-worker.updated>5*60000;const attention=env.MEDIA_WORKER_ENABLED==='true'&&stale||rows.some(r=>r.status==='media-failed'&&r.count>0)||!retention||now-retention.created>26*60*60000;
 return {attention,workerEnabled:env.MEDIA_WORKER_ENABLED==='true',lastHeartbeat:worker?.updated||null,stale:!worker||now-worker.updated>5*60000,queue:rows,retention:retention?{at:retention.created,...parse(retention.detail)}:null};
}
