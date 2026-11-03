import test from 'node:test';
import assert from 'node:assert/strict';
import {validateExplore,exploreSchema,modelResult,emptyExplore,exploreAction,exploreView,checkResponse} from '../src/studio/explore-model.js';
import {creativeContext,validateCreative} from '../src/studio/creative-content.js';
import {creativeRequest} from '../server/creative-provider.js';
import {exploreFixture} from './helpers/explore.mjs';
import {sharingFixture} from './helpers/course-sharing.mjs';
import {newUnit,activitiesOf} from '../src/studio/programme.js';
import {draftHash} from '../src/game-modes/draft-engine.js';
import {digest} from '../server/content-service.js';
import {learnerOwner} from '../server/pilot-access.js';
import {deletionPlan,startDeletion} from '../server/data-lifecycle.js';
const job={id:'lesson',kind:'explore',context:{evidence:[{id:'source',title:'Fractions',locator:'Paragraph 1',excerpt:'One half and two quarters represent the same amount when their wholes have the same size. Half of eighty is forty.'}],learner:{level:'Starting out',interests:['Football']}}};
const lesson=validateExplore(exploreFixture(job),job);
const answer=(id,response,extra={})=>({type:'answer',id,response,unit:'',working:'',confidence:'tentative',criteria:[],...extra});
test('Explore schemas bind identity, canonical citations and all seven authored components',()=>{
 for(const types of [['simulation','graph'],['timeline','causal-map','diagram','worked-example','evidence-sort']]){const clean=validateCreative(exploreFixture(job,types),job);assert.deepEqual(validateExplore(clean,job),clean)}
 const schema=exploreSchema(job);assert.equal(schema.additionalProperties,false);assert.deepEqual(schema.properties.kind.enum,['explore']);const request=creativeRequest(job);assert.equal(request.model,'muse-wonder-1.0');assert.match(request.input[0].content,/never supplies|No executable code/i);assert.equal(request.text.format.strict,true);
 for(const mutate of [x=>x.id='wrong',x=>x.investigations[0].sourceRefs=['foreign'],x=>x.investigations[0].model='eval',x=>x.investigations[0].controls[1].max=101,x=>x.investigations[2].links[0].to=90,x=>x.investigations[1].items[0].value=5,x=>x.assessment[1].answer=Infinity,x=>x.sources=[{id:'fake'}],x=>x.investigations[0].code='alert(1)']){const raw=structuredClone(lesson);mutate(raw);assert.throws(()=>validateExplore(raw,job))}
});
test('authored balance conserves quantities and linear graph handles negative slopes and bounds',()=>{
 const b=lesson.investigations[0];for(const input of [0,1,30,100])for(const percent of [0,25,100]){const r=modelResult(b,[input,percent]);assert(Math.abs(r.output+r.remainder-input)<1e-9)}assert.throws(()=>modelResult(b,[80,101]));
 const g=validateExplore(exploreFixture(job,['graph','diagram']),job).investigations[0];g.controls[1].min=-5;assert.equal(modelResult(g,[10,-2]).output,-20);
});
test('numeric checks reject coercion, wrong units and partial answers; rubric is not auto-graded',()=>{
 const q=lesson.assessment[1];for(const invalid of ['40units','0x28','4e1','Infinity','40,0',''])assert.equal(checkResponse(q,invalid,'units').status,'invalid-number');assert.equal(checkResponse(q,'40','kg').status,'check-unit');assert.equal(checkResponse(q,'40.0','units').correct,true);assert.equal(checkResponse(lesson.assessment[0],'half of everything').correct,false);assert.equal(checkResponse(lesson.assessment[0],' One Half ').correct,true);assert.deepEqual(checkResponse(lesson.assessment[3],'a response'),{status:'human-review',correct:null});
});
test('first responses are immutable, hints are time-specific and future keys are withheld',()=>{
 let s=emptyExplore(lesson,'hash'),v=exploreView(lesson,s);assert(!JSON.stringify(v).includes('"answer":40'));assert(!JSON.stringify(v).includes('"accepted"'));assert.equal(v.investigations[3].items[0].category,undefined);assert.equal(v.investigations[3].items[0].value,undefined);
 s=exploreAction(lesson,s,{type:'help',id:'task-1'},1);s=exploreAction(lesson,s,answer('task-1','half'),2);assert(s.answers[0].assisted);assert.throws(()=>exploreAction(lesson,s,answer('task-1','other'),3));s=exploreAction(lesson,s,answer('task-2','40',{unit:'units'}),4);s=exploreAction(lesson,s,{type:'help',id:'task-2'},5);assert.equal(s.answers[1].assisted,false);v=exploreView(lesson,s);assert.equal(v.assessment[1].result.correct,true);assert.equal(v.assessment[2].answer,undefined);
 assert.throws(()=>exploreAction(lesson,s,answer('task-3','40',{unit:'units'}),6));assert.throws(()=>exploreAction(lesson,s,answer('task-4','thought',{criteria:['shown']}),6));assert.throws(()=>exploreAction(lesson,s,{type:'answer',id:'task-3',response:'40',unit:'units',working:'steps',confidence:'confident',criteria:[],assisted:false},6));
});
test('investigations validate stored settings/classification and complete only with all responses',()=>{
 let s=emptyExplore(lesson,'hash');for(const b of lesson.investigations)s=exploreAction(lesson,s,{type:'investigation',id:b.id,prediction:'I expect equal amounts.',observed:'The result kept the same total.',values:b.controls.map(c=>c.initial),sort:b.type==='evidence-sort'?b.items.map(v=>v.category):[]},1);
 assert.throws(()=>exploreAction(lesson,s,{type:'investigation',id:'investigation-1',prediction:'replacement',observed:'other',values:[10,10],sort:[]},2));assert.equal(exploreView(lesson,s).completed,false);
 for(const q of lesson.assessment)s=exploreAction(lesson,s,answer(q.id,q.type==='short-answer'?'half':q.type==='rubric'?'Two smaller pieces may have the same amount as one large piece.':'40',{unit:q.unit,working:q.type==='worked-solution'?'80 / 4 = 20; 20 * 2 = 40.':'',criteria:q.criteria.map(()=> 'partly')}),3);assert.equal(exploreView(lesson,s).completed,true);
});
async function fixture(){const h=await sharingFixture(),pack=h.chapters[0].pack,unit=newUnit(pack,{level:'Starting out',interests:['Nature'],goal:'PRIVATE_AUTHOR_CONTEXT'},activitiesOf(pack).map(a=>a.key)),p={id:'creative-explore-test',kind:'explore',recordType:'creative',learnerOwner:h.identity.owner,packId:pack.id,contentHash:draftHash(pack),activityKey:unit.activityKeys[0],context:creativeContext(pack,unit,'explore',unit.activityKeys[0])},bank=validateExplore(exploreFixture(p),p),hash=await digest(JSON.stringify(bank));await h.db.run('INSERT INTO workshop_jobs(id,owner,request_key,request_hash,status,payload,draft,created,updated) VALUES(?,?,?,?,?,?,?,?,?)',p.id,h.identity.siteOwner,p.id,'fixture','creative-published',JSON.stringify(p),JSON.stringify(bank),h.now(),h.now());
 const assign=()=>h.assignCourse(h.learner,{questionBanks:[{objectiveId:'objective-1',id:p.id,hash}]}),open=()=>h.call(h.learner,'learning/studio',{expectedVersion:0,packId:pack.id,contentHash:draftHash(pack),type:'create',activityKeys:unit.activityKeys}),call=(body,u=h.learner)=>h.call(u,'learning/explore'+(body?'':'?'+new URLSearchParams({lessonId:p.id,lessonHash:hash})),body?{lessonId:p.id,lessonHash:hash,...body}:undefined);return {...h,p,bank,hash,pack,assign,open,lesson:call};}
test('assigned Explore journey is source-bound and private with NCB CAS, export and withdrawal',async()=>{
 const h=await fixture(),g=await h.assign();assert.equal(g.http,200);assert.equal(g.assignment.steps[0].questionBank.kind,'explore');await h.open();let v=await h.lesson();assert.equal(v.http,200);assert.equal(v.assigned,true);assert(!JSON.stringify(v).includes('PRIVATE_AUTHOR_CONTEXT'));assert.equal(v.assessment[1].answer,undefined);assert.equal((await h.lesson(undefined,h.other)).http,404);
 v=await h.lesson({expectedVersion:0,action:answer('task-2','40',{unit:'units'})});assert.equal(v.version,1);assert.equal(v.assessment[1].result.correct,true);assert.equal((await h.lesson({expectedVersion:0,action:answer('task-1','half')})).http,409);assert.equal((await h.lesson({expectedVersion:1,action:answer('task-2','50',{unit:'units'})})).http,422);
 const reload=await h.lesson();assert.equal(reload.state.answers[0].response,'40');const inv=await h.call(h.learner,'learning/data'),ex=await h.call(h.learner,'learning/data',{action:'export',epoch:inv.epoch});assert(ex.export.profiles.some(r=>r.slot.startsWith('explore-')));assert(!JSON.stringify(ex).includes('PRIVATE_AUTHOR_CONTEXT'));assert(!JSON.stringify(ex).includes('"accepted"'));
 await h.call(h.teacher,'learning/course-sharing',{action:'revoke',id:g.assignment.id,revision:g.assignment.revision});assert.equal((await h.lesson()).http,404);assert((await h.store.allRows('learner_profiles',await learnerOwner(h.learner))).some(r=>r.slot_key.startsWith('explore-')));
});
test('Explore original deletion prunes the assigned snapshot without deleting unrelated games',async()=>{
 const h=await fixture();await h.assign();await h.open();const ctx={owner:h.identity.owner,siteOwner:h.identity.siteOwner,store:h.store,now:h.now},plan=await deletionPlan(h.env,{...ctx,now:h.now(),mode:'episode',id:h.bank.id});assert.equal(plan.courseBankUpdates.length,1);await startDeletion(h.env,ctx,plan);assert.equal((await h.lesson()).http,404);assert.equal((await h.own()).assignments[0].steps[0].questionBank,undefined);assert.equal((await h.call(h.learner,'learning/studio/catalog')).items.filter(i=>i.readOnly).length,2);
});

test('semantically identical accepted spelling variants normalize without a replacement generation',()=>{const raw=structuredClone(lesson);raw.assessment[0].accepted=['half',' HALF '];assert.equal(validateExplore(raw,job).assessment[0].accepted.length,1);assert.throws(()=>exploreAction(lesson,emptyExplore(lesson,'hash'),answer('task-2','40 units',{unit:'units'}),1));});

test('wrong or missing numeric units do not consume the first response or reveal the answer',()=>{const s=emptyExplore(lesson,'hash');for(const unit of ['', 'kg'])assert.throws(()=>exploreAction(lesson,s,answer('task-2','40',{unit}),1));assert.equal(s.answers.length,0);assert.equal(exploreView(lesson,s).assessment[1].answer,undefined);});
