import {initialChronicle,validChronicle} from './scenes.js';
import {initialGrowth,validGrowth,ABILITIES,hasAbility,hasSupport,bonus,awardAP} from './progression.js';
import {validateSettlement} from './quests.js';
import {WORLD_BOUNDS,MAPS,INTERIORS,BUILDINGS,getMap} from './maps.js';
export const AREA_IDS=['quay','woods','mill','quarry','forge','observatory','archive','beacon'];
export const PUZZLE_IDS=['sequence','allocation','matching','dials'];
export const ENEMIES={bramble:{name:'Bramble sentinel',hp:42,attack:7,weakness:'flare',xp:18},shard:{name:'Prism prowler',hp:50,attack:8,weakness:'gale',xp:22},cinder:{name:'Cinder sentinel',hp:54,attack:9,weakness:'tide',xp:25},guardian:{name:'The Hollow Warden',hp:138,attack:11,weakness:'tide',xp:60}};
export const copy=x=>JSON.parse(JSON.stringify(x));
export function hashPack(p){let h=2166136261;for(const c of JSON.stringify(p))h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0).toString(36)}
export function validatePack(raw){
 if(typeof raw==='string'){if(new TextEncoder().encode(raw).length>262144)throw Error('Topic file must be smaller than 256 KB.');raw=JSON.parse(raw)}
 const p=copy(raw);let nodes=0;
 function scan(o,depth=0){if(depth>10||++nodes>3000)throw Error('Topic structure is too complex.');if(typeof o==='string'&&o.length>6000)throw Error('A passage is too long.');if(o&&typeof o==='object')for(const k of Object.keys(o)){if(['__proto__','constructor','prototype'].includes(k))throw Error('Unsafe topic field.');scan(o[k],depth+1)}}scan(p);
 const str=(x,n=1000)=>typeof x==='string'&&x.trim().length>0&&x.length<=n;
 if(p.version!==1||!str(p.id,50)||!/^[a-z0-9-]+$/.test(p.id)||!str(p.title,80)||!str(p.subtitle,160)||!str(p.intro,1600)||!str(p.ending,1600))throw Error('Topic needs version 1, a lowercase id, title, subtitle, intro and ending.');
 if(!p.dialogue||AREA_IDS.some(a=>!str(p.dialogue[a],1600)))throw Error('Add dialogue for all eight areas.');
 if(!p.puzzles||PUZZLE_IDS.some(k=>!p.puzzles[k]))throw Error('All four puzzle types are required.');
 for(const [key,q] of Object.entries(p.puzzles)){if(!PUZZLE_IDS.includes(key)||!str(q.title,100)||!str(q.prompt,1800)||!str(q.hint,1000)||!str(q.explanation,1600))throw Error('Every mechanism needs a title, prompt, hint and explanation.');}
 const seq=p.puzzles.sequence;if(!Array.isArray(seq.cards)||seq.cards.length!==4||seq.cards.some(c=>!str(c,100))||!Array.isArray(seq.solution)||seq.solution.length!==4||new Set(seq.solution).size!==4||seq.solution.some(i=>!Number.isInteger(i)||i<0||i>3))throw Error('Sequence needs four cards and a permutation of 0,1,2,3.');
 const a=p.puzzles.allocation;if(!Number.isInteger(a.total)||a.total<2||a.total>20||!Number.isInteger(a.solution)||a.solution<0||a.solution>a.total||!Array.isArray(a.labels)||a.labels.length!==2||a.labels.some(c=>!str(c,60))||!str(a.unit,50))throw Error('Allocation needs two labels, a unit, total 2–20 and a valid left amount.');
 const m=p.puzzles.matching;if(!Array.isArray(m.left)||!Array.isArray(m.right)||m.left.length!==3||m.right.length!==3||[...m.left,...m.right].some(c=>!str(c,180))||!Array.isArray(m.solution)||m.solution.length!==3||new Set(m.solution).size!==3||m.solution.some(i=>!Number.isInteger(i)||i<0||i>2))throw Error('Matching needs three unique pairs.');
 const d=p.puzzles.dials;if(!Array.isArray(d.labels)||d.labels.length!==3||d.labels.some(c=>!str(c,80))||!Array.isArray(d.options)||d.options.length!==3||d.options.some(c=>!str(c,80))||!Array.isArray(d.solution)||d.solution.length!==3||d.solution.some(i=>!Number.isInteger(i)||i<0||i>2))throw Error('Dials need three labels, three choices and three solution indices.');
 if(!Array.isArray(p.sources)||p.sources.length>12||p.sources.some(s=>!str(s.title,160)||!str(s.url,500)||!/^https:\/\//.test(s.url)))throw Error('Sources must have titles and https links.');
 if(p.settlement!==undefined)p.settlement=validateSettlement(p.settlement);
 return p;
}
export function initialState(p){return {version:1,pack:hashPack(p),area:'quay',pos:{x:0,z:4},visited:['quay'],seals:[],notes:[],chests:[],defeated:[],attempts:{},hints:[],xp:0,potions:3,party:[{name:'Mira',hp:64,mp:16},{name:'Ivo',hp:54,mp:24}],battle:null,ended:false,started:false,hero:'female',interior:null,visitedInteriors:[],gold:40,ether:0,gear:[],quests:{},questContent:null,trackedQuest:null,growth:initialGrowth(),chronicle:initialChronicle()}}
export const maxHP=(s,i)=>(i?54:64)+Math.floor(s.xp/40)*6+(s.gear?.includes('brass-pin')?6:0);
export const maxMP=(s,i)=>(i?24:16)+Math.floor(s.xp/40)*2+(s.gear?.includes('focus-clasp')?3:0);
export function restore(s){s.party.forEach((p,i)=>{p.hp=maxHP(s,i);p.mp=maxMP(s,i)});s.battle=null;return s}
export function validSave(raw,p){
 try{const n=initialState(p);if(raw.version!==1||raw.pack!==n.pack||!AREA_IDS.includes(raw.area))return null;
 const finite=(x,min,max)=>Number.isFinite(x)&&x>=min&&x<=max;
 n.growth=validGrowth(raw.growth);n.chronicle=validChronicle(raw.chronicle);if(!n.growth||!n.chronicle)return null;
 if(raw.interior!==undefined&&raw.interior!==null&&(!BUILDINGS[raw.interior]||BUILDINGS[raw.interior].area!==raw.area||raw.battle))return null;
 n.interior=raw.interior||null;const bounds=getMap(n).bounds;
 if(raw.gear!==undefined&&(!Array.isArray(raw.gear)||raw.gear.length>2||new Set(raw.gear).size!==raw.gear.length||raw.gear.some(g=>!['brass-pin','focus-clasp'].includes(g))))return null;
 n.gear=raw.gear||[];
 for(const [key,limit] of [['gold',9999],['ether',99]]){if(raw[key]!==undefined&&(!Number.isInteger(raw[key])||!finite(raw[key],0,limit)))return null;n[key]=raw[key]??n[key];}
 if(raw.visitedInteriors!==undefined&&(!Array.isArray(raw.visitedInteriors)||raw.visitedInteriors.length>18||new Set(raw.visitedInteriors).size!==raw.visitedInteriors.length||raw.visitedInteriors.some(id=>!BUILDINGS[id])))return null;
 n.visitedInteriors=raw.visitedInteriors||[];if(n.interior&&!n.visitedInteriors.includes(n.interior))return null;
 if(raw.quests!==undefined){if(!raw.quests||typeof raw.quests!=='object'||Array.isArray(raw.quests)||Object.keys(raw.quests).length>6)return null;
  for(const [id,v] of Object.entries(raw.quests)){if(['constructor','prototype','__proto__'].includes(id)||!/^[a-z][a-z0-9-]{0,39}$/.test(id)||!v||!Number.isInteger(v.step)||!finite(v.step,0,8)||typeof v.completed!=='boolean'||typeof v.rewarded!=='boolean'||v.completed!==v.rewarded||!Number.isInteger(v.attempts)||!finite(v.attempts,0,100000))return null;}
  n.quests=Object.fromEntries(Object.entries(raw.quests).map(([id,v])=>[id,{step:v.step,completed:v.completed,rewarded:v.rewarded,attempts:v.attempts}]));
 }
 n.questContent=typeof raw.questContent==='string'&&raw.questContent.length<=30?raw.questContent:null;
 n.trackedQuest=typeof raw.trackedQuest==='string'&&Object.hasOwn(n.quests,raw.trackedQuest)?raw.trackedQuest:null;

 if(!raw.pos||!finite(raw.pos.x,-bounds.x,bounds.x)||!finite(raw.pos.z,-bounds.z,bounds.z)||!Number.isInteger(raw.xp)||!finite(raw.xp,0,10000)||!Number.isInteger(raw.potions)||!finite(raw.potions,0,99))return null;
 const list=(v,allowed)=>Array.isArray(v)&&v.length<=30&&v.every(x=>typeof x==='string'&&(!allowed||allowed.includes(x)))&&new Set(v).size===v.length;
 if(!list(raw.visited,AREA_IDS)||!raw.visited.includes(raw.area)||!list(raw.seals,PUZZLE_IDS)||!list(raw.notes,AREA_IDS)||!list(raw.chests,AREA_IDS)||!list(raw.defeated,Object.keys(ENEMIES))||!list(raw.hints,PUZZLE_IDS))return null;
 if(!Array.isArray(raw.party)||raw.party.length!==2||raw.party.some((h,i)=>!finite(h.hp,0,maxHP(raw,i))||!finite(h.mp,0,maxMP(raw,i))))return null;
 for(const k of ['area','pos','visited','seals','notes','chests','defeated','hints','xp','potions','party'])n[k]=copy(raw[k]);
 n.hero=['male','female'].includes(raw.hero)?raw.hero:'female';n.party.forEach((h,i)=>h.name=i?'Ivo':n.hero==='male'?'Ren':'Mira');n.ended=raw.ended===true&&n.defeated.includes('guardian');n.started=raw.started===true;
 for(const k of PUZZLE_IDS)n.attempts[k]=Number.isInteger(raw.attempts?.[k])&&finite(raw.attempts[k],0,100000)?raw.attempts[k]:0;
 if(raw.battle){const b=raw.battle,e=ENEMIES[b.id];if(!e||(n.defeated.includes(b.id)&&b.practice!==true)||b.practice!==undefined&&typeof b.practice!=='boolean'||b.practice===true&&(n.area!=='quay'||n.interior||!n.defeated.includes(b.id)||b.id==='guardian')||!finite(b.hp,1,e.hp)||![0,1].includes(b.actor)||!Number.isInteger(b.round)||!finite(b.round,1,1000)||!Array.isArray(b.guards)||b.guards.length!==2||b.guards.some(x=>typeof x!=='boolean'))return null;n.battle={id:b.id,hp:b.hp,actor:b.actor,round:b.round,guards:b.guards,inspected:b.inspected===true,log:Array.isArray(b.log)?b.log.filter(x=>typeof x==='string').slice(-5).map(x=>x.slice(0,200)):[]};if(n.party[b.actor].hp<=0)return null;n.battle.practice=b.practice===true;for(const key of ['focus','scorch']){const value=b[key]??[0,0];if(!Array.isArray(value)||value.length!==2||value.some(v=>!Number.isInteger(v)||!finite(v,0,2)))return null;n.battle[key]=[...value];}for(const key of ['ward','exposed']){const value=b[key]??0;if(!Number.isInteger(value)||!finite(value,0,2))return null;n.battle[key]=value;}}
 else if(n.party.every(h=>h.hp<=0))restore(n);
 return n}catch{return null}
}
export function beginBattle(s,id){if(!ENEMIES[id]||s.interior||s.battle||s.defeated.includes(id))return s;if(id==='guardian'&&s.seals.length<4)return s;s.battle={id,practice:false,hp:ENEMIES[id].hp,actor:s.party[0].hp>0?0:1,round:1,guards:[false,false],inspected:s.growth.loadout.some((_,i)=>hasSupport(s.growth,i,'keen')),focus:[0,0],scorch:[0,0],ward:0,exposed:0,log:[`${ENEMIES[id].name} approaches. Watch its next move.`]};return s}
export function beginPractice(s,id){if(s.battle||s.interior||s.area!=='quay'||!['bramble','shard','cinder'].includes(id)||!s.defeated.includes(id))return false;restore(s);s.growth.rally=[0,0];const rehearsal=copy(s);rehearsal.defeated=[];beginBattle(rehearsal,id);s.battle={...rehearsal.battle,practice:true,log:['A remembered opponent takes shape. Practice earns 3 AP; no coins, XP or supplies.']};return true}
export function enemyIntent(s){
 const b=s.battle;if(!b)return '';const heavy=b.round%3===0;
 if(heavy)return b.id==='guardian'&&b.hp<=ENEMIES.guardian.hp/2?'Hollow storm · all heroes. Guard or Shelter.':'Heavy sweep · all heroes. Guard or Shelter.';
 return {bramble:'Root lash · the exposed traveller.',shard:b.round%2===0?'Crystal shell · basic strikes reduced; use a technique or spell.':'Prism pounce · a swift single strike.',cinder:'Ember strike · leaves scorch. Tide or a tonic clears it.',guardian:b.hp<=ENEMIES.guardian.hp/2?'Awakened pulse · stronger single strike.':'Stone pulse · one traveller.'}[b.id];
}
export function battleAction(state,action){
 const s=copy(state),b=s.battle;if(!b)return {state:s,result:'none'};const e=ENEMIES[b.id],i=b.actor,h=s.party[i],level=Math.floor(s.xp/40);let message='',damage=0;
 b.focus??=[0,0];b.scorch??=[0,0];b.ward??=0;b.exposed??=0;
 if(action==='retreat'){if(b.practice){restore(s);s.growth.rally=[0,0];}s.battle=null;return {state:s,result:'retreat',message:'You withdraw safely. The path remains open.'}}
 const ability=Object.hasOwn(ABILITIES,action)?ABILITIES[action]:null;
 if(ability&&(!hasAbility(s.growth,i,action)||ability.kind!=='active'||h.mp<ability.mp))return {state:s,result:'invalid',message:'That technique is not available to this traveller.'};
 if(ability)h.mp-=ability.mp;
 if(action==='attack'){damage=10+level*2+(i===0?3:0)+bonus(s.growth,i,'attack');if(b.id==='shard'&&b.round%2===0)damage=Math.ceil(damage*.6);message=`${h.name} strikes`;}
 else if(['flare','tide','gale'].includes(action)){if(h.mp<4)return {state:s,result:'invalid',message:'Not enough MP. Guard to recover 3 MP.'};h.mp-=4;damage=(action===e.weakness?25:15)+level*2+bonus(s.growth,i,'magic')+(i===1?2:0);if(b.focus[i]){damage=Math.round(damage*1.5);b.focus[i]=0;}if(action==='tide')b.scorch=[0,0];message=`${h.name} uses ${action}${action===e.weakness?' against a weakness':''}`;}
 else if(action==='feint'){damage=8+level+bonus(s.growth,i,'attack');message=`${h.name} draws the foe off balance`;}
 else if(action==='lunge'){damage=24+level*2+bonus(s.growth,i,'attack');message=`${h.name} drives a lantern lunge through the shell`;}
 else if(action==='galeedge'){damage=(e.weakness==='gale'?34:23)+level*2+bonus(s.growth,i,'attack');message=`${h.name} cuts a bright arc of wind`;}
 else if(action==='ward'){b.ward=2;message=`${h.name} shelters the party for two enemy turns.`;}
 else if(action==='mend'){s.party.forEach((p,j)=>p.hp=Math.min(maxHP(s,j),p.hp+20+level*2));message=`${h.name} shares mending light with both travellers.`;}
 else if(action==='focus'){b.focus[i]=1;h.mp=Math.min(maxMP(s,i),h.mp+3);message=`${h.name} gathers light. The next spell is empowered.`;}
 else if(action==='rally'){if(s.growth.rally[i]<100)return {state:s,result:'invalid',message:'Rally is not ready yet.'};s.growth.rally[i]=0;if(i===0){damage=48+level*3+bonus(s.growth,i,'attack');message=`${h.name} unleashes Dawnstride`;}else{s.party.forEach((p,j)=>{p.hp=Math.min(maxHP(s,j),p.hp+32);p.mp=Math.min(maxMP(s,j),p.mp+6)});b.ward=2;b.scorch=[0,0];message='Ivo raises the Hearthlight. The party recovers and gains Shelter.';}}
 else if(action==='guard'){b.guards[i]=true;h.mp=Math.min(maxMP(s,i),h.mp+3);message=`${h.name} braces and recovers 3 MP.`;}
 else if(action==='inspect'){b.inspected=true;message=`${e.name} is vulnerable to ${e.weakness}. ${enemyIntent(s)}`;}
 else if(action==='potion'){if(b.practice)return {state:s,result:'invalid',message:'Practice does not use your supplies. Guard, Shelter or Mend.'};if(!s.potions)return {state:s,result:'invalid',message:'No tonics remain. Rest at Sunward Quay.'};s.potions--;const target=s.party[0].hp/maxHP(s,0)<=s.party[1].hp/maxHP(s,1)?0:1;s.party[target].hp=Math.min(maxHP(s,target),s.party[target].hp+36);b.scorch[target]=0;message=`${h.name} restores 36 HP to ${s.party[target].name}. Scorch clears.`;}
 else return {state:s,result:'invalid'};
 if(damage){if(b.exposed){damage=Math.round(damage*1.5);b.exposed--;}b.hp-=damage;message+=` for ${damage}.`;if(action==='feint')b.exposed=2;}
 if(action!=='rally')s.growth.rally[i]=Math.min(100,s.growth.rally[i]+12);
 b.log.push(message);
 if(b.hp<=0){
  if(b.practice){const mastered=awardAP(s.growth,3);restore(s);s.growth.rally=[0,0];return {state:s,damage:Math.min(damage,state.battle.hp),result:'victory',rewards:{xp:0,gold:0,ap:3,tonics:0,mastered,levelUp:false,practice:true},message:'Practice complete. +3 equipment AP. The spring restores the party.'}}
  const oldLevel=Math.floor(s.xp/40),ap=b.id==='guardian'?6:3,mastered=awardAP(s.growth,ap);s.xp=Math.min(10000,s.xp+e.xp);s.gold=Math.min(9999,s.gold+e.xp);s.defeated.push(b.id);s.potions=Math.min(99,s.potions+1);s.ended=b.id==='guardian';s.battle=null;const levelUp=Math.floor(s.xp/40)>oldLevel;if(levelUp)restore(s);
  return {state:s,damage:Math.min(damage,state.battle.hp),result:s.ended?'ending':'victory',rewards:{xp:e.xp,gold:e.xp,ap,tonics:1,mastered,levelUp},message:`${e.name} rests. +${e.xp} XP · +${e.xp} coins · +${ap} equipment AP · +1 tonic${levelUp?' · Level up! HP and MP restored.':''}`};
 }
 if(i===0&&s.party[1].hp>0)b.actor=1;
 else{
  const heavy=b.round%3===0,awakened=b.id==='guardian'&&b.hp<=e.hp/2;const targets=heavy?[0,1]:[b.round%2];
  for(let target of targets){if(s.party[target].hp<=0)target=1-target;const reduction=(b.guards[target]?.35:1)*(b.ward?.5:1)*(heavy&&hasSupport(s.growth,target,'steadfast')?.75:1);const hit=Math.max(1,Math.round((e.attack*(heavy?1.6:1)*(awakened?1.25:1)-bonus(s.growth,target,'defence'))*reduction));s.party[target].hp=Math.max(0,s.party[target].hp-hit);s.growth.rally[target]=Math.min(100,s.growth.rally[target]+hit*2);b.log.push(`${heavy?'Heavy sweep':'Stone strike'}: ${s.party[target].name} loses ${hit} HP.`);if(b.id==='cinder'&&!hasSupport(s.growth,target,'emberguard'))b.scorch[target]=2;}
  for(let j=0;j<2;j++)if(b.scorch[j]&&s.party[j].hp>0){if(!hasSupport(s.growth,j,'emberguard')){s.party[j].hp=Math.max(0,s.party[j].hp-3);b.log.push(`${s.party[j].name} takes 3 scorch damage.`);}b.scorch[j]--;}
  if(b.ward)b.ward--;
  if(s.party.every(p=>p.hp<=0)){if(b.practice)s.growth.rally=[0,0];restore(s);s.area='quay';s.interior=null;s.pos={x:0,z:3};return {state:s,damage:Math.min(damage,state.battle.hp),result:'defeat',message:'The lantern carries you home. Your restored seals are safe. Rest, then try a different tactic.'}}
  b.round++;b.actor=s.party[0].hp>0?0:1;b.guards=[false,false];
 }
 b.log=b.log.slice(-5);return {state:s,damage:Math.min(damage,state.battle.hp),result:'turn',message};
}
export function checkPuzzle(p,id,value){const q=p.puzzles[id];if(id==='allocation')return Number.isInteger(value)&&value===q.solution;return Array.isArray(value)&&value.length===q.solution.length&&value.every((v,i)=>v===q.solution[i])}
export function solvePuzzle(s,p,id,value){s.attempts[id]=(s.attempts[id]||0)+1;if(checkPuzzle(p,id,value)){if(!s.seals.includes(id))s.seals.push(id);return true}return false}
export function travel(s,area,viaRoad=false){if(!AREA_IDS.includes(area)||s.battle)return false;const entry=viaRoad?MAPS[area].entities.find(e=>e.kind==='exit'&&e.to===s.area):null;s.area=area;s.interior=null;s.pos=entry?{x:entry.x-Math.sign(entry.x)*2.5,z:entry.z-Math.sign(entry.z)*2.5}:{x:0,z:4};if(!s.visited.includes(area))s.visited.push(area);return true}

export function enterBuilding(s,id){const b=BUILDINGS[id];if(!b||s.battle||s.interior||s.area!==b.area)return false;s.interior=id;s.pos={x:0,z:3.5};if(!s.visitedInteriors.includes(id))s.visitedInteriors.push(id);return true}
export function leaveBuilding(s){const b=BUILDINGS[s.interior];if(!b||s.battle)return false;s.interior=null;s.area=b.area;s.pos={x:b.door.x,z:b.door.z+.75};return true}
export const GOODS={tonic:{name:'Tonic',price:12,sell:5,description:'Restores 36 HP to the most injured hero.'},ether:{name:'Ether',price:18,sell:7,description:'Restores 10 MP to the hero who needs it most.'},'brass-pin':{name:'Brass pin',price:35,description:'A shared party charm: maximum HP +6.'},'focus-clasp':{name:'Focus clasp',price:40,description:'A shared party charm: maximum MP +3.'}};
export const SHOP_STOCK={provisions:['tonic','ether'],outfitter:['brass-pin','focus-clasp','tonic'],apothecary:['ether','tonic']};
export function trade(s,item,sell=false){
 const shop=BUILDINGS[s.interior]?.shop,g=GOODS[item];if(!g||!shop||s.battle||!SHOP_STOCK[shop].includes(item))return {ok:false,message:'This trader does not stock that item.'};
 const count=item==='tonic'?'potions':item==='ether'?'ether':null;
 if(sell){if(!count||!s[count])return {ok:false,message:'You have none to sell.'};s[count]--;s.gold=Math.min(9999,s.gold+g.sell);return {ok:true,message:`Sold one ${g.name.toLowerCase()} for ${g.sell} coins.`};}
 if(s.gold<g.price)return {ok:false,message:'Not enough coins.'};
 if(count&&s[count]>=99||!count&&s.gear.includes(item))return {ok:false,message:count?'Your satchel is full.':'You already own this charm.'};
 s.gold-=g.price;if(count)s[count]++;else s.gear.push(item);return {ok:true,message:`Bought ${g.name.toLowerCase()} for ${g.price} coins.`};
}
export function useFieldItem(s,item){
 if(s.battle||!['tonic','ether'].includes(item))return false;const key=item==='tonic'?'potions':'ether',stat=item==='tonic'?'hp':'mp',max=item==='tonic'?maxHP:maxMP;
 if(!s[key])return false;const target=s.party[0][stat]/max(s,0)<=s.party[1][stat]/max(s,1)?0:1;if(s.party[target][stat]>=max(s,target))return false;
 s[key]--;s.party[target][stat]=Math.min(max(s,target),s.party[target][stat]+(item==='tonic'?36:10));return true;
}
export function restAtInn(s){if(s.interior!=='inn'||s.battle||s.gold<8||s.party.every((h,i)=>h.hp===maxHP(s,i)&&h.mp===maxMP(s,i)))return false;s.gold-=8;restore(s);return true}
