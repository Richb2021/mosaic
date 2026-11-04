import {validateSupport,supportAction,hasSupport} from './support-model.js';
import {draftHash} from '../game-modes/draft-engine.js';
import {normaliseProfile,validPracticeRecord} from '../game-modes/learning-model.js';
import {learningActivities} from '../learning-map.js';

const need=(ok,message)=>{if(!ok)throw Error(message)};
export const emptyStudio=()=>({schemaVersion:1,active:null,units:[]});
export const unitKey=p=>`${p.id}:${draftHash(p)}`;
export const contentOf=p=>p.chapter||p;
export const activitiesOf=p=>learningActivities(contentOf(p));
export const formatName=t=>({'underlight-v1':'Role-playing adventure','adventure-v1':'2D adventure','draft-v1':'Subject draft','town-v1':'Town simulation','economy-v1':'Economic strategy campaign','novel-v1':'Visual novel','quiz-v1':'Quiz expedition','sports-v1':'Football tactics','merge-v1':'Merge & crafting'}[t]||'Learning game');
export function questionsOf(pack,keys){
 const p=contentOf(pack),list=p.questions?.map((q,i)=>({...q,key:`question-${i}`,options:q.options.map(o=>typeof o==='string'?o:o.label)}))||p.scenarios?.map(q=>({...q,prompt:q.question,key:q.id}))||[];
 return list.filter(q=>!keys||keys.includes(q.key));
}
export function newUnit(pack,profile,keys,now=Date.now()){
 const activities=activitiesOf(pack);need(Array.isArray(keys)&&keys.length>0&&keys.length<=32&&new Set(keys).size===keys.length&&keys.every(k=>activities.some(a=>a.key===k)),'Select available activities to focus on.');
 return {id:unitKey(pack),packId:pack.id,contentHash:draftHash(pack),activityKeys:[...keys],profile:normaliseProfile(profile),created:now,updated:now,answers:[],practice:[],reflection:'',read:false,diagnosticSkipped:false,support:[]};
}
export function validateUnit(unit,pack){
 need(unit&&unit.id===unitKey(pack)&&unit.packId===pack.id&&unit.contentHash===draftHash(pack),'This programme belongs to a different content version.');
 const clean=newUnit(pack,unit.profile,unit.activityKeys,unit.created),qs=questionsOf(pack,clean.activityKeys);
 need(Number.isFinite(unit.created)&&unit.created>=0&&Number.isFinite(unit.updated)&&unit.updated>=unit.created,'Invalid programme date.');
 const answers=(rows,max)=>{need(Array.isArray(rows)&&rows.length<=max,'Too many practice answers.');return rows.map(a=>{const q=qs.find(q=>q.key===a?.key);need(q&&(a.answer===null||Number.isInteger(a.answer)&&a.answer>=0&&a.answer<q.options.length)&&['not-sure','tentative','confident'].includes(a.confidence),'Invalid starting answer.');need(a.assisted===undefined||typeof a.assisted==='boolean','Invalid assistance marker.');return {key:q.key,answer:a.answer,confidence:a.confidence,assisted:a.assisted===true};});};
 clean.answers=answers(unit.answers,3);need(new Set(clean.answers.map(a=>a.key)).size===clean.answers.length&&clean.answers.every(a=>qs.slice(0,3).some(q=>q.key===a.key)),'Invalid starting check.');
 clean.support=validateSupport(unit.support||[],pack,activitiesOf(pack).map(a=>a.key));clean.practice=answers(unit.practice,80);need(typeof unit.reflection==='string'&&unit.reflection.length<=2000,'Keep the reflection under 2,000 characters.');
 need(typeof unit.read==='boolean'&&typeof unit.diagnosticSkipped==='boolean','Invalid programme progress.');
 return {...clean,updated:unit.updated,reflection:unit.reflection,read:unit.read,diagnosticSkipped:unit.diagnosticSkipped};
}
export function applyUnitAction(unit,pack,action,now=Date.now()){
 const u=validateUnit(unit,pack),qs=questionsOf(pack,u.activityKeys);need(action&&typeof action==='object'&&typeof action.type==='string','Choose a programme action.');
 if(action.type==='answer'||action.type==='practice'){
  const q=qs.find(q=>q.key===action.key);need(q,'That question is outside this programme.');
  if(action.type==='answer'){need(!u.diagnosticSkipped&&qs.slice(0,3).includes(q)&&!u.answers.some(a=>a.key===q.key),'This starting answer is already recorded. Use practice for another attempt.');u.answers.push({key:q.key,answer:action.answer,confidence:action.confidence,assisted:hasSupport(u.support.find(s=>s.key===q.key))});}
  else u.practice.push({key:q.key,answer:action.answer,confidence:action.confidence,assisted:hasSupport(u.support.find(s=>s.key===q.key))});
 }else if(action.type.startsWith('support-'))u.support=supportAction(u.support,pack,activitiesOf(pack).map(a=>a.key),action,Math.max(now,u.created));
 else if(action.type==='skip')u.diagnosticSkipped=true;
 else if(action.type==='read')u.read=true;
 else if(action.type==='reflect')u.reflection=action.text;
 else if(action.type==='replan')u.profile=normaliseProfile(action.profile);
 else throw Error('Unknown programme action.');
 u.updated=Math.max(now,u.created);return validateUnit(u,pack);
}
export function answerResult(pack,answer){const q=questionsOf(pack).find(q=>q.key===answer.key);if(!q)return null;return {key:q.key,prompt:q.prompt,answer:answer.answer,correct:answer.answer===null?null:answer.answer===q.solution,confidence:answer.confidence,assisted:answer.assisted===true,explanation:answer.answer===null?'Not sure yet. Start with the source and an explanation; this is not an incorrect claim.':q.explanation,sourceRefs:q.sourceRefs};}
export function makeProgramme(pack,unit,records=[],now=Date.now()){
 const u=validateUnit(unit,pack),p=u.profile,qs=questionsOf(pack,u.activityKeys),answers=u.answers.map(a=>answerResult(pack,a));
 const unresolved=answers.filter(a=>a.correct!==true||a.confidence!=='confident'||a.assisted),diagnosticComplete=u.diagnosticSkipped||!qs.length||answers.length===Math.min(3,qs.length);
 const recordsForPack=records.filter(validPracticeRecord).filter(r=>r.summary.packId===pack.id&&r.summary.contentHash===draftHash(pack)),observations=recordsForPack.flatMap(r=>r.summary.observations).filter(o=>u.activityKeys.includes(o.key));
 const supported=u.support.some(s=>u.activityKeys.includes(s.key)&&hasSupport(s))||observations.some(o=>o.correct===false||o.correct===true&&(o.attempts>1||o.assisted));
 const beginner=['Not sure yet','Starting out','Building confidence'].includes(p.level),textRoute=p.access.textFirst||p.access.reducedMotion;
 const independent=diagnosticComplete&&answers.length>0&&unresolved.length===0&&!supported;
 const route=independent&&!textRoute?'Apply and explain':unresolved.length||supported||beginner?'Build with support':'Explore and connect';
 const focus=activitiesOf(pack).filter(a=>u.activityKeys.includes(a.key)),refs=[...new Set(focus.flatMap(a=>a.sourceRefs))];
 const sources=contentOf(pack).sources.filter(s=>refs.includes(s.id));
 const reasons=[qs.length?`${answers.length} starting answers recorded; ${unresolved.length} need support or a confidence check.`:'This activity has no reviewed multiple-choice starting check. Use a source-based reflection.',textRoute?'Your text-first or reduced-motion preference puts reading and untimed practice first. Games remain an optional separate route.':p.formats.includes(pack.template)?`You chose ${formatName(pack.template).toLowerCase()} as a format you enjoy.`:'This route keeps your chosen game available alongside text practice.',`You selected “${p.level.toLowerCase()}”. This changes support, not access or a formal level.`,supported?'Guided support or game feedback has been used. Revisit the source and explain the idea before another attempt.':'Game outcomes are separate from these learning observations. First game attempts do not prove unaided understanding.'];
 const interest=p.interests[0]||null;
 const bridge=interest?`Use ${interest.toLowerCase()} as a setting for an example of one idea from the source. Explain the connection, then say where the comparison stops working.`:'Explain one idea using an everyday example. Check each factual claim against the source.';
 const practiceKeys=qs.slice(3).map(q=>q.key),revisit=recordsForPack.some(r=>now-r.updated>=3*86400000)||now-u.updated>=3*86400000;
 const stages=[{id:'read',title:independent?'Check the source, then stretch the idea':'Read with a clear focus',minutes:Math.min(8,Math.max(3,Math.floor(p.minutes/4))),done:u.read},{id:'practice',title:practiceKeys.some(k=>!u.practice.some(a=>a.key===k))?'Try an unused question':'Practise the reviewed questions',minutes:Math.min(8,Math.max(3,Math.floor(p.minutes/4))),done:u.practice.length>0},{id:'game',title:formatName(pack.template),minutes:null,optional:textRoute||p.minutes===10,done:recordsForPack.some(r=>r.summary.completed)},{id:'reflect',title:'Explain it in your own setting',minutes:3,done:!!u.reflection}];
 if(independent&&!textRoute)stages.splice(0,2,stages[1],stages[0]);
 return {ruleVersion:2,support:u.support,title:route,diagnosticComplete,answers,practice:u.practice.map(a=>answerResult(pack,a)),stages,reasons,bridge,focus,sources,practiceKeys:practiceKeys.length?practiceKeys:qs.map(q=>q.key),revisit,gameRecords:recordsForPack.map(r=>({key:r.key,updated:r.updated,summary:r.summary,pending:!!r.pending,conflict:!!r.conflict})),scope:'Suggestions from a small sample, not a grade or mastery estimate.',timeNote:`Planned for about ${p.minutes} minutes. Games can take longer; save and come back any time.`};
}
export function validateStudioShape(raw){
 need(raw?.schemaVersion===1&&Array.isArray(raw.units)&&raw.units.length<=12&&(raw.active===null||typeof raw.active==='string'),'The programme record could not be read.');
 need(new Set(raw.units.map(u=>u.id)).size===raw.units.length&&(!raw.active||raw.units.some(u=>u.id===raw.active)),'Invalid programme list.');return raw;
}
