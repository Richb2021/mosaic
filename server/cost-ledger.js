import {sqlDB,DAY,parse,need} from './data-control.js';
// Official list prices verified 1 November 2026. These are estimates, not bills.
export function costRates(env){
 const value=(key,fallback)=>env[key]===undefined?fallback:/^\d+(\.\d+)?$/.test(String(env[key]))&&Number(env[key])<=1000000?Number(env[key]):null;
 return {version:'2026-11-01',currency:'USD',input:value('COST_META_INPUT_PER_M',4),cached:value('COST_META_CACHED_PER_M',0.2),output:value('COST_META_OUTPUT_PER_M',20),fishBytes:value('COST_FISH_BYTES_PER_M',15)};
}
export function metaUsage(raw){
 if(!raw||!['input_tokens','output_tokens'].every(k=>Number.isSafeInteger(raw[k])&&raw[k]>=0))return null;
 const cache=raw.input_tokens_details?.cached_tokens;
 if(cache!==undefined&&(!Number.isSafeInteger(cache)||cache<0||cache>raw.input_tokens))return null;
 return {inputTokens:raw.input_tokens,outputTokens:raw.output_tokens,cachedTokens:cache??null};
}
export function estimateMicros(model,usage,rates){
 if(!usage)return null;
 if(model==='muse-wonder-1.0'){if([rates.input,rates.cached,rates.output].some(x=>x===null))return null;return Math.round((usage.inputTokens-(usage.cachedTokens||0))*rates.input+(usage.cachedTokens||0)*rates.cached+usage.outputTokens*rates.output);}
 if(model==='s2.1-pro')return rates.fishBytes===null?null:Math.round(usage.inputBytes*rates.fishBytes);
 return null;
}
export function budgetLimits(env){
 const read=(key,fallback)=>{const v=env[key]??fallback;need(/^\d+(\.\d{1,6})?$/.test(String(v))&&Number(v)<=10000,'Generation budget configuration needs attention. No provider request was sent.',503);return Math.round(Number(v)*1e6)};
 return {personal:read('PILOT_DAILY_BUDGET_USD',5),global:read('PILOT_GLOBAL_DAILY_BUDGET_USD',25)};
}
export function reservedCost(model,request,rates){
 if(model==='muse-wonder-1.0'){
  need(request&&Number.isSafeInteger(request.max_output_tokens),'Cannot reserve this generation request.',503);
  // A conservative allocation, not a promise about the provider invoice.
  return estimateMicros(model,{inputTokens:new TextEncoder().encode(JSON.stringify(request)).length+4096,outputTokens:request.max_output_tokens,cachedTokens:0},rates);
 }
 if(model==='s2.1-pro'){need(Number.isSafeInteger(request?.inputBytes),'Cannot reserve narration cost.',503);return estimateMicros(model,request,rates);}
 throw Object.assign(Error('Unpriced provider request is disabled.'),{status:503});
}
const allocationSQL="MAX(COALESCE(estimate_micros,0),CASE WHEN status='measured' THEN 0 ELSE COALESCE(json_extract(rates,'$.reservedMicros'),10000000) END)";
export async function budgetStatus(env,siteOwner,now=Date.now()){
 let limits;try{limits=budgetLimits(env)}catch{return {configured:false,limitUsd:0,allocatedUsd:0,remainingUsd:0,notice:'Generation budget configuration needs attention. Saved learning and data controls remain available.'}}
 const start=Math.floor(now/DAY)*DAY,db=sqlDB(env.DB);
 const personal=await db.one(`SELECT COALESCE(SUM(${allocationSQL}),0) AS n FROM cost_receipts WHERE site_owner=? AND created>=?`,siteOwner,start);
 return {limitUsd:limits.personal/1e6,allocatedUsd:personal.n/1e6,remainingUsd:Math.max(0,limits.personal-personal.n)/1e6,resetsAt:start+DAY};
}
export async function startCost(env,{id,siteOwner,learnerOwner=null,model,request,now=Date.now()}){
 const db=sqlDB(env.DB),prior=await db.one('SELECT site_owner FROM cost_receipts WHERE id=?',id);
 if(prior){need(prior.site_owner===siteOwner,'Cost receipt belongs to another workspace.',409);return;}
 const rates=costRates(env),enforced=env.PILOT_ENABLED==='true';
 const controls=parse((await db.one('SELECT policy FROM data_controls WHERE scope=?','launch:controls'))?.policy);
 need(controls.paused!==true,'New generation is paused by the administrator. Saved activities and recordings remain available.',503);
 if(!enforced){await db.run('INSERT OR IGNORE INTO cost_receipts(id,site_owner,learner_owner,model,status,rates,created,updated) VALUES(?,?,?,?,?,?,?,?)',id,siteOwner,learnerOwner,model,'submitted',JSON.stringify(rates),now,now);return;}
 const reserved=reservedCost(model,request,rates);need(reserved!==null,'Provider prices are unavailable. No request was sent.',503);
 const limits=budgetLimits(env),start=Math.floor(now/DAY)*DAY;
 const result=await db.run(`INSERT OR IGNORE INTO cost_receipts(id,site_owner,learner_owner,model,status,rates,created,updated) SELECT ?,?,?,?,?,?,?,? WHERE (SELECT COALESCE(SUM(${allocationSQL}),0) FROM cost_receipts WHERE site_owner=? AND created>=?)+?<=? AND (SELECT COALESCE(SUM(${allocationSQL}),0) FROM cost_receipts WHERE created>=?)+?<=?`,id,siteOwner,learnerOwner,model,'submitted',JSON.stringify({...rates,reservedMicros:reserved}),now,now,siteOwner,start,reserved,limits.personal,start,reserved,limits.global);
 need(result.meta.changes===1,'The daily generation budget is fully allocated. Saved activities, recordings and manual edits remain available. No provider request was sent.',429);
}
export async function finishCost(env,{id,siteOwner,usage=null,status='unknown',now=Date.now()}){
 const db=sqlDB(env.DB),receipt=await db.one('SELECT * FROM cost_receipts WHERE id=? AND site_owner=?',id,siteOwner);if(!receipt)return;
 // Polls carry the same response usage; missing/failed polls cannot erase it.
 if(!usage&&receipt.usage)return;
 await db.run('UPDATE cost_receipts SET usage=?,status=?,estimate_micros=?,updated=? WHERE id=? AND site_owner=?',usage?JSON.stringify(usage):null,usage?'measured':status,estimateMicros(receipt.model,usage,parse(receipt.rates)),now,id,siteOwner);
}
export async function costSummary(env,{siteOwner,learnerOwner,now=Date.now()}){
 const db=sqlDB(env.DB),rows=await db.all('SELECT id,model,status,usage,rates,estimate_micros,created FROM cost_receipts WHERE site_owner=? AND learner_owner=? AND created>? ORDER BY created DESC',siteOwner,learnerOwner,now-30*DAY);
 const storage=await db.one('SELECT COALESCE(SUM(bytes),0) AS bytes,COUNT(*) AS clips FROM media_assets WHERE site_owner=? AND learner_owner=? AND status=?',siteOwner,learnerOwner,'ready');
 const workspace=await db.one('SELECT COUNT(*) AS requests,COALESCE(SUM(estimate_micros),0) AS micros,SUM(CASE WHEN estimate_micros IS NULL THEN 1 ELSE 0 END) AS unpriced FROM cost_receipts WHERE site_owner=? AND created>?',siteOwner,now-30*DAY);
 return {budget:await budgetStatus(env,siteOwner,now),workspace:{requests:workspace.requests,estimateUsd:workspace.micros/1e6,unpriced:workspace.unpriced||0},periodDays:30,rows:rows.map(r=>({...r,usage:r.usage?parse(r.usage):null,rates:parse(r.rates)})),estimateUsd:rows.reduce((s,r)=>s+(r.estimate_micros||0),0)/1e6,unpriced:rows.filter(r=>r.estimate_micros===null).length,storageBytes:storage.bytes,storedClips:storage.clips,notice:'List-price estimates for tracked provider requests, not an invoice. Unknown usage is not zero. Stored playback and edits do not create provider charges. Storage capacity is measured; hosting, database and storage operation charges are not included.',sources:['https://dev.meta.ai/docs/pricing-rate-limits','https://docs.fish.audio/developer-guide/models-pricing/pricing-and-rate-limits']};
}
