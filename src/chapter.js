// Authored rules stay separate from topic text. No topic can supply executable code.
export const ROOMS=['entry','gallery','reservoir','workshop','heart'];
export const CHALLENGES=['route','balance','transfer'];
export const FOES={
 beetle:{name:'Copper crawler',asset:'works_beetle',hp:38,attack:6,weak:'tide',role:'Armoured scavenger'},
 moth:{name:'Lantern moth',asset:'works_moth',hp:30,attack:5,weak:'gale',role:'Mends its allies on even rounds'},
 sentry:{name:'Relay sentry',asset:'works_sentry',hp:46,attack:8,weak:'flare',role:'Charges, then fires across the party'},
 heart:{name:'The Unwinding Heart',asset:'works_heart',hp:150,attack:10,weak:'tide',role:'A shielded engine with a failing governor'}
};
export const ENCOUNTERS={gallery:['beetle','moth'],reservoir:['sentry','beetle'],heart:['heart','sentry','moth']};
const clone=x=>JSON.parse(JSON.stringify(x)),integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
export function initialChapter(){return {version:1,content:null,room:null,visited:[],recruited:false,shortcut:false,cache:false,solved:[],attempts:{route:0,balance:0,transfer:0},hints:[],observations:[],defeated:[],choice:null,completed:false,boardWins:0,boardReward:false,battle:null,party:[{hp:72,mp:24},{hp:64,mp:32},{hp:66,mp:20}],mechanisms:{route:[],balance:0,transfer:[0,0,0]}}}
export const CHAPTER_HP=[72,64,66],CHAPTER_MP=[24,32,20];
export function validChapter(raw){
 if(raw===undefined)return initialChapter();
 try{
  const n=initialChapter();if(!raw||raw.version!==1||raw.room!==null&&!ROOMS.includes(raw.room))return null;
  n.room=raw.room;n.content=typeof raw.content==='string'&&raw.content.length<=100?raw.content:null;
  for(const [key,allowed] of Object.entries({visited:ROOMS,solved:CHALLENGES,hints:CHALLENGES,defeated:Object.keys(ENCOUNTERS)})){
   const v=raw[key];if(!Array.isArray(v)||v.length>allowed.length||new Set(v).size!==v.length||v.some(x=>!allowed.includes(x)))return null;n[key]=[...v];
  }
  for(const k of ['recruited','shortcut','cache','completed','boardReward']){if(typeof raw[k]!=='boolean')return null;n[k]=raw[k]}
  if(raw.choice!==null&&!['gardens','homes'].includes(raw.choice)||!integer(raw.boardWins,0,999))return null;n.choice=raw.choice;n.boardWins=raw.boardWins;
  if(n.room&&!n.visited.includes(n.room)||n.shortcut&&!n.recruited||n.completed&&(!n.defeated.includes('heart')||!n.choice)||n.defeated.includes('heart')&&!n.solved.includes('transfer'))return null;
  if(n.defeated.length&&!n.recruited||n.visited.includes('reservoir')&&!n.solved.includes('route')||n.visited.includes('heart')&&(!n.solved.includes('route')||!n.solved.includes('balance')||!n.defeated.includes('gallery')||!n.defeated.includes('reservoir')))return null;
  for(const k of CHALLENGES){const a=raw.attempts?.[k]??0;if(!integer(a,0,100000))return null;n.attempts[k]=a}
  if(!Array.isArray(raw.party)||raw.party.length!==3||raw.party.some((h,i)=>!integer(h.hp,0,CHAPTER_HP[i])||!integer(h.mp,0,CHAPTER_MP[i])))return null;n.party=clone(raw.party);
  const m=raw.mechanisms;if(!m||!Array.isArray(m.route)||m.route.length>3||new Set(m.route).size!==m.route.length||m.route.some(x=>!integer(x,0,2))||!integer(m.balance,0,20)||!Array.isArray(m.transfer)||m.transfer.length!==3||m.transfer.some(x=>!integer(x,0,2)))return null;n.mechanisms=clone(m);
  if(!Array.isArray(raw.observations)||raw.observations.length>100||raw.observations.some(v=>!CHALLENGES.includes(v.objective)||!integer(v.attempt,1,100000)||typeof v.correct!=='boolean'||typeof v.hinted!=='boolean'))return null;n.observations=raw.observations.map(v=>({objective:v.objective,attempt:v.attempt,correct:v.correct,hinted:v.hinted}));
  if(raw.battle){const b=raw.battle,ids=ENCOUNTERS[b.id];if(!ids||!n.room||n.room!==b.id||!n.recruited||n.defeated.includes(b.id)||!integer(b.actor,0,2)||n.party[b.actor].hp<=0||!integer(b.round,1,1000)||!Array.isArray(b.foes)||b.foes.length!==ids.length||b.foes.some((e,i)=>e.kind!==ids[i]||!integer(e.hp,0,FOES[e.kind].hp)||!integer(e.exposed,0,2))||b.foes.every(e=>e.hp===0)||!integer(b.target,0,ids.length-1)||!Array.isArray(b.guards)||b.guards.length!==3||b.guards.some(v=>typeof v!=='boolean')||!integer(b.disabled,0,2))return null;
   n.battle={id:b.id,foes:clone(b.foes),actor:b.actor,round:b.round,target:b.target,guards:[...b.guards],disabled:b.disabled,log:Array.isArray(b.log)?b.log.filter(x=>typeof x==='string').slice(-4).map(x=>x.slice(0,200)):[]};
  }
  return n;
 }catch{return null}
}
export function contentKey(c){return `${c.id}@${c.revision}`}
export function bindChapter(s,content){const key=contentKey(content);if(s.chapter.content&&s.chapter.content!==key){const wasInside=!!s.chapter.room;s.chapter=initialChapter();if(wasInside){s.interior=null;s.area='mill';s.pos={x:4,z:7}}}s.chapter.content=key;return s}
export function enterWorks(s){if(s.battle||s.chapter.battle||s.interior||s.area!=='mill')return false;s.chapter.room='entry';if(!s.chapter.visited.includes('entry'))s.chapter.visited.push('entry');s.pos={x:0,z:7};return true}
export function leaveWorks(s){if(!s.chapter.room||s.chapter.battle)return false;s.chapter.room=null;s.pos={x:4,z:7};return true}
export const ROUTES={entry:['gallery','workshop'],gallery:['entry','reservoir','heart'],reservoir:['gallery','workshop'],workshop:['entry','reservoir','heart'],heart:['gallery','workshop']};
export function roomLock(s,to){const c=s.chapter,from=c.room;if(!ROUTES[from]?.includes(to))return 'There is no passage here.';if((from==='workshop'&&to==='heart'||from==='heart'&&to==='workshop')&&!c.shortcut)return 'Nessa can repair this service lift.';if(to==='reservoir'&&!c.solved.includes('route'))return 'Restore the routing engine in the gallery first.';if(to==='heart'&&(!c.solved.includes('route')||!c.solved.includes('balance')||!c.defeated.includes('gallery')||!c.defeated.includes('reservoir')))return 'Stabilise both mechanisms and clear the two machine patrols first.';return null}
export function moveRoom(s,to){if(s.chapter.battle||roomLock(s,to))return false;s.chapter.room=to;if(!s.chapter.visited.includes(to))s.chapter.visited.push(to);s.pos={x:0,z:7};return true}
export function recruit(s){if(s.chapter.room!=='entry'||s.chapter.recruited)return false;s.chapter.recruited=true;return true}
export function restWorks(s){if(s.chapter.room!=='entry'&&s.chapter.room!=='workshop'||s.chapter.battle)return false;s.chapter.party=s.chapter.party.map((_,i)=>({hp:CHAPTER_HP[i],mp:CHAPTER_MP[i]}));return true}
export function solveMechanism(s,content,id){
 const c=s.chapter,q=content.challenges[id];if(!q||c.battle||({route:'gallery',balance:'reservoir',transfer:'heart'})[id]!==c.room||c.solved.includes(id))return {ok:false,message:'That mechanism is unavailable.'};
 const correct=JSON.stringify(c.mechanisms[id])===JSON.stringify(q.solution);c.attempts[id]=Math.min(100000,(c.attempts[id]||0)+1);
 c.observations.push({objective:id,attempt:c.attempts[id],correct,hinted:c.hints.includes(id)});c.observations=c.observations.slice(-100);
 if(correct)c.solved.push(id);
 return {ok:correct,message:correct?q.explanation:q.feedback};
}
export function beginEncounter(s,id){const c=s.chapter;if(c.battle||s.battle||!c.recruited||c.room!==id||!ENCOUNTERS[id]||c.defeated.includes(id)||id==='heart'&&!c.solved.includes('transfer'))return false;
 if(c.party.every(h=>!h.hp))return false;c.battle={id,foes:ENCOUNTERS[id].map(kind=>({kind,hp:FOES[kind].hp,exposed:0})),actor:c.party.findIndex(h=>h.hp>0),round:1,target:0,guards:[false,false,false],disabled:0,log:['Choose an opponent. The whole party acts before the machines.']};return true}
export function foeIntent(b,e){if(!e.hp)return 'Disabled';if(e.kind==='heart')return b.disabled?'Governor disabled · shield down':e.hp<=75?'Overdrive · sweeps every turn':b.round%3===0?'Pressure wave · all travellers':'Armoured · focused strike';if(e.kind==='moth')return b.round%2===0?'Repair the most damaged machine':'Siphon a little MP';if(e.kind==='sentry')return b.round%2===0?'Charged volley · all travellers':'Charge for next round';return 'Shell strike · exposed by spells'}
export const chapterActions=i=>i===2?['attack','disable','repair','guard','retreat']:i===1?['attack','tide','gale','heal','guard','retreat']:['attack','flare','gale','break','guard','retreat'];
export const actionCost=a=>['flare','tide','gale','disable','break'].includes(a)?4:['heal','repair'].includes(a)?5:0;
export function chapterTurn(s,action,target=0,difficulty='standard'){
 const c=s.chapter,b=c.battle;if(!b||!chapterActions(b.actor).includes(action))return {ok:false};
 const i=b.actor,h=c.party[i],cost=actionCost(action),foe=b.foes[target];if(h.mp<cost||!foe||!foe.hp)return {ok:false};
 if(action==='retreat'){c.battle=null;return {ok:true,result:'retreat',events:[],message:'You withdraw. The machines return to their stations.'}}
 const events=[],say=t=>{b.log.push(t);b.log=b.log.slice(-4)},names=[s.party[0].name,'Ivo','Nessa'];h.mp-=cost;
 if(action==='guard'){b.guards[i]=true;h.mp=Math.min(CHAPTER_MP[i],h.mp+5);say(`${names[i]} guards and recovers 5 MP.`)}
 else if(action==='heal'||action==='repair'){const j=c.party.reduce((best,p,k)=>(CHAPTER_HP[k]-p.hp>CHAPTER_HP[best]-c.party[best].hp?k:best),0),amount=Math.min(28,CHAPTER_HP[j]-c.party[j].hp);c.party[j].hp+=amount;events.push({from:i,ally:j,amount});say(`${names[i]} restores ${amount} HP to ${names[j]}.`)}
 else {
  const def=FOES[foe.kind],magic=['flare','tide','gale'].includes(action);let damage=magic?(def.weak===action?25:14):action==='break'?15:action==='disable'?9:17;
  if(foe.kind==='heart'&&!b.disabled)damage=Math.ceil(damage*.5);if(foe.exposed){damage+=7;foe.exposed--}if(difficulty==='story')damage+=6;
  if(action==='break'||magic&&def.weak===action)foe.exposed=2;
  if(action==='disable'){b.disabled=2;say('Nessa jams the governor. Engine shield and charged volleys are interrupted.');}
  damage=Math.min(foe.hp,damage);foe.hp-=damage;events.push({from:i,target,amount:damage});say(`${names[i]} uses ${action}: ${def.name} loses ${damage} HP.`);
 }
 if(b.foes.every(e=>!e.hp)){
  c.defeated.push(b.id);c.battle=null;s.gold=Math.min(9999,s.gold+(b.id==='heart'?70:22));s.xp=Math.min(10000,s.xp+(b.id==='heart'?40:12));return {ok:true,result:'victory',events,message:b.id==='heart'?'The Heart falls quiet. Decide where the first restored current should go.':'The passage is safe. The party earns 22 coins and 12 adventure XP.'};
 }
 let next=c.party.findIndex((p,j)=>j>i&&p.hp>0);if(next>=0)b.actor=next;
 else {
  for(let j=0;j<b.foes.length;j++){const e=b.foes[j];if(!e.hp)continue;const def=FOES[e.kind];
   if(e.kind==='moth'&&b.round%2===0){const ally=b.foes.filter(e=>e.hp>0).sort((a,b)=>(FOES[b.kind].hp-b.hp)-(FOES[a.kind].hp-a.hp))[0];const healed=Math.min(12,FOES[ally.kind].hp-ally.hp);ally.hp+=healed;say(`Lantern moth repairs ${healed} HP.`);continue}
   if(e.kind==='sentry'&&(b.round%2===1||b.disabled)){say(b.disabled?'The sentry’s charge fizzles.':'The sentry stores a charge.');continue}
   const all=e.kind==='sentry'||e.kind==='heart'&&(b.round%3===0||e.hp<=75),alive=c.party.map((p,k)=>p.hp>0?k:-1).filter(k=>k>=0),targets=all?alive:[alive[(b.round+j-1)%alive.length]];
   for(const k of targets){if(k===undefined)continue;let d=def.attack+(e.kind==='heart'&&e.hp<=75?3:0);if(b.guards[k])d=Math.ceil(d*.4);if(difficulty==='story')d=Math.max(1,d-3);d=Math.min(c.party[k].hp,d);c.party[k].hp-=d;if(e.kind==='moth')c.party[k].mp=Math.max(0,c.party[k].mp-2);events.push({enemy:j,ally:k,amount:d});say(`${def.name} hits ${names[k]} for ${d}.`)}
  }
  b.round++;b.guards=[false,false,false];b.disabled=Math.max(0,b.disabled-1);b.actor=c.party.findIndex(p=>p.hp>0);
  if(b.actor<0){c.battle=null;c.room='entry';c.party=c.party.map((_,i)=>({hp:CHAPTER_HP[i],mp:CHAPTER_MP[i]}));s.pos={x:0,z:7};return {ok:true,result:'defeat',events,message:'Nessa’s safety tether brings everyone to the entrance. Restored and ready to try another approach; your discoveries are safe.'}}
 }
 if(!b.foes[b.target].hp)b.target=b.foes.findIndex(e=>e.hp>0);return {ok:true,result:'continue',events};
}
export function finishWorks(s,choice){const c=s.chapter;if(c.completed||!c.defeated.includes('heart')||!['gardens','homes'].includes(choice))return false;c.choice=choice;c.completed=true;return true}

// A finite nine-turn territory game: higher adjacent lanterns change allegiance.
export const newBoard=()=>({cells:Array(9).fill(null),hand:[1,1,2,2,3],rival:[1,2,2,3],turn:'player',finished:false,result:null});
const neighbours=i=>[i%3?i-1:-1,i%3<2?i+1:-1,i>2?i-3:-1,i<6?i+3:-1].filter(x=>x>=0);
function place(b,index,value,owner){b.cells[index]={value,owner};for(const n of neighbours(index))if(b.cells[n]&&b.cells[n].value<value)b.cells[n].owner=owner}
export function playBoard(b,index,value){if(b.finished||!integer(index,0,8)||b.cells[index]||!b.hand.includes(value))return false;b.hand.splice(b.hand.indexOf(value),1);place(b,index,value,'player');
 if(b.cells.some(x=>!x)&&b.rival.length){let best=null;for(let i=0;i<9;i++)if(!b.cells[i])for(const v of b.rival){const score=neighbours(i).filter(n=>b.cells[n]?.owner==='player'&&b.cells[n].value<v).length*4-v/10+(i===4?.2:0);if(!best||score>best.score)best={i,v,score}}b.rival.splice(b.rival.indexOf(best.v),1);place(b,best.i,best.v,'rival')}
 if(b.cells.every(Boolean)){b.finished=true;const count=b.cells.filter(x=>x.owner==='player').length;b.result=count>=5?'win':'loss'}return true}
