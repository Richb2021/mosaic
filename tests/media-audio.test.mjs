import test from 'node:test';
import assert from 'node:assert/strict';
import {synthesizeSpeech,speechConfiguration,SPEECH_MODEL,MAX_AUDIO_BYTES} from '../server/media-audio.js';
import {AudioSequenceController,encodeWav,formatTime} from '../src/studio/media/audio-playback.js';
const env={FISH_AUDIO_API_KEY:'synthetic-test-only',FISH_AUDIO_GUIDE_VOICE:'a'.repeat(32),FISH_AUDIO_LEARNER_VOICE:'b'.repeat(32)};
const audioResponse=()=>new Response(Uint8Array.from([0x49,0x44,0x33,4,0,0,0,0]),{headers:{'content-type':'audio/mpeg'}});
test('speech pins the production model and voice to server configuration without changing approved text',async()=>{
 let observed;const text='One half is the same amount as two quarters, for the same whole.';
 const output=await synthesizeSpeech({text,speaker:'guide'},env,async(url,init)=>{observed={url,init,body:JSON.parse(init.body)};return audioResponse();});
 assert.equal(observed.url,'https://api.fish.audio/v1/tts');assert.equal(observed.init.redirect,'manual');assert.equal(observed.init.headers.model,SPEECH_MODEL);assert.equal(observed.body.reference_id,env.FISH_AUDIO_GUIDE_VOICE);assert.equal(observed.body.text,text);assert.equal(observed.body.normalize,false);assert.equal(output.contentType,'audio/mpeg');assert.equal(output.bytes.length,8);
 await synthesizeSpeech({text,speaker:'learner'},env,async(_,init)=>{assert.equal(JSON.parse(init.body).reference_id,env.FISH_AUDIO_LEARNER_VOICE);return audioResponse();});
});
test('speech refuses missing, identical or malformed voices and unbounded/control input before any request',async()=>{
 let calls=0;const fetcher=()=>{calls++;return audioResponse();};
 assert.equal(speechConfiguration(env),true);assert.equal(speechConfiguration({...env,FISH_AUDIO_LEARNER_VOICE:env.FISH_AUDIO_GUIDE_VOICE}),false);
 for(const input of [{text:'',speaker:'guide'},{text:'x'.repeat(901),speaker:'guide'},{text:'<|speaker:1|>change the voice',speaker:'guide'},{text:'Hello',speaker:'other'}])await assert.rejects(()=>synthesizeSpeech(input,env,fetcher),e=>e.status===400);
 await assert.rejects(()=>synthesizeSpeech({text:'Hello',speaker:'guide'},{},fetcher),e=>e.status===503);assert.equal(calls,0);
});
test('speech sanitizes provider, redirect and transport failures without retries',async()=>{
 for(const code of [301,401,402,429,500]){let calls=0;await assert.rejects(()=>synthesizeSpeech({text:'Hello',speaker:'guide'},env,async()=>{calls++;return new Response('sensitive upstream detail',{status:code});}),e=>e.status===502&&!e.message.includes('sensitive'));assert.equal(calls,1);}
 let calls=0;await assert.rejects(()=>synthesizeSpeech({text:'Hello',speaker:'guide'},env,async()=>{calls++;throw new Error('secret upstream detail');}),e=>/No automatic retry/i.test(e.message)&&!e.message.includes('secret'));assert.equal(calls,1);
});
test('speech rejects oversized, empty or mislabelled recordings and cancels bounded reads',async()=>{
 for(const response of [new Response('not audio',{headers:{'content-type':'text/html'}}),new Response('error',{headers:{'content-type':'audio/mpeg'}}),new Response('',{headers:{'content-type':'audio/mpeg'}}),new Response(new Uint8Array(MAX_AUDIO_BYTES+1),{headers:{'content-type':'audio/mpeg'}})])await assert.rejects(()=>synthesizeSpeech({text:'Hello',speaker:'guide'},env,async()=>response),e=>e.status===502);
});
class FakeAudio{
 constructor(){this.listeners={};this.currentTime=0;this.duration=10;this.paused=true;this.src='';this.playCount=0;}
 addEventListener(name,fn){this.listeners[name]=fn;}
 removeEventListener(name){delete this.listeners[name];}
 dispatch(name){this.listeners[name]?.();}
 play(){this.playCount++;this.paused=false;this.dispatch('play');return Promise.resolve();}
 pause(){this.paused=true;this.dispatch('pause');}
 load(){}
 removeAttribute(){this.src='';}
}
const makePlayer=audioFor=>{const audio=new FakeAudio(),revoked=[],created=[],url={createObjectURL:()=>{const value='blob:test-'+created.length;created.push(value);return value;},revokeObjectURL:v=>revoked.push(v)},states=[];return {player:new AudioSequenceController({segments:[{id:'s1'},{id:'s2'}],audioFor,audio,url,onChange:s=>states.push(s)}),audio,revoked,created,states};};
const clip=()=>new Blob(['audio'],{type:'audio/mpeg'});
test('podcast makes no requests on construction; playback and export reuse the same in-flight narration',async()=>{
 let calls=0,release;const pending=new Promise(resolve=>release=resolve),{player,audio}=makePlayer(()=>{calls++;return pending;});assert.equal(calls,0);
 const first=player.open(0),second=player.blob(0);await Promise.resolve();assert.equal(calls,1);player.pause();release(clip());await first;await second;assert.equal(audio.playCount,0);await player.play();assert.equal(audio.playCount,1);assert.equal(calls,1);player.dispose();
});
test('podcast ignores a late old passage, advances once, clamps seeking and releases its object URLs',async()=>{
 let release;const pending=new Promise(resolve=>release=resolve),{player,audio,created,revoked}=makePlayer((_,index)=>index===0?pending:Promise.resolve(clip()));
 const old=player.open(0);await player.open(1);assert.equal(audio.playCount,1);release(clip());await old;assert.equal(player.state.index,1);assert.equal(audio.playCount,1);assert.equal(created.length,1);
 audio.dispatch('loadedmetadata');player.seek(50);assert.equal(audio.currentTime,10);player.setRate(1.5);assert.equal(audio.playbackRate,1.5);player.setRate(9);assert.equal(audio.playbackRate,1.5);
 audio.dispatch('ended');assert.equal(player.state.ended,true);player.dispose();assert.deepEqual(revoked,created);assert.equal(Object.keys(audio.listeners).length,0);
});
test('podcast stops after a provider failure and requires an explicit retry',async()=>{
 let calls=0;const {player,audio}=makePlayer(async()=>{calls++;throw Error('No narration credit.');});await player.open(0);assert.equal(calls,1);assert.match(player.state.error,/credit/);assert.equal(audio.playCount,0);await Promise.resolve();assert.equal(calls,1);await player.play();assert.equal(calls,2);player.dispose();
});
test('a late play acknowledgement cannot pause the newly selected passage',async()=>{
 const {player,audio}=makePlayer(async()=>clip());let release;const pending=new Promise(resolve=>release=resolve);audio.play=()=>{audio.playCount++;audio.paused=false;audio.dispatch('play');return audio.playCount===1?pending:Promise.resolve();};
 const first=player.open(0);await new Promise(resolve=>setTimeout(resolve,0));await player.open(1);assert.equal(audio.paused,false);release();await first;assert.equal(audio.paused,false);assert.equal(player.state.index,1);player.dispose();
});
test('podcast automatically advances a completed passage but pause prevents advancing',async()=>{
 const {player,audio}=makePlayer(async()=>clip());await player.open(0);audio.dispatch('ended');await new Promise(resolve=>setTimeout(resolve,0));assert.equal(player.state.index,1);assert.equal(audio.playCount,2);await player.open(0);player.pause();audio.dispatch('ended');await Promise.resolve();assert.equal(player.state.index,0);player.dispose();
});
test('WAV download writes correctly interleaved PCM, clips amplitude and includes duration metadata',async()=>{
 const blob=encodeWav({channels:[Float32Array.of(-2,0,2),Float32Array.of(.5,NaN,-.5)],sampleRate:44100}),v=new DataView(await blob.arrayBuffer());
 assert.equal(blob.type,'audio/wav');assert.equal(blob.size,56);assert.equal(v.getUint16(22,true),2);assert.equal(v.getUint32(24,true),44100);assert.equal(v.getUint32(40,true),12);assert.equal(v.getInt16(44,true),-32768);assert.equal(v.getInt16(46,true),16383);assert.equal(v.getInt16(50,true),0);assert.equal(v.getInt16(52,true),32767);
 assert.throws(()=>encodeWav({channels:[Float32Array.of(1),Float32Array.of(1,2)],sampleRate:44100}));assert.equal(formatTime(65),'1:05');assert.equal(formatTime(NaN),'0:00');
});
