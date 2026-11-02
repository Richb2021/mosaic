// A course plan proposes a route. It is never a grade, prerequisite lock or
// claim of curriculum coverage. Citations always come from the saved packet.
import {unitKey} from './programme.js';
export const PLAN_TEMPLATES=['underlight-v1','adventure-v1','draft-v1','town-v1','quiz-v1','novel-v1','merge-v1','sports-v1'];
const need=(x,m)=>{if(!x)throw Error(m)};
const txt=(v,n)=>{need(typeof v==='string'&&v.trim().length>0&&v.length<=n,'Check the plan text length.');return v.trim()};
const array=(v,max)=>{need(Array.isArray(v)&&v.length<=max,'Too many plan entries.');return v};
export function validateCoursePlan(raw,job){
 need(raw?.schemaVersion===1&&raw.id===job.id,'The course plan identity changed.');
 const seen=new Set(),used=new Set();
 const steps=array(raw.steps,6).map((s,i)=>{
  need(s.id==='objective-'+(i+1),'Keep objective identities in sequence.');
  const topic=job.context.topics.find(t=>t.id===s.topicId);need(topic,'Choose a topic from this course.');
  const prerequisites=array(s.prerequisites,5);need(new Set(prerequisites).size===prerequisites.length&&prerequisites.every(id=>seen.has(id)),'Prerequisites must be different earlier objectives.');
  const sourceRefs=array(s.sourceRefs,12);need(sourceRefs.length&&new Set(sourceRefs).size===sourceRefs.length,'Each objective needs distinct evidence passages.');
  const evidence=sourceRefs.map(id=>{const e=job.context.evidence.find(e=>e.id===id);need(e&&topic.resourceIds.includes(e.resourceId),'An objective cites evidence outside its reviewed topic.');used.add(id);return e});
  need(new Set(evidence.map(e=>e.resourceId)).size<=3&&evidence.reduce((n,e)=>n+e.excerpt.length,0)<=18000,'An objective must fit a chapter packet: three sources and 18,000 characters.');
  need(PLAN_TEMPLATES.includes(s.template),'Choose a supported game format.');seen.add(s.id);
  return {id:s.id,topicId:s.topicId,objective:txt(s.objective,240),rationale:txt(s.rationale,500),template:s.template,prerequisites:[...prerequisites],sourceRefs:[...sourceRefs]};
 });
 const gaps=array(raw.gaps,8).map(x=>txt(x,400));need(steps.length||gaps.length,'Explain missing evidence if no objective is supported.');
 return {schemaVersion:1,id:job.id,title:txt(raw.title,120),summary:txt(raw.summary,600),steps,gaps,sources:job.context.evidence.filter(e=>used.has(e.id)).map(({id,title,locator,excerpt})=>({id,title,locator,excerpt}))};
}
const obj=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false}),str={type:'string'};
export function coursePlanSchema(job){return obj({schemaVersion:{type:'integer',enum:[1]},id:{type:'string',enum:[job.id]},title:str,summary:str,steps:{type:'array',minItems:0,maxItems:6,items:obj({id:{type:'string',enum:[1,2,3,4,5,6].map(i=>'objective-'+i)},topicId:{type:'string',enum:job.context.topics.map(t=>t.id)},objective:str,rationale:str,template:{type:'string',enum:PLAN_TEMPLATES},prerequisites:{type:'array',items:str},sourceRefs:{type:'array',minItems:1,maxItems:12,items:{type:'string',enum:job.context.evidence.map(e=>e.id)}}})},gaps:{type:'array',maxItems:8,items:str}})}
export function coursePlanRoute(plan,links,client,now=Date.now()){
 const rows=plan.steps.map(step=>{
  const link=links.find(l=>l.objectiveId===step.id),item=link&&client.items.find(i=>i.jobId===link.id&&i.sourceHash===link.hash);
  // The UI supplies only current, canonical chapter links. sourceHash is the
  // SHA-256 reviewed draft binding, distinct from the runtime content hash.
  const unit=item&&client.state.units.find(u=>u.id===unitKey(item.pack)),remote=unit&&client.remoteUnits?.find(u=>u.unit.id===unit.id);
  const cycles=unit?[...new Map((client.cycles||[]).filter(c=>c.packId===unit.packId&&c.contentHash===unit.contentHash).sort((a,b)=>(a.updated||0)-(b.updated||0)).map(c=>[c.activityKey,c])).values()]:[];
  const support=cycles.find(c=>c.needsSupport),due=cycles.find(c=>c.stage!=='complete'&&c.dueAt&&c.dueAt<=now),practice=[...new Map((remote?.programme?.practice||[]).map(p=>[p.key,p])).values()];
  const needsSupport=!!support||practice.some(p=>p.correct!==true||p.assisted||p.confidence!=='confident');
  const practised=practice.length>0||cycles.some(c=>c.attempts>0);
  const reason=!item?'Prepare and review an activity for this objective.':support?support.reason:due?'A later practice question is due.':needsSupport?'Your practice suggests returning to an explanation before moving on.':!unit?'Start with the source and a short starting check.':!practised?'Continue the saved programme and try a practice question.':'You have practised this objective. You can revisit it or try the next one.';
  return {step,item,reason,needsSupport,due:!!due,practised,unit};
 });
 const next=rows.find(r=>r.item&&(r.due||r.needsSupport))||rows.find(r=>r.item&&!r.practised)||rows.find(r=>!r.item)||rows[0];
 return {rows,next};
}
