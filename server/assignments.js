import {sqlDB,parse} from './data-control.js';
import {admission} from './pilot-access.js';
import {digest} from './content-service.js';
import {learnerCourseGrants,grantChapters,memberBinding} from './course-grants.js';
// Grants expose a published, read-only chapter, never the organiser's library,
// private notes, unfinished drafts, other learners' saves or provider responses.
export async function assignedChapters(env,owner){
 if(!env.DB||!owner)return [];
 const db=sqlDB(env.DB),access=await admission(env,owner);if(!access.admitted)return [];
 const grants=await db.all("SELECT policy FROM data_controls WHERE scope LIKE 'assignment:%' AND json_extract(policy,'$.learner')=? LIMIT 80",owner),rows=[];
 const learner=await memberBinding(env,owner),managers=new Map();
 for(const row of grants){const g=parse(row.policy);if(g.manager!==access.manager)continue;
  if(!managers.has(g.manager))managers.set(g.manager,{access:await admission(env,g.manager),binding:await memberBinding(env,g.manager)});
  const manager=managers.get(g.manager);if(!manager.access.admitted)continue;
  // Legacy grants stay usable only until the first access change. New grants
  // bind both memberships, just like course grants, so restoration cannot revive them.
  if(g.learnerBinding||g.managerBinding){if(g.learnerBinding!==learner.key||g.managerBinding!==manager.binding.key)continue;}
  else if(learner.member.sharingEpoch||manager.binding.member.sharingEpoch)continue;
  const j=await db.one('SELECT id,draft,created,updated FROM workshop_jobs WHERE id=? AND owner=? AND status=?',g.jobId,g.siteOwner,'published');if(j?.draft&&(!g.draftHash||await digest(j.draft)===g.draftHash))rows.push(j);
 }
 for(const g of await learnerCourseGrants(env,owner))rows.push(...await grantChapters(env,g));
 return [...new Map(rows.map(j=>[j.id,j])).values()];
}
