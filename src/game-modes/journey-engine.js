import {draftHash} from './draft-engine.js';
import {NOVEL_ROUTES} from './extended-content.js';
import {optionOrder, recipeFor} from './extended-engine.js';

const need=(yes,message)=>{if(!yes)throw Error(message)};
const integer=(n,a,b)=>Number.isInteger(n)&&n>=a&&n<=b;
export const STAR_LINKS=[[1,2],[0,3,4],[0,4,5],[1,6],[1,2,6],[2,7],[3,4,7],[5,6]];
export const STAR_POINTS=[[14,53],[31,25],[34,79],[52,12],[51,48],[56,86],[73,31],[84,66]];
export const STYLES=['balanced','press','counter'];
export const journeyKey=p=>`mosaic:journey:1:${p.id}:${p.revision}:${draftHash(p)}`;
export const seeded=(seed,salt)=>{let x=(seed^Math.imul(salt+1,2654435761))>>>0;x=Math.imul(x^(x>>>16),2246822507);return (x^(x>>>13))>>>0};
export function newJourney(pack,seed=1,mode='relaxed',version=2){
 need(integer(seed,1,4294967295),'Invalid journey seed.');need(['relaxed','challenge'].includes(mode),'Choose a play style.');
 need([1,2].includes(version),'Unsupported journey rules.');
 return {version,packId:pack.id,contentHash:draftHash(pack),seed,mode,history:[]};
}
export function craftCost(pack,item){return item<2?1:pack.recipes[item-2].inputs.reduce((n,i)=>n+craftCost(pack,i),0)}
export const commissions=pack=>pack.recipes.map((_,i)=>({item:i+2,quantity:1}));
export const materialBudget=pack=>commissions(pack).reduce((n,o)=>n+craftCost(pack,o.item),0)+8;
export function initialJourney(pack,record){
 const kind=pack.template.split('-')[0];
 if(kind==='quiz')return {phase:'map',index:0,visited:[],attempts:pack.questions.map(()=>[]),hints:[],route:[],lens:2,stars:0};
 if(kind==='sports')return {phase:'briefing',index:0,attempts:pack.questions.map(()=>[]),results:[],score:0,opponent:0,zone:0,lane:1,energy:6,turn:0,insight:0,style:'balanced',last:null,...(record.version===2?{passes:[],successfulLanes:[],feinted:false}: {})};
 if(kind==='merge')return {phase:'craft',board:Array(16).fill(null),delivered:Array(6).fill(false),discovered:[],spent:0,crafts:0,last:null};
 return {phase:'story',node:0,pending:null,journal:[],notes:[],completedPaths:[],seen:[],ending:null,run:0};
}
export const reachableStars=v=>v.visited.length===0?[0,1,2]:[...new Set(v.visited.flatMap(i=>STAR_LINKS[i]))].filter(i=>!v.visited.includes(i));
export function opponentStyle(record,index){return STYLES[seeded(record.seed,index)%3]}
export function defenderAt(record,v){return record.version===2&&v.passes?.length>=2&&v.passes.at(-1)===v.passes.at(-2)?v.passes.at(-1):seeded(record.seed,100+v.index*41+v.turn*7+v.zone)%3}
export function keeperAt(record,v){return record.version===2&&v.results?.findLast(r=>r.shotLane!==undefined)?v.results.findLast(r=>r.shotLane!==undefined).shotLane:seeded(record.seed,900+v.index*19+Math.floor(v.turn/2))%3}
export function tacticalOptions(record,v){
 const defence=opponentStyle(record,v.index),press=defence==='press',counter=defence==='counter';
 return {defence,blocked:defenderAt(record,v),keeper:keeperAt(record,v),cost:v.style==='press'?2:1,advance:v.style==='press'?2:1,shotBonus:v.style==='counter'?1:0,shotCost:v.style==='counter'?2:1,counterRisk:counter||press,threshold:record.version===2?5:3,keeperPenalty:record.version===2?2:1,shotPower:v.zone+v.insight+(v.style==='counter'?1:0)+(record.version===2?Math.max(0,new Set(v.successfulLanes).size-1)+Number(v.feinted):0),width:record.version===2?Math.max(0,new Set(v.successfulLanes).size-1):0};
}
export function journeyView(pack,record){let v=initialJourney(pack,record);for(const a of record.history)v=journeyStep(pack,record,v,a);return v}
export function journeyStep(pack,record,state,a){
 need(a&&typeof a==='object'&&!Array.isArray(a),'Invalid journey action.');const v=structuredClone(state),kind=pack.template.split('-')[0];
 need(v.phase!=='complete'||(kind==='novel'&&['new-path','note'].includes(a.type)),'This journey is complete.');
 if(kind==='quiz'){
  if(a.type==='travel'){need(v.phase==='map'&&reachableStars(v).includes(a.index),'Choose a reachable unexplored star.');v.index=a.index;v.route.push(a.index);v.phase='question';}
  else if(a.type==='hint'){need(v.phase==='question'&&v.lens>0&&!v.hints.includes(v.index)&&v.attempts[v.index].length<2,'No untried false lead remains for a lens.');v.hints.push(v.index);v.lens--;}
  else if(a.type==='answer'){need(a.answer!==eliminatedOption(pack,record,v),'That option was ruled out by the lens.');answer(pack,v,a);}
  else if(a.type==='next'){need(v.phase==='feedback','Finish this encounter first.');v.visited.push(v.index);if([2,5].includes(v.index))v.lens=Math.min(3,v.lens+1);if(v.attempts[v.index].length===1&&!v.hints.includes(v.index))v.stars++;v.phase=v.visited.length===8?'complete':'map';}
  else throw Error('Unknown expedition action.');
 }else if(kind==='sports'){
  if(a.type==='formation'){need(v.phase==='briefing'&&STYLES.includes(a.style),'Choose a formation before kick-off.');v.style=a.style;v.phase='question';}
  else if(a.type==='answer')answer(pack,v,a);
  else if(a.type==='next'){need(v.phase==='feedback','Finish the huddle first.');v.phase='play';v.zone=0;v.lane=1;v.energy=6;v.turn=0;v.last=null;if(record.version===2){v.passes=[];v.successfulLanes=[];v.feinted=false;}}
  else if(a.type==='move'){
   const t=tacticalOptions(record,v);need(v.phase==='play'&&integer(a.lane,0,2)&&v.energy>=t.cost,'Choose an affordable pass.');const blocked=a.lane===t.blocked;v.energy-=t.cost;v.turn++;v.lane=a.lane;if(record.version===2)v.passes.push(a.lane);if(!blocked){v.zone=Math.min(3,v.zone+t.advance);if(record.version===2)v.successfulLanes.push(a.lane);}v.last={type:'move',blocked};if(!v.energy||(v.zone===0&&v.energy<t.cost))finishMatch(v,false,t.counterRisk,'Your attack ran out of stamina.');
  }else if(a.type==='feint'){need(v.phase==='play'&&v.energy>(v.zone===0?tacticalOptions(record,v).cost:1),'Keep enough stamina for your next play.');v.energy--;v.turn++;v.last={type:'feint'};if(record.version===2)v.feinted=true;}
  else if(a.type==='shoot'){
   const t=tacticalOptions(record,v);need(v.phase==='play'&&v.zone>0&&integer(a.lane,0,2)&&v.energy>=t.shotCost,'Advance and keep enough stamina for a shot.');v.energy-=t.shotCost;const goal=t.shotPower>=t.threshold+(a.lane===t.keeper?t.keeperPenalty:0);v.lane=a.lane;v.last={type:'shot',goal};finishMatch(v,goal,t.counterRisk,goal?'Goal! The stand comes alive.':'The keeper reaches your shot.');
  }else if(a.type==='next-possession'){need(v.phase==='result','Finish the possession first.');v.index++;v.phase=v.index===6?'complete':'briefing';}
  else throw Error('Unknown match action.');
 }else if(kind==='merge'){
  const slot=i=>integer(i,0,15);
  if(a.type==='collect'){need(integer(a.item,0,1),'Choose a base material.');need(record.mode==='relaxed'||v.spent<materialBudget(pack),'Material allowance used. Undo a move or continue in relaxed mode.');const empty=v.board.indexOf(null);need(empty>=0,'Make room by combining, moving or recycling.');v.board[empty]=a.item;v.spent++;v.last={type:'collect',slot:empty};}
  else if(a.type==='move'){need(slot(a.from)&&slot(a.to)&&v.board[a.from]!==null&&v.board[a.to]===null,'Move a piece into an empty slot.');v.board[a.to]=v.board[a.from];v.board[a.from]=null;v.last={type:'move',slot:a.to};}
  else if(a.type==='recycle'){need(slot(a.slot)&&v.board[a.slot]!==null,'Select a piece.');v.board[a.slot]=null;v.last={type:'recycle'};}
  else if(a.type==='combine'){need(slot(a.from)&&slot(a.to)&&a.from!==a.to&&v.board[a.from]!==null&&v.board[a.to]!==null,'Choose two pieces.');const r=recipeFor(pack,v.board[a.from],v.board[a.to]);need(r>=0,'These pieces have no recipe.');v.board[a.from]=null;v.board[a.to]=r+2;v.crafts++;v.discovered=[...new Set([...v.discovered,r])];v.last={type:'combine',slot:a.to,recipe:r};}
  else if(a.type==='deliver'){const unlocked=Math.min(6,2+v.delivered.filter(Boolean).length);need(integer(a.order,0,unlocked-1)&&!v.delivered[a.order],'Choose an unlocked commission.');const slot=v.board.indexOf(a.order+2);need(slot>=0,'Craft the requested item.');v.board[slot]=null;v.delivered[a.order]=true;v.last={type:'deliver',order:a.order};if(v.delivered.every(Boolean))v.phase='complete';}
  else throw Error('Unknown guild action.');
 }else{
  if(a.type==='note'){need(['story','complete'].includes(v.phase)&&pack.sources.some(s=>s.id===a.source),'Choose a source passage.');v.notes=[...new Set([...v.notes,a.source])];}
  else if(a.type==='choose'){need(v.phase==='story'&&v.pending===null&&integer(a.choice,0,1),'Choose a story path.');v.pending=a.choice;v.journal.push({node:v.node,choice:a.choice});v.seen=[...new Set([...v.seen,v.node])];}
  else if(a.type==='continue'){need(v.pending!==null,'Make a decision first.');v.node=NOVEL_ROUTES[v.node][v.pending];v.pending=null;if(v.node>=6){v.ending=v.node-6;v.completedPaths.push({ending:v.ending,choices:structuredClone(v.journal)});v.phase='complete';}}
  else if(a.type==='new-path'){need(v.phase==='complete'&&v.run<11,'Explore up to twelve routes in one journal.');v.run++;v.node=0;v.pending=null;v.journal=[];v.ending=null;v.phase='story';}
  else throw Error('Unknown story action.');
 }
 return v;
}
function answer(pack,v,a){const q=pack.questions[v.index];need(v.phase==='question'&&integer(a.answer,0,2)&&!v.attempts[v.index].includes(a.answer),'Choose an untried answer.');v.attempts[v.index].push(a.answer);if(a.answer===q.solution){v.phase='feedback';v.insight=v.attempts[v.index].length===1?1:0}}
function finishMatch(v,goal,risk,message){const conceded=!goal&&risk&&v.zone<3;v.score+=Number(goal);v.opponent+=Number(conceded);v.results.push({goal,conceded,message,style:v.style,...(v.passes&&v.last?.type==='shot'?{shotLane:v.lane}: {})});v.phase='result'}
export function actJourney(pack,record,action){need(record.history.length<2000,'This journal is full. Undo or start a new journey.');journeyStep(pack,record,journeyView(pack,record),action);return {...record,history:[...record.history,structuredClone(action)]}}
export function undoJourney(pack,r){need(pack.template==='merge-v1'&&r.history.length,'There is no crafting move to undo.');return {...r,history:r.history.slice(0,-1)}}
export function validateJourney(raw,pack){
 need(raw&&[1,2].includes(raw.version)&&raw.packId===pack.id&&raw.contentHash===draftHash(pack),'This journal belongs to different content.');const clean=newJourney(pack,raw.seed,raw.mode,raw.version);need(Array.isArray(raw.history)&&raw.history.length<=2000,'Invalid journey history.');need(JSON.stringify(raw).length<180000,'Journey history is too large.');
 const fields={travel:['index'],hint:[],answer:['answer'],next:[],formation:['style'],move:pack.template==='merge-v1'?['from','to']:['lane'],feint:[],shoot:['lane'],'next-possession':[],collect:['item'],recycle:['slot'],combine:['from','to'],deliver:['order'],note:['source'],choose:['choice'],continue:[],'new-path':[]};
 for(const a of raw.history){need(a&&Object.hasOwn(fields,a.type)&&Object.keys(a).every(k=>k==='type'||fields[a.type].includes(k)),'Invalid journal action.');clean.history.push(structuredClone(a));}journeyView(pack,clean);return clean;
}
export function eliminatedOption(pack,r,v){if(!v.hints?.includes(v.index))return -1;return optionOrder(pack,r,v.index).find(a=>a!==pack.questions[v.index].solution&&!v.attempts[v.index].includes(a))??-1}
export function journeyLearning(pack,r){const v=journeyView(pack,r);let items=[];
 if(v.attempts)items=pack.questions.flatMap((q,i)=>v.attempts[i].length?[{key:`question-${i}`,sourceRefs:q.sourceRefs,attempts:v.attempts[i].length,correct:v.attempts[i].includes(q.solution),assisted:!!v.hints?.includes(i)}]:[]);
 else if(v.discovered)items=v.discovered.map(i=>({key:`recipe-${i}`,sourceRefs:pack.recipes[i].sourceRefs,attempts:0,correct:null,assisted:false}));
 else items=v.seen.map(i=>({key:`scene-${i}`,sourceRefs:pack.nodes[i].sourceRefs,attempts:0,correct:null,assisted:false}));
 return {completed:v.phase==='complete',items,engagement:pack.template==='sports-v1'?v.results.length:pack.template==='novel-v1'?v.completedPaths.length:pack.template==='merge-v1'?v.delivered.filter(Boolean).length:v.visited.length};
}
