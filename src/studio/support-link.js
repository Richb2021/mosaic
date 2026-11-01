import {draftHash} from '../game-modes/draft-engine.js';
export function supportURL(pack,activity=''){
 return '/studio.html?'+new URLSearchParams({support:pack.id,hash:draftHash(pack),...(activity?{activity}:{})})+'#programme';
}
export function supportLink(pack,activity='',className='',label='Work through this idea'){
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 return `<a class="${esc(className)}" href="${esc(supportURL(pack,activity))}" target="_blank" rel="noopener" aria-label="${esc(label)} — opens learning studio in a new tab">${esc(label)}</a>`;
}
export function supportRequest(search){
 const q=new URLSearchParams(search);if(!q.has('support'))return null;
 const id=q.get('support'),hash=q.get('hash'),activity=q.get('activity')||'';
 if(!id||id.length>100||!hash||hash.length>100||activity.length>100)throw Error('This guided-support link is incomplete. Open the activity from the game or your programme.');
 return {id,hash,activity};
}
