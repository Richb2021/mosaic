import test from 'node:test';
import assert from 'node:assert/strict';
import {adaptiveLearning,loopSignals,questionIdentity} from '../src/studio/adaptive-learning.js';
import {encodeVoice,voiceDuration,tutorSpeechSegments} from '../src/studio/voice-format.js';
import {voiceTutorAPI} from '../server/voice-tutor-api.js';
import {creativeAPI} from '../server/creative-api.js';
import {creativePermissions} from '../server/tutor-access.js';
import {creativeRequest} from '../server/creative-provider.js';
import {D1,Bucket} from './helpers/media-storage.mjs';
import {SharingStore,sharingFixture} from './helpers/course-sharing.mjs';
import {learnerOwner} from '../server/pilot-access.js';
import {EXTENDED_PACKS} from '../src/game-modes/extended-packs.js';
import {newUnit,activitiesOf} from '../src/studio/programme.js';
import {draftHash} from '../src/game-modes/draft-engine.js';
import {learningLoopAPI} from '../server/learning-loop-api.js';
import {LOOP_STAGES} from '../src/studio/learning-loop.js';
import {deletionPlan,startDeletion,dataAPI} from '../server/data-lifecycle.js';

test('support fades only after distinct unassisted evidence; overrides, uncertainty and human review remain explicit',()=>{
 for(const label of ['Energy transfer','Industrialisation','Revenue and costs']){
  const base={activities:[{key:'a',label}],profile:{level:'Starting out'}};
  const run=(signals=[],choice='suggested')=>adaptiveLearning({...base,signals,choice}).focus[0];
  const signal=(id,extra={})=>({id,key:'a',at:Number(id)||1,correct:true,confidence:'confident',fresh:true,assisted:false,...extra});
  assert.equal(run().support,'guided');assert.equal(run([signal('1'),signal('1')]).support,'guided');
  assert.equal(run([signal('1'),signal('2')]).support,'independent');assert.equal(run([signal('1'),signal('2'),signal('3',{transfer:true})]).support,'stretch');
  assert.equal(run([signal('1'),signal('2',{assisted:true}),signal('3')]).support,'guided');
  assert.equal(run([signal('1',{correct:false,feedback:'Compare revenue before and after costs.'})]).pointToRevisit,'Compare revenue before and after costs.');
  const review=run([signal('1',{correct:false,humanReview:true})]);assert.equal(review.support,'review');assert.equal(review.pointToRevisit,null);
  assert.equal(run([], 'less').support,'independent');assert.match(run([], 'less').reason,/preference/);assert.equal(run([signal('1'),signal('2')],'more').support,'guided');
 }
});
test('reissuing the same question in a different bank cannot inflate independent evidence',()=>{
 const a=loopSignals({questions:[{stage:'diagnostic',prompt:'What is profit?',answer:0,feedback:['Yes']}]},{answers:[{stage:'diagnostic',answer:0,at:1,confidence:'confident',assisted:false}]},['a'],'old');
 const b=loopSignals({questions:[{stage:'transfer',prompt:' WHAT  IS PROFIT? ',answer:0,feedback:['Yes']}]},{answers:[{stage:'transfer',answer:0,at:2,confidence:'confident',assisted:false}]},['a'],'new');
 assert.equal(a[0].id,b[0].id);assert.equal(a[0].id,questionIdentity('What is profit?'));
 assert.equal(adaptiveLearning({activities:[{key:'a'}],profile:{},signals:[...a,...b]}).focus[0].independentQuestions,1);
});
test('voice encoding validates exact duration and format before provider work; speech chunks preserve Unicode text',()=>{
 const bytes=encodeVoice(new Float32Array(16000));assert.equal(voiceDuration(bytes),1);
 assert.throws(()=>encodeVoice(new Float32Array(16000*61)));const bad=bytes.slice();bad[24]=0;assert.throws(()=>voiceDuration(bad));
 const reply={message:'🦊'.repeat(600)+' Compare the energy direction. ',question:'What changes?'};
 const chunks=tutorSpeechSegments(reply);assert.equal(chunks.map(s=>s.text).join(''),reply.message+'\n\n'+reply.question);assert(chunks.every(s=>s.text.length<=900&&new TextEncoder().encode(s.text).length<=3600));
});

async function fixture(){
 const env={DB:new D1(),BUCKET:new Bucket(),META_API_KEY:'fixture',FISH_AUDIO_API_KEY:'fixture',FISH_AUDIO_GUIDE_VOICE:'a'.repeat(32),FISH_AUDIO_LEARNER_VOICE:'b'.repeat(32),WORKSHOP_GENERATION_LIMIT:'50'},store=new SharingStore(),pack=EXTENDED_PACKS.find(p=>p.template==='quiz-v1'),owner='voice-learner',siteOwner='voice-site',unit=newUnit(pack,{level:'Starting out',interests:['Football']},[activitiesOf(pack)[0].key]),identity={packId:pack.id,contentHash:draftHash(pack)};
 await store.write('learner_profiles',owner,'studio',0,{studio:{schemaVersion:1,active:unit.id,units:[unit]}},Date.now());
 const ctx={store,owner,siteOwner,resolve:async()=>pack},base64=Buffer.from(encodeVoice(new Float32Array(16000))).toString('base64');
 const call=async(path,body,extra={})=>{const req=new Request('https://test.local/api/learning/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...identity,...body})});return (path==='voice-tutor'?voiceTutorAPI:creativeAPI)(req,env,{...ctx,...extra})};
 return {env,store,pack,unit,identity,ctx,base64,call};
}
test('explicit voice transcription is private, idempotent, costed and removed by learner deletion',async()=>{
 const h=await fixture();let calls=0;const transcribe=async()=>{calls++;return {text:'How does energy move through a food chain?',duration:1}};
 const body={activityKey:h.unit.activityKeys[0],requestKey:'voice-one',base64:h.base64,permitted:true};
 await assert.rejects(h.call('voice-tutor',{...body,permitted:false},{transcribe}),/Confirm permission/);
 let a=await (await h.call('voice-tutor',body,{transcribe})).json(),b=await (await h.call('voice-tutor',body,{transcribe})).json();assert.equal(a.id,b.id);assert.equal(a.status,'review');assert.equal(calls,1);assert.equal(h.env.BUCKET.puts,0);
 const rows=h.env.DB.db.prepare('SELECT payload,draft FROM workshop_jobs').all();assert(!JSON.stringify(rows).includes(h.base64));assert.equal(h.env.DB.db.prepare('SELECT status FROM cost_receipts').get().status,'measured');
 const exported=await (await dataAPI(new Request('https://test.local/api/learning/data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'export',scope:'learner',epoch:'0:0'})}),h.env,h.ctx)).json();assert(JSON.stringify(exported).includes(a.transcript));
 const plan=await deletionPlan(h.env,{...h.ctx,mode:'learner',now:Date.now()});assert(plan.jobs.includes(a.id));await startDeletion(h.env,{...h.ctx,now:()=>Date.now(),removeProvider:async()=>{}},plan);assert.equal(h.env.DB.db.prepare("SELECT COUNT(*) AS n FROM workshop_jobs WHERE status!='usage-only' OR draft IS NOT NULL").get().n,0);
});
test('lost transcription acknowledgement never creates a second charge on retry',async()=>{
 const h=await fixture();let calls=0;const body={activityKey:h.unit.activityKeys[0],requestKey:'voice-lost',base64:h.base64,permitted:true},transcribe=async()=>{calls++;throw new TypeError('lost')};
 assert.equal((await (await h.call('voice-tutor',body,{transcribe})).json()).status,'interrupted');await h.call('voice-tutor',body,{transcribe});assert.equal(calls,1);
 await assert.rejects(h.call('voice-tutor',{...body,base64:'AAAA'},{transcribe}),/recording/);assert.equal(calls,1);
});
test('tutor uses transparent adaptive context; spoken reply is hash bound, cached, unreviewed and learner private',async()=>{
 const h=await fixture();let spoken=0;const c=await (await h.call('creative',{action:'create',requestKey:'tutor-one',kind:'tutor',activityKey:h.unit.activityKeys[0],question:'Help me understand the energy direction.'})).json();
 const d=await (await h.call('creative',{action:'run',id:c.jobId},{provider:async j=>{assert.equal(j.context.adaptation[0].support,'guided');assert.match(creativeRequest(j).input[1].content,/Football/);return {status:'review',content:{status:'hint',message:'Follow the arrow from the producer.',question:'Where does it point?',sourceRefs:[j.context.evidence[0].id]}}}})).json();const j=d.jobs[0];
 const body={id:j.id,draftHash:j.draftHash,index:0,requestKey:'speech-one'},speech=async()=>{spoken++;return {bytes:new Uint8Array([73,68,51,0]),contentType:'audio/mpeg'}};
 await assert.rejects(h.call('creative/tutor-audio',{...body,draftHash:'bad'},{speech}),/changed/);
 const first=await h.call('creative/tutor-audio',body,{speech}),second=await h.call('creative/tutor-audio',{...body,requestKey:'speech-two'},{speech});assert.equal(first.headers.get('X-Mosaic-Audio'),'generated-and-saved');assert.equal(second.headers.get('X-Mosaic-Audio'),'stored');assert.equal(spoken,1);
 await assert.rejects(h.call('creative',{action:'review',id:j.id,draftHash:j.draftHash,confirmed:true}),/cannot be edited or approved/);
 const saved=JSON.parse((await h.store.latest('learner_profiles',h.ctx.owner,'studio')).payload);assert(saved.studio.units[0].support[0].ai);
 const other=newUnit(h.pack,{},h.unit.activityKeys);await h.store.write('learner_profiles','other','studio',0,{studio:{schemaVersion:1,active:other.id,units:[other]}},Date.now());await assert.rejects(h.call('creative/tutor-audio',body,{owner:'other',speech}),/not found/);
});
test('managed learner tutor permission is explicit, organiser scoped, revocable and separate from authoring',async()=>{
 const h=await sharingFixture(),ref=await learnerOwner(h.learner),pack=h.chapters[0].pack;await h.assignCourse();
 assert.equal((await h.call(h.learner,'learning/studio',{type:'create',expectedVersion:0,packId:pack.id,contentHash:draftHash(pack),activityKeys:[activitiesOf(pack)[0].key]})).http,200);
 const body={action:'create',kind:'tutor',requestKey:'managed-test',packId:pack.id,contentHash:draftHash(pack),activityKey:activitiesOf(pack)[0].key,question:'Write my homework for me.'};
 assert.equal((await h.call(h.learner,'learning/creative',body)).http,403);
 assert.equal((await h.call(h.other,'pilot',{action:'tutor-access',accountReference:ref,enabled:true})).http,403);
 assert.equal((await h.call(h.teacher,'pilot',{action:'tutor-access',accountReference:ref,enabled:true})).http,200);
 assert.equal((await h.call(h.learner,'learning/creative',body)).http,200);
 assert.equal((await h.call(h.learner,'learning/creative',{...body,kind:'podcast',requestKey:'forbidden'})).http,403);
 assert.equal((await h.call(h.teacher,'pilot',{action:'tutor-access',accountReference:ref,enabled:false})).http,200);
 assert.equal((await h.call(h.learner,'learning/creative',{...body,requestKey:'again'})).http,403);
 assert.deepEqual(creativePermissions({PILOT_ENABLED:'true'},{canAuthor:true,ageBand:'13to17'}),{canAuthor:false,canTutor:false});
});

test('tutor help attaches to the next first response without permanently marking later fresh questions',async()=>{
 const h=await fixture();let stamp=1800000000000;const now=()=>stamp;
 const created=await (await h.call('creative',{action:'create',requestKey:'practice-support',kind:'practice',activityKey:h.unit.activityKeys[0]},{now})).json();
 const generated=await (await h.call('creative',{action:'run',id:created.jobId},{now,provider:async j=>({status:'review',content:{schemaVersion:1,id:j.id,kind:'practice',title:'New applications',objective:'Use the source relationship.',explanation:j.context.evidence[0].excerpt,sourceRefs:[j.context.evidence[0].id],questions:LOOP_STAGES.map((stage,i)=>({stage,activityKey:j.context.activities[i%j.context.activities.length].key,prompt:'Which application fits situation '+i+'?',options:['Forward in situation '+i,'Reverse','Neither'],answer:0,feedback:['Supported.','Reversed.','Missing.'],hint:'Check the source relationship.',sourceRefs:[j.context.evidence[0].id]}))}})})).json();
 const bank=generated.jobs.find(j=>j.id===created.jobId);await h.call('creative',{action:'review',id:bank.id,draftHash:bank.draftHash,confirmed:true},{now});
 const ids={bankId:bank.id,bankHash:bank.draftHash};
 const loop=async body=>(await learningLoopAPI(new Request('https://test.local/api/learning/loop'+(body?'':'?'+new URLSearchParams(ids)),{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},body:body?JSON.stringify({...ids,...body}):undefined}),h.env,{...h.ctx,now})).json();
 let v=await loop();assert.equal(v.profileChanged,false);stamp+=1000;v=await loop({expectedVersion:v.version,action:{type:'answer',stage:'diagnostic',answer:0,confidence:'confident'}});assert.equal(v.state.answers[0].assisted,false);
 stamp+=1000;await h.call('creative',{action:'create',kind:'tutor',requestKey:'local-help',activityKey:h.unit.activityKeys[0],question:'Write my homework for me.'},{now});
 stamp+=1000;v=await loop({expectedVersion:v.version,action:{type:'answer',stage:'practice',answer:0,confidence:'confident'}});assert.equal(v.state.answers[1].assisted,true);
 stamp+=1000;v=await loop({expectedVersion:v.version,action:{type:'answer',stage:'transfer',answer:0,confidence:'confident'}});assert.equal(v.state.answers[2].assisted,false);assert(v.route.waiting);
});
