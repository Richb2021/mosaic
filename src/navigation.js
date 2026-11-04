// Authored ground footprints; sprites and model overhangs are not solid bodies.
const limits=m=>m.limits||{minX:-m.bounds.x,maxX:m.bounds.x,minZ:-m.bounds.z,maxZ:m.bounds.z};
export function blocked(map,x,z){
 if(!Number.isFinite(x)||!Number.isFinite(z))return true;
 const b=limits(map),r=map.radius??.25;
 return x<b.minX||x>b.maxX||z<b.minZ||z>b.maxZ||(map.obstacles||[]).some(([cx,cz,w,h])=>Math.abs(x-cx)<w/2+r&&Math.abs(z-cz)<h/2+r);
}
export function clearSegment(map,a,b){
 if(blocked(map,a.x,a.z)||blocked(map,b.x,b.z))return false;
 const r=map.radius??.25,dx=b.x-a.x,dz=b.z-a.z;
 for(const [cx,cz,w,h] of map.obstacles||[]){
  let enter=0,leave=1;
  for(const [start,d,lo,hi] of [[a.x,dx,cx-w/2-r+1e-9,cx+w/2+r-1e-9],[a.z,dz,cz-h/2-r+1e-9,cz+h/2+r-1e-9]]){
   if(Math.abs(d)<1e-12){if(start<=lo||start>=hi){enter=2;break}}
   else{let t1=(lo-start)/d,t2=(hi-start)/d;if(t1>t2)[t1,t2]=[t2,t1];enter=Math.max(enter,t1);leave=Math.min(leave,t2)}
  }
  if(enter<=leave&&enter<=1&&leave>=0)return false;
 }
 return true;
}
// Moves a blocked position to the nearest free spot in the room's main walkable area, never
// into a small enclosed pocket (for example behind shelves) that the player couldn't walk out of.
export function safePosition(map,p){
 if(!blocked(map,p.x,p.z))return {...p};
 const b=limits(map),step=map.step??.5,cells=[],index=new Map(),key=(i,j)=>i+','+j;
 for(let i=0,x=b.minX;x<=b.maxX;i++,x+=step)for(let j=0,z=b.minZ;z<=b.maxZ;j++,z+=step)if(!blocked(map,x,z)){index.set(key(i,j),cells.length);cells.push({x,z,i,j,group:-1})}
 const sizes=[];
 for(const start of cells){if(start.group>=0)continue;const g=sizes.length,queue=[start];start.group=g;let n=0;
  while(queue.length){const c=queue.pop();n++;for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){const k=index.get(key(c.i+di,c.j+dj));if(k===undefined)continue;const o=cells[k];if(o.group<0&&clearSegment(map,c,o)){o.group=g;queue.push(o)}}}
  sizes.push(n)}
 const main=sizes.indexOf(Math.max(...sizes));let best=null,score=Infinity;
 for(const c of cells){if(c.group!==main)continue;const d=(c.x-p.x)**2+(c.z-p.z)**2;if(d<score){score=d;best={x:c.x,z:c.z}}}
 return best;
}
export function findPath(map,start,end,{reach=.51}={}){
 if(blocked(map,start.x,start.z)||!Number.isFinite(end.x)||!Number.isFinite(end.z))return [];
 if(clearSegment(map,start,end))return Math.hypot(start.x-end.x,start.z-end.z)<1e-9?[]:[{x:end.x,z:end.z}];
 const step=map.step??.5,key=(x,z)=>`${x},${z}`,queue=[],seen=new Set(),parents=new Map(),prefixes=new Map();
 // Connect the actual off-grid start to safe nodes, never through a corner.
 const sx=Math.round(start.x/step),sz=Math.round(start.z/step);
 for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){
  const x=sx+dx,z=sz+dz,p={x:x*step,z:z*step};let prefix=[];
  if(!clearSegment(map,start,p)){const corner=[{x:p.x,z:start.z},{x:start.x,z:p.z}].find(c=>clearSegment(map,start,c)&&clearSegment(map,c,p));if(!corner)continue;prefix=[corner]}
  const k=key(x,z);seen.add(k);queue.push([x,z]);parents.set(k,null);prefixes.set(k,prefix);
 }
 let found=null;
 for(let i=0;i<queue.length&&i<40000;i++){
  const [x,z]=queue[i],p={x:x*step,z:z*step};
  const distance=Math.hypot(p.x-end.x,p.z-end.z);
  if(distance<=reach||distance<=step*1.5&&clearSegment(map,p,end)){found=[x,z];break}
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,nz=z+dz,k=key(nx,nz);if(seen.has(k)||!clearSegment(map,p,{x:nx*step,z:nz*step}))continue;seen.add(k);parents.set(k,[x,z]);queue.push([nx,nz])}
 }
 if(!found)return [];const path=[];let cur=found;
 while(cur){const k=key(...cur);path.push({x:cur[0]*step,z:cur[1]*step});const parent=parents.get(k);if(!parent)path.push(...(prefixes.get(k)||[]).toReversed());cur=parent}
 path.reverse();if(clearSegment(map,path.at(-1),end))path.push({x:end.x,z:end.z});
 return path.filter((p,i)=>i||Math.hypot(p.x-start.x,p.z-start.z)>1e-9);
}

export function approachPath(map,start,target,distance=1.35,sightMap=null){
 const candidates=Array.from({length:16},(_,i)=>{const a=i*Math.PI/8;return {x:target.x+Math.cos(a)*distance,z:target.z+Math.sin(a)*distance}})
  .filter(p=>!blocked(map,p.x,p.z)&&(!sightMap||clearSegment(sightMap,p,target))).sort((a,b)=>Math.hypot(a.x-start.x,a.z-start.z)-Math.hypot(b.x-start.x,b.z-start.z));
 for(const p of candidates){const path=findPath(map,start,p,{reach:.15});if(path.length&&Math.hypot(path.at(-1).x-p.x,path.at(-1).z-p.z)<.16)return path}
 return [];
}
