import {validateExplore,exploreSchema} from './explore-model.js';
import {STORY_PROPS,PERFORMANCE_MOVES,PROP_INTERACTIONS,validatePerformance,validatePerformances} from '../cartoon-performance.js';
import {validatePractice,practiceSchema,practiceQuality} from './learning-loop.js';
import {supportActivity} from './support-model.js';
import {contentOf,activitiesOf} from './programme.js';
import {storyBrief,validateDirection,STORY_BEATS,STORY_BLOCKING,STORY_SHOTS,STORY_PACES} from '../story-direction.js';

export const CREATIVE_KINDS=['tutor','podcast','cartoon','practice','explore'];
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
export function creativeContext(pack,unit,kind,key,story){
 need(CREATIVE_KINDS.includes(kind),'Choose a supported learning format.');
 need(!['tutor','practice','explore'].includes(kind)||unit.activityKeys.includes(key),'Choose an activity in your programme focus.');
 const keys=['tutor','practice','explore'].includes(kind)?[key]:unit.activityKeys;
 // A practice cycle spreads its four questions across the chosen focus and up to three more programme focuses, while the evidence stays small.
 if(kind==='practice')for(const k of unit.activityKeys){if(keys.length>=4)break;if(keys.includes(k))continue;try{if(creativeEvidence(pack,[...keys,k]).reduce((n,s)=>n+s.excerpt.length,0)<=12000)keys.push(k)}catch{}}
 const evidence=creativeEvidence(pack,keys),profile=unit.profile;
 const brief=story!==undefined&&['podcast','cartoon'].includes(kind)?storyBrief(story,profile.interests):null;
 const interests=brief?.interest?[brief.interest,...profile.interests.filter(i=>i!==brief.interest)].slice(0,2):profile.interests.slice(0,2);
 return {kind,title:pack.title,activities:keys.map(k=>{const a=supportActivity(pack,k);return {key:k,prompt:a.prompt,objective:a.objective,scope:a.scope};}),evidence,learner:{level:profile.level,interests,focus:profile.struggles.slice(0,500),goal:profile.goal.slice(0,500),stage:profile.stage,context:profile.context,exam:profile.exam,minutes:profile.minutes,access:profile.access},...(brief?{story:brief}:{})};
}
// New, edited and approved content also meets the practice quality rules; saved reviewed content is read with validateCreative alone.
export function reviewCreative(raw,job){const content=validateCreative(raw,job);return job.kind==='practice'?practiceQuality(content,job):content}
function references(value,evidence,optional=false){need(Array.isArray(value)&&value.length<=12&&(optional||value.length>0)&&new Set(value).size===value.length&&value.every(id=>evidence.some(s=>s.id===id)),'Every factual passage needs references from this exact source packet.');return [...value];}
export function validateCreative(raw,job){
 const evidence=job.context.evidence;
 if(job.kind==='practice')return validatePractice(raw,job);
 if(job.kind==='explore')return validateExplore(raw,job);
 if(job.kind==='tutor'){
  only(raw,['status','message','question','sourceRefs','sources']);need(['hint','scaffold','unsupported'].includes(raw.status),'Invalid tutor response type.');
  const refs=references(raw.sourceRefs,evidence,raw.status==='unsupported');need(raw.status!=='unsupported'||refs.length===0,'An unsupported reply cannot claim source support.');
  const sources=evidence.filter(s=>refs.includes(s.id));if(raw.sources!==undefined)need(JSON.stringify(raw.sources)===JSON.stringify(sources),'Citation text cannot be edited or generated.');
  return {status:raw.status,message:text(raw.message,1400,'Tutor reply'),question:text(raw.question,400,'Next question'),sourceRefs:refs,sources};
 }
 const narrative=[2,3].includes(job.storyVersion),performed=job.storyVersion===3&&job.kind==='cartoon';
 only(raw,['schemaVersion','id','kind','title','summary','segments','question','sources',...(narrative?['story']:[])]);
 need(raw.schemaVersion===(narrative?job.storyVersion:1)&&raw.id===job.id&&raw.kind===job.kind,'The generated media identity changed.');
 need(Array.isArray(raw.segments)&&raw.segments.length>=(narrative?6:4)&&raw.segments.length<=(narrative?12:8),narrative?'A story needs six to twelve short scenes.':'An episode needs four to eight short scenes.');
 let story;
 if(narrative){
  const brief=storyBrief(job.context.story);// A saved draft carries the requested style and audience; a fresh model answer doesn't. Both are checked again here.
  only(raw.story,['genre','interest','audience','style','premise','want','stakes','obstacle','turn','payoff','learningConnection',...(performed?['prop']:[])]);
  need(raw.story.genre===brief.genre&&raw.story.interest===brief.interest&&(raw.story.style===undefined||raw.story.style===brief.style)&&(raw.story.audience===undefined||raw.story.audience===brief.audience),'The story changed the requested genre or interest.');
  story={...brief,...(performed?{prop:raw.story.prop}:{})};for(const k of ['premise','want','stakes','obstacle','turn','payoff','learningConnection'])story[k]=text(raw.story[k],400,'Story '+k);
 }
 const segments=raw.segments.map((s,i)=>{
  only(s,['id','speaker','text','sourceRefs','scene','action',...(narrative?['beat',...(job.kind==='cartoon'?['direction',...(performed?['performance']:[])]:[])]:[])]);need(s.id===`segment-${i+1}`,'Scenes must have consecutive identities.');need(SPEAKERS.includes(s.speaker)&&SCENES.includes(s.scene)&&['talk','think','celebrate'].includes(s.action),'Choose a preset presenter, scene and action.');
  if(narrative){need(STORY_BEATS.includes(s.beat),'Choose a story beat.');need(typeof s.text==='string'&&!/(?:^|[\r\n]|[.!?]\s+)\s*(?:Mira|Kit|guide|learner)\s*:/i.test(s.text),'Each scene must contain only its designated character’s spoken line, without speaker labels.');}
  return {id:s.id,speaker:s.speaker,text:text(s.text,500,'Spoken passage'),sourceRefs:references(s.sourceRefs,evidence),scene:s.scene,action:s.action,...(narrative?{beat:s.beat,...(job.kind==='cartoon'?{direction:validateDirection(s.direction),...(performed?{performance:validatePerformance(s.performance)}:{})}:{})}:{})};
 });
 if(performed)validatePerformances(segments,story.prop);
 if(narrative){
  need(segments[0].beat==='hook'&&segments.at(-1).beat==='payoff','Begin with a hook and end with a payoff.');
  for(const beat of ['setback','discovery','choice'])need(segments.some(s=>s.beat===beat),'The story needs a '+beat+' beat.');
  need(new Set(segments.map(s=>s.scene)).size>=2,'The story needs at least two settings.');
  if(job.kind==='cartoon')need(new Set(segments.map(s=>s.direction.blocking)).size>=3&&segments.some(s=>['travel-right','travel-left','pursuit','retreat'].includes(s.direction.blocking)),'Stage the story with varied movement, including a journey or pursuit.');
 }
 need(new Set(segments.map(s=>s.speaker)).size===2,'An episode needs both presenters.');
 only(raw.question,['prompt','answer','sourceRefs']);
 const question={prompt:text(raw.question.prompt,400,'Reflection question'),answer:text(raw.question.answer,800,'Reviewed explanation'),sourceRefs:references(raw.question.sourceRefs,evidence)};
 const refs=new Set([...segments.flatMap(s=>s.sourceRefs),...question.sourceRefs]);
 const sources=evidence.filter(s=>refs.has(s.id)).map(s=>({...s}));
 if(raw.sources!==undefined)need(JSON.stringify(raw.sources)===JSON.stringify(sources),'Citation text cannot be edited or generated.');
 return {schemaVersion:narrative?job.storyVersion:1,id:job.id,kind:job.kind,title:text(raw.title,120,'Episode title'),summary:text(raw.summary,400,'Episode summary'),...(story?{story}:{}),segments,question,sources};
}
export function integrityResponse(message){
 if(/\b(write|complete|do|finish)\b.{0,40}\b(my|this|the)\s+(essay|assignment|coursework|exam|homework)|\b(just|only)\s+(give|tell).{0,20}\b(answer|solution)|ignore.{0,30}(instruction|source|rule)|system prompt|api.?key/i.test(message))return {status:'scaffold',message:'Let’s build your own answer. Identify the task, choose a supporting passage, and explain the relationship in your words. I can help you plan or examine a step, but I will not write a submission or provide an answer to copy.',question:'Which part have you tried, and which step is uncertain?',sourceRefs:[]};
 return null;
}
const str={type:'string'},arr=items=>({type:'array',items}),obj=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
export function creativeSchema(job){
 if(job.kind==='practice')return practiceSchema(job);
 if(job.kind==='explore')return exploreSchema(job);
 const refs=arr({type:'string',enum:job.context.evidence.map(s=>s.id)});
 if(job.kind==='tutor')return obj({status:{type:'string',enum:['hint','scaffold','unsupported']},message:str,question:str,sourceRefs:refs});
 if([2,3].includes(job.storyVersion)){
  const performed=job.storyVersion===3&&job.kind==='cartoon';
  const brief=storyBrief(job.context.story);
  return obj({schemaVersion:{type:'integer',enum:[job.storyVersion]},id:{type:'string',enum:[job.id]},kind:{type:'string',enum:[job.kind]},title:str,summary:str,story:obj({genre:{type:'string',enum:[brief.genre]},interest:{type:'string',enum:[brief.interest]},premise:str,want:str,stakes:str,obstacle:str,turn:str,payoff:str,learningConnection:str,...(performed?{prop:{type:'string',enum:STORY_PROPS}}:{})}),segments:arr(obj({id:str,speaker:{type:'string',enum:SPEAKERS},text:str,sourceRefs:refs,scene:{type:'string',enum:SCENES},action:{type:'string',enum:['talk','think','celebrate']},beat:{type:'string',enum:STORY_BEATS},...(job.kind==='cartoon'?{direction:obj({blocking:{type:'string',enum:STORY_BLOCKING},shot:{type:'string',enum:STORY_SHOTS},pace:{type:'string',enum:STORY_PACES}}),...(performed?{performance:obj({actor:{type:'string',enum:SPEAKERS},move:{type:'string',enum:PERFORMANCE_MOVES},interaction:{type:'string',enum:PROP_INTERACTIONS}})}:{})}:{})})),question:obj({prompt:str,answer:str,sourceRefs:refs})});
 }
 return obj({schemaVersion:{type:'integer',enum:[1]},id:{type:'string',enum:[job.id]},kind:{type:'string',enum:[job.kind]},title:str,summary:str,segments:arr(obj({id:str,speaker:{type:'string',enum:SPEAKERS},text:str,sourceRefs:refs,scene:{type:'string',enum:SCENES},action:{type:'string',enum:['talk','think','celebrate']}})),question:obj({prompt:str,answer:str,sourceRefs:refs})});
}
// Saved-episode jobs: only video has artwork; audio-only MP3 never shows a style.
export const MEDIA_STYLES={anime:'Prism anime',paper:'Paper comedy',original:'Field Notes'};
export const mediaJobLabel=r=>r.format==='mp4'?'MP4 · '+(MEDIA_STYLES[r.style]||r.style):'Podcast MP3';
