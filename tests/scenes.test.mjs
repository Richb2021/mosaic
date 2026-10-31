import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {initialChronicle,validChronicle,canViewScene,finishScene,discover,SCENES,DISCOVERIES} from '../src/scenes.js';
import {initialState} from '../src/engine.js';
const pack=JSON.parse(fs.readFileSync(new URL('../public/topics/water-and-systems.json',import.meta.url)));
const state=()=>({...initialState(pack),chronicle:initialChronicle()});
test('optional companion scenes require discovery and completion is exactly once',()=>{
 const s=state();assert.equal(canViewScene(s,'archive'),false);assert.ok(canViewScene(s,'quay'));assert.ok(finishScene(s,'quay',1));assert.equal(finishScene(s,'quay',0),false);assert.equal(s.chronicle.choices.quay,1);s.visited.push('beacon');assert.equal(canViewScene(s,'beacon'),false);s.seals=['a','b','c','d'];assert.ok(canViewScene(s,'beacon'));assert.ok(validChronicle(s.chronicle));
});
test('discovery rewards have location checks and cannot duplicate equipment',()=>{
 const s=state();assert.equal(discover(s,'woods-cache'),false);assert.ok(discover(s,'quay-token'));assert.equal(discover(s,'quay-token'),false);assert.equal(s.growth.inventory.filter(x=>x==='reed-coat').length,1);assert.ok(validChronicle(s.chronicle));
});
test('chronicle save validation defaults old saves and rejects forged identities or choices',()=>{
 assert.deepEqual(validChronicle(undefined),initialChronicle());for(const mutate of [s=>s.seen=['constructor'],s=>s.seen=['quay'],s=>s.choices={quay:0},s=>s.finds=['invalid'],s=>{s.seen=['quay'];s.choices={quay:9}}]){const c=initialChronicle();mutate(c);assert.equal(validChronicle(c),null);}
});
