import {learningActivities} from '../learning-map.js';
const need=(v,m)=>{if(!v)throw Error(m)};
const text=(v,n)=>{need(typeof v==='string'&&v.length<=n,'Keep this explanation within '+n+' characters.');return v.trim()};
export function supportActivity(bundle,key){
 const pack=bundle.chapter||bundle,activity=learningActivities(pack).find(a=>a.key===key);need(activity,'Choose an activity in this reviewed chapter.');
 let item;
 if(pack.questions)item=pack.questions[Number(key.slice(9))];
 else if(pack.template==='underlight-v1')item=pack.challenges[key];
 else if(pack.template==='adventure-v1')item=pack.sequence;
 else if(pack.template==='draft-v1')item=pack.scenarios.find(q=>q.id===key);
 else if(pack.template==='town-v1')item=pack.events[Number(key.slice(8))];
 else if(pack.template==='novel-v1')item=pack.nodes[Number(key.slice(6))];
 else if(pack.template==='merge-v1')item=pack.recipes[Number(key.slice(7))];
 const sources=(pack.sources||[]).filter(s=>activity.sourceRefs.includes(s.id));
 const objective=pack.learningMap?.filter(c=>c.activityKeys.includes(key)).map(c=>c.objective).join(' ')||activity.objective||activity.label;
 // Only reviewed fields are used as subject explanations. Generic prompts ask the
 // learner to inspect evidence; they do not invent a new fact or solution.
 const explanation=item?.explanation||null;
 return {...activity,objective,prompt:item?.question||item?.prompt||(pack.template==='merge-v1'?`Explain the connection between ${item.inputs.map(i=>pack.items[i].name).join(' + ')} and ${activity.label}.`:activity.label),context:pack.template==='novel-v1'?item.text:null,hint:item?.hint||null,explanation,sources,hasEvidence:sources.length>0,scope:pack.template==='town-v1'?'Compare the source-supported trade-offs. Council outcomes and capability values are fictional game rules.':pack.template==='merge-v1'?'Check what the combination represents in this source. Game items are representations, not necessarily real transformations.':pack.template==='novel-v1'?'A story choice can express a value or trade-off. It is not automatically a right-or-wrong answer.':'Use the reviewed source to explain the relationship, not just repeat an answer word.'};
}
export function selectedSupportKey(bundle,key){const activities=learningActivities(bundle.chapter||bundle);return activities.some(a=>a.key===key)?key:activities[0]?.key;}
export function emptySupport(key){return {key,thought:null,skipped:false,clue:false,sourceIds:[],compared:false,teachBack:'',selfCheck:null,updated:0};}
export function validateSupport(rows,bundle,keys){
 need(Array.isArray(rows)&&rows.length<=32&&new Set(rows.map(s=>s?.key)).size===rows.length,'Invalid guided-support record.');
 return rows.map(s=>{need(s&&keys.includes(s.key),'Support must belong to a reviewed chapter activity.');const a=supportActivity(bundle,s.key);
  need(s.thought===null||typeof s.thought==='string'&&s.thought.length<=1200,'Invalid first thought.');
  need(typeof s.skipped==='boolean'&&typeof s.clue==='boolean'&&typeof s.compared==='boolean','Invalid support steps.');
  need(Array.isArray(s.sourceIds)&&s.sourceIds.length<=20&&new Set(s.sourceIds).size===s.sourceIds.length&&s.sourceIds.every(id=>a.sources.some(x=>x.id===id)),'A support passage must belong to this activity.');
  need([null,'revisit','explain-again','ready-to-practise'].includes(s.selfCheck),'Choose an available self-check.');
  need(Number.isFinite(s.updated)&&s.updated>=0,'Invalid support date.');
  need(!(s.skipped&&s.thought!==null),'Choose a first thought or Not sure, not both.');
  need(s.thought===null||!!s.thought.trim(),'Invalid empty first thought.');
  need(!(s.clue||s.sourceIds.length||s.compared||s.teachBack||s.selfCheck)||s.thought!==null||s.skipped,'A support step needs a first thought or Not sure.');
  need(!s.teachBack||s.sourceIds.length>0,'A teach-back needs a supporting passage.');
  need(!s.compared||!!a.explanation&&s.sourceIds.length>0,'Read a supporting passage before comparing the reviewed explanation.');
  need(!s.selfCheck||!!s.teachBack?.trim(),'Write your explanation before a self-check.');
  return {key:s.key,thought:s.thought===null?null:text(s.thought,1200),skipped:s.skipped,clue:s.clue,sourceIds:[...s.sourceIds],compared:s.compared,teachBack:text(s.teachBack,1600),selfCheck:s.selfCheck,updated:s.updated};
 });
}
export const hasSupport=s=>!!s&&(s.clue||s.sourceIds.length>0||s.compared);
export function supportAction(rows,bundle,keys,action,now){
 const clean=validateSupport(rows,bundle,keys),a=supportActivity(bundle,action.key);need(keys.includes(action.key),'This activity is outside this reviewed chapter.');need(a.hasEvidence,'This activity has no reviewed supporting passage. Add and review material before using guided help.');
 const current=clean.find(s=>s.key===action.key)||emptySupport(action.key),next={...current,sourceIds:[...current.sourceIds],updated:now};
 if(action.type==='support-thought'){need(current.thought===null&&!current.skipped,'Your first thought is preserved. Use the teach-back to explain it again.');if(action.skip===true)next.skipped=true;else{next.thought=text(action.text,1200);need(next.thought.length>0,'Write a first thought, or choose Not sure yet.');}}
 else{
  need(current.thought!==null||current.skipped,'Record a first thought or choose Not sure yet before taking support.');
  if(action.type==='support-clue')next.clue=true;
  else if(action.type==='support-source'){need(a.sources.some(s=>s.id===action.sourceId),'Choose a reviewed passage for this activity.');if(!next.sourceIds.includes(action.sourceId))next.sourceIds.push(action.sourceId);}
  else if(action.type==='support-compare'){need(current.sourceIds.length>0&&a.explanation,'Read a passage before comparing with a reviewed explanation.');next.compared=true;}
  else if(action.type==='support-teachback'){need(current.sourceIds.length>0,'Read a passage before explaining the idea again.');next.teachBack=text(action.text,1600);need(next.teachBack.length>0,'Write your explanation before saving it.');next.selfCheck=null;}
  else if(action.type==='support-selfcheck'){need(current.teachBack.length>0&&['revisit','explain-again','ready-to-practise'].includes(action.value),'Write an explanation and choose a self-check.');next.selfCheck=action.value;}
  else throw Error('Unknown guided-support action.');
 }
 return validateSupport([...clean.filter(s=>s.key!==action.key),next],bundle,keys);
}
