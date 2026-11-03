import test from 'node:test';import assert from 'node:assert/strict';
import {sharingFixture} from './helpers/course-sharing.mjs';import {exploreFixture} from './helpers/explore.mjs';
import {newUnit,activitiesOf,makeProgramme} from '../src/studio/programme.js';import {creativeContext,validateCreative} from '../src/studio/creative-content.js';
import {LOOP_STAGES} from '../src/studio/learning-loop.js';import {draftHash} from '../src/game-modes/draft-engine.js';import {digest} from '../server/content-service.js';import {emptyConnected,connectedRoute} from '../src/studio/connected-programme.js';
import {deletionPlan,startDeletion} from '../server/data-lifecycle.js';
async function fixture(){const h=await sharingFixture(),pack=h.chapters[0].pack,unit=newUnit(pack,{level:'Starting out',interests:['Football'],goal:'PRIVATE_AUTHOR_GOAL'},activitiesOf(pack).map(a=>a.key));await h.store.write('learner_profiles',h.identity.owner,'studio',0,{studio:{schemaVersion:1,active:unit.id,units:[unit]}},h.now());const resources=[];
 for(const kind of ['explore','practice','podcast','cartoon']){const p={id:'connected-'+kind,recordType:'creative',kind,learnerOwner:h.identity.owner,packId:pack.id,contentHash:draftHash(pack),...(['explore','practice'].includes(kind)?{activityKey:unit.activityKeys[0]}:{}),context:creativeContext(pack,unit,kind,unit.activityKeys[0])},refs=[p.context.evidence[0].id];
  const raw=kind==='explore'?exploreFixture(p,['timeline','worked-example']):kind==='practice'?{schemaVersion:1,id:p.id,kind,title:'Four fresh comparisons',objective:'Use the reviewed relationship.',explanation:p.context.evidence[0].excerpt,sourceRefs:refs,questions:LOOP_STAGES.map((stage,i)=>({stage,prompt:'Different situation '+i+'?',options:['Supported','Reversed','Unrelated'],answer:0,feedback:['Supported by evidence.','Direction reversed.','Unrelated to evidence.'],hint:'Compare the direction.',sourceRefs:refs}))}:{schemaVersion:1,id:p.id,kind,title:'The missing clue',summary:'A fictional puzzle built around the source.',segments:[0,1,2,3].map(i=>({id:'segment-'+(i+1),speaker:i%2?'learner':'guide',text:'The clue changes how we interpret this relationship.',scene:'workshop',action:'talk',sourceRefs:refs})),question:{prompt:'Explain the source relationship.',answer:p.context.evidence[0].excerpt,sourceRefs:refs}};
  const content=validateCreative(raw,p),hash=await digest(JSON.stringify(content));await h.db.run('INSERT INTO workshop_jobs(id,owner,request_key,request_hash,status,payload,draft,created,updated) VALUES(?,?,?,?,?,?,?,?,?)',p.id,h.identity.siteOwner,p.id,'fixture','creative-published',JSON.stringify(p),JSON.stringify(content),h.now(),h.now());resources.push({id:p.id,hash,kind,content});
 }
 const identity={packId:pack.id,contentHash:draftHash(pack)},programme=(input,user=h.learner)=>h.call(user,'learning/programme'+(input?'':'?'+new URLSearchParams(identity)),input?{...identity,...input}:undefined),assign=()=>h.assignCourse(h.learner,{learningResources:[{objectiveId:'objective-1',resources:resources.map(({id,hash})=>({id,hash}))}]});
 return {...h,pack,unit,resources,programIdentity:identity,programme,assign};}
test('one course objective delivers all four reviewed formats, without author context or answer keys; learner chooses immutable links',async()=>{
 const h=await fixture(),assigned=await h.assign();assert.equal(assigned.http,200);assert.equal(assigned.assignment.steps[0].learningResources.length,4);assert(!JSON.stringify(assigned).includes('PRIVATE_AUTHOR'));
 assert.equal((await h.call(h.learner,'learning/studio',{...h.programIdentity,type:'create',expectedVersion:0,activityKeys:h.unit.activityKeys})).http,200);
 const v=await h.programme();assert.equal(v.http,200);assert.equal(v.resources.length,4);assert(!JSON.stringify(v).includes('Different situation'));assert(!JSON.stringify(v).includes('PRIVATE_AUTHOR'));assert(!JSON.stringify(v).includes('accepted'));
 const chosen=await h.programme({action:'choose',expectedVersion:0,formats:['explore','practice','podcast','cartoon'],links:h.resources.map(({id,hash,kind})=>({id,hash,kind}))});assert.equal(chosen.http,200);assert.equal(chosen.version,1);assert.equal(chosen.route.steps.filter(s=>s.resource).length,4);
 assert.equal((await h.programme({action:'choose',expectedVersion:0,formats:[],links:[]})).http,409);assert.equal((await h.programme({action:'choose',expectedVersion:1,formats:[],links:[{id:'private-other',hash:'a'.repeat(64),kind:'podcast'}]})).http,409);
 const podcast=h.resources.find(r=>r.kind==='podcast'),script=await h.call(h.learner,'learning/programme?'+new URLSearchParams({...h.programIdentity,resourceId:podcast.id,resourceHash:podcast.hash}));assert.equal(script.http,200);assert.equal(script.script.kind,'podcast');
 const reflect=await h.programme({action:'reflect-media',expectedVersion:1,id:podcast.id,hash:podcast.hash,used:true,reflection:'I can connect the relationship to a team decision.'});assert.equal(reflect.version,2);assert.equal(reflect.route.steps.find(s=>s.kind==='podcast').selfReported,true);
 assert.equal((await h.report()).assignments[0].report.state,'off');
 await h.call(h.teacher,'learning/course-sharing',{action:'revoke',id:assigned.assignment.id,revision:assigned.assignment.revision});assert.notEqual((await h.call(h.learner,'learning/programme?'+new URLSearchParams({...h.programIdentity,resourceId:podcast.id,resourceHash:podcast.hash}))).http,200);
});
test('author resources becoming unreviewed are unavailable; deleting an attached resource prunes only it',async()=>{
 const h=await fixture();await h.assign();const v=await h.programme(undefined,h.teacher);assert.equal(v.http,200);const links=h.resources.map(({id,hash,kind})=>({id,hash,kind}));await h.programme({action:'choose',expectedVersion:0,formats:['explore','practice','podcast','cartoon'],links},h.teacher);
 const podcast=h.resources.find(r=>r.kind==='podcast');await h.db.run('UPDATE workshop_jobs SET status=? WHERE id=?','creative-review',podcast.id);const own=await h.programme(undefined,h.teacher);assert.equal(own.route.steps.find(s=>s.kind==='podcast').unavailable,true);
 const ctx={owner:h.identity.owner,siteOwner:h.identity.siteOwner,store:h.store,now:h.now,removeProvider:async()=>{}};const plan=await deletionPlan(h.env,{...ctx,mode:'episode',id:podcast.id,now:h.now()});assert.equal(plan.courseBankUpdates.length,1);await startDeletion(h.env,ctx,plan);const grants=await h.own();assert.equal(grants.assignments[0].steps[0].learningResources.length,3);
});
test('route adapts to text access, starting point, support and delayed questions without treating media use as mastery',async()=>{
 const h=await fixture(),base=makeProgramme(h.pack,h.unit),state={...emptyConnected(),links:h.resources.map(({id,hash,kind})=>({id,hash,kind}))},resources=h.resources.map(r=>({...r,progress:r.kind==='practice'?{due:true,waiting:false,complete:false}:null}));
 const due=connectedRoute({unit:h.unit,base,state,resources});assert.equal(due.next,'practice');assert.match(due.reason,/later question/);
 const textUnit={...h.unit,profile:{...h.unit.profile,access:{...h.unit.profile.access,textFirst:true}}},text=connectedRoute({unit:textUnit,base,state,resources:[]});assert.equal(text.steps[0].kind,'read');assert.match(text.reason,/text-first/);assert.match(text.scope,/not a grade/);
});
test('assigned media remains available when the learner selects a narrower related focus',async()=>{
 const h=await fixture();await h.assign();await h.call(h.learner,'learning/studio',{...h.programIdentity,type:'create',expectedVersion:0,activityKeys:[h.unit.activityKeys[0]]});const v=await h.programme();assert.equal(v.resources.length,4);assert(v.resources.filter(r=>['podcast','cartoon'].includes(r.kind)).every(r=>r.broaderFocus));
});
test('assignment resource picker is scoped to the exact chapter despite newer jobs for other packs',async()=>{
 const h=await fixture();const {availableLearningResources}=await import('../server/course-learning-resources.js'),row=await h.db.one('SELECT * FROM workshop_jobs WHERE id=?','connected-podcast');
 for(let i=0;i<161;i++){const p={...JSON.parse(row.payload),packId:'unrelated-pack'};await h.db.run('INSERT INTO workshop_jobs(id,owner,request_key,request_hash,status,payload,draft,created,updated) VALUES(?,?,?,?,?,?,?,?,?)','other-'+i,row.owner,'other-'+i,'fixture',row.status,JSON.stringify(p),row.draft,row.created+i+1,row.updated)}
 const assignments=await h.assign(),route={steps:assignments.assignment.steps};const available=await availableLearningResources(h.env,h.identity,route);assert.equal(available[0].resources.length,4);
});
test('assigned programme audio reuses author bytes and refuses expiry, wrong hashes and revoked access',async()=>{
 const h=await fixture(),assignment=await h.assign(),podcast=h.resources.find(r=>r.kind==='podcast');
 await h.call(h.learner,'learning/studio',{...h.programIdentity,type:'create',expectedVersion:0,activityKeys:[h.unit.activityKeys[0]]});
 await h.programme({action:'choose',expectedVersion:0,formats:['podcast'],links:[{id:podcast.id,hash:podcast.hash,kind:'podcast'}]});
 const {learningAPI}=await import('../server/learning-api.js'),bytes=new TextEncoder().encode('exact-stored-audio'),key='fixture-author-audio';await h.env.BUCKET.put(key,bytes);
 await h.db.run('INSERT INTO media_assets(id,site_owner,learner_owner,script_id,script_hash,segment,object_key,status,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?)','fixture-audio',h.identity.siteOwner,h.identity.owner,podcast.id,podcast.hash,0,key,'ready',h.now(),h.now());
 const audio=async(extra={})=>learningAPI(new Request('https://test.local/api/learning/programme?'+new URLSearchParams({...h.programIdentity,resourceId:podcast.id,resourceHash:podcast.hash,audioIndex:'0',...extra}),{headers:{'X-Mosaic-Learner':h.learner.id}}),h.env,{store:h.store,session:async()=>h.learner,now:h.now});
 const r=await audio();assert.equal(r.status,200);assert.equal(r.headers.get('X-Mosaic-Audio'),'stored');assert.deepEqual(new Uint8Array(await r.arrayBuffer()),bytes);assert.equal(h.env.BUCKET.puts,1);
 assert.equal((await audio({resourceHash:'f'.repeat(64)})).status,409);
 await h.db.run('INSERT OR REPLACE INTO data_controls(scope,policy,updated) VALUES(?,?,?)','learner:'+h.identity.owner,JSON.stringify({mediaDays:1}),h.now());h.advance(86400000);assert.equal((await audio()).status,410);
 await h.db.run('UPDATE data_controls SET policy=? WHERE scope=?',JSON.stringify({mediaDays:0}),'learner:'+h.identity.owner);assert.equal((await audio()).status,200);
 await h.call(h.teacher,'learning/course-sharing',{action:'revoke',id:assignment.assignment.id,revision:assignment.assignment.revision});assert.notEqual((await audio()).status,200);assert.equal(h.env.BUCKET.puts,1);
});
