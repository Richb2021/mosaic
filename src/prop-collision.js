import {VARIETY_PROPS} from './variety-props.js';
// Footprints describe the solid base. Tree canopies, flowers and bridge decks
// remain passable; rails/pillars are separate solid rectangles.
export const EXTRA_PROPS={
 polyfork_anvil:[.81,.76],polyfork_bread_oven:[1.59,1.55],polyfork_crate:[.9,.66],polyfork_fence_wood:[2,.15],
 polyfork_flower_planter:[.82,.32],polyfork_haystack:[2.02,2.04],polyfork_quench_barrel:[1.08,1.08],polyfork_sack:[.58,.55],
 polyfork_stone_wall:[2.05,.5],polyfork_tree_stump:[1.25,1.14],polyfork_water_trough:[2.35,1.06],polyfork_well:[1.96,1.53]
};
const BASES={...EXTRA_PROPS,lantern_fox:[.7,1.1],tree:[.65,.65],pine:[.65,.65],palm:[.55,.55],polyfork_maple:[.7,.7],polyfork_pine:[.65,.65],polyfork_birch:[.5,.5],lamp:[.3,.3],rock:[1.5,1.5],crystal:[.8,.8],pillar:[.8,.8],waterwheel:[1.6,1.6],shelf:[2.4,.85],bed:[1.4,2.1],telescope:[1.1,1.1],room_table:[2.5,1.4],room_chair:[.7,.7],room_counter:[3.6,1.1],room_hearth:[1.5,1.2],room_crate:[.9,.9],works_pipe:[1.2,1.2],works_pillar:[1,1],works_turbine:[3,3],works_tank:[3.2,3.2]};
export function propBoxes(p){
 const s=p.scale??1,r=p.rotation||0,c=Math.abs(Math.cos(r)),n=Math.abs(Math.sin(r));
 const box=([x,z,w,h])=>{const dx=x*s,dz=z*s;return [p.x+dx*Math.cos(r)+dz*Math.sin(r),p.z-dx*Math.sin(r)+dz*Math.cos(r),(w*c+h*n)*s,(w*n+h*c)*s]};
 if(VARIETY_PROPS[p.asset])return [box(VARIETY_PROPS[p.asset])];
 if(p.asset==='arch')return [[-1,0,.7,.8],[1,0,.7,.8]].map(box);
 if(p.asset==='bridge')return [[0,-.64,3.4,.12],[0,.64,3.4,.12]].map(box);
 if(p.asset==='works_bridge')return [[-2.15,0,.18,5.4],[2.15,0,.18,5.4],[-2.6,0,.3,8.5],[2.6,0,.3,8.5]].map(box); // hand rails, then the side girders
 const dims=BASES[p.asset];return dims?[box([0,0,...dims])]:[];
}
export function solidProps(map){
 const obstacles=[...map.obstacles];
 for(const p of map.props){if(map.obstacles.some(b=>Math.abs(b[0]-p.x)<.01&&Math.abs(b[1]-p.z)<.01))continue;obstacles.push(...propBoxes(p))}
 return {...map,obstacles};
}
const ENTITY_BASES={pedestal:[1.8,1.8],chest:[1.16,.82],room_hearth:[2.1,1.2],room_chair:[.7,.7],works_console:[1.8,1.2],works_beetle:[2.74,2.5],works_sentry:[1.7,1.7],works_heart:[3.6,3.6]}; // measured from each model's base
export function interactionDistance(e){const d=ENTITY_BASES[e.asset];return d?Math.max(1.35,Math.min(...d)/2+.6):1.35}
export function stateScenery(map,state,completedRooms=new Set()){
 const props=[];
 if(map.works)for(const x of [-8,8])props.push({asset:'lamp',x,z:-7,scale:.8});
 if(state.area==='mill'&&!state.interior&&!state.chapter?.room&&state.chapter?.completed&&state.chapter.choice!=='gardens')for(const x of [-3,0,3])props.push({asset:'lamp',x,z:7});
 if(map.interior&&!map.works&&completedRooms.has(map.building)&&['inn','workshop'].includes(map.building))props.push({asset:map.building==='inn'?'room_crate':'crystal',x:-2.6,z:2.8,scale:.65});
 return {...map,obstacles:[...map.obstacles,...props.flatMap(propBoxes)]};
}
export function navigationMap(map,entities){
 const boxes=(entities||map.entities||[]).flatMap(v=>{
  const e=v.e||v;
  if(e.asset==='arch')return propBoxes({...e,scale:1});
  if(['exit','door','leave','rest'].includes(e.kind))return [[e.x,e.z,.15,.15]];
  if(e.kind==='discovery')return [[e.x,e.z,.23,.23]];
  if(['npc','resident','visitor','enemy','chest','puzzle','workbench'].includes(e.kind)||e.kind==='works'&&!['works-aftermath','works-board'].includes(e.id)){
   const dims=ENTITY_BASES[e.asset]||[e.kind==='enemy'?1:.65,e.kind==='enemy'?1:.65];return [[e.x,e.z,...dims]];
  }
  return [];
 });
 return {...map,obstacles:[...map.obstacles,...boxes]};
}
