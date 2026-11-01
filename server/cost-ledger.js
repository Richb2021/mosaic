import {sqlDB,DAY,parse} from './data-control.js';
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
export async function startCost(env,{id,siteOwner,learnerOwner=null,model,now=Date.now()}){
 await sqlDB(env.DB).run('INSERT OR IGNORE INTO cost_receipts(id,site_owner,learner_owner,model,status,rates,created,updated) VALUES(?,?,?,?,?,?,?,?)',id,siteOwner,learnerOwner,model,'submitted',JSON.stringify(costRates(env)),now,now);
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
 return {workspace:{requests:workspace.requests,estimateUsd:workspace.micros/1e6,unpriced:workspace.unpriced||0},periodDays:30,rows:rows.map(r=>({...r,usage:r.usage?parse(r.usage):null,rates:parse(r.rates)})),estimateUsd:rows.reduce((s,r)=>s+(r.estimate_micros||0),0)/1e6,unpriced:rows.filter(r=>r.estimate_micros===null).length,storageBytes:storage.bytes,storedClips:storage.clips,notice:'List-price estimates for tracked provider requests, not an invoice. Unknown usage is not zero. Stored playback and edits do not create provider charges. Storage capacity is measured; hosting, database and storage operation charges are not included.',sources:['https://dev.meta.ai/docs/pricing-rate-limits','https://docs.fish.audio/developer-guide/models-pricing/pricing-and-rate-limits']};
}
