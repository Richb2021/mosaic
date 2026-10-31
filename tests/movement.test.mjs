import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {advancePath} from '../src/movement.js';
import {MAPS,findPath,blocked} from '../src/maps.js';
import {Character} from '../src/character.js';

const map={bounds:{x:10,z:10},obstacles:[[0,0,2,2]]};
function actor(){
 const scene=new THREE.Group(),body=new THREE.Mesh(new THREE.BoxGeometry(1,2,1),new THREE.MeshBasicMaterial());body.name='Body';scene.add(body);
 const animations=['Idle','Casual_Walk','Attack','mage_soell_cast','Block1','Hit_Reaction_to_Waist'].map((name,i)=>new THREE.AnimationClip(name,1,[new THREE.NumberKeyframeTrack('Body.rotation[z]',[0,.5,1],[0,.1+i*.12,0])]));
 return new Character({scene,animations});
}

for(const fps of [30,60,144])test(`clicked paths keep an uninterrupted gait through corners at ${fps}fps`,()=>{
 const position={x:-3,z:0},path=findPath(map,position,{x:3,z:0}),destination={...path.at(-1)},a=actor(),dt=1/fps;let frames=0,elapsed=0;
 assert.ok(path.length>4,'path crosses many grid waypoints');
 while(path.length&&frames++<1000){
  const step=advancePath(map,position,path,4*dt);a.motion(step.moving);a.update(dt);elapsed+=dt;
  assert.ok(step.moving,'no artificial stationary frame at a waypoint');
  assert.equal(a.current,'walk');assert.ok(!blocked(map,position.x,position.z));
  // Restarting the clip at a waypoint loses its accumulated phase.
  assert.ok(Math.abs(a.actions.walk.time-(elapsed%1))<1e-8||Math.abs(a.actions.walk.time-(elapsed%1))>1-1e-8);
 }
 assert.ok(frames<1000);assert.deepEqual(position,destination);
 const stopped=advancePath(map,position,path,4*dt);a.motion(stopped.moving);for(let i=0;i<20;i++)a.update(dt);
 assert.equal(a.current,'idle');assert.deepEqual(a.snapshot().activeAnimations.map(x=>x.name),['idle']);a.dispose();
});

test('a waypoint already reached consumes no travel time and arrival never overshoots',()=>{
 const position={x:-3,z:0},path=[{...position},{x:-2.95,z:0},{x:-2.95,z:.05}];
 const result=advancePath(map,position,path,.16);
 assert.deepEqual(position,{x:-2.95,z:.05});assert.equal(path.length,0);assert.ok(result.moving);
 assert.ok(Math.abs(result.dx-.05)<1e-10);assert.equal(result.dz,.05);
});

test('a stale path with both movement axes blocked stops without walking on the spot',()=>{
 const position={x:-1.3,z:0},path=[{x:0,z:0}];
 const result=advancePath(map,position,path,.16);
 assert.deepEqual(position,{x:-1.3,z:0});assert.equal(result.moving,false);assert.equal(result.blocked,true);assert.equal(path.length,0);
});

test('a clicked route can slide clear of a Quay obstacle after an off-grid keyboard arrival',()=>{
 const quay=MAPS.quay,position={x:-6.6,z:4.29},path=findPath(quay,position,{x:-5,z:6}),destination={...path.at(-1)};
 assert.equal(blocked(quay,position.x,position.z),false);assert.ok(path.length);
 let frames=0;
 while(path.length&&frames++<200){
  const before={...position},result=advancePath(quay,position,path,4/60);
  assert.equal(result.blocked,false,'sliding must not discard the valid route');
  assert.equal(result.moving,true,'a usable axis should keep the character walking');
  assert.equal(blocked(quay,position.x,position.z),false,'the player must remain outside the obstacle');
  assert.ok(Math.hypot(position.x-before.x,position.z-before.z)<=4/60+1e-9,'sliding respects the travel budget');
 }
 assert.ok(frames<200);assert.deepEqual(position,destination);
});

test('motion updates cannot interrupt a locked strike or spell',async()=>{
 const a=actor();
 for(const action of ['attack','cast']){
  const done=a.once(action,.4);
  for(let i=0;i<6;i++){a.motion(i%2===0);a.update(.025);assert.equal(a.current,action)}
  for(let i=0;i<20;i++)a.update(.025);
  assert.equal(await done,true);assert.equal(a.current,'idle');assert.equal(a.locked,false);
 }
 a.dispose();
});
