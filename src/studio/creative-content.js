import {supportActivity} from './support-model.js';
import {contentOf,activitiesOf} from './programme.js';

export const CREATIVE_KINDS=['tutor','podcast','cartoon'];
export const SCENES=['observatory','workshop','garden','city'];
export const SPEAKERS=['guide','learner'];
const need=(value,message)=>{if(!value)throw Error(message)};
const text=(value,max,label)=>{need(typeof value==='string'&&value.trim().length>0&&value.length<=max,`${label} must contain 1–${max} characters.`);return value.trim()};
const only=(value,keys)=>{need(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).every(k=>keys.includes(k)),'Unexpected generated fields.');};
export function creativeEvidence(pack,activityKeys){
 const activities=activitiesOf(pack);need(Array.isArray(activityKeys)&&activityKeys.length>0&&activityKeys.length<=8&&new Set(activityKeys).size===activityKeys.length&&activityKeys.every(k=>activities.some(a=>a.key===k)),'Choose up to eight reviewed activities.');
 const refs=[...new Set(activities.filter(a=>activityKeys.includes(a.key)).flatMap(a=>a.sourceRefs))];
 const sources=contentOf(pack).sources.filter(s=>refs.includes(s.id));
 need(sources.length>0&&sources.length<=12&&sources.reduce((n,s)=>n+s.excerpt.length,0)<=18000,'Choose a smaller focus with reviewed source passages.');
 return sources.map(s=>({...s}));
}
export function creativeContext(pack,unit,kind,key){
 need(CREATIVE_KINDS.includes(kind),'Choose a supported learning format.');
 const keys=kind==='tutor'?[key]:unit.activityKeys;
 const evidence=creativeEvidence(pack,keys),profile=unit.profile;
 return {kind,title:pack.title,activities:keys.map(k=>{const a=supportActivity(pack,k);return {key:k,prompt:a.prompt,objective:a.objective,scope:a.scope};}),evidence,learner:{level:profile.level,interests:profile.interests.slice(0,2),focus:profile.struggles.slice(0,500),goal:profile.goal.slice(0,500)}};
}
function references(value,evidence,optional=false){need(Array.isArray(value)&&value.length<=12&&(optional||value.length>0)&&new Set(value).size===value.length&&value.every(id=>evidence.some(s=>s.id===id)),'Every factual passage needs references from this exact source packet.');return [...value];}
export function validateCreative(raw,job){
 const evidence=job.context.evidence;
 if(job.kind==='tutor'){
  only(raw,['status','message','question','sourceRefs','sources']);need(['hint','scaffold','unsupported'].includes(raw.status),'Invalid tutor response type.');
  const refs=references(raw.sourceRefs,evidence,raw.status==='unsupported');need(raw.status!=='unsupported'||refs.length===0,'An unsupported reply cannot claim source support.');
  const sources=evidence.filter(s=>refs.includes(s.id));if(raw.sources!==undefined)need(JSON.stringify(raw.sources)===JSON.stringify(sources),'Citation text cannot be edited or generated.');
  return {status:raw.status,message:text(raw.message,1400,'Tutor reply'),question:text(raw.question,400,'Next question'),sourceRefs:refs,sources};
 }
 only(raw,['schemaVersion','id','kind','title','summary','segments','question','sources']);
 need(raw.schemaVersion===1&&raw.id===job.id&&raw.kind===job.kind,'The generated media identity changed.');
 need(Array.isArray(raw.segments)&&raw.segments.length>=4&&raw.segments.length<=8,'An episode needs four to eight short scenes.');
 const segments=raw.segments.map((s,i)=>{
  only(s,['id','speaker','text','sourceRefs','scene','action']);need(s.id===`segment-${i+1}`,'Scenes must have consecutive identities.');need(SPEAKERS.includes(s.speaker)&&SCENES.includes(s.scene)&&['talk','think','celebrate'].includes(s.action),'Choose a preset presenter, scene and action.');
  return {id:s.id,speaker:s.speaker,text:text(s.text,500,'Spoken passage'),sourceRefs:references(s.sourceRefs,evidence),scene:s.scene,action:s.action};
 });
 need(new Set(segments.map(s=>s.speaker)).size===2,'An episode needs both presenters.');
 only(raw.question,['prompt','answer','sourceRefs']);
 const question={prompt:text(raw.question.prompt,400,'Reflection question'),answer:text(raw.question.answer,800,'Reviewed explanation'),sourceRefs:references(raw.question.sourceRefs,evidence)};
 const refs=new Set([...segments.flatMap(s=>s.sourceRefs),...question.sourceRefs]);
 const sources=evidence.filter(s=>refs.has(s.id)).map(s=>({...s}));
 if(raw.sources!==undefined)need(JSON.stringify(raw.sources)===JSON.stringify(sources),'Citation text cannot be edited or generated.');
 return {schemaVersion:1,id:job.id,kind:job.kind,title:text(raw.title,120,'Episode title'),summary:text(raw.summary,400,'Episode summary'),segments,question,sources};
}
export function integrityResponse(message){
 if(/\b(write|complete|do|finish)\b.{0,40}\b(my|this|the)\s+(essay|assignment|coursework|exam|homework)|\b(just|only)\s+(give|tell).{0,20}\b(answer|solution)|ignore.{0,30}(instruction|source|rule)|system prompt|api.?key/i.test(message))return {status:'scaffold',message:'Let’s build your own answer. Identify the task, choose a supporting passage, and explain the relationship in your words. I can help you plan or examine a step, but I will not write a submission or provide an answer to copy.',question:'Which part have you tried, and which step is uncertain?',sourceRefs:[]};
 return null;
}
const str={type:'string'},arr=items=>({type:'array',items}),obj=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
export function creativeSchema(job){
 const refs=arr({type:'string',enum:job.context.evidence.map(s=>s.id)});
 if(job.kind==='tutor')return obj({status:{type:'string',enum:['hint','scaffold','unsupported']},message:str,question:str,sourceRefs:refs});
 return obj({schemaVersion:{type:'integer',enum:[1]},id:{type:'string',enum:[job.id]},kind:{type:'string',enum:[job.kind]},title:str,summary:str,segments:arr(obj({id:str,speaker:{type:'string',enum:SPEAKERS},text:str,sourceRefs:refs,scene:{type:'string',enum:SCENES},action:{type:'string',enum:['talk','think','celebrate']}})),question:obj({prompt:str,answer:str,sourceRefs:refs})});
}
