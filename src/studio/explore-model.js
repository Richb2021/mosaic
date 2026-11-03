// Content may select these authored models; it never supplies executable rules.
export const EXPLORE_TYPES=['simulation','graph','timeline','causal-map','diagram','worked-example','evidence-sort'];
export const ASSESSMENT_TYPES=['short-answer','numeric','worked-solution','rubric'];
export const EXPLORE_LABELS={'simulation':'Experiment','graph':'Graph explorer','timeline':'Timeline','causal-map':'Connections','diagram':'Annotated model','worked-example':'Worked example','evidence-sort':'Evidence sorter'};
const need=(ok,m)=>{if(!ok)throw Object.assign(Error(m),{status:422})};
const only=(v,keys)=>need(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>keys.includes(k)),'Unexpected lesson fields.');
const text=(v,max=800)=>{need(typeof v==='string'&&v.trim()&&v.length<=max,'A lesson passage is missing or too long.');return v.trim()};
const list=(v,min,max)=>{need(Array.isArray(v)&&v.length>=min&&v.length<=max,'The lesson has an invalid number of entries.');return v};
const num=(v,min=-10000,max=10000)=>{need(typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max,'A lesson parameter is outside its supported range.');return v};
const refs=(v,evidence)=>{list(v,1,12);need(new Set(v).size===v.length&&v.every(id=>evidence.some(s=>s.id===id)),'Use exact reviewed source references.');return [...v]};
export const normalAnswer=v=>String(v).normalize('NFKC').toLocaleLowerCase('en').trim().replace(/\s+/g,' ');

export function validateExplore(raw,job){
 only(raw,['schemaVersion','id','kind','title','objective','introduction','investigations','assessment','sources']);
 need(raw.schemaVersion===1&&raw.id===job.id&&raw.kind==='explore','The lesson identity changed.');
 const evidence=job.context.evidence;
 const investigations=list(raw.investigations,2,5).map((b,i)=>{
  only(b,['id','type','title','question','explanation','limitation','sourceRefs','items','links','controls','model','categories']);
  need(b.id==='investigation-'+(i+1)&&EXPLORE_TYPES.includes(b.type),'Choose an authored investigation.');
  const items=list(b.items,2,8).map((v,n)=>{only(v,['label','detail','value','category','sourceRefs']);return {label:text(v.label,100),detail:text(v.detail,700),value:num(v.value),category:num(v.category,0,1),sourceRefs:refs(v.sourceRefs,evidence)}});
  need(new Set(items.map(v=>normalAnswer(v.label))).size===items.length,'Use distinct item labels.');
  const links=list(b.links,0,10).map(l=>{only(l,['from','to','label']);need(Number.isInteger(l.from)&&Number.isInteger(l.to)&&l.from>=0&&l.to>=0&&l.from<items.length&&l.to<items.length&&l.from!==l.to,'A connection refers to an unavailable item.');return {from:l.from,to:l.to,label:text(l.label,160)}});
  const controls=list(b.controls,0,2).map(c=>{only(c,['label','unit','min','max','step','initial']);const min=num(c.min),max=num(c.max);need(max>min,'Control bounds must increase.');const step=num(c.step,0.001,10000);need((max-min)/step<=10000,'The control has too many steps.');return {label:text(c.label,80),unit:text(c.unit,30),min,max,step,initial:num(c.initial,min,max)}});
  const categories=list(b.categories,0,2).map(v=>text(v,80));
  need(['none','balance','linear'].includes(b.model),'Unknown calculation model.');
  if(b.type==='simulation'){need(b.model==='balance'&&controls.length===2,'Experiments use the authored balance model with two controls.');need(controls[0].min>=0&&controls[1].min>=0&&controls[1].max<=100,'Balance needs nonnegative input and a 0–100 percentage.');}
  else if(b.type==='graph')need(b.model==='linear'&&controls.length===2,'Graphs use y = rate × x + initial, with x and rate controls.');
  else need(b.model==='none'&&controls.length===0,'This investigation does not accept calculation controls.');
  if(b.type==='timeline')need(items.every((v,n)=>!n||v.value>=items[n-1].value),'Timeline values must be in chronological order.');
  if(b.type==='causal-map')need(links.length>0,'Connections need at least one labelled relationship.');else need(links.length===0,'Only connection maps use links.');
  if(b.type==='evidence-sort')need(categories.length===2&&categories[0]!==categories[1]&&items.every(v=>Number.isInteger(v.category))&&new Set(items.map(v=>v.category)).size===2,'Sorting needs two distinct, used categories.');else need(categories.length===0,'Categories are only used by the evidence sorter.');
  return {id:b.id,type:b.type,title:text(b.title,120),question:text(b.question,600),explanation:text(b.explanation,1200),limitation:text(b.limitation,500),sourceRefs:refs(b.sourceRefs,evidence),items,links,controls,model:b.model,categories};
 });
 const assessment=list(raw.assessment,3,6).map((q,i)=>{
  only(q,['id','type','prompt','hint','explanation','sourceRefs','accepted','answer','tolerance','unit','steps','criteria']);
  need(q.id==='task-'+(i+1)&&ASSESSMENT_TYPES.includes(q.type),'Choose an authored assessment type.');
  const accepted=[...new Map(list(q.accepted,0,6).map(a=>{const v=text(a,160);return [normalAnswer(v),v]})).values()],steps=list(q.steps,0,5).map(s=>text(s,500)),criteria=list(q.criteria,0,5).map(c=>{only(c,['label','evidence','improve']);return {label:text(c.label,120),evidence:text(c.evidence,600),improve:text(c.improve,600)}});
  const answer=num(q.answer,-100000000,100000000),tolerance=num(q.tolerance,0,1000);need(typeof q.unit==='string'&&q.unit.length<=30,'Use a short answer unit.');
  if(q.type==='short-answer')need(accepted.length>0&&new Set(accepted.map(normalAnswer)).size===accepted.length,'A short answer needs distinct reviewed accepted alternatives.');else need(!accepted.length,'Only short answers use accepted text alternatives.');
  if(q.type==='rubric')need(criteria.length>=2&&!steps.length,'Extended responses need at least two review criteria.');else need(!criteria.length,'Only extended responses use rubric criteria.');
  if(q.type==='worked-solution')need(steps.length>=2,'Worked solutions need at least two reviewed steps.');else need(!steps.length,'Only worked solutions use steps.');
  if(!['numeric','worked-solution'].includes(q.type))need(answer===0&&tolerance===0&&!q.unit,'Text tasks cannot carry a numeric answer.');
  return {id:q.id,type:q.type,prompt:text(q.prompt,1000),hint:text(q.hint,500),explanation:text(q.explanation,1400),sourceRefs:refs(q.sourceRefs,evidence),accepted,answer,tolerance,unit:q.unit.trim(),steps,criteria};
 });
 need(new Set(assessment.map(q=>q.type)).size>=2,'Use at least two suitable assessment types.');
 const used=new Set([...investigations.flatMap(b=>[...b.sourceRefs,...b.items.flatMap(i=>i.sourceRefs)]),...assessment.flatMap(q=>q.sourceRefs)]),sources=evidence.filter(s=>used.has(s.id));
 if(raw.sources!==undefined)need(JSON.stringify(raw.sources)===JSON.stringify(sources),'Canonical source passages cannot be changed.');
 const lesson={schemaVersion:1,id:job.id,kind:'explore',title:text(raw.title,120),objective:text(raw.objective,400),introduction:text(raw.introduction,900),investigations,assessment,sources};
 need(new TextEncoder().encode(JSON.stringify(lesson)).length<=24000,'Keep this reviewed lesson under 24 KB, including sources. Choose a smaller focus.');
 return lesson;
}
const s={type:'string'},n={type:'number'},a=items=>({type:'array',items}),o=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
export function exploreSchema(job){
 const r=a({type:'string',enum:job.context.evidence.map(s=>s.id)});
 return o({schemaVersion:{type:'integer',enum:[1]},id:{type:'string',enum:[job.id]},kind:{type:'string',enum:['explore']},title:s,objective:s,introduction:s,investigations:a(o({id:s,type:{type:'string',enum:EXPLORE_TYPES},title:s,question:s,explanation:s,limitation:s,sourceRefs:r,items:a(o({label:s,detail:s,value:n,category:{type:'integer'},sourceRefs:r})),links:a(o({from:{type:'integer'},to:{type:'integer'},label:s})),controls:a(o({label:s,unit:s,min:n,max:n,step:n,initial:n})),model:{type:'string',enum:['none','balance','linear']},categories:a(s)})),assessment:a(o({id:s,type:{type:'string',enum:ASSESSMENT_TYPES},prompt:s,hint:s,explanation:s,sourceRefs:r,accepted:a(s),answer:n,tolerance:n,unit:s,steps:a(s),criteria:a(o({label:s,evidence:s,improve:s}))}))});
}
export const EXPLORE_BRIEF=`Create a source-grounded Explore lesson and richer formative assessment, kind explore schemaVersion 1. Adapt vocabulary, scaffolding and fictional examples to learner level, interests and focus. Never invent historical or scientific facts. 2–5 investigations with consecutive investigation-1 IDs. Choose only suitable types: timeline, causal-map, diagram, worked-example, evidence-sort, simulation, graph. Every investigation has title, question (prediction), explanation, limitation, sourceRefs; 2–8 items (distinct label, detail, numeric value, category 0 or 1, sourceRefs); links, controls, categories always arrays. Keep irrelevant arrays empty and model none. Timeline: items sorted by value (year/order); all facts source-supported. Causal-map: links with zero-based from/to indices and meaningful labels. Describe relationships by labels, never assumed on-screen left/right positions. Diagram: labelled concept parts; renderer chooses layout, never anatomy or invented geometry. Worked-example: ordered steps in items. Evidence-sort: exactly two category labels and items assigned 0/1 with both categories used. Simulation: ONLY balance model output=input*percent/100, remainder=input-output; two controls input and percentage (0..100), items label output and remainder with values 0, no links/categories. Graph: ONLY linear model y=rate*x+initial; controls x then rate; initial is first item.value; label the variables and units accurately and state simplification. Do not force quantitative models onto qualitative sources. Controls need label, unit, finite min<max, positive step, initial within bounds; keep numbers within +/-10000. Every non-sorting item category is 0. Then 3–6 tasks, consecutive task-1 IDs, at least two appropriate types. short-answer: accepted array of 1–6 exact concise alternatives (not essays), answer=0 tolerance=0 unit='', steps=[], criteria=[]. numeric: reviewed finite answer and absolute tolerance, unit, accepted=[], steps=[], criteria=[]. worked-solution: numeric final answer plus 2–5 reviewed steps, not an essay. rubric: open response with 2–5 criteria {label,evidence,improve}; evidence describes what learner reasoning should demonstrate, improve is actionable feedback; no grade. Rubric has accepted=[],answer=0,tolerance=0,unit='',steps=[]. Every task has prompt, hint, substantive explanation and sourceRefs. Numeric parsing is strict and units are entered separately; put the exact unit expected in unit. Keep the complete JSON under 18000 characters excluding canonical sources. All subject claims must be supported; fictional quantities may be used to practise source-supported rules. No executable code, external URLs, answer-copying essays, scores or mastery claims.`;

export function modelResult(block,values){
 need(values.length===block.controls.length,'Use the investigation controls.');
 values.forEach((v,i)=>num(v,block.controls[i].min,block.controls[i].max));
 if(block.model==='balance')return {output:values[0]*values[1]/100,remainder:values[0]*(1-values[1]/100)};
 if(block.model==='linear')return {output:values[0]*values[1]+block.items[0].value};
 return null;
}
export function checkResponse(q,response,unit=''){
 if(q.type==='rubric')return {status:'human-review',correct:null};
 if(q.type==='short-answer')return {status:q.accepted.some(a=>normalAnswer(a)===normalAnswer(response))?'matched':'compare',correct:q.accepted.some(a=>normalAnswer(a)===normalAnswer(response))};
 const clean=response.trim();if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(clean))return {status:'invalid-number',correct:false};
 if(normalAnswer(unit)!==normalAnswer(q.unit))return {status:'check-unit',correct:false};
 const correct=Math.abs(Number(clean)-q.answer)<=q.tolerance+Number.EPSILON*Math.max(1,Math.abs(q.answer))*4;
 return {status:correct?(q.type==='worked-solution'?'result-matched':'matched'):'compare',correct};
}
export const emptyExplore=(lesson,hash)=>({schemaVersion:1,lessonId:lesson.id,hash,investigations:[],answers:[],help:[],reflection:''});
export function validateExploreState(lesson,hash,state){
 only(state,['schemaVersion','lessonId','hash','investigations','answers','help','reflection']);
 need(state.schemaVersion===1&&state.lessonId===lesson.id&&state.hash===hash,'This learning record belongs to another lesson version.');
 list(state.investigations,0,lesson.investigations.length);list(state.answers,0,lesson.assessment.length);list(state.help,0,lesson.assessment.length);
 need(new Set(state.investigations.map(v=>v.id)).size===state.investigations.length&&new Set(state.answers.map(v=>v.id)).size===state.answers.length&&new Set(state.help).size===state.help.length,'Duplicate saved responses.');
 for(const v of state.investigations){only(v,['id','prediction','observed','values','sort','at']);const b=lesson.investigations.find(b=>b.id===v.id);need(b,'Unknown investigation.');text(v.prediction,1200);text(v.observed,1600);num(v.at,0,1e14);need(Array.isArray(v.values)&&v.values.length===b.controls.length,'Invalid experiment values.');if(b.controls.length)modelResult(b,v.values);need(Array.isArray(v.sort)&&(b.type==='evidence-sort'?v.sort.length===b.items.length&&v.sort.every(n=>n===0||n===1):v.sort.length===0),'Invalid saved classification.');}
 for(const v of state.answers){only(v,['id','response','unit','working','confidence','assisted','at','criteria']);const q=lesson.assessment.find(q=>q.id===v.id);need(q,'Unknown assessment.');text(v.response,4000);if(['numeric','worked-solution'].includes(q.type))need(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(v.response.trim())&&Number.isFinite(Number(v.response)),'Enter a finite decimal number, with its unit in the separate field.');need(typeof v.unit==='string'&&v.unit.length<=30&&typeof v.working==='string'&&v.working.length<=3000,'Invalid response.');if(q.type==='worked-solution')text(v.working,3000);if(['numeric','worked-solution'].includes(q.type))need(normalAnswer(v.unit)===normalAnswer(q.unit),'Use the requested unit in its separate field before saving. Your response has not been recorded.');need(['tentative','confident','not-sure'].includes(v.confidence)&&typeof v.assisted==='boolean','Invalid response context.');num(v.at,0,1e14);need(Array.isArray(v.criteria)&&v.criteria.length===q.criteria.length&&v.criteria.every(c=>['not-yet','partly','shown'].includes(c)),'Complete each rubric self-check.');}
 need(state.help.every(id=>lesson.assessment.some(q=>q.id===id))&&typeof state.reflection==='string'&&state.reflection.length<=2000,'Invalid learning record.');return state;
}
export function exploreAction(lesson,state,action,now){
 const next=structuredClone(state);need(action&&typeof action==='object','Choose a lesson action.');
 if(action.type==='investigation'){
  only(action,['type','id','prediction','observed','values','sort']);need(!next.investigations.some(x=>x.id===action.id),'Your first investigation record is already saved.');next.investigations.push({id:action.id,prediction:action.prediction,observed:action.observed,values:action.values,sort:action.sort,at:now});
 }else if(action.type==='help'){only(action,['type','id']);need(lesson.assessment.some(q=>q.id===action.id),'Unknown task.');if(!next.help.includes(action.id))next.help.push(action.id);
 }else if(action.type==='answer'){
  only(action,['type','id','response','unit','working','confidence','criteria']);need(!next.answers.some(x=>x.id===action.id),'Your first response is already saved.');next.answers.push({id:action.id,response:action.response,unit:action.unit,working:action.working,confidence:action.confidence,criteria:action.criteria,assisted:next.help.includes(action.id),at:now});
 }else if(action.type==='reflection'){only(action,['type','text']);next.reflection=action.text;}else need(false,'Unknown lesson action.');
 return validateExploreState(lesson,state.hash,next);
}
export function exploreView(lesson,state){
 return {id:lesson.id,title:lesson.title,objective:lesson.objective,introduction:lesson.introduction,sources:lesson.sources,investigations:lesson.investigations.map(b=>b.type==='evidence-sort'&&!state.investigations.some(r=>r.id===b.id)?{...b,items:b.items.map(({category,detail,value,...v})=>v),explanation:null}:b),assessment:lesson.assessment.map(q=>{
  const response=state.answers.find(a=>a.id===q.id),help=state.help.includes(q.id);
  return {id:q.id,type:q.type,prompt:q.prompt,unit:q.unit,sourceRefs:q.sourceRefs,hint:help?q.hint:null,criteria:q.criteria.map(c=>({label:c.label,evidence:c.evidence,...(response?{improve:c.improve}:{})})),...(response?{explanation:q.explanation,steps:q.steps,accepted:q.accepted,answer:['numeric','worked-solution'].includes(q.type)?q.answer:null,result:checkResponse(q,response.response,response.unit)}:{})};
 }),state,completed:state.investigations.length===lesson.investigations.length&&state.answers.length===lesson.assessment.length};
}
