import test from 'node:test';
import assert from 'node:assert/strict';
import {D1,Bucket} from './helpers/media-storage.mjs';
import {StoreError} from '../server/ncb-store.js';
import {learningAPI} from '../server/learning-api.js';
import {pilotAPI,learnerOwner,PILOT_NOTICE,workspaceIdentity} from '../server/pilot-access.js';
import {workshopGateway} from '../server/workshop-gateway.js';
import {sqlDB} from '../server/data-control.js';
import {digest} from '../server/content-service.js';
import {validateCourses,editCourses,emptyCourses,searchPassages} from '../src/studio/course-model.js';
import {EXTENDED_PACKS} from '../src/game-modes/extended-packs.js';
import {draftHash} from '../src/game-modes/draft-engine.js';
import {activitiesOf} from '../src/studio/programme.js';
class Store{
 rows=new Map();async latest(t,o,s){return this.rows.get(t+o+s)||null}
 async list(o){return [...this.rows.values()].filter(r=>r.owner_key===o&&r.table==='learner_saves')}
 async allRows(t,o){return [...this.rows.values()].filter(r=>r.owner_key===o&&r.table===t)}
 async deleteRows(t,o,ids){for(const [k,r] of this.rows)if(r.table===t&&r.owner_key===o&&ids.includes(r.id))this.rows.delete(k)}
 async write(t,o,s,v,p,n){if(((await this.latest(t,o,s))?.version||0)!==v)throw new StoreError('conflict',409);const r={table:t,owner_key:o,slot_key:s,version:v+1,payload:JSON.stringify(p),updated_ms:n,id:crypto.randomUUID()};this.rows.set(t+o+s,r);return r}
}
async function setup(){
 const user=id=>({id,email:id+'@example.test',emailVerified:true,name:id});const admin=user('admin-course'),teacher=user('teacher-course'),learner=user('learner-course'),other=user('other-course');
 const store=new Store(),env={DB:new D1(),BUCKET:new Bucket(),PILOT_ENABLED:'true',PILOT_ADMIN_OWNER:await learnerOwner(admin)};
 const request=(u,path,body,headers={})=>new Request('https://test.local/api/'+path,{method:body?'POST':'GET',headers:{Origin:'https://test.local','X-Mosaic-Learner':u.id,'Content-Type':'application/json','X-Lanternbound-Workshop':'1',...headers},body:body?JSON.stringify(body):undefined});
 const call=async(u,path,body,headers)=>{const f=path==='pilot'?pilotAPI:path.startsWith('workshop/')?workshopGateway:learningAPI,r=await f(request(u,path,body,headers),env,{store,session:async()=>u});return {status:r.status,...await r.json()}};
 const onboard=(u,ageBand='18plus')=>call(u,'pilot',{action:'onboarding',ageBand,noticeVersion:PILOT_NOTICE,confirmed:true,expectedVersion:0});
 async function invite(u,manager,fields){const i=await call(manager,'pilot',{action:'invite',email:u.email,...fields});assert.equal(i.status,200);assert.equal((await call(u,'pilot',{action:'claim',code:i.code})).status,200)}
 await onboard(admin);await invite(teacher,admin,{role:'teacher',context:'school',managedApproval:true});await onboard(teacher);await invite(learner,teacher,{context:'school',managedApproval:true});await onboard(learner,'13to17');await invite(other,admin,{context:'individual'});await onboard(other);
 return {admin,teacher,learner,other,store,env,call};
}
test('course notebook rejects duplicate IDs, forged hashes and oversized state while keeping saved input unchanged',()=>{
 const old=emptyCourses(),one=editCourses(old,{type:'create-course',id:'fractions',title:'Fractions',goal:'Use equal parts'});
 assert.equal(old.courses.length,0);const two=editCourses(one,{type:'create-topic',courseId:'fractions',id:'eighths',title:'Eighths',goal:''});
 assert.throws(()=>editCourses(two,{type:'create-topic',courseId:'fractions',id:'eighths',title:'Duplicate',goal:''}),/duplicate/);
 assert.throws(()=>editCourses(two,{type:'link-resource',courseId:'fractions',topicId:'eighths',id:'source-a'},{id:'source-a',checksum:'fake'}),/source version/);
 assert.throws(()=>validateCourses({...two,courses:[...two.courses,{...two.courses[0]}]}),/duplicate/);
 assert.equal(two.courses[0].topics[0].resources.length,0);
});
test('passage search returns exact provenance, excludes nonmatches and never labels lexical matches as coverage',()=>{
 const resources=[{id:'r1',checksum:'a'.repeat(64),status:'reviewed',units:[{id:'s1',title:'Bread',locator:'Page 2',excerpt:'A denominator counts equal pieces in a whole.'},{id:'s2',title:'Other',locator:'Page 3',excerpt:'Trees need sunlight.'}]}];
 const rows=searchPassages(resources,'denominator');assert.equal(rows.length,1);assert.equal(rows[0].id,'s1');assert.equal(rows[0].locator,'Page 2');assert.equal(rows[0].checksum,'a'.repeat(64));assert.deepEqual(rows[0].matched,['denominator']);assert.equal(rows[0].excerpt,resources[0].units[0].excerpt);assert.equal(searchPassages(resources,'volcano').length,0);assert.equal(searchPassages(resources,'the and').length,0);
});
test('NCB course slot enforces owner, version, canonical source hash, managed write boundary and export lifecycle',async()=>{
 const h=await setup(),{teacher,other,learner,call}=h;
 const resource=(await call(teacher,'workshop/resources',{title:'Teacher notes',text:'One whole is divided into eight equal pieces. The denominator counts all equal pieces. The numerator counts the selected pieces.'})).resource;
 let r=await call(teacher,'learning/courses',{type:'create-course',id:'fractions',title:'Fractions',goal:'Use equal pieces',expectedVersion:0});assert.equal(r.status,200);
 r=await call(teacher,'learning/courses',{type:'create-topic',courseId:'fractions',id:'eighths',title:'Eighths',goal:'Explain the denominator',expectedVersion:1});assert.equal(r.status,200);
 const link={type:'link-resource',courseId:'fractions',topicId:'eighths',id:resource.id,checksum:resource.checksum,expectedVersion:2};assert.equal((await call(teacher,'learning/courses',{...link,checksum:'b'.repeat(64)})).status,409);
 assert.equal((await call(teacher,'learning/courses',link)).status,200);assert.equal((await call(teacher,'learning/courses',link)).status,409);
 assert.equal((await call(other,'learning/courses',link)).status,409);
 assert.equal((await call(other,'learning/courses',{...link,expectedVersion:0})).status,404);
 assert.equal((await call(learner,'learning/courses',{type:'create-course',id:'forged',title:'Bad',goal:'',expectedVersion:0})).status,403);
 const owned=await call(teacher,'learning/courses'),foreign=await call(other,'learning/courses');assert.equal(owned.state.courses.length,1);assert.equal(foreign.state.courses.length,0);assert.equal(foreign.resources.length,0);
 const stale=await call(teacher,'learning/courses',null,{'X-Mosaic-Learner':'another'});assert.equal(stale.status,401);
 const data=await call(teacher,'learning/data'),exported=await call(teacher,'learning/data',{action:'export',epoch:data.epoch});assert.ok(exported.export.profiles.some(r=>r.slot==='courses'));
 const current=(await call(teacher,'learning/courses')).version;assert.equal((await call(teacher,'learning/courses',{type:'remove-course',courseId:'fractions',expectedVersion:current})).status,200);
 assert.equal((await call(teacher,'workshop/library')).resources.length,1,'Removing a notebook does not delete resources');
});
test('assigned chapter starts a learner programme without an author review; stale assignments and forged acknowledgement do not confer access',async()=>{
 const h=await setup(),{teacher,learner,other,call,env}=h,ctx=await workspaceIdentity(teacher,env),db=sqlDB(env.DB);
 const pack={...EXTENDED_PACKS.find(p=>p.template==='quiz-v1'),id:'generated-course-chapter'},draft=JSON.stringify(pack),hash=await digest(draft),jobId='course-job';
 await db.run('INSERT INTO workshop_jobs(id,owner,request_key,request_hash,status,payload,draft,created,updated) VALUES(?,?,?,?,?,?,?,?,?)',jobId,ctx.siteOwner,'fixture-course','fixture-hash','review','{}',draft,1,1);
 const assign={action:'assign',jobId,accountReference:await learnerOwner(learner),draftHash:hash};assert.equal((await call(teacher,'pilot',assign)).status,404);
 await db.run('UPDATE workshop_jobs SET status=? WHERE id=?','published',jobId);
 assert.equal((await call(teacher,'pilot',{...assign,draftHash:'b'.repeat(64)})).status,409);assert.equal((await call(teacher,'pilot',assign)).status,200);
 const create={type:'create',packId:pack.id,contentHash:draftHash(pack),activityKeys:activitiesOf(pack).map(a=>a.key),evidenceConfirmed:false,expectedVersion:0};
 assert.equal((await call(learner,'learning/studio',create)).status,200);
 assert.equal((await call(other,'learning/studio',{...create,evidenceConfirmed:true})).status,422);
 assert.equal((await call(teacher,'learning/studio',create)).status,400,'An author still reviews their own source');
 const catalog=await call(learner,'learning/studio/catalog');assert.ok(catalog.items.find(i=>i.jobId===jobId)?.readOnly);
 await db.run('UPDATE workshop_jobs SET draft=? WHERE id=?',JSON.stringify({...pack,title:'Changed without reapproval'}),jobId);
 assert.equal((await call(learner,'learning/studio/catalog')).items.some(i=>i.jobId===jobId),false,'A grant cannot silently adopt changed content');
 const newHash=await digest(JSON.stringify({...pack,title:'Changed without reapproval'}));
 assert.equal((await call(teacher,'pilot',{...assign,draftHash:newHash})).status,200);
 assert.equal((await call(learner,'learning/studio/catalog')).items.find(i=>i.jobId===jobId)?.pack.title,'Changed without reapproval','An explicit new assignment updates the exact grant');
});
test('chapter notebook only links own exact noncreative drafts; missing source remains a visible dangling reference',async()=>{
 const h=await setup(),{teacher,other,call,env}=h,ctx=await workspaceIdentity(teacher,env),db=sqlDB(env.DB),pack={...EXTENDED_PACKS.find(p=>p.template==='quiz-v1'),id:'generated-course-two'},draft=JSON.stringify(pack),hash=await digest(draft);
 await call(teacher,'learning/courses',{type:'create-course',id:'c',title:'C',goal:'',expectedVersion:0});await call(teacher,'learning/courses',{type:'create-topic',courseId:'c',id:'t',title:'T',goal:'',expectedVersion:1});
 await db.run('INSERT INTO workshop_jobs(id,owner,request_key,request_hash,status,payload,draft,created,updated) VALUES(?,?,?,?,?,?,?,?,?)','course-owned',ctx.siteOwner,'owned','hash','review','{}',draft,1,1);
 const payload={type:'link-chapter',courseId:'c',topicId:'t',id:'course-owned',hash,expectedVersion:2};assert.equal((await call(teacher,'learning/courses',payload)).status,200);
 const read=await call(teacher,'learning/courses');assert.equal(read.chapters[0].status,'review');assert.equal(read.chapters[0].hash,hash);
 assert.equal((await call(other,'learning/courses',{...payload,expectedVersion:0})).status,404);
 const resource=(await call(teacher,'workshop/resources',{title:'Temporary fixture',text:'These are exact source words for this isolated notebook deletion check. They are not real learner work.'})).resource;
 await call(teacher,'learning/courses',{type:'link-resource',courseId:'c',topicId:'t',id:resource.id,checksum:resource.checksum,expectedVersion:3});
 await db.run('DELETE FROM workshop_resources WHERE id=?',resource.id);const missing=await call(teacher,'learning/courses');assert.equal(missing.resources.length,0);assert.equal(missing.state.courses[0].topics[0].resources[0].id,resource.id);
});

test('unavailable group operations preserve learning but fail closed for author tools',async()=>{
 const {StudioClient,canPrepare}=await import('../src/studio/client.js');
 const savedFetch=globalThis.fetch;
 let notified=false;const client=new StudioClient();client.journal={changed:()=>{notified=client.access===null&&client.version===7},user:{id:'learner'},connected:true,connect:async()=>{},request:async path=>path==='studio/catalog'?{items:[]}:{state:{schemaVersion:1,units:[],active:null},version:7,units:[],cycles:[]}};
 globalThis.fetch=async url=>String(url)==='/api/pilot'?new Response(JSON.stringify({error:'Temporary group status failure'}),{status:503}):new Response('{}');
 try{await client.load();assert.equal(client.version,7);assert.equal(client.access,null);assert.equal(canPrepare(client),false);assert.match(client.warning,/temporarily unavailable/);assert(notified,'Consumers are notified after access and saved state finish loading')}finally{globalThis.fetch=savedFetch}
});
