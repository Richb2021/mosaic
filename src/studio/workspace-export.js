import {strToU8} from 'fflate';
// Keep each source page separate in the archive to avoid one giant JSON object.
// A changed snapshot aborts before any partial archive is offered for download.
export async function workspaceExportFiles(call,progress=()=>{},downloadOriginal){
 const files={},parts=[],originals=[],seen=new Set();let cursor=null,snapshot,total,count=0;
 do{
  const response=await call({action:'export',scope:'workspace',paged:true,...(cursor?{cursor,snapshot}:{})}),{page,export:record}=response;
  if(!page||snapshot&&snapshot!==page.snapshot)throw Error('Materials changed during export. Refresh and export again.');
  snapshot=page.snapshot;total=page.total;
  for(const r of record.resources){if(seen.has(r.id))throw Error('The export repeated a source. Refresh and retry.');seen.add(r.id);if(r.payload?.original)originals.push({id:r.id,...r.payload.original});}
  const name='materials-'+String(parts.length+1).padStart(2,'0')+'.json';files[name]=strToU8(JSON.stringify(record,null,2));parts.push(name);count+=record.resources.length;progress(count,total);
  cursor=page.nextCursor;if(cursor&&!record.resources.length||parts.length>25)throw Error('The export could not finish. Refresh and retry.');
 }while(cursor);
 if(count!==total)throw Error('The source count changed during export. Refresh and retry.');
 let originalsIncluded=false;
 if(originals.length&&downloadOriginal&&originals.reduce((n,r)=>n+r.bytes,0)<=100*1048576){
  for(const r of originals){const bytes=await downloadOriginal(r.id);const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');if(bytes.length!==r.bytes||sha!==r.sha256)throw Error('An original file changed or was unavailable. No incomplete archive was offered.');files['originals/'+r.id+'/'+r.filename.replace(/[^a-zA-Z0-9._-]/g,'_')]=bytes;}originalsIncluded=true;
 }
 files['originals-index.json']=strToU8(JSON.stringify({included:originalsIncluded,originals,notice:originalsIncluded?'Retained original files are included.':'Originals are indexed. Download them individually from their source pages; archive inclusion is limited to 100 MB.'},null,2));
 files['manifest.json']=strToU8(JSON.stringify({format:'mosaic-workspace-archive',version:1,sourceCount:count,snapshot,parts,originalsIncluded,originalCount:originals.length},null,2));
 files['README.txt']=strToU8('Mosaic workspace export\nRead manifest.json for the ordered material parts. Each materials-NN.json contains exact extracted source text and references. Chapters and course plans are included in the first part. See originals-index.json for retained originals and whether their bytes are included (100 MB archive limit). Account passwords and provider/infrastructure backups are not included. No AI requests were used.');
 return files;
}
