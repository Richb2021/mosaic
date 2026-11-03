import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';
import {SCENERY,validScenery,selectedScenery,sceneryChoice,sceneryAssets} from '../src/game-modes/scenery.js';
import {WORLD_PACKS} from '../src/game-modes/adventure-world-packs.js';import {DRAFT_PACKS} from '../src/game-modes/draft-content.js';import {TOWN_PACKS} from '../src/game-modes/town-packs.js';import {ECONOMY_PACKS} from '../src/game-modes/economy-packs.js';import {EXTENDED_PACKS} from '../src/game-modes/extended-packs.js';import {draftHash} from '../src/game-modes/draft-engine.js';import {gameSaveKey} from '../src/game-modes/learning-client.js';
import {newJourney,actJourney,validateJourney,journeyView} from '../src/game-modes/journey-engine.js';import {MAPS,INTERIORS} from '../src/maps.js';import {VARIETY_PROPS} from '../src/variety-props.js';import {propBoxes} from '../src/prop-collision.js';import {blocked,clearSegment} from '../src/navigation.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../public/'+p,import.meta.url),'utf8'));
const manifest=read('game-modes/variety-art/manifest.json'),base={...read('game-modes/art/manifest.json'),town:read('game-modes/town-art/manifest.json'),extended:read('game-modes/extended-art/manifest.json'),expansion:read('game-modes/expansion-art/manifest.json')};
test('every curated collection is complete, local, distinct and within the art budget',()=>{
 assert.equal(validScenery(manifest),manifest);const sums=new Set();let bytes=0;
 for(const {id} of SCENERY.slice(1)){const t=manifest.themes[id];for(const [group,count] of Object.entries({scenes:9,town:20,props:12,craft:8,cards:16})){
  assert.equal(Object.keys(t[group]).length,count,id+'/'+group);
  for(const e of Object.values(t[group])){const file=fs.readFileSync(new URL('../public'+e.url,import.meta.url));assert.equal(crypto.createHash('sha256').update(file).digest('hex'),e.sha256);assert(!sums.has(e.sha256),'duplicate art');sums.add(e.sha256);bytes+=file.length;assert(e.sourceJobId);assert(file.length<500000);if(e.alpha){assert(e.keyJobId);assert.deepEqual(e.anchor,[.5,.94]);}}
 }}assert.equal(sums.size,195);assert(bytes<15e6);
});
test('switching scenery leaves every game pack, citation and save key untouched',()=>{
 const before=JSON.stringify(base),packs=[...WORLD_PACKS,...DRAFT_PACKS,...TOWN_PACKS,...ECONOMY_PACKS,...EXTENDED_PACKS];
 assert.equal(new Set(packs.map(p=>p.template)).size,8);
 for(const p of packs){const content=JSON.stringify(p),hash=draftHash(p),key=gameSaveKey(p,['novel-v1','quiz-v1','sports-v1','merge-v1'].includes(p.template)?'journey':'classic');
  for(const {id} of SCENERY){const a=sceneryAssets(base,manifest,p,id);assert.equal(JSON.stringify(p),content);assert.equal(draftHash(p),hash);assert.equal(gameSaveKey(p,['novel-v1','quiz-v1','sports-v1','merge-v1'].includes(p.template)?'journey':'classic'),key);assert.equal(a.heroes,base.heroes);if(id!=='original'){assert(a.rooms.workshop.includes(id));assert(a.extended.backgrounds.sports.url.includes(id));assert(a.expansion.town.weavery.url.includes(id));}}
 }assert.equal(JSON.stringify(base),before);
});
test('cosmetic preference failures fall back safely and tainted URLs are refused',()=>{
 const pack=WORLD_PACKS[0];assert.equal(sceneryChoice(pack,{getItem(){throw Error('blocked')}}),'auto');assert.equal(sceneryChoice(pack,{getItem(){return 'https://bad.test'}}),'auto');assert.equal(selectedScenery(pack),selectedScenery({...pack}));assert.equal(sceneryAssets(base,null,pack),base);
 const bad=structuredClone(manifest);bad.themes.sunstone.scenes.workshop.url='https://example.test/image.webp';assert.equal(validScenery(bad)?.themes.sunstone,undefined);assert(!sceneryAssets(base,bad,pack,'sunstone').rooms.workshop.includes('/sunstone/'));assert.equal(sceneryAssets(base,{version:1,themes:{sunstone:bad.themes.sunstone}},pack),base);
});
test('an in-progress quiz continues the same encounter after cosmetic remount',()=>{
 const p=EXTENDED_PACKS.find(p=>p.template==='quiz-v1');let r=actJourney(p,newJourney(p,17),{type:'travel',index:0});r=actJourney(p,r,{type:'answer',answer:p.questions[0].solution});const snapshot=JSON.stringify(r),view=journeyView(p,r);
 for(const {id} of SCENERY){sceneryAssets(base,manifest,p,id);const restored=validateJourney(JSON.parse(snapshot),p);assert.deepEqual(journeyView(p,restored),view);assert.deepEqual(actJourney(p,restored,{type:'next'}),actJourney(p,r,{type:'next'}));}
});
test('all 24 new RPG models are placed once or more, with solid measured ground footprints',()=>{
 const models=read('assets/variety-manifest.json').assets;assert.equal(models.length,24);assert.equal(Object.keys(VARIETY_PROPS).length,24);assert(models.reduce((s,m)=>s+m.bytes,0)<3e6);
 for(const m of models){const file=fs.readFileSync(new URL('../public/assets/'+m.asset+'.glb',import.meta.url));assert.equal(file.length,m.bytes);assert.equal(crypto.createHash('sha256').update(file).digest('hex'),m.sha256);const places=Object.values({...MAPS,...INTERIORS}).flatMap(map=>map.props.filter(p=>p.asset===m.asset).map(p=>({map,p})));assert(places.length,m.asset+' not integrated');
  for(const {map,p} of places){assert.equal(p.scale,1);const [x,z,w,h]=propBoxes(p)[0];assert(blocked(map,x,z));assert(!clearSegment(map,{x:x-w/2-1,z},{x:x+w/2+1,z}),m.asset+' can be crossed');assert(w>0&&h>0);}
 }
 const [x,z,w,h]=propBoxes({asset:'var_wheelbarrow',x:3,z:4,rotation:Math.PI/2})[0],b=VARIETY_PROPS.var_wheelbarrow;assert(Math.abs(x-(3+b[1]))<.001);assert(Math.abs(z-(4-b[0]))<.001);assert(Math.abs(w-b[3])<.001);assert(Math.abs(h-b[2])<.001);
});
