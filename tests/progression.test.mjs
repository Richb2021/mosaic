import test from 'node:test';import assert from 'node:assert/strict';
import {initialGrowth,validGrowth,EQUIPMENT,hasAbility,equip,awardAP,toggleSupport,hasSupport,buyEquipment,bonus} from '../src/progression.js';
test('legacy growth defaults and malformed loadouts fail closed',()=>{
 assert.deepEqual(validGrowth(undefined),initialGrowth());
 for(const mutate of [g=>g.inventory.push('constructor'),g=>g.rally[0]=101,g=>g.loadout[0].weapon='keeper-staff',g=>g.ap[0].feint=99,g=>g.loadout[0].support=['keen'],g=>g.inventory.push('travel-coat')]){const g=initialGrowth();mutate(g);assert.equal(validGrowth(g),null);}
});
test('equipment grants role-specific skills and AP mastery survives unequipping',()=>{
 const g=initialGrowth();g.inventory.push('brass-sabre');assert.ok(hasAbility(g,0,'feint'));assert.equal(hasAbility(g,1,'feint'),false);assert.equal(equip(g,1,'brass-sabre'),false);
 assert.ok(equip(g,0,'brass-sabre'));assert.equal(hasAbility(g,0,'feint'),false);assert.ok(hasAbility(g,0,'lunge'));assert.equal(bonus(g,0,'attack'),5);
 assert.equal(awardAP(g,3).length,0);awardAP(g,3);assert.ok(awardAP(g,3).some(x=>x.id==='lunge'));assert.ok(equip(g,0,'courier-blade'));assert.ok(hasAbility(g,0,'lunge'));assert.ok(validGrowth(g));
});
test('support abilities require activation and obey the three-point budget',()=>{
 const g=initialGrowth();g.inventory.push('reed-coat');equip(g,0,'reed-coat');assert.equal(hasSupport(g,0,'steadfast'),false);assert.ok(toggleSupport(g,0,'steadfast'));assert.ok(hasSupport(g,0,'steadfast'));g.ap[0].keen=12;assert.equal(toggleSupport(g,0,'keen'),false);g.ap[0].emberguard=12;assert.ok(toggleSupport(g,0,'emberguard'));assert.ok(validGrowth(g));equip(g,0,'travel-coat');assert.equal(hasSupport(g,0,'steadfast'),false);assert.ok(hasSupport(g,0,'emberguard'));
});
test('outfitter transactions require the right room, funds and unique ownership',()=>{
 const s={gold:100,interior:null,battle:null,growth:initialGrowth()};assert.equal(buyEquipment(s,'tide-rod'),false);s.interior='outfitter';assert.ok(buyEquipment(s,'tide-rod'));assert.equal(s.gold,56);assert.equal(buyEquipment(s,'tide-rod'),false);assert.equal(buyEquipment(s,'ember-staff'),false);assert.equal(s.gold,56);
});
import fs from 'node:fs';
import {initialState,validSave,beginBattle,battleAction,restore,ENEMIES} from '../src/engine.js';
const pack=JSON.parse(fs.readFileSync(new URL('../public/topics/water-and-systems.json',import.meta.url)));
test('old progressed indoor and combat saves retain all original fields',()=>{
 for(const indoor of [true,false]){
  const s=initialState(pack);s.started=true;s.xp=22;s.gold=75;s.seals=['sequence'];s.visited=['quay','woods'];s.notes=['woods'];s.party[1].hp=33;
  if(indoor){s.interior='inn';s.visitedInteriors=['inn'];s.pos={x:0,z:3.5};}else{beginBattle(s,'bramble');s.battle.hp=20;delete s.battle.focus;delete s.battle.ward;delete s.battle.scorch;delete s.battle.exposed;}
  delete s.growth;const loaded=validSave(s,pack);assert.ok(loaded);for(const key of ['area','pos','party','xp','gold','seals','notes','interior','visitedInteriors'])assert.deepEqual(loaded[key],s[key],key);assert.deepEqual(loaded.growth,initialGrowth());if(!indoor){assert.equal(loaded.battle.hp,20);assert.deepEqual(loaded.battle.focus,[0,0]);}
 }
});
test('skills enforce ownership and MP, expose improves damage, Shelter reduces a whole enemy turn',()=>{
 let s=initialState(pack);beginBattle(s,'guardian');s.seals=['sequence','allocation','matching','dials'];beginBattle(s,'guardian');
 assert.equal(battleAction(s,'ward').result,'invalid');s.party[0].mp=2;assert.equal(battleAction(s,'feint').result,'invalid');s.party[0].mp=16;
 const feint=battleAction(s,'feint').state;assert.equal(feint.battle.exposed,2);const hit=battleAction(feint,'flare');assert.ok(hit.state.battle.hp<feint.battle.hp-15);
 const ward=battleAction(battleAction(s,'inspect').state,'ward').state,plain=battleAction(battleAction(s,'inspect').state,'inspect').state;assert.ok(ward.party[1].hp>plain.party[1].hp);assert.equal(ward.battle.ward,1);
});
test('Rally is earned and spent once; victory awards equipment AP once',()=>{
 let s=initialState(pack);beginBattle(s,'bramble');assert.equal(battleAction(s,'rally').result,'invalid');s.growth.rally[0]=100;const r=battleAction(s,'rally');assert.equal(r.result,'victory');assert.equal(r.state.growth.rally[0],0);assert.equal(r.rewards.ap,3);assert.equal(r.state.growth.ap[0].feint,3);assert.equal(battleAction(r.state,'rally').result,'none');assert.ok(validSave(r.state,pack));
});
test('bad battle effect saves cannot introduce unbounded or nonnumeric counters',()=>{
 const s=initialState(pack);beginBattle(s,'bramble');for(const v of [NaN,-1,8]){const bad=structuredClone(s);bad.battle.ward=v;assert.equal(validSave(bad,pack),null);}const bad=structuredClone(s);bad.battle.scorch=[0,Infinity];assert.equal(validSave(bad,pack),null);
});
import {beginPractice} from '../src/engine.js';
test('practice is repeatable after completion without farming story rewards or supplies',()=>{
 let s=initialState(pack);assert.equal(beginPractice(s,'bramble'),false);s.defeated=['bramble','guardian'];s.ended=true;s.party[0].hp=4;
 for(let n=0;n<2;n++){assert.ok(beginPractice(s,'bramble'));assert.equal(s.party[0].hp,64);assert.ok(validSave(s,pack));assert.equal(battleAction(s,'potion').result,'invalid');const before={xp:s.xp,gold:s.gold,potions:s.potions,defeated:[...s.defeated]};let r;while(s.battle){r=battleAction(s,'flare');s=r.state;}assert.equal(r.rewards.ap,3);assert.equal(r.rewards.gold,0);for(const k of Object.keys(before))assert.deepEqual(s[k],before[k]);assert.equal(s.ended,true);assert.equal(s.growth.rally[0],0);}
 assert.equal(s.growth.ap[0].feint,6);assert.ok(beginPractice(s,'bramble'));const malformed=structuredClone(s);malformed.area='woods';malformed.visited.push('woods');assert.equal(validSave(malformed,pack),null);s=battleAction(s,'retreat').state;assert.equal(s.party[1].mp,24);assert.equal(s.ended,true);
});
test('defeat reports the actual player hit instead of the enemy remaining health',()=>{
 let s=initialState(pack);beginBattle(s,'bramble');s.battle.actor=1;s.battle.round=3;s.party.forEach(h=>h.hp=1);const r=battleAction(s,'attack');assert.equal(r.result,'defeat');assert.equal(r.damage,10);assert.equal(r.state.battle,null);
});
test('scorch is cleared by Tide and prevented by activated Ember guard',()=>{
 const s=initialState(pack);beginBattle(s,'cinder');s.battle.actor=1;const burned=battleAction(s,'inspect').state;assert.equal(burned.battle.scorch[1],1);assert.equal(burned.party[1].hp,42);const cleared=battleAction(burned,'tide').state;assert.deepEqual(cleared.battle.scorch,[0,0]);
 const protectedState=initialState(pack);protectedState.growth.inventory.push('cinder-cloak');equip(protectedState.growth,1,'cinder-cloak');toggleSupport(protectedState.growth,1,'emberguard');beginBattle(protectedState,'cinder');protectedState.battle.actor=1;const safe=battleAction(protectedState,'inspect').state;assert.equal(safe.battle.scorch[1],0);assert.equal(safe.party[1].hp,46);
});
test('Gather light empowers one spell and Keen eye reveals the encounter',()=>{
 let s=initialState(pack);s.growth.inventory.push('ember-staff','survey-jacket');equip(s.growth,1,'ember-staff');equip(s.growth,1,'survey-jacket');toggleSupport(s.growth,1,'keen');beginBattle(s,'bramble');assert.equal(s.battle.inspected,true);s.battle.actor=1;s.party[1].mp=10;s=battleAction(s,'focus').state;assert.equal(s.party[1].mp,13);s=battleAction(s,'guard').state;const r=battleAction(s,'tide');assert.equal(r.damage,33);assert.equal(r.state.battle.focus[1],0);assert.equal(r.state.party[1].mp,9);
});
test('crystal shell reduces basic strikes while lunge bypasses it, and the Warden awakens',()=>{
 const s=initialState(pack);s.growth.inventory.push('brass-sabre');equip(s.growth,0,'brass-sabre');beginBattle(s,'shard');const normal=battleAction(s,'attack').damage;s.battle.round=2;assert.ok(battleAction(s,'attack').damage<normal);assert.equal(battleAction(s,'lunge').damage,29);
 const w=initialState(pack);w.seals=['sequence','allocation','matching','dials'];beginBattle(w,'guardian');w.battle.actor=1;const calm=battleAction(w,'inspect').state;w.battle.hp=60;const awakened=battleAction(w,'inspect').state;assert.ok(awakened.party[1].hp<calm.party[1].hp);
});
