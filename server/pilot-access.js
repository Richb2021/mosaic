import {leaveClassesOf} from './classes-api.js';
import {requestClosure,closureQueue} from './account-closure.js';
import {maintenanceStatus} from './background-retention.js';
import {budgetStatus} from './cost-ledger.js';
import {digest} from './content-service.js';
import {need,sqlDB,parse,auditEvent} from './data-control.js';
import {ncbSession,checkOrigin,readJSON,noStore} from './ncb-auth.js';
import {NCBStore} from './ncb-store.js';
import {memberBinding} from './course-grants.js';

export const PILOT_NOTICE='2026-11-01-v2';
export const learnerOwner=user=>digest('mosaic-learner:'+user.id);
export const pilotAdmin=(owner,env)=>!!env.PILOT_ADMIN_OWNER&&owner===env.PILOT_ADMIN_OWNER;
export async function workspaceIdentity(user,env){
 const principal=await learnerOwner(user);
 const alias=env.PILOT_ADMIN_STORAGE_OWNER;
 need(!alias||/^[a-f0-9]{64}$/.test(alias),'Administrator storage binding needs attention.',503);
 need(!alias||principal!==alias||principal===env.PILOT_ADMIN_OWNER,'This development account has been retired. Sign in with the administrator account to access its preserved learning records.',403);
 const owner=pilotAdmin(principal,env)&&alias?alias:principal;
 // Only this explicitly configured NCB account inherits the original private library.
 if(pilotAdmin(principal,env)&&env.PILOT_KEEP_LEGACY_ADMIN_LIBRARY==='true'&&env.DB){
  const row=await sqlDB(env.DB).one('SELECT policy FROM data_controls WHERE scope=?','maintenance:workspace');
  const legacy=parse(row?.policy).siteOwner;if(legacy)return {owner,principal,siteOwner:legacy,admin:true};
 }
 return {owner,principal,siteOwner:'personal:'+owner,admin:pilotAdmin(principal,env)};
}
export async function admission(env,owner){
 const admin=pilotAdmin(owner,env);
 if(env.PILOT_ENABLED!=='true')return {admitted:true,admin,role:admin?'administrator':'learner'};
 need(env.PILOT_ADMIN_OWNER&&env.DB,'Pilot access is being prepared. Device games remain available.',503);
 const row=await sqlDB(env.DB).one('SELECT policy FROM data_controls WHERE scope=?','pilot-member:'+owner),member=parse(row?.policy);
 let admitted=admin||member.status==='active';
 if(admitted&&member.manager&&!pilotAdmin(member.manager,env)){
  const manager=parse((await sqlDB(env.DB).one('SELECT policy FROM data_controls WHERE scope=?','pilot-member:'+member.manager))?.policy);
  admitted=manager.status==='active'&&['teacher','guardian'].includes(manager.role);
 }
 return {admitted,admin,tutorAllowed:member.tutorAllowed===true,canAuthor:admin||['teacher','guardian'].includes(member.role)||member.authoringAllowed===true,role:admin?'administrator':member.role||'learner',context:member.context||'individual',manager:member.manager||null,group:member.group||null,status:member.status||'invitation-required'};
}
export async function requireAdmission(env,owner,{store,onboarding=false,storageOwner=owner}={}){
 const a=await admission(env,owner);need(a.admitted,'Open Welcome to accept your invitation or check access with your organiser.',403);
 if(onboarding&&env.PILOT_ENABLED==='true'){
  const row=await (store||new NCBStore(env)).latest('learner_profiles',storageOwner,'onboarding'),o=parse(row?.payload).onboarding;
  need(o?.completed&&o.version===PILOT_NOTICE,'Open Welcome to finish setting up your learning account.',428);
  a.ageBand=o.ageBand;
 }
 return a;
}
export async function pilotAPI(req,env,{session=ncbSession,store=new NCBStore(env),now=()=>Date.now()}={}){try{
 checkOrigin(req);const user=await session(req,env);need(user,'Sign in to your learner account first.',401);
 const {owner:storageOwner,principal:owner,siteOwner}=await workspaceIdentity(user,env),access=await admission(env,owner),db=sqlDB(env.DB);
 const manages=access.admitted&&['administrator','teacher','guardian'].includes(access.role);
 if(req.method==='GET'){
  const row=await store.latest('learner_profiles',storageOwner,'onboarding');
  const operations=access.admin?{closures:(await closureQueue(env)).map(({userId,siteOwner,...r})=>r),maintenance:await maintenanceStatus(env),paused:parse((await db.one('SELECT policy FROM data_controls WHERE scope=?','launch:controls'))?.policy).paused===true,pendingDeletion:(await db.one("SELECT COUNT(*) AS n FROM data_operations WHERE status IN ('preparing','cleanup-pending','provider-pending')")).n}:null;
  const budget=await budgetStatus(env,siteOwner,now());
  const roster=manages?(access.admin?await db.all("SELECT scope,policy FROM data_controls WHERE scope LIKE 'pilot-member:%' LIMIT 200"):await db.all("SELECT scope,policy FROM data_controls WHERE scope LIKE 'pilot-member:%' AND json_extract(policy,'$.manager')=? LIMIT 200",owner)).map(r=>({accountReference:r.scope.slice(13),...parse(r.policy)})):[];
  return noStore({user:{id:user.id,name:user.name,email:user.email,emailVerified:user.emailVerified===true},accountReference:owner,...access,manages,enabled:env.PILOT_ENABLED==='true',noticeVersion:PILOT_NOTICE,onboarding:row?parse(row.payload).onboarding:null,version:row?.version||0,supportEmail:env.PILOT_SUPPORT_EMAIL||null,roster,operations,budget,closure:parse((await db.one('SELECT policy FROM data_controls WHERE scope=?','pilot-close:'+owner))?.policy).status||null});
 }
 need(req.method==='POST','Pilot route not found.',404);need(req.headers.get('X-Mosaic-Learner')===user.id,'Your account changed. Reload before continuing.',401);
 const input=await readJSON(req,6000);
 if(input.action==='claim'){
  need(user.emailVerified===true,'Verify your email by signing in with an email code, then accept your invitation.',403);
  need(typeof input.code==='string'&&/^[a-f0-9]{64}$/.test(input.code),'Enter the complete invitation code.');
  const scope='pilot-invite:'+await digest(input.code),row=await db.one('SELECT * FROM data_controls WHERE scope=?',scope),invite=parse(row?.policy);
  need(row&&invite.expires>now()&&invite.emailHash===await digest(user.email.trim().toLowerCase()),'This invitation is unavailable or belongs to another email address.',403);
  need(!invite.owner||invite.owner===owner,'This invitation has already been used.',409);
  const manager=await admission(env,invite.manager);need(manager.admitted&&['administrator','teacher','guardian'].includes(manager.role),'The organiser’s access is unavailable.',403);
  const current=parse((await db.one('SELECT policy FROM data_controls WHERE scope=?','pilot-member:'+owner))?.policy);
  need(!current.status||(current.status==='active'&&current.invite===scope),'This account already has an access arrangement. Ask the administrator to review it.',409);
  const result=await db.run('UPDATE data_controls SET policy=?,updated=? WHERE scope=? AND policy=?',JSON.stringify({...invite,owner}),now(),scope,row.policy);
  need(result.meta.changes===1,'Invitation changed. Try accepting it again.',409);
  const member={status:'active',joined:now(),invite:scope,manager:invite.manager,role:invite.role,context:invite.context,group:invite.group,label:invite.label,managedApproval:invite.managedApproval,authoringAllowed:invite.authoringAllowed,tutorAllowed:invite.tutorAllowed===true};
  await db.run('INSERT OR IGNORE INTO data_controls(scope,policy,updated) VALUES(?,?,?)','pilot-member:'+owner,JSON.stringify(member),now());
  const accepted=parse((await db.one('SELECT policy FROM data_controls WHERE scope=?','pilot-member:'+owner))?.policy);
  need(accepted.invite===scope,'Another invitation was accepted first. Reload to review your access arrangement.',409);
  need((await admission(env,owner)).admitted,'Access has been withdrawn. Contact your organiser.',403);
  await auditEvent(env,'pilot-member:'+owner,'invitation-accepted',{role:member.role,context:member.context},now());return noStore({admitted:true});
 }
 if(input.action==='invite'){
  need(manages,'Only an authorised organiser can create invitations.',403);
  need(typeof input.email==='string'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)&&input.email.length<=254,'Enter the learner’s sign-in email address.');
  const role=input.role||'learner',context=input.context||'individual';need(['learner','teacher','guardian'].includes(role)&&['individual','school','family'].includes(context),'Choose a supported role and setting.');
  need(access.admin||role==='learner','Only the administrator can authorise teachers and guardians.',403);
  need(access.admin||(access.role==='teacher'?context==='school':context==='family'),'Use the setting you are authorised to manage.',403);
  need(context==='individual'||input.managedApproval===true,'Confirm the school or guardian has authorised this learner’s access.');
  const clean=(v,n)=>typeof v==='string'?v.trim().slice(0,n):'';
  const bytes=crypto.getRandomValues(new Uint8Array(32)),code=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join(''),expires=now()+7*86400000;
  await db.run('INSERT INTO data_controls(scope,policy,updated) VALUES(?,?,?)','pilot-invite:'+await digest(code),JSON.stringify({emailHash:await digest(input.email.trim().toLowerCase()),expires,manager:owner,role,context,group:clean(input.group,80),label:clean(input.label,60),managedApproval:context!=='individual'&&input.managedApproval===true,tutorAllowed:input.tutorAllowed===true,authoringAllowed:role!=='learner'||context==='individual'||input.adultAuthor===true}),now());
  await auditEvent(env,'pilot-member:'+owner,'invitation-created',{role,context,expires},now());return noStore({code,expires,url:new URL('/welcome.html#invite='+code,req.url).href});
 }
 if(input.action==='tutor-access'){
  need(manages,'Only an authorised organiser can manage tutor access.',403);
  need(/^[a-f0-9]{64}$/.test(input.accountReference)&&typeof input.enabled==='boolean','Choose a learner and tutor setting.');
  const scope='pilot-member:'+input.accountReference,row=await db.one('SELECT policy FROM data_controls WHERE scope=?',scope),member=parse(row?.policy);
  need(member.role==='learner'&&member.status==='active'&&(access.admin||member.manager===owner),'Choose an active learner in your group.',403);
  need(!input.enabled||member.context==='individual'||member.managedApproval===true,'Confirm managed access before enabling the tutor.',403);
  const changed=await db.run('UPDATE data_controls SET policy=?,updated=? WHERE scope=? AND policy=?',JSON.stringify({...member,tutorAllowed:input.enabled}),now(),scope,row.policy);
  need(changed.meta.changes===1,'Access changed. Reload the learner list.',409);
  await auditEvent(env,scope,'tutor-access-changed',{enabled:input.enabled},now());return noStore({tutorAllowed:input.enabled});
 }
 if(input.action==='pause'){
  need(access.admin,'Only the administrator can pause new generation.',403);need(typeof input.paused==='boolean','Choose a generation state.');
  await db.run('INSERT INTO data_controls(scope,policy,updated) VALUES(?,?,?) ON CONFLICT(scope) DO UPDATE SET policy=excluded.policy,updated=excluded.updated','launch:controls',JSON.stringify({paused:input.paused}),now());await auditEvent(env,'launch:controls','generation-pause',{paused:input.paused},now());return noStore({paused:input.paused});
 }
 if(input.action==='reassign'){
  need(access.admin,'Only the administrator can transfer a managed learner.',403);
  need(/^[a-f0-9]{64}$/.test(input.accountReference)&&/^[a-f0-9]{64}$/.test(input.manager),'Choose the learner and new organiser.');
  const scope='pilot-member:'+input.accountReference,row=await db.one('SELECT policy FROM data_controls WHERE scope=?',scope),member=parse(row?.policy),manager=await admission(env,input.manager);
  need(row&&member.role==='learner'&&['active','revoked'].includes(member.status),'Choose an existing learner.',404);
  need(manager.admitted&&(manager.admin||manager.role===(member.context==='family'?'guardian':'teacher')),'Choose an authorised organiser for this setting.',403);
  need(input.manager!==input.accountReference,'A learner cannot manage their own access.');
  const changed=await db.run('UPDATE data_controls SET policy=?,updated=? WHERE scope=? AND policy=?',JSON.stringify({...member,manager:input.manager,tutorAllowed:false,sharingEpoch:crypto.randomUUID()}),now(),scope,row.policy);
  need(changed.meta.changes===1,'Access changed. Reload the learner list.',409);
  await leaveClassesOf(env,input.accountReference,member.manager);
  await auditEvent(env,scope,'organiser-changed',{},now());return noStore({reassigned:true});
 }
 if(input.action==='restore-access'){
  need(manages,'Only an authorised organiser can manage access.',403);
  const scope='pilot-member:'+input.accountReference,row=await db.one('SELECT policy FROM data_controls WHERE scope=?',scope),member=parse(row?.policy);
  need(member.status==='revoked'&&(access.admin||member.manager===owner),'Choose a withdrawn learner in your group.',403);
  const changed=await db.run('UPDATE data_controls SET policy=?,updated=? WHERE scope=? AND policy=?',JSON.stringify({...member,status:'active',sharingEpoch:crypto.randomUUID()}),now(),scope,row.policy);
  need(changed.meta.changes===1,'Access changed. Reload the learner list.',409);
  await auditEvent(env,scope,'access-restored',{},now());return noStore({restored:true});
 }
 if(input.action==='revoke'){
  need(manages,'Only an authorised organiser can manage access.',403);need(/^[a-f0-9]{64}$/.test(input.accountReference)&&input.accountReference!==owner,'Use the learner’s account support reference.');
  const scope='pilot-member:'+input.accountReference,row=await db.one('SELECT policy FROM data_controls WHERE scope=?',scope),member=parse(row?.policy);need(row,'Learner membership not found.',404);need(access.admin||member.manager===owner,'This learner is not in your group.',403);
  need(['active','revoked'].includes(member.status),'This account is closing or already closed.',409);
  const changed=await db.run('UPDATE data_controls SET policy=?,updated=? WHERE scope=? AND policy=?',JSON.stringify({...member,status:'revoked',sharingEpoch:crypto.randomUUID()}),now(),scope,row.policy);
  need(changed.meta.changes===1,'Access changed. Reload the learner list.',409);
  await leaveClassesOf(env,input.accountReference,member.manager);
  await auditEvent(env,scope,'access-revoked',{},now());return noStore({revoked:true});
 }
 if(input.action==='close'){
  need(!access.admin,'Transfer administrator ownership before closing the administrator account.',409);need(input.confirmed===true&&input.confirmEmail===user.email,'Confirm your sign-in email before requesting account closure.');
  return noStore({closure:await requestClosure(env,{owner,siteOwner,user,store,now})});
 }
 await requireAdmission(env,owner);
 if(input.action==='onboarding'){
  need(input.noticeVersion===PILOT_NOTICE&&input.confirmed===true,'Read and acknowledge the current learning and privacy notes.');
  need(['under13','13to17','18plus'].includes(input.ageBand),'Choose your age range. Your date of birth is not collected.');
  const member=parse((await db.one('SELECT policy FROM data_controls WHERE scope=?','pilot-member:'+owner))?.policy);
  need(input.ageBand==='18plus'||member.managedApproval===true,'A parent, guardian or authorised school organiser needs to arrange access for learners under 18.',403);
  need(access.role==='learner'||input.ageBand==='18plus','School and family organisers must be adults.',403);
  need(Number.isInteger(input.expectedVersion)&&input.expectedVersion>=0,'Reload your welcome page.');
  const previous=parse((await store.latest('learner_profiles',storageOwner,'onboarding'))?.payload).onboarding;
  need(!previous?.completed||previous.ageBand===input.ageBand,'Ask your organiser to review an age-range correction; it cannot change your access permissions.',409);
  const onboarding={version:PILOT_NOTICE,acknowledgedAt:now(),ageBand:input.ageBand,context:access.context||'individual',completed:true};
  const saved=await store.write('learner_profiles',storageOwner,'onboarding',input.expectedVersion,{onboarding},now());return noStore({onboarding,version:saved.version});
 }
 if(input.action==='assign'){
  need(manages,'Only an authorised organiser can assign learning.',403);
  const {member,key:learnerBinding}=await memberBinding(env,input.accountReference),{key:managerBinding}=await memberBinding(env,owner);
  need(member.manager===owner&&member.status==='active','Choose an active learner in your group.',403);
  const job=await db.one('SELECT id,draft FROM workshop_jobs WHERE id=? AND owner=? AND status=?',input.jobId,siteOwner,'published');need(job,'Review and publish the chapter in your library first.',404);
  const draftHash=await digest(job.draft);need(input.draftHash===undefined||input.draftHash===draftHash,'This chapter changed. Reopen its review before assigning it.',409);
  const scope='assignment:'+await digest(owner+':'+input.accountReference+':'+job.id);
  await db.run('INSERT INTO data_controls(scope,policy,updated) VALUES(?,?,?) ON CONFLICT(scope) DO UPDATE SET policy=excluded.policy,updated=excluded.updated',scope,JSON.stringify({manager:owner,learner:input.accountReference,siteOwner,jobId:job.id,draftHash,learnerBinding,managerBinding}),now());return noStore({assigned:true});
 }
 throw Object.assign(Error('Pilot action not found.'),{status:404});
}catch(e){return noStore({error:e.status?e.message:'Account access could not be checked. Please try again.'},e.status||503)}}
