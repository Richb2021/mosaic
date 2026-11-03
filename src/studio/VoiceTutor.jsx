import React,{useEffect,useRef,useState} from 'react';
import {encodeVoice,VOICE_RATE,tutorSpeechSegments} from './voice-format.js';
import './voice-tutor.css';

export function VoiceQuestion({client,identity,activityKey,onTranscript,disabled,savedTranscripts=[],onRefresh}){
 const [recording,setRecording]=useState(false),[seconds,setSeconds]=useState(0),[clip,setClip]=useState(null),[permission,setPermission]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const live=useRef(true),recorder=useRef(null),stream=useRef(null),timer=useRef(null),generation=useRef(0),lock=useRef(false);
 const stop=()=>{if(recorder.current?.state==='recording')recorder.current.stop();stream.current?.getTracks().forEach(t=>t.stop());clearInterval(timer.current);};
 useEffect(()=>{live.current=true;return()=>{live.current=false;generation.current++;stop()}},[]);
 useEffect(()=>{generation.current++;stop();setRecording(false);setClip(null);setPermission(false);setMessage('')},[activityKey]);
 async function prepare(blob){
  const ticket=++generation.current;setBusy(true);setError('');setMessage('Preparing your recording on this device…');let context;
  try{
   if(blob.size>20*1024*1024)throw Error('Choose an audio file smaller than 20 MB and no longer than 60 seconds.');
   context=new AudioContext();const audio=await context.decodeAudioData(await blob.arrayBuffer());
   if(!audio.duration||audio.duration>60)throw Error('Choose a recording of 60 seconds or less.');
   const offline=new OfflineAudioContext(1,Math.ceil(audio.duration*VOICE_RATE),VOICE_RATE),source=offline.createBufferSource();source.buffer=audio;source.connect(offline.destination);source.start();const rendered=await offline.startRendering(),bytes=encodeVoice(rendered.getChannelData(0));
   let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
   if(live.current&&ticket===generation.current){setClip({base64:btoa(binary),key:crypto.randomUUID(),seconds:audio.duration});setPermission(false);setMessage('Recording ready. Nothing has been sent.');}
  }catch(e){if(live.current&&ticket===generation.current){setClip(null);setError(e.message)}}finally{await context?.close();if(live.current&&ticket===generation.current)setBusy(false)}
 }
 async function record(){
  if(lock.current)return;lock.current=true;setError('');const ticket=++generation.current;
  try{
   if(!navigator.mediaDevices?.getUserMedia||!globalThis.MediaRecorder)throw Error('Microphone recording is unavailable here. Choose an audio file or type your question.');
   const mic=await navigator.mediaDevices.getUserMedia({audio:true});if(!live.current||ticket!==generation.current){mic.getTracks().forEach(t=>t.stop());return}stream.current=mic;
   const mime=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(m=>MediaRecorder.isTypeSupported(m)),r=new MediaRecorder(mic,mime?{mimeType:mime}:undefined),chunks=[];recorder.current=r;
   r.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
   r.onerror=()=>{stop();if(live.current){setRecording(false);setError('Recording stopped unexpectedly. Please type or choose a recording.')}};
   r.onstop=()=>{mic.getTracks().forEach(t=>t.stop());clearInterval(timer.current);if(live.current&&ticket===generation.current){setRecording(false);void prepare(new Blob(chunks,{type:r.mimeType}))}};
   setClip(null);setSeconds(0);setRecording(true);setMessage('Recording on this device. Stops at 60 seconds.');r.start();const start=Date.now();timer.current=setInterval(()=>{const n=Math.floor((Date.now()-start)/1000);setSeconds(n);if(n>=59)stop()},250);
  }catch(e){if(live.current)setError(e.name==='NotAllowedError'?'Microphone access was not allowed. You can choose an audio file or type your question.':e.message)}finally{lock.current=false}
 }
 async function transcribe(){
  if(lock.current||!clip)return;lock.current=true;setBusy(true);setError('');const ticket=generation.current;
  try{const d=await client.journal.request('voice-tutor',{...identity,activityKey,requestKey:clip.key,base64:clip.base64,permitted:permission});if(!live.current||ticket!==generation.current)return;
   if(d.status==='review'){onTranscript(d.transcript);setMessage('Transcript added above. Check and edit it, then choose Ask Muse Wonder.');setClip(null);void onRefresh?.()}else setError(d.error||'Transcription is still pending. Check this same recording again; it will not start another request.');
  }catch(e){if(live.current&&ticket===generation.current)setError(e.message)}finally{lock.current=false;if(live.current)setBusy(false)}
 }
 return <details className="voice-question"><summary>Use my voice instead of typing</summary><p>Record or choose up to 60 seconds. You can edit the transcript before asking the tutor.</p><div className="voice-actions"><button type="button" disabled={disabled||busy} onClick={recording?stop:record}>{recording?'Stop recording':'Record a question'}</button><label className="voice-file">Choose audio<input type="file" accept="audio/*" disabled={disabled||busy||recording} onChange={e=>{const file=e.target.files[0];e.target.value='';if(file)void prepare(file)}}/></label></div>{recording&&<p role="status">Recording · {seconds} seconds</p>}{clip&&<><p>{Math.ceil(clip.seconds)} seconds ready.</p><label className="check"><input type="checkbox" checked={permission} onChange={e=>setPermission(e.target.checked)} disabled={busy}/>Send this recording to Fish Audio for transcription.</label><p className="subtle">The transcript is saved privately with your learning records. Mosaic does not save this raw recording. Provider processing is covered by the provider’s terms. Export, deletion and retention are in Your data.</p><div className="voice-actions"><button type="button" disabled={disabled||busy||!permission} onClick={transcribe}>{busy?'Transcribing…':'Transcribe my recording'}</button><button type="button" disabled={busy} onClick={()=>{generation.current++;setClip(null);setMessage('Recording discarded.')}}>Discard recording</button></div></>}{savedTranscripts.some(t=>t.text)&&<details><summary>Saved voice drafts</summary>{savedTranscripts.filter(t=>t.text).map(t=><div key={t.id}><p>{t.text}</p><button type="button" disabled={busy||disabled} onClick={()=>onTranscript(t.text)}>Use this transcript</button></div>)}</details>}{message&&<p role="status">{message}</p>}{error&&<p role="alert" className="message error">{error}</p>}</details>;
}

export function TutorAudio({job,identity,client,disabled,onStatus}){
 const [clips,setClips]=useState({}),[busy,setBusy]=useState(null),[error,setError]=useState(''),live=useRef(true),urls=useRef([]),lock=useRef(false);
 useEffect(()=>{live.current=true;return()=>{live.current=false;urls.current.forEach(URL.revokeObjectURL)}},[]);
 const segments=tutorSpeechSegments(job.draft);
 async function load(index){if(lock.current)return;lock.current=true;setBusy(index);setError('');const account=client.journal.user?.id;
  try{const r=await fetch('/api/learning/creative/tutor-audio',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-Mosaic-Learner':account,'X-Mosaic-Data-Epoch':client.journal.dataEpoch||'0:0'},body:JSON.stringify({...identity,id:job.id,draftHash:job.draftHash,index,requestKey:crypto.randomUUID()})});if(!r.ok){const d=await r.json();throw Error(d.error||'Tutor audio is unavailable. The full text remains above.')};const blob=await r.blob();if(!live.current||client.journal.user?.id!==account)return;const url=URL.createObjectURL(blob);urls.current.push(url);setClips(c=>({...c,[index]:url}));onStatus?.(r.headers.get('X-Mosaic-Audio')==='stored'?'Saved tutor audio loaded. No new generation.':'Tutor audio saved privately. You can replay it without generation.');
  }catch(e){if(live.current)setError(e.message)}finally{lock.current=false;if(live.current)setBusy(null)}
 }
 return <section className="tutor-audio" aria-label="Spoken tutor guidance"><h4>Listen to this guidance</h4><p className="subtle">Synthetic guide voice by Fish Audio. The same unreviewed AI guidance shown above; source quotations stay in the text. New recordings use the AI allowance; saved audio is reused.</p>{segments.map((s,i)=><div key={s.id}>{clips[i]?<audio controls preload="metadata" src={clips[i]} aria-label={'Tutor reply part '+(i+1)}/>:<button disabled={disabled||busy!==null} onClick={()=>load(i)}>{busy===i?'Preparing audio…':segments.length>1?'Load audio part '+(i+1):'Load tutor audio'}</button>}</div>)}{error&&<p role="alert" className="message error">{error}</p>}</section>;
}
