import {leaveClassesOf,classesOf,addToClass,ownedClass,revokeLearnerClassGrants,classScope} from './classes-api.js';
import {requestClosure,closureQueue} from './account-closure.js';
import {maintenanceStatus} from './background-retention.js';
import {budgetStatus} from './cost-ledger.js';
import {allowancePolicy,activeAllowance,allowanceScope,requestScope,ALLOWANCE_REASONS,REQUEST_CHANGES_PER_DAY} from './allowance.js';
import {digest} from './content-service.js';
import {need,sqlDB,parse,auditEvent} from './data-control.js';
import {ncbSession,checkOrigin,readJSON,noStore} from './ncb-auth.js';
import {NCBStore} from './ncb-store.js';
import {memberBinding} from './course-grants.js';

export const PILOT_NOTICE='2026-11-01-v2';
// Bulk invitations have no typed label, so the roster shows the email's name part ("ray.smith@…" → "Ray Smith") instead of "Learner".
const labelFromEmail=email=>String(email).split('@')[0].replace(/[._+-]+/g,' ').replace(/\d+/g,'').trim().replace(/\b\w/g,c=>c.toUpperCase()).slice(0,60)||'';
export const learnerOwner=user=>digest('mosaic-learner:'+user.id);
export const pilotAdmin=(owner,env)=>!!env.PILOT_ADMIN_OWNER&&owner===env.PILOT_ADMIN_OWNER;
// Teachers who signed themselves up (open sign-up) start unverified: every teacher feature works with adults,
// but nobody under 18 can be invited, admitted or added to their classes until the administrator verifies them.
// Teachers the administrator invited, including rows written before this flag existed, count as verified.
export const VERIFY_NOTICE='To invite pupils under 18, the organiser needs to verify you as a teacher.';
export const verifyRequestScope=owner=>'teacher-verify-request:'+owner;
export const canAdmitMinors=access=>!!access&&(access.admin||access.verified!==false);
const MINOR_BANDS=['under13','13to17'];
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
// The spending identity (siteOwner) of an account reference, matching workspaceIdentity: the administrator may use a storage alias.
export async function siteOwnerOf(env,ref){
 if(!pilotAdmin(ref,env))return 'personal:'+ref;
 if(env.PILOT_KEEP_LEGACY_ADMIN_LIBRARY==='true'&&env.DB){const legacy=parse((await sqlDB(env.DB).one('SELECT policy FROM data_controls WHERE scope=?','maintenance:workspace'))?.policy).siteOwner;if(legacy)return legacy;}
 return 'personal:'+(env.PILOT_ADMIN_STORAGE_OWNER||ref);
}
// Administrator-only view of open allowance requests and unexpired allowances, named from the roster.
async function allowanceOperations(db,at){
 const names=new Map((await db.all("SELECT scope,policy FROM data_controls WHERE scope LIKE 'pilot-member:%' LIMIT 500")).map(r=>[r.scope.slice(13),parse(r.policy).label||null]));
 const teacherRequests=(await db.all("SELECT scope,policy FROM data_controls WHERE scope LIKE 'teacher-verify-request:%' AND json_extract(policy,'$.status')='open' ORDER BY json_extract(policy,'$.updated') LIMIT 200")).map(r=>{const q=parse(r.policy);return {accountReference:q.accountReference,name:names.get(q.accountReference)||q.name||null,displayName:q.name||null,email:q.email||null,note:q.note||'',created:q.created,updated:q.updated}});
 const allowances=(await db.all("SELECT scope,policy FROM data_controls WHERE scope LIKE 'allowance:%' AND json_extract(policy,'$.expires')>? ORDER BY json_extract(policy,'$.expires') LIMIT 200",at)).map(r=>activeAllowance(parse(r.policy),at)).filter(Boolean).map(a=>({accountReference:a.accountReference||null,name:names.get(a.accountReference)||a.name||null,preset:a.preset,label:a.label,dailyUsd:a.dailyUsd,generations:a.generations,reason:a.reason||null,expires:a.expires,updated:a.updated}));
 const allowanceRequests=(await db.all("SELECT scope,policy FROM data_controls WHERE scope LIKE 'allowance-request:%' AND json_extract(policy,'$.status')='open' ORDER BY json_extract(policy,'$.updated') LIMIT 200")).map(r=>{const q=parse(r.policy);return {accountReference:q.accountReference,name:names.get(q.accountReference)||q.name||null,displayName:q.name||null,email:q.email||null,reason:q.reason,note:q.note||'',created:q.created,updated:q.updated}});
 return {allowances,allowanceRequests,teacherRequests};
}
export async function admission(env,owner){
 const admin=pilotAdmin(owner,env);
 if(env.PILOT_ENABLED!=='true')return {admitted:true,admin,verified:true,role:admin?'administrator':'learner'};
 need(env.PILOT_ADMIN_OWNER&&env.DB,'Pilot access is being prepared. Device games remain available.',503);
 const row=await sqlDB(env.DB).one('SELECT policy FROM data_controls WHERE scope=?','pilot-member:'+owner),member=parse(row?.policy);
 let admitted=admin||member.status==='active';
 if(admitted&&member.manager&&!pilotAdmin(member.manager,env)){
  const manager=parse((await sqlDB(env.DB).one('SELECT policy FROM data_controls WHERE scope=?','pilot-member:'+member.manager))?.policy);
  // A managed (school or family) learner also needs a verified organiser.
  admitted=manager.status==='active'&&['teacher','guardian'].includes(manager.role)&&(manager.role!=='teacher'||manager.verified!==false||member.context==='individual'&&member.managedApproval!==true);
 }
 return {admitted,admin,tutorAllowed:member.tutorAllowed===true,canAuthor:admin||['teacher','guardian'].includes(member.role)||member.authoringAllowed===true,role:admin?'administrator':member.role||'learner',verified:admin||member.role!=='teacher'||member.verified!==false,context:member.context||'individual',managedApproval:member.managedApproval===true,manager:member.manager||null,group:member.group||null,status:member.status||'invitation-required'};
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
  const operations=access.admin?{closures:(await closureQueue(env)).map(({userId,siteOwner,...r})=>r),maintenance:await maintenanceStatus(env),paused:parse((await db.one('SELECT policy FROM data_controls WHERE scope=?','launch:controls'))?.policy).paused===true,pendingDeletion:(await db.one("SELECT COUNT(*) AS n FROM data_operations WHERE status IN ('preparing','cleanup-pending','provider-pending')")).n,...await allowanceOperations(db,now())}:null;
  const ownRequest=parse((await db.one('SELECT policy FROM data_controls WHERE scope=?',requestScope(siteOwner)))?.policy);
  const budget=await budgetStatus(env,siteOwner,now());
  const ownVerify=access.role==='teacher'&&!access.verified?parse((await db.one('SELECT policy FROM data_controls WHERE scope=?',verifyRequestScope(owner)))?.policy):{};
  const roster=manages?(access.admin?await db.all("SELECT scope,policy FROM data_controls WHERE scope LIKE 'pilot-member:%' LIMIT 200"):await db.all("SELECT scope,policy FROM data_controls WHERE scope LIKE 'pilot-member:%' AND json_extract(policy,'$.manager')=? LIMIT 200",owner)).map(r=>{const {withdrawnClasses,...m}=parse(r.policy);return {accountReference:r.scope.slice(13),...m,...(withdrawnClasses?{classesToRestore:withdrawnClasses.length}:{})}}):[];
  return noStore({user:{id:user.id,name:user.name,email:user.email,emailVerified:user.emailVerified===true},accountReference:owner,...access,manages,enabled:env.PILOT_ENABLED==='true',openSignup:env.PILOT_OPEN_SIGNUP==='true',noticeVersion:PILOT_NOTICE,onboarding:row?parse(row.payload).onboarding:null,version:row?.version||0,supportEmail:env.PILOT_SUPPORT_EMAIL||null,roster,operations,budget,verificationRequest:ownVerify.status?{status:ownVerify.status,updated:ownVerify.updated}:null,allowanceRequest:ownRequest.status?{status:ownRequest.status,reason:ownRequest.reason,note:ownRequest.status==='open'?ownRequest.note||'':'',updated:ownRequest.updated}:null,closure:parse((await db.one('SELECT policy FROM data_controls WHERE scope=?','pilot-close:'+owner))?.policy).status||null});
 }
 need(req.method==='POST','Pilot route not found.',404);need(req.headers.get('X-Mosaic-Learner')===user.id,'Your account changed. Reload before continuing.',401);
 const input=await readJSON(req,12000);
 // Optional open sign-up (PILOT_OPEN_SIGNUP=true), for events such as a hackathon. A verified adult with no
 // access arrangement joins the administrator's "Independent learners" group as a self-directed learner.
 // The individual setting means onboarding only accepts 18+; daily AI spending caps still apply.
 // With as:'teacher' they join as an unverified teacher instead (onboarding also only accepts 18+ for organisers):
 // every teacher feature works with adults, and pupils under 18 wait for the administrator's verification.
 if(input.action==='join-open'){
  const teacher=input.as==='teacher';need(input.as===undefined||input.as==='learner'||teacher,'Choose how you will use Mosaic.');
  need(env.PILOT_OPEN_SIGNUP==='true','Joining needs an invitation from a teacher or organiser.',403);
  need(user.emailVerified===true,'Verify your email by signing in with an email code first.',403);
  const current=parse((await db.one('SELECT policy FROM data_controls WHERE scope=?','pilot-member:'+owner))?.policy);
  need(!current.status,'This account already has an access arrangement. Ask the administrator to review it.',409);
  const label=teacher?String(user.name||'').trim().replace(/\s+/g,' ').slice(0,60)||'Teacher':String(user.name||'').trim().split(/\s+/).filter(Boolean).map((w,i)=>i?w[0]+'.':w).join(' ').slice(0,60)||'Independent learner';
  const member=teacher?{status:'active',joined:now(),invite:'open-signup-teacher',manager:env.PILOT_ADMIN_OWNER,role:'teacher',context:'school',group:'Self sign-up teachers',label,managedApproval:false,authoringAllowed:true,tutorAllowed:true,verified:false}:{status:'active',joined:now(),invite:'open-signup',manager:env.PILOT_ADMIN_OWNER,role:'learner',context:'individual',group:'Independent learners',label,managedApproval:false,authoringAllowed:true,tutorAllowed:true};
  await db.run('INSERT OR IGNORE INTO data_controls(scope,policy,updated) VALUES(?,?,?)','pilot-member:'+owner,JSON.stringify(member),now());
  need((await admission(env,owner)).admitted,'Access is not available for this account. Contact the administrator.',403);
  if(teacher)await auditEvent(env,'pilot-member:'+owner,'teacher-self-signup',{verified:false},now());
  return noStore({joined:true,role:member.role});
 }
 if(input.action==='claim'){
  need(user.emailVerified===true,'Verify your email by signing in with an email code, then accept your invitation.',403);
  need(typeof input.code==='string'&&/^[a-f0-9]{64}$/.test(input.code),'Enter the complete invitation code.');
  const scope='pilot-invite:'+await digest(input.code),row=await db.one('SELECT * FROM data_controls WHERE scope=?',scope),invite=parse(row?.policy);
  need(row&&invite.expires>now()&&invite.emailHash===await digest(user.email.trim().toLowerCase()),'This invitation is unavailable or belongs to another email address.',403);
  need(!invite.owner||invite.owner===owner,'This invitation has already been used.',409);
  const manager=await admission(env,invite.manager);need(manager.admitted&&['administrator','teacher','guardian'].includes(manager.role),'The organiser’s access is unavailable.',403);
  need(invite.context==='individual'||canAdmitMinors(manager),'This invitation is waiting for the organiser to verify your teacher. Ask your teacher to check it.',403);
  const current=parse((await db.one('SELECT policy FROM data_controls WHERE scope=?','pilot-member:'+owner))?.policy);
  need(!current.status||(current.status==='active'&&current.invite===scope),'This account already has an access arrangement. Ask the administrator to review it.',409);
  const result=await db.run('UPDATE data_controls SET policy=?,updated=? WHERE scope=? AND policy=?',JSON.stringify({...invite,owner}),now(),scope,row.policy);
  need(result.meta.changes===1,'Invitation changed. Try accepting it again.',409);
  const member={status:'active',joined:now(),invite:scope,manager:invite.manager,role:invite.role,context:invite.context,group:invite.group,label:invite.label,managedApproval:invite.managedApproval,authoringAllowed:invite.authoringAllowed,tutorAllowed:invite.tutorAllowed===true};
  await db.run('INSERT OR IGNORE INTO data_controls(scope,policy,updated) VALUES(?,?,?)','pilot-member:'+owner,JSON.stringify(member),now());
  const accepted=parse((await db.one('SELECT policy FROM data_controls WHERE scope=?','pilot-member:'+owner))?.policy);
  need(accepted.invite===scope,'Another invitation was accepted first. Reload to review your access arrangement.',409);
  need((await admission(env,owner)).admitted,'Access has been withdrawn. Contact your organiser.',403);
  const joinedClass=invite.classId?await addToClass(env,{classId:invite.classId,manager:invite.manager,learner:owner,user,label:invite.label||undefined,now:now()}):false;
  await auditEvent(env,'pilot-member:'+owner,'invitation-accepted',{role:member.role,context:member.context},now());return noStore({admitted:true,joinedClass});
 }
 if(input.action==='invite'||input.action==='invite-many'){
  need(manages,'Only an authorised organiser can create invitations.',403);
  const emails=input.action==='invite'?[input.email]:input.emails;
  need(Array.isArray(emails)&&emails.length>=1&&emails.length<=30,'Add between 1 and 30 email addresses, one per line.');
  // invite-many can carry one optional name per email (labels[i] for emails[i]), typed by the inviter.
  need(input.labels===undefined||Array.isArray(input.labels)&&input.labels.length===emails.length,'Give one name per email address, or none.');
  const named=new Map();emails.forEach((e,i)=>{const n=typeof input.labels?.[i]==='string'?input.labels[i].trim().slice(0,60):'';const k=typeof e==='string'?e.trim().toLowerCase():'';if(n&&!named.has(k))named.set(k,n)});
  const list=[...new Set(emails.map(e=>typeof e==='string'?e.trim().toLowerCase():''))];
  const bad=list.filter(e=>!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)||e.length>254);need(!bad.length,bad.length===1&&list.length===1?'Enter the learner’s sign-in email address.':'Check these email addresses: '+bad.slice(0,3).join(', ')+(bad.length>3?'…':''));
  const role=input.role||'learner',context=input.context||'individual';need(['learner','teacher','guardian'].includes(role)&&['individual','school','family'].includes(context),'Choose a supported role and setting.');
  need(access.admin||role==='learner','Only the administrator can authorise teachers and guardians.',403);
  need(access.admin||(access.role==='teacher'?['school','individual'].includes(context):context==='family'),'Use the setting you are authorised to manage.',403);
  need(input.ageBand===undefined||['18plus',...MINOR_BANDS].includes(input.ageBand),'Choose an age range.');
  // Pupils: anyone under 18, and every school or family (managed) setting. An unverified teacher may invite adults only.
  const pupils=context!=='individual'||MINOR_BANDS.includes(input.ageBand);
  need(!pupils||canAdmitMinors(access),VERIFY_NOTICE,403);
  need(!(context==='individual'&&MINOR_BANDS.includes(input.ageBand)),'Pupils under 18 need school or family access. Choose that setting and confirm it is authorised.');
  need(context==='individual'||input.managedApproval===true,'Confirm the school or guardian has authorised this learner’s access.');
  // Optionally join one of this organiser's own classes when the invitation is accepted.
  const cls=input.classId?await ownedClass(env,input.classId,owner,siteOwner):null;need(!input.classId||cls&&role==='learner','Choose one of your open classes for learners.',403);
  const clean=(v,n)=>typeof v==='string'?v.trim().slice(0,n):'';
  const invites=[];
  for(const email of list){
   const bytes=crypto.getRandomValues(new Uint8Array(32)),code=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join(''),expires=now()+7*86400000;
   await db.run('INSERT INTO data_controls(scope,policy,updated) VALUES(?,?,?)','pilot-invite:'+await digest(code),JSON.stringify({emailHash:await digest(email),expires,manager:owner,role,context,group:clean(input.group,80),label:named.get(email)||(list.length===1?clean(input.label,60):labelFromEmail(email)),managedApproval:context!=='individual'&&input.managedApproval===true,tutorAllowed:input.tutorAllowed===true,authoringAllowed:role!=='learner'||context==='individual'||input.adultAuthor===true,...(cls?{classId:cls.id}:{})}),now());
   invites.push({email,code,expires,url:new URL('/welcome.html#invite='+code,req.url).href});
  }
  await auditEvent(env,'pilot-member:'+owner,'invitation-created',{role,context,count:invites.length,toClass:!!cls,...(input.ageBand?{ageBand:input.ageBand}:{})},now());
  return noStore(input.action==='invite'?{code:invites[0].code,expires:invites[0].expires,url:invites[0].url,className:cls?.name||null}:{invites,className:cls?.name||null});
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
 if(['allowance-set','allowance-clear','allowance-decline'].includes(input.action)){
  need(access.admin,'Only the administrator can change AI allowances.',403);
  need(typeof input.accountReference==='string'&&/^[a-f0-9]{64}$/.test(input.accountReference),'Choose a person from the list.');
  const ref=input.accountReference,target=await siteOwnerOf(env,ref),rScope=requestScope(target),aScope=allowanceScope(target);
  const reqRow=await db.one('SELECT policy FROM data_controls WHERE scope=?',rScope),request=parse(reqRow?.policy);
  const closeRequest=async status=>{if(request.status!=='open')return false;const {email,name,note,...kept}=request;const changed=await db.run('UPDATE data_controls SET policy=?,updated=? WHERE scope=? AND policy=?',JSON.stringify({...kept,status,closed:now(),updated:now()}),now(),rScope,reqRow.policy);return changed.meta.changes===1};
  if(input.action==='allowance-decline'){
   need(request.status==='open','There is no open request from this person.',404);
   need(await closeRequest('declined'),'The request changed. Reload the list.',409);
   await auditEvent(env,'pilot-member:'+ref,'allowance-declined',{reason:request.reason},now());return noStore({declined:true});
  }
  if(input.action==='allowance-clear'){
   const removed=await db.run('DELETE FROM data_controls WHERE scope=?',aScope);
   await auditEvent(env,'pilot-member:'+ref,'allowance-cleared',{removed:removed.meta.changes===1},now());return noStore({cleared:true});
  }
  const member=parse((await db.one('SELECT policy FROM data_controls WHERE scope=?','pilot-member:'+ref))?.policy);
  need(member.status==='active'||pilotAdmin(ref,env)||request.status,'Choose an active person from the list.',404);
  const policy=allowancePolicy({preset:input.preset,custom:input.custom,hours:input.hours},{now:now(),setBy:owner,reason:request.status==='open'?request.reason:null});
  await db.run('INSERT INTO data_controls(scope,policy,updated) VALUES(?,?,?) ON CONFLICT(scope) DO UPDATE SET policy=excluded.policy,updated=excluded.updated',aScope,JSON.stringify({...policy,accountReference:ref}),now());
  const approved=await closeRequest('approved');
  await auditEvent(env,'pilot-member:'+ref,'allowance-set',{preset:policy.preset,dailyUsd:policy.dailyUsd,generations:policy.generations,expires:policy.expires,closedRequest:approved},now());
  return noStore({allowance:{label:policy.label,preset:policy.preset,dailyUsd:policy.dailyUsd,generations:policy.generations,expires:policy.expires},closedRequest:approved});
 }
 if(input.action==='teacher-verify'||input.action==='teacher-verify-decline'){
  need(access.admin,'Only the administrator can verify teachers.',403);
  need(typeof input.accountReference==='string'&&/^[a-f0-9]{64}$/.test(input.accountReference),'Choose a teacher from the list.');
  const ref=input.accountReference,mScope='pilot-member:'+ref,rScope=verifyRequestScope(ref);
  const reqRow=await db.one('SELECT policy FROM data_controls WHERE scope=?',rScope),request=parse(reqRow?.policy);
  // A closed request keeps no email, name or note.
  const closeRequest=async status=>{if(request.status!=='open')return false;const {email,name,note,...kept}=request;const changed=await db.run('UPDATE data_controls SET policy=?,updated=? WHERE scope=? AND policy=?',JSON.stringify({...kept,status,closed:now(),updated:now()}),now(),rScope,reqRow.policy);return changed.meta.changes===1};
  if(input.action==='teacher-verify-decline'){
   need(request.status==='open','There is no open verification request from this teacher.',404);
   need(await closeRequest('declined'),'The request changed. Reload the list.',409);
   await auditEvent(env,mScope,'teacher-verification-declined',{},now());return noStore({verificationDeclined:true});
  }
  const row=await db.one('SELECT policy FROM data_controls WHERE scope=?',mScope),member=parse(row?.policy);
  need(row&&member.role==='teacher'&&member.status==='active','Choose an active teacher from the list.',404);
  if(member.verified!==false){await closeRequest('approved');return noStore({verified:true,already:true})}
  const changed=await db.run('UPDATE data_controls SET policy=?,updated=? WHERE scope=? AND policy=?',JSON.stringify({...member,verified:true,verifiedAt:now(),verifiedBy:owner}),now(),mScope,row.policy);
  need(changed.meta.changes===1,'Access changed. Reload the list.',409);
  const closed=await closeRequest('approved');
  await auditEvent(env,mScope,'teacher-verified',{closedRequest:closed},now());return noStore({verified:true,closedRequest:closed});
 }
 if(input.action==='reassign'){
  need(access.admin,'Only the administrator can transfer a managed learner.',403);
  need(/^[a-f0-9]{64}$/.test(input.accountReference)&&/^[a-f0-9]{64}$/.test(input.manager),'Choose the learner and new organiser.');
  const scope='pilot-member:'+input.accountReference,row=await db.one('SELECT policy FROM data_controls WHERE scope=?',scope),member=parse(row?.policy),manager=await admission(env,input.manager);
  need(row&&member.role==='learner'&&['active','revoked'].includes(member.status),'Choose an existing learner.',404);
  need(manager.admitted&&(manager.admin||manager.role===(member.context==='family'?'guardian':'teacher')),'Choose an authorised organiser for this setting.',403);
  need(member.context==='individual'&&member.managedApproval!==true||canAdmitMinors(manager),'Verify this teacher before moving pupils to them.',403);
  need(input.manager!==input.accountReference,'A learner cannot manage their own access.');
  const changed=await db.run('UPDATE data_controls SET policy=?,updated=? WHERE scope=? AND policy=?',JSON.stringify({...member,manager:input.manager,tutorAllowed:false,sharingEpoch:crypto.randomUUID(),withdrawnClasses:undefined}),now(),scope,row.policy);
  need(changed.meta.changes===1,'Access changed. Reload the learner list.',409);
  await leaveClassesOf(env,input.accountReference,member.manager);await revokeLearnerClassGrants(env,input.accountReference);
  await auditEvent(env,scope,'organiser-changed',{},now());return noStore({reassigned:true});
 }
 if(input.action==='restore-access'){
  need(manages,'Only an authorised organiser can manage access.',403);
  const scope='pilot-member:'+input.accountReference,row=await db.one('SELECT policy FROM data_controls WHERE scope=?',scope),member=parse(row?.policy);
  need(member.status==='revoked'&&(access.admin||member.manager===owner),'Choose a withdrawn learner in your group.',403);
  const changed=await db.run('UPDATE data_controls SET policy=?,updated=? WHERE scope=? AND policy=?',JSON.stringify({...member,status:'active',sharingEpoch:crypto.randomUUID(),withdrawnClasses:undefined}),now(),scope,row.policy);
  need(changed.meta.changes===1,'Access changed. Reload the learner list.',409);
  await revokeLearnerClassGrants(env,input.accountReference);
  // Put them back in the organiser's classes they were in when access was withdrawn (only open ones;
  // shared work and course grants are not revived). Rows withdrawn before this was recorded have no list.
  const classes=Array.isArray(member.withdrawnClasses)?{rejoined:[],notRejoined:[]}:null;
  for(const w of member.withdrawnClasses||[]){
   const name=parse((await db.one('SELECT policy FROM data_controls WHERE scope=?',classScope(w.classId)))?.policy).name;
   if(await addToClass(env,{classId:w.classId,manager:member.manager,learner:input.accountReference,label:w.label,now:now(),via:'access-restored'}))classes.rejoined.push(name);else if(name)classes.notRejoined.push(name);
  }
  await auditEvent(env,scope,'access-restored',{},now());return noStore({restored:true,classes});
 }
 if(input.action==='revoke'){
  need(manages,'Only an authorised organiser can manage access.',403);need(/^[a-f0-9]{64}$/.test(input.accountReference)&&input.accountReference!==owner,'Use the learner’s account support reference.');
  const scope='pilot-member:'+input.accountReference,row=await db.one('SELECT policy FROM data_controls WHERE scope=?',scope),member=parse(row?.policy);need(row,'Learner membership not found.',404);need(access.admin||member.manager===owner,'This learner is not in your group.',403);
  need(['active','revoked'].includes(member.status),'This account is closing or already closed.',409);
  // Remember the organiser's classes they were in, so restoring access can put them back (a repeat withdrawal keeps the earlier list).
  const inClasses=await classesOf(env,input.accountReference,member.manager),kept=member.status==='revoked'&&Array.isArray(member.withdrawnClasses)?member.withdrawnClasses:[];
  const withdrawnClasses=[...kept,...inClasses.filter(x=>!kept.some(k=>k.classId===x.classId))].slice(0,20);
  const changed=await db.run('UPDATE data_controls SET policy=?,updated=? WHERE scope=? AND policy=?',JSON.stringify({...member,status:'revoked',sharingEpoch:crypto.randomUUID(),withdrawnClasses}),now(),scope,row.policy);
  need(changed.meta.changes===1,'Access changed. Reload the learner list.',409);
  await leaveClassesOf(env,input.accountReference,member.manager);await revokeLearnerClassGrants(env,input.accountReference);
  await auditEvent(env,scope,'access-revoked',{},now());return noStore({revoked:true,leftClasses:inClasses.length});
 }
 if(input.action==='close'){
  need(!access.admin,'Transfer administrator ownership before closing the administrator account.',409);need(input.confirmed===true&&typeof input.confirmEmail==='string'&&input.confirmEmail.trim().toLowerCase()===String(user.email).toLowerCase(),'Confirm your sign-in email before requesting account closure.');
  const closure=await requestClosure(env,{owner,siteOwner,user,store,now});
  await db.run('DELETE FROM data_controls WHERE scope=?',verifyRequestScope(owner)); // an open request holds their name and email
  return noStore({closure});
 }
 await requireAdmission(env,owner);
 if(input.action==='allowance-request'){
  need(Object.hasOwn(ALLOWANCE_REASONS,input.reason),'Choose why you need a higher allowance.');
  need(input.note===undefined||typeof input.note==='string'&&input.note.trim().length<=300,'Keep the note to 300 characters.');
  const scope=requestScope(siteOwner),row=await db.one('SELECT policy FROM data_controls WHERE scope=?',scope),previous=parse(row?.policy),at=now();
  const changes=(Array.isArray(previous.changes)?previous.changes:[]).filter(t=>Number.isFinite(t)&&t>at-86400000);
  need(changes.length<REQUEST_CHANGES_PER_DAY,'You have already sent '+REQUEST_CHANGES_PER_DAY+' allowance requests today. The administrator will see your latest one; try again tomorrow'+(env.PILOT_SUPPORT_EMAIL?' or email '+env.PILOT_SUPPORT_EMAIL:'')+'.',429);
  const request={status:'open',reason:input.reason,note:(input.note||'').trim(),accountReference:owner,name:String(user.name||'').slice(0,80),email:String(user.email||'').slice(0,254),created:previous.status==='open'?previous.created:at,updated:at,changes:[...changes,at]};
  const saved=row?await db.run('UPDATE data_controls SET policy=?,updated=? WHERE scope=? AND policy=?',JSON.stringify(request),at,scope,row.policy):await db.run('INSERT OR IGNORE INTO data_controls(scope,policy,updated) VALUES(?,?,?)',scope,JSON.stringify(request),at);
  need(saved.meta.changes===1,'Your request changed in another window. Reload and try again.',409);
  await auditEvent(env,'pilot-member:'+owner,previous.status==='open'?'allowance-request-updated':'allowance-requested',{reason:input.reason},at);
  return noStore({allowanceRequest:{status:'open',reason:request.reason,note:request.note,updated:at}});
 }
 if(input.action==='verify-request'){
  need(access.role==='teacher','Only teachers can ask to be verified.',403);need(!access.verified,'You are already verified as a teacher.',409);
  need(input.note===undefined||typeof input.note==='string'&&input.note.trim().length<=300,'Keep the note to 300 characters.');
  const scope=verifyRequestScope(owner),row=await db.one('SELECT policy FROM data_controls WHERE scope=?',scope),previous=parse(row?.policy),at=now();
  const changes=(Array.isArray(previous.changes)?previous.changes:[]).filter(t=>Number.isFinite(t)&&t>at-86400000);
  need(changes.length<REQUEST_CHANGES_PER_DAY,'You have already asked '+REQUEST_CHANGES_PER_DAY+' times today. The organiser will see your request'+(env.PILOT_SUPPORT_EMAIL?'; you can also email '+env.PILOT_SUPPORT_EMAIL:'')+'.',429);
  const request={status:'open',note:(input.note||'').trim(),accountReference:owner,name:String(user.name||'').slice(0,80),email:String(user.email||'').slice(0,254),created:previous.status==='open'?previous.created:at,updated:at,changes:[...changes,at]};
  const saved=row?await db.run('UPDATE data_controls SET policy=?,updated=? WHERE scope=? AND policy=?',JSON.stringify(request),at,scope,row.policy):await db.run('INSERT OR IGNORE INTO data_controls(scope,policy,updated) VALUES(?,?,?)',scope,JSON.stringify(request),at);
  need(saved.meta.changes===1,'Your request changed in another window. Reload and try again.',409);
  await auditEvent(env,'pilot-member:'+owner,'teacher-verification-requested',{},at);
  return noStore({verificationRequest:{status:'open',updated:at}});
 }
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
