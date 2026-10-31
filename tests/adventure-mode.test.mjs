import test from 'node:test';
import assert from 'node:assert/strict';
import {ADVENTURE_PACKS,ADVENTURE_SCHEMA,validateAdventureContent} from '../src/game-modes/adventure-content.js';
import {initialAdventureState,reduceAdventure,validateAdventureSave,adventureSaveKey,adventureFingerprint} from '../src/game-modes/adventure-engine.js';
const copy=v=>JSON.parse(JSON.stringify(v));
const act=(pack,state,action)=>reduceAdventure(pack,state,action).state;
function reachArchive(pack){let s=initialAdventureState(pack);for(const a of [{type:'hero',hero:'male'},{type:'talk'},{type:'inspect'},{type:'travel',room:'woods'},{type:'inspect'},{type:'collect'},{type:'travel',room:'workshop'},{type:'repair',item:'tool'},{type:'travel',room:'archive'},{type:'inspect'}])s=act(pack,s,a);return s}

for(const pack of ADVENTURE_PACKS){
 test(`${pack.id}: complete exploration, item use, evidence puzzle, choice and save roundtrip`,()=>{
  let s=reachArchive(pack);assert.equal(s.room,'archive');assert.equal(s.repaired,true);assert.deepEqual(s.inventory,['keepsake','record']);assert.equal(s.visited.length,3);
  for(const index of pack.sequence.solution)s=act(pack,s,{type:'plate',index});
  let result=reduceAdventure(pack,s,{type:'sequence'});s=result.state;assert.equal(s.solved,true);assert.deepEqual(result.sourceRefs,pack.sequence.sourceRefs);
  for(const choice of pack.decision.choices){const ending=reduceAdventure(pack,s,{type:'choice',id:choice.id});assert.equal(ending.state.completed,true);assert.equal(ending.message,choice.ending);assert.deepEqual(validateAdventureSave(JSON.stringify(ending.state),pack),ending.state)}
 });
}
test('locked archive, incorrect item and incomplete sequence cannot skip the adventure',()=>{
 const p=ADVENTURE_PACKS[0];let s=initialAdventureState(p);s=act(p,s,{type:'travel',room:'archive'});assert.equal(s.room,'workshop');s=act(p,s,{type:'repair',item:'keepsake'});assert.equal(s.repaired,false);assert.deepEqual(s.inventory,['keepsake']);s=act(p,s,{type:'sequence'});assert.equal(s.solved,false);s=act(p,s,{type:'choice',id:p.decision.choices[0].id});assert.equal(s.completed,false);
});
test('wrong sequence gives feedback, retains plates for inspection and records a hint separately',()=>{
 const p=ADVENTURE_PACKS[0];let s=reachArchive(p);for(const index of [0,1,2])s=act(p,s,{type:'plate',index});let r=reduceAdventure(p,s,{type:'sequence'});s=r.state;assert.equal(s.solved,false);assert.equal(s.attempts,1);assert.equal(r.message,p.sequence.failure);assert.deepEqual(s.plates,[0,1,2]);s=act(p,s,{type:'hint',which:'sequence'});s=act(p,s,{type:'hint',which:'sequence'});assert.deepEqual(s.hints,['sequence']);s=act(p,s,{type:'clear-plates'});assert.deepEqual(s.plates,[]);assert.ok(validateAdventureSave(s,p));
});
test('collecting and inspecting twice never duplicates items; ending is stable after completion',()=>{
 const p=ADVENTURE_PACKS[0];let s=act(p,initialAdventureState(p),{type:'travel',room:'woods'});s=act(p,s,{type:'collect'});s=act(p,s,{type:'collect'});assert.deepEqual(s.inventory,['keepsake','tool']);s=reachArchive(p);s=act(p,s,{type:'inspect'});assert.deepEqual(s.inventory,['keepsake','record']);for(const index of p.sequence.solution)s=act(p,s,{type:'plate',index});s=act(p,s,{type:'sequence'});s=act(p,s,{type:'choice',id:p.decision.choices[0].id});s=act(p,s,{type:'choice',id:p.decision.choices[1].id});assert.equal(s.choice,p.decision.choices[0].id);
});
test('topic content can change plate order and correct item labels without game code changes',()=>{
 const p=copy(ADVENTURE_PACKS[0]);p.sequence.steps=['First','Next','Last'];p.sequence.solution=[0,1,2];p.items.tool.name='Demonstration component';validateAdventureContent(p);let s=reachArchive(p);for(const index of [0,1,2])s=act(p,s,{type:'plate',index});assert.equal(act(p,s,{type:'sequence'}).solved,true);
});
test('save identity includes all content and revision, independent of JSON property order',()=>{
 const p=ADVENTURE_PACKS[0],s=initialAdventureState(p),changed=copy(p);changed.rooms.workshop.npc.dialogue+=' A new detail.';assert.notEqual(adventureSaveKey(changed),adventureSaveKey(p));assert.equal(validateAdventureSave(s,changed),null);const reordered=Object.fromEntries(Object.entries(p).reverse());assert.equal(adventureFingerprint(p),adventureFingerprint(reordered));const revision=copy(p);revision.revision++;assert.notEqual(adventureSaveKey(p),adventureSaveKey(revision));
});
test('corrupted save progress and arbitrary fields are rejected',()=>{
 const p=ADVENTURE_PACKS[0],cases=[s=>s.inventory.push('unknown'),s=>s.positions.workshop.x=1000,s=>s.room='unknown',s=>s.completed=true,s=>s.repaired=true,s=>s.plates=[0,0],s=>s.injected='script',s=>s.visited.push('archive')];
 for(const corrupt of cases){const s=initialAdventureState(p);corrupt(s);assert.equal(validateAdventureSave(s,p),null)}assert.equal(validateAdventureSave('{broken',p),null);
});
test('strict content rejects invented citations, executable fields, external asset paths and invalid solutions',()=>{
 const base=ADVENTURE_PACKS[0],cases=[p=>p.rooms.woods.clue.sourceRefs=['invented'],p=>p.items.tool.icon='https://example.org/asset.png',p=>p.run='alert(1)',p=>p.sequence.solution=[1,1,2],p=>p.sequence.steps=['same','same','last'],p=>p.sources.push(copy(p.sources[0]))];for(const mutate of cases){const p=copy(base);mutate(p);assert.throws(()=>validateAdventureContent(p))}
 assert.equal(ADVENTURE_SCHEMA.additionalProperties,false);assert.equal(Object.hasOwn(ADVENTURE_SCHEMA.properties,'sources'),false);
});
test('content validation returns an independent copy',()=>{const original=copy(ADVENTURE_PACKS[0]),clean=validateAdventureContent(original);clean.items.tool.name='Changed';assert.notEqual(original.items.tool.name,clean.items.tool.name)});
