import {makeInteriors,BUILDINGS} from './interiors.js';
const prop=(asset,x,z,scale=1,rotation=0)=>({asset,x,z,scale,rotation});
const npc=(name,x,z)=>({id:'npc',kind:'npc',name,x,z,asset:'ivo'});
const exit=(to,x,z)=>({id:'exit-'+to,kind:'exit',to,name:to,x,z,asset:'arch'});
const mechanism=(id,name,x,z)=>({id,kind:'puzzle',name,x,z,asset:'pedestal'});
const enemy=(id,name,x,z,asset='moss_guardian')=>({id,kind:'enemy',name,x,z,asset});
const chest=(x,z)=>({id:'chest',kind:'chest',name:'Supply chest',x,z,asset:'chest'});
export const MAPS={
quay:{name:'Sunward Quay',tag:'A harbour at the edge of the familiar',color:0x87986b,sky:0xaecbd2,music:'journey',props:[prop('house',-6,-3),prop('house',5,-4,1.15),prop('stall',-5,3),prop('palm',-8,1),prop('palm',8,2),prop('lamp',2,-2),prop('flowers',-2,-3),prop('fountain',0,-2),prop('polyfork_cart',8,-5),prop('polyfork_barrel',-7,5),prop('polyfork_barrel',-7,6)],obstacles:[[-6,-3,3.5,3.5],[5,-4,4,4],[-5,3,3,2],[0,-2,2,2],[8,-5,1.57,2.52],[-7,5.5,.89,1.9]],entities:[npc('Keeper Aster',2,1),{id:'rest',kind:'rest',name:'Rest by the spring',x:-1,z:0,asset:'sign'},exit('woods',-8,-5),exit('mill',8,-1),exit('forge',5,6),chest(-3,5)]},
woods:{name:'Mossbell Woods',tag:'The forest remembers its old paths',color:0x71845f,sky:0x9cbcaf,music:'journey',props:[...[-8,-5,5,8].flatMap((x,i)=>[prop('tree',x,-5,1.1),prop('pine',x,4,i%2?.9:1.15)]),prop('flowers',-3,1),prop('rock',3,-3),prop('lantern_fox',-4,-1,.55)],obstacles:[[-8,-5,2,2],[-5,-5,2,2],[5,-5,2,2],[8,-5,2,2],[-8,4,2,2],[-5,4,2,2],[5,4,2,2],[8,4,2,2],[3,-3,2,2]],entities:[npc('Tala, pathkeeper',-3,-2),mechanism('sequence','The Memory Gate',0,-4),enemy('bramble','Bramble sentinel',4,0),exit('quay',-8,0),exit('quarry',8,0),chest(0,6)]},
mill:{name:'Tidewheel Mill',tag:'One current, many needs',color:0x929b72,sky:0xb4d6dd,music:'journey',props:[prop('house',-5,-4,1.3),prop('waterwheel',-2,-4,1.2),prop('bridge',2,1,1.2,Math.PI/2),prop('tree',-7,4),prop('rock',6,-5),prop('lamp',6,3),prop('polyfork_barrel',-5,3),prop('polyfork_barrel',-4,3)],obstacles:[[-5,-4,4,4],[-2,-4,2,3],[-7,4,2,2],[6,-5,2,2],[-4.5,3,1.9,.89]],entities:[npc('Rook, millwright',-3,0),mechanism('allocation','The Sharing Sluice',3,-3),exit('quay',-8,1),exit('archive',8,1),chest(5,5)]},
quarry:{name:'Prism Hollow',tag:'Even the dark holds a little colour',color:0x7b8490,sky:0x607a97,music:'discovery',props:[...[-8,-5,5,8].map((x,i)=>prop('rock',x,-4,1.7)),prop('crystal',-6,3,1.7),prop('crystal',6,4,1.2),prop('pillar',0,-5,1.2),prop('crystal',3,-2,.8)],obstacles:[[-8,-4,3,3],[-5,-4,3,3],[5,-4,3,3],[8,-4,3,3],[-6,3,2,2],[6,4,2,2]],entities:[npc('Nim, crystal surveyor',-2,-1),enemy('shard','Prism prowler',3,1,'lantern_fox'),exit('woods',-8,0),exit('forge',8,0),chest(0,5)]},
forge:{name:'Cinder Workshop',tag:'A place to mend what matters',color:0xa4947e,sky:0xd0b7a8,music:'journey',props:[prop('forge',-5,-3,1.5),prop('house',5,-4),prop('lamp',-5,4),prop('rock',7,4),prop('waterwheel',0,-5,.8)],obstacles:[[-5,-3,4,3],[5,-4,4,3],[7,4,2,2]],entities:[npc('Jori, lantern smith',-2,0),enemy('cinder','Cinder sentinel',4,1),exit('quay',-8,4),exit('quarry',-8,-4),exit('observatory',8,0),chest(0,5)]},
observatory:{name:'Starfall Observatory',tag:'Three windows into the same sky',color:0x8594a1,sky:0x8999bc,music:'discovery',props:[prop('dome',-5,-4,1.2),prop('telescope',4,-3,1.4),prop('pillar',-6,3),prop('pillar',6,4),prop('flowers',2,4),prop('crystal',0,-6)],obstacles:[[-5,-4,4,4],[4,-3,2,2],[-6,3,1.5,1.5],[6,4,1.5,1.5]],entities:[npc('Edda, skywatcher',-2,-1),mechanism('dials','The Three Lenses',1,-2),exit('forge',-8,0),exit('beacon',8,0),chest(1,5)]},
archive:{name:'Cloudscript Archive',tag:'Every claim has a story behind it',color:0xb2ac96,sky:0xc7ccd7,music:'discovery',props:[...[-6,-3,3,6].map(x=>prop('shelf',x,-4,1.15)),prop('pillar',-7,4),prop('pillar',7,4),prop('bed',5,2),prop('lamp',-4,2)],obstacles:[[-6,-4,2.8,1.3],[-3,-4,2.8,1.3],[3,-4,2.8,1.3],[6,-4,2.8,1.3],[-7,4,1.5,1.5],[7,4,1.5,1.5],[5,2,2,2]],entities:[npc('Sable, archivist',-3,0),mechanism('matching','The Thread Table',1,-2),exit('mill',-8,0),exit('beacon',8,0),chest(0,5)]},
beacon:{name:'The Last Beacon',tag:'Carry what you have learned into the light',color:0xa3aaa0,sky:0x9fb7ca,music:'discovery',props:[prop('astral_beacon',0,-5,1.3),prop('pillar',-5,-4,1.3),prop('pillar',5,-4,1.3),prop('crystal',-6,3),prop('crystal',6,3),prop('lamp',-3,5),prop('lamp',3,5)],obstacles:[[0,-5,4,3],[-5,-4,2,2],[5,-4,2,2],[-6,3,2,2],[6,3,2,2]],entities:[npc('Ivo’s old teacher',-3,0),enemy('guardian','Challenge the Hollow Warden',2,-1),exit('archive',-8,0),exit('observatory',8,0)]}
};
export const WORLD_BOUNDS={x:22,z:18};
// These cells make adjacent roads agree: north/south/east/west remain coherent
// when travelling back. Educational anchors retain their existing coordinates.
const CELLS={quarry:[-1,-1],forge:[0,-1],observatory:[1,-1],beacon:[2,-1],woods:[-1,0],quay:[0,0],mill:[1,0],archive:[2,0]};
for(const [id,m] of Object.entries(MAPS)){
 m.bounds=WORLD_BOUNDS;m.worldCell=CELLS[id];m.roads=[];m.backdrop=[];m.boundaries=[];
 for(const e of m.entities)if(e.kind==='exit'){
  const dx=CELLS[e.to][0]-CELLS[id][0],dz=CELLS[e.to][1]-CELLS[id][1];e.x=dx*21;e.z=dz*17;e.asset='sign';e.name='Road to '+MAPS[e.to].name;m.roads.push({x:dx*37,z:dz*33,to:e.to});
 }
 // Use library buildings at their authored metre scale, with matching solid
 // footprints. Their height makes streets feel enclosed instead of toy-sized.
 for(const p of m.props){
  if(p.asset==='house'){
   const old=m.obstacles.find(b=>b[0]===p.x&&b[1]===p.z);p.asset=id==='forge'?'polyfork_townhouse':'polyfork_cottage';p.scale=1;
   if(old){old[2]=id==='forge'?5.7:6;old[3]=id==='forge'?7.66:3.97}
  }
 }
 const add=(asset,x,z,w,h,rotation=0)=>{m.props.push(prop(asset,x,z,1,rotation));m.obstacles.push([x,z,w,h])};
 if(['quay','forge','archive','mill'].includes(id)){
  add('polyfork_townhouse',-13,-11,5.7,7.66);add('polyfork_cottage',13,-11,6,3.97);
  if(id==='quay'||id==='archive'){add('polyfork_cottage',-13,10,6,3.97);add('polyfork_townhouse',13,10,5.7,7.66)}
 }else if(id==='woods'){
  for(const [x,z] of [[-13,-10],[13,-10],[-13,10],[13,10],[-5,12],[5,-12]])add('polyfork_maple',x,z,1.2,1.2);
 }else if(id==='observatory'||id==='beacon'){
  for(const x of [-13,13])for(const z of [-10,10]){m.props.push(prop('pillar',x,z,1.8));m.obstacles.push([x,z,2.2,2.2])}
 }
 // A dense belt of trees/cliffs hides the inaccessible world beyond the map.
 // Open corridors align with the road exits; no exposed floating edge remains.
 const gap=(x,z)=>m.roads.some(r=>r.x?Math.sign(x)===Math.sign(r.x)&&Math.abs(x)>20&&Math.abs(z)<3.6:Math.sign(z)===Math.sign(r.z)&&Math.abs(z)>16&&Math.abs(x)<3.6);
 let n=0;
 for(let x=-42;x<=42;x+=3.8)for(let z=-38;z<=38;z+=3.8){
  const outside=Math.abs(x)>22.4||Math.abs(z)>18.4;if(!outside||gap(x,z))continue;
  const jitter=Math.sin(x*13.1+z*7.7)*.48;const asset=id==='quarry'?'rock':['polyfork_maple','polyfork_pine','polyfork_birch'][(n++)%3];m.backdrop.push(prop(asset,x+jitter,z-jitter,id==='quarry'?3.5:1,Math.sin(x+z)*3));
 }
 // Continuous collision belts sit inside the visible canopy/cliff line.
 for(const x of [-22.2,22.2])for(let z=-18;z<=18;z+=2){if(gap(x,z))continue;m.boundaries.push([x,z,1,2.1]);}
 for(const z of [-18.2,18.2])for(let x=-22;x<=22;x+=2){if(gap(x,z))continue;m.boundaries.push([x,z,2.1,1]);}
 m.obstacles.push(...m.boundaries);
}
export const INTERIORS=makeInteriors(MAPS);
export {BUILDINGS};
export const getMap=s=>s.interior?INTERIORS[s.interior]:MAPS[s.area];
export const blocked=(map,x,z)=>Math.abs(x)>map.bounds.x||Math.abs(z)>map.bounds.z||map.obstacles.some(([cx,cz,w,h])=>Math.abs(x-cx)<w/2+.25&&Math.abs(z-cz)<h/2+.25);
export function findPath(map,start,end){
 const step=.5,key=(x,z)=>`${x},${z}`,grid=p=>[Math.round(p.x/step),Math.round(p.z/step)];const [sx,sz]=grid(start),[ex,ez]=grid(end);const queue=[[sx,sz]],seen=new Set([key(sx,sz)]),parents=new Map();let found=null;
 for(let i=0;i<queue.length&&i<12000;i++){const [x,z]=queue[i];if(Math.hypot(x-ex,z-ez)<=1){found=[x,z];break}for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,nz=z+dz,k=key(nx,nz);if(seen.has(k)||blocked(map,nx*step,nz*step))continue;seen.add(k);parents.set(k,[x,z]);queue.push([nx,nz])}}
 if(!found)return [];const path=[];let cur=found;while(cur[0]!==sx||cur[1]!==sz){path.push({x:cur[0]*step,z:cur[1]*step});cur=parents.get(key(...cur));if(!cur)return []}return path.reverse();
}
