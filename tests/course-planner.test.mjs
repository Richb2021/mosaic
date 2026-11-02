import test from 'node:test';
import assert from 'node:assert/strict';
import {D1} from './helpers/media-storage.mjs';
import {coursePlanAPI} from '../server/course-plan-api.js';
import {courseAPI} from '../server/course-api.js';
import {sqlDB} from '../server/data-control.js';
import {extractResource,digest} from '../server/content-service.js';
import {validateCoursePlan,coursePlanRoute} from '../src/studio/course-plan.js';
import {coursePlanRequest,coursePlanResult} from '../server/course-plan-provider.js';
import {unitKey} from '../src/studio/programme.js';
import {editCourses} from '../src/studio/course-model.js';
import {deletionPlan,dataAPI} from '../server/data-lifecycle.js';
class Store{
 rows=new Map();async latest(t,o,s){return this.rows.get(t+o+s)||null}async allRows(t,o){return [...this.rows.values()].filter(r=>r.table===t&&r.owner_key===o)}async list(){return []}async deleteRows(t,o,ids){for(const [k,r] of this.rows)if(r.table===t&&r.owner_key===o&&ids.includes(r.id))this.rows.delete(k)}
 async write(t,o,s,v,p,n){assert.equal((await this.latest(t,o,s))?.version||0,v);const r={id:'row-'+s,table:t,owner_key:o,slot_key:s,version:v+1,payload:JSON.stringify(p),updated_ms:n};this.rows.set(t+o+s,r);return r}
}
const outline=p=>({schemaVersion:1,id:p.id,title:'Water from sky to stream',summary:'Connect changes in water and movement through the landscape.',steps:[{id:'objective-1',topicId:'water',objective:'Explain how water evaporates into the air.',rationale:'A quiz compares the movement of water.',template:'quiz-v1',prerequisites:[],sourceRefs:[p.context.evidence[0].id]},{id:'objective-2',topicId:'water',objective:'Explain how water returns as precipitation.',rationale:'An adventure links stages through the story.',template:'adventure-v1',prerequisites:['objective-1'],sourceRefs:[p.context.evidence[1].id]}],gaps:['The packet does not support an explanation of volcanoes.']});
async function setup(){
 const env={DB:new D1(),META_API_KEY:'test-only',WORKSHOP_GENERATION_LIMIT:'50'},db=sqlDB(env.DB),store=new Store(),source=await extractResource({title:'Water notes',text:'Water evaporates from the surface into the air. Heating can increase the rate of evaporation.\n\nWater vapour cools and condenses into droplets. Droplets can fall as precipitation and flow into streams.'});
 await db.run('INSERT INTO workshop_resources(id,owner,title,checksum,payload,status,created) VALUES(?,?,?,?,?,?,?)','r-water','workspace',source.title,source.checksum,JSON.stringify({units:source.units}),'reviewed',1);
 const course={id:'earth',title:'Earth systems',goal:'Explain evaporation and precipitation. Consider volcanoes only if supported.',topics:[{id:'water',title:'Water cycle',goal:'Explain water movement',resources:[{id:'r-water',checksum:source.checksum}],chapters:[]}]};
 await store.write('learner_profiles','learner','courses',0,{courses:{schemaVersion:1,courses:[course]}},1);
 let submissions=0;const options={store,owner:'learner',siteOwner:'workspace',access:{},now:()=>1000,provider:async p=>{submissions++;return {status:'review',providerId:'resp_coursefixture',content:outline(p),usage:{inputTokens:20,outputTokens:10,totalTokens:30}}}};
 const call=async(body,extra={})=>{const req=new Request('https://test.local/api/learning/course-plan'+(!body?'?courseId=earth':''),{method:body?'POST':'GET',body:body?JSON.stringify({courseId:'earth',...body}):undefined});return (await coursePlanAPI(req,env,{...options,...extra})).json()};
 const input={action:'create',goal:course.goal,evidenceIds:source.units.map(u=>u.id),confirmed:true,requestKey:'course-fixture'};
 return {env,db,store,course,source,options,call,input,submissions:()=>submissions};
}
async function reviewed(h){const a=await h.call(h.input),b=await h.call({action:'run',id:a.jobId});return b.jobs.find(j=>j.id===a.jobId)}
test('course plan uses fixed Wonder strict schema and server-attached exact citations, rejects foreign evidence and cyclic prerequisites',async()=>{
 const h=await setup(),j=await reviewed(h),p=JSON.parse((await h.db.one('SELECT payload FROM workshop_jobs WHERE id=?',j.id)).payload),draft=outline(p),request=coursePlanRequest(p);
 assert.equal(request.model,'muse-wonder-1.0');assert.equal(request.text.format.strict,true);assert.deepEqual(j.draft.sources.map(s=>s.excerpt),h.source.units.map(s=>s.excerpt));
 assert.throws(()=>validateCoursePlan({...draft,steps:[{...draft.steps[0],sourceRefs:['foreign']}]},p),/outside/);
 assert.throws(()=>validateCoursePlan({...draft,steps:[{...draft.steps[0],prerequisites:['objective-2']},draft.steps[1]]},p),/earlier/);
 assert.throws(()=>validateCoursePlan({...draft,steps:[{...draft.steps[0],topicId:'foreign'}]},p),/topic/);
 const forged=validateCoursePlan({...draft,sources:[{excerpt:'fabricated'}]},p);assert.equal(forged.sources[0].excerpt,h.source.units[0].excerpt);
 assert.throws(()=>coursePlanResult({id:'resp_test',model:'another-model',status:'completed'},p),/Unexpected/);
 const unsupported=validateCoursePlan({...draft,steps:[],gaps:['No matching evidence.']},p);assert.equal(unsupported.steps.length,0);
});
test('plan request resumes idempotently, edits are free, approval binds hash and source/course versions',async()=>{
 const h=await setup(),j=await reviewed(h);assert.equal(h.submissions(),1);await h.call(h.input);await h.call({action:'run',id:j.id});assert.equal(h.submissions(),1);
 await assert.rejects(h.call({...h.input,goal:'Different requested goal'}),/different input/);
 await assert.rejects(h.call({action:'approve',id:j.id,draftHash:'fake',confirmed:true}),/changed/);
 await assert.rejects(h.call({action:'approve',id:j.id,draftHash:j.draftHash}),/Review/);
 const edit=await h.call({action:'edit',id:j.id,draftHash:j.draftHash,draft:{...j.draft,title:'Reviewed water route'}}),updated=edit.jobs[0];assert.equal(edit.budget.used,1);assert.notEqual(updated.draftHash,j.draftHash);
 const approved=(await h.call({action:'approve',id:j.id,draftHash:updated.draftHash,confirmed:true})).jobs[0];assert.equal(approved.status,'approved');
 const req=new Request('https://test.local/api/learning/courses',{method:'POST',body:JSON.stringify({type:'link-plan',courseId:'earth',id:j.id,hash:approved.draftHash,expectedVersion:1})});await courseAPI(req,h.env,h.options);
 assert.equal(JSON.parse((await h.store.latest('learner_profiles','learner','courses')).payload).courses.courses[0].plan.id,j.id);
 await h.db.run('UPDATE workshop_resources SET status=? WHERE id=?','unreviewed','r-water');assert.match((await h.call()).jobs[0].issues.join(' '),/no longer reviewed/);
});
test('planner fails closed for foreign owners, managed learners, unreviewed selections, oversized packets and goal changes',async()=>{
 const h=await setup();await assert.rejects(h.call(h.input,{siteOwner:'foreign'}),/outside/);
 h.env.PILOT_ENABLED='true';await assert.rejects(h.call(h.input,{access:{canAuthor:false,ageBand:'13to17'}}),/organiser/);h.env.PILOT_ENABLED='false';
 await assert.rejects(h.call({...h.input,evidenceIds:['forged']}),/outside/);
 await assert.rejects(h.call({...h.input,evidenceIds:Array.from({length:25},(_,i)=>'s'+i)}),/twenty-four/);
 const j=await reviewed(h),saved=await h.store.latest('learner_profiles','learner','courses'),state=JSON.parse(saved.payload).courses;state.courses[0].goal='A changed goal';await h.store.write('learner_profiles','learner','courses',1,{courses:state},2);
 await assert.rejects(h.call({action:'approve',id:j.id,draftHash:j.draftHash,confirmed:true}),/changed/);
 assert.match((await h.call()).jobs[0].issues.join(' '),/course topics/);
});
test('lost provider acknowledgement is not resubmitted; saved response check recovers safely',async()=>{
 const h=await setup(),a=await h.call(h.input);let calls=0;
 await h.call({action:'run',id:a.jobId},{provider:async()=>{calls++;throw new TypeError('network')}});await h.call({action:'run',id:a.jobId},{provider:async()=>{calls++}});assert.equal(calls,1);assert.equal((await h.call()).jobs[0].status,'interrupted');
 await h.db.run('UPDATE workshop_jobs SET provider_id=? WHERE id=?','resp_recover',a.jobId);
 const out=await h.call({action:'check',id:a.jobId},{reader:async(id,p)=>{assert.equal(id,'resp_recover');return {status:'review',content:outline(p)}}});assert.equal(out.jobs[0].status,'review');
});
test('source deletion and retention include course plans, exports preserve exact plan and owner-bound context',async()=>{
 const h=await setup(),j=await reviewed(h);const plan=await deletionPlan(h.env,{...h.options,now:1000,mode:'resource',id:'r-water'});assert.ok(plan.jobs.includes(j.id));
 const req=new Request('https://test.local/api/learning/data',{method:'POST',body:JSON.stringify({action:'export',scope:'workspace',paged:true,epoch:'0:0'})});const data=await (await dataAPI(req,h.env,h.options)).json();assert.equal(data.export.coursePlans[0].id,j.id);assert.equal(data.export.coursePlans[0].draft.sources[0].excerpt,h.source.units[0].excerpt);
});
test('course suggestions use exact content versions, prioritise due/help, ignore game victories and keep every objective available',()=>{
 const plan={steps:[{id:'objective-1',objective:'A'},{id:'objective-2',objective:'B'}]},links=[{objectiveId:'objective-1',id:'j1',hash:'h1'},{objectiveId:'objective-2',id:'j2',hash:'h2'}],client={items:[{jobId:'j1',sourceHash:'h1',pack:{id:'p1'}},{jobId:'j2',sourceHash:'h2',pack:{id:'p2'}}],state:{units:[{id:unitKey({id:'p2'}),packId:'p2',contentHash:'v2'}]},cycles:[{packId:'p2',contentHash:'v2',stage:'revisit',dueAt:50,attempts:3}],records:[{summary:{completed:true}}]};
 const route=coursePlanRoute(plan,links,client,100);assert.equal(route.next.step.id,'objective-2');assert.equal(route.rows.length,2);assert.equal(route.rows[0].practised,false);
 client.items[1].sourceHash='changed';assert.equal(coursePlanRoute(plan,links,client,100).rows[1].item,undefined);
});
test('objective-to-chapter handoff requires the reviewed exact goal, passages and published chapter',async()=>{
 const {EXTENDED_PACKS}=await import('../src/game-modes/extended-packs.js'),h=await setup(),j=await reviewed(h);
 await h.call({action:'approve',id:j.id,draftHash:j.draftHash,confirmed:true});
 const save=async b=>courseAPI(new Request('https://test.local/api/learning/courses',{method:'POST',body:JSON.stringify(b)}),h.env,h.options);
 await save({type:'link-plan',courseId:'earth',id:j.id,hash:j.draftHash,expectedVersion:1});
 const draft=JSON.stringify(EXTENDED_PACKS.find(p=>p.template==='quiz-v1')),hash=await digest(draft),payload={goal:'Wrong goal',evidence:h.source.units};
 await h.db.run('INSERT INTO workshop_jobs(id,owner,request_key,request_hash,status,payload,draft,created,updated) VALUES(?,?,?,?,?,?,?,?,?)','chapter','workspace','chapter','chapter','published',JSON.stringify(payload),draft,1,1);
 const input={type:'link-objective-chapter',courseId:'earth',topicId:'water',objectiveId:'objective-1',id:'chapter',hash,expectedVersion:2};
 await assert.rejects(save(input),/exact evidence/);payload.goal=j.draft.steps[0].objective;await h.db.run('UPDATE workshop_jobs SET payload=?,status=? WHERE id=?',JSON.stringify(payload),'review','chapter');await assert.rejects(save(input),/publish/);
 await h.db.run('UPDATE workshop_jobs SET status=? WHERE id=?','published','chapter');const linked=await (await save(input)).json();assert.equal(linked.state.courses[0].plan.links[0].id,'chapter');assert.equal(linked.state.courses[0].topics[0].chapters[0].hash,hash);
});
test('learning gateway rejects mismatched session identity and stale cleanup epoch before planner work',async()=>{
 const {learningAPI}=await import('../server/learning-api.js'),h=await setup(),user={id:'planner-user',email:'planner@example.test',emailVerified:true};
 const request=headers=>new Request('https://test.local/api/learning/course-plan',{method:'POST',headers:{Origin:'https://test.local','Content-Type':'application/json',...headers},body:JSON.stringify({courseId:'earth',...h.input})});
 assert.equal((await learningAPI(request({'X-Mosaic-Learner':'wrong'}),h.env,{store:h.store,session:async()=>user})).status,401);
 const res=await learningAPI(request({'X-Mosaic-Learner':user.id,'X-Mosaic-Data-Epoch':'9:9'}),h.env,{store:h.store,session:async()=>user});assert.equal(res.status,409);assert.match((await res.json()).error,/data changed/);
});
test('course-plan lifecycle supports individual removal, content-free usage receipt and timed retention',async()=>{
 const {startDeletion}=await import('../server/data-lifecycle.js'),{readControls}=await import('../server/data-control.js');const h=await setup(),j=await reviewed(h);
 const inv=await (await dataAPI(new Request('https://test.local/api/learning/data'),h.env,h.options)).json();assert.equal(inv.jobs.find(x=>x.id===j.id).kind,'course-plan');
 const controls=await readControls(h.env,'workspace','learner',1000);await h.db.run('UPDATE data_controls SET policy=? WHERE scope=?',JSON.stringify({creativeDays:7}),controls.scopes.learner);
 const expired=await deletionPlan(h.env,{...h.options,now:8*86400000,mode:'expired'});assert.ok(expired.jobs.includes(j.id));assert.equal(expired.resources.length,0,'Plan retention does not remove its source');
 const plan=await deletionPlan(h.env,{...h.options,now:1000,mode:'episode',id:j.id}),removed=[];const result=await startDeletion(h.env,{...h.options,removeProvider:async id=>removed.push(id)},plan);assert.equal(result.status,'complete');assert.deepEqual(removed,['resp_coursefixture']);
 const receipt=await h.db.one('SELECT * FROM workshop_jobs WHERE id=?',j.id);assert.equal(receipt.status,'usage-only');assert.equal(receipt.draft,null);assert.deepEqual(JSON.parse(receipt.payload),{recordType:'usage'});assert.equal((await h.call()).jobs.length,0);assert(await h.db.one('SELECT id FROM workshop_resources WHERE id=?','r-water'));
});
test('deleted plan links can be cleared for free and learner exports keep plan records separate',async()=>{
 const h=await setup(),j=await reviewed(h);await h.call({action:'approve',id:j.id,draftHash:j.draftHash,confirmed:true});
 const save=b=>courseAPI(new Request('https://test.local/api/learning/courses',{method:'POST',body:JSON.stringify(b)}),h.env,h.options);
 await save({type:'link-plan',courseId:'earth',id:j.id,hash:j.draftHash,expectedVersion:1});
 const exported=await (await dataAPI(new Request('https://test.local/api/learning/data',{method:'POST',body:JSON.stringify({action:'export',scope:'learner',epoch:'0:0'})}),h.env,h.options)).json();assert.equal(exported.export.coursePlans[0].id,j.id);assert.equal(exported.export.creative.length,0);
 await h.db.run('DELETE FROM workshop_jobs WHERE id=?',j.id);const before=(await h.call()).budget.used;
 const cleared=await (await save({type:'unlink-plan',courseId:'earth',expectedVersion:2})).json();assert.equal(cleared.state.courses[0].plan,undefined);assert.equal(cleared.state.courses[0].topics[0].resources.length,1);assert.equal((await h.call()).budget.used,before);
});
