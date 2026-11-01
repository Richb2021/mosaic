// Admission budget, not a bill or a provider quota. A queued AI request reserves
// a slot; failed/uncertain submissions retain it because they may have incurred cost.
export const GENERATION_WINDOW_MS=24*60*60*1000;
export const GENERATION_ROWS="json_type(CASE WHEN json_valid(payload) THEN payload ELSE '{}' END,'$.revisionOf') IS NOT 'object'";
export function generationLimit(env){
 const value=env.WORKSHOP_GENERATION_LIMIT;
 if(value===undefined||value===null)return 10;
 if(typeof value!=='string'||!/^\d{1,4}$/.test(value)||Number(value)>1000)return null;
 return Number(value);
}
export async function generationBudget(one,owner,env,now){
 const limit=generationLimit(env),since=now-GENERATION_WINDOW_MS;
 const {n}=await one(`SELECT COUNT(*) AS n FROM workshop_jobs WHERE owner=? AND created>? AND ${GENERATION_ROWS}`,owner,since);
 const used=Number(n),remaining=limit===null?0:Math.max(0,limit-used);
 let nextAvailableAt=null;
 if(limit>0&&used>=limit){const next=await one(`SELECT created FROM workshop_jobs WHERE owner=? AND created>? AND ${GENERATION_ROWS} ORDER BY created ASC LIMIT 1 OFFSET ?`,owner,since,used-limit);nextAvailableAt=next?Number(next.created)+GENERATION_WINDOW_MS:null;}
 return {limit,used,remaining,windowHours:24,nextAvailableAt,freeRevisions:true,configurationError:limit===null?'The workshop generation limit is not configured correctly. Manual revisions and existing chapters remain available.':null};
}
export function budgetMessage(b){
 if(b.configurationError)return b.configurationError;
 if(b.limit===0)return 'New AI generation requests are paused for this workshop. Manual revisions remain free of the AI limit.';
 return `This app’s limit of ${b.limit} AI generation requests per rolling 24 hours has been reached. ${b.nextAvailableAt?'A slot becomes available at '+new Date(b.nextAvailableAt).toISOString()+'. ':''}Manual revisions do not use this allowance. This is not a Meta API quota.`;
}
