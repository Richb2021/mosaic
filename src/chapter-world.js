import * as THREE from 'three';
import {Character} from './character.js';
import {FOES} from './chapter.js';
import {worksHeight} from './chapter-maps.js';
export const WORKS_ASSETS=['works_beetle','works_moth','works_sentry','works_heart','works_turbine','works_pipe','works_pillar','works_console','works_tank','works_bridge'];
export async function loadNessaClips(){const raws=await Promise.all(['arms-folded','walk-formal','interact','fixing'].map(async name=>{const r=await fetch('/assets/npc-clips/anim-'+name+'.json');if(!r.ok)throw Error('Nessa animation missing');return r.json()}));return raws}
export function makeNessa(gltf,raws){
 const rest=gltf.scene.getObjectByName('Hips').position.clone(),names=['Idle','Casual_Walk','Attack','mage_soell_cast','Block1','Hit_Reaction_to_Waist'],indices=[0,1,2,3,0,2];
 const animations=names.map((name,i)=>{const raw=raws[indices[i]],tracks=[];for(const [bone,values] of Object.entries(raw.tracks))if(gltf.scene.getObjectByName(bone)&&values.length)tracks.push(new THREE.QuaternionKeyframeTrack(bone+'.quaternion',raw.times,values));const positions=[];for(let n=0;n<raw.hips.length;n+=3)positions.push(rest.x,rest.y+raw.hips[n+1]*rest.y/.95,rest.z);tracks.push(new THREE.VectorKeyframeTrack('Hips.position',raw.times,positions));return new THREE.AnimationClip(name,-1,tracks)});
 return new Character({scene:gltf.scene,animations},2.25);
}
export function buildWorks(w){
 const room=w.map.id;
 w.mesh(new THREE.BoxGeometry(80,1,80),0x253b42,0,-2,0);
 // Layered foundations continue into the underground instead of a thin floating slab.
 for(const x of [-14,14]){w.mesh(new THREE.BoxGeometry(4,7,28),0x374847,x,-.8,0);for(const z of [-10,-4,2,8])w.mesh(new THREE.BoxGeometry(4.3,.2,1),0x51605a,x,2.7,z)}
 for(const x of [-8,-4,0,4,8])w.mesh(new THREE.BoxGeometry(3.8,1.8,1.2),0x4c5751,x,-1,10.2);
 for(let x=-11;x<=11;x+=2)for(let z=-9;z<=9;z+=2){if(room==='gallery'&&Math.abs(z)<1.5&&Math.abs(x)>2)continue;w.mesh(new THREE.BoxGeometry(1.96,.35,1.96),(x+z)%4===0?0x777a70:0x6c7069,x,-.2,z)}
 w.mesh(new THREE.BoxGeometry(24,5,.65),0x4b5754,0,2.4,-10.3);w.mesh(new THREE.BoxGeometry(.65,5,20),0x4b5754,-12.3,2.4,0);w.mesh(new THREE.BoxGeometry(.65,.7,20),0x4b5754,12.3,.2,0);
 for(const x of [-10,-5,0,5,10]){w.mesh(new THREE.BoxGeometry(.5,5,.8),0x8c8876,x,2.4,-10);w.mesh(new THREE.BoxGeometry(3.5,2,.15),0x273c40,x,2.7,-9.9);w.mesh(new THREE.BoxGeometry(.08,2,.2),0xa48a53,x,2.7,-9.7)}
 for(const x of [-8,8]){const lamp=new THREE.PointLight(room==='heart'?0xf2b773:0xffd593,18,14,2);lamp.position.set(x,3,1);w.root.add(lamp);w.model('lamp',x,-7,.8)}
 if(room==='gallery'){for(const x of [-7,7])w.mesh(new THREE.BoxGeometry(7,.08,.15),0xb29a68,x,.8,.8);}
 if(room==='reservoir'){for(const x of [-7,7])w.mesh(new THREE.BoxGeometry(3.5,.04,4),0x4f9d9d,x,-.01,3)}
 for(const [i,key] of ['route','balance','transfer'].entries())if(w.state.chapter.solved.includes(key)){w.model('crystal',-4+i*4,-7,.45);w.mesh(new THREE.BoxGeometry(3,.04,.12),0xaed4be,-4+i*4,.04,-6)}
 if(w.state.chapter.completed){w.mesh(new THREE.BoxGeometry(18,.06,.1),0xe5c77d,0,.04,-7)}
}
export function addRecruit(w,state){w.recruit=null;w.recruitActor=null;if(!state.chapter?.room||!state.chapter.recruited)return;const actor=makeNessa(w.cache.polyfork_villager_female,w.nessaClips);w.actors.push(actor);w.recruitActor=actor;w.recruit=actor.root;w.recruit.position.set(state.pos.x+1,0,state.pos.z+1.5);w.root.add(w.recruit)}
export function chapterBattle(w,state){
 w.path=[];w.pending=null;w.battling=true;w.resize();w.entities.forEach(({o})=>o.visible=false);w.pulse.forEach(o=>o.visible=false);
 for(const {o} of w.decor)o.visible=false;
 w.hero.position.set(-4,0,3);w.partner.position.set(-5,0,.4);w.recruit.position.set(-4,0,-2.2);
 for(const a of [w.heroActor,w.partnerActor,w.recruitActor]){a.root.rotation.y=Math.PI/2;a.play('idle');if(a.weapon)a.weapon.visible=true}
 w.groupFoes=state.chapter.battle.foes.map((f,i)=>{const o=w.model(FOES[f.kind].asset,3+(i%2)*2,-2.7+i*2.7,f.kind==='heart'?1.05:.9,-Math.PI/2);o.visible=f.hp>0;return o});
 w.mesh(new THREE.CylinderGeometry(8,8,.08,40),0x626b65,0,-.05,0);
 w.targetRing=w.mesh(new THREE.TorusGeometry(1.1,.07,6,32),0xffdf89,0,.12,0);w.targetRing.rotation.x=-Math.PI/2;syncChapterBattle(w,state);
}
export function syncChapterBattle(w,state){const b=state.chapter?.battle;if(!b)return;w.groupFoes?.forEach((o,i)=>o.visible=b.foes[i].hp>0);const t=w.groupFoes?.[b.target];if(t&&w.targetRing){w.targetRing.position.set(t.position.x,.12,t.position.z)} }
export async function playChapterAction(w,action,before,after,result){
 w.actionBusy=true;const actors=[w.heroActor,w.partnerActor,w.recruitActor],actor=actors[before.chapter.battle.actor],mode=action==='guard'?'guard':['attack','break'].includes(action)?'attack':action==='retreat'?'walk':'cast';
 try{const anim=actor.once(mode,.7);await new Promise(r=>setTimeout(r,200));for(const event of result.events){const source=event.enemy!==undefined?w.groupFoes[event.enemy]:actors[event.from].root,target=event.target!==undefined?w.groupFoes[event.target]:actors[event.ally].root;w.effect(source.position.clone().add(new THREE.Vector3(0,1.5,0)),target.position.clone().add(new THREE.Vector3(0,1.3,0)),event.from!==undefined&&event.ally!==undefined?0xace2b1:0xf7c984,event.enemy!==undefined||mode==='attack'?'strike':'magic');w.floatText((event.from!==undefined&&event.ally!==undefined?'+':'−')+event.amount,target.position,event.from!==undefined&&event.ally!==undefined?0xace2b1:0xffddb0);if(event.enemy!==undefined)actors[event.ally].once('hit',.45)}await anim;syncChapterBattle(w,after)}finally{w.actionBusy=false}
}
export function animateWorks(w,dt,moving){
 if(w.recruit&&!w.battling){const walks=!w.paused&&w.followActor(w.recruit,w.partner,dt);w.recruitActor.motion(walks);w.recruit.position.y=worksHeight(w.map,w.recruit.position.x,w.recruit.position.z)}
 if(w.map.works&&!w.battling){w.hero.position.y=worksHeight(w.map,w.hero.position.x,w.hero.position.z);w.partner.position.y=worksHeight(w.map,w.partner.position.x,w.partner.position.z)}
 if(w.reducedMotion)return;
 for(const root of [...(w.decor||[]).filter(d=>d.p.asset==='works_turbine').map(d=>d.o),...(w.groupFoes||[]),...(w.entities||[]).filter(v=>v.e.asset?.startsWith('works_')).map(v=>v.o)]){
  root.traverse(o=>{if(!o.userData.worksRest)o.userData.worksRest={x:o.rotation.x,y:o.rotation.y,z:o.rotation.z};const r=o.userData.worksRest;if(/^turbine_wheel$|^heart_gear\d*$|^gear_back$|^sentry_gear$/.test(o.name))o.rotation.z=r.z+w.clock*.5;if(o.name.startsWith('wing_'))o.rotation.z=r.z+Math.sin(w.clock*7)*.35;if(o.name.startsWith('leg_'))o.rotation.y=r.y+Math.sin(w.clock*3+o.position.z*3)*.1;});
 }
}
