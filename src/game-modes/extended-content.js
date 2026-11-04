import {withLearningMap} from '../learning-map.js';
// Text packs configure these four authored games; they never supply executable rules.
export const EXTENDED_IDS=['novel-v1','quiz-v1','sports-v1','merge-v1'];
export const PORTRAITS=['engineer','archivist','captain'];
export const ITEM_ART=['seed','fibre','sapling','spool','tree','cloth','gear','mechanism'];
export const NOVEL_ROUTES=[[1,2],[3,4],[3,4],[5,6],[5,7],[6,7]];
const str=maxLength=>({type:'string',minLength:1,maxLength});
const id={...str(80),pattern:'^[a-z][a-z0-9-]*$'};
const obj=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const arr=(items,n,maxItems=n)=>({type:'array',items,minItems:n,maxItems});
const integer=(minimum,maximum)=>({type:'integer',minimum,maximum});
const refs=arr(id,1,12);
const common={schemaVersion:{type:'integer',enum:[1]},template:str(20),id,topicId:id,revision:integer(1,100000),title:str(100),subtitle:str(120),hook:str(700)};
const question=obj({prompt:str(350),options:arr(obj({label:str(180),feedback:str(450)}),3),solution:integer(0,2),explanation:str(650),sourceRefs:refs});
const debrief=obj({question:str(250),explanation:str(650),sourceRefs:refs});
export const EXTENDED_SCHEMAS={
 'novel-v1':obj({...common,nodes:arr(obj({title:str(80),speaker:{type:'string',enum:PORTRAITS},text:str(900),sourceRefs:refs,choices:arr(obj({label:str(100),consequence:str(500),sourceRefs:refs}),2)}),6),endings:arr(obj({title:str(80),text:str(800),sourceRefs:refs}),2),debrief}),
 'quiz-v1':obj({...common,questions:arr(question,8),debrief}),
 'sports-v1':obj({...common,teamName:str(32),opponentName:str(32),questions:arr(question,6),debrief}),
 'merge-v1':obj({...common,items:arr(obj({name:str(35),description:str(240),sourceRefs:refs}),8),recipes:arr(obj({inputs:arr(integer(0,7),2),explanation:str(500),sourceRefs:refs}),6),orders:arr(obj({title:str(70),item:integer(2,7),quantity:integer(1,2),purpose:str(400),sourceRefs:refs}),3),debrief})
};
for(const [template,schema]of Object.entries(EXTENDED_SCHEMAS))schema.properties.template.enum=[template];
const baseline='Keep source-supported ideas separate from fictional scenery and game scores through what you cite, not with disclaimers in player text. Keep explanations concise and every learning claim cited; story lines can breathe. Never use option letters/positions in explanations: quote the actual concept instead, since answers shuffle. No code, URLs, formulas to execute or asset paths. Every sourceRefs must contain1–12 exact packet IDs. The server supplies original source excerpts. Use factual source material only, and refuse if it cannot support the requested game. Debrief asks for explanation or transfer; never claims mastery.';
export const EXTENDED_PROMPTS={
 'novel-v1':`Write an original branching visual novel (template: Letters from Riverlight; give it a title that fits the story). Exactly6 decision scenes in nodes and2 endings. Fixed route by node index: 0 choices lead to1/2;1 to3/4;2 to3/4;3 to5/ending0;4 to5/ending1;5 toending0/ending1. All paths must make sense, including joins. Each scene has speaker engineer, archivist or captain; text, two consequential choices and immediate consequence text. Choices are legitimate trade-offs, not a hidden right/wrong quiz. Do not claim a character saw a scene that a route may skip. Both endings explore different consequences. Learner reads sources and decides how to act in a fictional riverside community. ${baseline}`,
 'quiz-v1':`Write a standalone untimed eight-question retrieval expedition (template: The Star Archive; give it a title that fits the story). Exactly8 distinct questions, each3 plausible distinct options, integer solution0..2, specific feedback for EACH option, explanation and sources. Six questions establish concepts; last2 apply ideas to fresh supported situations. Wrong answers get feedback and can be retried; first attempts are tracked separately. No factual astronomy needed: observatory is fictional scenery. ${baseline}`,
 'sports-v1':`Write a fictional turn-based football match (template: the Riverlight Cup; the title, teams and characters should fit the story) with exactly6 three-option knowledge questions, one per possession. Provide teamName and opponentName. Each question has one unambiguous correct solution0..2, useful feedback for every option, explanation and citations. Correct first attempt gives one insight token; a corrected answer still starts play. Football uses fixed fictional lanes, stamina, defenders and shooting rules which text cannot change. This is honestly sports-themed retrieval unless sources themselves support a mathematical sports application. Do not pretend the learning topic changes real sporting outcomes. ${baseline}`,
 'merge-v1':`Write a conceptual crafting puzzle (template: The Makers Guild; give it a title that fits the story). It is a conceptual puzzle, NOT a claim about physical or chemical transformation. Exactly8 items indexed0..7. Items0 and1 are unlimited base resources. Exactly6 recipes; recipe indexr produces itemr+2 from exactly TWO item indices both STRICTLY LESS than r+2 (repeats allowed). This guarantees every item can be made. Exactly3 delivery orders, each targetitem2..7 quantity1or2. All8 items need distinct names and source-supported descriptions. Artwork is symbolic and fixed:0seed,1fibre,2sapling,3spool,4tree,5cloth,6gear,7mechanism. Names may be knowledge concepts; explain that symbols represent concepts. Recipes must express a meaningful supported conceptual connection, and explicitly describe abstraction when not a real manufacturing recipe. Do NOT assert that adding equal icons makes scientific/historical facts true. All recipes need explanation/sourceRefs; orders need purpose/sourceRefs. Workbench is4x4, with unlimited base collection, move, combine, recycle, undo and delivery. No scores or crafting costs to invent. ${baseline}`
};
export function validateExtendedContent(raw){
 const need=(v,m)=>{if(!v)throw Error(m)};
 const safe=v=>typeof v==='string'&&/^[a-z][a-z0-9-]{0,79}$/.test(v);
 const text=(v,n,label,trim=true)=>{need(typeof v==='string'&&v.trim().length&&v.length<=n,`Invalid ${label}.`);return trim?v.trim():v};
 const list=(v,n,label)=>{need(Array.isArray(v)&&v.length===n,`Provide exactly ${n} ${label}.`);return v};
 need(raw&&raw.schemaVersion===1&&EXTENDED_IDS.includes(raw.template)&&safe(raw.id)&&safe(raw.topicId)&&Number.isInteger(raw.revision)&&raw.revision>=1&&raw.revision<=100000,'Invalid game identity.');
 need(Array.isArray(raw.sources)&&raw.sources.length>=1&&raw.sources.length<=12,'Provide reviewed source passages.');
 const sources=raw.sources.map(s=>{need(s&&safe(s.id),'Invalid source identity.');return {id:s.id,title:text(s.title,160,'source title',false),locator:text(s.locator,240,'source locator',false),excerpt:text(s.excerpt,3000,'source excerpt',false)}});
 const sourceIds=new Set(sources.map(s=>s.id));need(sourceIds.size===sources.length,'Duplicate source identity.');
 const sourceRefs=v=>{need(Array.isArray(v)&&v.length>=1&&v.length<=12&&v.every(x=>sourceIds.has(x)),'Every learning passage needs valid source references.');return [...new Set(v)]};
 const distinct=(v,label)=>need(new Set(v.map(x=>x.trim().toLowerCase())).size===v.length,`${label} must be distinct.`);
 const clean={schemaVersion:1,template:raw.template,id:raw.id,topicId:raw.topicId,revision:raw.revision,title:text(raw.title,100,'title'),subtitle:text(raw.subtitle,120,'subtitle'),hook:text(raw.hook,700,'hook')};
 if(raw.template==='novel-v1'){
  clean.nodes=list(raw.nodes,6,'decision scenes').map(n=>{need(n&&PORTRAITS.includes(n.speaker),'Choose a supported speaker.');const choices=list(n.choices,2,'choices').map(c=>({label:text(c?.label,100,'choice'),consequence:text(c?.consequence,500,'consequence'),sourceRefs:sourceRefs(c?.sourceRefs)}));distinct(choices.map(c=>c.label),'Choices');return {title:text(n.title,80,'scene title'),speaker:n.speaker,text:text(n.text,900,'scene'),sourceRefs:sourceRefs(n.sourceRefs),choices}});
  clean.endings=list(raw.endings,2,'endings').map(e=>({title:text(e?.title,80,'ending title'),text:text(e?.text,800,'ending'),sourceRefs:sourceRefs(e?.sourceRefs)}));
 }else if(['quiz-v1','sports-v1'].includes(raw.template)){
  clean.questions=list(raw.questions,raw.template==='quiz-v1'?8:6,'questions').map(q=>{const options=list(q?.options,3,'answer options').map(o=>({label:text(o?.label,180,'answer'),feedback:text(o?.feedback,450,'answer feedback')}));distinct(options.map(o=>o.label),'Answers');need(Number.isInteger(q.solution)&&q.solution>=0&&q.solution<3,'Invalid correct answer.');return {prompt:text(q.prompt,350,'question'),options,solution:q.solution,explanation:text(q.explanation,650,'explanation'),sourceRefs:sourceRefs(q.sourceRefs)}});
  distinct(clean.questions.map(q=>q.prompt),'Questions');
  if(raw.template==='sports-v1'){clean.teamName=text(raw.teamName,32,'team name');clean.opponentName=text(raw.opponentName,32,'opponent name');distinct([clean.teamName,clean.opponentName],'Teams')}
 }else{
  clean.items=list(raw.items,8,'craft items').map(i=>({name:text(i?.name,35,'item name'),description:text(i?.description,240,'item description'),sourceRefs:sourceRefs(i?.sourceRefs)}));distinct(clean.items.map(i=>i.name),'Item names');
  const seen=new Set();
  clean.recipes=list(raw.recipes,6,'recipes').map((r,index)=>{const inputs=list(r?.inputs,2,'recipe ingredients');need(inputs.every(i=>Number.isInteger(i)&&i>=0&&i<index+2),'Recipes must use earlier items so all deliveries are reachable.');const pair=[...inputs].sort((a,b)=>a-b),key=pair.join(',');need(!seen.has(key),'Two recipes cannot use the same ingredients.');seen.add(key);return {inputs:pair,explanation:text(r.explanation,500,'recipe explanation'),sourceRefs:sourceRefs(r.sourceRefs)}});
  clean.orders=list(raw.orders,3,'delivery orders').map(o=>{need(Number.isInteger(o?.item)&&o.item>=2&&o.item<8&&Number.isInteger(o.quantity)&&o.quantity>=1&&o.quantity<=2,'Invalid delivery request.');return {title:text(o.title,70,'order title'),item:o.item,quantity:o.quantity,purpose:text(o.purpose,400,'order purpose'),sourceRefs:sourceRefs(o.sourceRefs)}});
 }
 need(raw.debrief&&typeof raw.debrief==='object','Provide a debrief.');
 clean.debrief={question:text(raw.debrief.question,250,'debrief question'),explanation:text(raw.debrief.explanation,650,'debrief explanation'),sourceRefs:sourceRefs(raw.debrief.sourceRefs)};clean.sources=sources;
 need(new TextEncoder().encode(JSON.stringify(clean)).length<=90000,'Game packs must be under 90 KB.');return withLearningMap(raw,clean);
}
