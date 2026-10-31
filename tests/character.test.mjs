import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Character} from '../src/character.js';
function actor(){const scene=new THREE.Group();const body=new THREE.Mesh(new THREE.BoxGeometry(1,2,1),new THREE.MeshBasicMaterial());body.name='Body';scene.add(body);const animations=['Idle','Casual_Walk','Attack','mage_soell_cast','Block1','Hit_Reaction_to_Waist'].map((n,i)=>new THREE.AnimationClip(n,1,[new THREE.NumberKeyframeTrack('Body.rotation[z]',[0,.5,1],[0,.1+i*.12,0])]));return new Character({scene,animations})}
function advance(a,seconds){for(let t=0;t<seconds;t+=.025)a.update(.025)}
test('completed one-shots fade out instead of contaminating later idle poses',async()=>{const a=actor();for(const clip of ['attack','cast','guard','hit','attack']){const done=a.once(clip,.4);advance(a,.7);assert.equal(await done,true);assert.equal(a.current,'idle');assert.deepEqual(a.snapshot().activeAnimations.map(x=>x.name),['idle']);assert.equal(a.locked,false)}a.dispose()});
test('one-shot idle restarts as a repeating idle after Inspect or Retreat',async()=>{const a=actor();const done=a.once('idle',.25);advance(a,.6);assert.equal(await done,true);assert.equal(a.actions.idle.loop,THREE.LoopRepeat);assert.equal(a.actions.idle.paused,false);a.dispose()});
test('a second action settles the interrupted action and leaves no lock',async()=>{const a=actor();const first=a.once('attack',1);advance(a,.2);const second=a.once('hit',.3);assert.equal(await first,false);advance(a,.6);assert.equal(await second,true);assert.equal(a.locked,false);a.dispose()});
test('locomotion replacement settles an interrupted one-shot',async()=>{const a=actor();const done=a.once('cast',1);advance(a,.15);a.play('walk');assert.equal(await done,false);assert.equal(a.locked,false);advance(a,.3);assert.deepEqual(a.snapshot().activeAnimations.map(x=>x.name),['walk']);a.dispose()});
test('disposal settles a pending action and removes its listener',async()=>{const a=actor();const done=a.once('attack');a.dispose();assert.equal(await done,false);assert.equal(a.pending,null);assert.equal(a.locked,false)});
test('an unknown action rejects immediately instead of hanging',async()=>{const a=actor();await assert.rejects(a.once('not-a-clip'),/Unknown character animation/);assert.equal(a.locked,false);a.dispose()});
