export const formatTime=value=>{const seconds=Math.max(0,Math.floor(Number.isFinite(value)?value:0));return `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;};
export function downloadBlob(blob,filename){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}

// A single media element and one object URL, with a promise cache for narration.
// Navigation cancels playback intent, not a possibly billable provider request.
export class AudioSequenceController{
 constructor({segments,audioFor,onChange=()=>{},audio=new Audio(),url=URL}){
  this.segments=segments;this.audioFor=audioFor;this.onChange=onChange;this.audio=audio;this.url=url;this.cache=new Map();this.ticket=0;this.disposed=false;this.wanted=false;this.objectURL=null;
  this.state={index:0,playing:false,loading:false,position:0,duration:0,rate:1,error:'',ready:[],ended:false};
  this.handlers={timeupdate:()=>this.emit({position:audio.currentTime||0}),durationchange:()=>this.emit({duration:Number.isFinite(audio.duration)?audio.duration:0}),loadedmetadata:()=>this.emit({duration:Number.isFinite(audio.duration)?audio.duration:0}),play:()=>this.emit({playing:true}),pause:()=>this.emit({playing:false}),ended:()=>{this.emit({playing:false});if(this.wanted&&this.state.index+1<this.segments.length)void this.open(this.state.index+1);else{this.wanted=false;this.emit({ended:true});}},error:()=>{this.wanted=false;this.emit({playing:false,loading:false,error:'This recording could not be played. The transcript is still available.'});}};
  for(const [name,handler]of Object.entries(this.handlers))audio.addEventListener(name,handler);
 }
 emit(change){if(this.disposed)return;this.state={...this.state,...change};this.onChange({...this.state,ready:[...this.state.ready]});}
 async blob(index){
  if(!Number.isInteger(index)||index<0||index>=this.segments.length)throw Error('Choose a passage in this episode.');
  if(!this.cache.has(index)){
   const pending=Promise.resolve().then(()=>this.audioFor(this.segments[index],index)).then(blob=>{if(!(blob instanceof Blob)||!blob.size)throw Error('No recording was returned. The transcript is available.');this.emit({ready:[...new Set([...this.state.ready,index])]});return blob;}).catch(error=>{this.cache.delete(index);throw error;});
   this.cache.set(index,pending);
  }
  return this.cache.get(index);
 }
 async open(index,{play=true}={}){
  if(this.disposed||!Number.isInteger(index)||index<0||index>=this.segments.length)return;
  const ticket=++this.ticket;this.wanted=play;this.audio.pause();this.emit({index,loading:true,playing:false,position:0,duration:0,error:'',ended:false});
  try{
   const blob=await this.blob(index);if(this.disposed||ticket!==this.ticket)return;
   if(this.objectURL)this.url.revokeObjectURL(this.objectURL);this.objectURL=this.url.createObjectURL(blob);this.audio.src=this.objectURL;this.audio.playbackRate=this.state.rate;this.audio.load();this.emit({loading:false});
   if(this.wanted){await this.audio.play();if(!this.disposed&&ticket===this.ticket&&!this.wanted)this.audio.pause();}
  }catch(error){if(this.disposed||ticket!==this.ticket)return;this.wanted=false;this.emit({loading:false,playing:false,error:error?.name==='NotAllowedError'?'Your browser paused playback. Press Play to listen.':error?.message||'Narration could not be prepared. The transcript is available.'});}
 }
 async play(){
  if(this.disposed)return;this.wanted=true;
  if(this.state.loading){this.emit({playing:false});return;}
  if(!this.objectURL||this.state.error||this.state.ended)return this.open(this.state.ended?0:this.state.index);
  const ticket=this.ticket;
  try{await this.audio.play();if(ticket===this.ticket&&!this.disposed)this.emit({error:''});}catch{if(ticket!==this.ticket||this.disposed)return;this.wanted=false;this.emit({error:'Your browser paused playback. Press Play to listen.'});}
 }
 pause(){this.wanted=false;this.audio.pause();this.emit({playing:false});}
 seek(seconds){if(Number.isFinite(seconds)&&this.state.duration>0){this.audio.currentTime=Math.max(0,Math.min(seconds,this.state.duration));this.emit({position:this.audio.currentTime});}}
 setRate(value){if(![0.75,1,1.25,1.5].includes(value))return;this.audio.playbackRate=value;this.emit({rate:value});}
 async all(){const result=[];for(let i=0;i<this.segments.length;i++){if(this.disposed)throw Error('The episode was closed.');result.push(await this.blob(i));}return result;}
 dispose(){if(this.disposed)return;this.disposed=true;this.wanted=false;this.ticket++;for(const [name,handler]of Object.entries(this.handlers))this.audio.removeEventListener(name,handler);this.audio.pause();this.audio.removeAttribute('src');this.audio.load();if(this.objectURL)this.url.revokeObjectURL(this.objectURL);this.objectURL=null;this.cache.clear();}
}

export function encodeWav({channels,sampleRate}){
 if(!Array.isArray(channels)||channels.length<1||channels.length>2||!Number.isInteger(sampleRate)||sampleRate<8000||sampleRate>96000||!channels.every(c=>c instanceof Float32Array&&c.length===channels[0].length))throw Error('Invalid decoded audio.');
 const frames=channels[0].length,count=channels.length,dataBytes=frames*count*2;
 if(dataBytes>96*1024*1024)throw Error('This episode is too long to download in this browser.');
 const buffer=new ArrayBuffer(44+dataBytes),view=new DataView(buffer),word=(at,s)=>{for(let i=0;i<s.length;i++)view.setUint8(at+i,s.charCodeAt(i));};
 word(0,'RIFF');view.setUint32(4,36+dataBytes,true);word(8,'WAVE');word(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,count,true);view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*count*2,true);view.setUint16(32,count*2,true);view.setUint16(34,16,true);word(36,'data');view.setUint32(40,dataBytes,true);
 let offset=44;for(let i=0;i<frames;i++)for(const channel of channels){const n=Number.isFinite(channel[i])?Math.max(-1,Math.min(1,channel[i])):0;view.setInt16(offset,n<0?n*0x8000:n*0x7fff,true);offset+=2;}
 return new Blob([buffer],{type:'audio/wav'});
}
export async function decodeAudioSequence(blobs,{sampleRate=44100,gapSeconds=.2}={}){
 if(!Array.isArray(blobs)||blobs.length<1||blobs.length>24||blobs.some(b=>!(b instanceof Blob)||b.size>4*1024*1024)||!Number.isFinite(gapSeconds)||gapSeconds<0||gapSeconds>2)throw Error('Invalid episode recordings.');
 const Context=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Context)throw Error('This browser cannot assemble an audio download. You can still listen and read the transcript.');
 const context=new Context({sampleRate}),decoded=[];
 try{for(const blob of blobs)decoded.push(await context.decodeAudioData(await blob.arrayBuffer()));
  const rate=context.sampleRate,gap=Math.round(gapSeconds*rate),frames=decoded.reduce((n,b)=>n+b.length,0)+gap*(decoded.length-1);if(frames>rate*600)throw Error('This episode is too long to assemble in this browser.');
  const buffer=context.createBuffer(1,frames,rate),out=buffer.getChannelData(0),offsets=[],durations=[];let at=0;
  for(const b of decoded){offsets.push(at/rate);durations.push(b.duration);for(let c=0;c<b.numberOfChannels;c++){const data=b.getChannelData(c);for(let i=0;i<data.length;i++)out[at+i]+=data[i]/b.numberOfChannels;}at+=b.length+gap;}
  return {buffer,offsets,durations};
 }finally{await context.close().catch(()=>{});}
}
