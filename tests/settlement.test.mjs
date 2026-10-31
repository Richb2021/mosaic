import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {initialState,validSave,validatePack,travel,enterBuilding,leaveBuilding,trade,useFieldItem,restAtInn,maxHP,maxMP,beginBattle} from '../src/engine.js';
import {MAPS,INTERIORS,BUILDINGS,blocked,findPath} from '../src/maps.js';
import {validateSettlement,bindSettlement,acceptQuest,advanceQuest,fallbackSettlement} from '../src/quests.js';
const ids=['water-and-systems','fractions-and-proportion','evidence-and-arguments'];
const packs=ids.map(id=>validatePack(fs.readFileSync(new URL('../public/topics/'+id+'.json',import.meta.url),'utf8')));
const stories=ids.map(id=>validateSettlement(JSON.parse(fs.readFileSync(new URL('../public/settlements/'+id+'.json',import.meta.url)))));
test('all eighteen buildings have reachable doors, room interactions and safe returns',()=>{
 assert.equal(Object.keys(BUILDINGS).length,18);
 for(const b of Object.values(BUILDINGS)){
  const s=initialState(packs[0]);travel(s,b.area);const door=MAPS[b.area].entities.find(e=>e.building===b.id);
  assert.ok(findPath(MAPS[b.area],s.pos,door).length,b.id+' door');assert.ok(enterBuilding(s,b.id));assert.ok(validSave(s,packs[0]));
  for(const e of INTERIORS[b.id].entities){assert.ok(findPath(INTERIORS[b.id],s.pos,e).length,b.id+' '+e.id);assert.ok(!blocked(INTERIORS[b.id],e.x,e.z),b.id+' anchor');}
  assert.ok(leaveBuilding(s));assert.ok(!blocked(MAPS[b.area],s.pos.x,s.pos.z));assert.ok(Math.hypot(s.pos.x-door.x,s.pos.z-door.z)<1);assert.ok(validSave(s,packs[0]));
 }
});
test('legacy saves receive village fields without losing the completed adventure',()=>{
 const s=initialState(packs[0]);s.seals=['sequence'];s.notes=['woods'];s.xp=22;s.potions=6;
 for(const k of ['interior','visitedInteriors','gold','ether','gear','quests','questContent','trackedQuest'])delete s[k];
 const loaded=validSave(s,packs[0]);assert.deepEqual(loaded.seals,['sequence']);assert.equal(loaded.xp,22);assert.equal(loaded.potions,6);assert.equal(loaded.gold,40);
 loaded.gold=7;assert.equal(validSave(loaded,packs[0]).gold,7);
});
test('malformed room and economy saves fail closed, and indoor saves retain the room',()=>{
 for(const mutation of [s=>s.interior='unknown',s=>{s.interior='inn';s.area='woods'},s=>s.gold=-1,s=>s.ether=1.2,s=>s.gear=['brass-pin','brass-pin'],s=>s.quests={bad:{step:99}},s=>s.visitedInteriors=['missing']]){const s=initialState(packs[0]);mutation(s);assert.equal(validSave(s,packs[0]),null);}
 const s=initialState(packs[0]);enterBuilding(s,'inn');assert.equal(validSave(s,packs[0]).interior,'inn');s.pos.x=10;assert.equal(validSave(s,packs[0]),null);
});
test('shops debit and credit once, refuse unsupported goods and prevent duplicate charms',()=>{
 const s=initialState(packs[0]);assert.equal(trade(s,'tonic').ok,false);enterBuilding(s,'provisioner');assert.ok(trade(s,'tonic').ok);assert.equal(s.gold,28);assert.equal(s.potions,4);
 assert.ok(trade(s,'tonic',true).ok);assert.equal(s.gold,33);assert.equal(s.potions,3);assert.equal(trade(s,'brass-pin').ok,false);
 leaveBuilding(s);travel(s,'forge');enterBuilding(s,'outfitter');s.gold=70;assert.ok(trade(s,'brass-pin').ok);assert.equal(maxHP(s,0),70);assert.equal(trade(s,'brass-pin').ok,false);assert.equal(s.gold,35);assert.ok(validSave(s,packs[0]));
 s.gold=0;assert.equal(trade(s,'tonic').ok,false);assert.equal(s.gold,0);
});
test('items heal without being consumed at full health, and the inn charges only at its location',()=>{
 const s=initialState(packs[0]);assert.equal(useFieldItem(s,'tonic'),false);assert.equal(s.potions,3);s.party[1].hp=1;assert.ok(useFieldItem(s,'tonic'));assert.equal(s.party[1].hp,37);
 s.ether=1;s.party[0].mp=0;assert.ok(useFieldItem(s,'ether'));assert.equal(s.party[0].mp,10);assert.equal(restAtInn(s),false);enterBuilding(s,'inn');assert.ok(restAtInn(s));assert.equal(s.gold,32);assert.equal(s.party[0].mp,maxMP(s,0));
});
test('all nine authored quest chains require clues, accept their solution and reward exactly once',()=>{
 for(const [index,story] of stories.entries())for(const q of story.quests){
  const s=initialState(packs[index]);bindSettlement(s,story);assert.equal(acceptQuest(s,story,q.id),false);travel(s,BUILDINGS[q.giver].area);enterBuilding(s,q.giver);assert.ok(acceptQuest(s,story,q.id));assert.equal(acceptQuest(s,story,q.id),false);
  assert.equal(advanceQuest(s,story,q.id,'workbench',0).ok,false);const gold=s.gold;
  for(const step of q.steps){leaveBuilding(s);travel(s,BUILDINGS[step.location].area);enterBuilding(s,step.location);
   if(step.challenge){const current=s.quests[q.id].step;assert.equal(advanceQuest(s,story,q.id,step.target,-1).ok,false);assert.equal(s.quests[q.id].step,current);assert.equal(s.gold,gold);}
   assert.ok(advanceQuest(s,story,q.id,step.target,step.challenge?.solution).ok);assert.ok(validSave(s,packs[index]));
  }
  assert.equal(s.gold,gold+q.reward.gold);assert.equal(s.quests[q.id].completed,true);assert.equal(advanceQuest(s,story,q.id,'resident').ok,false);assert.equal(s.gold,gold+q.reward.gold);
 }
});
test('custom topic export/import supports authored settlements and a topic-derived fallback',()=>{
 const p=structuredClone(packs[1]);p.id='custom-workshop';p.settlement=stories[1];assert.equal(validatePack(p).settlement.quests.length,3);
 const bad=structuredClone(p);bad.settlement.quests[0].steps[0].location='unknown-room';assert.throws(()=>validatePack(bad));
 const bad2=structuredClone(p);bad2.settlement.quests[0].steps[2].challenge.solution=99;assert.throws(()=>validatePack(bad2));
 const fallback=fallbackSettlement(packs[0]);assert.equal(fallback.quests[0].steps[2].challenge.solution,packs[0].puzzles.allocation.solution);
});
test('indoor exploration cannot start field combat and fast travel clears the room',()=>{
 const s=initialState(packs[0]);enterBuilding(s,'inn');beginBattle(s,'bramble');assert.equal(s.battle,null);travel(s,'woods');assert.equal(s.interior,null);assert.equal(s.area,'woods');
});
test('story wording edits preserve active clues and completed rewards remain claimed after a structural revision',()=>{
 const story=structuredClone(stories[0]),s=initialState(packs[0]);bindSettlement(s,story);enterBuilding(s,'inn');acceptQuest(s,story,'community');s.quests.community.step=1;
 story.quests[0].offer+=' The kettle is on.';story.residentLines={inn:'Welcome, traveller.'};bindSettlement(s,story);assert.equal(s.quests.community.step,1);
 s.quests.community={step:story.quests[0].steps.length,completed:true,rewarded:true,attempts:2};s.gold=80;story.quests[0].reward.gold=50;bindSettlement(s,story);assert.equal(s.quests.community.completed,true);assert.equal(acceptQuest(s,story,'community'),false);assert.equal(advanceQuest(s,story,'community','resident').ok,false);assert.equal(s.gold,80);
});
test('saved quest entries discard extra fields and reject prototype identities',()=>{
 const s=initialState(packs[0]);s.quests.community={step:0,completed:false,rewarded:false,attempts:0,extra:'discard me'};s.trackedQuest='constructor';const loaded=validSave(s,packs[0]);assert.equal(loaded.quests.community.extra,undefined);assert.equal(loaded.trackedQuest,null);
 s.quests=JSON.parse('{"constructor":{"step":0,"completed":false,"rewarded":false,"attempts":0}}');assert.equal(validSave(s,packs[0]),null);
});

test('settlement validation accepts only declared locations, never inherited object names',()=>{
 for(const value of ['constructor','toString','__proto__']){const story=structuredClone(stories[0]);story.quests[0].steps[0].location=value;assert.throws(()=>validateSettlement(story));}
});
test('room conversations stop at a reachable distance instead of merging with the resident',async()=>{
 const {World}=await import('../src/world.js');
 for(const room of Object.values(INTERIORS))for(const e of room.entities.filter(e=>['resident','visitor'].includes(e.kind))){
  const w={paused:false,battling:false,map:room,playerPos:{x:0,z:3.5},marker:{position:{set(){}}},onArrival(){}};
  assert.ok(World.prototype.walkTo.call(w,e));const last=w.path.at(-1),distance=Math.hypot(last.x-e.x,last.z-e.z);assert.ok(distance>=1&&distance<=1.5,room.name+' '+e.id);assert.ok(!blocked(room,last.x,last.z));
 }
});
