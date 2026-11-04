// Operations-host worker. No browser/session impersonation; server controls owner and script.
import {readFile,writeFile,mkdtemp,rm,mkdir,readdir,stat} from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
import {renderEpisode} from './render.mjs';
const configPath=process.env.MOSAIC_MEDIA_CONFIG||path.join(os.homedir(),'.config/mosaic-pilot/media.json'),config=JSON.parse(await readFile(configPath,'utf8'));
const origin=new URL(config.url);if(origin.protocol!=='https:'&&!['127.0.0.1','localhost'].includes(origin.hostname))throw Error('Use the configured HTTPS origin.');
const state=process.env.MOSAIC_MEDIA_STATE||path.join(os.homedir(),'.local/state/mosaic-media');await mkdir(state,{recursive:true,mode:0o700});
const headers={...(config.gatewayKey?{'X-Mosaic-Gateway':config.gatewayKey}:{}),...(config.siteToken?{'OAI-Sites-Authorization':'Bearer '+config.siteToken}:{}),Authorization:'Bearer '+config.maintenanceSecret,'X-Mosaic-Maintenance':'media-v1'};
async function request(body,binary){const url=new URL('/api/media-worker',origin);if(binary)url.search=new URLSearchParams(body);const r=await fetch(url,{method:'POST',redirect:'error',headers:{...headers,'Content-Type':binary?'application/octet-stream':'application/json'},body:binary||JSON.stringify(body),signal:AbortSignal.timeout(binary?120000:90000)});if(!r.ok)throw Error('Worker request failed: HTTP '+r.status);return r}
const receipt=async value=>{await writeFile(path.join(state,'last.tmp'),JSON.stringify({at:new Date().toISOString(),...value}),{mode:0o600});await (await import('node:fs/promises')).rename(path.join(state,'last.tmp'),path.join(state,'last.json'))};
// A crashed process can leave temporary audio. Remove only this worker's scratch directories.
for(const name of await readdir(state))if(name.startsWith('render-'))await rm(path.join(state,name),{recursive:true,force:true});
let stopping=false;process.on('SIGTERM',()=>{stopping=true});process.on('SIGINT',()=>{stopping=true});
async function tick(){let job,directory,timer;
 try{({job}=await (await request({action:'claim'})).json());if(!job){await receipt({status:'idle'});return false}directory=await mkdtemp(path.join(state,'render-'));await receipt({status:'running',jobId:job.id});
  let leaseError;timer=setInterval(()=>{request({action:'renew',id:job.id,token:job.token}).catch(e=>{leaseError=e})},60000);
  const clips=[];for(let index=0;index<job.total;index++){if(leaseError)throw leaseError;const r=await request({action:'audio',id:job.id,token:job.token,index}),file=path.join(directory,`clip-${index}.mp3`);await writeFile(file,new Uint8Array(await r.arrayBuffer()),{mode:0o600});clips.push(file)}
  // Story backdrops are optional: any that fail to download fall back to the library setting.
  const backdrops={};for(const scene of Object.keys(job.backdrops||{})){try{const r=await request({action:'backdrop',id:job.id,token:job.token,scene}),file=path.join(directory,`backdrop-${scene}.webp`);await writeFile(file,new Uint8Array(await r.arrayBuffer()),{mode:0o600});backdrops[scene]={file,...job.backdrops[scene]}}catch{}}
  const rendered=await renderEpisode({job,clips,directory,assets:config.assets,backdrops,onProgress:async()=>{if(leaseError)throw leaseError}});if(leaseError)throw leaseError;
  await request({action:'complete',id:job.id,token:job.token},await readFile(rendered.output));await receipt({status:'complete',jobId:job.id,duration:rendered.duration,frames:rendered.frames});return true;
 }catch(e){if(job)await request({action:'fail',id:job.id,token:job.token}).catch(()=>{});await receipt({status:'attention',jobId:job?.id||null,error:e.message.startsWith('Worker request')?e.message:'Media render failed; check worker dependencies and saved job.'});return false;
 }finally{clearInterval(timer);if(directory)await rm(directory,{recursive:true,force:true})}
}
do{await tick();if(process.argv.includes('--once')||stopping)break;await new Promise(r=>setTimeout(r,15000))}while(!stopping);
