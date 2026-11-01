import {deletionPlan,startDeletion} from './data-lifecycle.js';
import {sqlDB,need,parse,auditEvent} from './data-control.js';
import {digest} from './content-service.js';
// Closing is reversible only before requesting it. Provider deletion is a
// separately verified operator step; the UI must never call a queued request done.
export async function requestClosure(env,{owner,siteOwner,user,store,now}){
 const db=sqlDB(env.DB),scope='pilot-close:'+owner;
 const dependents=await db.one("SELECT COUNT(*) AS n FROM data_controls WHERE scope LIKE 'pilot-member:%' AND json_extract(policy,'$.manager')=? AND json_extract(policy,'$.status') IN ('active','revoked')",owner);
 need(dependents.n===0,'Transfer or close your managed learners before closing the organiser account.',409);
 const previous=await db.one('SELECT policy FROM data_controls WHERE scope=?',scope),saved=parse(previous?.policy);
 const memberScope='pilot-member:'+owner,member=parse((await db.one('SELECT policy FROM data_controls WHERE scope=?',memberScope))?.policy);
 need(['active','revoked','closing'].includes(member.status),'Only an existing member can request learning-account closure.',403);
 if(saved.status==='provider-pending')return {status:'provider-pending'};
 await db.run('INSERT INTO data_controls(scope,policy,updated) VALUES(?,?,?) ON CONFLICT(scope) DO UPDATE SET policy=excluded.policy,updated=excluded.updated',memberScope,JSON.stringify({...member,status:'closing'}),now());
 const record={...saved,userId:user.id,siteOwner,requestedAt:saved.requestedAt||now(),status:'cleaning'};
 await db.run('INSERT INTO data_controls(scope,policy,updated) VALUES(?,?,?) ON CONFLICT(scope) DO UPDATE SET policy=excluded.policy,updated=excluded.updated',scope,JSON.stringify(record),now());
 // Register even a member who never opened learning: saved cleanup must resume
 // without requiring the departing learner to return after contention or failure.
 await db.run('INSERT INTO retention_subjects(id,site_owner,learner_owner,updated) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET updated=excluded.updated',await digest(siteOwner+':'+owner),siteOwner,owner,now());
 try{return await continueClosure(env,{owner,siteOwner,store,now});}
 catch{return {status:'cleaning',message:'Your closure request is saved. Background cleanup will retry; your learning access is withdrawn.'};}
}
export async function continueClosure(env,{owner,siteOwner,store,now}){
 const db=sqlDB(env.DB),scope='pilot-close:'+owner,row=await db.one('SELECT policy FROM data_controls WHERE scope=?',scope),record=parse(row?.policy);
 if(record.status!=='cleaning')return {status:record.status||'none'};
 need(record.siteOwner===siteOwner,'Closure workspace changed.',409);
 const pending=await db.one("SELECT COUNT(*) AS n FROM data_operations WHERE site_owner=? AND learner_owner=? AND status IN ('preparing','cleanup-pending','provider-pending')",siteOwner,owner);
 if(pending.n)return {status:'cleaning'};
 for(const mode of ['workspace','learner']){
  const plan=await deletionPlan(env,{owner,siteOwner,store,mode,now:now()});
  const operation=await startDeletion(env,{owner,siteOwner,store,now},plan);
  if(operation.status!=='complete')return {status:'cleaning',operation};
 }
 record.status='provider-pending';const updated=await db.run('UPDATE data_controls SET policy=?,updated=? WHERE scope=? AND policy=?',JSON.stringify(record),now(),scope,row.policy);
 need(updated.meta.changes===1,'Closure changed. Read its current status.',409);
 await auditEvent(env,'pilot-member:'+owner,'account-closure-requested',{},now());return {status:'provider-pending'};
}
export async function closureQueue(env){return (await sqlDB(env.DB).all("SELECT scope,policy FROM data_controls WHERE scope LIKE 'pilot-close:%'")).map(r=>({accountReference:r.scope.slice(12),...parse(r.policy)}));}
