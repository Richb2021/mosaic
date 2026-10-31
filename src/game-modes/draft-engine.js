const need=(ok,message)=>{if(!ok)throw Error(message)};
export function draftHash(value){let n=2166136261;for(const c of JSON.stringify(value)){n^=c.charCodeAt(0);n=Math.imul(n,16777619)}return (n>>>0).toString(36)}
export const draftSaveKey=pack=>`mosaic:turning-points:${pack.id}@${pack.revision}:${draftHash(pack)}`;
export function newDraft(pack,seed=1){need(Number.isInteger(seed)&&seed>=1&&seed<=4294967295,'Use a seed from 1 to 4294967295.');return {format:1,packId:pack.id,revision:pack.revision,seed,picks:[],redrawRound:-1,scenarioIndex:0,reflections:[[],[],[],[]]}}
export function draftPhase(state){return state.picks.length<5?'draft':state.scenarioIndex<4?'scenario':'complete'}
function random(seed){return()=>{seed=(seed+0x6D2B79F5)>>>0;let t=seed;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296}}
export function draftHand(pack,state,round=state.picks.length){
 if(round<0||round>=5)return [];
 const cards=pack.cards.filter(c=>c.roleId===pack.roles[round].id),rng=random((state.seed+Math.imul(round+1,2654435761))>>>0);
 for(let i=cards.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[cards[i],cards[j]]=[cards[j],cards[i]]}
 return state.redrawRound===round?[cards[0],cards[1],cards[3]]:cards.slice(0,3);
}
export function pickDraftCard(pack,state,id){need(draftPhase(state)==='draft','The draft is already complete.');need(draftHand(pack,state).some(c=>c.id===id),'Choose one of the cards in this hand.');return {...state,picks:[...state.picks,id]}}
export function redrawDraft(pack,state){need(draftPhase(state)==='draft'&&state.redrawRound===-1,'The redraw has already been used.');return {...state,redrawRound:state.picks.length}}
export function draftTotals(pack,state){return state.picks.reduce((out,id)=>{const c=pack.cards.find(c=>c.id===id);return out.map((n,i)=>n+c.scores[i])},[0,0,0])}
export function draftOutcome(pack,state,index){const scenario=pack.scenarios[index],totals=draftTotals(pack,state);return {passed:totals.every((n,i)=>n>=scenario.requirements[i]),totals,requirements:scenario.requirements,shortfalls:totals.map((n,i)=>Math.max(0,scenario.requirements[i]-n))}}
export function answerDraft(pack,state,answer){need(draftPhase(state)==='scenario','No reflection is active.');need(Number.isInteger(answer)&&answer>=0&&answer<3,'Choose one of the three answers.');const index=state.scenarioIndex,attempts=state.reflections[index];need(!attempts.includes(pack.scenarios[index].solution),'This reflection is settled.');need(!attempts.includes(answer),'Try a different answer.');const reflections=state.reflections.map(a=>[...a]);reflections[index].push(answer);return {...state,reflections}}
export function nextDraftScenario(pack,state){need(draftPhase(state)==='scenario'&&state.reflections[state.scenarioIndex].includes(pack.scenarios[state.scenarioIndex].solution),'Reflect on this scenario before continuing.');return {...state,scenarioIndex:state.scenarioIndex+1}}
export function validateDraftState(raw,pack){
 need(raw&&raw.format===1&&raw.packId===pack.id&&raw.revision===pack.revision,'This save belongs to a different draft.');
 const base=newDraft(pack,raw.seed);need(Array.isArray(raw.picks)&&raw.picks.length<=5&&raw.picks.every(x=>typeof x==='string'),'Invalid draft picks.');
 need(Number.isInteger(raw.redrawRound)&&raw.redrawRound>=-1&&raw.redrawRound<=Math.min(raw.picks.length,4),'Invalid redraw record.');
 base.redrawRound=raw.redrawRound;
 for(const id of raw.picks){need(draftHand(pack,base).some(c=>c.id===id),'Saved pick was not in its hand.');base.picks.push(id)}
 need(Number.isInteger(raw.scenarioIndex)&&raw.scenarioIndex>=0&&raw.scenarioIndex<=4,'Invalid scenario progress.');
 need(Array.isArray(raw.reflections)&&raw.reflections.length===4,'Invalid reflection record.');
 for(let i=0;i<4;i++){
  const attempts=raw.reflections[i];need(Array.isArray(attempts)&&attempts.length<=3&&new Set(attempts).size===attempts.length&&attempts.every(n=>Number.isInteger(n)&&n>=0&&n<3),'Invalid reflection attempts.');
  const correctIndex=attempts.indexOf(pack.scenarios[i].solution);need(correctIndex===-1||correctIndex===attempts.length-1,'Invalid answer order.');
  if(i<raw.scenarioIndex)need(correctIndex>=0,'A previous reflection was not completed.');
  if(i>raw.scenarioIndex||raw.picks.length<5)need(attempts.length===0,'Reflection recorded before its scenario.');
  base.reflections[i]=[...attempts];
 }
 if(raw.picks.length<5)need(raw.scenarioIndex===0,'Scenarios need a complete draft.');
 base.scenarioIndex=raw.scenarioIndex;return base;
}
export function loadDraft(storage,pack,seed){const key=draftSaveKey(pack);try{const saved=storage.getItem(key);if(saved===null)return {state:newDraft(pack,seed),notice:''};need(saved.length<12000,'Saved draft was too large.');return {state:validateDraftState(JSON.parse(saved),pack),notice:'Your draft has been restored.'}}catch{return {state:newDraft(pack,seed),notice:'The saved draft could not be restored. A new run is ready; the previous stored record has not been removed.'}}}
export function saveDraft(storage,pack,state){try{storage.setItem(draftSaveKey(pack),JSON.stringify(validateDraftState(state,pack)));return ''}catch{return 'Saving is unavailable in this browser. You can keep playing, but progress may be lost when you leave.'}}
