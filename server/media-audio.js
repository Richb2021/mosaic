// Fish owns speech synthesis only. Callers must resolve reviewed canonical text,
// check ownership and reserve their budget BEFORE entering this adapter.
export const SPEECH_MODEL='s2.1-pro';
export const MAX_SPEECH_BYTES=3600;
export const MAX_AUDIO_BYTES=4*1024*1024;
export class SpeechError extends Error{constructor(message,status=502){super(message);this.status=status;}}
const need=(condition,message,status=400)=>{if(!condition)throw new SpeechError(message,status);};
export function speechConfiguration(env){
 const guide=env.FISH_AUDIO_GUIDE_VOICE,learner=env.FISH_AUDIO_LEARNER_VOICE;
 return !!env.FISH_AUDIO_API_KEY&&typeof guide==='string'&&/^[a-f0-9]{32}$/.test(guide)&&typeof learner==='string'&&/^[a-f0-9]{32}$/.test(learner)&&guide!==learner;
}
export async function synthesizeSpeech({text,speaker},env,fetcher=fetch){
 need(typeof text==='string'&&text.trim().length>0&&text.length<=900&&new TextEncoder().encode(text).length<=MAX_SPEECH_BYTES,'Keep each spoken passage within 900 characters.');
 need(!/[\u0000-\u0008\u000B\u000C\u000E-\u001F]|<\|/.test(text),'This passage contains unsupported speech control characters.');
 need(['guide','learner'].includes(speaker),'Choose one of the two podcast hosts.');
 need(speechConfiguration(env),'Narration is not connected yet. The transcript is available.',503);
 let response;
 try{
  response=await fetcher('https://api.fish.audio/v1/tts',{
   method:'POST',redirect:'manual',signal:AbortSignal.timeout(45000),
   headers:{Authorization:`Bearer ${env.FISH_AUDIO_API_KEY}`,'Content-Type':'application/json',model:SPEECH_MODEL},
   body:JSON.stringify({text,reference_id:speaker==='guide'?env.FISH_AUDIO_GUIDE_VOICE:env.FISH_AUDIO_LEARNER_VOICE,format:'mp3',sample_rate:44100,mp3_bitrate:128,normalize:false,latency:'normal',temperature:0.5,top_p:0.7,prosody:{speed:1,volume:0,normalize_loudness:true}})
  });
 }catch{throw new SpeechError('The speech request did not finish. It may have used provider credit; no automatic retry was sent.');}
 if(!response.ok){
  await response.body?.cancel().catch(()=>{});
  const message=response.status===401||response.status===403?'The narration provider rejected this connection.':response.status===402?'The narration provider’s credit needs attention.':response.status===429?'The narration provider is busy. Try this passage again later.':'The narration provider could not produce this passage.';
  throw new SpeechError(message);
 }
 const type=(response.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
 if(!['audio/mpeg','audio/mp3','application/octet-stream'].includes(type)){await response.body?.cancel().catch(()=>{});throw new SpeechError('The narration provider returned an unexpected format.');}
 need(response.body,'The narration provider returned no audio.',502);
 const reader=response.body.getReader(),chunks=[];let size=0;
 try{
  for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;need(size<=MAX_AUDIO_BYTES,'This narration exceeded the allowed audio size.',502);chunks.push(value);}
 }catch(e){if(e instanceof SpeechError)throw e;throw new SpeechError('The narration transfer was interrupted. No automatic retry was sent.');}
 finally{await reader.cancel().catch(()=>{});}
 need(size>=4,'The narration provider returned an empty recording.',502);
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 // Reject a JSON/HTML error with an audio header. Valid MP3 may begin with ID3
 // metadata or a frame sync word; decoding/playback is checked by the client.
 need(bytes[0]===0x49&&bytes[1]===0x44&&bytes[2]===0x33||bytes[0]===0xff&&(bytes[1]&0xe0)===0xe0,'The narration provider returned an unreadable recording.',502);
 return {bytes,contentType:'audio/mpeg'};
}
