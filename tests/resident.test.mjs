import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Resident} from '../src/resident.js';
const raw=JSON.parse(fs.readFileSync(new URL('../public/assets/npc-clips/anim-talking.json',import.meta.url)));
test('native Polyfork NPC clips animate cloned skeletons without changing the T-pose source',async()=>{
 for(const id of ['villager','villager_female','merchant','tradesman']){
  const bytes=fs.readFileSync(new URL('../public/assets/polyfork_'+id+'.glb',import.meta.url));
  const g=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  let sourceArm;g.scene.traverse(o=>{if(o.isBone&&o.name==='LeftArm')sourceArm=o});const rest=sourceArm.quaternion.toArray();
  const a=new Resident(g,raw),b=new Resident(g,raw);const first=a.snapshot();a.update(.5);
  assert.notDeepEqual(a.snapshot().arm,first.arm,id);assert.deepEqual(b.snapshot(),first,id+' clone isolation');assert.deepEqual(sourceArm.quaternion.toArray(),rest,id+' unchanged source');
  assert.ok(a.snapshot().arm.every(Number.isFinite));a.dispose();b.dispose();
 }
});
