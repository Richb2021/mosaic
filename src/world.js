import {Resident} from './resident.js';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Character} from './character.js';
import {MAPS,blocked,findPath,getMap} from './maps.js';
const ASSETS=['tree','pine','palm','rock','house','stall','arch','chest','lamp','bridge','crystal','pedestal','shelf','forge','waterwheel','telescope','dome','pillar','bed','hero_female','hero_male','ivo_rigged','guardian_rigged','flowers','sign','fountain','polyfork_barrel','polyfork_cart','polyfork_cottage','polyfork_townhouse','polyfork_maple','polyfork_pine','polyfork_birch','lantern_fox','astral_beacon','courier_sword','keeper_staff','room_table','room_chair','room_counter','room_hearth','room_ledger','room_crate','polyfork_villager','polyfork_merchant','polyfork_tradesman','polyfork_villager_female'];
export class World{
 constructor(canvas,onArrival,onMove){this.canvas=canvas;this.onArrival=onArrival;this.onMove=onMove;this.scene=new THREE.Scene();this.renderer=new THREE.WebGLRenderer({canvas,antialias:false,alpha:false});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.setClearColor(0xaecbd2);this.camera=new THREE.OrthographicCamera(-15,15,11,-11,.1,150);this.camera.position.set(13,21,24);this.camera.lookAt(0,0,0);this.cameraFocus=new THREE.Vector3();this.scene.add(new THREE.HemisphereLight(0xfff3da,0x516b81,1.6));const sun=new THREE.DirectionalLight(0xffedc8,2.1);sun.position.set(-8,17,10);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-15,right:15,top:15,bottom:-15,near:1,far:50});sun.shadow.bias=-.001;this.scene.add(sun);this.scene.add(sun.target);this.sun=sun;this.root=new THREE.Group();this.scene.add(this.root);this.cache={};this.actors=[];this.effects=[];this.actionBusy=false;this.keys=new Set();this.path=[];this.pending=null;this.paused=false;this.last=performance.now();this.ray=new THREE.Raycaster();this.clock=0;this.failed=[];this.frames=0;this.resize=()=>{const w=canvas.clientWidth,h=canvas.clientHeight;this.renderer.setSize(w,h,false);const aspect=w/h,halfH=this.battling?10.5:this.map?.interior?6.6:7.8;this.camera.left=-halfH*aspect;this.camera.right=halfH*aspect;this.camera.top=halfH;this.camera.bottom=-halfH;this.camera.updateProjectionMatrix()};window.addEventListener('resize',this.resize);this.resize();}
 async load(progress){const loader=new GLTFLoader();let n=0;await Promise.all(ASSETS.map(async a=>{try{const g=await loader.loadAsync('/assets/'+a+'.glb');g.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;for(const m of Array.isArray(o.material)?o.material:[o.material]){m.roughness=.92;if(m.map){m.map.magFilter=THREE.NearestFilter;m.map.minFilter=THREE.LinearMipmapLinearFilter}}}});this.cache[a]=g}catch(e){this.failed.push(a);console.error('Asset failed',a,e)}progress?.(++n,ASSETS.length)}));this.npcClip=await fetch('/assets/npc-clips/anim-talking.json').then(r=>{if(!r.ok)throw Error('Resident animation unavailable');return r.json()});if(this.failed.length)throw Error('Could not load game art: '+this.failed.join(', '));}
 model(asset,x=0,z=0,scale=1,rotation=0){if(asset==='ivo')asset='ivo_rigged';if(asset==='mira')asset='hero_female';let o;if(['polyfork_villager','polyfork_merchant','polyfork_tradesman','polyfork_villager_female'].includes(asset)){const actor=new Resident(this.cache[asset],this.npcClip);this.actors.push(actor);o=actor.root;}else if(['hero_female','hero_male','ivo_rigged','guardian_rigged'].includes(asset)){const actor=new Character(this.cache[asset],asset==='guardian_rigged'?3.2:2.3);this.actors.push(actor);o=actor.root;}else o=this.cache[asset].scene.clone(true);o.position.set(x,0,z);o.scale.setScalar(scale);o.rotation.y=rotation;this.root.add(o);return o}
 addBackdrop(items){
  this.canopyUniforms={canopyHero:{value:new THREE.Vector3()},canopyPartner:{value:new THREE.Vector3()},canopyDirection:{value:new THREE.Vector3(13,21,24).normalize()}};
  const groups=new Map();for(const p of items){if(!groups.has(p.asset))groups.set(p.asset,[]);groups.get(p.asset).push(p)}
  const rotation=new THREE.Quaternion(),matrix=new THREE.Matrix4(),position=new THREE.Vector3(),scale=new THREE.Vector3();
  for(const [asset,places] of groups){const source=this.cache[asset].scene;source.updateMatrixWorld(true);source.traverse(part=>{
   if(!part.isMesh)return;
   // A dithered cutaway preserves opaque instancing/depth sorting while revealing
   // both party members behind foreground canopies. Source materials stay shared.
   const own=material=>{const m=material.clone();m.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,this.canopyUniforms);
    shader.vertexShader='varying vec3 vCanopyWorld;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
     vec4 canopyWorld=vec4(transformed,1.0);
     #ifdef USE_INSTANCING
     canopyWorld=instanceMatrix*canopyWorld;
     #endif
     vCanopyWorld=(modelMatrix*canopyWorld).xyz;`);
    shader.fragmentShader='varying vec3 vCanopyWorld; uniform vec3 canopyHero; uniform vec3 canopyPartner; uniform vec3 canopyDirection;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',`#include <alphatest_fragment>
     vec3 d=vCanopyWorld-canopyHero; float t=dot(d,canopyDirection);
     vec3 p=vCanopyWorld-canopyPartner; float u=dot(p,canopyDirection);
     bool cutaway=(t>0.3 && length(d-t*canopyDirection)<1.35)||(u>0.3 && length(p-u*canopyDirection)<1.35);
     if(cutaway && mod(floor(gl_FragCoord.x)+2.0*floor(gl_FragCoord.y),4.0)>0.5)discard;`);
   };m.customProgramCacheKey=()=> 'party-canopy-cutaway-v1';return m};
   const material=Array.isArray(part.material)?part.material.map(own):own(part.material);
   const batch=new THREE.InstancedMesh(part.geometry,material,places.length);batch.userData.ownedMaterials=Array.isArray(material)?material:[material];
   for(let i=0;i<places.length;i++){const p=places[i];position.set(p.x,0,p.z);rotation.setFromAxisAngle(new THREE.Vector3(0,1,0),p.rotation);scale.setScalar(p.scale);matrix.compose(position,rotation,scale).multiply(part.matrixWorld);batch.setMatrixAt(i,matrix)}
   batch.castShadow=true;batch.receiveShadow=true;batch.computeBoundingSphere();this.root.add(batch);
  })}
 }
 updateOcclusion(){if(!this.hero)return;this.canopyUniforms.canopyHero.value.copy(this.hero.position).y+=1.1;this.canopyUniforms.canopyPartner.value.copy(this.partner.position).y+=1.1;const target=this.hero.position.clone().add(new THREE.Vector3(0,1.2,0)),direction=target.clone().sub(this.camera.position),length=direction.length();const ray=new THREE.Ray(this.camera.position,direction.normalize());for(const {o} of this.decor||[]){if(!o.userData.occlusionBox)continue;const hit=ray.intersectBox(o.userData.occlusionBox,new THREE.Vector3());const fade=!this.battling&&hit&&hit.distanceTo(this.camera.position)<length-.3;for(const mat of o.userData.ownedMaterials){mat.opacity=fade?.24:1;mat.depthWrite=!fade}}}
 mesh(geo,color,x,y,z){const m=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color,roughness:1,flatShading:true}));m.position.set(x,y,z);m.receiveShadow=true;m.userData.transient=true;this.root.add(m);return m}
 setArea(state){this.state=state;this.map=getMap(state);for(const a of this.actors)a.dispose();this.actors=[];for(const e of this.effects){e.geo.dispose();e.ring.geometry.dispose();e.mat.dispose()}this.effects=[];this.battling=false;this.root.traverse(o=>{if(o.isInstancedMesh)o.dispose();if(o.userData.ownedMaterials)for(const m of o.userData.ownedMaterials)m.dispose();if(o.userData.transient){o.geometry.dispose();o.material.dispose()}});this.root.clear();this.path=[];this.pending=null;this.entities=[];this.pulse=[];this.renderer.setClearColor(this.map.sky);this.scene.fog=new THREE.Fog(this.map.sky,48,100);
 if(this.map.interior)this.buildInterior();else{
 // Continuous terrain extends beyond the camera; trees/buildings define the
 // accessible region instead of an exposed platform edge.
 const terrain=this.mesh(new THREE.PlaneGeometry(180,180),this.map.color,0,-.03,0);terrain.rotation.x=-Math.PI/2;
 const roadColor=['quay','forge','archive'].includes(state.area)?0xb9ac8e:0xb6a17b;
 for(const r of this.map.roads){const horizontal=!!r.x;this.mesh(new THREE.BoxGeometry(horizontal?Math.abs(r.x):2.7,.025,horizontal?2.7:Math.abs(r.z)),roadColor,r.x/2,0,r.z/2)}
 if(['quay','forge','archive','mill'].includes(state.area)){
  for(const z of [-6,6])this.mesh(new THREE.BoxGeometry(36,.02,2.2),roadColor,0,.005,z);
  for(const x of [-10,10])this.mesh(new THREE.BoxGeometry(2,.02,26),roadColor,x,.006,0);
 }
 for(let i=-7;i<=7;i++)this.mesh(new THREE.BoxGeometry(.65,.035,.55),0xa89c82,i*2,.025,(i%2)*.2);
 }
 this.addBackdrop(this.map.backdrop);
 this.decor=this.map.props.map(p=>{const o=this.model(p.asset,p.x,p.z,p.scale,p.rotation);if(p.building)o.userData.entity=this.map.entities.find(e=>e.building===p.building);if(['polyfork_cottage','polyfork_townhouse','dome'].includes(p.asset)){o.updateMatrixWorld(true);o.userData.occlusionBox=new THREE.Box3().setFromObject(o);o.userData.ownedMaterials=[];o.traverse(part=>{if(!part.isMesh)return;const own=m=>{const c=m.clone();c.transparent=true;o.userData.ownedMaterials.push(c);return c};part.material=Array.isArray(part.material)?part.material.map(own):own(part.material)})}return {p,o}});
 for(const e of this.map.entities){if(e.kind==='enemy'&&state.defeated.includes(e.id))continue;if(e.kind==='chest'&&state.chests.includes(state.area))continue;const scale=e.kind==='door'||e.kind==='leave'?.45:e.kind==='enemy'?(e.id==='guardian'?1.05:.65):e.kind==='npc'?.8:e.kind==='resident'?(e.asset==='hero_female'?.85:1):e.kind==='exit'?.8:1;const o=this.model(e.asset==='moss_guardian'?'guardian_rigged':e.asset,e.x,e.z,scale);o.userData.entity=e;this.entities.push({e,o});const ring=this.mesh(new THREE.TorusGeometry(e.kind==='exit'?.9:.65,.045,6,32),(e.kind==='puzzle'&&state.seals.includes(e.id)||e.kind==='workbench'&&this.completedRooms?.has(state.interior))?0x7cdbb3:e.kind==='enemy'?0xe6a18e:0xf3dc91,e.x,.08,e.z);ring.rotation.x=-Math.PI/2;this.pulse.push(ring);}
 this.hero=this.model(state.hero==='male'?'hero_male':'hero_female',state.pos.x,state.pos.z,1);this.partner=this.model('ivo_rigged',state.pos.x-1,state.pos.z+1,.97);if(Math.abs(state.pos.x)>15||Math.abs(state.pos.z)>12){this.hero.rotation.y=Math.atan2(-state.pos.x,-state.pos.z);this.partner.position.copy(this.hero.position).add(new THREE.Vector3(Math.sin(this.hero.rotation.y),0,Math.cos(this.hero.rotation.y)));this.partner.rotation.y=this.hero.rotation.y}this.heroActor=this.hero.userData.character;this.partnerActor=this.partner.userData.character;this.equip(this.heroActor,'courier_sword');this.equip(this.partnerActor,'keeper_staff');this.playerPos={...state.pos};this.cameraFocus.set(this.map.interior?0:state.pos.x,0,this.map.interior?0:state.pos.z);this.resize();this.marker=this.mesh(new THREE.TorusGeometry(.3,.055,6,20),0xffe4a0,0,.09,0);this.marker.rotation.x=-Math.PI/2;this.marker.visible=false;this.battleModels=[];if(state.battle)this.battle(state);this.render();}
 buildInterior(){
  const m=this.map,wood=m.type==='library'||m.type==='study'?0x8a7158:0x866549;
  this.mesh(new THREE.BoxGeometry(14.4,.24,12),0x443d38,0,-.15,0);
  for(let x=-7;x<7;x+=.7)this.mesh(new THREE.BoxGeometry(.67,.045,11.6),wood+(Math.round((x+7)/.7)%2?0x070504:0),x+.35,0,0);
  const plaster=m.type==='workshop'?0xb5aa92:0xd2c3a3;
  this.mesh(new THREE.BoxGeometry(14.4,3.2,.25),plaster,0,1.6,-5.9);
  this.mesh(new THREE.BoxGeometry(.25,3.2,12),plaster,-7.1,1.6,0);
  this.mesh(new THREE.BoxGeometry(.25,.4,12),0x5f4937,7.1,.2,0);
  for(const x of [-4.15,4.15])this.mesh(new THREE.BoxGeometry(6,.4,.25),0x5f4937,x,.2,5.9);
  for(const x of [-7,-3.5,0,3.5,7])this.mesh(new THREE.BoxGeometry(.16,3.3,.3),0x614a36,x,1.65,-5.85);
  this.mesh(new THREE.BoxGeometry(14.4,.18,.35),0x614a36,0,3.15,-5.85);
  for(const x of [-4.8,4.8]){this.mesh(new THREE.BoxGeometry(1.65,1.5,.12),0x65513e,x,2,-5.67);this.mesh(new THREE.BoxGeometry(1.4,1.25,.14),0xe2c982,x,2,-5.59);this.mesh(new THREE.BoxGeometry(.08,1.4,.17),0x65513e,x,2,-5.48);this.mesh(new THREE.BoxGeometry(1.5,.08,.17),0x65513e,x,2,-5.48);}
  const rug=m.type==='library'?0x435f65:m.type==='workshop'?0x6f7660:0x834d43;
  this.mesh(new THREE.BoxGeometry(3.2,.02,6),0xb79b65,0,.04,1.3);this.mesh(new THREE.BoxGeometry(2.9,.025,5.7),rug,0,.05,1.3);
  const lamp=new THREE.PointLight(0xffd596,14,12,2);lamp.position.set(2,3,0);this.root.add(lamp);
  if(this.completedRooms?.has(m.building)){
   const prize=m.building==='inn'?'room_crate':m.building==='workshop'?'crystal':'room_ledger';this.model(prize,-2.6,2.8,.65);
   this.mesh(new THREE.BoxGeometry(.8,1.5,.08),0xc0a45c,1.8,2.1,-5.55);
  }
 }
 equip(actor,asset){const hand=actor.skin.getObjectByName('RightHand');if(!hand)return;const weapon=this.cache[asset].scene.clone(true);hand.add(weapon);actor.root.updateMatrixWorld(true);const scale=hand.getWorldScale(new THREE.Vector3());weapon.scale.setScalar(1/Math.max(scale.x,scale.y,scale.z));weapon.rotation.x=Math.PI/2;weapon.visible=false;actor.weapon=weapon;}
 sync(state){this.state=state;}
 battle(state){this.path=[];this.pending=null;this.battling=true;this.resize();for(const {p,o} of this.decor)if(p.z>1||Math.abs(p.x)<6&&p.z>-2)o.visible=false;if(this.heroActor.weapon)this.heroActor.weapon.visible=true;if(this.partnerActor.weapon)this.partnerActor.weapon.visible=true;this.entities.forEach(({o})=>o.visible=false);this.hero.position.set(-3.5,0,2);this.partner.position.set(-5,0,0);this.hero.rotation.y=Math.PI/3;this.partner.rotation.y=Math.PI/3;this.enemyModel=this.model(state.battle.id==='shard'?'lantern_fox':'guardian_rigged',3,0,state.battle.id==='guardian'?1.55:1.15,-Math.PI/4);this.battleModels.push(this.enemyModel);this.mesh(new THREE.CylinderGeometry(6,6,.06,40),0xb1aa89,0,.015,1);this.pulse.forEach(o=>o.visible=false);this.heroActor.play('idle');this.partnerActor.play('idle');this.enemyActor=this.enemyModel.userData.character;}
 endBattle(state){this.battling=false;this.setArea(state)}
 walkTo(entity){if(this.paused||this.battling)return;this.pending=entity;this.path=findPath(this.map,this.playerPos,{x:entity.x,z:entity.z});if(['resident','visitor'].includes(entity.kind)){const stop=this.path.findIndex(p=>Math.hypot(p.x-entity.x,p.z-entity.z)<=1.5);if(stop>=0)this.path.length=stop+1;}if(Math.hypot(this.playerPos.x-entity.x,this.playerPos.z-entity.z)<1.4){this.pending=null;this.onArrival(entity)}else if(!this.path.length){this.pending=null;return false}this.marker.position.set(entity.x,.09,entity.z);this.marker.visible=true;return true}
 walkGround(x,z){if(this.paused||this.battling||blocked(this.map,x,z))return;this.pending=null;this.path=findPath(this.map,this.playerPos,{x,z});this.marker.position.set(x,.09,z);this.marker.visible=!!this.path.length;}
 click(ev){if(this.paused||this.battling)return;const r=this.canvas.getBoundingClientRect(),p=new THREE.Vector2((ev.clientX-r.left)/r.width*2-1,-(ev.clientY-r.top)/r.height*2+1);this.ray.setFromCamera(p,this.camera);const hits=this.ray.intersectObjects([...this.entities.map(o=>o.o),...this.decor.filter(d=>d.p.building).map(d=>d.o)],true);if(hits.length){let o=hits[0].object;while(o&&!o.userData.entity)o=o.parent;if(o?.userData.entity){this.walkTo(o.userData.entity);return}}const point=new THREE.Vector3();this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),point);this.walkGround(point.x,point.z)}
 nearest(){return this.entities.map(v=>({...v.e,dist:Math.hypot(v.e.x-this.playerPos.x,v.e.z-this.playerPos.z)})).sort((a,b)=>a.dist-b.dist)[0]}
 render(){this.renderer.render(this.scene,this.camera)}
 effect(from,to,color,kind='magic'){const group=new THREE.Group();this.root.add(group);const geo=new THREE.IcosahedronGeometry(kind==='strike'?.1:.18,1),mat=new THREE.MeshBasicMaterial({color,transparent:true});const particles=[];for(let i=0;i<12;i++){const m=new THREE.Mesh(geo,mat);group.add(m);particles.push(m)}const ring=new THREE.Mesh(new THREE.TorusGeometry(.6,.06,5,28),mat);ring.rotation.x=-Math.PI/2;group.add(ring);this.effects.push({group,particles,ring,from:from.clone(),to:to.clone(),time:0,duration:.8,geo,mat});}
 async playBattleAction(action,before,after){this.actionBusy=true;const i=before.battle.actor,actor=i?this.partnerActor:this.heroActor,root=actor.root;const enemy=this.enemyModel;const target=enemy.position.clone();target.y=1.5;const start=root.position.clone();start.y=1.2;const mode=['flare','tide','gale','potion'].includes(action)?'cast':action==='attack'?'attack':action==='guard'?'guard':'idle';
 try{const anim=actor.once(mode,action==='inspect'||action==='retreat'?.5:1.05);if(['attack','flare','tide','gale','potion'].includes(action)){await new Promise(r=>setTimeout(r,320));this.effect(start,action==='potion'?start:target,{attack:0xffe2ac,flare:0xff8856,tide:0x75d4ef,gale:0xb3e0a0,potion:0xa7e3b3}[action],action==='attack'?'strike':'magic');if(action!=='potion'&&this.enemyActor)this.enemyActor.once('hit',.6)}await anim;
 const enemyTurn=after.battle&&after.battle.round>before.battle.round||!after.battle&&after.party.some((h,j)=>h.hp<before.party[j].hp)&&action!=='retreat';if(enemyTurn){const enemyAnim=this.enemyActor?this.enemyActor.once('attack',.85):new Promise(r=>setTimeout(r,850));await new Promise(r=>setTimeout(r,280));for(let j=0;j<2;j++)if(after.party[j].hp<before.party[j].hp){const hit=j?this.partnerActor:this.heroActor;this.effect(target,hit.root.position.clone().add(new THREE.Vector3(0,1,0)),0xe6a875,'strike');hit.once('hit',.55)}await enemyAnim;}
 }finally{this.actionBusy=false;}}
 start(){const tick=(now)=>{const dt=Math.min((now-this.last)/1000,.04);this.last=now;this.clock+=dt;this.frames++;let moving=false,partnerMoving=false;
 if(!this.paused&&!this.battling&&this.hero){let dx=0,dz=0;if(this.keys.has('ArrowLeft')||this.keys.has('a'))dx--;if(this.keys.has('ArrowRight')||this.keys.has('d'))dx++;if(this.keys.has('ArrowUp')||this.keys.has('w'))dz--;if(this.keys.has('ArrowDown')||this.keys.has('s'))dz++;
 if(dx||dz){this.path=[];this.pending=null;const len=Math.hypot(dx,dz),angle=Math.atan2(13,24),sx=dx/len,sz=dz/len;dx=(sx*Math.cos(angle)+sz*Math.sin(angle))*4*dt;dz=(-sx*Math.sin(angle)+sz*Math.cos(angle))*4*dt;}
 else if(this.path.length){const t=this.path[0],len=Math.hypot(t.x-this.playerPos.x,t.z-this.playerPos.z);if(len<.08){this.playerPos.x=t.x;this.playerPos.z=t.z;this.path.shift()}else{dx=(t.x-this.playerPos.x)/len*Math.min(len,4*dt);dz=(t.z-this.playerPos.z)/len*Math.min(len,4*dt)}}
 const p=this.playerPos,oldX=p.x,oldZ=p.z;if(!blocked(this.map,p.x+dx,p.z))p.x+=dx;if(!blocked(this.map,p.x,p.z+dz))p.z+=dz;moving=Math.hypot(p.x-oldX,p.z-oldZ)>.0001;if(moving)this.hero.rotation.y=Math.atan2(p.x-oldX,p.z-oldZ);this.hero.position.set(p.x,0,p.z);if(moving)this.onMove(p);
 const delta=new THREE.Vector3(p.x-this.partner.position.x,0,p.z-this.partner.position.z),distance=delta.length();if(distance>1.25){delta.normalize();this.partner.position.addScaledVector(delta,Math.min(distance-1.25,4.6*dt));this.partner.rotation.y=Math.atan2(delta.x,delta.z);partnerMoving=true}
 if(!this.path.length){this.marker.visible=false;if(this.pending){const e=this.pending;this.pending=null;if(Math.hypot(e.x-p.x,e.z-p.z)<1.8)this.onArrival(e)}}}
 if(!this.paused&&!this.battling&&moving){const road=this.map.entities.find(e=>(e.kind==='exit'||e.kind==='leave')&&Math.hypot(e.x-this.playerPos.x,e.z-this.playerPos.z)<.75);if(road)this.onArrival(road)}
 if(this.heroActor&&!this.battling){this.heroActor.motion(moving);this.partnerActor.motion(partnerMoving)}
 for(const a of this.actors)a.update(dt);
 for(let i=this.effects.length-1;i>=0;i--){const e=this.effects[i];e.time+=dt;const t=Math.min(1,e.time/e.duration);const center=e.from.clone().lerp(e.to,Math.min(1,t*2));e.group.position.copy(center);for(let j=0;j<e.particles.length;j++){const angle=j*Math.PI/6+t*5,r=.1+Math.max(0,t-.35)*2;e.particles[j].position.set(Math.cos(angle)*r,Math.sin(angle*2)*r*.7,Math.sin(angle)*r)}e.ring.scale.setScalar(.3+t*1.7);e.mat.opacity=1-t;if(t>=1){this.root.remove(e.group);e.geo.dispose();e.ring.geometry.dispose();e.mat.dispose();this.effects.splice(i,1)}}
 const focus=this.battling?new THREE.Vector3():this.map.interior?new THREE.Vector3(THREE.MathUtils.clamp(this.hero.position.x,-2.5,2.5),0,THREE.MathUtils.clamp(this.hero.position.z,-1,1)):new THREE.Vector3(this.hero.position.x,0,this.hero.position.z);this.cameraFocus.lerp(focus,Math.min(1,dt*6));this.camera.position.copy(this.cameraFocus).add(new THREE.Vector3(13,21,24));this.camera.lookAt(this.cameraFocus);this.sun.position.copy(this.cameraFocus).add(new THREE.Vector3(-8,17,10));this.sun.target.position.copy(this.cameraFocus);this.updateOcclusion();this.render();this.raf=requestAnimationFrame(tick)};this.raf=requestAnimationFrame(tick)}
}
