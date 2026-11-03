import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {validateCreative,creativeSchema} from '../src/studio/creative-content.js';
import {validatePerformance,validatePerformances,propStates} from '../src/cartoon-performance.js';
import {stageAtTime} from '../src/studio/media/cartoon-director.js';
import {stagePropStates} from '../src/studio/media/prop-staging.js';
import {propAtTime} from '../src/studio/media/cartoon-props.js';
import {mouthAtTime,validateMouthCues,pcmForScene,analyseEpisodeSpeech} from '../src/studio/media/lip-sync.js';
const read=name=>JSON.parse(fs.readFileSync(new URL('../public/cartoon-art/stories/performance-'+name+'/script.json',import.meta.url)));
const job=s=>({id:s.id,kind:'cartoon',storyVersion:3,context:{evidence:s.sources,story:{genre:s.story.genre,interest:s.story.interest}}});
test('real Muse performances bind learner interest, inventory, reviewed source and strict schema',()=>{
 for(const name of ['action','comedy']){const s=read(name);assert.deepEqual(validateCreative(s,job(s)),s);const schema=creativeSchema(job(s));assert.equal(schema.properties.segments.items.properties.performance.additionalProperties,false);for(const mutate of [x=>x.story.interest='unknown',x=>x.segments[0].performance.x=4,x=>x.segments[0].performance.move='eval',x=>x.story.prop='https://evil',x=>x.segments[0].sourceRefs=['invented']]){const bad=structuredClone(s);mutate(bad);assert.throws(()=>validateCreative(bad,job(s)));}}
});
test('prop ownership rejects teleportation, duplicate pick-up, wrong actor use and unsupported contacts',()=>{
 const s=read('action'),states=propStates(s.segments,s.story.prop);assert.equal(states[0].after.owner,'learner');assert.equal(states[3].after.owner,'guide');assert.equal(states[6].after.owner,'learner');
 for(const change of [x=>x.segments[0].performance.interaction='pass',x=>x.segments[1].performance.interaction='pick-up',x=>x.segments[4].performance.actor='learner',x=>x.segments[0].direction.blocking='pursuit',x=>x.segments[0].performance.move='run',x=>x.segments[0].performance.interaction='kick',x=>x.segments[0].performance.interaction='none']){const bad=structuredClone(s);change(bad);assert.throws(()=>validatePerformances(bad.segments,bad.story.prop));}
 assert.throws(()=>validatePerformance(null));assert.throws(()=>validatePerformance({actor:'guide',move:'jump',interaction:'none',url:'/x'}));
});
test('staged contacts survive seeking; kick starts beside the foot and ends on the ground',()=>{
 const script=read('comedy'),states=stagePropStates(script),i=9,segment=script.segments[i],state=states[i];assert.equal(state.before.owner,'floor');
 const stage=stageAtTime({segment,index:i,elapsed:5,duration:10,propState:state}),actor=stage.actors.find(a=>a.speaker===segment.performance.actor);assert(Math.abs(actor.x-state.before.ground.x)<=33);
 const a=propAtTime({prop:script.story.prop,state,performance:{...segment.performance,progress:.25},actors:stage.actors}),b=propAtTime({prop:script.story.prop,state,performance:{...segment.performance,progress:.95},actors:stage.actors});assert.equal(a.x,state.before.ground.x);assert(Math.abs(b.x-state.after.ground.x)<1e-8);assert(Math.abs(b.y-500)<1e-8);assert.notEqual(a.x,b.x);
 assert.deepEqual(stagePropStates(script),states);assert.equal(stageAtTime({segment:script.segments[2],elapsed:2,duration:10}).actors.find(a=>a.speaker==='learner').motion,'run');
 assert(!stageAtTime({segment:script.segments.at(-1),elapsed:5,duration:10,still:true}).actors.some(a=>['run','jump','reach','kick'].includes(a.motion)));
});
test('visemes follow intervals and are closed for silence, listeners and reduced motion',()=>{
 const cues=validateMouthCues({mouthCues:[{start:0,end:.2,value:'A'},{start:.2,end:.4,value:'D'},{start:.5,end:.7,value:'F'}]},1);
 assert.equal(mouthAtTime(cues,.3),'D');assert.equal(mouthAtTime(cues,.45),'X');assert.equal(mouthAtTime(cues,1),'X');assert.equal(mouthAtTime(cues,.3,{active:false}),'X');assert.equal(mouthAtTime(cues,.3,{still:true}),'X');assert.equal(mouthAtTime(cues,.3),mouthAtTime(cues,.3));
 for(const c of [[{start:0,end:2,value:'A'}],[{start:.2,end:.1,value:'B'}],[{start:0,end:.6,value:'C'},{start:.5,end:.7,value:'D'}],[{start:0,end:.3,value:'bad'}]])assert.throws(()=>validateMouthCues({mouthCues:c},1));
});
test('scene PCM contains only that recording, not its neighbour or inter-scene silence',()=>{
 const track={buffer:{sampleRate:16000,getChannelData:()=>new Float32Array([...Array(160).fill(.5),...Array(80).fill(0),...Array(160).fill(-.5)])},offsets:[0,.015],durations:[.01,.01]};assert.equal(pcmForScene(track,0).length,160);assert(pcmForScene(track,0).every(x=>x===16384));assert(pcmForScene(track,1).every(x=>x===-16384));
});
test('speech worker terminates on cancellation, malformed cues and stalled work',async()=>{
 const track={buffer:{sampleRate:16000,getChannelData:()=>new Float32Array(160)},offsets:[0],durations:[.01]},segments=[{text:'Hi'}];let stopped=0;
 class Worker{postMessage(m){if(m.type==='init')queueMicrotask(()=>this.onmessage({data:{type:'ready'}}));}terminate(){stopped++;}}
 const c=new AbortController(),p=analyseEpisodeSpeech(track,segments,{WorkerClass:Worker,signal:c.signal});c.abort();await assert.rejects(p,{name:'AbortError'});assert.equal(stopped,1);
 await assert.rejects(analyseEpisodeSpeech(track,segments,{WorkerClass:Worker,timeoutMs:5}),/too long/);assert.equal(stopped,2);
 class Bad extends Worker{postMessage(m){queueMicrotask(()=>this.onmessage({data:m.type==='init'?{type:'ready'}:{type:'result',id:m.id,result:{mouthCues:[{start:0,end:9,value:'Z'}]}}}));}}
 await assert.rejects(analyseEpisodeSpeech(track,segments,{WorkerClass:Bad}),/Invalid/);assert.equal(stopped,3);
});

test('a jump selected during travel is performed after arrival, not silently dropped',()=>{for(const duration of [5,10,20]){const segment={speaker:'guide',action:'talk',direction:{blocking:'pursuit',shot:'wide',pace:'urgent'},performance:{actor:'guide',move:'jump',interaction:'none'}};const stage=stageAtTime({segment,elapsed:duration*.8,duration});assert.equal(stage.actors[0].motion,'jump');assert.equal(stage.actors[0].moving,false);}});

test('Field Notes contact follows its animated hand and kick rotates a leg',async()=>{
 const {drawCharacter}=await import('../src/studio/media/cartoon-assets.js'),calls=[],ctx=new Proxy({},{set:()=>true,get:(_,name)=>(...args)=>calls.push([name,...args])});
 const idle=drawCharacter(ctx,{speaker:'guide',x:0,y:0,motion:'idle',time:1}),jump=drawCharacter(ctx,{speaker:'guide',x:0,y:0,motion:'jump',time:1});assert(Math.abs(idle.hand.y-jump.hand.y-40)<.001);
 calls.length=0;drawCharacter(ctx,{speaker:'guide',x:0,y:0,motion:'kick',time:1});assert(calls.some(([name,angle])=>name==='rotate'&&angle< -1));
 const reach=drawCharacter(ctx,{speaker:'guide',x:0,y:0,motion:'reach',time:1});assert.notEqual(reach.hand.x,idle.hand.x);assert.notEqual(reach.hand.y,idle.hand.y);
});

test('ground interactions retain visible contacts and keep the bystander out of the action',()=>{const s=read('comedy'),state=stagePropStates(s)[9],stage=stageAtTime({segment:s.segments[9],duration:10,elapsed:4.21,propState:state,contactOffset:118}),actor=stage.actors.find(a=>a.speaker==='learner');assert.equal(stage.shot,'wide');assert.equal(actor.x,state.before.ground.x+118);assert(Math.abs(stage.actors[0].x-stage.actors[1].x)>=250);});

test('reviewed anime resting mouths are not painted twice and hidden lips stay hidden',async()=>{
 const {drawSpriteMouth}=await import('../src/studio/media/cartoon-mouth.js'),m=JSON.parse(fs.readFileSync(new URL('../public/cartoon-art/manifest.json',import.meta.url))),clip=m.styles.anime.cast.learner.idle,calls=[];
 const ctx=new Proxy({},{set:()=>true,get:(_,k)=>(...a)=>{calls.push([k,...a]);if(k==='createRadialGradient')return {addColorStop(){}};}});
 for(let n=0;n<clip.frames;n++){drawSpriteMouth(ctx,clip,n,301,480,'X','anime');assert.equal(calls.length,0);}
 drawSpriteMouth(ctx,clip,0,301,480,'D','anime');assert(calls.some(([k])=>k==='fill'));assert(calls.some(([k,x,y])=>k==='scale'&&x===1&&y===.65));
 calls.length=0;drawSpriteMouth(ctx,m.styles.anime.cast.learner.think,10,301,480,'D','anime');assert.equal(calls.length,0);
});

test('anime listeners use a resting pose while speaker visemes remain isolated',async()=>{
 const {drawLibraryScene,validateCartoonLibrary}=await import('../src/studio/media/cartoon-library.js'),manifest=JSON.parse(fs.readFileSync(new URL('../public/cartoon-art/manifest.json',import.meta.url)));
 for(const speaker of ['guide','learner']){const pack=validateCartoonLibrary(manifest,'anime'),draws=[],ctx=new Proxy({},{set:()=>true,get:(_,k)=>(...a)=>{if(k==='drawImage')draws.push(a[0]);if(k==='createRadialGradient')return {addColorStop(){}};}});pack.images=new Map([...Object.values(pack.backgrounds),...Object.values(pack.cast).flatMap(Object.values)].map(a=>[a.url,a.url]));drawLibraryScene(ctx,pack,{segment:{scene:'city',speaker,action:'talk',direction:{blocking:'face-off',shot:'wide',pace:'calm'}},elapsed:7.7,duration:10,mouth:'D'});const listener=speaker==='guide'?'learner':'guide';assert(draws.includes(pack.cast[listener].idle.url));assert(!draws.includes(pack.cast[listener].react.url));assert(draws.includes(pack.cast[speaker].talk.url));}
});

test('facial correction metadata is bounded and typed',async()=>{const {validateCartoonLibrary}=await import('../src/studio/media/cartoon-library.js');const m=JSON.parse(fs.readFileSync(new URL('../public/cartoon-art/manifest.json',import.meta.url)));for(const bad of [{heightScale:Infinity},{heightScale:3},{restBaked:'yes'},{softEdge:42}]){const changed=structuredClone(m);Object.assign(changed.styles.anime.cast.learner.idle.anchors[0].mouth,bad);assert.throws(()=>validateCartoonLibrary(changed,'anime'));}});
