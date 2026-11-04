import {loadCartoonImage} from './cartoon-library.js';
// Edition 3 is "Made for this story": the library pack with the episode's own backdrops swapped in.
// A backdrop that is missing or fails to load keeps the library setting, so playback never breaks.
export const STORY_EDITION=3;
const SCENES=['observatory','workshop','garden','city'];
export function validStorySets(value){
 if(!Array.isArray(value))return [];
 return value.filter(s=>['anime','paper'].includes(s?.style)&&s.scenes&&typeof s.scenes==='object').map(s=>({style:s.style,version:s.version??null,scenes:Object.fromEntries(Object.entries(s.scenes).filter(([scene,b])=>SCENES.includes(scene)&&Number.isInteger(b?.width)&&Number.isInteger(b?.height)&&b.width>0&&b.height>0&&b.width<=4096&&b.height<=4096).map(([scene,b])=>[scene,{width:b.width,height:b.height,...(Number.isInteger(b.attempt)?{attempt:b.attempt}:{})}]))})).filter(s=>Object.keys(s.scenes).length);
}
export const storySetKey=sets=>JSON.stringify(validStorySets(sets).map(s=>[s.style,s.version,Object.entries(s.scenes)]));
export async function withStoryArt(pack,set,load,{signal,imageLoader=loadCartoonImage,makeURL=b=>URL.createObjectURL(b),urls=[]}={}){
 const out={...pack,edition:STORY_EDITION,backgrounds:{...pack.backgrounds},images:new Map(pack.images),missingBackdrops:[]};
 await Promise.all(Object.entries(set.scenes).filter(([scene])=>out.backgrounds[scene]).map(async([scene,size])=>{
  try{
   const blob=await load(set.style,scene,size);if(signal?.aborted)throw Object.assign(Error('Cancelled'),{name:'AbortError'});
   if(!(blob instanceof Blob)||!blob.size||!blob.type.startsWith('image/'))throw Error('Not an image.');
   const url=makeURL(blob);urls.push(url);const img=await imageLoader({url,width:size.width,height:size.height},{signal});
   out.backgrounds[scene]={url,width:size.width,height:size.height};out.images.set(url,img);
  }catch(e){if(e?.name==='AbortError')throw e;out.missingBackdrops.push(scene);}
 }));
 return out;
}
// What the author's preview player shows: the chosen picture for each scene, approved or not.
export function previewSets(data){
 return (data?.sets||[]).map(set=>({style:set.style,version:set.status+':'+(set.approvedAt||''),scenes:Object.fromEntries(Object.entries(set.scenes).flatMap(([scene,s])=>{const a=s.attempts[s.chosen];return a?.status==='ready'?[[scene,{width:a.width,height:a.height,attempt:s.chosen}]]:[]}))})).filter(s=>Object.keys(s.scenes).length);
}
