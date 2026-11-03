export const VISEMES=Object.freeze(['X','A','B','C','D','E','F','G','H']);
// Rhubarb's original shape mapping, not the incorrect table in the wrapper README.
export function validateMouthCues(result,duration){
 const cues=result?.mouthCues;if(!Array.isArray(cues)||!cues.length||cues.length>9000)throw Error('Invalid speech animation.');let end=0;
 return cues.map(c=>{if(!VISEMES.includes(c.value)||!Number.isFinite(c.start)||!Number.isFinite(c.end)||c.start<end-.001||c.start<0||c.end<=c.start||c.end>duration+.1)throw Error('Invalid speech timing.');end=c.end;return {start:c.start,end:Math.min(c.end,duration),value:c.value};});
}
export function mouthAtTime(cues,time,{still=false,active=true}={}){
 if(still||!active||!Number.isFinite(time)||time<0)return 'X';
 return cues?.find(c=>time>=c.start&&time<c.end)?.value||'X';
}
export function pcmForScene(track,index){
 const duration=track.durations[index];if(!Number.isFinite(duration)||duration<=0||duration>90)throw Error('This scene is too long for speech animation.');
 const source=track.buffer.getChannelData(0),rate=track.buffer.sampleRate,start=track.offsets[index]*rate,out=new Int16Array(Math.floor(duration*16000));
 for(let i=0;i<out.length;i++){const pos=start+i*rate/16000,j=Math.floor(pos),a=source[j]||0,b=source[j+1]||0,v=Math.max(-1,Math.min(1,a+(b-a)*(pos-j)));out[i]=Math.round(v*(v<0?32768:32767));}return out;
}
export async function analyseEpisodeSpeech(track,segments,{signal,onProgress=()=>{},WorkerClass=globalThis.Worker,timeoutMs=60000}={}){
 if(signal?.aborted)throw Object.assign(Error('Speech preparation cancelled.'),{name:'AbortError'});
 if(!WorkerClass)throw Error('This browser cannot prepare speech animation.');
 const worker=new WorkerClass('/lip-sync/v1/worker.js');let pending=null;
 const abort=()=>pending?.reject(Object.assign(Error('Speech preparation cancelled.'),{name:'AbortError'}));signal?.addEventListener('abort',abort,{once:true});
 const request=(message,transfer=[])=>new Promise((resolve,reject)=>{if(signal?.aborted)return reject(Object.assign(Error('Speech preparation cancelled.'),{name:'AbortError'}));const timer=setTimeout(()=>reject(Error('Speech animation took too long. Please retry.')),timeoutMs);const done=fn=>value=>{clearTimeout(timer);pending=null;fn(value)};pending={resolve:done(resolve),reject:done(reject),id:message.id};worker.postMessage(message,transfer);});
 worker.onmessage=({data})=>{if(!pending||data.id!==pending.id)return;data.type==='error'?pending.reject(Error(data.error)):pending.resolve(data);};worker.onerror=()=>pending?.reject(Error('Speech animation could not load. Please retry.'));
 try{onProgress(0,segments.length);await request({type:'init'});const cues=[];for(let i=0;i<segments.length;i++){onProgress(i+1,segments.length);const pcm=pcmForScene(track,i);const {result}=await request({type:'analyze',id:i,pcm,text:segments[i].text},[pcm.buffer]);cues.push(validateMouthCues(result,track.durations[i]));}return cues;}
 finally{signal?.removeEventListener('abort',abort);worker.terminate();}
}
