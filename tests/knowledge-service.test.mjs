import test from 'node:test';import assert from 'node:assert/strict';
import {D1,Bucket} from './helpers/media-storage.mjs';
import {workshopAPI} from '../server/workshop-api.js';
import {sqlDB,readControls} from '../server/data-control.js';
import {deletionPlan,startDeletion,dataAPI} from '../server/data-lifecycle.js';
import {workspaceExportFiles} from '../src/studio/workspace-export.js';
import {importURL,permittedSourceURL,htmlSourceText,transcribeFile} from '../server/knowledge-import.js';
import {retrievalQuery,passageFeatures} from '../src/passage-ranking.js';
const text='Revenue is the money received from selling goods or services. Profit is revenue minus the costs incurred in earning that revenue.';
function harness(){const env={DB:new D1(),BUCKET:new Bucket(),META_API_KEY:'test',FISH_AUDIO_API_KEY:'test',SOURCE_IMPORT_HOSTS:'example.org'},db=sqlDB(env.DB);let calls=0;const fetcher=async(url,o)=>{calls++;if(url.includes('fish.audio')){assert.equal(o.headers.model,'transcribe-1-pro');assert.equal(o.body.get('tag_audio_events'),'false');return Response.json({text,duration:12,request_id:'test-asr'})}const body=o?.body?JSON.parse(o.body):{};assert(!o?.body||body.model==='muse-wonder-1.0');return Response.json({id:'resp_search_fixture',status:'completed',model:'muse-wonder-1.0',usage:{input_tokens:100,output_tokens:20},output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify({alternatives:['revenue','income from sales'],note:'Check which term fits the source.'})}]}]})};
 const call=async(path,input,owner='alice')=>{const req=new Request('https://test/api/workshop/'+path,{method:input?'POST':'GET',headers:{Origin:'https://test','Content-Type':'application/json','X-Lanternbound-Workshop':'1'},body:input?JSON.stringify(input):undefined});const res=await workshopAPI(req,env,{owner,learnerOwner:owner,fetcher,now:()=>1000});return {status:res.status,...await res.json()}};
 return {env,db,call,calls:()=>calls};}
test('public URL import rejects redirect escapes and non-text, strips active HTML without secondary fetches',async()=>{
 const env={SOURCE_IMPORT_HOSTS:'example.org'};for(const url of ['http://example.org','https://user:pass@example.org/','https://127.0.0.1/','https://example.org:444/'])assert.throws(()=>permittedSourceURL(url,env));let seen=[];
 await assert.rejects(()=>importURL('https://example.org/',env,async url=>{seen.push(url);return new Response(null,{status:302,headers:{location:'https://localhost/private'}})}),/not enabled/);assert.equal(seen.length,1);
 const result=await importURL('https://example.org/',env,async()=>new Response('<html><title>Business notes</title><script>stealCookies()</script><nav>unrelated links</nav><p>'+text+'</p></html>',{headers:{'content-type':'text/html'}}));assert.equal(result.text,text);assert.equal(result.title,'Business notes');assert(!htmlSourceText('<script>secret</script><p>Safe &amp; checked</p>').includes('secret'));
});
test('knowledge jobs are idempotent, charge once, isolate owners and retain reviewed search alternatives',async()=>{
 const h=harness(),j=(await h.call('knowledge/jobs',{kind:'search',query:'money coming into a company',requestKey:'search-one'})).job;
 const a=await h.call('knowledge/jobs/'+j.id+'/run',{});assert.equal(a.job.status,'review');assert.deepEqual(a.job.draft.alternatives,['revenue','income from sales']);await h.call('knowledge/jobs/'+j.id+'/run',{});assert.equal(h.calls(),1);
 assert.equal((await h.call('knowledge/jobs/'+j.id,undefined,'bob')).status,404);assert.equal((await h.call('knowledge/jobs',{kind:'search',query:'different inputs',requestKey:'search-one'})).status,409);assert.equal((await h.db.one('SELECT COUNT(*) AS n FROM cost_receipts')).n,1);
});
test('Fish recording imports retain text and cost once, not raw recording or auto resubmission',async()=>{
 const h=harness(),input={kind:'transcript',requestKey:'recording-one',filename:'lesson.webm',base64:btoa('synthetic audio bytes'),permitted:true,language:'en'};
 const a=await h.call('knowledge/jobs',input);assert.equal(a.status,201);assert.equal(a.job.draft.text,text);assert.equal((await h.call('knowledge/jobs',input)).job.id,a.job.id);assert.equal(h.calls(),1);assert.equal(h.env.BUCKET.objects.size,0);
 const receipt=await h.db.one('SELECT * FROM cost_receipts');assert.equal(receipt.model,'transcribe-1-pro');assert.equal(receipt.estimate_micros,1200);assert(!JSON.stringify(await h.db.all('SELECT payload FROM workshop_jobs')).includes('base64'));
});
test('immutable source versions and retained originals are owner scoped and included in checked export and deletion',async()=>{
 const h=harness(),r=(await h.call('resources',{title:'Business notes',text,filename:'business.csv'})).resource,body={filename:'business.csv',checksum:r.checksum,confirmed:true,base64:btoa('original,bytes\nrevenue,200')};
 assert.equal((await h.call('knowledge/original/'+r.id,body)).status,200);assert.equal((await h.call('knowledge/original/'+r.id,body,'bob')).status,404);
 const next=(await h.call('resources',{title:'Business notes revised',text:text+' In this example costs include wages.',filename:'business.csv',parentId:r.id,parentChecksum:r.checksum})).resource;
 const versions=await h.call('knowledge/versions/'+next.id);assert.equal(versions.versions.length,2);assert.equal(next.provenance.parentId,r.id);assert.equal((await h.call('resources/'+r.id)).resource.checksum,r.checksum);
 const store={allRows:async()=>[],deleteRows:async()=>{},list:async()=>[]},ctx={owner:'alice',siteOwner:'alice',store,now:()=>1000};const state=await readControls(h.env,'alice','alice',1000);
 const files=await workspaceExportFiles(async input=>{const res=await dataAPI(new Request('https://test/api/learning/data',{method:'POST',body:JSON.stringify({...input,epoch:state.epoch})}),h.env,ctx);return res.json()},()=>{},async()=>new TextEncoder().encode('original,bytes\nrevenue,200'));assert(Object.keys(files).some(k=>k.startsWith('originals/')));
 const plan=await deletionPlan(h.env,{...ctx,mode:'resource',id:r.id,now:1000});await startDeletion(h.env,ctx,plan);assert.equal(h.env.BUCKET.objects.size,0);assert.equal((await h.call('resources/'+next.id)).status,200);
});
test('ranked retrieval segments Chinese and preserves Spanish accented words',()=>{const q=retrievalQuery('水循环');const f=passageFeatures('水循环包括蒸发和降水。',q);assert(f.tf.some(Boolean));const es=retrievalQuery('evaporación');assert.equal(passageFeatures('La evaporación cambia el agua.',es).tf[0],1)});

test('a lost original metadata write never lets a different retry overwrite immutable bytes',async()=>{
 const h=harness(),r=(await h.call('resources',{title:'Original race',text})).resource,key=(await import('../server/knowledge-import.js')).originalKey;
 const bytes=new TextEncoder().encode('first file');await h.env.BUCKET.put(await key('alice',r.id),bytes);
 const conflict=await h.call('knowledge/original/'+r.id,{filename:'second.txt',checksum:r.checksum,confirmed:true,base64:btoa('second file')});assert.equal(conflict.status,409);assert.deepEqual(h.env.BUCKET.objects.get(await key('alice',r.id)),bytes);
 assert.equal((await h.call('knowledge/original/'+r.id,{filename:'first.txt',checksum:r.checksum,confirmed:true,base64:btoa('first file')})).status,200);
});
test('saved transcript appears in data controls and is removed with its derived source',async()=>{
 const h=harness(),j=(await h.call('knowledge/jobs',{kind:'transcript',requestKey:'transcript-cleanup',filename:'lesson.wav',base64:btoa('audio'),permitted:true})).job;
 const source=await h.call('resources',{title:'Spoken lesson',text:j.draft.text,filename:'lesson.wav',importJobId:j.id});assert.equal(source.status,201);assert.equal(source.resource.provenance.importJobId,j.id);
 const store={allRows:async()=>[],deleteRows:async()=>{},list:async()=>[]},ctx={owner:'alice',siteOwner:'alice',store,now:()=>1000};
 const inventory=await (await dataAPI(new Request('https://test/api/learning/data'),h.env,ctx)).json();assert(inventory.jobs.some(v=>v.id===j.id&&v.title==='lesson.wav'));
 const plan=await deletionPlan(h.env,{...ctx,mode:'resource',id:source.resource.id,now:1000});assert(plan.jobs.includes(j.id));await startDeletion(h.env,ctx,plan);assert.equal((await h.call('knowledge/jobs/'+j.id)).status,404);
});
test('paged export refuses knowledge changes or collection withdrawal between pages',async()=>{
 const h=harness(),store={allRows:async()=>[],deleteRows:async()=>{},list:async()=>[]},ctx={owner:'alice',siteOwner:'alice',store,now:()=>1000};
 for(let i=0;i<21;i++)await h.call('resources',{title:'Source '+i,text:text+' Example '+i+'.'});
 const read=await readControls(h.env,'alice','alice',1000),call=body=>dataAPI(new Request('https://test/api/learning/data',{method:'POST',body:JSON.stringify({action:'export',scope:'workspace',paged:true,epoch:read.epoch,...body})}),h.env,ctx);
 const first=await (await call({})).json();assert(first.page.nextCursor);
 await h.call('knowledge/jobs',{kind:'search',query:'profit and revenue',requestKey:'during-export'});
 await assert.rejects(()=>call({cursor:first.page.nextCursor,snapshot:first.page.snapshot}),/materials changed/);
 const second=await (await call({})).json();await h.db.run('INSERT INTO data_controls(scope,policy,updated) VALUES(?,?,?)','knowledge-collection:fixture',JSON.stringify({siteOwner:'alice',readers:[],sources:[]}),1000);
 await assert.rejects(()=>call({cursor:second.page.nextCursor,snapshot:second.page.snapshot}),/materials changed/);
});
