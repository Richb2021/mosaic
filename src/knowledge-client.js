import {learningJournal} from './game-modes/learning-client.js';
export async function originalBytes(id){
 const account=learningJournal.user?.id;if(!account)throw Error('Sign in to download the original.');
 const response=await fetch('/api/workshop/knowledge/original/'+encodeURIComponent(id),{credentials:'same-origin',cache:'no-store',headers:{'X-Mosaic-Learner':account}});
 if(!response.ok){const data=await response.json();throw Error(data.error||'Original file unavailable.');}
 const bytes=new Uint8Array(await response.arrayBuffer());if(learningJournal.user?.id!==account)throw Error('Your account changed. Reopen the source.');return bytes;
}
export function fileBase64(bytes){let result='';for(let start=0;start<bytes.length;start+=32768)result+=String.fromCharCode(...bytes.subarray(start,start+32768));return btoa(result)}
export function saveOriginal(filename,bytes){const url=URL.createObjectURL(new Blob([bytes],{type:'application/octet-stream'})),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000)}
