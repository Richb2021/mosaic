import {blocked} from './maps.js';

// Spend the frame's travel budget across waypoints. Reaching a grid point is
// part of the same walk, not an idle frame that restarts the animation.
export function advancePath(map,position,path,distance){
 const start={...position};let remaining=Math.max(0,distance),hitObstacle=false;
 while(path.length&&remaining>1e-9){
  const target=path[0],dx=target.x-position.x,dz=target.z-position.z,length=Math.hypot(dx,dz);
  if(length<1e-9){path.shift();continue}
  const step=Math.min(length,remaining),x=position.x+dx/length*step,z=position.z+dz/length*step;
  const oldX=position.x,oldZ=position.z;
  if(!blocked(map,x,z)){position.x=x;position.z=z;}
  else{
   // A keyboard arrival can leave the player off the pathfinding grid beside
   // an obstacle. Preserve per-axis sliding until the first waypoint clears
   // that corner; a blocked diagonal does not imply that the route is blocked.
   if(!blocked(map,x,position.z))position.x=x;
   if(!blocked(map,position.x,z))position.z=z;
  }
  const travelled=Math.hypot(position.x-oldX,position.z-oldZ);
  if(travelled<1e-9){path.length=0;hitObstacle=true;break}
  remaining-=travelled;
  if(Math.hypot(target.x-position.x,target.z-position.z)<1e-9){position.x=target.x;position.z=target.z;path.shift();}
 }
 const dx=position.x-start.x,dz=position.z-start.z;
 return {dx,dz,moving:Math.hypot(dx,dz)>.0001,blocked:hitObstacle};
}
