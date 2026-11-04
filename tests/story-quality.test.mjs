import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {scoreStory,storyView,storyBeats,repairStory,needsStoryRetry,validateStoryArc,storyQualityNotice,STORY_CRITERIA} from '../src/story-quality.js';
import {ANTICIPATION,FORMAT_ARCS,storyCraft} from '../src/story-direction.js';
import {EXTENDED_PACKS} from '../src/game-modes/extended-packs.js';
import {validateExtendedContent} from '../src/game-modes/extended-content.js';
import {validatePlayableContent} from '../src/game-modes/content-registry.js';
import {generationRequest,readWonder,checkStory,MODEL} from '../server/content-service.js';
import {checkCreativeStory,creativeRequest} from '../server/creative-provider.js';
import {chooseAfterRetry,retryState,shouldRetryStory,storyCheckSummary} from '../server/story-retry.js';
import {workshopAPI} from '../server/workshop-api.js';

const fixture=name=>JSON.parse(readFileSync(new URL('./fixtures/story-quality/'+name,import.meta.url)));
const pack=id=>structuredClone(EXTENDED_PACKS.find(p=>p.id===id));
const chapter=JSON.parse(readFileSync(new URL('../public/chapters/water-and-systems.json',import.meta.url)));

// A quiz rewritten the way the new prompts ask: trouble first, a clock, consequences and open loops.
function grippingQuiz(){
 const q=pack('riverlight-water-quiz');
 q.hook='The Star Archive’s lamps are dying, and Keeper Juno has until midnight to relight the eight water seals before the whole archive goes dark. Can you and Juno crack every seal in time?';
 q.questions.forEach((x,i)=>{const o=x.options[x.solution];o.feedback=i===q.questions.length-1?'The last seal blazes and the archive lights up at midnight — Juno cheers because the water cycle finally makes sense.':`The seal clicks open and a lamp glows. But the next seal is still dark — what is hiding behind it?`});
 return q;
}

test('real stored drafts: the checker finds the missing open loops in flat quiz-style feedback',()=>{
 const {draft,story}=fixture('staging-sports-primary.json'),r=scoreStory(draft,{story});
 assert.equal(r.criteria.loops,0,'"Touchline call: yes — …" feedback leaves nothing open');
 assert.equal(r.criteria.hook,2,'the real hook starts in comic trouble');
 assert.ok(needsStoryRetry(r),'a core criterion at zero earns one guided revision');
 assert.match(r.fixes.find(f=>f.criterion==='loops').fix,/open loop/);
 const pod=fixture('staging-podcast-football.json'),p=scoreStory(pod.draft,{story:pod.story});
 assert.ok(p.score>=8&&p.score<=16);assert.equal(storyView(pod.draft).beats.length,pod.draft.segments.length);
});

test('a lesson-style opener scores weak; the same quiz written for anticipation scores strong',()=>{
 const flat=pack('riverlight-water-quiz');flat.hook='Welcome to The Star Archive. In this quiz you will learn about the water cycle.';
 flat.questions.forEach(x=>{x.options[x.solution].feedback='Correct.'});
 const weak=scoreStory(flat,{story:{audience:'secondary'}}),strong=scoreStory(grippingQuiz(),{story:{audience:'secondary'}});
 assert.equal(weak.criteria.hook,0);assert.equal(weak.reasons.hook,'opens like a lesson');assert.ok(weak.coreZero.includes('loops'));
 assert.ok(strong.score>=weak.score+4,`${strong.score} vs ${weak.score}`);
 assert.equal(strong.criteria.hook,2);assert.equal(strong.criteria.question,2);assert.equal(strong.criteria.loops,2);
 assert.ok(!needsStoryRetry(strong));
});

test('every format reads into ordered learning beats and a score between 0 and 16',()=>{
 for(const p of [...EXTENDED_PACKS,chapter]){
  const v=storyView(p),r=scoreStory(p,{});
  assert.ok(v.beats.length>=3,p.template);assert.ok(v.opening.length>0,p.template);
  assert.ok(r.score>=0&&r.score<=16);assert.deepEqual(Object.keys(r.criteria),Object.keys(STORY_CRITERIA));
  for(const b of storyBeats(p))for(const [o,k] of b.after)assert.equal(typeof o[k],'string',`${p.template} ${b.key}.${k}`);
 }
});

test('disclaimers in player text are removed and lower the voice score until they are',()=>{
 const q=grippingQuiz();q.hook+=' This story is fictional and does not prove mastery.';
 const before=scoreStory(q,{});assert.equal(before.criteria.voice,0);assert.ok(before.disclaimer);
 const {content,notes}=repairStory(q,{validate:validateExtendedContent});
 assert.ok(!/fictional|mastery/.test(content.hook));assert.match(notes[0],/disclaimer/);
 assert.ok(scoreStory(content,{}).criteria.voice>0);
});

test('repair writes the model’s own planned open loops into the beat that forgot them, never breaking validation',()=>{
 const q=pack('riverlight-water-quiz');q.questions.forEach(x=>{x.options[x.solution].feedback='Correct, that is right.'});
 const arc=validateStoryArc({dramaticQuestion:'Can Juno relight the archive before midnight?',stakes:'The archive goes dark.',clock:'Midnight.',payoff:'The cycle relights it.',beats:q.questions.map((_,i)=>({activity:`question-${i}`,learning:'water cycle',openLoop:`But seal ${i+2} is still dark — what is hiding behind it?`}))});
 const {content,notes}=repairStory(q,{arc,validate:validateExtendedContent});
 assert.equal(notes.filter(n=>/open loop/.test(n)).length,q.questions.length-1,'the last beat resolves instead');
 assert.match(content.questions[0].options[content.questions[0].solution].feedback,/seal 2 is still dark/);
 assert.equal(content.questions.at(-1).options[content.questions.at(-1).solution].feedback,'Correct, that is right.');
 assert.ok(scoreStory(content,{arc}).criteria.loops>=1);validateExtendedContent(content);
 // A repair the validator rejects is dropped, leaving the draft as it was.
 const untouched=repairStory(q,{arc,validate:()=>{throw Error('too long')}});assert.deepEqual(untouched.content,q);assert.deepEqual(untouched.notes,[]);
});

test('game requests ask for a checked story plan and per-format anticipation; the plan never reaches the game',async()=>{
 const evidence=[{id:'source-1',title:'Notes',locator:'Paragraph 1',excerpt:'Warmth evaporates water. Cooling condenses vapour into droplets.'}];
 const job={chapterId:'generated-story',topicId:'water-and-systems',goal:'Explain the water cycle',level:'Year 7',evidence,template:'quiz-v1',story:{genre:'mystery',interest:'Space',audience:'secondary'}};
 const r=generationRequest(job),system=r.input[0].content;
 assert.ok(r.text.format.schema.required.includes('storyArc'));
 assert.deepEqual(r.text.format.schema.properties.storyArc.properties.beats.items.properties.activity.enum,Array.from({length:8},(_,i)=>`question-${i}`));
 assert.ok(system.includes(ANTICIPATION)&&system.includes(FORMAT_ARCS['quiz-v1']));assert.match(system,/Suspense for secondary/);
 assert.ok(system.lastIndexOf('STORY CRAFT')>system.indexOf('Also return storyArc'),'craft stays last');
 assert.equal(r.input.length,2,'no revision messages on a first request');
 // A real-shaped response: game plus plan. The plan is checked and kept beside the game, not in it.
 const game={...grippingQuiz(),id:job.chapterId,topicId:job.topicId,revision:1};for(const x of game.questions)x.sourceRefs=['source-1'];game.debrief.sourceRefs=['source-1'];delete game.sources;
 const arc={dramaticQuestion:'Can Juno relight the archive before midnight?',stakes:'The archive goes dark.',clock:'Midnight',payoff:'Knowing the cycle relights it.',beats:[{activity:'question-0',learning:'evaporation',openLoop:'But the next seal is still dark — what is hiding behind it?'}]};
 const out=await readWonder('resp_story',job,'key',async()=>Response.json({id:'resp_story',model:MODEL,status:'completed',output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify({...game,storyArc:arc})}]}]}));
 assert.equal(out.status,'review');assert.equal(out.content.storyArc,undefined);validatePlayableContent(out.content);
 assert.equal(out.storyCheck.arc.dramaticQuestion,arc.dramaticQuestion);assert.ok(out.storyCheck.score>=12);
 // A guided retry sends the first draft back with the exact fixes, and nothing else changes.
 const retry=generationRequest({...job,storyRetry:{previous:out.content,score:7,fixes:[{label:'Open loops',why:'0 of 7',fix:'End each beat on an open loop.'}]}});
 assert.equal(retry.input.length,4);assert.equal(retry.input[2].role,'assistant');assert.match(retry.input[3].content,/Open loops \(now: 0 of 7\): End each beat/);
 assert.ok(!retry.input[2].content.includes('"sources"'),'citation text is never sent back');
});

test('cartoons and podcasts carry a dramatic question and clock, are scored, and can be revised once',()=>{
 const evidence=[{id:'fraction-note',title:'Equal parts',locator:'Paragraph 1',excerpt:'One half and two quarters describe the same amount of the same whole.'}];
 const job={id:'story-fixture',kind:'podcast',storyVersion:2,context:{evidence,story:{genre:'action',interest:'Space',audience:'primary'}}};
 const r=creativeRequest(job),story=r.text.format.schema.properties.story;
 assert.ok(story.required.includes('dramaticQuestion')&&story.required.includes('clock'));assert.ok(r.input[0].content.includes(FORMAT_ARCS.podcast));
 const raw={schemaVersion:2,id:job.id,kind:'podcast',title:'The quarter rescue',summary:'Two friends race the dark.',story:{...job.context.story,premise:'Supplies must reach the dome.',dramaticQuestion:'Can Mira and Kit share the fuel before the dome lights die?',want:'Light the dome.',stakes:'The dome goes dark.',clock:'Ten minutes of power.',obstacle:'The tanks look unequal.',turn:'They compare equal wholes.',payoff:'Two quarters replace a half.',learningConnection:'Equal shares.'},segments:['hook','setback','attempt','discovery','choice','payoff'].map((beat,i)=>({id:'segment-'+(i+1),speaker:i%2?'learner':'guide',text:i===0?'Kit, the dome lights die in ten minutes and our fuel tank is jammed!':i===5?'Two quarters fill the half tank, so the dome lights up — we did it together!':'But which tank holds more — are you sure?',sourceRefs:['fraction-note'],scene:'workshop',action:'talk',beat})),question:{prompt:'Why does the swap work?',answer:'Both describe the same amount.',sourceRefs:['fraction-note']}};
 const checked=checkCreativeStory(raw,job);
 assert.equal(checked.content.story.dramaticQuestion,raw.story.dramaticQuestion,'the plan survives validation');
 assert.equal(checked.storyCheck.arc.dramaticQuestion,raw.story.dramaticQuestion);assert.equal(checked.storyCheck.criteria.hook,2);
 const again=creativeRequest({...job,storyRetry:{previous:checked.content,score:6,fixes:[{label:'Rising stakes',why:'no clock',fix:'Add a clock.'}]}});
 assert.equal(again.input.length,4);assert.match(again.input[3].content,/Rising stakes/);
 assert.equal(checkCreativeStory(raw,{...job,kind:'tutor'}).storyCheck,null,'only narrative episodes are scored');
});

test('retry decisions: only once, only with a plan, keep the better draft and never lose the first',()=>{
 const weak={score:6,coreZero:['loops'],criteria:{},fixes:[{criterion:'loops',label:'Open loops',why:'0 of 5',fix:'x'}],arc:{dramaticQuestion:'Q?'}};
 assert.ok(shouldRetryStory({},{},weak));
 assert.ok(!shouldRetryStory({STORY_RETRY:'off'},{},weak),'operators can switch it off');
 assert.ok(!shouldRetryStory({},{storyRetry:{state:'done'}},weak),'never twice');
 assert.ok(!shouldRetryStory({},{},{...weak,arc:null}),'old-shaped responses are annotated, not re-requested');
 const r=retryState({},weak,{title:'first'});
 assert.deepEqual(chooseAfterRetry(r,null,null).content,{title:'first'});
 assert.deepEqual(chooseAfterRetry(r,{title:'second'},{...weak,score:5,fixes:[]}).content,{title:'first'});
 const better=chooseAfterRetry(r,{title:'second'},{...weak,score:12,coreZero:[],fixes:[]});
 assert.deepEqual(better.content,{title:'second'});assert.match(better.storyCheck.retry,/6\/16 → 12\/16/);
 assert.equal(storyCheckSummary(weak).arc,undefined,'the job record keeps the summary, not the plan');
});

test('the review line is scored from the current draft and reports what the server already did',()=>{
 const n=storyQualityNotice(grippingQuiz(),{story:{audience:'secondary'},check:{retry:'Revised once to fix the story: 6/16 → 13/16.',repairs:['removed disclaimer wording from player text']}});
 assert.match(n.text,/^Story quality: (strong|good) \(\d+\/16\)\./);assert.match(n.text,/Revised once/);assert.match(n.text,/Fixed automatically: removed disclaimer/);assert.equal(n.warn,false);
 const flat=pack('riverlight-water-quiz');flat.hook='Welcome to the quiz.';flat.questions.forEach(x=>{x.options[x.solution].feedback='Correct.'});
 assert.equal(storyQualityNotice(flat,{}).warn,true);assert.equal(storyQualityNotice(null,{}),null);
});

// ---- The guided retry inside the real job flow, with an in-memory database ----------------------
class D1{constructor(){this.db=new DatabaseSync(':memory:');for(const f of readdirSync(new URL('../drizzle/',import.meta.url)).filter(x=>x.endsWith('.sql')))this.db.exec(readFileSync(new URL('../drizzle/'+f,import.meta.url),'utf8'))}
 prepare(sql){const db=this.db;return {bind(...v){return {async first(){return db.prepare(sql).get(...v)||null},async all(){return {results:db.prepare(sql).all(...v)}},async run(){return {meta:{changes:Number(db.prepare(sql).run(...v).changes)}}}}}}}}
const notes='Warmth from the sun causes liquid water to evaporate into water vapour. Cooling turns vapour into droplets through condensation. Droplets fall as precipitation.\n\nA town has twelve stored water units. Gardens need four units and homes need eight units, so the reservoir must split the supply fairly between both branches.';
const flatChapter=job=>{const c=structuredClone(chapter);c.id=job.chapterId;c.topicId=job.topicId;c.revision=1;c.sources=structuredClone(job.evidence);for(const q of Object.values(c.challenges))q.sourceRefs=[job.evidence[0].id];return c};
function grippingChapter(job){
 const c=flatChapter(job);
 c.hook='The waterworks alarm wails: Nessa has until sunset to restart the pumps, or the gardens and homes go dry. Can she and you bring the water back in time?';
 c.challenges.route.explanation+=' But the pressure gauge is still falling — something else is wrong downstream.';
 c.challenges.balance.explanation+=' Then the lamps flicker: the old Heart pump won’t start.';
 c.challenges.transfer.explanation='Because warmth makes water evaporate and cooling makes vapour condense into droplets, Nessa’s plan works: the pumps roar, the gardens and homes are saved and the water is back by sunset.';
 return c;
}
const arcFor=keys=>({dramaticQuestion:'Can Nessa bring the water back before sunset?',stakes:'Gardens and homes go dry.',clock:'Sunset',payoff:'The cycle restarts the pumps.',beats:keys.map(k=>({activity:k,learning:'the water cycle',openLoop:'But the pressure gauge is still falling — something else is wrong downstream.'}))});
function harness(second){
 const env={DB:new D1(),META_API_KEY:'test-secret'},calls=[];
 const provider=async job=>{calls.push(job);
  if(job.storyRetry)return second(job);
  const c=flatChapter(job);return {status:'review',providerId:'resp_first',...checkStory(c,job,validateStoryArc(arcFor([])))}};
 const call=async(path,data)=>{const req=new Request('https://game.test/api/workshop/'+path,{method:data?'POST':'GET',headers:{'oai-authenticated-user-id':'alice',...(data?{Origin:'https://game.test','Content-Type':'application/json','X-Lanternbound-Workshop':'1'}:{})},...(data?{body:JSON.stringify(data)}:{})});const response=await workshopAPI(req,env,{provider,owner:'alice'});return {status:response.status,...await response.json()}};
 return {env,call,calls};
}
async function runJob(h){
 const a=await h.call('resources',{title:'Water learning notes',text:notes,filename:'water.md'}),r=(await h.call('resources/'+a.resource.id+'/review',{checksum:a.resource.checksum,confirmed:true})).resource;
 const j=(await h.call('jobs',{topicId:chapter.topicId,goal:'Explain water changes and allocate the town supply',level:'New to water systems',resourceIds:[r.id],requestKey:'story-one'})).job;
 return (await h.call('jobs/'+j.id+'/run',{})).job;
}
const receipts=h=>h.env.DB.db.prepare('SELECT id FROM cost_receipts ORDER BY id').all().map(x=>x.id);

test('job flow: a weak story is revised once and the better draft goes to review with both scores',async()=>{
 const h=harness(job=>{const c=grippingChapter(job);return {status:'review',providerId:'resp_second',...checkStory(c,job,validateStoryArc(arcFor(['route','balance','transfer'])))}});
 const job=await runJob(h);
 assert.equal(h.calls.length,2,'exactly one revision request');
 assert.equal(h.calls[1].storyRetry.fixes.some(f=>f.criterion==='loops'),true,'the revision is told exactly what to fix');
 assert.equal(job.status,'review');assert.match(job.draft.hook,/until sunset/);
 assert.match(job.storyCheck.retry,/Revised once/);assert.ok(job.storyCheck.score>=10);
 assert.equal(receipts(h).filter(id=>id.endsWith(':story-retry')).length,1,'the revision has its own cost receipt');
});

test('job flow: a revision that scores lower, fails or has no budget falls back to the first draft with a visible note',async()=>{
 const worse=harness(job=>{const c=flatChapter(job);c.hook='Welcome to the waterworks lesson.';return {status:'review',providerId:'resp_second',...checkStory(c,job,null)}});
 const a=await runJob(worse);assert.equal(worse.calls.length,2);assert.equal(a.status,'review');assert.match(a.storyCheck.retry,/first draft .* is kept/);assert.notEqual(a.draft.hook,'Welcome to the waterworks lesson.');
 const broken=harness(()=>{const e=Error('The model returned invalid chapter JSON.');e.status=422;throw e});
 const b=await runJob(broken);assert.equal(b.status,'review');assert.match(b.storyCheck.retry,/first draft/);assert.ok(b.draft.challenges.route);
 const pending=harness(()=>({status:'running',providerId:'resp_second'}));
 const c=await runJob(pending);assert.equal(c.status,'running','the revision runs in the background like any job');
 // Room in the daily budget for the first request only: the revision is never sent.
 const budget=harness(()=>assert.fail('no request without budget'));Object.assign(budget.env,{PILOT_ENABLED:'true',PILOT_DAILY_BUDGET_USD:'0.3'});
 const d=await runJob(budget);assert.equal(budget.calls.length,1);assert.equal(d.status,'review');assert.match(d.storyCheck.retry,/budget had no room/);assert.ok(d.draft.challenges.route);
});

test('creative job flow: a weak podcast story is revised once through the real API and the first draft is kept if the revision fails',async()=>{
 const {Bucket}=await import('./helpers/media-storage.mjs');const {creativeAPI}=await import('../server/creative-api.js');
 const {validateCreative}=await import('../src/studio/creative-content.js');const {newUnit,activitiesOf}=await import('../src/studio/programme.js');const {draftHash}=await import('../src/game-modes/draft-engine.js');
 const quiz=EXTENDED_PACKS.find(p=>p.template==='quiz-v1'),unit=newUnit(quiz,{},activitiesOf(quiz).map(a=>a.key)),identity={packId:quiz.id,contentHash:draftHash(quiz)};
 const episode=(j,lines)=>({schemaVersion:2,id:j.id,kind:'podcast',title:'The quarter rescue',summary:'Two friends race the dark.',story:{genre:j.context.story.genre,interest:j.context.story.interest,premise:'Supplies must reach the dome.',dramaticQuestion:'Can Mira and Kit restart the archive before the lamps die?',want:'Relight the archive.',stakes:'The archive goes dark.',clock:'Ten minutes.',obstacle:'The notes are muddled.',turn:'They follow the evidence.',payoff:'The idea relights it.',learningConnection:'The source idea.'},segments:lines.map((text,i)=>({id:'segment-'+(i+1),speaker:i%2?'learner':'guide',text,sourceRefs:[j.context.evidence[0].id],scene:i<3?'workshop':'garden',action:'talk',beat:['hook','setback','attempt','discovery','choice','payoff'][i]})),question:{prompt:'Why does it work? Explain.',answer:'Because of the source idea.',sourceRefs:[j.context.evidence[0].id]}});
 const flat=['Welcome to today’s episode about water.','Water is important.','It changes state.','That is the idea.','We learned it.','The end.'];
 const gripping=['Kit, the archive lamps die in ten minutes and the water notes are scrambled!','Then we fix them now — but which step comes first?','My plan flopped: the vapour went the wrong way. What are we missing?','Wait — warmth makes it evaporate, so the arrow points up!','But the last lamp is still dark… what cools the vapour?','Cooling condenses it, so the lamps relight and the archive is saved — we did it together!'];
 for(const second of ['better','broken']){
  const calls=[],env={DB:new D1(),BUCKET:new Bucket(),META_API_KEY:'fixture-only',WORKSHOP_GENERATION_LIMIT:'50'};
  let saved={schemaVersion:1,active:unit.id,units:[unit]},version=1;
  const store={list:async()=>[],latest:async(t,o,slot)=>slot==='studio'?({version,payload:JSON.stringify({studio:saved})}):null,write:async(t,o,slot,expected,value)=>{saved=value.studio;return {version:++version}}};
  const provider=async j=>{calls.push(j);if(j.storyRetry){if(second==='broken'){const e=Error('Muse returned unreadable content.');e.status=422;throw e}return {status:'review',providerId:'resp_two',...checkCreativeStory(validateCreative(episode(j,gripping),j),j)}}return {status:'review',providerId:'resp_one',...checkCreativeStory(validateCreative(episode(j,flat),j),j)}};
  const call=async body=>{const req=new Request('https://game.test/api/learning/creative',{method:'POST',headers:{'oai-authenticated-user-id':'site-owner',Origin:'https://game.test','Content-Type':'application/json'},body:JSON.stringify({...identity,...body})});const r=await creativeAPI(req,env,{store,siteOwner:'site-owner',owner:'learner-a',resolve:async()=>quiz,provider,speech:async()=>({bytes:new Uint8Array([1]),contentType:'audio/mpeg'})});return {status:r.status,...await r.json()}};
  const created=await call({action:'create',requestKey:'story-'+second,kind:'podcast',activityKey:unit.activityKeys[0],story:{genre:'comedy'}});assert.equal(created.status,200,created.error);
  const run=await call({action:'run',id:created.jobId}),job=run.jobs.find(j=>j.id===created.jobId);
  assert.equal(calls.length,2,`${second}: ${job.status} ${job.error||''}`);assert.equal(job.status,'review',second);
  if(second==='better'){assert.match(job.draft.segments[0].text,/ten minutes/);assert.match(job.storyCheck.retry,/Revised once/)}
  else{assert.equal(job.draft.segments[0].text,flat[0]);assert.match(job.storyCheck.retry,/first draft/)}
 }
});

test('a spoken script that trails off on "but—" every line is marked down, not rewarded',()=>{
 const seg=(text,i)=>({id:'segment-'+(i+1),speaker:i%2?'learner':'guide',text,sourceRefs:['a']});
 const tic={kind:'podcast',schemaVersion:2,title:'Cup final',summary:'A race to the whistle.',segments:['Whistle in ten minutes and our board flipped, but—','Two minutes gone, but—','Worse, the Sprouts are covered, but—','Eight minutes left, but—','The gate clicked open, but—','We won because energy flows from food to eater!'].map(seg),question:{prompt:'Why?'}};
 const r=scoreStory(tic,{});assert.equal(r.criteria.loops,1);assert.match(r.reasons.loops,/trail off/);
 const varied={...tic,segments:['Whistle in ten minutes and our tactic board just flipped!','Then which way do the arrows go — at the food or the eater?','Training says the eater. Our first plan sank us.','Wait, a bear card? It eats plants and rabbits — where does it fit?','Between both lanes, so the press holds.','We won because energy flows from food to eater!'].map(seg)};
 assert.equal(scoreStory(varied,{}).criteria.loops,2);
});

test('a countdown that tightens through the second half counts as rising stakes',()=>{
 const {draft,story}=fixture('staging-sports-primary.json'),c=structuredClone(draft);
 c.hook='Pippa has twelve minutes to win the Riverlight Cup.';
 c.questions.forEach((q,i)=>{q.prompt=`${12-2*i} minutes left! ${q.prompt}`});c.questions.at(-1).prompt='Last possession, one minute left! '+c.questions.at(-1).prompt;
 assert.equal(scoreStory(c,{story}).criteria.stakes,2);
});
