import {assignmentSettings} from './assignment-settings.js';
import {publicLearningResource} from './course-learning-resources.js';
import {publicQuestionBank} from './course-question-banks.js';
import {sqlDB,parse,need,readControls} from './data-control.js';
import {admission} from './pilot-access.js';
import {digest} from './content-service.js';
export const grantScope=id=>'course-grant:'+id;
export const consentScope=id=>'course-consent:'+id;
// Preserve all 256 identity bits while fitting NCB's 64-character slot column.
export const reportSlot=id=>'course-report:'+btoa(String.fromCharCode(...id.match(/../g).map(n=>parseInt(n,16)))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
export const courseGrantId=(manager,learner,courseId)=>digest(JSON.stringify([manager,learner,courseId]));
export async function memberBinding(env,principal){
 const row=await sqlDB(env.DB).one('SELECT policy FROM data_controls WHERE scope=?','pilot-member:'+principal),p=parse(row?.policy);
 return {member:p,key:await digest(JSON.stringify([p.invite||null,p.joined||null,p.manager||null,p.sharingEpoch||null]))};
}
// Protect both the source workspace and recipient from concurrent cleanup. The
// caller cannot supply the scopes: they come from an authorised saved grant.
export async function withGrantLease(env,g,now,handler){
 const db=sqlDB(env.DB),state=await readControls(env,g.siteOwner,g.learner,now()),leases=[];
 try{
  for(const c of Object.values(state.controls)){
   need(!c.operation,'Course data cleanup is in progress. Reload when it finishes.',423);
   const id=crypto.randomUUID(),r=await db.run('INSERT INTO data_leases(id,scope,expires) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM data_controls WHERE scope=? AND epoch=? AND operation IS NULL)',id,c.scope,now()+15*60000,c.scope,c.epoch);
   need(r.meta.changes===1,'Course data changed. Reload before continuing.',409);leases.push(id);
  }
  return await handler(state);
 }finally{for(const id of leases)await db.run('DELETE FROM data_leases WHERE id=?',id)}
}
// Class grants: a teacher may assign a course to a class they own. The class, not
// the organiser relationship, authorises it, so it ends when the learner leaves or is
// removed. Only the learner's own group, or self-directed adult learners (individual
// context), can receive work this way; learners whose access a school or family
// arranged stay with that organiser.
export const classGrantKey=(c,m)=>digest(JSON.stringify(['class-grant',c.id,c.created,m.joined]));
export const selfDirected=learner=>learner.context==='individual'&&learner.managedApproval!==true;
export const classAssignable=(learner,principal)=>learner.admitted&&learner.role==='learner'&&(learner.manager===principal||selfDirected(learner));
async function classMembership(env,g){
 if(typeof g.classId!=='string'||typeof g.classBinding!=='string')return false;
 const db=sqlDB(env.DB),c=parse((await db.one('SELECT policy FROM data_controls WHERE scope=?','class:'+g.classId))?.policy),m=parse((await db.one('SELECT policy FROM data_controls WHERE scope=?','class-member:'+g.classId+':'+g.learner))?.policy);
 return c.owner===g.manager&&c.siteOwner===g.siteOwner&&m.status==='active'&&await classGrantKey(c,m)===g.classBinding;
}
export async function activeCourseGrant(env,g){
 if(!g||g.revoked||!Array.isArray(g.steps)||!g.steps.length||g.steps.length>6)return false;
 const learner=await admission(env,g.learner),manager=await admission(env,g.manager);
 if(!learner.admitted||learner.role!=='learner'||!manager.admitted||!['administrator','teacher','guardian'].includes(manager.role))return false;
 if(learner.manager!==g.manager&&!(g.classId&&selfDirected(learner)&&await classMembership(env,g)))return false;
 return (await memberBinding(env,g.learner)).key===g.learnerBinding&&(await memberBinding(env,g.manager)).key===g.managerBinding;
}
export async function grantChapters(env,g){
 if(!await activeCourseGrant(env,g))return [];
 const db=sqlDB(env.DB),rows=[];
 for(const source of g.sources||[]){const r=await db.one('SELECT checksum,status FROM workshop_resources WHERE owner=? AND id=?',g.siteOwner,source.id);if(!r||r.status!=='reviewed'||r.checksum!==source.checksum)return []}
 for(const step of g.steps){const j=await db.one('SELECT id,draft,created,updated FROM workshop_jobs WHERE id=? AND owner=? AND status=?',step.jobId,g.siteOwner,'published');if(!j?.draft||await digest(j.draft)!==step.hash)return [];rows.push(j)}
 return [...new Map(rows.map(j=>[j.id,j])).values()];
}
export async function learnerCourseGrants(env,learner){
 return (await sqlDB(env.DB).all("SELECT scope,policy FROM data_controls WHERE scope LIKE 'course-grant:%' AND json_extract(policy,'$.learner')=? AND json_extract(policy,'$.revoked')=0 ORDER BY scope LIMIT 25",learner)).map(r=>({...parse(r.policy),id:r.scope.slice(13)}));
}
export function publicCourseGrant(g){return {id:g.id,revision:g.revision,title:g.title,...(g.className?{className:g.className}:{}),courseId:g.courseId,planId:g.planId,planHash:g.planHash,assignedAt:g.assignedAt,settings:assignmentSettings(g.settings),steps:g.steps.map(({id,objective,jobId,hash,title,topicTitle,questionBank,learningResources})=>({id,objective,jobId,hash,title,topicTitle,...(questionBank?{questionBank:publicQuestionBank(questionBank)}:{}),...(learningResources?{learningResources:learningResources.map(publicLearningResource)}:{})}))};}
// Existing export/deletion flows use this owner-scoped inventory. It contains no
// other learner's report payload; those remain in their NCB account.
export async function courseGrantRecords(env,owner,siteOwner){
 const db=sqlDB(env.DB),grants=await db.all("SELECT scope,policy,updated FROM data_controls WHERE scope LIKE 'course-grant:%' AND (json_extract(policy,'$.learner')=? OR (json_extract(policy,'$.owner')=? AND json_extract(policy,'$.siteOwner')=?)) ORDER BY scope",owner,owner,siteOwner),consents=[];
 for(const r of grants){const g=parse(r.policy);if(g.learner===owner){const c=await db.one('SELECT scope,policy,updated FROM data_controls WHERE scope=?',consentScope(r.scope.slice(13)));if(c)consents.push(c)}}
 return {grants,consents};
}
