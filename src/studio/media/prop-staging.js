import {propStates} from '../../cartoon-performance.js';
import {stageAtTime} from './cartoon-director.js';
// Ground contacts are authored from each scene's floor paths, never model data.
export function stagePropStates(script){
 if(script.schemaVersion!==3)return null;
 const states=propStates(script.segments,script.story.prop);let ground=null;
 return states.map((state,i)=>{
  const segment=script.segments[i],actorId=segment.performance.actor;
  let stage=stageAtTime({segment,index:i,elapsed:12,duration:12});let actor=stage.actors.find(a=>a.speaker===actorId);
  if(!ground)ground={x:actor.x+actor.facing*32,y:500};
  const before={...state.before,ground:{...ground}};
  stage=stageAtTime({segment,index:i,elapsed:12,duration:12,propState:{before}});actor=stage.actors.find(a=>a.speaker===actorId);
  if(segment.performance.interaction==='place')ground={x:actor.x+actor.facing*32,y:500};
  if(segment.performance.interaction==='kick')ground={x:Math.max(100,Math.min(1180,ground.x+actor.facing*450)),y:500};
  return {before,after:{...state.after,ground:{...ground}}};
 });
}
