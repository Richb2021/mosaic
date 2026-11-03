const need=(ok,message)=>{if(!ok)throw Error(message)};
export const PROGRAMME_FORMATS=['explore','podcast','cartoon','practice'];
export const FORMAT_LABELS={read:'Read the evidence',explore:'Investigate',podcast:'Listen to a story',cartoon:'Watch a story',game:'Apply it in a game',practice:'Check and revisit',reflect:'Make your own connection'};
export const emptyConnected=()=>({schemaVersion:1,formats:['explore','podcast','cartoon','practice'],links:[],media:[]});
export function validateConnected(raw){
 need(raw?.schemaVersion===1&&Array.isArray(raw.formats)&&raw.formats.length<=4&&new Set(raw.formats).size===raw.formats.length&&raw.formats.every(k=>PROGRAMME_FORMATS.includes(k)),'Choose supported programme formats.');
 need(Array.isArray(raw.links)&&raw.links.length<=4&&new Set(raw.links.map(l=>l.kind)).size===raw.links.length,'Choose one reviewed resource of each format.');
 for(const l of raw.links)need(PROGRAMME_FORMATS.includes(l.kind)&&typeof l.id==='string'&&l.id.length<=100&&/^[a-f0-9]{64}$/.test(l.hash),'Choose an exact reviewed resource.');
 need(Array.isArray(raw.media)&&raw.media.length<=40,'Too many saved media reflections.');
 need(new Set(raw.media.map(m=>m.id+':'+m.hash)).size===raw.media.length,'Duplicate media reflection.');
 for(const m of raw.media)need(typeof m.id==='string'&&m.id.length<=100&&/^[a-f0-9]{64}$/.test(m.hash)&&typeof m.used==='boolean'&&typeof m.reflection==='string'&&m.reflection.length<=2000,'Invalid saved media reflection.');
 need(raw.supportChoice===undefined||['suggested','more','less'].includes(raw.supportChoice),'Choose an available support preference.');
 return {schemaVersion:1,formats:[...raw.formats],links:raw.links.map(({id,hash,kind})=>({id,hash,kind})),media:raw.media.map(({id,hash,used,reflection})=>({id,hash,used,reflection})),...(raw.supportChoice?{supportChoice:raw.supportChoice}:{})};
}
export function connectedRoute({unit,base,state,resources,adaptive}){
 state=validateConnected(state);const preferredText=unit.profile.access.textFirst||unit.profile.access.reducedMotion;
 const steps=[{kind:'read',done:unit.read},{kind:'game',done:base.gameRecords.some(r=>r.summary.completed)},{kind:'reflect',done:!!unit.reflection}];
 for(const kind of state.formats){const link=state.links.find(l=>l.kind===kind),r=link&&resources.find(r=>r.id===link.id&&r.hash===link.hash),media=r&&state.media.find(m=>m.id===r.id&&m.hash===r.hash);
  steps.push({kind,resource:r?{id:r.id,hash:r.hash,title:r.title,broaderFocus:!!r.broaderFocus}:null,unavailable:!!link&&!r,done:r?(['podcast','cartoon'].includes(kind)?!!media?.used:!!r.progress?.complete):false,progress:r?.progress||null,reflection:media?.reflection||'',selfReported:['podcast','cartoon'].includes(kind)});
 }
 const due=steps.find(s=>s.kind==='practice'&&s.progress?.due&&!s.progress?.waiting),support=base.answers.some(a=>a.correct!==true||a.assisted||a.confidence!=='confident')||steps.some(s=>s.progress?.needsSupport),beginner=['Not sure yet','Starting out','Building confidence'].includes(unit.profile.level);
 const supportMode=adaptive?.focus[0]?.support;
 const guided=supportMode?['guided','review'].includes(supportMode):support||beginner;
 const order=preferredText?['read','explore','practice','podcast','cartoon','game','reflect']:guided?['read','podcast','cartoon','explore','game','practice','reflect']:['explore','practice','game','read','podcast','cartoon','reflect'];
 steps.sort((a,b)=>order.indexOf(a.kind)-order.indexOf(b.kind));
 const next=due||steps.find(s=>!s.done&&!s.unavailable&&(s.resource||!PROGRAMME_FORMATS.includes(s.kind))&&!s.progress?.waiting)||steps.find(s=>!s.done&&!s.unavailable&&!s.progress?.waiting);
 const reason=due?'A later question is ready. Try it before choosing your next format.':preferredText?'Your text-first or reduced-motion preference puts source reading and untimed investigation first.':adaptive?.focus[0]?adaptive.focus[0].reason:support?'A saved response or use of help suggests another explanation may help. Revisit the evidence, then try applying it.':beginner?'Your chosen starting point puts an explanation before independent application.':'Start by applying the idea, then check the evidence and explain your reasoning.';
 return {steps:steps.map(s=>({...s,title:FORMAT_LABELS[s.kind]})),next:next?.kind||null,reason,support:guided,scope:'This is a suggested sequence from your choices and a small set of observations, not a grade or mastery estimate.',interest:unit.profile.interests.slice(0,2),goal:unit.profile.goal,minutes:unit.profile.minutes};
}
