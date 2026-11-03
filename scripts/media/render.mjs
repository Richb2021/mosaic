import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {spawn,execFile} from 'node:child_process';import {promisify} from 'node:util';import {once} from 'node:events';
import {createCanvas,loadImage,GlobalFonts} from '@napi-rs/canvas';
import {loadCartoonLibrary} from '../../src/studio/media/cartoon-library.js';
import {drawCartoonFrame,sceneAtTime} from '../../src/studio/media/cartoon-renderer.js';
import {validateMouthCues,mouthAtTime} from '../../src/studio/media/lip-sync.js';
import {stagePropStates} from '../../src/studio/media/prop-staging.js';
const exec=promisify(execFile),root=path.resolve(import.meta.dirname,'../..');
export async function renderEpisode({job,clips,directory,assets=path.join(root,'public'),onProgress=()=>{}}){
 await mkdir(directory,{recursive:true,mode:0o700});
 const durations=[],offsets=[];let duration=0;
 for(let i=0;i<clips.length;i++){
  const wav=path.join(directory,`scene-${i}.wav`);await exec('ffmpeg',['-v','error','-y','-i',clips[i],'-ac','1','-ar','16000',wav],{timeout:60000});
  const {stdout}=await exec('ffprobe',['-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',wav]);const seconds=Number(stdout);
  if(!Number.isFinite(seconds)||seconds<=0||seconds>90)throw Error('Scene duration outside the supported range.');offsets.push(duration);durations.push(seconds);duration+=seconds;
 }
 if(duration>600)throw Error('Episode exceeds ten minutes.');
 const list=clips.map((_,i)=>`file 'scene-${i}.wav'`).join('\n');await writeFile(path.join(directory,'concat.txt'),list);
 const audio=path.join(directory,'episode.wav');await exec('ffmpeg',['-v','error','-y','-f','concat','-safe','1','-i',path.join(directory,'concat.txt'),'-ac','2','-ar','44100',audio],{timeout:60000});
 const output=path.join(directory,'episode.'+job.format);
 if(job.format==='mp3'){await exec('ffmpeg',['-v','error','-y','-i',audio,'-codec:a','libmp3lame','-b:a','128k',output],{timeout:60000});return {output,duration}}
 GlobalFonts.registerFromPath(path.join(assets,'fonts/studio-manrope.ttf'),'Studio');
 const art=await loadCartoonLibrary(job.style,job.edition,{fetcher:async url=>({ok:true,json:async()=>JSON.parse(await readFile(path.join(assets,url),'utf8'))}),imageLoader:async a=>{const img=await loadImage(path.join(assets,a.url));if(img.width!==a.width||img.height!==a.height)throw Error('Art dimensions changed.');return img}});
 // Run the same shipped Rhubarb WASM and speech model as the browser, locally.
 const lip=path.join(assets,'lip-sync/v1'),moduleFile=path.join(directory,'lip-engine.cjs');await writeFile(moduleFile,await readFile(path.join(lip,'lip-sync-engine.js')));
 const factory=createRequire(import.meta.url)(moduleFile),model=Buffer.concat(await Promise.all([0,1,2].map(i=>readFile(path.join(lip,`model-${i}.bin`)))));
 const m=await factory({wasmBinary:await readFile(path.join(lip,'lip-sync-engine.wasm')),getPreloadedPackage:()=>model.buffer.slice(model.byteOffset,model.byteOffset+model.byteLength),print:()=>{},printErr:()=>{}});
 const init=m._malloc(64);m.stringToUTF8('/wasm/res',init,64);const ready=m._lipsyncengine_init(init);m._free(init);if(ready!==0)throw Error('Speech analyser failed to initialise.');
 const cues=[];
 for(let i=0;i<clips.length;i++){
  const pcm=path.join(directory,`pcm-${i}.raw`);await exec('ffmpeg',['-v','error','-y','-i',path.join(directory,`scene-${i}.wav`),'-f','s16le',pcm]);const bytes=await readFile(pcm),p=m._malloc(bytes.length),text=job.script.segments[i].text,n=m.lengthBytesUTF8(text)+1,t=m._malloc(n);let r=0;
  try{m.HEAP16.set(new Int16Array(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)),p/2);m.stringToUTF8(text,t,n);r=m._lipsyncengine_analyze_pcm16(p,bytes.length/2,16000,t);if(!r)throw Error('Speech analysis failed.');cues.push(validateMouthCues(JSON.parse(m.UTF8ToString(r)),durations[i]));}finally{m._free(p);m._free(t);if(r)m._lipsyncengine_free(r)}
 }
 const canvas=createCanvas(1280,720),ctx=canvas.getContext('2d'),fps=24,frames=Math.ceil(duration*fps),props=stagePropStates(job.script);
 const ff=spawn('ffmpeg',['-v','error','-y','-f','rawvideo','-pixel_format','rgba','-video_size','1280x720','-framerate',String(fps),'-i','pipe:0','-i',audio,'-c:v','libx264','-preset','veryfast','-crf','21','-pix_fmt','yuv420p','-c:a','aac','-b:a','128k','-shortest','-movflags','+faststart',output],{stdio:['pipe','ignore','pipe']});
 let error='';ff.stderr.on('data',v=>{error=(error+v).slice(-2000)});const completion=new Promise((resolve,reject)=>{ff.on('error',reject);ff.on('close',code=>code===0?resolve():reject(Error('Video encoding failed: '+error)))});completion.catch(()=>{});
 try{for(let frame=0;frame<frames;frame++){const s=sceneAtTime(offsets,durations,frame/fps);drawCartoonFrame(ctx,{segment:job.script.segments[s.index],index:s.index,count:clips.length,elapsed:s.elapsed,duration:s.duration,playing:true,reducedMotion:false,captions:true,art,mouth:mouthAtTime(cues[s.index],s.elapsed),prop:job.script.story?.prop,propState:props?.[s.index]});if(!ff.stdin.write(Buffer.from(ctx.getImageData(0,0,1280,720).data)))await once(ff.stdin,'drain');if(frame%240===0)await onProgress(frame/frames)}ff.stdin.end();await completion;}catch(e){ff.kill('SIGKILL');throw e}
 return {output,duration,frames,cues:cues.map(c=>c.length)};
}
