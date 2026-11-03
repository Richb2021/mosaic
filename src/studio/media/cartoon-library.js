// Closed, decorative art library. Reviewed source/script IDs never change.
export const CARTOON_STYLES=Object.freeze({anime:'Prism anime',paper:'Paper comedy',original:'Field Notes'});
export const SETTING_EDITIONS=Object.freeze(['Original setting','Alternate setting','Further afield']);
export const CARTOON_MOTIONS=Object.freeze(['idle','talk','explain','think','react','celebrate','walk']);
const SCENES=['observatory','workshop','garden','city'],CAST=['guide','learner'],ROOT='/cartoon-art/';
const invalid=()=>{throw Error('The cartoon artwork library could not be verified.');};
export function validateCartoonLibrary(value,style,edition=0){
 if(!['anime','paper'].includes(style)||![0,1,2].includes(edition)||value?.version!==1)invalid();
 const pack=value.styles?.[style];if(!pack)invalid();let pixels=0;
 const check=(a,sprite=false)=>{if(!a||typeof a.url!=='string'||!new RegExp('^/cartoon-art/'+style+'/[a-z0-9-]+\\.webp$').test(a.url)||!Number.isInteger(a.width)||!Number.isInteger(a.height)||a.width<1||a.height<1||a.width>4096||a.height>4096)invalid();pixels+=a.width*a.height;
  if(sprite&&(!Number.isInteger(a.frameWidth)||!Number.isInteger(a.frameHeight)||a.frameWidth<1||a.frameHeight<1||!Number.isInteger(a.columns)||a.columns<1||!Number.isInteger(a.frames)||a.frames<2||a.frames>40||a.frameWidth*a.columns!==a.width||a.frameHeight*Math.ceil(a.frames/a.columns)!==a.height||!Number.isFinite(a.fps)||a.fps<1||a.fps>30))invalid();return a;};
 const backgrounds=Object.fromEntries(SCENES.map(id=>[id,check(pack.backgrounds?.[id]?.[edition])])),cast=Object.fromEntries(CAST.map(id=>[id,Object.fromEntries(CARTOON_MOTIONS.map(m=>[m,check(pack.cast?.[id]?.[m],true)]))]));
 if(pixels*4>190*1024*1024)invalid();return {style,edition,backgrounds,cast};
}
const abortError=()=>Object.assign(Error('Artwork loading cancelled.'),{name:'AbortError'});
export function loadCartoonImage(asset,{signal,ImageClass=globalThis.Image}={}){
 return new Promise((resolve,reject)=>{if(signal?.aborted)return reject(abortError());const img=new ImageClass();let timer;const clear=()=>{clearTimeout(timer);img.onload=null;img.onerror=null;signal?.removeEventListener('abort',abort);};const fail=e=>{clear();img.src='';reject(e);};const abort=()=>fail(abortError());signal?.addEventListener('abort',abort,{once:true});img.onload=()=>{if(img.naturalWidth!==asset.width||img.naturalHeight!==asset.height)return fail(Error('Cartoon artwork dimensions do not match the library.'));clear();resolve(img);};img.onerror=()=>fail(Error('Cartoon artwork could not be loaded. Check the connection and retry.'));timer=setTimeout(()=>fail(Error('Cartoon artwork took too long to load. Please retry.')),30000);img.src=asset.url;});
}
export async function loadCartoonLibrary(style,edition,{signal,fetcher=globalThis.fetch,imageLoader=loadCartoonImage,previous=null,manifestTimeoutMs=20000}={}){
 if(style==='original')return null;
 const controller=new AbortController(),abort=()=>controller.abort();if(signal?.aborted)throw abortError();signal?.addEventListener('abort',abort,{once:true});let timedOut=false;const timer=setTimeout(()=>{timedOut=true;controller.abort();},manifestTimeoutMs);
 try{
  const response=await fetcher(ROOT+'manifest.json',{signal:controller.signal,cache:'no-cache'});if(!response.ok)throw Error('Cartoon artwork is unavailable. You can still use Field Notes.');
  const pack=validateCartoonLibrary(await response.json(),style,edition);clearTimeout(timer);const assets=[...Object.values(pack.backgrounds),...Object.values(pack.cast).flatMap(Object.values)],images=new Map(),queue=[...new Map(assets.map(a=>[a.url,a])).values()];
  await Promise.all(Array.from({length:3},async()=>{while(queue.length){if(controller.signal.aborted)throw abortError();const a=queue.shift();const cached=previous?.style===style&&previous.images.get(a.url);images.set(a.url,cached&&cached.naturalWidth===a.width&&cached.naturalHeight===a.height?cached:await imageLoader(a,{signal:controller.signal}));}}));
  if(controller.signal.aborted)throw abortError();return {...pack,images};
 }catch(error){controller.abort();if(timedOut)throw Error('Cartoon artwork took too long to load. Please retry.');throw error;}finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
// Timing comes only from the narration clock, including seek and playback rate.
export function cartoonPerformance({speaker,active,action,elapsed,index=0,still=false}){
 const t=Number.isFinite(elapsed)?Math.max(0,elapsed):0;
 if(still)return {motion:active?(action==='talk'?'talk':action):'idle',time:0,entrance:1};
 if(index===0&&t<2)return {motion:'walk',time:t,entrance:Math.min(1,t/2)};
 const beat=index===0?Math.max(0,t-2):t;
 if(!active)return {motion:beat%10>=4&&beat%10<6?'react':'idle',time:beat%2,entrance:1};
 if(action==='think')return {motion:'think',time:Math.min(beat,.95),entrance:1};
 if(action==='celebrate'&&beat<2)return {motion:'celebrate',time:beat,entrance:1};
 const motion=beat%8>=2&&beat%8<4?'explain':'talk';return {motion,time:beat%2,entrance:1};
}
export function drawLibraryScene(ctx,pack,{segment,elapsed,index,still=false}){
 const bg=pack.backgrounds[segment.scene],background=pack.images.get(bg.url);if(!background)throw Error('The selected cartoon setting is not loaded.');
 ctx.save();ctx.beginPath();ctx.rect(0,0,1280,540);ctx.clip();ctx.drawImage(background,0,0,bg.width,bg.height,0,-180,1280,720);
 // A gentle stage shadow grounds feet without altering source illustrations.
 for(const [speaker,x,mirror] of [['guide',365,false],['learner',915,true]]){
  const p=cartoonPerformance({speaker,active:speaker===segment.speaker,action:segment.action,elapsed,index,still}),clip=pack.cast[speaker][p.motion],img=pack.images.get(clip.url);if(!img)throw Error('The selected cartoon performance is not loaded.');
  const close=!still&&(index>0||elapsed>=4),floor=close?(pack.style==='anime'?700:650):535;
  const n=Math.min(clip.frames-1,Math.floor(p.time*clip.fps)%clip.frames),h=pack.style==='anime'?(close?680:485):(close?550:420),w=h*clip.frameWidth/clip.frameHeight,px=x+(speaker==='guide'?-1:1)*(1-p.entrance)*110;
  if(!close){ctx.fillStyle='rgba(20,30,40,.15)';ctx.beginPath();ctx.ellipse(px,524,w*.24,10,0,0,Math.PI*2);ctx.fill();}ctx.save();ctx.translate(px,floor);ctx.scale(mirror?-1:1,1);ctx.drawImage(img,n%clip.columns*clip.frameWidth,Math.floor(n/clip.columns)*clip.frameHeight,clip.frameWidth,clip.frameHeight,-w/2,-h,w,h);ctx.restore();
 }
 ctx.restore();
}
