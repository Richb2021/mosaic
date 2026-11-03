// A bounded, canonical wire format lets the server validate duration before ASR.
export const VOICE_RATE=16000,VOICE_SECONDS=60;
export function encodeVoice(samples){
 if(!samples.length||samples.length>VOICE_RATE*VOICE_SECONDS)throw Error('Choose between a moment and 60 seconds of audio.');
 const bytes=new Uint8Array(44+samples.length*2),v=new DataView(bytes.buffer);
 const text=(at,s)=>{for(let i=0;i<s.length;i++)bytes[at+i]=s.charCodeAt(i)};
 text(0,'RIFF');v.setUint32(4,bytes.length-8,true);text(8,'WAVE');text(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,VOICE_RATE,true);v.setUint32(28,VOICE_RATE*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);text(36,'data');v.setUint32(40,samples.length*2,true);
 for(let i=0;i<samples.length;i++){const s=Math.max(-1,Math.min(1,samples[i]));v.setInt16(44+i*2,s<0?s*32768:s*32767,true)}return bytes;
}
export function voiceDuration(bytes){
 if(!(bytes instanceof Uint8Array)||bytes.length<46||bytes.length>44+VOICE_RATE*VOICE_SECONDS*2||bytes.length%2)throw Error('Choose a recording of 60 seconds or less.');
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),t=(a,b)=>String.fromCharCode(...bytes.slice(a,b));
 if(t(0,4)!=='RIFF'||t(8,16)!=='WAVEfmt '||t(36,40)!=='data'||v.getUint32(4,true)!==bytes.length-8||v.getUint32(16,true)!==16||v.getUint16(20,true)!==1||v.getUint16(22,true)!==1||v.getUint32(24,true)!==VOICE_RATE||v.getUint32(28,true)!==VOICE_RATE*2||v.getUint16(32,true)!==2||v.getUint16(34,true)!==16||v.getUint32(40,true)!==bytes.length-44)throw Error('Unsupported voice encoding. Record or choose the audio again.');
 return (bytes.length-44)/(VOICE_RATE*2);
}
export function tutorSpeechSegments(reply){
 // Preserve every spoken character, including Unicode; never speak citations as claims.
 const chars=Array.from([reply.message,reply.question].filter(Boolean).join('\n\n')),segments=[];
 while(chars.length){let n=0,length=0;while(n<chars.length&&length+chars[n].length<=850){length+=chars[n].length;n++}if(n<chars.length){const stop=chars.slice(0,n).join('').lastIndexOf(' ');if(stop>200)n=Array.from(chars.slice(0,n).join('').slice(0,stop+1)).length;}
  segments.push({id:'reply-'+(segments.length+1),speaker:'guide',text:chars.splice(0,n).join('')});}
 return segments;
}
