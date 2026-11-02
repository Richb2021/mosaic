import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {D1,Bucket} from './helpers/media-storage.mjs';
import {workshopAPI} from '../server/workshop-api.js';
import {extractResource} from '../server/content-service.js';
import {sqlDB,readControls,DAY} from '../server/data-control.js';
import {dataAPI,deletionPlan,startDeletion,enforceRetention} from '../server/data-lifecycle.js';
import {courseAPI} from '../server/course-api.js';
import {emptyCourses,editCourses} from '../src/studio/course-model.js';
import {workspaceExportFiles} from '../src/studio/workspace-export.js';
import {unzipSync,zipSync,strFromU8} from 'fflate';
import {workshopRequest} from '../src/resource-client.js';
import {learningJournal} from '../src/game-modes/learning-client.js';
const pack=JSON.parse(readFileSync(new URL('../public/chapters/water-and-systems.json',import.meta.url)));
test('library client discards a response after switching accounts',async t=>{
 const original={fetch:globalThis.fetch,user:learningJournal.user,connected:learningJournal.connected};t.after(()=>{globalThis.fetch=original.fetch;learningJournal.user=original.user;learningJournal.connected=original.connected});
 learningJournal.connected=true;learningJournal.user={id:'alice'};let resolve;globalThis.fetch=()=>new Promise(r=>resolve=r);const pending=workshopRequest('resources');learningJournal.user={id:'bob'};resolve(Response.json({resources:[{id:'private-alice'}]}));await assert.rejects(pending,/account changed/);
});
function harness(){
 const env={DB:new D1(),BUCKET:new Bucket(),META_API_KEY:'fixture'},db=sqlDB(env.DB),calls=[];
 const call=async(path,input,owner='alice')=>{
  const req=new Request('https://test/api/workshop/'+path,{method:input?'POST':'GET',headers:{Origin:'https://test','Content-Type':'application/json','X-Lanternbound-Workshop':'1'},body:input?JSON.stringify(input):undefined});
  const res=await workshopAPI(req,env,{owner,now:()=>1000,provider:async job=>{calls.push(job);const content=structuredClone(pack);content.id=job.chapterId;content.sources=job.evidence;for(const c of Object.values(content.challenges))c.sourceRefs=[job.evidence[0].id];return {content}}});return {status:res.status,...await res.json()};
 };
 const seed=async(n,{owner='alice',text='An isolated source describes evaporation, condensation and precipitation.',start=0,created=1000}={})=>{
  for(let i=start;i<start+n;i++){const id='resource-'+String(i).padStart(4,'0'),r=await extractResource({title:'Library source '+i,text:text+'\n\nFixture number '+i+' has its own distinct source bytes.'});await db.run('INSERT INTO workshop_resources VALUES(?,?,?,?,?,?,?)',owner==='alice'?id:owner+'-'+id,owner,r.title,r.checksum,JSON.stringify({text:r.text,units:r.units}),i%2?'unreviewed':'reviewed',created);}
 };
 return {env,db,call,seed,calls};
}
test('metadata pages traverse 73 equal timestamps exactly once without full text and isolate owner/query cursors',async()=>{
 const h=harness();await h.seed(73);await h.seed(2,{owner:'bob'});let cursor,ids=[];
 do{const p=await h.call('resources'+(cursor?'?cursor='+encodeURIComponent(cursor):''));assert.equal(p.status,200);assert.equal(p.limit,500);assert.equal(p.total,73);assert(p.resources.length<=25);for(const r of p.resources){assert(!('payload'in r));assert(!('units'in r));assert.equal(r.unitCount,2);ids.push(r.id)}cursor=p.nextCursor;}while(cursor);
 assert.equal(ids.length,73);assert.equal(new Set(ids).size,73);assert.deepEqual(ids,[...ids].sort().reverse());
 const first=await h.call('resources');assert.equal((await h.call('resources?cursor='+first.nextCursor+'&q=source')).status,400);assert.equal((await h.call('resources?cursor='+first.nextCursor,undefined,'bob')).status,400);
 assert.equal((await h.call('resources?cursor=broken')).status,400);assert.equal((await h.call('resources?ids=bob-resource-0000')).status,404);
 const legacy=await h.call('library');assert.equal(legacy.resources.length,40);assert.equal(legacy.resourcesTruncated,true);assert.equal((await h.call('library?view=metadata')).resources.length,25);
});
test('title and review filters span the whole library including Unicode; old canonical reads remain owner-only',async()=>{
 const h=harness();await h.seed(65);await h.db.run('UPDATE workshop_resources SET title=? WHERE id=?','ÉCOLOGIE field notes','resource-0000');
 const p=await h.call('resources?q='+encodeURIComponent('écologie')+'&status=reviewed');assert.equal(p.matching,1);assert.equal(p.resources[0].id,'resource-0000');
 const all=await h.call('resources?status=reviewed');assert.equal(all.matching,33);
 assert.equal((await h.call('resources/resource-0000')).resource.units.length,2);assert.equal((await h.call('resources/resource-0000',undefined,'bob')).status,404);assert.equal((await h.call('resources?status=anything')).status,400);
});
test('passage-text search does not turn a title or locator match into a quotation match',async()=>{
 const h=harness();await h.call('resources',{title:'Quasar reference',text:'Trees take up water through their roots and require sunlight to grow.'});
 assert.equal((await h.call('resources?q=quasar')).matching,1);
 assert.deepEqual((await h.call('search?q=quasar')).results,[]);
 assert.deepEqual((await h.call('search?q=paragraph')).results,[]);
 assert.equal((await h.call('search?q=sunlight')).results.length,1);
});
test('passage search resumes inside a dense source and reaches paragraph 40 and documents older than 40',async()=>{
 const h=harness(),text=Array.from({length:65},(_,i)=>`Evaporation is described in this exact isolated paragraph number ${i+1}.`).join('\n\n');await h.seed(1,{text});await h.seed(60,{start:1,text:'This newer unrelated passage describes an industrial machine.'});await h.seed(1,{owner:'bob',text:'Evaporation foreign secret must never appear.'});
 let cursor,results=[];do{const p=await h.call('search?q=evaporation'+(cursor?'&cursor='+encodeURIComponent(cursor):''));assert.equal(p.status,200);assert.equal(p.method,'word-match');assert.equal(p.sourceCount,61);results.push(...p.results);cursor=p.nextCursor;}while(cursor);
 assert.equal(results.length,65);assert.equal(new Set(results.map(r=>r.id)).size,65);assert(results.every(r=>r.resourceId==='resource-0000'));assert.equal(results.find(r=>r.locator==='Paragraph 40').excerpt,'Evaporation is described in this exact isolated paragraph number 40.');
 const p=await h.call('search?q=evaporation');assert.equal((await h.call('search?q=condensation&cursor='+p.nextCursor)).status,400);assert.equal((await h.call('search?q=evaporation&ids=bob-resource-0000')).status,404);assert.equal((await h.call('search?q=the%20and')).status,400);
 assert.equal((await h.call('search?q=evaporation&ids=resource-0000&status=unreviewed')).results.length,0);
});
test('500-source cap is atomic for concurrent uploads and deduplication still works when full',async()=>{
 const h=harness();await h.seed(499);const bodies=[0,1,2].map(i=>({title:'Last source '+i,text:'This is isolated new content for the concurrent library capacity test number '+i+'.'}));
 const results=await Promise.all(bodies.map(b=>h.call('resources',b)));assert.deepEqual(results.map(r=>r.status).sort(),[201,409,409]);assert.equal((await h.call('resources')).total,500);
 const winner=results.findIndex(r=>r.status===201);assert.equal((await h.call('resources',bodies[winner])).duplicate,true);assert.equal((await h.call('resources',{title:'Other owner',text:bodies[0].text},'bob')).status,201);
});
test('an older reviewed source can be chosen, generated, exactly reviewed and published',async()=>{
 const h=harness();await h.seed(65);const source=(await h.call('resources/resource-0000')).resource,body={topicId:pack.topicId,goal:'Explain evaporation and condensation',level:'Beginner',resourceIds:[source.id],requestKey:'old-source',evidenceIds:[source.units[0].id],evidenceConfirmed:true};
 const queued=await h.call('jobs',body);assert.equal(queued.status,201);assert.equal((await h.call('jobs',body)).job.id,queued.job.id);
 const reviewed=await h.call('jobs/'+queued.job.id+'/run',{});assert.equal(reviewed.job.status,'review');assert.deepEqual(h.calls[0].evidence,[source.units[0]]);
 assert.equal((await h.call('jobs/'+queued.job.id+'/publish',{confirmed:true,draftHash:'wrong'})).status,409);
 assert.equal((await h.call('jobs/'+queued.job.id+'/publish',{confirmed:true,draftHash:reviewed.job.draftHash})).job.status,'published');assert.equal(h.calls.length,1);
});
test('course notebook retrieves only linked metadata even when a source is beyond the first 40',async()=>{
 const h=harness();await h.seed(65);const resource=(await h.call('resources/resource-0000')).resource;let state=editCourses(emptyCourses(),{type:'create-course',id:'c',title:'Course',goal:''});state=editCourses(state,{type:'create-topic',courseId:'c',id:'t',title:'Topic',goal:''});state=editCourses(state,{type:'link-resource',courseId:'c',topicId:'t',id:resource.id},{id:resource.id,checksum:resource.checksum});
 const store={latest:async()=>({version:3,payload:JSON.stringify({courses:state})})};
 const res=await courseAPI(new Request('https://test/api/learning/courses'),h.env,{owner:'account',siteOwner:'alice',store});const result=await res.json();assert.equal(result.resources.length,1);assert.equal(result.resources[0].id,resource.id);assert.equal(result.resources[0].unitCount,2);assert(!('units'in result.resources[0]));assert(!('payload'in result.resources[0]));
});
test('paged export includes all 500 large sources, rejects a changed snapshot and preserves deletion/retention beyond 40',async()=>{
 const h=harness();await h.seed(500,{text:'A paragraph on evaporation and condensation. '.repeat(650),created:1});await h.seed(1,{owner:'bob'});
 const search=await h.call('search?q=unmatchedvolcano');assert.equal(search.sourceCount,500);assert.equal(search.scanned,500);assert.deepEqual(search.results,[]);assert.equal(search.nextCursor,null);
 const store={allRows:async()=>[],deleteRows:async()=>{}},ctx={owner:'account',siteOwner:'alice',store,now:()=>200*DAY,removeProvider:async()=>{}},call=async body=>{const s=await readControls(h.env,'alice','account',ctx.now());return (await dataAPI(new Request('https://test/api/learning/data',{method:'POST',body:JSON.stringify({epoch:s.epoch,...body})}),h.env,ctx)).json()};
 let requests=0;const files=await workspaceExportFiles(async body=>{requests++;return call(body)});assert.equal(requests,25);const unzipped=unzipSync(zipSync(files,{level:0})),manifest=JSON.parse(strFromU8(unzipped['manifest.json']));assert.equal(manifest.sourceCount,500);const exported=manifest.parts.flatMap(n=>JSON.parse(strFromU8(unzipped[n])).resources);assert.equal(new Set(exported.map(r=>r.id)).size,500);assert.equal(exported[0].payload.units[0].excerpt.startsWith('A paragraph on evaporation'),true);assert(!exported.some(r=>r.id.startsWith('bob')));
 const first=await call({action:'export',scope:'workspace',paged:true});await h.db.run('UPDATE workshop_resources SET status=? WHERE id=?','unreviewed','resource-0000');await assert.rejects(call({action:'export',scope:'workspace',paged:true,cursor:first.page.nextCursor,snapshot:first.page.snapshot}),e=>e.status===409);
 const plan=await deletionPlan(h.env,{...ctx,mode:'resource',id:'resource-0000',now:ctx.now()});assert.deepEqual(plan.resources,['resource-0000']);await startDeletion(h.env,ctx,plan);assert.equal((await h.call('resources/resource-0000')).status,404);
 const s=await readControls(h.env,'alice','account',ctx.now());await h.db.run('UPDATE data_controls SET policy=? WHERE scope=?',JSON.stringify({resourceDays:7}),s.scopes.workspace);await enforceRetention(h.env,ctx,{force:true});assert.equal((await h.call('resources')).total,0);assert.equal((await h.call('resources',undefined,'bob')).total,1);
});
