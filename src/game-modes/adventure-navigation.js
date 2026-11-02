import {adventureAnchors} from './adventure-engine.js';
import {worldAnchors} from './adventure-world.js';
import {blocked,findPath,safePosition,approachPath,clearSegment} from '../navigation.js';
export const FLOOR_SCALE=1.75;
// [asset, x, feetY, visibleWidth, groundWidth, groundDepth]
export const ROOM_PROPS={
 workshop:[['crate',43,82,8,5,2.2],['gear',84,79,8,4,2]],
 woods:[['chest',57,81,9,5.5,2],['lantern',28,76,4,1.5,1.5]],
 archive:[['books',42,79,7,4,1.8],['bench',81,85,12,9,2]],
 quay:[['rope',38,83,7,4,2],['barrel',78,78,6,3.5,2]],
 garden:[['planter',57,78,9,6,2.2],['trough',30,84,10,7,2.4]],
 tower:[['wall',45,78,11,8,2],['sack',72,85,6,3,2]]
};
export function adventureNavigation(pack,state,room=state.room){
 const anchors=(pack.world?worldAnchors(state,adventureAnchors(pack)):adventureAnchors(pack))[room],npc=anchors.npc;
 return {limits:{minX:5,maxX:95,minZ:72*FLOOR_SCALE,maxZ:88*FLOOR_SCALE},radius:.6,step:1,
  obstacles:[...ROOM_PROPS[room].map(([,x,y,,w,d])=>[x,y*FLOOR_SCALE,w,d*FLOOR_SCALE]),[npc.x,npc.y*FLOOR_SCALE,2.6,2.5]]};
}
export const floorPoint=p=>({x:p.x,z:p.y*FLOOR_SCALE});
export const scenePoint=p=>({x:p.x,y:p.z/FLOOR_SCALE});
export function safeAdventurePosition(pack,state,room){return scenePoint(safePosition(adventureNavigation(pack,state,room),floorPoint(state.positions[room])))}
export function adventureRoute(pack,state,target,interaction=false){
 const map=adventureNavigation(pack,state),start=floorPoint(state.positions[state.room]),end=floorPoint(target);
 if(interaction){
  const sight=objectSightMap(map,end);
  if(!blocked(map,start.x,start.z)&&Math.hypot(start.x-end.x,start.z-end.z)<=5&&clearSegment(sight,start,end))return [start];
  return approachPath(map,start,end,5,sight);
 }
 const goal=blocked(map,end.x,end.z)?safePosition(map,end):end;
 return goal?findPath(map,start,goal,{reach:.3}):[];
}
function objectSightMap(map,end){
 return {...map,obstacles:map.obstacles.filter(([x,z,w,h])=>Math.abs(x-end.x)>w/2+map.radius||Math.abs(z-end.z)>h/2+map.radius)};
}
export function canReachObject(pack,state,target){
 const map=adventureNavigation(pack,state),end=floorPoint(target);
 return clearSegment(objectSightMap(map,end),floorPoint(state.positions[state.room]),end);
}
