import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {MAPS,blocked,findPath,WORLD_BOUNDS} from '../src/maps.js';
import {initialState,validSave,travel,validatePack} from '../src/engine.js';
const pack=validatePack(fs.readFileSync(new URL('../public/topics/water-and-systems.json',import.meta.url),'utf8'));

test('every road connects cardinal neighbours and arrives on the reciprocal road',()=>{
 for(const [id,map] of Object.entries(MAPS))for(const exit of map.entities.filter(e=>e.kind==='exit')){
  const other=MAPS[exit.to],back=other.entities.find(e=>e.to===id);
  assert.ok(back);assert.equal(Math.abs(other.worldCell[0]-map.worldCell[0])+Math.abs(other.worldCell[1]-map.worldCell[1]),1);
  assert.equal(exit.x+back.x,0);assert.equal(exit.z+back.z,0);
  const s=initialState(pack);s.area=id;assert.ok(travel(s,exit.to,true));
  assert.ok(!blocked(other,s.pos.x,s.pos.z));
  assert.equal(Math.hypot(s.pos.x-back.x,s.pos.z-back.z),2.5);
  for(const anchor of other.entities)assert.ok(findPath(other,s.pos,anchor).length,`${id} → ${exit.to}: ${anchor.id}`);
 }
});
test('forest and cliff boundaries block walking while road openings remain accessible',()=>{
 for(const map of Object.values(MAPS)){
  assert.ok(map.backdrop.length>250);
  for(const [x,z] of map.boundaries)assert.ok(blocked(map,x,z));
  for(const e of map.entities.filter(e=>e.kind==='exit'))assert.ok(!blocked(map,e.x,e.z));
  assert.ok(blocked(map,WORLD_BOUNDS.x+1,0));assert.ok(blocked(map,0,WORLD_BOUNDS.z+1));
 }
});
test('old saves remain valid and new outer-district positions survive save validation',()=>{
 const s=initialState(pack);assert.ok(validSave(s,pack));
 s.pos={x:18.5,z:0};assert.deepEqual(validSave(s,pack).pos,s.pos);
 s.pos.x=23;assert.equal(validSave(s,pack),null);
});
test('fast travel keeps the town-centre arrival independently of road arrivals',()=>{
 const s=initialState(pack);travel(s,'woods',true);travel(s,'quay');assert.deepEqual(s.pos,{x:0,z:4});
});
