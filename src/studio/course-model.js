import {goalTerms} from '../evidence-selection.js';
const need=(ok,message)=>{if(!ok)throw Error(message)};
const text=(s,max,required=false)=>{need(typeof s==='string'&&s.length<=max&&(!required||s.trim().length>0),'Check the title or learning goal length.');return s.trim()};
const id=s=>typeof s==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(s);
const hash=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
export const emptyCourses=()=>({schemaVersion:1,courses:[]});
export function validateCourses(raw){
 need(raw?.schemaVersion===1&&Array.isArray(raw.courses)&&raw.courses.length<=12,'The course notebook could not be read. Your saved copy is preserved.');
 const seen=new Set();
 const courses=raw.courses.map(c=>{
  need(id(c.id)&&!seen.has(c.id),'Invalid or duplicate course.');seen.add(c.id);
  need(Array.isArray(c.topics)&&c.topics.length<=16,'Keep up to sixteen topics in a course.');
  const topics=c.topics.map(t=>{
   need(id(t.id)&&!seen.has(t.id),'Invalid or duplicate topic.');seen.add(t.id);
   const bindings=(rows,max,key)=>{need(Array.isArray(rows)&&rows.length<=max,'Too many topic references.');const ids=new Set();return rows.map(r=>{need(id(r.id)&&!ids.has(r.id)&&hash(r[key]),'Invalid or duplicate source version.');ids.add(r.id);return {id:r.id,[key]:r[key]}})};
   return {id:t.id,title:text(t.title,120,true),goal:text(t.goal,1200),resources:bindings(t.resources,12,'checksum'),chapters:bindings(t.chapters,12,'hash')};
  });
  return {id:c.id,title:text(c.title,120,true),goal:text(c.goal,1200),topics};
 });
 const state={schemaVersion:1,courses};need(JSON.stringify(state).length<=48000,'This notebook is full. Remove unused topic links before saving more.');return state;
}
export function editCourses(current,input,binding){
 const next=validateCourses(current);
 if(input.type==='create-course'){need(id(input.id)&&!next.courses.some(c=>c.id===input.id),'Choose a new course identity.');next.courses.push({id:input.id,title:input.title,goal:input.goal||'',topics:[]});}
 else {
  const c=next.courses.find(c=>c.id===input.courseId);need(c,'Course not found.');
  if(input.type==='rename-course'){c.title=input.title;c.goal=input.goal||'';}
  else if(input.type==='remove-course')next.courses=next.courses.filter(x=>x!==c);
  else if(input.type==='create-topic'){need(id(input.id),'Choose a valid topic identity.');c.topics.push({id:input.id,title:input.title,goal:input.goal||'',resources:[],chapters:[]});}
  else {
   const t=c.topics.find(t=>t.id===input.topicId);need(t,'Topic not found.');
   if(input.type==='rename-topic'){t.title=input.title;t.goal=input.goal||'';}
   else if(input.type==='remove-topic')c.topics=c.topics.filter(x=>x!==t);
   else if(['link-resource','link-chapter'].includes(input.type)){
    need(binding&&binding.id===input.id,'Review an available source or chapter first.');
    const key=input.type==='link-resource'?'resources':'chapters';
    const index=t[key].findIndex(r=>r.id===binding.id);if(index<0)t[key].push(binding);else t[key][index]=binding;
   }else if(['unlink-resource','unlink-chapter'].includes(input.type)){
    const key=input.type==='unlink-resource'?'resources':'chapters';t[key]=t[key].filter(r=>r.id!==input.id);
   }else throw Error('Unknown course change.');
  }
 }
 return validateCourses(next);
}
// Local lexical search: exact source text stays on the owned workspace. Scores
// rank word matches; they never certify coverage or factual entailment.
export function searchPassages(resources,query,{limit=30,rank=true,includeHeadings=true}={}){
 const terms=goalTerms(query),documents=resources.flatMap(r=>(r.units||[]).map(u=>({resourceId:r.id,checksum:r.checksum,status:r.status,...u})));
 if(!terms.length)return [];
 const tokens=s=>(s.toLowerCase().match(/[\p{L}\p{N}]+/gu)||[]),prepared=documents.map(d=>({...d,tokens:tokens(d.excerpt),heading:includeHeadings?tokens(d.title+' '+d.locator):[]}));
 const average=prepared.reduce((n,d)=>n+d.tokens.length,0)/Math.max(1,prepared.length);
 const frequency=new Map(terms.map(t=>[t,prepared.filter(d=>d.tokens.includes(t)||d.heading.includes(t)).length]));
 const matches=prepared.map(d=>{
  const matched=terms.filter(t=>d.tokens.includes(t)||d.heading.includes(t));
  const score=matched.reduce((total,t)=>{const tf=d.tokens.filter(x=>x===t).length+2*Number(d.heading.includes(t));const inverse=Math.log(1+(prepared.length-frequency.get(t)+.5)/(frequency.get(t)+.5));return total+inverse*(tf*2.2)/(tf+1.2*(.25+.75*d.tokens.length/Math.max(1,average)))},0);
  const {tokens:_,heading:__,...result}=d;return {...result,score,matched};
 }).filter(d=>d.score>0);
 return (rank?matches.sort((a,b)=>b.score-a.score||a.resourceId.localeCompare(b.resourceId)||a.id.localeCompare(b.id)):matches).slice(0,limit);
}
