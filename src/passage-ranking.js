import {goalTerms} from './evidence-selection.js';
const need=(ok,message)=>{if(!ok)throw Error(message)};
export const passageTokens=s=>(s.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu)||[]);
export function retrievalQuery(query,related=''){
 need(typeof query==='string'&&query.trim().length>0&&query.length<=240,'Enter a search of up to 240 characters.');
 need(typeof related==='string'&&related.length<=488,'Keep alternative phrases within eight lines of 60 characters.');
 const terms=goalTerms(query.normalize('NFKC'));
 need(terms.length>0&&terms.length<=12,'Use one to twelve meaningful search words of three or more characters.');
 const phrases=[...new Set(related.split('\n').map(s=>s.trim()).filter(Boolean))];
 need(phrases.length<=8&&phrases.every(p=>p.length<=60&&passageTokens(p).length>0&&passageTokens(p).length<=8),'Use up to eight alternative phrases, each at most 60 characters and eight words.');
 return {query:query.trim(),terms,phrases,phraseTokens:phrases.map(p=>passageTokens(p))};
}
export function passageFeatures(excerpt,q){
 const tokens=passageTokens(excerpt),counts=new Map();for(const t of tokens)counts.set(t,(counts.get(t)||0)+1);
 const tf=q.terms.map(t=>counts.get(t)||0),related=q.phraseTokens.map(p=>{
  let count=0;for(let i=0;i<=tokens.length-p.length;i++)if(p.every((t,j)=>tokens[i+j]===t))count++;return count;
 });
 return {length:tokens.length,tf,related};
}
// Global document frequencies and length normalisation rank every scanned
// passage. Alternative phrases are explicit user input, never inferred facts.
export function rankFeatures(rows,q,{documents,totalLength,frequencies,relatedFrequencies}){
 const average=totalLength/Math.max(1,documents),scoreTerm=(tf,df,length)=>tf?Math.log(1+(documents-df+.5)/(df+.5))*tf*2.2/(tf+1.2*(.25+.75*length/Math.max(1,average))):0;
 return rows.map(r=>({...r,score:r.tf.reduce((n,tf,i)=>n+scoreTerm(tf,frequencies[i],r.length),0)+.65*r.related.reduce((n,tf,i)=>n+scoreTerm(tf,relatedFrequencies[i],r.length),0)})).sort((a,b)=>b.score-a.score||a.resourceId.localeCompare(b.resourceId)||a.index-b.index);
}
export function evidenceChoice(current,passage){
 const exists=current.some(p=>p.resourceId===passage.resourceId&&p.id===passage.id),next=exists?current.filter(p=>!(p.resourceId===passage.resourceId&&p.id===passage.id)):[...current,passage];
 need(next.length<=12,'Choose up to twelve passages for a chapter.');
 need(new Set(next.map(p=>p.resourceId)).size<=3,'Choose passages from up to three sources for one chapter.');
 need(next.reduce((n,p)=>n+p.excerpt.length,0)<=18000,'Keep chapter evidence within 18,000 characters.');return next;
}
export function currentEvidence(selected,resources){
 need(selected.length>0,'Select at least one passage.');let checked=[];
 for(const p of selected){const r=resources.find(r=>r.id===p.resourceId),u=r?.units.find(u=>u.id===p.id);
  need(r?.status==='reviewed'&&r.checksum===p.checksum&&u?.excerpt===p.excerpt&&u?.locator===p.locator,'A selected source changed or is no longer reviewed. Search again and check its current text.');
  checked=evidenceChoice(checked,{...u,resourceId:r.id,checksum:r.checksum});
 }
 need(checked.length===selected.length,'Choose different evidence passages.');return checked;
}
