import test from 'node:test';
import assert from 'node:assert/strict';
import {blocked,clearSegment,findPath,approachPath,safePosition} from '../src/navigation.js';
import {advancePath,moveWithSlide} from '../src/movement.js';
import {MAPS,INTERIORS,getMap} from '../src/maps.js';
import {navigationMap,EXTRA_PROPS,propBoxes,interactionDistance,stateScenery} from '../src/prop-collision.js';
import {WORLD_PACKS} from '../src/game-modes/adventure-world-packs.js';
import {ADVENTURE_PACKS} from '../src/game-modes/adventure-content.js';
import {initialAdventureState,adventureAnchors} from '../src/game-modes/adventure-engine.js';
import {worldAnchors,roomsOf} from '../src/game-modes/adventure-world.js';
import {adventureNavigation,adventureRoute,safeAdventurePosition,floorPoint} from '../src/game-modes/adventure-navigation.js';

const thin={bounds:{x:10,z:10},obstacles:[[0,0,.015,8]]};
test('swept paths reject tunnelling across a thin fence at any travel budget',()=>{
 for(const distance of [.1,1,20,200]){const p={x:-1,z:0},path=[{x:1,z:0}];advancePath(thin,p,path,distance);assert(p.x<-.25);assert(!blocked(thin,p.x,p.z));}
 assert(!clearSegment(thin,{x:-1,z:0},{x:1,z:0}));
});
test('keyboard movement stops at a thin fence and slides along its free axis',()=>{
 const p={x:-1,z:0};moveWithSlide(thin,p,8,2);assert(p.x<-.25);assert(p.z>1.9);assert(!blocked(thin,p.x,p.z));
});
test('every route segment clears obstacles, including off-grid corner starts',()=>{
 const p={x:-6.6,z:4.29},path=findPath(MAPS.quay,p,{x:-5,z:6});assert(path.length);
 let prev=p;for(const next of path){assert(clearSegment(MAPS.quay,prev,next));prev=next;}
});
test('all overworld/interior interactions have solid-safe approach paths',()=>{
 for(const [id,base] of Object.entries({...MAPS,...INTERIORS})){
  const map=navigationMap(base),start=safePosition(map,{x:0,z:base.interior?3.5:4});assert(start);
  for(const e of base.entities){const path=approachPath(map,start,e,interactionDistance(e),base);assert(path.length,id+': '+e.id);let previous=start;for(const p of path){assert(clearSegment(map,previous,p),id+': unsafe segment');previous=p}assert(Math.hypot(previous.x-e.x,previous.z-e.z)<interactionDistance(e)+.15)}
 }
});
test('all five dungeon rooms keep interactions reachable around solid props',()=>{
 for(const room of ['entry','gallery','reservoir','workshop','heart']){
  const base=stateScenery(getMap({chapter:{room,defeated:[],solved:[]}}),{chapter:{room}}),map=navigationMap(base),start=safePosition(map,{x:0,z:7});
  for(const e of base.entities){const path=approachPath(map,start,e,interactionDistance(e),base);assert(path.length,room+': '+e.id);let p=start;for(const next of path){assert(clearSegment(map,p,next));p=next}}
 }
});
test('all twelve added 3D props are placed and own solid native-scale footprints',()=>{
 const props=Object.values(MAPS).flatMap(m=>m.props);
 for(const key of Object.keys(EXTRA_PROPS)){const p=props.find(p=>p.asset===key);assert(p,key+' not integrated');assert.equal(p.scale,1);assert(propBoxes(p).length);}
 const turned=propBoxes({asset:'polyfork_fence_wood',x:0,z:0,rotation:Math.PI/2})[0];assert(Math.abs(turned[2]-.15)<1e-9);assert(Math.abs(turned[3]-2)<1e-9);
});
test('painted room routes reach every hotspot in legacy and expanded settings',()=>{
 for(const pack of [...ADVENTURE_PACKS,...WORLD_PACKS]){
  const state=initialAdventureState(pack);state.repaired=true;state.solved=true;if(state.world){state.world.delivery=3;state.world.field.solved=true;}
  const anchors=pack.world?worldAnchors(state,adventureAnchors(pack)):adventureAnchors(pack);
  for(const room of Object.keys(roomsOf(pack))){state.room=room;state.positions[room]=safeAdventurePosition(pack,state,room);const map=adventureNavigation(pack,state);
   for(const [id,target] of Object.entries(anchors[room])){const route=adventureRoute(pack,state,target,true);assert(route.length,pack.id+': '+room+'/'+id);let prev=floorPoint(state.positions[room]);for(const next of route){assert(clearSegment(map,prev,next),room+': '+id);prev=next}}
  }
 }
});
test('painted props and NPCs stop keys, direct routes and normal walking equally',()=>{
 const p=WORLD_PACKS[0],s=initialAdventureState(p),map=adventureNavigation(p,s);s.positions.workshop={x:35,y:82};
 const point=floorPoint(s.positions.workshop);moveWithSlide(map,point,30,0);assert(point.x<40);assert(!blocked(map,point.x,point.z));
 const route=adventureRoute(p,s,{x:55,y:82});assert(route.length>1);let prev=floorPoint(s.positions.workshop);for(const next of route){assert(clearSegment(map,prev,next));prev=next}
 const legacy={x:43,y:82};s.positions.workshop=legacy;const safe=safeAdventurePosition(p,s,'workshop');assert(!blocked(map,...[floorPoint(safe).x,floorPoint(safe).z]));assert.notDeepEqual(safe,legacy);
});

test('interaction approach cannot complete through an intervening wall',()=>{
 const sight={bounds:{x:5,z:5},obstacles:[[0,0,.1,8]]},target={x:.7,z:0};
 const map={...sight,obstacles:[...sight.obstacles,[target.x,target.z,.65,.65]]};
 const path=approachPath(map,{x:-2,z:0},target,1.35,sight);assert(path.length);
 assert(clearSegment(sight,path.at(-1),target));assert(path.some(p=>Math.abs(p.z)>4));
});

test('arch posts, puzzle plinths and large encounters match their solid bases',()=>{
 const base={bounds:{x:12,z:10},obstacles:[],entities:[]};
 const arch=navigationMap(base,[{asset:'arch',kind:'works',id:'room-test',to:'test',x:0,z:0}]);
 assert(!blocked(arch,0,0));assert(blocked(arch,1,0));assert(blocked(arch,-1,0));
 const pedestal=navigationMap(base,[{asset:'pedestal',kind:'puzzle',x:0,z:0}]);assert(blocked(pedestal,.9,0));
 const heart={asset:'works_heart',kind:'works',id:'encounter-heart',x:0,z:0};
 assert(blocked(navigationMap(base,[heart]),1.4,0));assert(interactionDistance(heart)>1.8);
});
test('dungeon gaps and water cannot be crossed except on the bridge',()=>{
 const gallery=getMap({chapter:{room:'gallery',defeated:[],solved:[]}});
 assert(!clearSegment(gallery,{x:4,z:-2},{x:4,z:2}));assert(clearSegment(gallery,{x:0,z:-3},{x:0,z:3}));
 const reservoir=getMap({chapter:{room:'reservoir',defeated:[],solved:[]}});assert(blocked(reservoir,7,3));assert(blocked(reservoir,-7,3));
});
test('completion scenery retains ground collision without mutating shared maps',()=>{
 const count=MAPS.mill.obstacles.length;
 const map=stateScenery(MAPS.mill,{area:'mill',chapter:{completed:true,choice:'lights'}});
 for(const x of [-3,0,3])assert(blocked(map,x,7));assert.equal(MAPS.mill.obstacles.length,count);
 const inn=stateScenery(INTERIORS.inn,{interior:'inn'},new Set(['inn']));assert(blocked(inn,-2.6,2.8));
});

test('nearby interaction clears the old route before an area transition',async()=>{
 const {World}=await import('../src/world.js');
 const map={bounds:{x:5,z:5},obstacles:[],entities:[]},marker={visible:true,position:{set(){throw Error('Stale destination marker after transition')}}};
 let arrivals=0;
 const w={map,entities:[],playerPos:{x:0,z:0},marker,onArrival(){arrivals++;assert.deepEqual(this.path,[]);assert.equal(this.pending,null);}};
 assert.equal(World.prototype.walkTo.call(w,{kind:'exit',asset:'sign',x:1,z:0}),true);assert.equal(arrivals,1);assert.equal(marker.visible,false);
});

test('nearby clear adventure hotspots interact without walking away',()=>{
 const pack=WORLD_PACKS[0],state=initialAdventureState(pack),target=adventureAnchors(pack).workshop.machine;
 state.positions.workshop={x:target.x-4.4,y:target.y};
 const before=floorPoint(state.positions.workshop),map=adventureNavigation(pack,state);assert(!blocked(map,before.x,before.z));
 const route=adventureRoute(pack,state,target,true);assert.deepEqual(route,[before]);
 assert.equal(blocked({limits:{minX:5,maxX:95,minZ:126,maxZ:154},radius:.6,obstacles:[]},5,140),false);
});
test('a rejected RPG ground click cancels the previous destination',async()=>{
 const {World}=await import('../src/world.js');const marker={visible:true},w={map:thin,entities:[],playerPos:{x:-1,z:0},pending:{id:'old'},path:[{x:2,z:0}],marker};
 World.prototype.walkGround.call(w,0,0);assert.deepEqual(w.path,[]);assert.equal(w.pending,null);assert.equal(marker.visible,false);
});
