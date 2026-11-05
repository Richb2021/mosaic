import {digest} from './content-service.js';
import {NCBStore} from './ncb-store.js';
import {noStore} from './ncb-auth.js';
import {need,sqlDB,parse,DAY,auditEvent} from './data-control.js';
import {enforceRetention,resumeDeletion} from './data-lifecycle.js';
import {continueClosure} from './account-closure.js';

export async function registerRetentionSubject(env,{siteOwner,owner,now=Date.now()}){
 if(!env.DB||!siteOwner)return;need(siteOwner.length<=200,'Invalid workspace identity.',400);
 const db=sqlDB(env.DB);
 await sqlDB(env.DB).run('INSERT INTO retention_subjects(id,site_owner,learner_owner,updated) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET updated=excluded.updated',await digest(siteOwner+':'+owner),siteOwner,owner,now);
}
export async function maintenanceStatus(env){
 const db=sqlDB(env.DB),last=await db.one('SELECT created,detail FROM data_events WHERE scope=? AND action=? ORDER BY created DESC LIMIT 1','maintenance:retention','background-retention');
 return {enabled:env.RETENTION_BACKGROUND_ENABLED==='true',lastRun:last?{at:last.created,...parse(last.detail)}:null};
}
// This writer requires a dedicated server credential independently of Site audience.
// It has no subject, policy or delete-ID parameters and never accepts caller identity.
// Verified learner sessions alone register subjects; the caller cannot select deletion targets.
export async function maintenanceAPI(req,env,{store=new NCBStore(env),now=()=>Date.now(),removeProvider}={}){try{
 need(env.RETENTION_BACKGROUND_ENABLED==='true'&&env.DB,'Background retention is not enabled.',503);
 need(typeof env.MAINTENANCE_SECRET==='string'&&env.MAINTENANCE_SECRET.length>=32,'Maintenance authentication is not configured.',503);
    need(await digest(req.headers.get('Authorization')||'')===await digest('Bearer '+env.MAINTENANCE_SECRET),'Maintenance authorization required.',403);
    need(req.headers.get('X-Mosaic-Maintenance')==='retention-v1','Maintenance request required.',403);
 const origin=req.headers.get('Origin');need(!origin||origin===new URL(req.url).origin,'Cross-origin maintenance is not permitted.',403);
 if(req.method==='GET')return noStore(await maintenanceStatus(env));
 need(req.method==='POST','Maintenance route not found.',404);
 need(!req.body||await req.text()===''||req.headers.get('content-length')==='0','Maintenance accepts no content or deletion instructions.');
 const db=sqlDB(env.DB),scope='maintenance:retention',start=now(),runId=crypto.randomUUID();
 await db.run('INSERT OR IGNORE INTO data_controls(scope,updated) VALUES(?,?)',scope,start);
 const lock=await db.run('UPDATE data_controls SET operation=?,checked_ms=?,updated=? WHERE scope=? AND (operation IS NULL OR checked_ms<?)',runId,start+15*60000,start,scope,start);
 need(lock.meta.changes===1,'A retention pass is already running. Read its saved status later.',409);
 const previous=parse((await db.one('SELECT policy FROM data_controls WHERE scope=?',scope))?.policy);
 const cutoff=previous.more&&Number.isSafeInteger(previous.scanBefore)?previous.scanBefore:start;
 await db.run('UPDATE data_controls SET policy=? WHERE scope=? AND operation=?',JSON.stringify({scanBefore:cutoff,more:true}),scope,runId);
 const result={runId,status:'complete',processed:0,failed:0,pending:0,errors:[],more:false};
 try{
  // Oldest checked first: every registered learner progresses across bounded runs.
  const subjects=await db.all('SELECT * FROM retention_subjects WHERE checked<? ORDER BY checked,id LIMIT 5',cutoff);
  for(const subject of subjects){const ctx={owner:subject.learner_owner,siteOwner:subject.site_owner,store,now,...(removeProvider?{removeProvider}:{})};
   try{
    const ops=await db.all("SELECT * FROM data_operations WHERE site_owner=? AND learner_owner=? AND status IN ('preparing','cleanup-pending','provider-pending') ORDER BY created LIMIT 3",ctx.siteOwner,ctx.owner);
    for(const op of ops)await resumeDeletion(env,ctx,op);
    const closure=await continueClosure(env,ctx);
    if(closure.status==='cleaning')result.pending++;
    if(closure.status==='none')await enforceRetention(env,ctx,{force:true,strict:true});
   }catch(e){result.failed++;const code=e.status===409?(e.message?.startsWith('Another learner')?'shared-source-in-use':'busy-or-data-changed'):e.status===503?'storage-or-provider-unavailable':'cleanup-needs-review';result.errors.push({code});}
   const pending=await db.one("SELECT COUNT(*) AS n FROM data_operations WHERE site_owner=? AND learner_owner=? AND status IN ('preparing','cleanup-pending','provider-pending')",ctx.siteOwner,ctx.owner);result.pending+=pending.n;
   await db.run('UPDATE retention_subjects SET checked=? WHERE id=?',cutoff,subject.id);result.processed++;
  }
  result.more=!!(await db.one('SELECT id FROM retention_subjects WHERE checked<? LIMIT 1',cutoff));
  await db.run('UPDATE data_controls SET policy=? WHERE scope=? AND operation=?',JSON.stringify({scanBefore:cutoff,more:result.more}),scope,runId);
  await db.run('DELETE FROM cost_receipts WHERE created<?',start-30*DAY);
  await db.run('DELETE FROM data_events WHERE created<?',start-30*DAY);
  await db.run("DELETE FROM data_operations WHERE status IN ('complete','cancelled') AND updated<?",start-30*DAY);
  await db.run('DELETE FROM data_leases WHERE expires<=?',start);
  await db.run("DELETE FROM data_controls WHERE scope LIKE 'pilot-invite:%' AND json_extract(policy,'$.expires')<?",start);
  await db.run("DELETE FROM data_controls WHERE scope LIKE 'pilot-member:%' AND json_extract(policy,'$.status')='closed' AND updated<?",start-30*DAY);
  await db.run("DELETE FROM data_controls WHERE scope LIKE 'pilot-close:%' AND json_extract(policy,'$.status')='complete' AND updated<?",start-30*DAY);
  await db.run("DELETE FROM data_controls WHERE scope LIKE 'allowance:%' AND json_extract(policy,'$.expires')<?",start-30*DAY);
  await db.run("DELETE FROM data_controls WHERE scope LIKE 'allowance-request:%' AND json_extract(policy,'$.status')!='open' AND updated<?",start-30*DAY);
  result.status=result.failed||result.pending?'attention':'complete';
  await auditEvent(env,scope,'background-retention',result,now());
 }finally{await db.run('UPDATE data_controls SET operation=NULL WHERE scope=? AND operation=?',scope,runId);}
 return noStore(result);
}catch(e){return noStore({error:e.status?e.message:'Retention did not finish. Check its saved status; no replacement generation was sent.'},e.status||503)}}
