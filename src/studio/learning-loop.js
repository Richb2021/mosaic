// Authored learning rules. The model supplies reviewed questions, never timings or scores.
export const LOOP_STAGES=['diagnostic','practice','transfer','revisit'];
export const LOOP_LABELS={diagnostic:'Find your starting point',practice:'Practise the relationship',transfer:'Try a different example',revisit:'Return to the idea'};
const need=(ok,message)=>{if(!ok)throw Object.assign(Error(message),{status:400})};
const text=(v,max)=>{need(typeof v==='string'&&v.trim().length>0&&v.length<=max,'A learning passage is missing or too long.');return v.trim()};
const only=(v,keys)=>need(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>keys.includes(k)),'Unexpected practice fields.');
const normal=s=>s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');
export function validatePractice(raw,job){
 only(raw,['schemaVersion','id','kind','title','objective','explanation','sourceRefs','questions','sources']);
 need(raw.schemaVersion===1&&raw.id===job.id&&raw.kind==='practice','The practice identity changed.');
 const evidence=job.context.evidence,refs=v=>{need(Array.isArray(v)&&v.length>0&&v.length<=12&&new Set(v).size===v.length&&v.every(id=>evidence.some(s=>s.id===id)),'Practice needs exact reviewed source references.');return [...v]};
 need(Array.isArray(raw.questions)&&raw.questions.length===4,'Use four fresh questions: starting check, practice, transfer and revisit.');
 const questions=raw.questions.map((q,i)=>{
  only(q,['stage','prompt','options','answer','feedback','hint','sourceRefs']);need(q.stage===LOOP_STAGES[i],'Practice stages must stay in order.');
  need(Array.isArray(q.options)&&q.options.length===3&&new Set(q.options.map(normal)).size===3,'Use three distinct answer choices.');
  need(Number.isInteger(q.answer)&&q.answer>=0&&q.answer<3,'Choose a valid reviewed answer.');
  need(Array.isArray(q.feedback)&&q.feedback.length===3,`Question ${i+1} needs exactly three choice-specific feedback explanations.`);
  return {stage:q.stage,prompt:text(q.prompt,600),options:q.options.map(v=>text(v,240)),answer:q.answer,feedback:q.feedback.map(v=>text(v,700)),hint:text(q.hint,500),sourceRefs:refs(q.sourceRefs)};
 });
 need(new Set(questions.map(q=>normal(q.prompt))).size===4,'Each stage needs a different question.');
 need(!questions.some(q=>job.context.activities.some(a=>normal(a.prompt)===normal(q.prompt))),'Use fresh questions, not the existing game question.');
 const sourceRefs=refs(raw.sourceRefs),ids=new Set([...sourceRefs,...questions.flatMap(q=>q.sourceRefs)]),sources=evidence.filter(s=>ids.has(s.id));
 if(raw.sources!==undefined)need(JSON.stringify(raw.sources)===JSON.stringify(sources),'Practice citation text cannot be changed.');
 return {schemaVersion:1,id:job.id,kind:'practice',title:text(raw.title,120),objective:text(raw.objective,240),explanation:text(raw.explanation,1600),sourceRefs,questions,sources};
}
const str={type:'string'},obj=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
export function practiceSchema(job){const refs={type:'array',items:{type:'string',enum:job.context.evidence.map(s=>s.id)}};return obj({schemaVersion:{type:'integer',enum:[1]},id:{type:'string',enum:[job.id]},kind:{type:'string',enum:['practice']},title:str,objective:str,explanation:str,sourceRefs:refs,questions:{type:'array',minItems:4,maxItems:4,items:obj({stage:{type:'string',enum:LOOP_STAGES},prompt:str,options:{type:'array',minItems:3,maxItems:3,items:str},answer:{type:'integer',minimum:0,maximum:2},feedback:{type:'array',minItems:3,maxItems:3,items:str},hint:str,sourceRefs:refs})}})}
export const PRACTICE_BRIEF='Create a learning cycle for the ONE selected activity and its reviewed evidence. Four different three-choice questions in order: diagnostic, practice, transfer, revisit. Each has stage, prompt <=600, three options <=240, zero-based answer index, three choice-specific corrective feedback explanations <=700 each, hint <=500 and sourceRefs. Use plausible misconceptions as distractors. The practice question tests the same relationship with different wording and quantities; transfer applies it to a genuinely different, explicitly fictional scenario; revisit is a fresh delayed retrieval question. Never repeat a prompt from the game or another stage. Avoid clues to future answers in earlier feedback. Adapt language/scaffolding to the chosen starting point and optional interests; preserve source facts and label fictional examples. Provide title<=120, source-supported objective<=240, a clear substantive explanation<=1600 and sourceRefs. No additional objective beyond the packet. Return schemaVersion=1, kind=practice and the supplied id.';
export const emptyLoop=(bank,hash)=>({schemaVersion:1,bankId:bank.id,bankHash:hash,answers:[],help:[],teachBack:'',gameOpened:false,dueAt:null});
export function validateLoop(bank,hash,state){
 need(state&&state.schemaVersion===1&&state.bankId===bank.id&&state.bankHash===hash,'This saved cycle belongs to another question version.');
 need(Array.isArray(state.answers)&&state.answers.length<=4&&Array.isArray(state.help)&&state.help.length<=8,'The saved learning cycle is invalid.');
 need(state.answers.every((a,i)=>a.stage===LOOP_STAGES[i]&&(a.answer===null||Number.isInteger(a.answer)&&a.answer>=0&&a.answer<3)&&['tentative','confident','not-sure'].includes(a.confidence)&&typeof a.assisted==='boolean'&&Number.isFinite(a.at)&&a.at>=0&&(!i||a.at>=state.answers[i-1].at)),'The saved answers could not be read.');
 need(state.help.every(h=>LOOP_STAGES.includes(h.stage)&&['hint','explanation'].includes(h.kind)&&Number.isFinite(h.at)&&h.at>=0)&&new Set(state.help.map(h=>h.stage+':'+h.kind)).size===state.help.length,'The saved help record could not be read.');
 need(typeof state.teachBack==='string'&&state.teachBack.length<=1600&&typeof state.gameOpened==='boolean','The saved reflection could not be read.');
 const transfer=state.answers.find(a=>a.stage==='transfer'),clean=state.answers.slice(0,3).every(a=>a.answer===bank.questions.find(q=>q.stage===a.stage).answer&&!a.assisted&&a.confidence==='confident');
 need(transfer?state.dueAt===transfer.at+(clean?3:1)*86400000:state.dueAt===null,'The saved review date could not be read.');
 need(!state.answers[3]||state.answers[3].at>=state.dueAt,'The saved later review predates its due time.');
 return state;
}
export function nextLoop(bank,state,now=Date.now()){
 const stage=LOOP_STAGES[state.answers.length];
 if(!stage){const last=state.answers.at(-1),correct=last.answer===bank.questions[3].answer;return {stage:'complete',reason:correct?'You answered the later question correctly. Choose another objective, or a fresh cycle if you want more practice.':'The later answer suggests another explanation and fresh questions would be useful.',needsSupport:!correct,dueAt:null};}
 const last=state.answers.at(-1),previous=last&&bank.questions.find(q=>q.stage===last.stage),needsSupport=!!last&&last.answer!==previous.answer&&!state.help.some(h=>h.stage===stage&&h.kind==='explanation');
 const waiting=stage==='revisit'&&now<state.dueAt;
 return {stage,waiting,needsSupport,dueAt:state.dueAt,reason:waiting?'Your next question is saved for a later visit. Spacing is a simple practice rule, not a prediction of memory.':needsSupport?'Your last answer suggests looking at the explanation before a fresh question.':stage==='diagnostic'?'Start with one question. You can choose Not sure or ask for help.':stage==='practice'?'Try the same relationship in a fresh question.':stage==='transfer'?'Try applying the relationship in a different example.':'Enough time has passed for a fresh question. Earlier answers and help remain visible.'};
}
export function loopAction(bank,state,input,now=Date.now()){
 const next=structuredClone(state),route=nextLoop(bank,state,now),stage=route.stage;
 need(LOOP_STAGES.includes(stage),'This cycle is complete. Choose a fresh reviewed cycle.');
 if(input.type==='game'){next.gameOpened=true;return next;}
 if(input.type==='explain'){need(typeof input.text==='string'&&input.text.trim().length>0&&input.text.length<=1600,'Write a short explanation in your own words.');next.teachBack=input.text.trim();return next;}
 need(input.stage===stage,'Your next step changed. Refresh the learning cycle.');
 if(input.type==='help'){need(['hint','explanation'].includes(input.kind),'Choose a clue or explanation.');if(!next.help.some(h=>h.stage===stage&&h.kind===input.kind))next.help.push({stage,kind:input.kind,at:now});return next;}
 need(input.type==='answer','Choose a supported learning action.');need(!route.waiting,'This later question is not due yet.');need(!route.needsSupport,'Read the reviewed explanation before the next question.');
 need(input.answer===null||Number.isInteger(input.answer)&&input.answer>=0&&input.answer<3,'Choose an answer or Not sure.');need(['tentative','confident','not-sure'].includes(input.confidence),'Choose your confidence.');
 next.answers.push({stage,answer:input.answer,confidence:input.confidence,assisted:state.help.some(h=>h.stage===stage),at:now});
 if(stage==='transfer'){const clean=next.answers.every(a=>a.answer===bank.questions.find(q=>q.stage===a.stage).answer&&!a.assisted&&a.confidence==='confident');next.dueAt=now+(clean?3:1)*86400000;}
 return next;
}
export function loopView(bank,state,now=Date.now()){
 const route=nextLoop(bank,state,now),q=bank.questions.find(q=>q.stage===route.stage),help=state.help.filter(h=>h.stage===route.stage);
 return {state,route,title:bank.title,objective:bank.objective,question:q&&!route.waiting&&!route.needsSupport?{stage:q.stage,prompt:q.prompt,options:q.options,...(help.some(h=>h.kind==='hint')?{hint:q.hint}:{})}:null,explanation:help.some(h=>h.kind==='explanation')||route.stage==='complete'?bank.explanation:null,sources:help.some(h=>h.kind==='explanation')||route.stage==='complete'?bank.sources:[],answers:state.answers.map(a=>{const q=bank.questions.find(q=>q.stage===a.stage);return {...a,prompt:q.prompt,choice:a.answer===null?'Not sure':q.options[a.answer],correct:a.answer===q.answer,feedback:a.answer===null?q.hint:q.feedback[a.answer]}})};
}
