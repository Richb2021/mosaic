import {stageAtTime} from './cartoon-director.js';
import {drawLibraryScene} from './cartoon-library.js';
import {CARTOON_SCENES,CARTOON_CAST,drawBackground,drawCharacter} from './cartoon-assets.js';
export {CARTOON_SCENES,CARTOON_CAST};
export const FRAME_WIDTH=1280,FRAME_HEIGHT=720;
const clamp=(v,min,max)=>Math.min(max,Math.max(min,Number.isFinite(v)?v:min));
// Caption pagination keeps every word. It never ellipsizes the approved script.
export function captionPages(text,measure,maxWidth=1130,maxLines=3){
 if(typeof text!=='string'||text.length>4000)throw Error('The scene text cannot be captioned.');
 if(typeof measure!=='function'||!Number.isFinite(maxWidth)||maxWidth<40||!Number.isInteger(maxLines)||maxLines<1)throw Error('Invalid caption layout.');
 const words=text.trim().split(/\s+/).filter(Boolean),lines=[];let line='';
 for(const word of words){
  if(measure(word)>maxWidth){if(line){lines.push(line);line=''}let part='';for(const ch of word){if(part&&measure(part+ch)>maxWidth){lines.push(part);part=''}part+=ch;}line=part;continue;}
  const candidate=line?line+' '+word:word;if(line&&measure(candidate)>maxWidth){lines.push(line);line=word}else line=candidate;
 }
 if(line)lines.push(line);const pages=[];for(let i=0;i<lines.length;i+=maxLines)pages.push(lines.slice(i,i+maxLines));return pages.length?pages:[['']];
}
export function captionForTime(pages,elapsed,duration){
 const weights=pages.map(p=>Math.max(1,p.join(' ').length)),total=weights.reduce((a,b)=>a+b,0),target=clamp(elapsed/Math.max(.01,duration),0,.999999)*total;let start=0;
 for(let i=0;i<pages.length;i++){if(target<start+weights[i])return {lines:pages[i],page:i,pages:pages.length};start+=weights[i]}
 return {lines:pages.at(-1),page:pages.length-1,pages:pages.length};
}
export function sceneAtTime(offsets,durations,seconds){
 if(!Array.isArray(offsets)||!offsets.length||offsets.length!==durations.length||offsets.some((x,i)=>!Number.isFinite(x)||x<0||i&&x<offsets[i-1])||durations.some(x=>!Number.isFinite(x)||x<=0))throw Error('The narration timeline is invalid.');
 let index=0;for(let i=1;i<offsets.length;i++){if(seconds>=offsets[i])index=i;else break}return {index,elapsed:clamp(seconds-offsets[index],0,durations[index]),duration:durations[index]};
}
export function drawCartoonFrame(ctx,{segment,index=0,count=1,elapsed=0,duration=10,playing=false,reducedMotion=false,captions=true,art=null}){
 if(!segment||!CARTOON_SCENES[segment.scene]||!CARTOON_CAST[segment.speaker])throw Error('This scene does not use an available setting and presenter.');
 if(!['talk','think','celebrate'].includes(segment.action))throw Error('This scene uses an unavailable action.');
 const t=clamp(elapsed,0,Math.max(0,duration)),moving=!reducedMotion;
 const stage=stageAtTime({segment,elapsed:t,index,duration,still:reducedMotion});
 ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,FRAME_WIDTH,FRAME_HEIGHT);
 if(art)drawLibraryScene(ctx,art,{segment,elapsed:t,index,duration,still:reducedMotion});
 else{
 ctx.save();ctx.beginPath();ctx.rect(0,0,1280,540);ctx.clip();ctx.translate(stage.camera.x,stage.camera.y);ctx.scale(stage.camera.scale,stage.camera.scale);drawBackground(ctx,segment.scene);
 for(const a of [...stage.actors].sort((a,b)=>a.y-b.y)){
  ctx.save();ctx.translate(a.x,a.y);ctx.scale(a.facing*(a.speaker==='learner'?-1:1),1);
  drawCharacter(ctx,{speaker:a.speaker,x:0,y:0,scale:a.speaker==='guide'?1.03:.94,active:a.active,action:a.active?segment.action:'think',time:a.time,moving});ctx.restore();
 }
 ctx.restore();}
 ctx.fillStyle='#223851';ctx.fillRect(0,540,1280,180);
 ctx.fillStyle='#f2d198';ctx.font='700 18px Studio, Arial, sans-serif';ctx.textBaseline='top';ctx.textAlign='left';ctx.fillText(CARTOON_CAST[segment.speaker].name,42,560);
 ctx.fillStyle='#bdcddd';ctx.font='500 17px Studio, Arial, sans-serif';ctx.textAlign='right';ctx.fillText(`${index+1} / ${count}   ${CARTOON_SCENES[segment.scene].label}`,1238,560);ctx.textAlign='left';
 ctx.font='500 27px Studio, Arial, sans-serif';const pages=captionPages(segment.text,s=>ctx.measureText(s).width),caption=captionForTime(pages,t,duration);
 if(captions){ctx.fillStyle='#ffffff';caption.lines.forEach((line,i)=>ctx.fillText(line,42,599+i*32));}
 else{ctx.fillStyle='#c2ceda';ctx.font='500 20px Studio, Arial, sans-serif';ctx.fillText('Captions are off. The full transcript is available below.',42,610)}
 const fraction=clamp(t/Math.max(.01,duration),0,1);ctx.fillStyle='#687d94';ctx.fillRect(42,708,1196,3);ctx.fillStyle='#f2d198';ctx.fillRect(42,708,1196*fraction,3);
 ctx.restore();return {...caption,scene:segment.scene,speaker:segment.speaker};
}
export function narrationTimeline(segments){return {offsets:segments.map((_,i)=>i*12),durations:segments.map(()=>12)};}
export function videoMime(MediaRecorderClass){return ['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(type=>MediaRecorderClass?.isTypeSupported?.(type))||null;}
export function safeMediaFilename(title,extension){return (String(title||'mosaic-cartoon').normalize('NFKD').replace(/[^a-z0-9 -]/gi,'').trim().replace(/\s+/g,'-').slice(0,70)||'mosaic-cartoon')+'.'+extension;}

// MediaRecorder writes an open-ended WebM Segment without Duration. Add the
// measured timeline duration to its Info element so a downloaded episode has a
// usable timeline. This is intentionally limited to this recorder's stream,
// not a general-purpose video editor. Matroska: Duration is a big-endian Float
// in TimestampScale ticks (default 1,000,000 ns).
// https://www.matroska.org/technical/elements.html
export async function finaliseCartoonVideo(blob,seconds){
 if(!(blob instanceof Blob)||blob.size>128*1024*1024||!Number.isFinite(seconds)||seconds<=0||seconds>601)throw Error('The recorded video cannot be finalised.');
 const bytes=new Uint8Array(await blob.arrayBuffer());
 const vint=(offset,id=false)=>{const first=bytes[offset];if(!first)throw Error('Invalid recorded video metadata.');let length=1,mask=128;while(!(first&mask)){mask>>=1;length++;if(length>8)throw Error('Invalid recorded video metadata.');}if(id&&length>4||offset+length>bytes.length)throw Error('Invalid recorded video metadata.');let value=BigInt(id?first:first&(mask-1));for(let i=1;i<length;i++)value=value*256n+BigInt(bytes[offset+i]);return {value,length,unknown:!id&&value===(1n<<BigInt(length*7))-1n};};
 const element=offset=>{const id=vint(offset,true),size=vint(offset+id.length),start=offset+id.length+size.length,end=size.unknown?bytes.length:start+Number(size.value);if(end>bytes.length||end<start)throw Error('Invalid recorded video metadata.');return {id:Number(id.value),offset,sizeOffset:offset+id.length,sizeLength:size.length,size:Number(size.value),unknown:size.unknown,start,end};};
 const sized=(n,length)=>{const value=BigInt(n);if(value>=(1n<<BigInt(length*7))-1n)throw Error('The recorded video metadata is too large.');let encoded=value|(1n<<BigInt(length*7));const result=new Uint8Array(length);for(let i=length-1;i>=0;i--){result[i]=Number(encoded&255n);encoded>>=8n;}return result;};
 if(element(0).id!==0x1a45dfa3)throw Error('The browser did not return a WebM video.');
 let segment;for(let at=0;at<bytes.length;){const e=element(at);if(e.id===0x18538067){segment=e;break}if(e.unknown||e.end<=at)break;at=e.end;}if(!segment)throw Error('The recorded video has no segment.');
 let info;for(let at=segment.start;at<segment.end;){const e=element(at);if(e.id===0x114d9b74||e.id===0x1c53bb6b)throw Error('This browser returned a video index that cannot be safely amended.');if(e.id===0x1549a966)info=e;if(e.id===0x1f43b675)break;if(e.unknown||e.end<=at)break;at=e.end;}
 if(!info||info.unknown)throw Error('The recorded video has no readable duration metadata.');
 let scale=1000000,duration;
 for(let at=info.start;at<info.end;){const e=element(at);if(e.end>info.end||e.unknown)throw Error('Invalid recorded video information.');if(e.id===0xbf)throw Error('The recorded video has checksummed metadata that cannot be amended.');if(e.id===0x2ad7b1){if(e.size>6)throw Error('Invalid video time scale.');scale=0;for(let p=e.start;p<e.end;p++)scale=scale*256+bytes[p];}if(e.id===0x4489)duration=e;at=e.end;}
 if(!Number.isFinite(scale)||scale<=0)throw Error('Invalid video time scale.');
 const ticks=seconds*1e9/scale;
 if(duration){if(![4,8].includes(duration.size))throw Error('Invalid video duration.');const copy=bytes.slice(),view=new DataView(copy.buffer);if(duration.size===8)view.setFloat64(duration.start,ticks,false);else view.setFloat32(duration.start,ticks,false);return new Blob([copy],{type:blob.type});}
 if(!segment.unknown)throw Error('This browser returned a closed video without a duration.');
 const metadata=new Uint8Array(11);metadata.set([0x44,0x89,0x88]);new DataView(metadata.buffer).setFloat64(3,ticks,false);const head=bytes.slice(0,info.end);head.set(sized(info.size+metadata.length,info.sizeLength),info.sizeOffset);return new Blob([head,metadata,bytes.subarray(info.end)],{type:blob.type});
}
