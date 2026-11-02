import {strToU8} from 'fflate';
// Keep each source page separate in the archive to avoid one giant JSON object.
// A changed snapshot aborts before any partial archive is offered for download.
export async function workspaceExportFiles(call,progress=()=>{}){
 const files={},parts=[],seen=new Set();let cursor=null,snapshot,total,count=0;
 do{
  const response=await call({action:'export',scope:'workspace',paged:true,...(cursor?{cursor,snapshot}:{})}),{page,export:record}=response;
  if(!page||snapshot&&snapshot!==page.snapshot)throw Error('Materials changed during export. Refresh and export again.');
  snapshot=page.snapshot;total=page.total;
  for(const r of record.resources){if(seen.has(r.id))throw Error('The export repeated a source. Refresh and retry.');seen.add(r.id);}
  const name='materials-'+String(parts.length+1).padStart(2,'0')+'.json';files[name]=strToU8(JSON.stringify(record,null,2));parts.push(name);count+=record.resources.length;progress(count,total);
  cursor=page.nextCursor;if(cursor&&!record.resources.length||parts.length>25)throw Error('The export could not finish. Refresh and retry.');
 }while(cursor);
 if(count!==total)throw Error('The source count changed during export. Refresh and retry.');
 files['manifest.json']=strToU8(JSON.stringify({format:'mosaic-workspace-archive',version:1,sourceCount:count,snapshot,parts},null,2));
 files['README.txt']=strToU8('Mosaic workspace export\nRead manifest.json for the ordered material parts. Each materials-NN.json contains exact extracted source text and references. Chapters are included in the first part. Original uploaded files, account passwords and provider/infrastructure backups are not included. No AI requests were used.');
 return files;
}
