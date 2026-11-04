// Story backdrops: one Muse Image picture per cartoon setting, made for the episode's subject
// in the chosen art style. The author reviews and approves them before learners see them.
// Anything missing, refused or failed falls back to the curated library backdrop for that scene.
import {readJSON,noStore} from './ncb-auth.js';
import {sqlDB,parse,need,readControls,DAY} from './data-control.js';
import {digest} from './content-service.js';
import {startCost,finishCost} from './cost-ledger.js';
import {creativePermissions} from './tutor-access.js';
import {validateCreative,SCENES} from '../src/studio/creative-content.js';
import {generationBudget,GENERATION_ROWS,GENERATION_WINDOW_MS,budgetMessage} from './workshop-budget.js';

export const IMAGE_MODEL='muse-image-1.0';
export const BACKDROP_RECIPE='muse-image-1.0-16x9-webp-low-notools-v1';
export const BACKDROP_RECORD='cartoon-backdrops',IMAGE_RECORD='backdrop-image';
export const MAX_ATTEMPTS=2,PENDING_MS=3*60000,MAX_IMAGE_BYTES=8*1024*1024;
export const backdropsEnabled=env=>env.CARTOON_BACKDROPS==='on';

// Same look as the curated packs in public/cartoon-art (see output/cartoon-variety/raw/prompts.json).
export const BACKDROP_STYLES=Object.freeze({
 anime:{label:'Prism anime',look:'Premium contemporary original anime background painting: crisp confident contour ink, clean two-tone cel shading, controlled cinematic colour, soft luminous skies, warm natural light and richly layered detail.'},
 paper:{label:'Paper comedy',look:'Original flat cut-paper comedy animation background: boldly separated flat coloured paper shapes with subtly fibrous edges, simple rounded geometric forms, a cheerful saturated palette, no gradients, no realistic shading.'}
});
// Each preset scene keeps its role in the story; only the place changes with the subject.
const ROLES=Object.freeze({
 observatory:s=>`a high lookout with a wide view over ${s}`,
 workshop:s=>`an indoor workroom where people study or make things to do with ${s}`,
 garden:s=>`an outdoor natural place connected with ${s}`,
 city:s=>`a street or square in a place connected with ${s}`
});
const segmentCode=(scene,attempt)=>-(10*(SCENES.indexOf(scene)+1)+attempt);

export function scenesUsed(script){return [...new Set((script?.segments||[]).map(s=>s.scene).filter(s=>SCENES.includes(s)))].slice(0,4);}
export function cleanSubject(value){return String(value||'').replace(/[\u0000-\u001f\u007f]+/g,' ').replace(/https?:\S+/gi,'').replace(/\s+/g,' ').trim().slice(0,80)||'the topic';}
// The subject comes from the reviewed source's name ("The water cycle: teacher notes" -> "the water cycle");
// chapter titles are often playful, so they are only the fallback.
export function topicOf(context){
 const strip=t=>cleanSubject(String(t||'').split(/\s[—–-]\s|:\s|\(/)[0].replace(/\b(reviewed|classroom|teacher|teachers|lesson|revision|study|field|notes|guide|handout|worksheet|uploaded|authored|summary)\b/gi,' ')).replace(/\s+/g,' ').trim();
 const fromSource=context?.evidence?.[0]?.title?strip(context.evidence[0].title):'';return (fromSource.length>=3?fromSource:cleanSubject(context?.title)).toLowerCase();
}
export function suggestPlaces(script,context){const topic=topicOf(context);return Object.fromEntries(scenesUsed(script).map(scene=>[scene,ROLES[scene](topic)]));}
export function cleanPlace(value){
 need(typeof value==='string','Describe the place for this backdrop.');
 const place=value.replace(/[\u0000-\u001f\u007f]+/g,' ').replace(/\s+/g,' ').trim();
 need(place.length>=3&&place.length<=160,'Describe the place in 3 to 160 characters.');
 need(!/https?:|www\./i.test(place),'Describe the place in words; links are not used.');
 return place;
}
export function backdropPrompt({style,place,subject,story=null}){
 const premise=story?.premise?cleanSubject(String(story.premise).slice(0,300)):'';
 const pack=BACKDROP_STYLES[style];need(pack,'Choose Prism anime or Paper comedy.');
 return [pack.look,
  'A polished production animation BACKGROUND ONLY, full-bleed wide landscape composition for a short educational cartoon about '+cleanSubject(subject)+'.',
  'Place: '+cleanPlace(place)+'.',
  'Show the place itself, clearly recognisable for the subject, as an original fictional illustration.',
  ...(premise?['Story context, for mood and setting only (never draw its characters): '+premise]:[]),
  'No people, characters, animals, faces, silhouettes, statues or portraits.',
  'Stage composition: clear open flat foreground floor along the bottom third; two presenters will be added later standing at 30 and 70 percent across, so keep those areas calm and uncluttered. Horizon around 55 percent height. Straight-on eye-level camera, no fisheye.',
  'Suitable for all ages: no injuries, danger to people, weapons, blood or frightening imagery.',
  'Absolutely no text, letters, numbers, signs, labels, logos, brands, flags, UI, borders, diagrams or captions.'].join(' ');
}
export function imageRequest(prompt,user){
 return {model:IMAGE_MODEL,prompt,n:1,size:'1280x720',output_format:'webp',response_format:'b64_json',reasoning_strength:'low',
  // No web or image search: the picture is an original illustration, never a copied photo of a real place or person.
  tool_enablement:{enable_image_search:false,enable_web_search:false,enable_shell:false},user};
}
// WebP header sizes (lossy, lossless and extended). Returns null for anything else.
export function webpSize(b){
 if(!(b instanceof Uint8Array)||b.length<30||String.fromCharCode(...b.slice(0,4))!=='RIFF'||String.fromCharCode(...b.slice(8,12))!=='WEBP')return null;
 const kind=String.fromCharCode(...b.slice(12,16));
 if(kind==='VP8 ')return {width:(b[26]|b[27]<<8)&0x3fff,height:(b[28]|b[29]<<8)&0x3fff};
 if(kind==='VP8L'&&b[20]===0x2f)return {width:1+(((b[22]&0x3f)<<8)|b[21]),height:1+(((b[24]&0xf)<<10)|(b[23]<<2)|((b[22]&0xc0)>>6))};
 if(kind==='VP8X')return {width:1+(b[24]|b[25]<<8|b[26]<<16),height:1+(b[27]|b[28]<<8|b[29]<<16)};
 return null;
}
export class BackdropError extends Error{constructor(message,status,{refused=false,billed=null}={}){super(message);this.status=status;this.refused=refused;this.billed=billed;}}
export function readImageResponse(data){
 const item=Array.isArray(data?.data)&&data.data.length===1?data.data[0]:null;
 if(typeof item?.b64_json!=='string'||item.b64_json.length>MAX_IMAGE_BYTES*1.4)throw new BackdropError('Muse Image returned no picture.',502,{billed:null});
 let bytes;try{bytes=Uint8Array.from(atob(item.b64_json),c=>c.charCodeAt(0))}catch{throw new BackdropError('Muse Image returned an unreadable picture.',502)}
 const size=webpSize(bytes);
 if(!size||size.width<512||size.height<288||size.width>4096||size.height>4096||size.width/size.height<1.5||size.width/size.height>2)throw new BackdropError('Muse Image returned a picture in an unexpected shape.',502,{billed:true});
 return {bytes,...size};
}
export async function generateBackdrop(request,key,fetcher=fetch){
 need(key,'Muse Image is not connected. No request was sent.',503);
 let response;
 try{response=await fetcher('https://api.meta.ai/v1/images/generations',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(request),signal:AbortSignal.timeout(100000),redirect:'manual'})}
 catch(e){throw new BackdropError('Muse Image did not answer in time. No automatic repeat was sent.',504,{billed:null})}
 const text=await response.text(),data=(()=>{try{return JSON.parse(text)}catch{return null}})();
 if(!response.ok){
  const code=data?.error?.code;
  if(code==='content_policy_violation')throw new BackdropError('Muse Image declined this place description. Try describing it differently.',422,{refused:true,billed:false});
  if(code==='model_not_found')throw new BackdropError('Muse Image is not available to this account. Nothing was generated.',503,{billed:false});
  throw new BackdropError(response.status===429?'Muse Image is busy. Try again in a minute.':response.status===400?'Muse Image could not accept this request.':`Muse Image request failed (HTTP ${response.status}).`,502,{billed:response.status>=500?null:false});
 }
 return readImageResponse(data);
}

// --- Storage ---------------------------------------------------------------------------------
const setId=async(siteOwner,owner,scriptId,style)=>'backdrops-'+(await digest(JSON.stringify([siteOwner,owner,scriptId,style]))).slice(0,48);
const publicAttempt=a=>({status:a.status,width:a.width||null,height:a.height||null,error:a.error||null,created:a.created});
export function publicSet(row){if(!row)return null;const p=parse(row.payload);return {id:row.id,style:p.style,status:row.status.replace(/^backdrops-/,''),approvedAt:p.approvedAt||null,scenes:Object.fromEntries(Object.entries(p.scenes||{}).map(([scene,s])=>[scene,{place:s.place,chosen:Number.isInteger(s.chosen)?s.chosen:null,attempts:(s.attempts||[]).map(publicAttempt),canRetry:(s.attempts||[]).length<MAX_ATTEMPTS}]))};}
// The pictures a learner (or the video renderer) may use: approved sets, chosen pictures only.
export async function approvedBackdrops(env,{siteOwner,author,scriptId}){
 if(!env.DB)return [];const rows=await sqlDB(env.DB).all("SELECT * FROM workshop_jobs WHERE owner=? AND status='backdrops-approved' AND json_extract(payload,'$.recordType')=? AND json_extract(payload,'$.learnerOwner')=? AND json_extract(payload,'$.scriptId')=? ORDER BY created",siteOwner,BACKDROP_RECORD,author,scriptId);
 return rows.map(r=>{const p=parse(r.payload),scenes={};for(const [scene,s] of Object.entries(p.scenes||{})){const a=s.attempts?.[s.chosen];if(a?.status==='ready')scenes[scene]={width:a.width,height:a.height};}return {style:p.style,version:p.approvedAt,scenes};}).filter(s=>Object.keys(s.scenes).length);
}
export async function backdropBytes(env,{siteOwner,author,scriptId,style,scene,attempt=null,approvedOnly=true,now=Date.now()}){
 need(Object.hasOwn(BACKDROP_STYLES,style)&&SCENES.includes(scene),'Choose a backdrop.');need(env.BUCKET,'Stored backdrops are unavailable.',503);
 const row=await sqlDB(env.DB).one('SELECT * FROM workshop_jobs WHERE id=? AND owner=?',await setId(siteOwner,author,scriptId,style),siteOwner),p=parse(row?.payload);
 need(row&&p.recordType===BACKDROP_RECORD&&p.learnerOwner===author&&p.scriptId===scriptId&&(!approvedOnly||row.status==='backdrops-approved'),'No backdrop is approved for this scene.',404);
 const s=p.scenes?.[scene],a=s?.attempts?.[approvedOnly||attempt===null?s.chosen:attempt];need(a?.status==='ready'&&a.assetId,'No backdrop for this scene.',404);
 const asset=await sqlDB(env.DB).one("SELECT * FROM media_assets WHERE id=? AND site_owner=? AND learner_owner=? AND status='ready'",a.assetId,siteOwner,author);need(asset,'This backdrop was deleted.',404);
 const {controls}=await readControls(env,siteOwner,author,now),days=parse(controls.learner.policy).mediaDays||0;need(!days||asset.created+days*DAY>now,'This backdrop reached its retention limit.',410);
 const object=await env.BUCKET.get(asset.object_key);need(object,'This backdrop is unavailable.',404);
 return new Response(object.body,{headers:{'Content-Type':'image/webp','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}

// --- Author API: /api/learning/creative/backdrops -----------------------------------------------
export async function cartoonBackdropsAPI(req,env,{owner,siteOwner,access,now=()=>Date.now(),generate=generateBackdrop}){
 need(creativePermissions(env,access).canAuthor,'Ask your organiser to prepare and review new AI learning material.',403);
 need(siteOwner&&env.DB,'Sign in to your personal library to use the creative studio.',401);
 const db=sqlDB(env.DB),input=req.method==='GET'?Object.fromEntries(new URL(req.url).searchParams):await readJSON(req,6000);
 need(typeof input.scriptId==='string'&&input.scriptId.length<=100,'Choose an approved cartoon.');
 const script=await db.one('SELECT * FROM workshop_jobs WHERE id=? AND owner=?',input.scriptId,siteOwner),sp=parse(script?.payload);
 need(script&&sp.recordType==='creative'&&sp.kind==='cartoon'&&sp.learnerOwner===owner&&script.draft,'Cartoon not found.',404);
 const content=validateCreative(parse(script.draft),sp),scenes=scenesUsed(content),hash=await digest(script.draft);
 const load=async style=>db.one('SELECT * FROM workshop_jobs WHERE id=? AND owner=?',await setId(siteOwner,owner,script.id,style),siteOwner);
 const view=async extra=>noStore({enabled:backdropsEnabled(env),scenes,suggestions:suggestPlaces(content,sp.context),styles:Object.fromEntries(Object.entries(BACKDROP_STYLES).map(([k,v])=>[k,v.label])),maxAttempts:MAX_ATTEMPTS,costPerImageUsd:0.01,
  sets:(await Promise.all(Object.keys(BACKDROP_STYLES).map(load))).filter(Boolean).map(publicSet),...extra});
 if(req.method==='GET'){
  if(input.image){const attempt=Number(input.attempt);return backdropBytes(env,{siteOwner,author:owner,scriptId:script.id,style:input.style,scene:input.scene,attempt:Number.isInteger(attempt)&&attempt>=0&&attempt<MAX_ATTEMPTS?attempt:null,approvedOnly:false,now:now()});}
  return view();
 }
 need(req.method==='POST','Backdrop route not found.',404);
 need(script.status==='creative-published','Approve the script before making its backdrops.',409);need(input.scriptHash===hash,'This script changed. Reload before changing its backdrops.',409);
 need(Object.hasOwn(BACKDROP_STYLES,input.style),'Choose Prism anime or Paper comedy.');
 const id=await setId(siteOwner,owner,script.id,input.style);
 const save=async(row,next,status=row.status)=>{const r=await db.run('UPDATE workshop_jobs SET status=?,payload=?,updated=? WHERE id=? AND owner=? AND payload=?',status,JSON.stringify(next),now(),id,siteOwner,row.payload);need(r.meta.changes===1,'Another window changed these backdrops. Reload and try again.',409);return db.one('SELECT * FROM workshop_jobs WHERE id=?',id);};
 // Read-modify-write with a few retries, for bookkeeping that must not be lost.
 const mutate=async change=>{for(let i=0;;i++){const row=await load(input.style),p=parse(row.payload);try{return await save(row,change(p),'backdrops-draft')}catch(e){if(i>=4||e.status!==409)throw e}}};
 if(input.action==='generate'){
  need(backdropsEnabled(env),'Story backdrops are switched off. The standard settings are used.',503);need(env.BUCKET,'Private media storage is not connected. No image was requested.',503);need(env.META_API_KEY,'Muse Image is not connected. No image was requested.',503);
  need(scenes.includes(input.scene),'Choose a setting used in this episode.');const place=cleanPlace(input.place),scene=input.scene;
  await db.run('INSERT OR IGNORE INTO workshop_jobs(id,owner,request_key,request_hash,status,payload,created,updated) VALUES(?,?,?,?,?,?,?,?)',id,siteOwner,id,id,'backdrops-draft',JSON.stringify({id,recordType:BACKDROP_RECORD,revisionOf:{freeRender:true},learnerOwner:owner,scriptId:script.id,packId:sp.packId,contentHash:sp.contentHash,style:input.style,scenes:{}}),now(),now());
  const row=await load(input.style),p=parse(row.payload);need(p.learnerOwner===owner&&p.scriptId===script.id,'Backdrop record mismatch.',409);
  const state=p.scenes[scene]||{place,attempts:[],chosen:null};
  // A request that never reported back is closed, not repeated: it may have been billed.
  state.attempts=state.attempts.map(a=>a.status==='pending'&&now()-a.created>PENDING_MS?{...a,status:'failed',error:'This picture did not finish. No automatic repeat was sent.'}:a);
  need(!state.attempts.some(a=>a.status==='pending'),'This backdrop is already being made.',409);need(state.attempts.length<MAX_ATTEMPTS,'Each setting can be made once and remade once.',409);
  const attempt=state.attempts.length,imageId='backdrop-'+crypto.randomUUID(),prompt=backdropPrompt({style:input.style,place,subject:topicOf(sp.context),story:content.story});
  const assetId=await digest(JSON.stringify([siteOwner,owner,script.id,input.style,scene,attempt,imageId,BACKDROP_RECIPE])),key='backdrops/'+assetId+'.webp',created=now();
  // Claim the attempt first, so a second click or window cannot start a second paid request.
  await save(row,{...p,approvedAt:null,scenes:{...p.scenes,[scene]:{...state,place,attempts:[...state.attempts,{status:'pending',assetId,created}]}}},'backdrops-draft');
  const release=()=>mutate(q=>{const s=q.scenes[scene];return {...q,scenes:{...q.scenes,[scene]:{...s,attempts:s.attempts.filter((a,i)=>!(i===attempt&&a.assetId===assetId))}}}});
  // Counts toward the same rolling generation allowance as scripts and narration.
  const budget=await generationBudget(db.one,siteOwner,env,now());
  if(budget.configurationError||budget.remaining<=0){await release();need(false,budgetMessage(budget),budget.configurationError?503:429);}
  const slot=await db.run(`INSERT OR IGNORE INTO workshop_jobs(id,owner,request_key,request_hash,status,payload,created,updated) SELECT ?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM workshop_jobs WHERE owner=? AND created>? AND ${GENERATION_ROWS})<?`,imageId,siteOwner,imageId,await digest(prompt),'image-starting',JSON.stringify({id:imageId,recordType:IMAGE_RECORD,learnerOwner:owner,scriptId:script.id,style:input.style,scene,attempt}),now(),now(),siteOwner,now()-GENERATION_WINDOW_MS,budget.limit);
  if(slot.meta.changes!==1){await release();need(false,budgetMessage(await generationBudget(db.one,siteOwner,env,now())),429);}
  // Pause switch, per-person and global daily limits all live in the cost ledger.
  try{await startCost(env,{id:imageId,siteOwner,learnerOwner:owner,model:IMAGE_MODEL,request:{images:1},now:now()})}
  catch(e){await db.run('DELETE FROM workshop_jobs WHERE id=? AND owner=?',imageId,siteOwner);await release();throw e}
  const finishSlot=(status,error=null)=>db.run('UPDATE workshop_jobs SET status=?,error=?,updated=? WHERE id=? AND owner=?',status,error,now(),imageId,siteOwner);
  let result,failure=null;
  try{result=await generate(imageRequest(prompt,(await digest('mosaic-user:'+siteOwner)).slice(0,32)),env.META_API_KEY);}catch(e){failure=e instanceof BackdropError?e:new BackdropError('Muse Image could not make this picture. No automatic repeat was sent.',502,{billed:null});}
  if(failure){
   await finishCost(env,{id:imageId,siteOwner,usage:failure.billed===false?{images:0}:null,status:'unknown',now:now()});
   await finishSlot(failure.refused?'image-refused':'image-failed',String(failure.message).slice(0,300));
  }else{
   await finishCost(env,{id:imageId,siteOwner,usage:{images:1,bytes:result.bytes.byteLength},now:now()});
   await db.run('INSERT INTO media_assets(id,site_owner,learner_owner,script_id,script_hash,segment,object_key,status,bytes,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?)',assetId,siteOwner,owner,script.id,hash,segmentCode(scene,attempt),key,'preparing',result.bytes.byteLength,now(),now());
   try{await env.BUCKET.put(key,result.bytes,{httpMetadata:{contentType:'image/webp'},customMetadata:{recipe:BACKDROP_RECIPE}});need((await env.BUCKET.head(key))?.size===result.bytes.byteLength,'Backdrop storage could not be confirmed.',503);
    await db.run("UPDATE media_assets SET status='ready',updated=? WHERE id=?",now(),assetId);}
   catch(e){await env.BUCKET.delete(key).catch(()=>{});await db.run('DELETE FROM media_assets WHERE id=?',assetId);failure=new BackdropError('The picture was made but could not be saved. No automatic repeat was sent.',503);}
   await finishSlot(failure?'image-failed':'image-complete',failure?.message||null);
  }
  // Any change needs a fresh approval before learners see it.
  await mutate(q=>{const s=q.scenes[scene],attempts=s.attempts.map((a,i)=>i!==attempt||a.assetId!==assetId?a:failure?{status:failure.refused?'refused':'failed',created,error:failure.message}:{status:'ready',assetId,width:result.width,height:result.height,created});return {...q,approvedAt:null,scenes:{...q.scenes,[scene]:{...s,attempts,chosen:failure?s.chosen:attempt}}}});
  return view({notice:failure?failure.message+' The standard setting is used for this scene.':'Backdrop made. Approve the set when you are happy with it.'});
 }
 const row=await load(input.style);need(row,'Make a backdrop first.',404);const p=parse(row.payload);
 if(input.action==='choose'){
  const s=p.scenes[input.scene],n=Number(input.attempt);need(s&&s.attempts[n]?.status==='ready','Choose a finished picture.',409);
  await save(row,{...p,approvedAt:null,scenes:{...p.scenes,[input.scene]:{...s,chosen:n}}},'backdrops-draft');return view();
 }
 if(input.action==='approve'){
  need(input.confirmed===true,'Check every picture before approval.');
  need(Object.values(p.scenes).some(s=>s.attempts[s.chosen]?.status==='ready'),'Make at least one backdrop before approval.',409);
  need(!Object.values(p.scenes).some(s=>s.attempts.some(a=>a.status==='pending'&&now()-a.created<=PENDING_MS)),'Wait for the pictures being made.',409);
  await save(row,{...p,approvedAt:now(),approvedHash:hash},'backdrops-approved');return view({notice:'Backdrops approved. Learners now see them; scenes without one use the standard setting.'});
 }
 if(input.action==='withdraw'){await save(row,{...p,approvedAt:null},'backdrops-draft');return view({notice:'Backdrops withdrawn. Learners see the standard settings.'});}
 need(false,'Unknown backdrop action.');
}
