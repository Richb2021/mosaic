import * as THREE from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';

// Polyfork's native T-pose skeleton uses named Mixamo bones and rigid weights.
// These CC0 UAL clips use absolute bone quaternions and relative hip offsets.
export class Resident{
 constructor(gltf,raw){
  this.root=clone(gltf.scene);const bones={};this.root.traverse(o=>{if(o.isBone)bones[o.name]=o});
  const hips=bones.Hips;if(!hips||!bones.LeftForeArm)throw Error('Resident has an incompatible skeleton');
  const tracks=[];
  for(const [name,values] of Object.entries(raw.tracks)){if(bones[name]&&values.length)tracks.push(new THREE.QuaternionKeyframeTrack(bones[name].uuid+'.quaternion',raw.times,values));}
  const rest=hips.position.clone(),ratio=rest.y/.95,positions=[];
  for(let i=0;i<raw.hips.length;i+=3)positions.push(rest.x,rest.y+raw.hips[i+1]*ratio,rest.z);
  tracks.push(new THREE.VectorKeyframeTrack(hips.uuid+'.position',raw.times,positions));
  this.mixer=new THREE.AnimationMixer(this.root);this.clip=new THREE.AnimationClip('Resident conversation',-1,tracks);this.action=this.mixer.clipAction(this.clip).play();this.mixer.update(.2);
  this.arm=bones.LeftArm;this.root.userData.resident=this;
 }
 update(dt){this.mixer.update(dt)}
 snapshot(){return {time:this.action.time,arm:this.arm?.quaternion.toArray()}}
 dispose(){this.mixer.stopAllAction();this.mixer.uncacheRoot(this.root)}
}
