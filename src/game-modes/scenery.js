// Curated cosmetic art only. Never add these choices to reviewed content or saves.
export const SCENERY=[{id:'original',name:'Riverlight · original'},{id:'sunstone',name:'Sunstone Coast'},{id:'frostvale',name:'Frostvale Highlands'},{id:'copperfield',name:'Copperfield Reach'}];
const ROOMS=['workshop','woods','archive','quay','garden','tower'];
const safeEntry=(entry,id)=>entry&&typeof entry.url==='string'&&new RegExp('^/game-modes/variety-art/'+id+'/[a-z-]+\\.webp$').test(entry.url);
export function validScenery(manifest){
 if(manifest?.version!==1||!manifest.themes)return null;
 const themes={};
 for(const {id} of SCENERY.slice(1)){
  const t=manifest.themes[id];if(!t)continue;
  if(!Object.entries({scenes:9,town:20,props:12,craft:8,cards:16}).every(([g,n])=>t[g]&&Object.keys(t[g]).length===n&&Object.values(t[g]).every(e=>safeEntry(e,id))))continue;
  if(![...ROOMS,'sports','merge','town'].every(k=>safeEntry(t.scenes[k],id)))continue;
  themes[id]=t;
 }
 return Object.keys(themes).length===3?manifest:Object.keys(themes).length?{...manifest,themes}:null;
}
export const availableScenery=manifest=>SCENERY.filter(t=>t.id==='original'||manifest?.themes?.[t.id]);
export function sceneryChoice(pack,storage){try{const v=storage?.getItem('mosaic:scenery:v1:'+pack.id);if(v==='auto'||SCENERY.some(t=>t.id===v))return v}catch{}return 'auto'}
export function selectedScenery(pack,choice='auto',manifest){
 const choices=manifest===undefined?SCENERY:availableScenery(manifest);if(choices.some(t=>t.id===choice))return choice;
 let n=0;for(const c of pack.id)n=(n*31+c.charCodeAt(0))>>>0;
 return choices.length>1?choices[1+n%(choices.length-1)].id:'original';
}
export function sceneryAssets(base,manifest,pack,choice='auto'){
 const valid=validScenery(manifest),id=selectedScenery(pack,choice,valid),t=valid?.themes[id];if(!t)return base;
 return {...base,scenery:id,rooms:{...base.rooms,...Object.fromEntries(ROOMS.map(k=>[k,t.scenes[k].url]))},tables:{...base.tables,draft:t.scenes.archive.url},cards:{...base.cards,...t.cards},town:{...base.town,backdrop:t.scenes.town.url,buildings:{...base.town?.buildings,...t.town}},expansion:{...base.expansion,props:{...base.expansion?.props,...t.props},town:{...base.expansion?.town,...t.town},craft:{...base.expansion?.craft,...t.craft},scenes:{...base.expansion?.scenes,'novel-square':t.scenes.quay,'novel-foundry':t.scenes.workshop}},extended:{...base.extended,backgrounds:{...base.extended?.backgrounds,vn:t.scenes.archive,quiz:t.scenes.tower,sports:t.scenes.sports,merge:t.scenes.merge},icons:{...base.extended?.icons,...t.craft}}};
}
