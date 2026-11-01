import {closureQueue} from './account-closure.js';
import {noStore,readJSON} from './ncb-auth.js';
import {digest} from './content-service.js';
import {sqlDB,need,parse,auditEvent,controlScopes} from './data-control.js';
export async function operationsAPI(req,env,{now=()=>Date.now()}={}){try{
 need(env.MAINTENANCE_SECRET?.length>=32,'Operations authentication is not configured.',503);
 need(await digest(req.headers.get('Authorization')||'')===await digest('Bearer '+env.MAINTENANCE_SECRET),'Operations authorization required.',403);
 need(req.headers.get('X-Mosaic-Maintenance')==='closure-v1','Closure operation required.',403);
 const origin=req.headers.get('Origin');need(!origin||origin===new URL(req.url).origin,'Cross-origin operation is not permitted.',403);
 if(req.method==='GET')return noStore({closures:await closureQueue(env)});
 need(req.method==='POST'&&req.headers.get('content-type')?.startsWith('application/json'),'Use a valid operation request.');
 const input=await readJSON(req,2000);need(input.action==='confirm-provider-deletion'&&/^[a-f0-9]{64}$/.test(input.accountReference)&&input.providerDeleted===true,'Verify NoCodeBackend identity deletion first.');
 const db=sqlDB(env.DB),scope='pilot-close:'+input.accountReference,row=await db.one('SELECT policy FROM data_controls WHERE scope=?',scope),p=parse(row?.policy);
 need(['provider-pending','complete'].includes(p.status),'This request is not waiting for provider identity deletion.',409);
 // Operator credential only. The companion command verifies the exact NCB ID
 // is absent, including after interrupted runs, before submitting this receipt.
 const subjects=await db.all('SELECT site_owner FROM retention_subjects WHERE learner_owner=?',input.accountReference);
 for(const subject of subjects){
  const scopes=await controlScopes(subject.site_owner,input.accountReference);
  await db.run('DELETE FROM data_leases WHERE scope=?',scopes.learner);
  await db.run('DELETE FROM data_controls WHERE scope=?',scopes.learner);
  const others=await db.one('SELECT COUNT(*) AS n FROM retention_subjects WHERE site_owner=? AND learner_owner!=?',subject.site_owner,input.accountReference);
  if(!others.n){await db.run('DELETE FROM data_leases WHERE scope=?',scopes.workspace);await db.run('DELETE FROM data_controls WHERE scope=?',scopes.workspace);}
 }
 await db.run('DELETE FROM retention_subjects WHERE learner_owner=?',input.accountReference);
 const result=await db.run('UPDATE data_controls SET policy=?,updated=? WHERE scope=? AND policy=?',JSON.stringify({status:'complete',requestedAt:p.requestedAt,completedAt:p.completedAt||now()}),now(),scope,row.policy);
 need(result.meta.changes===1,'Closure changed. Read its status again.',409);
 await db.run('UPDATE data_controls SET policy=?,updated=? WHERE scope=?',JSON.stringify({status:'closed',closedAt:now()}),now(),'pilot-member:'+input.accountReference);
 await db.run("DELETE FROM data_controls WHERE scope LIKE 'assignment:%' AND (json_extract(policy,'$.learner')=? OR json_extract(policy,'$.manager')=?)",input.accountReference,input.accountReference);
 await auditEvent(env,'pilot-member:'+input.accountReference,'provider-identity-deletion-confirmed',{},now());return noStore({status:'complete'});
}catch(e){return noStore({error:e.status?e.message:'The operation could not be completed.'},e.status||503)}}
