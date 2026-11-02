import {WORLD_ROOMS,worldState,worldRoutes,roomLock,validWorldState,worldAction,worldGoal} from './adventure-world.js';
export const ADVENTURE_ROOMS=['workshop','woods','archive'];
const ITEMS=['tool','keepsake','record'];
export const ADVENTURE_ANCHORS={
 workshop:{clue:{x:44,y:77},npc:{x:65,y:79},machine:{x:83,y:80},woods:{x:9,y:80},archive:{x:94,y:77}},
 woods:{clue:{x:63,y:77},npc:{x:37,y:78},tool:{x:77,y:84},workshop:{x:8,y:82}},
 archive:{clue:{x:33,y:80},npc:{x:70,y:78},sequence:{x:55,y:82},workshop:{x:8,y:82}}
};
export function adventureAnchors(pack){
 const workshop=pack.setting==='market'?{clue:{x:51,y:78},npc:{x:34,y:80},machine:{x:77,y:82},woods:{x:8,y:82},archive:{x:93,y:82}}:pack.setting==='observatory'?{clue:{x:31,y:78},npc:{x:61,y:80},machine:{x:85,y:79},woods:{x:8,y:82},archive:{x:94,y:82}}:ADVENTURE_ANCHORS.workshop;
 return {...ADVENTURE_ANCHORS,workshop};
}
const copy=v=>JSON.parse(JSON.stringify(v));
function canonical(value){if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';return JSON.stringify(value)}
export function adventureFingerprint(pack){let hash=2166136261;for(const char of canonical(pack)){hash^=char.charCodeAt(0);hash=Math.imul(hash,16777619)}return (hash>>>0).toString(36)}
export function adventureSaveKey(pack){return `mosaic:adventure:${pack.id}:${pack.revision}:${adventureFingerprint(pack)}`}
export function initialAdventureState(pack){const s={version:pack.world?2:1,content:adventureFingerprint(pack),started:false,hero:'female',room:'workshop',positions:{workshop:{x:25,y:84},woods:{x:16,y:84},archive:{x:18,y:84}},facing:1,inventory:['keepsake'],collected:false,repaired:false,solved:false,completed:false,choice:null,inspected:[],talked:[],hints:[],attempts:0,plates:[],visited:['workshop']};if(pack.world){s.world=worldState();for(const id of ['quay','garden','tower'])s.positions[id]={x:18,y:84}}return s;}
function subset(value,allowed,max=allowed.length){return Array.isArray(value)&&value.length<=max&&new Set(value).size===value.length&&value.every(x=>allowed.includes(x))}
export function validateAdventureSave(raw,pack){
 try{
  const s=typeof raw==='string'?JSON.parse(raw):copy(raw),keys=Object.keys(initialAdventureState(pack)),rooms=pack.world?WORLD_ROOMS:ADVENTURE_ROOMS;
  if(!s||Object.keys(s).some(k=>!keys.includes(k))||keys.some(k=>!Object.hasOwn(s,k)))return null;
  if(s.version!==(pack.world?2:1)||s.content!==adventureFingerprint(pack)||!['female','male'].includes(s.hero)||!rooms.includes(s.room)||![1,-1].includes(s.facing))return null;
  for(const k of ['started','collected','repaired','solved','completed'])if(typeof s[k]!=='boolean')return null;
  if(!s.positions||Object.keys(s.positions).length!==rooms.length)return null;
  for(const room of rooms){const p=s.positions[room];if(!p||Object.keys(p).length!==2||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<5||p.x>95||p.y<72||p.y>88)return null}
  if(!subset(s.inventory,ITEMS)||!s.inventory.includes('keepsake')||!subset(s.inspected,rooms)||!subset(s.talked,rooms)||!subset(s.hints,['repair','sequence'])||!subset(s.visited,rooms)||!s.visited.includes('workshop')||!s.visited.includes(s.room))return null;
  if(!Number.isInteger(s.attempts)||s.attempts<0||s.attempts>100000||!(pack.sequence.mode==='sort'?Array.isArray(s.plates)&&s.plates.length<=3&&s.plates.every(i=>i===0||i===1):subset(s.plates,[0,1,2])))return null;
  if(s.repaired&&!s.collected||s.solved&&!s.repaired||s.completed!==Boolean(s.choice)||s.completed&&!s.solved)return null;
  if(s.choice!==null&&!pack.decision.choices.some(c=>c.id===s.choice))return null;
  if(s.inventory.includes('tool')!==Boolean(s.collected&&!s.repaired)||s.inventory.includes('record')!==s.inspected.includes('archive'))return null;
  if((s.room==='archive'||s.visited.includes('archive')||s.inspected.includes('archive'))&&!s.repaired)return null;
  if(s.solved&&s.plates.some((v,i)=>v!==pack.sequence.solution[i])||s.solved&&s.plates.length!==3)return null;
  if(pack.world&&(!validWorldState(s,pack)||s.visited.includes('tower')&&!s.solved))return null;
  return s;
 }catch{return null}
}
export function adventureGoal(s,pack){if(pack.world){const goal=worldGoal(pack,s);if(goal)return goal}if(s.completed)return 'A thread restored. Your journal keeps the story.';if(s.solved)return 'Choose what happens next.';if(s.repaired)return s.room==='archive'?pack.sequence.title:`Read the evidence in ${pack.rooms.archive.title}.`;if(s.inventory.includes('tool'))return `Use ${pack.items.tool.name.toLowerCase()} on ${pack.repair.targetName.toLowerCase()}.`;return `Find ${pack.items.tool.name.toLowerCase()} in ${pack.rooms.woods.title}.`}
export function reduceAdventure(pack,state,action){
 const s=copy(state),reply={state:s,message:'',sourceRefs:[],title:''};
 const say=(message,sourceRefs=[],title='')=>Object.assign(reply,{message,sourceRefs,title});
 const extended=worldAction(pack,s,action);if(extended)return extended;
 if(action.type==='hero'&&['female','male'].includes(action.hero)){s.hero=action.hero;s.started=true;return reply}
 if(action.type==='travel'){
  if(!(pack.world?WORLD_ROOMS:ADVENTURE_ROOMS).includes(action.room)||!(pack.world?worldRoutes(s)[s.room].includes(action.room):Object.hasOwn(ADVENTURE_ANCHORS[s.room],action.room)))return say('That room is not connected to this path.');
  if(pack.world&&roomLock(s,action.room))return say(roomLock(s,action.room));
  if(action.room==='archive'&&!s.repaired)return say('The archive is still locked. Restore the workshop mechanism first.',pack.repair.sourceRefs);
  s.room=action.room;if(!s.visited.includes(s.room))s.visited.push(s.room);return reply;
 }
 if(action.type==='inspect'){
  if(!s.inspected.includes(s.room))s.inspected.push(s.room);
  if(s.room==='archive'&&!s.inventory.includes('record'))s.inventory.push('record');
  const c=(pack.rooms[s.room]||pack.world?.rooms[s.room]).clue;return say(c.text,c.sourceRefs,c.title);
 }
 if(action.type==='talk'){
  if(!s.talked.includes(s.room))s.talked.push(s.room);
  const n=(pack.rooms[s.room]||pack.world?.rooms[s.room]).npc;return say(n.dialogue,n.sourceRefs,n.name);
 }
 if(action.type==='collect'){
  if(s.room!=='woods')return say('There is nothing to collect here.');
  if(s.collected)return say('You already recovered the missing object.');
  s.collected=true;s.inventory.push('tool');return say(`${pack.items.tool.name} is now in your satchel. ${pack.items.tool.description}`,pack.items.tool.sourceRefs,'Found on the path');
 }
 if(action.type==='repair'){
  if(s.room!=='workshop')return say('Bring the object back to the workshop.');
  if(s.repaired)return say(pack.repair.success,pack.repair.sourceRefs,pack.repair.title);
  if(action.item!=='tool'||!s.inventory.includes('tool'))return say(pack.repair.failure,pack.repair.sourceRefs,pack.repair.title);
  s.repaired=true;s.inventory=s.inventory.filter(i=>i!=='tool');return say(pack.repair.success,pack.repair.sourceRefs,pack.repair.title);
 }
 if(action.type==='plate'&&s.room==='archive'&&s.repaired&&!s.solved&&Number.isInteger(action.index)&&action.index>=0&&action.index<(pack.sequence.mode==='sort'?2:3)&&(pack.sequence.mode==='sort'||!s.plates.includes(action.index))&&s.plates.length<3){s.plates.push(action.index);return reply}
 if(action.type==='clear-plates'&&!s.solved){s.plates=[];return reply}
 if(action.type==='sequence'){
  if(s.room!=='archive'||!s.repaired)return say('The archive mechanism is not available yet.');
  if(s.solved)return say(pack.sequence.success,pack.sequence.sourceRefs,pack.sequence.title);
  s.attempts=Math.min(100000,s.attempts+1);
  if(s.plates.length===3&&s.plates.every((v,i)=>v===pack.sequence.solution[i])){s.solved=true;return say(pack.sequence.success,pack.sequence.sourceRefs,pack.sequence.title)}
  return say(pack.sequence.failure,pack.sequence.sourceRefs,pack.sequence.title);
 }
 if(action.type==='hint'&&['repair','sequence'].includes(action.which)){
  if(!s.hints.includes(action.which))s.hints.push(action.which);
  const h=pack[action.which];return say(h.hint,h.sourceRefs,'A nudge from your journal');
 }
 if(action.type==='choice'){
  if(pack.world&&(s.room!=='tower'||!s.world.relay.solved))return say('Restore the signal in the tower before choosing the ending.');
  if(!s.solved)return say('Finish reconnecting the archive mechanism first.');
  if(s.completed)return say(pack.decision.choices.find(c=>c.id===s.choice).ending,pack.decision.choices.find(c=>c.id===s.choice).sourceRefs,'The thread continues');
  const c=pack.decision.choices.find(c=>c.id===action.id);if(!c)return say('Choose one of the story’s available paths.');
  s.choice=c.id;s.completed=true;return say(c.ending,c.sourceRefs,'The thread continues');
 }
 return reply;
}
