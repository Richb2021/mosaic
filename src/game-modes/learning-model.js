import {profileContext} from '../studio/profile.js';
import {validateRPGSave} from '../rpg-progress.js';
import {draftHash,draftPhase,validateDraftState} from './draft-engine.js';
import {validateAdventureSave} from './adventure-engine.js';
import {restoreTown,encodeTown} from './town-engine.js';
import {validateExtendedState,extendedView} from './extended-engine.js';
import {validateJourney,journeyLearning} from './journey-engine.js';
export const LEARNING_TEMPLATES=['underlight-v1','adventure-v1','draft-v1','town-v1','novel-v1','quiz-v1','sports-v1','merge-v1'];
const need=(value,message)=>{if(!value)throw Error(message)};
export function normaliseProfile(raw={}){need(raw&&typeof raw==='object'&&!Array.isArray(raw),'Invalid learning profile.');const text=(v,n)=>{need(typeof v==='string'&&v.length<=n,'Learning profile text is too long.');return v.trim();};const formats=raw.formats??[];need(Array.isArray(formats)&&formats.length<=8&&formats.every(t=>LEARNING_TEMPLATES.includes(t)),'Choose available game formats.');return {goal:text(raw.goal??'',1200),context:text(raw.context??'',240),formats:[...new Set(formats)],...profileContext(raw,text,need)};}
export const sourceIdentity=s=>draftHash([s.title.trim(),s.locator.trim(),s.excerpt.trim()]);
export const progressIdentity=(pack,kind)=>`${pack.id}:${draftHash(pack)}:${kind}`;
export function validPracticeRecord(r){
 const s=r?.summary,text=(v,n)=>typeof v==='string'&&v.length<=n;
 return !!(r&&text(r.key,240)&&Number.isFinite(r.updated)&&r.updated>=0&&s&&text(s.packId,100)&&text(s.title,200)&&LEARNING_TEMPLATES.includes(s.template)&&text(s.contentHash,100)&&['classic','journey','rpg'].includes(s.kind)&&typeof s.completed==='boolean'&&Number.isInteger(s.engagement)&&s.engagement>=0&&s.engagement<=10000&&Array.isArray(s.observations)&&s.observations.length<=2000&&s.observations.every(o=>o&&text(o.key,100)&&[true,false,null].includes(o.correct)&&Number.isInteger(o.attempts)&&o.attempts>=0&&typeof o.assisted==='boolean'&&Array.isArray(o.sources)&&o.sources.length<=20&&o.sources.every(x=>x&&text(x.key,100)&&text(x.title,240)&&text(x.locator,240))));
}
export function observeProgress(pack,kind,raw){
 let snapshot,completed=false,items=[],engagement=0;
 if(kind==='rpg'&&pack.template==='underlight-v1'){snapshot=validateRPGSave(raw,pack);completed=snapshot.ended&&snapshot.chapter.completed;engagement=snapshot.visited.length+snapshot.chapter.visited.length+snapshot.seals.length;/* Restorable personal state, not replay-verified learning evidence. */}
 else if(kind==='journey'){snapshot=validateJourney(raw,pack);({completed,items,engagement}=journeyLearning(pack,snapshot));}
 else if(kind==='classic'&&['quiz-v1','sports-v1','novel-v1','merge-v1'].includes(pack.template)){
  snapshot=validateExtendedState(raw,pack);const v=extendedView(pack,snapshot);completed=v.phase==='complete';if(v.attempts)items=pack.questions.flatMap((q,i)=>v.attempts[i].length?[{key:`question-${i}`,sourceRefs:q.sourceRefs,attempts:v.attempts[i].length,correct:v.attempts[i].includes(q.solution),assisted:false}]:[]);else if(v.journal)items=v.journal.map(j=>({key:`scene-${j.node}`,sourceRefs:pack.nodes[j.node].sourceRefs,attempts:0,correct:null,assisted:false}));else items=v.discovered.map(i=>({key:`recipe-${i}`,sourceRefs:pack.recipes[i].sourceRefs,attempts:0,correct:null,assisted:false}));engagement=items.length;
 }else if(kind==='classic'&&pack.template==='draft-v1'){
  snapshot=validateDraftState(raw,pack);completed=draftPhase(snapshot)==='complete';engagement=snapshot.picks.length;items=pack.scenarios.flatMap((q,i)=>snapshot.reflections[i].length?[{key:q.id,sourceRefs:q.sourceRefs,attempts:snapshot.reflections[i].length,correct:snapshot.reflections[i].includes(q.solution),assisted:false}]:[]);
 }else if(kind==='classic'&&pack.template==='adventure-v1'){
  snapshot=validateAdventureSave(raw,pack);need(snapshot,'Invalid adventure save.');completed=snapshot.completed;engagement=snapshot.visited.length;items=snapshot.attempts?[{key:'sequence',sourceRefs:pack.sequence.sourceRefs,attempts:snapshot.attempts,correct:snapshot.solved,assisted:snapshot.hints.includes('sequence')}]:[];
 }else if(kind==='classic'&&pack.template==='town-v1'){
  const state=restoreTown(raw,pack);snapshot=encodeTown(pack,state);completed=state.status!=='playing';engagement=state.month;items=state.decisions.map(d=>({key:`council-${d.event}`,sourceRefs:pack.events[d.event].choices[d.choice].sourceRefs,attempts:0,correct:null,assisted:false}));
 }else throw Error('This game does not yet support a shared practice record.');
 const observations=items.map(i=>({...i,sources:i.sourceRefs.map(id=>pack.sources.find(s=>s.id===id)).filter(Boolean).map(s=>({key:sourceIdentity(s),title:s.title,locator:s.locator}))}));
 return {snapshot,summary:{packId:pack.id,title:pack.title,template:pack.template,contentHash:draftHash(pack),kind,completed,engagement,observations}};
}
export function recommendations(packs,records,profile,now=Date.now()){
 const recent=records.filter(validPracticeRecord).sort((a,b)=>b.updated-a.updated);
 const suggestions=[];
 for(const pack of packs){
  const record=recent.find(r=>r.summary.packId===pack.id&&r.summary.contentHash===draftHash(pack));
  const preferred=profile.formats.includes(pack.template)?2:0;
  if(record&&!record.summary.completed&&record.summary.engagement>0){suggestions.push({id:pack.id,kind:record.summary.kind,score:100+preferred,reason:'Continue the journey you started.',label:'Continue'});continue;}
  const needsPractice=record?.summary.observations.some(o=>o.correct===false||o.correct===true&&(o.attempts>1||o.assisted));
  if(needsPractice){suggestions.push({id:pack.id,kind:record.summary.kind,score:80+preferred,reason:'Some questions needed feedback or a lens. Revisit their sources, then try a fresh run.',label:'Revisit with support'});continue;}
  const hashes=new Set(pack.sources.map(sourceIdentity));
  const related=recent.find(r=>r.summary.packId!==pack.id&&r.summary.observations.some(o=>o.sources.some(s=>hashes.has(s.key))));
  if(!record&&related){suggestions.push({id:pack.id,kind:'journey',score:60+preferred,reason:`Uses reviewed passages also explored in ${related.summary.title}. Coverage may differ; choose it to try another activity.`,label:'Try another approach'});continue;}
  if(record?.summary.completed&&now-record.updated>=3*86400000)suggestions.push({id:pack.id,kind:record.summary.kind,score:40+preferred,reason:'It has been at least three days since this run. A fresh attempt is available if you want to revisit it.',label:'Return to this topic'});
  else if(!record&&preferred)suggestions.push({id:pack.id,kind:'journey',score:20+preferred,reason:'Matches one of your selected game formats.',label:'A format you enjoy'});
 }
 return suggestions.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)).slice(0,3);
}
