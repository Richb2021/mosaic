import * as THREE from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
const NAMES={idle:'Idle',walk:'Casual_Walk',attack:'Attack',cast:'mage_soell_cast',guard:'Block1',hit:'Hit_Reaction_to_Waist'};
export class Character{
 constructor(gltf,height=2.3){this.root=new THREE.Group();this.skin=clone(gltf.scene);this.root.add(this.skin);this.mixer=new THREE.AnimationMixer(this.skin);this.actions={};this.current='';this.locked=false;this.speed=1;this.root.userData.character=this;
 for(const [key,name] of Object.entries(NAMES)){const original=gltf.animations.find(a=>a.name===name||a.name.endsWith(name)||a.name.includes(name));if(!original)throw Error(`Missing ${key} character animation`);const clip=original.clone();
 // Keep the controller in charge of travel. Preserve the rig's vertical gait.
 for(const track of clip.tracks)if(/Hips\.position$/.test(track.name)){for(let i=0;i<track.values.length;i+=3){track.values[i]=track.values[0];track.values[i+2]=track.values[2]}}
 this.actions[key]=this.mixer.clipAction(clip);}
 this.play('idle');this.mixer.update(.01);this.skin.updateMatrixWorld(true);this.skin.traverse(o=>{if(o.isSkinnedMesh){o.skeleton.update();o.computeBoundingBox()}});const box=new THREE.Box3().setFromObject(this.skin,true),size=box.getSize(new THREE.Vector3()),scale=height/size.y;this.skin.scale.multiplyScalar(scale);this.skin.position.add(new THREE.Vector3(-(box.min.x+box.max.x)/2*scale,-box.min.y*scale,-(box.min.z+box.max.z)/2*scale));this.root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false}});
 }
 play(name,once=false,duration=null,restart=false){if(!this.actions[name])throw Error(`Unknown character animation: ${name}`);if(this.current===name&&!once&&!restart&&!this.pending)return this.actions[name];this.cancelOneShot();const prev=this.actions[this.current],action=this.actions[name];this.current=name;action.reset();action.setEffectiveWeight(1);action.setEffectiveTimeScale(duration?action.getClip().duration/duration:1);action.setLoop(once?THREE.LoopOnce:THREE.LoopRepeat,once?1:Infinity);action.clampWhenFinished=once;action.play();if(prev&&prev!==action)prev.crossFadeTo(action,.14,false);else action.fadeIn(.12);return action}
 motion(moving){if(!this.locked)this.play(moving?'walk':'idle')}
 cancelOneShot(){if(!this.pending)return;const {action,done,resolve}=this.pending;this.pending=null;this.mixer.removeEventListener('finished',done);action.stop();this.locked=false;resolve(false)}
 async once(name,duration=.9){const action=this.play(name,true,duration);this.locked=true;return new Promise(resolve=>{const done=e=>{if(e.action!==action)return;this.mixer.removeEventListener('finished',done);this.pending=null;this.locked=false;
 // Keep the completed action as the previous action so its final pose fades
 // out. Restart also handles one-shot idle used by Inspect and Retreat.
 this.play('idle',false,null,true);resolve(true)};this.pending={action,done,resolve};this.mixer.addEventListener('finished',done)})}
 update(dt){this.mixer.update(dt)}
 snapshot(){const bone=this.skin.getObjectByName('LeftLeg');return {animation:this.current,animationTime:this.actions[this.current]?.time,activeAnimations:Object.entries(this.actions).filter(([,a])=>a.isScheduled()&&a.enabled&&a.getEffectiveWeight()>.01).map(([name,a])=>({name,weight:a.getEffectiveWeight()})),forward:{x:Math.sin(this.root.rotation.y),z:Math.cos(this.root.rotation.y)},legQuaternion:bone?.quaternion.toArray()}}
 dispose(){this.cancelOneShot();this.mixer.stopAllAction();this.mixer.uncacheRoot(this.skin)}
}
