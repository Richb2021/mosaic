import {costSummary} from './cost-ledger.js';
import {maintenanceStatus} from './background-retention.js';
import {readJSON,noStore} from './ncb-auth.js';
import {digest} from './content-service.js';
import {need,sqlDB,readControls,auditEvent,parse,DAY} from './data-control.js';

const K="json_extract(CASE WHEN json_valid(payload) THEN payload ELSE '{}' END,'$.recordType')";
const L="json_extract(CASE WHEN json_valid(payload) THEN payload ELSE '{}' END,'$.learnerOwner')";
const choices=new Set([0,7,30,90,365]);
const sorted=values=>[...new Set(values)].sort();
const ownedJobs=(db,siteOwner)=>db.all("SELECT * FROM workshop_jobs WHERE owner=? AND status!='usage-only' ORDER BY id",siteOwner);
const counts=plan=>({recordings:plan.assets.length,creative:plan.creativeCount,chapters:plan.chapterCount,resources:plan.resources.length,learnerRows:plan.profiles.length+plan.saves.length,providerResponses:plan.providers.length});
export async function deletionPlan(env,{owner,siteOwner,store,mode,id,now=Date.now()}){
 const db=sqlDB(env.DB),{controls}=await readControls(env,siteOwner,owner,now),lp=parse(controls.learner.policy),wp=parse(controls.workspace.policy);
 const jobs=await ownedJobs(db,siteOwner),resources=await db.all('SELECT * FROM workshop_resources WHERE owner=? ORDER BY id',siteOwner),assets=await db.all('SELECT * FROM media_assets WHERE site_owner=? ORDER BY id',siteOwner);
 let selected=[],sourceIDs=[],assetIDs=[],profiles=[],saves=[];
 const expired=(stamp,days)=>days>0&&stamp+days*DAY<=now;
 if(mode==='episode'){const j=jobs.find(j=>j.id===id&&parse(j.payload).recordType==='creative'&&parse(j.payload).learnerOwner===owner);need(j,'Episode not found.',404);selected=[j];}
 else if(mode==='media'){assetIDs=assets.filter(a=>a.learner_owner===owner&&(id==='all'||a.id===id)).map(a=>a.id);need(id==='all'||assetIDs.length,'Recording not found.',404);}
 else if(mode==='learner'){
  selected=jobs.filter(j=>parse(j.payload).learnerOwner===owner);
  profiles=(await store.allRows('learner_profiles',owner)).map(r=>r.id);saves=(await store.allRows('learner_saves',owner)).map(r=>r.id);
  assetIDs=assets.filter(a=>a.learner_owner===owner).map(a=>a.id);
 }else if(mode==='resource'||mode==='workspace'){
  sourceIDs=resources.filter(r=>mode==='workspace'||r.id===id).map(r=>r.id);need(mode==='workspace'||sourceIDs.length,'Source not found.',404);
  selected=mode==='workspace'?jobs:jobs.filter(j=>parse(j.payload).resourceVersions?.some(v=>sourceIDs.includes(v.id)));
 }else if(mode==='expired'){
  assetIDs=assets.filter(a=>a.learner_owner===owner&&expired(a.created,lp.mediaDays)).map(a=>a.id);
  sourceIDs=resources.filter(r=>expired(r.created,wp.resourceDays)).map(r=>r.id);
  selected=jobs.filter(j=>parse(j.payload).recordType==='creative'&&parse(j.payload).learnerOwner===owner&&expired(j.updated,lp.creativeDays)||parse(j.payload).resourceVersions?.some(v=>sourceIDs.includes(v.id)));
  if(lp.progressDays)for(const table of ['learner_profiles','learner_saves']){const rows=await store.allRows(table,owner),latest=new Map();for(const r of rows)latest.set(r.slot_key,Math.max(latest.get(r.slot_key)||0,Number(r.updated_ms)));const ids=rows.filter(r=>expired(latest.get(r.slot_key),lp.progressDays)).map(r=>r.id);if(table==='learner_profiles')profiles=ids;else saves=ids;}
 }else throw Object.assign(Error('Choose a supported data action.'),{status:400});
 const packs=new Set(selected.filter(j=>!parse(j.payload).recordType).flatMap(j=>{const id=parse(j.payload).chapterId;return id?[id,'rpg-'+id]:[]}));
 const derived=jobs.filter(j=>parse(j.payload).recordType==='creative'&&packs.has(parse(j.payload).packId));
 need(![...selected,...derived].some(j=>parse(j.payload).learnerOwner&&parse(j.payload).learnerOwner!==owner),'Another learner has work derived from this source. They must remove their episodes before this source can be deleted.',409);
 selected.push(...derived);
 const ids=new Set(selected.map(j=>j.id));selected.push(...jobs.filter(j=>parse(j.payload).recordType==='creative-audio'&&ids.has(parse(j.payload).scriptId)));
 selected=[...new Map(selected.map(j=>[j.id,j])).values()];
 assetIDs.push(...assets.filter(a=>selected.some(j=>j.id===a.script_id)).map(a=>a.id));
 const plan={mode,id:id||null,jobs:sorted(selected.map(j=>j.id)),resources:sorted(sourceIDs),assets:sorted(assetIDs),profiles:sorted(profiles),saves:sorted(saves),providers:sorted(selected.map(j=>j.provider_id).filter(Boolean)),creativeCount:selected.filter(j=>parse(j.payload).recordType==='creative').length,chapterCount:selected.filter(j=>!parse(j.payload).recordType).length};
 return {...plan,hash:await digest(JSON.stringify(plan)),counts:counts(plan)};
}
export async function deleteProviderResponse(id,env,fetcher=fetch){
 need(/^resp_[a-zA-Z0-9:_-]{1,195}$/.test(id),'Invalid stored provider response.');need(env.META_API_KEY,'Meta response cleanup is not connected.',503);
 const response=await fetcher('https://api.meta.ai/v1/responses/'+encodeURIComponent(id),{method:'DELETE',headers:{Authorization:'Bearer '+env.META_API_KEY},signal:AbortSignal.timeout(12000),redirect:'manual'});
 if([404,410].includes(response.status)){const error=await response.json().catch(()=>null);need(error?.error?.code==='response_not_found','Meta returned an ambiguous missing-response result. Local data is removed; provider cleanup needs retry or account verification.',503);return;}
 need(response.ok,'Meta response cleanup has not been confirmed. Retry it from Your data.',503);
 const data=await response.json().catch(()=>null);need(data?.deleted===true&&data.id===id,'Meta response deletion was not acknowledged. Retry it from Your data.',503);
}
async function executeOperation(env,{owner,siteOwner,store,op,now,removeProvider=deleteProviderResponse}){
 const db=sqlDB(env.DB);let plan=parse(op.plan);const save=()=>db.run('UPDATE data_operations SET plan=?,updated=? WHERE id=?',JSON.stringify(plan),now(),op.id);
 try{
  if(!plan.localDone){
   for(const id of plan.assets){const row=await db.one('SELECT * FROM media_assets WHERE id=? AND site_owner=?',id,siteOwner);if(!row)continue;need(env.BUCKET,'Private media storage is unavailable; cleanup will resume later.',503);await env.BUCKET.delete(row.object_key);need(!await env.BUCKET.head(row.object_key),'Recording removal has not been confirmed.',503);await db.run('DELETE FROM media_assets WHERE id=? AND site_owner=?',id,siteOwner);}
   if(plan.mode==='learner')await db.run('UPDATE cost_receipts SET learner_owner=NULL WHERE site_owner=? AND learner_owner=?',siteOwner,owner);
   await store.deleteRows('learner_profiles',owner,plan.profiles);await store.deleteRows('learner_saves',owner,plan.saves);
   for(const id of plan.jobs){const j=await db.one('SELECT * FROM workshop_jobs WHERE id=? AND owner=?',id,siteOwner);if(!j)continue;
    // Preserve only a content-free admission receipt until its 24h window ends.
    if(j.created>now()-DAY){const p=parse(j.payload),payload={recordType:'usage',...(p.revisionOf?{revisionOf:{deleted:true}}:{})};await db.run('UPDATE workshop_jobs SET request_key=?,request_hash=?,status=?,payload=?,draft=NULL,error=NULL,provider_id=NULL,updated=? WHERE id=? AND owner=?','deleted-'+id,'deleted','usage-only',JSON.stringify(payload),now(),id,siteOwner);}
    else await db.run('DELETE FROM workshop_jobs WHERE id=? AND owner=?',id,siteOwner);
   }
   for(const id of plan.resources)await db.run('DELETE FROM workshop_resources WHERE id=? AND owner=?',id,siteOwner);
   if(plan.profiles.length||plan.saves.length)await db.run('UPDATE data_controls SET reset_ms=?,reset_kind=? WHERE scope=?',now(),plan.mode==='learner'?'all':'expired',op.scope);
   plan.localDone=true;await save();
   await db.run('UPDATE data_controls SET operation=NULL,updated=? WHERE operation=?',now(),op.id);
   await auditEvent(env,op.scope,'deleted',plan.counts,now());
  }
  if(plan.localDone)await db.run('UPDATE data_controls SET operation=NULL,updated=? WHERE operation=?',now(),op.id);
  const pending=[];for(const id of plan.providers){try{await removeProvider(id,env)}catch{pending.push(id)}}plan.providers=pending;await save();
  const status=pending.length?'provider-pending':'complete';
  await db.run('UPDATE data_operations SET status=?,plan=?,updated=? WHERE id=?',status,JSON.stringify(status==='complete'?{counts:plan.counts,mode:plan.mode,localDone:true}:plan),now(),op.id);
  return {id:op.id,status,counts:plan.counts,localDone:true,providerPending:pending.length};
 }catch(e){await db.run('UPDATE data_operations SET status=?,updated=? WHERE id=?','cleanup-pending',now(),op.id);throw Object.assign(Error('Cleanup is saved but not finished. Open Your data and resume it; writes remain paused to protect the deletion.'),{status:503});}
}
async function lockOperation(env,ctx,op){
 const db=sqlDB(env.DB),state=await readControls(env,ctx.siteOwner,ctx.owner,ctx.now());
 const plan=parse(op.plan),targets=plan.resources?.length||plan.mode==='workspace'?[state.controls.workspace,state.controls.learner]:[state.controls.learner];
 for(const c of targets){
  if(c.operation===op.id)continue;
  const r=await db.run('UPDATE data_controls SET operation=?,updated=? WHERE scope=? AND operation IS NULL AND NOT EXISTS(SELECT 1 FROM data_leases WHERE scope=? AND expires>?)',op.id,ctx.now(),c.scope,c.scope,ctx.now());
  need(r.meta.changes===1,'A recording or save is still finishing. Wait a moment, then resume cleanup.',409);
 }
}
async function prepareOperation(env,ctx,op){
 const db=sqlDB(env.DB);await lockOperation(env,ctx,op);const plan=parse(op.plan);
 if(!plan.started){
  const fresh=await deletionPlan(env,{...ctx,mode:plan.mode,id:plan.id,now:ctx.now()});
  if(fresh.hash!==plan.hash){await db.run('UPDATE data_controls SET operation=NULL WHERE operation=?',op.id);await db.run('UPDATE data_operations SET status=?,plan=?,updated=? WHERE id=?','cancelled',JSON.stringify({mode:plan.mode,counts:plan.counts}),ctx.now(),op.id);throw Object.assign(Error('Your saved data changed. No deletion started. Preview the deletion again.'),{status:409});}
  await db.run('UPDATE data_controls SET epoch=epoch+1,updated=? WHERE operation=?',ctx.now(),op.id);
  op.plan=JSON.stringify({...fresh,started:true});await db.run('UPDATE data_operations SET plan=?,status=?,updated=? WHERE id=?',op.plan,'cleanup-pending',ctx.now(),op.id);
 }
 return op;
}
export async function startDeletion(env,ctx,plan){
 const {siteOwner,owner,now}=ctx,db=sqlDB(env.DB),state=await readControls(env,siteOwner,owner,now()),id='cleanup-'+crypto.randomUUID();
 // Persist the resumable intent before acquiring any lock: a crash can never
 // leave a scope pointing at a missing cleanup record.
 await db.run('INSERT INTO data_operations(id,site_owner,learner_owner,scope,status,plan,created,updated) VALUES(?,?,?,?,?,?,?,?)',id,siteOwner,owner,state.scopes.learner,'preparing',JSON.stringify(plan),now(),now());
 let op=await db.one('SELECT * FROM data_operations WHERE id=?',id);
 try{op=await prepareOperation(env,ctx,op);}catch(e){
  // Ordinary contention before deletion can be cancelled safely. A process
  // crash instead leaves the stored preparing intent available for resume.
  await db.run('UPDATE data_controls SET operation=NULL WHERE operation=?',id);await db.run('UPDATE data_operations SET status=?,updated=? WHERE id=?','cancelled',now(),id);throw e;
 }
 return executeOperation(env,{...ctx,op});
}
export async function resumeDeletion(env,ctx,op){return executeOperation(env,{...ctx,op:parse(op.plan).localDone?op:await prepareOperation(env,ctx,op)})}
export async function enforceRetention(env,ctx,{force=false,strict=false}={}){
 if(!env.DB||!ctx.siteOwner)return;
 const db=sqlDB(env.DB),state=await readControls(env,ctx.siteOwner,ctx.owner,ctx.now());
 await db.run('DELETE FROM data_leases WHERE expires<=?',ctx.now());
 await db.run('DELETE FROM cost_receipts WHERE site_owner=? AND created<?',ctx.siteOwner,ctx.now()-30*DAY);
 await db.run('DELETE FROM workshop_jobs WHERE owner=? AND status=? AND created<=?',ctx.siteOwner,'usage-only',ctx.now()-DAY);
 await db.run('DELETE FROM data_events WHERE scope IN (?,?) AND created<?',state.scopes.learner,state.scopes.workspace,ctx.now()-30*DAY);
 await db.run("DELETE FROM data_operations WHERE site_owner=? AND learner_owner=? AND status IN ('complete','cancelled') AND updated<?",ctx.siteOwner,ctx.owner,ctx.now()-30*DAY);
 if(Object.values(state.controls).some(c=>c.operation))return;
 if(!force&&Object.values(state.controls).every(c=>c.checked_ms>ctx.now()-3600000))return;
 const policies=Object.values(state.controls).map(c=>parse(c.policy));
 if(!policies.some(p=>Object.values(p).some(v=>v>0)))return;
 try{
  const plan=await deletionPlan(env,{...ctx,mode:'expired',now:ctx.now()});
  if(plan.assets.length&&!env.BUCKET){if(strict)need(false,'Private media storage is unavailable.',503);return;}
  if(plan.assets.length+plan.jobs.length+plan.resources.length+plan.profiles.length+plan.saves.length)await startDeletion(env,ctx,plan);
  await db.run('UPDATE data_controls SET checked_ms=? WHERE scope IN (?,?)',ctx.now(),state.scopes.learner,state.scopes.workspace);
 }catch(e){
  // Background maintenance cannot fail an unrelated read because another tab
  // is saving. Persisted cleanup failures are discoverable in Your data.
  if(strict||![409,503].includes(e.status))throw e;
 }
}
export async function dataAPI(req,env,{owner,siteOwner,store,now=()=>Date.now(),removeProvider=deleteProviderResponse}){
 need(siteOwner&&env.DB,'Open your private workspace to manage saved data.',401);
 const db=sqlDB(env.DB),ctx={owner,siteOwner,store,now,removeProvider},input=req.method==='GET'?{}:await readJSON(req,10000);
 let state=await readControls(env,siteOwner,owner,now());
 const inventory=async()=>{
  const [media,jobs,resources,ops,events]=await Promise.all([
   db.all('SELECT id,script_id,script_hash,segment,status,bytes,created FROM media_assets WHERE site_owner=? AND learner_owner=? ORDER BY created DESC',siteOwner,owner),
   db.all(`SELECT id,status,draft,created,updated,payload FROM workshop_jobs WHERE owner=? AND ${K}=? AND ${L}=? ORDER BY created DESC`,siteOwner,'creative',owner),
   db.all('SELECT id,title,status,created FROM workshop_resources WHERE owner=? ORDER BY created DESC',siteOwner),
   db.all("SELECT id,status,plan,created FROM data_operations WHERE site_owner=? AND (learner_owner=? OR id IN (SELECT operation FROM data_controls WHERE scope=?)) ORDER BY created DESC LIMIT 30",siteOwner,owner,state.scopes.workspace),
   db.all('SELECT action,detail,created FROM data_events WHERE scope IN (?,?) AND created>? ORDER BY created DESC LIMIT 30',state.scopes.learner,state.scopes.workspace,now()-30*DAY)
  ]);return {epoch:state.epoch,resetMs:state.controls.learner.reset_ms,resetKind:state.controls.learner.reset_kind,policy:{learner:parse(state.controls.learner.policy),workspace:parse(state.controls.workspace.policy)},media,jobs:jobs.map(j=>({id:j.id,title:parse(j.draft).title||'Tutor conversation',kind:parse(j.payload).kind,status:j.status,created:j.created,updated:j.updated})),resources,operations:ops.map(o=>({id:o.id,status:o.status,created:o.created,counts:parse(o.plan).counts,localDone:!!parse(o.plan).localDone})),events:events.map(e=>({...e,detail:parse(e.detail)})),storageConnected:!!env.BUCKET,costs:await costSummary(env,{siteOwner,learnerOwner:owner,now:now()}),maintenance:await maintenanceStatus(env)};
 };
 if(req.method==='GET'){await enforceRetention(env,ctx,{force:true});state=await readControls(env,siteOwner,owner,now());return noStore(await inventory());}
 need(req.method==='POST','Data action not found.',404);
 if(input.action==='resume'){
  const op=await db.one('SELECT * FROM data_operations WHERE id=? AND site_owner=? AND (learner_owner=? OR id IN (SELECT operation FROM data_controls WHERE scope=?))',input.id,siteOwner,owner,state.scopes.workspace);need(op,'Cleanup not found.',404);
  if(['complete','cancelled'].includes(op.status))return noStore({operation:{id:op.id,status:'complete',localDone:true}});
  const resumeCtx={...ctx,owner:op.learner_owner};return noStore({operation:await executeOperation(env,{...resumeCtx,op:parse(op.plan).localDone?op:await prepareOperation(env,resumeCtx,op)})});
 }
 need(!Object.values(state.controls).some(c=>c.operation),'Resume the saved cleanup first.',423);
 need(input.epoch===state.epoch,'Your data changed. Refresh this screen before continuing.',409);
 if(input.action==='preview'){const plan=await deletionPlan(env,{...ctx,mode:input.mode,id:input.id,now:now()});return noStore({preview:plan});}
 if(input.action==='delete'){
  need(input.confirmed===true&&typeof input.hash==='string','Review and confirm this deletion first.');const plan=await deletionPlan(env,{...ctx,mode:input.mode,id:input.id,now:now()});need(plan.hash===input.hash,'Data changed since the preview. Review it again.',409);return noStore({operation:await startDeletion(env,ctx,plan)});
 }
 if(input.action==='retention'){
  need(['learner','workspace'].includes(input.scope),'Choose a retention scope.');const fields=input.scope==='learner'?['mediaDays','creativeDays','progressDays']:['resourceDays'];need(input.policy&&Object.keys(input.policy).every(k=>fields.includes(k)),'Choose supported retention settings.');const policy=Object.fromEntries(fields.map(k=>{const value=input.policy[k]??0;need(choices.has(value),'Choose a supported retention period.');return [k,value]}));
  // Policy changes use the same exclusive guard as cleanup; no in-flight writes.
  const c=state.controls[input.scope],changed=await db.run('UPDATE data_controls SET policy=?,checked_ms=0,epoch=epoch+1,updated=? WHERE scope=? AND epoch=? AND operation IS NULL AND NOT EXISTS(SELECT 1 FROM data_leases WHERE scope=? AND expires>?)',JSON.stringify(policy),now(),c.scope,c.epoch,c.scope,now());need(changed.meta.changes===1,'A save or recording is still finishing. Retry the policy change later.',409);
  await auditEvent(env,c.scope,'retention-changed',policy,now());return noStore({saved:true});
 }
 if(input.action==='export'){
  const profiles=await store.allRows('learner_profiles',owner),saves=await store.allRows('learner_saves',owner),jobs=await ownedJobs(db,siteOwner),resources=await db.all('SELECT id,title,checksum,payload,status,created FROM workshop_resources WHERE owner=? ORDER BY id',siteOwner);
  const rows=await db.all('SELECT id,script_id,script_hash,segment,status,bytes,created FROM media_assets WHERE site_owner=? AND learner_owner=? ORDER BY id',siteOwner,owner);
  const safeRow=r=>({slot:r.slot_key,version:r.version,updated:Number(r.updated_ms),data:parse(r.payload)});
  const out={format:'mosaic-data-export',version:1,exportedAt:new Date(now()).toISOString(),scope:input.scope==='workspace'?'workspace':'learner',policy:input.scope==='workspace'?parse(state.controls.workspace.policy):parse(state.controls.learner.policy),...(input.scope==='workspace'?{resources:resources.map(r=>({...r,payload:parse(r.payload)})),chapters:jobs.filter(j=>!parse(j.payload).recordType).map(j=>({id:j.id,status:j.status,created:j.created,payload:parse(j.payload),draft:parse(j.draft)}))}:{profiles:profiles.map(safeRow),saves:saves.map(safeRow),creative:jobs.filter(j=>parse(j.payload).recordType==='creative'&&parse(j.payload).learnerOwner===owner).map(j=>({id:j.id,status:j.status,created:j.created,updated:j.updated,payload:parse(j.payload),draft:parse(j.draft)})),media:rows,costs:await costSummary(env,{siteOwner,learnerOwner:owner,now:now()})}),limitations:['Sign-in account credentials and provider or infrastructure backups are not part of this export.','Media bytes are included separately by the archive download; failed recordings have metadata only.']};
  need(JSON.stringify(out).length<24000000,'This data export exceeds 24 MB. Export a smaller workspace first.',413);await auditEvent(env,state.scopes[input.scope==='workspace'?'workspace':'learner'],'exported',{scope:out.scope},now());return noStore({export:out});
 }
 if(input.action==='download'){
  const asset=await db.one('SELECT * FROM media_assets WHERE id=? AND site_owner=? AND learner_owner=? AND status=?',input.id,siteOwner,owner,'ready');need(asset,'Saved recording not found.',404);const days=parse(state.controls.learner.policy).mediaDays||0;need(!days||asset.created+days*DAY>now(),'This recording has expired. Refresh Your data to clean it up.',410);
  need(env.BUCKET,'Private media storage is unavailable.',503);const object=await env.BUCKET.get(asset.object_key);need(object,'Saved recording is unavailable.',404);return new Response(object.body,{headers:{'Content-Type':'audio/mpeg','Cache-Control':'no-store','Content-Disposition':'attachment; filename="'+asset.id+'.mp3"','X-Content-Type-Options':'nosniff'}});
 }
 throw Object.assign(Error('Data action not found.'),{status:404});
}
