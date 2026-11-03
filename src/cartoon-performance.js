// Muse selects only authored assets and interactions. No model coordinates or code.
export const STORY_PROPS=Object.freeze(['none','football','lantern','key','parcel','book','battery']);
export const PERFORMANCE_MOVES=Object.freeze(['natural','run','jump']);
export const PROP_INTERACTIONS=Object.freeze(['none','pick-up','hold','pass','place','kick','activate']);
export const PROP_LABELS=Object.freeze({none:'No featured prop',football:'Football',lantern:'Lantern',key:'Key',parcel:'Parcel',book:'Book',battery:'Power cell'});
const need=(v,m)=>{if(!v)throw Error(m)};
export function validatePerformance(value){
 need(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===3&&Object.keys(value).every(k=>['actor','move','interaction'].includes(k)),'Choose a character, movement and prop interaction.');
 need(['guide','learner'].includes(value.actor)&&PERFORMANCE_MOVES.includes(value.move)&&PROP_INTERACTIONS.includes(value.interaction),'Unsupported cartoon performance.');
 return {actor:value.actor,move:value.move,interaction:value.interaction};
}
export function advanceProp(state,performance,prop,scene){
 const p=validatePerformance(performance),next={...state};
 need(STORY_PROPS.includes(prop),'Choose an authored story prop.');
 need(!(p.move!=='natural'&&p.interaction!=='none'),'Perform the prop interaction in its own beat.');
 if(prop==='none'){need(p.interaction==='none','This story has no featured prop.');return next;}
 if(next.location!==scene){need(next.owner!=='floor','Pick up the prop before travelling to another setting.');next.location=scene;}
 if(p.interaction==='pick-up'){need(next.owner==='floor','The prop must be on the ground before picking it up.');next.owner=p.actor;}
 if(['hold','pass','place','activate'].includes(p.interaction)){
  need(next.owner===p.actor,'Only the character holding the prop can use it.');
  if(p.interaction==='pass')next.owner=p.actor==='guide'?'learner':'guide';
  if(p.interaction==='place')next.owner='floor';
  if(p.interaction==='activate'){need(['lantern','battery','key','book'].includes(prop),'This prop cannot be activated.');next.activated=!next.activated;}
 }
 if(p.interaction==='kick'){need(prop==='football'&&next.owner==='floor','Only a football on the ground can be kicked.');next.side=next.side==='right'?'left':'right';}
 return next;
}
export function propStates(segments,prop){
 let state={owner:'floor',location:segments[0]?.scene,activated:false,side:'left'};
 return segments.map(segment=>{const before={...state};state=advanceProp(state,segment.performance,prop,segment.scene);return {before,after:{...state}};});
}
export function validatePerformances(segments,prop){
 need(STORY_PROPS.includes(prop),'Choose an authored story prop.');
 for(const s of segments){const p=validatePerformance(s.performance);if(!['none','hold'].includes(p.interaction))need(!['travel-right','travel-left','pursuit','retreat'].includes(s.direction.blocking),'Stop travelling before interacting with a prop.');}
 propStates(segments,prop);return true;
}
export const PERFORMANCE_BRIEF=`Choose story.prop from none/football/lantern/key/parcel/book/battery to suit the selected interest and plot, not to decorate a lecture. Each cartoon segment has performance {actor:guide|learner,move:natural|run|jump,interaction:none|pick-up|hold|pass|place|kick|activate}. Choose the character who acts, who need not be speaking. Make at least two meaningful interactions if a prop is chosen. The single featured prop starts on the floor in the first setting. Pick-up requires it on the floor; hold, pass, place and activate require the acting character to hold it. Pass transfers it to the other character; place returns it to the floor. Kick only works with a football on the floor. Activate works with lantern, battery, key or book. Carry the prop before changing settings; it cannot teleport. Use move:natural during any prop interaction. For pick-up/pass/place/kick/activate choose arrive/approach/separate/face-off blocking so characters stop to interact. Run and jump are story actions, not arbitrary loops. Never invent extra objects or supplies in the resolution. Performance directions are silent and should match the spoken story. All timing, contact points and physics are authored by the runtime.`;
