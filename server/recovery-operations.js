import {mediaHealth} from './media-jobs.js';
import {NCBStore} from './ncb-store.js';
import {need} from './data-control.js';
import {noStore} from './ncb-auth.js';

// Operator-only read surface. No restore, SQL input, identity or learner payload
// is accepted by the health route. Recovery exports require the same operator key.
export const RECOVERY_TABLES=Object.freeze(['workshop_resources','workshop_jobs','media_assets','data_controls','data_leases','data_operations','data_events','cost_receipts','retention_subjects']);
export async function operationsHealth(env,{now=Date.now(),store=new NCBStore(env)}={}){
 const checks={},issues=[];
 try{const h=await mediaHealth(env,now);checks.database=true;checks.mediaWorker=!h.workerEnabled||!h.stale;checks.mediaFailures=!h.queue.some(q=>q.status==='media-failed'&&q.count);checks.mediaQueue=!h.queue.some(q=>q.status==='media-queued'&&now-q.oldest>30*60000);checks.retention=!!h.retention&&h.retention.status==='complete'&&!h.retention.more&&now-h.retention.at<=26*60*60000;}catch{checks.database=false;}
 try{await store.latest('learner_profiles',env.PILOT_ADMIN_OWNER||'health-probe','profile');checks.learnerStorage=true;}catch{checks.learnerStorage=false;}
 try{need(env.BUCKET,'Missing storage');await env.BUCKET.list({limit:1});checks.files=true;}catch{checks.files=false;}
 for(const [name,ok] of Object.entries(checks))if(!ok)issues.push(name);
 return {schemaVersion:1,at:now,ok:!issues.length,checks,issues};
}
export async function recoveryExport(req,env,at=Date.now()){
 const url=new URL(req.url),key=url.searchParams.get('object');
 if(key!==null){
  need(key.length<=256&&!key.includes('..')&&/^(narration|rendered|sources)\/[a-zA-Z0-9._/-]+$/.test(key),'Invalid recovery object.');
  const object=await env.BUCKET.get(key);need(object,'Recovery object no longer exists. Repeat the snapshot; do not treat it as complete.',409);
  return new Response(object.body,{headers:{'Content-Type':'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
 }
 need(env.DB?.batch&&env.BUCKET,'Recovery storage is unavailable.',503);
 // D1 batch is one transaction. Limits refuse an incomplete export rather than
 // silently produce a backup that cannot be restored.
 const results=await env.DB.batch([
  env.DB.prepare("SELECT name,tbl_name,type,sql FROM sqlite_master WHERE type IN ('table','index') AND sql IS NOT NULL ORDER BY type DESC,name").bind(),
  ...RECOVERY_TABLES.map(t=>env.DB.prepare(`SELECT * FROM ${t} ORDER BY 1 LIMIT 10001`).bind())
 ]);
 need(results.every(r=>r.success!==false&&Array.isArray(r.results)),'Database snapshot failed.',503);
 const tables=Object.fromEntries(RECOVERY_TABLES.map((t,i)=>[t,results[i+1].results]));
 need(Object.values(tables).every(rows=>rows.length<=10000),'Recovery snapshot exceeds its row limit. Use a larger operator export before launch.',413);
 const schema=results[0].results.filter(r=>RECOVERY_TABLES.includes(r.tbl_name));
 need(RECOVERY_TABLES.every(t=>schema.some(s=>s.name===t&&s.type==='table')),'Recovery schema is incomplete.',503);
 const objects=[];let cursor;
 for(let page=0;page<6;page++){
  const r=await env.BUCKET.list({limit:1000,...(cursor?{cursor}:{})});
  objects.push(...r.objects.map(o=>({key:o.key,size:o.size,etag:o.etag,uploaded:o.uploaded})));
  if(!r.truncated){cursor=null;break}cursor=r.cursor;need(cursor,'Incomplete object listing.',503);
 }
 need(!cursor&&objects.length<=5000,'Recovery object inventory exceeds its limit.',413);
 const snapshot={schemaVersion:1,at,completedAt:Date.now(),tables,schema,objects,consistency:'D1 transaction; R2 and NoCodeBackend require operator reconciliation. Not a distributed transaction.'};
 need(new TextEncoder().encode(JSON.stringify(snapshot)).length<=8*1024*1024,'Recovery snapshot exceeds eight MB.',413);
 return noStore(snapshot);
}
