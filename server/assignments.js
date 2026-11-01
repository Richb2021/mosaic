import {sqlDB,parse} from './data-control.js';
import {admission} from './pilot-access.js';
import {digest} from './content-service.js';
// Grants expose a published, read-only chapter, never the organiser's library,
// private notes, unfinished drafts, other learners' saves or provider responses.
export async function assignedChapters(env,owner){
 if(!env.DB||!owner)return [];
 const db=sqlDB(env.DB),access=await admission(env,owner);if(!access.admitted)return [];
 const grants=await db.all("SELECT policy FROM data_controls WHERE scope LIKE 'assignment:%' AND json_extract(policy,'$.learner')=? LIMIT 80",owner),rows=[];
 for(const row of grants){const g=parse(row.policy);if(g.manager!==access.manager)continue;
  const manager=await admission(env,g.manager);if(!manager.admitted)continue;
  const j=await db.one('SELECT id,draft,created,updated FROM workshop_jobs WHERE id=? AND owner=? AND status=?',g.jobId,g.siteOwner,'published');if(j?.draft&&(!g.draftHash||await digest(j.draft)===g.draftHash))rows.push(j);
 }
 return rows;
}
