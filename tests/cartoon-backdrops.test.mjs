import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sharingFixture} from './helpers/course-sharing.mjs';
import {newUnit,activitiesOf} from '../src/studio/programme.js';import {creativeContext,validateCreative} from '../src/studio/creative-content.js';
import {draftHash} from '../src/game-modes/draft-engine.js';import {digest} from '../server/content-service.js';
import {deletionPlan,startDeletion} from '../server/data-lifecycle.js';
import {learningAPI} from '../server/learning-api.js';
import {mediaWorkerAPI} from '../server/media-jobs.js';
import {reservedCost,estimateMicros,costRates} from '../server/cost-ledger.js';
import {routeMetaThroughRelay} from '../server/node/meta-relay.mjs';
import {topicOf,backdropPrompt,suggestPlaces,cleanPlace,imageRequest,webpSize,readImageResponse,generateBackdrop,scenesUsed,approvedBackdrops} from '../server/cartoon-backdrops.js';
import {withStoryArt,validStorySets,STORY_EDITION,previewSets} from '../src/studio/media/story-backdrops.js';
import {withStoryBackdrops} from '../scripts/media/render.mjs';

// Smallest valid extended WebP header with the given size.
function webp(width=2048,height=1152){const b=new Uint8Array(30);b.set([...'RIFF'].map(c=>c.charCodeAt(0)),0);b.set([22,0,0,0],4);b.set([...'WEBPVP8X'].map(c=>c.charCodeAt(0)),8);b.set([10,0,0,0],16);const w=width-1,h=height-1;b.set([w&255,w>>8&255,w>>16&255,h&255,h>>8&255,h>>16&255],24);return b}
const b64=bytes=>btoa(String.fromCharCode(...bytes));
function metaStub(){const calls=[];let reply=()=>new Response(JSON.stringify({created:1,data:[{b64_json:b64(webp())}],output_format:'webp',usage:{input_tokens:10,output_tokens:10,total_tokens:20}}),{status:200});
 const original=globalThis.fetch;globalThis.fetch=async(url,init)=>{if(String(url)==='https://api.meta.ai/v1/images/generations'){calls.push(JSON.parse(init.body));return reply(calls.length)}return original(url,init)};
 return {calls,set:fn=>{reply=fn},restore:()=>{globalThis.fetch=original}}}

async function fixture({scenes=['workshop','garden','workshop','city']}={}){
 const h=await sharingFixture(),pack=h.chapters[0].pack,unit=newUnit(pack,{},activitiesOf(pack).map(a=>a.key));
 Object.assign(h.env,{CARTOON_BACKDROPS:'on',META_API_KEY:'fixture-key',WORKSHOP_GENERATION_LIMIT:'50',MEDIA_WORKER_ENABLED:'true',MAINTENANCE_SECRET:'x'.repeat(40)});
 await h.store.write('learner_profiles',h.identity.owner,'studio',0,{studio:{schemaVersion:1,active:unit.id,units:[unit]}},h.now());
 const p={id:'backdrop-cartoon',recordType:'creative',kind:'cartoon',learnerOwner:h.identity.owner,packId:pack.id,contentHash:draftHash(pack),context:creativeContext(pack,unit,'cartoon')},refs=[p.context.evidence[0].id];
 const script=validateCreative({schemaVersion:1,id:p.id,kind:'cartoon',title:'The missing clue',summary:'A fictional puzzle.',segments:scenes.map((scene,i)=>({id:'segment-'+(i+1),speaker:i%2?'learner':'guide',text:'The clue changes how we read the source.',scene,action:'talk',sourceRefs:refs})),question:{prompt:'Explain it.',answer:p.context.evidence[0].excerpt,sourceRefs:refs}},p),draft=JSON.stringify(script),hash=await digest(draft);
 await h.db.run('INSERT INTO workshop_jobs(id,owner,request_key,request_hash,status,payload,draft,created,updated) VALUES(?,?,?,?,?,?,?,?,?)',p.id,h.identity.siteOwner,p.id,'fixture','creative-published',JSON.stringify(p),draft,h.now(),h.now());
 const api=body=>h.call(h.teacher,'learning/creative/backdrops'+(body?'':'?scriptId='+p.id),body?{scriptId:p.id,scriptHash:hash,style:'anime',...body}:undefined);
 const image=q=>learningAPI(new Request('https://test.local/api/learning/creative/backdrops?'+new URLSearchParams({scriptId:p.id,image:'1',...q}),{headers:{'X-Mosaic-Learner':h.teacher.id}}),h.env,{store:h.store,session:async()=>h.teacher,now:h.now});
 return {...h,pack,unit,p,script,hash,api,image,identityIds:{packId:pack.id,contentHash:draftHash(pack)}};
}

test('prompts keep the style pack, the subject and the safety rules, and place text is checked',()=>{
 const prompt=backdropPrompt({style:'anime',place:'a high lookout over a smoking volcano',subject:'Volcanoes'});
 assert.match(prompt,/cel shading/);assert.match(prompt,/about Volcanoes/);assert.match(prompt,/Place: a high lookout over a smoking volcano\./);
 for(const rule of [/No people, characters, animals, faces/,/Suitable for all ages/,/no text, letters, numbers, signs, labels, logos/,/bottom third/])assert.match(prompt,rule);
 assert.match(backdropPrompt({style:'paper',place:'the Roman forum at noon',subject:'Ancient Rome'}),/cut-paper/);
 assert.match(backdropPrompt({style:'anime',place:'a lab',subject:'x',story:{premise:'Two friends race the tide.'}}),/never draw its characters\): Two friends race the tide\./);
 assert.throws(()=>backdropPrompt({style:'original',place:'anywhere',subject:'x'}));
 for(const bad of ['no','x'.repeat(161),'see https://example.com/photo','www.example.com'])assert.throws(()=>cleanPlace(bad));
 assert.equal(cleanPlace('  a   quiet\nharbour  '),'a quiet harbour');
 const req=imageRequest(prompt,'user-hash');assert.equal(req.model,'muse-image-1.0');assert.equal(req.n,1);assert.equal(req.output_format,'webp');assert.equal(req.response_format,'b64_json');
 assert.deepEqual(req.tool_enablement,{enable_image_search:false,enable_web_search:false,enable_shell:false},'no web or image search, so no copied photos of real people or places');
 assert.equal(req.moderation,undefined,'moderation is unsupported on muse-image-1.0');
});

test('2 to 4 setting suggestions come from the episode subject, one per scene actually used',()=>{
 const script={segments:[{scene:'city'},{scene:'garden'},{scene:'city'},{scene:'observatory'}]};
 assert.deepEqual(scenesUsed(script),['city','garden','observatory']);
 const places=suggestPlaces(script,{title:'Volcanoes  https://evil.test'});
 assert.deepEqual(Object.keys(places),['city','garden','observatory']);assert(Object.values(places).every(p=>p.includes('volcanoes')&&!p.includes('http')));
 assert.equal(suggestPlaces(script,{}).city,'a street or square in a place connected with the topic');
 assert.equal(suggestPlaces(script,{title:'The food-web cup',evidence:[{title:'The water cycle: teacher notes'}]}).garden,'an outdoor natural place connected with the water cycle','the reviewed source names the subject');
 for(const [title,topic] of [['Clouds field guide (uploaded .txt)','clouds'],['Food webs: reviewed classroom notes','food webs'],['Riverlight food-web notes — authored from NOAA','riverlight food-web']])assert.equal(topicOf({evidence:[{title}]}),topic);
 assert.equal(topicOf({title:'Volcanoes',evidence:[{title:''}]}),'volcanoes');
});

test('image responses must be a single WebP of a sensible widescreen size',()=>{
 assert.deepEqual(webpSize(webp(2048,1152)),{width:2048,height:1152});
 const lossy=new Uint8Array(30);lossy.set([...'RIFF'].map(c=>c.charCodeAt(0)));lossy.set([...'WEBPVP8 '].map(c=>c.charCodeAt(0)),8);lossy.set([0,5,0x2d,0x02],26);assert.deepEqual(webpSize(lossy),{width:1280,height:557});
 assert.equal(webpSize(new Uint8Array(40)),null);
 assert.equal(readImageResponse({data:[{b64_json:b64(webp())}]}).width,2048);
 assert.throws(()=>readImageResponse({data:[{b64_json:b64(webp(1024,1024))}]}),/unexpected shape/);
 assert.throws(()=>readImageResponse({data:[{b64_json:b64(new TextEncoder().encode('<svg/>'))}]}));
 assert.throws(()=>readImageResponse({data:[]}));assert.throws(()=>readImageResponse({data:[{url:'https://signed.example'}]}));
});

test('Meta refusals and outages are reported as not billed or uncertain, never retried',async()=>{
 let n=0;const reply=(status,body)=>async()=>{n++;return new Response(JSON.stringify(body),{status})};
 await assert.rejects(generateBackdrop({},'k',reply(400,{error:{code:'content_policy_violation',param:'prompt'}})),e=>e.refused&&e.billed===false&&e.status===422);
 await assert.rejects(generateBackdrop({},'k',async()=>{n++;throw new TypeError('network')}),e=>e.billed===null&&e.status===504);
 await assert.rejects(generateBackdrop({},'k',reply(503,{error:{type:'server_error'}})),e=>e.billed===null);
 await assert.rejects(generateBackdrop({},'',reply(200,{})),/not connected/);assert.equal(n,3);
});

test('Muse Image is priced per returned image in the cost ledger',()=>{
 const rates=costRates({});assert.equal(rates.image,0.01);
 assert.equal(reservedCost('muse-image-1.0',{images:1},rates),10000);assert.equal(reservedCost('muse-image-1.0',{images:4},rates),40000);
 assert.throws(()=>reservedCost('muse-image-1.0',{images:0},rates));assert.throws(()=>reservedCost('muse-image-1.0',{},rates));
 assert.equal(estimateMicros('muse-image-1.0',{images:0},rates),0,'refused images are not billed');
 assert.equal(reservedCost('muse-image-1.0',{images:1},costRates({COST_META_IMAGE_PER_IMAGE:'0.02'})),20000);
 assert.equal(costRates({COST_META_IMAGE_PER_IMAGE:'free'}).image,null);
 assert.throws(()=>reservedCost('muse-image-2.0',{images:1},rates),/Unpriced/);
});

test('the UK relay allows only POST image generation besides Responses and Models',async()=>{
 const php=readFileSync(new URL('../deploy/20i/meta-relay.php',import.meta.url),'utf8');
 const pattern=new RegExp(php.match(/preg_match\('#(\^\/v1\/[^#]+)#D', \$path\)/)[1]);
 for(const ok of ['/v1/responses','/v1/responses/resp_abc','/v1/models','/v1/models/muse-image-1.0','/v1/images/generations'])assert(pattern.test(ok),ok);
 for(const bad of ['/v1/images/edits','/v1/images/generations/x','/v1/files','/v1/images','/v2/images/generations','/v1/images/generations?x=1'])assert(!pattern.test(bad),bad);
 assert.match(php,/in_array\(\$path, \['\/v1\/responses', '\/v1\/images\/generations'\], true\)/,'POST allow list');
 assert.match(php,/\$path === '\/v1\/images\/generations' && \$method !== 'POST'/,'images path is POST only');
 assert.match(php,/CURLOPT_FOLLOWLOCATION => false/);assert.match(php,/hash_equals\(\$config\['secret'\]/);
 let seen;const f=routeMetaThroughRelay({url:'https://relay.example.test/r.php',secret:'s'.repeat(40)},async(url,init)=>{seen=JSON.parse(init.body);return new Response('{}')});
 await f('https://api.meta.ai/v1/images/generations',{method:'POST',headers:{Authorization:'Bearer k'},body:'{"model":"muse-image-1.0"}'});
 assert.deepEqual(seen,{method:'POST',path:'/v1/images/generations',authorization:'Bearer k',body:'{"model":"muse-image-1.0"}'});
});

test('author makes, caches and approves backdrops; each reserves its cost and learners see only approved pictures',async()=>{
 const h=await fixture(),meta=metaStub();try{
  const view=await h.api();assert.equal(view.http,200);assert.deepEqual(view.scenes,['workshop','garden','city']);assert.equal(view.sets.length,0);
  const made=await h.api({action:'generate',scene:'workshop',place:'a volcano research hut full of rock samples'});assert.equal(made.http,200,made.error);
  assert.equal(meta.calls.length,1);assert.match(meta.calls[0].prompt,/volcano research hut/);assert.equal(meta.calls[0].user.length,32);assert(!meta.calls[0].user.includes(h.identity.siteOwner));
  const set=made.sets[0];assert.equal(set.status,'draft');assert.equal(set.scenes.workshop.attempts[0].status,'ready');assert.equal(set.scenes.workshop.chosen,0);
  const receipt=await h.db.one("SELECT * FROM cost_receipts WHERE model='muse-image-1.0'");assert.equal(receipt.status,'measured');assert.equal(receipt.estimate_micros,10000);assert.equal(JSON.parse(receipt.rates).reservedMicros,10000);
  const row=await h.db.one("SELECT * FROM media_assets WHERE script_id=? AND segment=-20",h.p.id);assert.equal(row.status,'ready');
  // Reading the picture again is served from storage: no new request.
  const img=await h.image({style:'anime',scene:'workshop'});assert.equal(img.status,200);assert.equal(img.headers.get('Content-Type'),'image/webp');assert.deepEqual(new Uint8Array(await img.arrayBuffer()),webp());assert.equal(meta.calls.length,1);
  assert.deepEqual(await approvedBackdrops(h.env,{siteOwner:h.identity.siteOwner,author:h.identity.owner,scriptId:h.p.id}),[],'drafts are not shown to learners');
  // One remake, then no more.
  assert.equal((await h.api({action:'generate',scene:'workshop',place:'a volcano research hut at dusk'})).http,200);
  const third=await h.api({action:'generate',scene:'workshop',place:'again'});assert.equal(third.http,409);assert.equal(meta.calls.length,2);
  assert.equal((await h.api({action:'choose',scene:'workshop',attempt:0})).sets[0].scenes.workshop.chosen,0);
  assert.equal((await h.api({action:'approve'})).http,400,'approval needs the confirmation');
  const ok=await h.api({action:'approve',confirmed:true});assert.equal(ok.sets[0].status,'approved');
  const approved=await approvedBackdrops(h.env,{siteOwner:h.identity.siteOwner,author:h.identity.owner,scriptId:h.p.id});
  assert.deepEqual(approved.map(a=>[a.style,Object.keys(a.scenes)]),[['anime',['workshop']]]);assert.deepEqual(approved[0].scenes.workshop,{width:2048,height:1152});
  // A new picture puts the set back into draft until re-approved.
  await h.api({action:'generate',scene:'garden',place:'lava fields with ferns'});assert.equal((await approvedBackdrops(h.env,{siteOwner:h.identity.siteOwner,author:h.identity.owner,scriptId:h.p.id})).length,0);
  assert.equal(previewSets((await h.api())).at(0).scenes.garden.attempt,0,'the author preview shows drafts');
 }finally{meta.restore()}
});

test('pause switch, spent allowance, switch-off and refusals send no paid request and fall back',async()=>{
 const h=await fixture(),meta=metaStub();try{
  await h.db.run('INSERT OR REPLACE INTO data_controls(scope,policy,updated) VALUES(?,?,?)','launch:controls',JSON.stringify({paused:true}),h.now());
  const paused=await h.api({action:'generate',scene:'workshop',place:'a lab'});assert.equal(paused.http,503);assert.match(paused.error,/paused/);assert.equal(meta.calls.length,0);
  const view=await h.api();assert.deepEqual(view.sets[0]?.scenes.workshop?.attempts||[],[],'the claimed attempt is released, so the author can try later');
  assert.equal((await h.db.one("SELECT COUNT(*) AS n FROM workshop_jobs WHERE json_extract(payload,'$.recordType')='backdrop-image'")).n,0,'no allowance used');
  await h.db.run('DELETE FROM data_controls WHERE scope=?','launch:controls');
  h.env.PILOT_DAILY_BUDGET_USD='0.005';const broke=await h.api({action:'generate',scene:'workshop',place:'a lab'});assert.equal(broke.http,429);assert.equal(meta.calls.length,0);delete h.env.PILOT_DAILY_BUDGET_USD;
  h.env.WORKSHOP_GENERATION_LIMIT='0';assert.equal((await h.api({action:'generate',scene:'workshop',place:'a lab'})).http,429);h.env.WORKSHOP_GENERATION_LIMIT='50';
  h.env.CARTOON_BACKDROPS='off';assert.equal((await h.api({action:'generate',scene:'workshop',place:'a lab'})).http,503);assert.equal((await h.api()).enabled,false);h.env.CARTOON_BACKDROPS='on';
  assert.equal(meta.calls.length,0);
  meta.set(()=>new Response(JSON.stringify({error:{type:'invalid_request_error',code:'content_policy_violation',param:'prompt'}}),{status:400}));
  const refused=await h.api({action:'generate',scene:'workshop',place:'a lab'});assert.equal(refused.http,200);assert.match(refused.notice,/standard setting/);
  assert.equal(refused.sets[0].scenes.workshop.attempts[0].status,'refused');assert.equal(refused.sets[0].scenes.workshop.chosen,null);
  const receipt=await h.db.one("SELECT * FROM cost_receipts WHERE model='muse-image-1.0'");assert.equal(receipt.estimate_micros,0,'refused images are not billed');
  meta.set(()=>{throw new TypeError('socket hang up')});
  const lost=await h.api({action:'generate',scene:'workshop',place:'a lab, take two'});assert.equal(lost.sets[0].scenes.workshop.attempts[1].status,'failed');
  assert.equal((await h.db.one("SELECT status FROM cost_receipts WHERE model='muse-image-1.0' ORDER BY created DESC,rowid DESC LIMIT 1")).status,'unknown','an uncertain request keeps its reservation');
  assert.equal((await h.api({action:'approve',confirmed:true})).http,409,'nothing to approve: the library settings stay');
 }finally{meta.restore()}
});

test('only the cartoon author can make backdrops, and only for an approved script',async()=>{
 const h=await fixture(),meta=metaStub();try{
  assert.equal((await h.call(h.learner,'learning/creative/backdrops?scriptId='+h.p.id)).http===200,false);
  assert.equal((await h.api({action:'generate',scene:'workshop',place:'a lab',scriptHash:'f'.repeat(64)})).http,409);
  assert.equal((await h.api({action:'generate',scene:'observatory',place:'a lab'})).http,400,'only scenes the episode uses');
  await h.db.run("UPDATE workshop_jobs SET status='creative-review' WHERE id=?",h.p.id);assert.equal((await h.api({action:'generate',scene:'workshop',place:'a lab'})).http,409);
  assert.equal(meta.calls.length,0);
 }finally{meta.restore()}
});

test('the player swaps in story backdrops and keeps the library setting for any that fail',async()=>{
 const library={style:'anime',edition:0,backgrounds:{workshop:{url:'/cartoon-art/anime/w.webp',width:1280,height:720},garden:{url:'/cartoon-art/anime/g.webp',width:1280,height:720}},cast:{},images:new Map([['/cartoon-art/anime/w.webp','W'],['/cartoon-art/anime/g.webp','G']])};
 const sets=validStorySets([{style:'anime',version:1,scenes:{workshop:{width:2048,height:1152},garden:{width:2048,height:1152},bogus:{width:1,height:1}}},{style:'original',scenes:{workshop:{width:1,height:1}}}]);
 assert.deepEqual(sets.map(s=>[s.style,Object.keys(s.scenes)]),[['anime',['workshop','garden']]]);
 const load=async(style,scene)=>{if(scene==='garden')throw Error('offline');return new Blob([webp()],{type:'image/webp'})};
 const pack=await withStoryArt(library,sets[0],load,{makeURL:()=>'blob:story-workshop',imageLoader:async a=>({story:a.url})});
 assert.equal(pack.edition,STORY_EDITION);assert.equal(pack.backgrounds.workshop.url,'blob:story-workshop');assert.deepEqual(pack.images.get('blob:story-workshop'),{story:'blob:story-workshop'});
 assert.equal(pack.backgrounds.garden.url,'/cartoon-art/anime/g.webp');assert.deepEqual(pack.missingBackdrops,['garden']);assert.equal(library.backgrounds.workshop.url,'/cartoon-art/anime/w.webp','library pack untouched');
 const wrong=await withStoryArt(library,sets[0],async()=>new Blob(['<html>'],{type:'text/html'}),{makeURL:()=>'blob:x',imageLoader:async()=>({})});assert.deepEqual(wrong.missingBackdrops.sort(),['garden','workshop']);
 // The MP4 renderer follows the same rule.
 const rendered=await withStoryBackdrops(library,{workshop:{file:'a.webp',width:2048,height:1152},garden:{file:'b.webp',width:2048,height:1152},city:{file:'c.webp',width:2048,height:1152}},async f=>{if(f==='b.webp')return {width:999,height:1};return {width:2048,height:1152,file:f}});
 assert.equal(rendered.backgrounds.workshop.url,'story:workshop');assert.equal(rendered.images.get('story:workshop').file,'a.webp');assert.equal(rendered.backgrounds.garden.url,'/cartoon-art/anime/g.webp');assert.equal(rendered.backgrounds.city,undefined);
});

test('learners read approved backdrops through their linked cartoon, never drafts',async()=>{
 const h=await fixture(),meta=metaStub();try{
  await h.api({action:'generate',scene:'workshop',place:'a volcano research hut'});
  await h.assignCourse(h.learner,{learningResources:[{objectiveId:'objective-1',resources:[{id:h.p.id,hash:h.hash}]}]});
  await h.call(h.learner,'learning/studio',{...h.identityIds,type:'create',expectedVersion:0,activityKeys:[h.unit.activityKeys[0]]});
  const chosen=await h.call(h.learner,'learning/programme',{...h.identityIds,action:'choose',expectedVersion:0,formats:['cartoon'],links:[{id:h.p.id,hash:h.hash,kind:'cartoon'}]});assert.equal(chosen.http,200,chosen.error);
  const open=()=>h.call(h.learner,'learning/programme?'+new URLSearchParams({...h.identityIds,resourceId:h.p.id,resourceHash:h.hash}));
  const picture=()=>learningAPI(new Request('https://test.local/api/learning/programme?'+new URLSearchParams({...h.identityIds,resourceId:h.p.id,resourceHash:h.hash,backdrop:'workshop',backdropStyle:'anime'}),{headers:{'X-Mosaic-Learner':h.learner.id}}),h.env,{store:h.store,session:async()=>h.learner,now:h.now});
  assert.deepEqual((await open()).backdrops,[]);assert.equal((await picture()).status,404,'draft pictures stay with the author');
  await h.api({action:'approve',confirmed:true});
  const opened=await open();assert.equal(opened.backdrops[0].style,'anime');assert.deepEqual(Object.keys(opened.backdrops[0].scenes),['workshop']);
  const r=await picture();assert.equal(r.status,200);assert.equal(r.headers.get('Content-Type'),'image/webp');assert.equal(meta.calls.length,1);
  await h.api({action:'withdraw'});assert.equal((await picture()).status,404);assert.deepEqual((await open()).backdrops,[]);
 }finally{meta.restore()}
});

test('narrated MP4 jobs can use approved backdrops, and episode deletion removes them',async()=>{
 const h=await fixture(),meta=metaStub();try{
  await h.api({action:'generate',scene:'workshop',place:'a volcano research hut'});
  const early=await h.call(h.teacher,'learning/media-jobs',{action:'create',scriptId:h.p.id,scriptHash:h.hash,format:'mp4',style:'anime',edition:3});assert.equal(early.http,409,'needs approval first');
  await h.api({action:'approve',confirmed:true});
  const job=await h.call(h.teacher,'learning/media-jobs',{action:'create',scriptId:h.p.id,scriptHash:h.hash,format:'mp4',style:'anime',edition:3});assert.equal(job.http,200,job.error);assert.equal(job.job.edition,3);
  const plain=await h.call(h.teacher,'learning/media-jobs',{action:'create',scriptId:h.p.id,scriptHash:h.hash,format:'mp4',style:'anime',edition:0});assert.notEqual(plain.job.id,job.job.id);
  const worker=body=>mediaWorkerAPI(new Request('https://test.local/api/media-worker',{method:'POST',headers:{Authorization:'Bearer '+h.env.MAINTENANCE_SECRET,'X-Mosaic-Maintenance':'media-v1','Content-Type':'application/json'},body:JSON.stringify(body)}),h.env,{store:h.store,now:h.now});
  const claimed=(await (await worker({action:'claim'})).json()).job;assert.equal(claimed.id,job.job.id);assert.deepEqual(claimed.backdrops,{workshop:{width:2048,height:1152}});
  const bytes=await worker({action:'backdrop',id:claimed.id,token:claimed.token,scene:'workshop'});assert.equal(bytes.status,200);assert.deepEqual(new Uint8Array(await bytes.arrayBuffer()),webp());
  assert.equal((await worker({action:'backdrop',id:claimed.id,token:'wrong',scene:'workshop'})).status,409);
  const ctx={...h.identity,store:h.store,now:h.now,removeProvider:async()=>{}},plan=await deletionPlan(h.env,{...ctx,now:h.now(),mode:'episode',id:h.p.id});
  const records=await h.db.all("SELECT id FROM workshop_jobs WHERE json_extract(payload,'$.recordType') IN ('cartoon-backdrops','backdrop-image')");assert.equal(records.length,2);assert(records.every(r=>plan.jobs.includes(r.id)));
  const asset=await h.db.one('SELECT id FROM media_assets WHERE segment<=-10');assert(plan.assets.includes(asset.id));
  await startDeletion(h.env,ctx,plan);assert.equal([...h.env.BUCKET.objects.keys()].filter(k=>k.startsWith('backdrops/')).length,0);
 }finally{meta.restore()}
});
