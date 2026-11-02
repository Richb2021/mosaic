// Exact, reviewed question versions stay separate from game-content identities.
export function programmeCycles(cycles,unit){
 if(!unit)return [];
 const rank=c=>c.stage==='revisit'&&!c.waiting?0:c.attempts>0&&c.stage!=='complete'&&!c.waiting?1:c.stage==='diagnostic'?2:c.stage==='revisit'?3:4;
 return (cycles||[]).filter(c=>c.packId===unit.packId&&c.contentHash===unit.contentHash&&unit.activityKeys.includes(c.activityKey)).slice().sort((a,b)=>rank(a)-rank(b)||(rank(a)===0?a.dueAt-b.dueAt:0)||b.updated-a.updated);
}
const bankOK=(id,hash)=>typeof id==='string'&&/^[a-z0-9-]{1,100}$/.test(id)&&typeof hash==='string'&&/^[a-f0-9]{64}$/.test(hash);
export function cycleLocation(id,hash){return bankOK(id,hash)?'/studio.html?'+new URLSearchParams({cycle:id,cycleHash:hash})+'#programme':null;}
export function requestedCycle(search){const q=new URLSearchParams(search);if(!q.has('cycle')&&!q.has('cycleHash'))return null;return bankOK(q.get('cycle'),q.get('cycleHash'))?{id:q.get('cycle'),hash:q.get('cycleHash')}:{invalid:true};}
export function cycleGameLocation(url,id,hash,identity){if(!cycleLocation(id,hash)||!identity?.packId||!identity.contentHash)return url;const target=new URL(url,'https://mosaic.invalid');target.searchParams.set('returnCycle',id);target.searchParams.set('returnHash',hash);target.searchParams.set('returnPack',identity.packId);target.searchParams.set('returnContent',identity.contentHash);return target.pathname+target.search;}
export function gameReturnLocation(search,identity){const q=new URLSearchParams(search);if(!identity||q.get('returnPack')!==identity.packId||q.get('returnContent')!==identity.contentHash)return null;return cycleLocation(q.get('returnCycle'),q.get('returnHash'));}
export function modeGameLocation(search,identity,classic=false){const params=new URLSearchParams({game:identity.packId});if(classic)params.set('classic','1');if(gameReturnLocation(search,identity)){const incoming=new URLSearchParams(search);for(const key of ['returnCycle','returnHash','returnPack','returnContent'])params.set(key,incoming.get(key));}return '/modes.html?'+params;}
export function cycleProgressText(cycle){
 if(cycle.stage==='diagnostic')return 'A reviewed starting question is ready. Try it, choose “Not sure”, or go straight to the game.';
 if(cycle.stage==='complete')return 'Your four practice answers are recorded. Review the feedback or choose another focus.';
 if(cycle.waiting)return 'Your first three answers are saved. A fresh question is scheduled for a later visit.';
 return cycle.reason;
}
