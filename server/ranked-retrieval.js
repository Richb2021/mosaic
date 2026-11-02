import {digest,requireValue,WorkshopError} from './content-service.js';
import {retrievalQuery,passageFeatures,rankFeatures} from '../src/passage-ranking.js';
export const RANKED_PAGE_SIZE=20;
const encode=x=>btoa(JSON.stringify(x));
export async function rankedRetrieval(db,owner,params,metadata){
 let q;try{q=retrievalQuery(params.get('q')||'',params.get('related')||'')}catch(e){throw new WorkshopError(e.message)}
 requireValue(!params.has('status')||params.get('status')==='reviewed','Ranked discovery searches reviewed sources only.');
 const ids=params.get('ids')?.split(',').sort()||[];
 requireValue(ids.length<=12&&new Set(ids).size===ids.length&&ids.every(id=>/^[a-zA-Z0-9_-]{1,100}$/.test(id)),'Choose up to twelve topic sources.');
 const catalogue=await metadata(db,owner);requireValue(catalogue.length<=500,'This library exceeds the supported search size.',409);
 requireValue(ids.every(id=>catalogue.some(r=>r.id===id)),'A topic source is no longer available.',404);
 const scopeRows=rows=>rows.filter(r=>!ids.length||ids.includes(r.id)),snapshotOf=rows=>digest(JSON.stringify(scopeRows(rows).map(r=>[r.id,r.checksum,r.status,r.unitCount,r.title,r.created])));
 const scoped=scopeRows(catalogue),sources=scoped.filter(r=>r.status==='reviewed'),snapshot=await snapshotOf(catalogue),scope=await digest(JSON.stringify({owner,q,ids,method:'ranked-words-v1'}));
 let offset=0;
 if(params.has('cursor')){
  let c;try{requireValue(params.get('cursor').length<=500,'Invalid cursor.');c=JSON.parse(atob(params.get('cursor')))}catch{throw new WorkshopError('This page link is invalid. Search again.')}
  requireValue(c.scope===scope&&Number.isInteger(c.offset)&&c.offset>=0&&c.offset<=40000&&c.offset%RANKED_PAGE_SIZE===0,'This page belongs to a different search. Search again.');
  requireValue(c.snapshot===snapshot,'Your source library changed. Search again to use its current text.',409);offset=c.offset;
 }
 let documents=0,totalLength=0;const frequencies=q.terms.map(()=>0),relatedFrequencies=q.phrases.map(()=>0),features=[];
 // Keep one bounded source batch and numeric match features, not all excerpts.
 for(let start=0;start<sources.length;start+=20){
  const batch=sources.slice(start,start+20),rows=await db.all('SELECT id,checksum,status,payload FROM workshop_resources WHERE owner=? AND id IN ('+batch.map(()=>'?').join(',')+')',owner,...batch.map(r=>r.id)),byId=new Map(rows.map(r=>[r.id,r]));
  for(const meta of batch){const r=byId.get(meta.id);requireValue(r&&r.status==='reviewed'&&r.checksum===meta.checksum,'Your source library changed. Search again.',409);const units=JSON.parse(r.payload).units;requireValue(Array.isArray(units)&&units.length<=80,'A source could not be searched. Open and review it first.',409);
   for(let index=0;index<units.length;index++){const f=passageFeatures(units[index].excerpt,q);documents++;totalLength+=f.length;f.tf.forEach((n,i)=>{if(n)frequencies[i]++});f.related.forEach((n,i)=>{if(n)relatedFrequencies[i]++});if(f.tf.some(Boolean)||f.related.some(Boolean))features.push({resourceId:r.id,index,...f});}
  }
 }
 const ranked=rankFeatures(features,q,{documents,totalLength,frequencies,relatedFrequencies}),page=ranked.slice(offset,offset+RANKED_PAGE_SIZE),pageIds=[...new Set(page.map(r=>r.resourceId))],canonical=new Map();
 if(pageIds.length){const rows=await db.all('SELECT id,checksum,status,payload FROM workshop_resources WHERE owner=? AND id IN ('+pageIds.map(()=>'?').join(',')+')',owner,...pageIds);for(const r of rows)canonical.set(r.id,r)}
 const results=page.map(f=>{const r=canonical.get(f.resourceId),meta=sources.find(s=>s.id===f.resourceId);requireValue(r&&r.status==='reviewed'&&r.checksum===meta.checksum,'Your source library changed. Search again.',409);const u=JSON.parse(r.payload).units[f.index];return {...u,resourceId:r.id,checksum:r.checksum,status:r.status,matched:q.terms.filter((_,i)=>f.tf[i]),relatedMatched:q.phrases.filter((_,i)=>f.related[i])}});
 requireValue(await snapshotOf(await metadata(db,owner))===snapshot,'Your source library changed while searching. Search again.',409);
 return {results,method:'ranked-words-v1',sourceCount:sources.length,excludedSources:scoped.length-sources.length,scanned:sources.length,passagesScanned:documents,totalMatches:ranked.length,offset,snapshot,terms:q.terms,related:q.phrases,matched:q.terms.filter((_,i)=>frequencies[i]),notFound:q.terms.filter((_,i)=>!frequencies[i]),relatedNotFound:q.phrases.filter((_,i)=>!relatedFrequencies[i]),nextCursor:offset+RANKED_PAGE_SIZE<ranked.length?encode({scope,snapshot,offset:offset+RANKED_PAGE_SIZE}):null};
}
