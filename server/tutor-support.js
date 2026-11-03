import {sqlDB} from './data-control.js';
// A conversation used since the previous first response marks the next response
// as assisted. Later fresh responses remain independently recordable.
export async function tutorSupportSince(env,{siteOwner,owner,packId,contentHash,activityKey,since=0}){
 return !!await sqlDB(env.DB).one("SELECT id FROM workshop_jobs WHERE owner=? AND json_extract(payload,'$.recordType')='creative' AND json_extract(payload,'$.kind')='tutor' AND json_extract(payload,'$.learnerOwner')=? AND json_extract(payload,'$.packId')=? AND json_extract(payload,'$.contentHash')=? AND json_extract(payload,'$.activityKey')=? AND status!='creative-queued' AND updated>=? LIMIT 1",siteOwner,owner,packId,contentHash,activityKey,since);
}
