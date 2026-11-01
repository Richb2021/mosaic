import {NOVEL_ROUTES} from './extended-content.js';
import {draftHash} from './draft-engine.js';
const need=(v,m)=>{if(!v)throw Error(m)};
const num=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
export const extendedSaveKey=pack=>`mosaic:${pack.template}:${pack.id}@${pack.revision}:${draftHash(pack)}`;
export function newExtended(pack,seed=1){need(num(seed,1,4294967295),'Invalid game seed.');return {format:1,packId:pack.id,revision:pack.revision,contentHash:draftHash(pack),seed,history:[]}}
export function extendedView(pack,record){let v;
 if(pack.template==='novel-v1')v={phase:'story',node:0,pending:null,journal:[]};
 else if(pack.template==='merge-v1')v={phase:'craft',board:Array(16).fill(null),delivered:[0,0,0],discovered:[],last:null};
 else v={phase:'question',index:0,attempts:pack.questions.map(()=>[]),results:[],score:0,opponent:0,zone:0,lane:1,energy:5,turn:0,insight:0,last:null};
 for(const action of record.history)v=step(pack,v,action);
 return v;
}
export function optionOrder(pack,record,index){const out=[0,1,2],salt=parseInt(draftHash([pack.id,index]),36);let n=(record.seed^salt)>>>0;for(let i=2;i>0;i--){n=(Math.imul(n,1664525)+1013904223)>>>0;const j=n%(i+1);[out[i],out[j]]=[out[j],out[i]]}return out}
export const defenderLane=v=>(v.index+v.zone+v.turn)%3;
export const keeperLane=v=>v.index%3;
export function recipeFor(pack,a,b){return pack.recipes.findIndex(r=>r.inputs[0]===Math.min(a,b)&&r.inputs[1]===Math.max(a,b))}
export function step(pack,v,a){need(a&&typeof a==='object'&&!Array.isArray(a),'Invalid game action.');need(v.phase!=='complete','This game is complete.');const next=structuredClone(v);
 if(pack.template==='novel-v1'){
  if(a.type==='choose'){need(v.pending===null&&num(a.choice,0,1),'Choose one available story decision.');next.pending=a.choice;next.journal.push({node:v.node,choice:a.choice})}
  else if(a.type==='continue'){need(v.pending!==null,'Make a decision first.');next.node=NOVEL_ROUTES[v.node][v.pending];next.pending=null;if(next.node>=6)next.phase='complete'}else throw Error('Unknown story action.');
 }else if(pack.template==='merge-v1'){
  const slot=i=>num(i,0,15);
  if(a.type==='collect'){need(num(a.item,0,1),'Collect a base resource.');const empty=next.board.indexOf(null);need(empty>=0,'The board is full. Combine, move or recycle a piece.');next.board[empty]=a.item;next.last={type:a.type,slot:empty}}
  else if(a.type==='move'){need(slot(a.from)&&slot(a.to)&&a.from!==a.to&&next.board[a.from]!==null&&next.board[a.to]===null,'Move a piece into an empty slot.');next.board[a.to]=next.board[a.from];next.board[a.from]=null;next.last={type:a.type,slot:a.to}}
  else if(a.type==='recycle'){need(slot(a.slot)&&next.board[a.slot]!==null,'Select a piece to recycle.');next.board[a.slot]=null;next.last={type:a.type,slot:a.slot}}
  else if(a.type==='combine'){need(slot(a.from)&&slot(a.to)&&a.from!==a.to&&next.board[a.from]!==null&&next.board[a.to]!==null,'Select two different occupied slots.');const r=recipeFor(pack,next.board[a.from],next.board[a.to]);need(r>=0,'These pieces have no recipe. Check the recipe journal.');next.board[a.to]=r+2;next.board[a.from]=null;next.discovered=[...new Set([...next.discovered,r])];next.last={type:a.type,slot:a.to,recipe:r}}
  else if(a.type==='deliver'){need(num(a.order,0,2),'Choose a delivery.');const o=pack.orders[a.order];need(!next.delivered[a.order],'This order is already delivered.');const slots=next.board.map((item,i)=>item===o.item?i:-1).filter(i=>i>=0);need(slots.length>=o.quantity,'Craft all requested pieces before delivering.');slots.slice(0,o.quantity).forEach(i=>next.board[i]=null);next.delivered[a.order]=1;next.last={type:a.type,order:a.order};if(next.delivered.every(Boolean))next.phase='complete'}else throw Error('Unknown crafting action.');
 }else{
  const q=pack.questions[v.index];
  if(a.type==='answer'){need(v.phase==='question'&&num(a.answer,0,2)&&!v.attempts[v.index].includes(a.answer)&&!v.attempts[v.index].includes(q.solution),'Choose an unanswered option.');next.attempts[v.index].push(a.answer);if(a.answer===q.solution){next.phase='feedback';next.insight=next.attempts[v.index].length===1?1:0}}
  else if(a.type==='next'){need(v.phase==='feedback','Read the question feedback first.');if(pack.template==='sports-v1'){next.phase='play';next.zone=0;next.lane=1;next.energy=5;next.turn=0;next.last=null}else{next.index++;next.phase=next.index===pack.questions.length?'complete':'question'}}
  else if(a.type==='move'&&pack.template==='sports-v1'){need(v.phase==='play'&&num(a.lane,0,2),'Choose a lane.');const cost=a.lane===1?2:1;need(v.energy>=cost,'Not enough stamina for that move.');next.energy-=cost;next.turn++;const blocked=a.lane===defenderLane(v);next.lane=a.lane;if(!blocked)next.zone=Math.min(3,v.zone+(a.lane===1?2:1));next.last={type:'move',from:{zone:v.zone,lane:v.lane},blocked};if(next.energy===0)finishPossession(next,false,'Stamina ran out before the shot.');}
  else if(a.type==='shoot'&&pack.template==='sports-v1'){need(v.phase==='play'&&v.zone>=1&&v.energy>=1&&num(a.lane,0,2),'Advance at least one zone and keep stamina for a shot.');const power=v.zone+v.insight,threshold=a.lane===keeperLane(v)?4:3;next.energy--;next.lane=a.lane;next.last={type:'shot',from:{zone:v.zone,lane:v.lane},goal:power>=threshold};finishPossession(next,power>=threshold,power>=threshold?'Your shot finds the net.':'The keeper saves the shot.');}
  else if(a.type==='next-possession'&&pack.template==='sports-v1'){need(v.phase==='result','Finish this possession first.');next.index++;next.phase=next.index===6?'complete':'question';}
  else throw Error('Unknown game action.');
 }
 return next;
}
function finishPossession(v,goal,message){const conceded=v.zone<3&&[1,4].includes(v.index);v.score+=goal?1:0;v.opponent+=conceded?1:0;v.results.push({goal,conceded,message,zone:v.zone,energy:v.energy});v.phase='result'}
export function actExtended(pack,record,action){need(record.history.length<2000,'Move limit reached. Undo a move or restart this run.');step(pack,extendedView(pack,record),action);return {...record,history:[...record.history,structuredClone(action)]}}
export function undoExtended(pack,record){need(record.history.length>0,'There is no move to undo.');need(pack.template==='merge-v1','Only crafting moves can be undone.');return {...record,history:record.history.slice(0,-1)}}
export function validateExtendedState(raw,pack){need(raw&&raw.format===1&&raw.packId===pack.id&&raw.revision===pack.revision&&raw.contentHash===draftHash(pack),'This save belongs to different game content.');const clean=newExtended(pack,raw.seed);need(Array.isArray(raw.history)&&raw.history.length<=2000,'Invalid saved history.');need(new TextEncoder().encode(JSON.stringify(raw)).length<180000,'Saved history is too large.');for(const a of raw.history){const allowed={choose:['type','choice'],continue:['type'],collect:['type','item'],recycle:['type','slot'],combine:['type','from','to'],deliver:['type','order'],answer:['type','answer'],next:['type'],shoot:['type','lane'],'next-possession':['type'],move:pack.template==='merge-v1'?['type','from','to']:['type','lane']}[a?.type];need(allowed&&Object.keys(a).every(k=>allowed.includes(k)),'Invalid saved action.');clean.history.push(structuredClone(a))}extendedView(pack,clean);return clean}
export function loadExtended(storage,pack,seed){try{const s=storage.getItem(extendedSaveKey(pack));if(s===null)return {record:newExtended(pack,seed),notice:''};need(s.length<180000,'Saved history is too large.');return {record:validateExtendedState(JSON.parse(s),pack),notice:'Your progress has been restored.'}}catch{return {record:newExtended(pack,seed),notice:'This saved run could not be restored. A fresh run is ready.'}}}
export function saveExtended(storage,pack,record){try{storage.setItem(extendedSaveKey(pack),JSON.stringify(validateExtendedState(record,pack)));return ''}catch{return 'Saving is unavailable. You can keep playing, but progress may be lost when you leave.'}}
