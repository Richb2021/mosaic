import {draftHash} from './game-modes/draft-engine.js';
import {validateLearningMap,learningActivities} from './learning-map.js';
const water=['Explain evaporation','Explain condensation','Explain infiltration','Recognise frozen water storage','Explain precipitation','Explain transpiration','Explain sublimation','Explain the limits of a water-cycle model'];
const ecology=['Explain how producers make food','Interpret food-web arrow direction','Identify primary consumers','Identify secondary consumers','Explain omnivory','Explain decomposition','Interpret branching food-web relationships','Explain possible effects of removing a food-web organism'];
// Curated maps bind to these exact included editions without altering their save hashes.
const included={
 'riverlight-water-quiz':{hash:'u8w8xw',labels:water,pre:{7:[0,1,2]}},
 'riverlight-web-quiz':{hash:'fjqo59',labels:ecology,pre:{2:[0,1],3:[2],6:[1],7:[6]}},
 'riverlight-ecology-cup':{hash:'1grree5',labels:ecology.slice(0,6),pre:{2:[0,1],3:[2]}},
 'riverlight-fraction-cup':{hash:'hknapn',labels:['Add quarters of the same whole','Add eighths of the same whole','Subtract sixths of the same whole','Add eighths of the same whole','Combine lengths expressed in tenths','Explain a common denominator'],pre:{0:[5],1:[5],2:[5],3:[5],4:[5]}},
 'turning-points-industry':{hash:'18kuy2f',labels:['Explain connections in industrial production','Explain transport’s role in industrial change','Explain why factory conditions required reform','Construct a balanced account of industrial change'],pre:{3:[0,1,2]}},
 'turning-points-living-valley':{hash:'g0zvgh',labels:['Explain a food web’s energy base','Explain how vegetation affects water movement','Explain connected habitats','Explain deadwood’s ecological role'],pre:{2:[0]}}
};
export function conceptsFor(pack){
 if(pack.learningMap)return validateLearningMap(pack.learningMap,pack);
 const spec=included[pack.id];if(!spec||draftHash(pack)!==spec.hash)return [];
 return validateLearningMap(learningActivities(pack).map((a,i)=>({id:`concept-${i+1}`,objective:spec.labels[i],activityKeys:[a.key],sourceRefs:a.sourceRefs,prerequisites:(spec.pre[i]||[]).map(k=>`concept-${k+1}`)})),pack);
}
const sourceKey=s=>draftHash([s.title.trim(),s.locator.trim(),s.excerpt.trim()]);
export const conceptIdentity=(concept,pack)=>draftHash([concept.objective.trim().toLowerCase(),concept.sourceRefs.map(id=>sourceKey(pack.sources.find(s=>s.id===id))).sort()]);
export function conceptTrail(packs,records,now=Date.now()){
 const groups=new Map(),maps=new Map();
 for(const pack of packs){let map;try{map=conceptsFor(pack)}catch{continue}maps.set(pack.id,map);for(const c of map){const key=conceptIdentity(c,pack),group=groups.get(key)||{key,objective:c.objective,activities:[],sources:c.sourceRefs.map(id=>pack.sources.find(s=>s.id===id)),preKeys:new Set(),observations:[]};
   for(const id of c.prerequisites)group.preKeys.add(conceptIdentity(map.find(n=>n.id===id),pack));
   const candidates=records.filter(r=>r?.summary?.packId===pack.id&&r.summary.contentHash===draftHash(pack)&&r.summary.kind!=='rpg'&&Array.isArray(r.summary.observations)&&Number.isFinite(r.updated)).sort((a,b)=>b.updated-a.updated),record=candidates[0];
   for(const activity of c.activityKeys){const info=learningActivities(pack).find(a=>a.key===activity);group.activities.push({packId:pack.id,title:pack.title,template:pack.template,key:activity,label:info.label,kind:record?.summary.kind||(['quiz-v1','sports-v1','novel-v1','merge-v1'].includes(pack.template)?'journey':'classic')});const o=record?.summary.observations.find(o=>o.key===activity);if(o)group.observations.push({...o,updated:record.updated});}
   groups.set(key,group);
 }}
 const result=[...groups.values()].map(g=>{const attempts=g.observations.filter(o=>o.correct!==null),support=attempts.some(o=>o.correct===false||o.assisted||o.attempts>1),last=Math.max(0,...g.observations.map(o=>o.updated)),due=attempts.length>0&&now-last>=3*86400000;return {...g,preKeys:[...g.preKeys],status:support?'support':due?'due':attempts.length?'practised':g.observations.length?'explored':'new',last,reason:support?'A mapped question needed feedback, another attempt or a hint. Review its evidence before trying again.':due?'At least three days have passed since the last saved run. A fresh recall attempt is available.':attempts.length?'A response was recorded in a mapped activity. This is practice evidence, not a mastery judgement.':g.observations.length?'This concept was explored through a choice or crafting activity. There has been no correctness check.':'No attempt has been recorded for these mapped activities.'};});
 return result.map(g=>({...g,preparation:g.preKeys.map(k=>result.find(n=>n.key===k)).filter(n=>n&&['new','support'].includes(n.status)).map(n=>({key:n.key,objective:n.objective}))})).sort((a,b)=>({support:0,due:1,new:2,explored:3,practised:4}[a.status]-{support:0,due:1,new:2,explored:3,practised:4}[b.status])||a.objective.localeCompare(b.objective));
}
export const CONCEPT_STATUS={support:'Revisit with support',due:'Ready for a revisit',new:'Not tried yet',explored:'Explored through play',practised:'Practice recorded'};
