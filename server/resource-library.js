import {digest,requireValue,safeId} from './content-service.js';
import {goalTerms} from '../src/evidence-selection.js';
import {searchPassages} from '../src/studio/course-model.js';
import {rankedRetrieval} from './ranked-retrieval.js';
export const RESOURCE_LIMIT=500,RESOURCE_PAGE_SIZE=25,PASSAGE_PAGE_SIZE=30;
export const RESOURCE_METADATA='id,title,checksum,status,created,json_array_length(payload,\'$.units\') AS unitCount';
const older=(r,c)=>r.created<c.created||r.created===c.created&&r.id<c.id;
const same=(r,c)=>r.created===c.created&&r.id===c.id;
const encode=value=>btoa(JSON.stringify(value));
async function options(params,owner,kind){
 const query=(params.get('q')||'').trim(),status=params.get('status')||'all',ids=params.get('ids')?.split(',').sort()||[];
 requireValue(query.length<=240,'Use a search of at most 240 characters.');
 requireValue(['all','reviewed','unreviewed'].includes(status),'Choose a valid review filter.');
 requireValue(ids.length<=12&&ids.every(safeId)&&new Set(ids).size===ids.length,'Choose up to twelve different topic sources.');
 const scope=await digest(JSON.stringify({owner,kind,query,status,ids}));let cursor=null;
 if(params.has('cursor')){
  try{const raw=params.get('cursor');requireValue(raw.length<=500,'Invalid page cursor.');cursor=JSON.parse(atob(raw));}catch{requireValue(false,'This page link is invalid. Start the search again.');}
  requireValue(cursor?.scope===scope&&Number.isSafeInteger(cursor.created)&&cursor.created>=0&&safeId(cursor.id)&&Number.isInteger(cursor.unit)&&cursor.unit>=0&&cursor.unit<=80,'This page belongs to a different search. Start again.');
 }
 return {query,status,ids,scope,cursor};
}
// Only metadata crosses the catalogue boundary. The existing owner cap bounds
// this to 500 small rows, including when Unicode title filtering is needed.
export async function resourceMetadata(db,owner){return db.all(`SELECT ${RESOURCE_METADATA} FROM workshop_resources WHERE owner=? ORDER BY created DESC,id DESC`,owner)}
function scopeRows(rows,o){
 if(o.ids.length)requireValue(o.ids.every(id=>rows.some(r=>r.id===id)),'A topic source is no longer available.',404);
 return rows.filter(r=>(!o.ids.length||o.ids.includes(r.id))&&(o.status==='all'||r.status===o.status));
}
export async function resourcePage(db,owner,params){
 const o=await options(params,owner,'list'),catalogue=await resourceMetadata(db,owner),query=o.query.toLowerCase();
 const matches=scopeRows(catalogue,o).filter(r=>r.title.toLowerCase().includes(query)),remaining=matches.filter(r=>!o.cursor||older(r,o.cursor)),resources=remaining.slice(0,RESOURCE_PAGE_SIZE),last=resources.at(-1);
 return {resources,total:catalogue.length,matching:matches.length,limit:RESOURCE_LIMIT,nextCursor:remaining.length>RESOURCE_PAGE_SIZE?encode({scope:o.scope,created:last.created,id:last.id,unit:0}):null};
}
export async function resourceSearch(db,owner,params){
 if(params.get('order')==='relevance')return rankedRetrieval(db,owner,params,resourceMetadata);
 const o=await options(params,owner,'search'),terms=goalTerms(o.query);requireValue(terms.length>0,'Enter at least one meaningful word of three or more characters.');requireValue(terms.length<=12,'Use up to twelve meaningful search words.');
 const catalogue=scopeRows(await resourceMetadata(db,owner),o),rows=catalogue.filter(r=>!o.cursor||older(r,o.cursor)||same(r,o.cursor));const results=[];let scanned=0;
 // Read bounded batches; never materialise the whole library's text. A cursor
 // can resume inside a source, so dense sources cannot hide later passages.
 for(let offset=0;offset<rows.length;offset+=20){
  const batch=rows.slice(offset,offset+20),full=await db.all('SELECT id,checksum,status,payload FROM workshop_resources WHERE owner=? AND id IN ('+batch.map(()=>'?').join(',')+')',owner,...batch.map(r=>r.id)),byId=new Map(full.map(r=>[r.id,r]));
  for(let i=0;i<batch.length;i++){
   const meta=batch[i],row=byId.get(meta.id);if(!row)continue;scanned++;
   const units=JSON.parse(row.payload).units,start=o.cursor&&same(meta,o.cursor)?o.cursor.unit:0;
   const hits=new Map(searchPassages([{...row,units}],o.query,{limit:80,rank:false,includeHeadings:false}).map(h=>[h.id,h]));
   for(let index=start;index<units.length;index++){
    if(hits.has(units[index].id))results.push(hits.get(units[index].id));
    if(results.length===PASSAGE_PAGE_SIZE){const more=index+1<units.length||offset+i+1<rows.length;return {results,sourceCount:catalogue.length,scanned,method:'word-match',nextCursor:more?encode({scope:o.scope,created:meta.created,id:meta.id,unit:index+1}):null};}
   }
  }
 }
 return {results,sourceCount:catalogue.length,scanned,method:'word-match',nextCursor:null};
}
