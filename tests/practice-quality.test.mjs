import test from 'node:test';
import assert from 'node:assert/strict';
import {D1} from './helpers/media-storage.mjs';
import {EXTENDED_PACKS} from '../src/game-modes/extended-packs.js';
import {newUnit,activitiesOf} from '../src/studio/programme.js';
import {draftHash} from '../src/game-modes/draft-engine.js';
import {creativeContext,validateCreative,reviewCreative} from '../src/studio/creative-content.js';
import {LOOP_STAGES,validatePractice,practiceIssues,practiceSchema,maskedAnswer,namesAnswer,loopView,emptyLoop} from '../src/studio/learning-loop.js';
import {creativeRequest,creativeResult} from '../server/creative-provider.js';
import {creativeAPI} from '../server/creative-api.js';

const pack=EXTENDED_PACKS.find(p=>p.template==='quiz-v1'),keys=activitiesOf(pack).map(a=>a.key),unit=newUnit(pack,{interests:['Football'],level:'Starting out'},keys);
const context=creativeContext(pack,unit,'practice',keys[2]),job={id:'practice-quality',kind:'practice',context},ref=context.evidence[0].id;
const question=(stage,i,q)=>({stage,prompt:`Situation ${i+1}: which process explains it?`,options:['Respiration','Photosynthesis','Evaporation'],answer:1,feedback:['Respiration releases energy.','Photosynthesis uses light to make food.','Evaporation moves water.'],hint:'Think about what the plant takes in.',sourceRefs:[ref],...q});
// Shaped like the staging output: every question on the first focus, the same answer, and a hint that spells most of it.
const bad=(j=job)=>({schemaVersion:1,id:j.id,kind:'practice',title:'How plants make food',objective:'Explain how plants make food from light.',explanation:'Light in, plant makes food — ph…synthesis.',sourceRefs:[ref],questions:LOOP_STAGES.map((stage,i)=>question(stage,i,{activityKey:j.context.activities[0].key,hint:'Light in, plant makes food — ph…synthesis.'}))});
const answers=['A forward change','The amount doubles','Only the first case','It stays the same'];
const good=(j=job)=>({schemaVersion:1,id:j.id,kind:'practice',title:'Four fresh comparisons',objective:'Use the reviewed relationship in new cases.',explanation:'Each case asks what the source relationship predicts. Decide which way the change goes before choosing.',sourceRefs:[ref],questions:LOOP_STAGES.map((stage,i)=>({stage,activityKey:j.context.activities[i%j.context.activities.length].key,prompt:`Case ${i+1}: what does the relationship predict here?`,options:[answers[i],'The reverse of that','Nothing changes at all'],answer:0,feedback:[`Yes: ${answers[i]} follows from the source.`,'That reverses the direction.','The source links the two.'],hint:'Check the direction of the relationship in the source.',sourceRefs:[ref]}))});
const meta=raw=>({id:'resp_quality',status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify(raw)}]}]});

test('practice context spreads across up to four programme focuses, chosen focus first, and the request says so',()=>{
 assert.deepEqual(context.activities.map(a=>a.key),[keys[2],...keys.filter(k=>k!==keys[2]).slice(0,3)]);
 assert.deepEqual(creativeContext(pack,newUnit(pack,{},[keys[5]]),'practice',keys[5]).activities.map(a=>a.key),[keys[5]]);
 assert.deepEqual(creativeContext(pack,unit,'explore',keys[2]).activities.map(a=>a.key),[keys[2]]);
 assert.deepEqual(practiceSchema(job).properties.questions.items.properties.activityKey.enum,context.activities.map(a=>a.key));
 const system=creativeRequest(job).input[0].content;
 for(const rule of [/Spread the questions across the focuses/,/different correct answer/,/read BEFORE answering/,/masked form/])assert.match(system,rule);
});

test('the staging-shaped cycle is rejected with a reason for each problem; a good cycle passes unchanged',()=>{
 const bank=validatePractice(bad(),job),issues=practiceIssues(bank,job);
 assert.match(issues.join(' '),/only test one focus; spread them across the 4 selected focuses/);
 assert.match(issues.join(' '),/Questions 1, 2, 3 and 4 share the correct answer “Photosynthesis”/);
 for(const n of [1,2,3,4])assert.match(issues.join(' '),new RegExp(`Question ${n}’s hint gives the answer away \\(“ph…synthesis”\\)`));
 assert.match(issues.join(' '),/explanation gives an answer away \(“ph…synthesis”\)/);
 assert.throws(()=>reviewCreative(bad(),job),e=>e.status===400&&/^These questions need another version: /.test(e.message));
 // Fresh model output fails the request with the same reason; no content reaches review.
 assert.throws(()=>creativeResult(meta(bad()),job),e=>e.status===422&&/correct answer “Photosynthesis”/.test(e.message)&&e.providerId==='resp_quality');
 const ok=good();assert.deepEqual(practiceIssues(validatePractice(ok,job),job),[]);
 assert.deepEqual(reviewCreative(ok,job),validatePractice(ok,job));assert.deepEqual(creativeResult(meta(ok),job).content,validatePractice(ok,job));
 assert.deepEqual(validatePractice(ok,job).questions.map(q=>q.activityKey),context.activities.map(a=>a.key));
});

test('only pre-answer text is checked for answers; feedback may name them',()=>{
 const check=change=>{const raw=good();change(raw);return practiceIssues(validatePractice(raw,job),job).join(' ')};
 assert.equal(check(b=>b.questions[0].feedback[0]='Correct: A forward change.'),'');
 assert.match(check(b=>b.questions[1].hint='The amount doubles, so pick that.'),/Question 2’s hint gives the answer away \(“The amount doubles”\)/);
 // The explanation may use the topic's terms; only a masked giveaway is turned back.
 assert.equal(check(b=>b.explanation+=' Here, it stays the same.'),'');
 assert.match(check(b=>b.explanation+=' Remember: a forw…'),/explanation gives an answer away/);
 assert.match(check(b=>{b.questions[2].options[0]='Photosynthesis';b.questions[2].hint='Starts with p, ends with s: p_______s.'}),/Question 3’s hint/);
 assert.match(check(b=>b.questions[0].prompt+=' (Hint: a forward chan…)'),/question 1 shows a masked answer/);
 assert.match(check(b=>b.questions[3].options[0]=' a FORWARD change! '),/Questions 1 and 4 share the correct answer/);
 // Two or more focuses is enough; all on one focus, or untagged, is turned back.
 assert.equal(check(b=>b.questions.forEach((q,i)=>q.activityKey=context.activities[i%2].key)),'');
 assert.match(check(b=>b.questions.forEach(q=>q.activityKey=context.activities[0].key)),/only test one focus/);
 assert.match(check(b=>b.questions.forEach(q=>delete q.activityKey)),/Tag each question with the focus it tests/);
 assert.throws(()=>validatePractice({...good(),questions:good().questions.map(q=>({...q,activityKey:'invented'}))},job),/outside this cycle/);
 // Ordinary ellipses and short common words are not treated as answers.
 for(const [t,a] of [['Think about what happens…','Photosynthesis'],['Light in… then food','Insulin'],['Fill the ____ gap','Photosynthesis']])assert.equal(maskedAnswer(t,a),undefined);
 for(const [t,a] of [['ph…synthesis','Photosynthesis'],['Ph_t_s_nth_s_s','Photosynthesis'],['photo...','Photosynthesis'],['c…e','Carbon dioxide']])assert.ok(maskedAnswer(t,a));
 assert.equal(namesAnswer('No, the plant needs light','No'),false);assert.equal(namesAnswer('Plants use photosynthetic cells','Photosynthesis'),false);
 // The learner sees a hint before answering and the answer only in feedback afterwards.
 const bank=validatePractice(good(),job),v=loopView(bank,{...emptyLoop(bank,'h'),help:[{stage:'diagnostic',kind:'hint',at:1}]},2);assert.equal(v.question.hint,bank.questions[0].hint);assert.equal(v.question.answer,undefined);
});

test('older published banks without a focus per question still read; a one-focus cycle needs no tags',()=>{
 const old=good();old.questions.forEach(q=>delete q.activityKey);const one={...job,context:creativeContext(pack,newUnit(pack,{},[keys[0]]),'practice',keys[0])};
 const bank=validatePractice({...old},one);assert(!('activityKey' in bank.questions[0]));assert.deepEqual(practiceIssues(bank,one),[]);
 assert.deepEqual(validatePractice(bank,{id:job.id,context:{evidence:bank.sources,activities:[]}}),bank);
 assert.deepEqual(validateCreative(validatePractice(bad(),job),job).questions[0].options[1],'Photosynthesis');
});

test('creative API: a rejected generation fails with the reason, edits and approval are checked, a good cycle is approved',async()=>{
 const identity={packId:pack.id,contentHash:draftHash(pack)},env={DB:new D1(),META_API_KEY:'fixture-only',WORKSHOP_GENERATION_LIMIT:'50'};let version=1,saved={schemaVersion:1,active:unit.id,units:[unit]},output=bad;
 const store={list:async()=>[],latest:async(t,o,slot)=>slot==='studio'?{version,payload:JSON.stringify({studio:saved})}:null,write:async(t,o,slot,expected,value)=>{saved=value.studio;return {version:++version}}};
 const deps={store,siteOwner:'site-owner',owner:'learner-a',resolve:async()=>pack,provider:async j=>creativeResult(meta(output(j)),j)};
 const call=async body=>{const req=new Request('https://game.test/api/learning/creative',{method:'POST',headers:{'oai-authenticated-user-id':'site-owner',Origin:'https://game.test','Content-Type':'application/json'},body:JSON.stringify({...identity,...body})});try{const r=await creativeAPI(req,env,deps);return {status:r.status,...await r.json()}}catch(e){return {status:e.status||400,error:e.message}}};
 const make=async key=>{const c=await call({action:'create',requestKey:key,kind:'practice',activityKey:keys[1]});assert.equal(c.status,200,c.error);return (await call({action:'run',id:c.jobId})).jobs.find(j=>j.id===c.jobId)};
 const failed=await make('quality-bad');assert.equal(failed.status,'failed');assert.equal(failed.draft,null);assert.match(failed.error,/correct answer “Photosynthesis”.*hint gives the answer away \(“ph…synthesis”\)/);
 output=good;const j=await make('quality-good');assert.equal(j.status,'review');assert.equal(j.draft.questions[0].activityKey,keys[1]);
 const edit=await call({action:'edit',id:j.id,draftHash:j.draftHash,draft:{...j.draft,questions:j.draft.questions.map(q=>({...q,hint:q.options[q.answer]+' is right.'}))}});assert.equal(edit.status,400);assert.match(edit.error,/Question 1’s hint gives the answer away/);
 const approved=await call({action:'review',id:j.id,draftHash:j.draftHash,confirmed:true});assert.equal(approved.status,200,approved.error);assert.equal(approved.jobs.find(x=>x.id===j.id).status,'published');
});
