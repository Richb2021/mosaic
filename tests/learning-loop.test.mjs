import test from 'node:test';
import assert from 'node:assert/strict';
import {D1} from './helpers/media-storage.mjs';
import {EXTENDED_PACKS} from '../src/game-modes/extended-packs.js';
import {newUnit,activitiesOf} from '../src/studio/programme.js';
import {creativeContext,validateCreative} from '../src/studio/creative-content.js';
import {LOOP_STAGES,validatePractice,emptyLoop,loopAction,loopView,validateLoop} from '../src/studio/learning-loop.js';
import {learningLoopAPI,learningLoopSummaries} from '../server/learning-loop-api.js';
import {digest} from '../server/content-service.js';
import {sqlDB} from '../server/data-control.js';
import {draftHash} from '../src/game-modes/draft-engine.js';
const pack=EXTENDED_PACKS.find(p=>p.template==='quiz-v1'),unit=newUnit(pack,{interests:['Football'],level:'Starting out'},activitiesOf(pack).map(a=>a.key)),context=creativeContext(pack,unit,'practice',unit.activityKeys[0]);
export const practiceFixture=(job={id:'practice-fixture',kind:'practice',context})=>({schemaVersion:1,id:job.id,kind:'practice',title:'A fresh relationship',objective:'Explain the relationship in the source.',explanation:job.context.evidence[0].excerpt,sourceRefs:[job.context.evidence[0].id],questions:LOOP_STAGES.map((stage,i)=>({stage,prompt:`Example ${i+1}: which relationship is supported?`,options:['The supported relationship','The reversed relationship','An unrelated relationship'],answer:0,feedback:['This matches the source.','Recheck the direction.','Recheck the source connection.'],hint:'Compare the direction of the relationship.',sourceRefs:[job.context.evidence[0].id]}))});
const job={id:'practice-fixture',kind:'practice',context},bank=validatePractice(practiceFixture(),job);
class Store{rows=new Map();async latest(t,o,s){return this.rows.get(o+':'+s)||null}async write(t,o,s,v,p,now){assert(s.length<=64);assert.equal((await this.latest(t,o,s))?.version||0,v);const r={id:this.rows.size+1,slot_key:s,owner_key:o,version:v+1,payload:JSON.stringify(p),updated_ms:now};this.rows.set(o+':'+s,r);return r}async allRows(t,o){return [...this.rows.values()].filter(r=>r.owner_key===o)}}
test('practice schema rejects changed source text, repeated existing or generated prompts and malformed answer keys',()=>{
 assert.deepEqual(validateCreative(bank,job),bank);
 for(const change of [b=>b.questions[2].prompt=b.questions[0].prompt,b=>b.questions[0].prompt=context.activities[0].prompt,b=>b.questions[0].answer=3,b=>b.questions[0].sourceRefs=['invented'],b=>b.sources=[{id:'fake'}],b=>b.questions[0].stage='revisit',b=>b.questions[1].options[1]=b.questions[1].options[0]]){const b=structuredClone(bank);change(b);assert.throws(()=>validatePractice(b,job));}
 assert.throws(()=>creativeContext(pack,unit,'practice','invented'));
});
test('wrong first answer requires explanation before fresh practice; help, confidence, transfer and real later revisit remain distinct',()=>{
 let state=emptyLoop(bank,'hash'),now=1000;
 const action=(input)=>state=loopAction(bank,state,input,now++);
 action({type:'answer',stage:'diagnostic',answer:1,confidence:'confident'});const original=structuredClone(state.answers[0]);
 assert.equal(loopView(bank,state,now).route.needsSupport,true);assert.equal(loopView(bank,state,now).question,null);
 assert.throws(()=>action({type:'answer',stage:'practice',answer:0,confidence:'confident'}),/explanation/);
 action({type:'help',stage:'practice',kind:'explanation'});assert.equal(loopView(bank,state,now).question.stage,'practice');
 action({type:'explain',text:'I can now describe the connection.'});action({type:'answer',stage:'practice',answer:0,confidence:'tentative'});
 assert.equal(state.answers[1].assisted,true);action({type:'answer',stage:'transfer',answer:0,confidence:'confident'});
 assert.equal(state.dueAt,state.answers[2].at+86400000);assert.equal(loopView(bank,state,now).question,null);
 assert.throws(()=>action({type:'answer',stage:'revisit',answer:0,confidence:'confident'}),/not due/);
 now=state.dueAt;action({type:'answer',stage:'revisit',answer:0,confidence:'confident'});
 assert.equal(loopView(bank,state,now).route.stage,'complete');assert.deepEqual(state.answers[0],original);validateLoop(bank,'hash',state);
 assert.throws(()=>action({type:'answer',stage:'diagnostic',answer:0,confidence:'confident'}),/complete/);
 assert.throws(()=>validateLoop(bank,'hash',{...state,dueAt:0}));
});
test('three correct answers without recorded help produce three-day revisit; hidden solution is absent from learner payload',()=>{
 let s=emptyLoop(bank,'hash');for(const stage of LOOP_STAGES.slice(0,3))s=loopAction(bank,s,{type:'answer',stage,answer:0,confidence:'confident'},2000);
 assert.equal(s.dueAt,2000+3*86400000);const v=loopView(bank,emptyLoop(bank,'hash'),2000);assert.equal(v.question.answer,undefined);assert.equal(v.explanation,null);assert.deepEqual(v.sources,[]);
});
test('real D1 bank, NCB-style CAS saves, exact revision, learner isolation and programme summaries',async()=>{
 const env={DB:new D1()},store=new Store(),owner='learner',siteOwner='site',db=sqlDB(env.DB),payload={...job,recordType:'creative',learnerOwner:owner,packId:pack.id,contentHash:draftHash(pack),activityKey:unit.activityKeys[0]},hash=await digest(JSON.stringify(bank));
 await db.run('INSERT INTO workshop_jobs(id,owner,request_key,request_hash,status,payload,draft,created,updated) VALUES(?,?,?,?,?,?,?,?,?)',bank.id,siteOwner,'fixture','fixture','creative-published',JSON.stringify(payload),JSON.stringify(bank),1,1);
 await store.write('learner_profiles',owner,'studio',0,{studio:{schemaVersion:1,active:unit.id,units:[unit]}},1);
 const call=async(body,changes={})=>{const input={bankId:bank.id,bankHash:hash,...body};return learningLoopAPI(new Request('https://test/api/learning/loop'+(body?'':'?'+new URLSearchParams(input)),{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(input):undefined}),env,{store,owner,siteOwner,resolve:async()=>pack,now:()=>1000,...changes})};
 assert.equal((await (await call()).json()).version,0);
 const unstarted=await learningLoopSummaries(env,{siteOwner,owner,store,now:1000});assert.equal(unstarted.length,1);assert.equal(unstarted[0].attempts,0);assert.equal(unstarted[0].stage,'diagnostic');assert.equal(unstarted[0].bankHash,hash);assert.equal(unstarted[0].questions,undefined);
 assert.deepEqual(await learningLoopSummaries(env,{siteOwner,owner:'other',store,now:1000}),[]);
 assert.deepEqual(await learningLoopSummaries(env,{siteOwner,owner,store,now:1000,units:[{...unit,activityKeys:[]}]}),[]);
 assert.deepEqual(await learningLoopSummaries(env,{siteOwner,owner,store,now:1000,units:[{...unit,contentHash:'changed'}]}),[]);
 await assert.rejects(call(null,{owner:'other'}),e=>e.status===404);await assert.rejects(call({bankHash:'0'.repeat(64),expectedVersion:0,action:{}}),e=>e.status===409);
 const body={expectedVersion:0,action:{type:'answer',stage:'diagnostic',answer:1,confidence:'tentative'}};assert.equal((await (await call(body)).json()).version,1);
 await assert.rejects(call(body),e=>e.status===409);
 const summaries=await learningLoopSummaries(env,{siteOwner,owner,store,now:1000});assert.equal(summaries.length,1);assert.equal(summaries[0].needsSupport,true);
 const saved=[...store.rows.values()].find(r=>r.slot_key.startsWith('loop-'));const intact=saved.payload;saved.payload=JSON.stringify({loop:{bankId:bank.id}});assert.deepEqual(await learningLoopSummaries(env,{siteOwner,owner,store,now:1000}),[]);saved.payload=intact;
 await db.run('UPDATE workshop_jobs SET status=? WHERE id=?','creative-review',bank.id);await assert.rejects(call(),e=>e.status===409);assert.deepEqual(await learningLoopSummaries(env,{siteOwner,owner,store,now:1000}),[]);
});
