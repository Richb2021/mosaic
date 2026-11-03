import {need} from './data-control.js';
import {digest} from './content-service.js';
export const SOURCE_FILE_LIMIT=8*1024*1024;
export const RECORDING_EXTENSIONS=['wav','mp3','aac','m4a','mp4','flac','ogg','opus','webm','mkv','mov'];
export const publicImportHosts=env=>(env.SOURCE_IMPORT_HOSTS||'en.wikipedia.org,openstax.org,www.bbc.co.uk,www.bbc.com,www.core-econ.org').split(',').map(h=>h.trim().toLowerCase()).filter(Boolean);
export function permittedSourceURL(value,env){
 let u;try{u=new URL(value)}catch{need(false,'Enter a complete HTTPS source address.')}
 need(u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&value.length<=2000,'Use a public HTTPS address without sign-in details or a custom port.');
 need(publicImportHosts(env).includes(u.hostname.toLowerCase())&&!/^[\d.:\[\]]+$/.test(u.hostname)&&u.hostname.includes('.')&&!/(?:^|\.)(?:localhost|local|internal|test|invalid)$/.test(u.hostname),'This source host is not enabled for import. Paste permitted text or ask the administrator to enable its public host.');
 u.hash='';return u;
}
export async function boundedBytes(response,limit){
 need(response.body,'The source returned an empty response.',422);const reader=response.body.getReader();let size=0,parts=[];
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;need(size<=limit,'This file is too large to import. Split it first.',413);parts.push(value)}}finally{await reader.cancel().catch(()=>{})}
 const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length}return bytes;
}
const entity=s=>s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,(m,v)=>{if(v[0]==='#'){const n=v[1].toLowerCase()==='x'?parseInt(v.slice(2),16):Number(v.slice(1));return n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):' '}return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '}[v.toLowerCase()]});
export function htmlSourceText(html){
 // Text extraction only: no DOM insertion, script evaluation or secondary fetches.
 return entity(html.replace(/<!--[\s\S]*?-->/g,' ').replace(/<(head|title|script|style|noscript|svg|template|nav|header|footer)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,' ').replace(/<\/(?:p|div|section|article|h[1-6]|ul|ol|table)\s*>/gi,'\n\n').replace(/<(?:br|\/tr|\/li)\b[^>]*>/gi,'\n').replace(/<\/(?:td|th)\s*>/gi,' | ').replace(/<[^>]*>/g,' ').replace(/[\t ]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n')).trim();
}
export async function importURL(value,env,fetcher=fetch){
 let url=permittedSourceURL(value,env);
 for(let redirects=0;redirects<=3;redirects++){
  const response=await fetcher(url.href,{redirect:'manual',headers:{Accept:'text/html, text/plain;q=0.9','User-Agent':'Mosaic-Source-Import/1.0'},signal:AbortSignal.timeout(15000)});
  if([301,302,303,307,308].includes(response.status)){await response.body?.cancel();need(redirects<3&&response.headers.get('location'),'The source redirected too many times.',422);url=permittedSourceURL(new URL(response.headers.get('location'),url).href,env);continue;}
  need(response.ok,'The source could not be fetched (HTTP '+response.status+'). Paste permitted text instead.',422);
  const type=response.headers.get('content-type')||'';need(/^(text\/(html|plain)|application\/xhtml\+xml)\b/i.test(type),'This URL is not a readable web page or text file. Download and upload the supported document instead.',422);
  const bytes=await boundedBytes(response,2*1024*1024);let raw;try{raw=new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch{need(false,'The page is not readable UTF-8. Paste checked text instead.',422)}
  const html=/html/i.test(type),text=html?htmlSourceText(raw):raw.trim(),title=html?entity(raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||url.hostname).replace(/<[^>]*>/g,'').trim():url.hostname;
  need(text.length>=60&&text.length<=60000&&new TextEncoder().encode(text).length<=65536,'This page contains too little or too much text. Select and paste the relevant permitted material; nothing was silently truncated.',422);
  return {text,title:title.slice(0,160),filename:'web-source.html',url:url.href,importedAt:Date.now(),warnings:['Web-page text only. Check reading order, tables, equations, dates and missing images. Import does not establish permission or factual accuracy.']};
 }throw Error('Unreachable redirect limit');
}
export function decodeFile(input){
 need(typeof input.filename==='string'&&input.filename.length<=240&&!/[\x00-\x1f]/.test(input.filename),'Choose a named file.');
 need(typeof input.base64==='string'&&input.base64.length<=Math.ceil(SOURCE_FILE_LIMIT/3)*4&&/^[A-Za-z0-9+/]*={0,2}$/.test(input.base64)&&input.base64.length%4===0,'Choose a file up to 8 MB.');let binary;try{binary=atob(input.base64)}catch{need(false,'The file encoding could not be read.')}
 need(binary.length>0&&binary.length<=SOURCE_FILE_LIMIT,'Choose a non-empty file up to 8 MB.');return Uint8Array.from(binary,c=>c.charCodeAt(0));
}
export const binaryDigest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
export const originalKey=async(owner,id)=>'sources/'+await digest(owner)+'/'+id+'/original';
export async function transcribeFile(bytes,{filename,language},env,fetcher=fetch){
 need(env.FISH_AUDIO_API_KEY,'Fish transcription is not connected.',503);
 const form=new FormData();form.set('audio',new Blob([bytes]),filename);form.set('ignore_timestamps','false');form.set('diarize','false');form.set('tag_audio_events','false');if(language)form.set('language',language);
 const response=await fetcher('https://api.fish.audio/v1/asr',{method:'POST',headers:{Authorization:'Bearer '+env.FISH_AUDIO_API_KEY,model:'transcribe-1-pro'},body:form,redirect:'manual',signal:AbortSignal.timeout(180000)});
 need(response.ok,'Fish could not transcribe this recording (HTTP '+response.status+'). No automatic replacement request was sent.',502);
 let data;try{data=JSON.parse(new TextDecoder().decode(await boundedBytes(response,512000)))}catch(e){if(e.status)throw e;need(false,'Fish returned an unreadable transcript.',502)}
 need(typeof data.text==='string'&&data.text.length<=60000&&Number.isFinite(data.duration)&&data.duration>=0&&data.duration<=3600,'Fish returned an unsupported transcript or duration.',422);
 // Word-level ASR segments may normalize words differently from full text. Keep
 // the exact full transcript; never manufacture precise timestamps for it.
 return {text:data.text.trim(),duration:data.duration,language:typeof data.language_code==='string'?data.language_code.slice(0,16):null,requestId:typeof data.request_id==='string'?data.request_id.slice(0,200):null,warnings:['Machine transcription of the first audio track. Check every term, number, speaker and omission before source review. Video imagery is not interpreted. Word timings are not used as exact quotations.']};
}
