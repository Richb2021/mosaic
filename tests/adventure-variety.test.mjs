import test from 'node:test';
import assert from 'node:assert/strict';
import {ADVENTURE_PACKS,validateAdventureContent} from '../src/game-modes/adventure-content.js';
import {initialAdventureState,reduceAdventure,validateAdventureSave,adventureFingerprint,adventureSaveKey} from '../src/game-modes/adventure-engine.js';
import {draftHash} from '../src/game-modes/draft-engine.js';
const variant=mode=>validateAdventureContent({...structuredClone(ADVENTURE_PACKS[0]),id:'variety-'+mode,setting:mode==='match'?'market':'observatory',sequence:{...ADVENTURE_PACKS[0].sequence,mode,targets:mode==='match'?['Description A','Description B','Description C']:['Category A','Category B'],solution:mode==='match'?[2,0,1]:[1,0,1]}});
test('legacy adventure content identities and save keys remain byte-for-byte compatible',()=>assert.deepEqual(ADVENTURE_PACKS.map(p=>[draftHash(p),adventureFingerprint(p),adventureSaveKey(p)]),[['kf2c1j','stak8r','mosaic:adventure:atlas-water:1:stak8r'],['1loz1ra','1760wka','mosaic:adventure:atlas-woodland:1:1760wka']]));
for(const mode of ['match','sort'])test(mode+' puzzle requires exploration, accepts only its matching rule and resumes the completed ending',()=>{
 const p=variant(mode);let s=initialAdventureState(p);const act=a=>s=reduceAdventure(p,s,a).state;
 act({type:'plate',index:0});assert.equal(s.plates.length,0);act({type:'hero',hero:'female'});act({type:'travel',room:'woods'});act({type:'collect'});act({type:'travel',room:'workshop'});act({type:'repair',item:'tool'});act({type:'travel',room:'archive'});act({type:'inspect'});
 for(const i of mode==='sort'?[0,0,0]:[0,1,2])act({type:'plate',index:i});act({type:'sequence'});assert.equal(s.solved,false);assert.equal(s.attempts,1);assert(validateAdventureSave(s,p));
 act({type:'clear-plates'});for(const index of p.sequence.solution)act({type:'plate',index});act({type:'sequence'});assert.equal(s.solved,true);act({type:'choice',id:p.decision.choices[1].id});assert.equal(s.completed,true);assert.deepEqual(validateAdventureSave(s,p),s);
 assert.equal(validateAdventureSave({...s,plates:[2,2,2]},p),null);
});
test('invalid puzzle combinations, arbitrary settings and partial generation cannot enter the runtime',()=>{
 for(const mutate of [p=>p.setting='https://example.test/image',p=>p.sequence.targets=['One'],p=>p.sequence.solution=[0,0,0],p=>p.sequence.targets=['Same','Same']]){const p=variant('sort');mutate(p);assert.throws(()=>validateAdventureContent(p))}
 const p=variant('match');p.sequence.solution=[0,0,1];assert.throws(()=>validateAdventureContent(p));
});
