// A creator-reviewed map connects explicit objectives to concrete game activities.
// It never derives subject competence from game scores.
const need=(v,m)=>{if(!v)throw Error(m)};
const id=v=>typeof v==='string'&&/^[a-z][a-z0-9-]{0,79}$/.test(v);
export function learningActivities(p){
 if(p.template==='underlight-v1')return Object.entries(p.challenges).map(([key,q])=>({key,label:q.title,objective:q.objective,sourceRefs:q.sourceRefs}));
 if(p.questions)return p.questions.map((q,i)=>({key:`question-${i}`,label:q.prompt,sourceRefs:q.sourceRefs}));
 if(p.template==='draft-v1')return p.scenarios.map(q=>({key:q.id,label:q.title,sourceRefs:q.sourceRefs}));
 if(p.template==='adventure-v1')return [{key:'sequence',label:p.sequence.title,sourceRefs:p.sequence.sourceRefs},...(p.world?[{key:'field',label:p.world.field.title,sourceRefs:p.world.field.sourceRefs}]:[])];
 if(['town-v1','economy-v1'].includes(p.template))return p.events.map((q,i)=>({key:`council-${i}`,label:q.title,sourceRefs:[...new Set(q.choices.flatMap(c=>c.sourceRefs))]}));
 if(p.template==='merge-v1')return p.recipes.map((q,i)=>({key:`recipe-${i}`,label:p.items[i+2].name,sourceRefs:q.sourceRefs}));
 if(p.template==='novel-v1')return p.nodes.map((q,i)=>({key:`scene-${i}`,label:q.title,sourceRefs:q.sourceRefs}));
 return [];
}
export const LEARNING_MAP_SCHEMA={type:'array',minItems:1,maxItems:8,items:{type:'object',additionalProperties:false,required:['id','objective','activityKeys','sourceRefs','prerequisites'],properties:{id:{type:'string',pattern:'^[a-z][a-z0-9-]{0,79}$'},objective:{type:'string',minLength:1,maxLength:240},activityKeys:{type:'array',minItems:1,maxItems:8,items:{type:'string',maxLength:100}},sourceRefs:{type:'array',minItems:1,maxItems:12,items:{type:'string'}},prerequisites:{type:'array',maxItems:7,items:{type:'string'}}}}};
export function validateLearningMap(map,pack){
 need(Array.isArray(map)&&map.length>0&&map.length<=8,'Use one to eight learning concepts.');const activities=learningActivities(pack),ids=new Set(map.map(n=>n?.id));need(ids.size===map.length,'Concept IDs must be unique.');
 const unique=(v,max)=>Array.isArray(v)&&v.length<=max&&new Set(v).size===v.length;
 const clean=map.map(n=>{
  need(n&&id(n.id)&&typeof n.objective==='string'&&n.objective.trim().length>0&&n.objective.length<=240,'Each concept needs an ID and a clear objective (up to 240 characters).');
  need(unique(n.activityKeys,8)&&n.activityKeys.length>0&&n.activityKeys.every(k=>activities.some(a=>a.key===k)),'Each concept must name existing game activities.');
  need(unique(n.sourceRefs,12)&&n.sourceRefs.length>0&&n.sourceRefs.every(k=>pack.sources.some(s=>s.id===k)),'Concepts must cite this chapter’s reviewed passages.');
  need(n.activityKeys.every(k=>activities.find(a=>a.key===k).sourceRefs.some(ref=>n.sourceRefs.includes(ref))),'A concept and each mapped activity must share supporting evidence.');
  need(unique(n.prerequisites,7)&&n.prerequisites.every(k=>k!==n.id&&ids.has(k)),'Prerequisites must name other concepts in this chapter.');
  return {id:n.id,objective:n.objective.trim(),activityKeys:[...n.activityKeys],sourceRefs:[...n.sourceRefs],prerequisites:[...n.prerequisites]};
 });
 const done=new Set(),visiting=new Set();function visit(n){need(!visiting.has(n.id),'Concept prerequisites cannot form a cycle.');if(done.has(n.id))return;visiting.add(n.id);for(const k of n.prerequisites)visit(clean.find(c=>c.id===k));visiting.delete(n.id);done.add(n.id)}clean.forEach(visit);return clean;
}
export function withLearningMap(raw,clean){if(raw.learningMap!==undefined)clean.learningMap=validateLearningMap(raw.learningMap,clean);return clean;}
export function suggestedLearningMap(pack){return learningActivities(pack).slice(0,8).map((a,i)=>({id:`concept-${i+1}`,objective:(a.objective||a.label).slice(0,240),activityKeys:[a.key],sourceRefs:[...a.sourceRefs],prerequisites:[]}));}
export function learningMapEditor(pack,esc){const map=pack.learningMap||[],activities=learningActivities(pack);return `<details class="review-group learning-map-editor" open><summary>Learning concepts and suggested order</summary><p>Map what each activity actually practises. Check the objective, its supporting passages and any useful preparation. A prerequisite is an optional suggestion; it never locks a game.</p>${map.map((n,i)=>`<section class="concept-editor"><label>Concept ${i+1}<textarea data-concept-objective="${i}" maxlength="240" rows="2">${esc(n.objective)}</textarea></label><fieldset><legend>Activities for this concept</legend>${activities.map(a=>`<label class="workshop-check"><input type="checkbox" data-concept-activity="${i}" value="${esc(a.key)}" ${n.activityKeys.includes(a.key)?'checked':''}>${esc(a.label)}</label>`).join('')}</fieldset><fieldset><legend>Read beforehand (optional)</legend>${map.filter(c=>c.id!==n.id).map(c=>`<label class="workshop-check"><input type="checkbox" data-concept-prerequisite="${i}" value="${esc(c.id)}" ${n.prerequisites.includes(c.id)?'checked':''}>${esc(c.objective)}</label>`).join('')||'<p>No other concepts in this chapter.</p>'}</fieldset><fieldset><legend>Supporting passages</legend>${pack.sources.map(s=>`<label class="workshop-check"><input type="checkbox" data-concept-source="${i}" value="${esc(s.id)}" ${n.sourceRefs.includes(s.id)?'checked':''}>${esc(s.title)} — ${esc(s.locator)}</label>`).join('')}</fieldset></section>`).join('')}${map.length?'<button data-act="resource-map-remove">Remove concept map</button>':'<button data-act="resource-map-add">Prepare an editable concept map</button>'}</details>`;}

export function learningMapReview(pack,esc){return pack.learningMap?`<section class="learning-map-review"><h3>Learning concepts and suggested order</h3><p>Review these objectives and their links to activities and sources. Preparation is optional, never a game lock.</p>${pack.learningMap.map(n=>`<section><h4>${esc(n.objective)}</h4><p>Activities: ${n.activityKeys.map(k=>esc(learningActivities(pack).find(a=>a.key===k).label)).join('; ')}</p>${n.prerequisites.length?`<p>Suggested preparation: ${n.prerequisites.map(k=>esc(pack.learningMap.find(c=>c.id===k).objective)).join('; ')}</p>`:''}<details><summary>Check supporting sources</summary>${n.sourceRefs.map(k=>{const s=pack.sources.find(s=>s.id===k);return `<blockquote>${esc(s.excerpt)}<footer>${esc(s.title)} — ${esc(s.locator)}</footer></blockquote>`}).join('')}</details></section>`).join('')}</section>`:''}
