import {performanceAtTime} from './cartoon-props.js';
import {validateDirection} from '../../story-direction.js';

const clamp=(n,a=0,b=1)=>Math.min(b,Math.max(a,Number.isFinite(n)?n:a));
const mix=(a,b,t)=>a+(b-a)*t;
const ease=t=>t*t*(3-2*t);
// Authored floor paths: [start x, end x, start depth, end depth]. No model geometry.
const PATHS=Object.freeze({
 arrive:[[100,390,525,525],[1180,890,515,515]],
 'travel-right':[[190,760,525,525],[480,1050,495,495]],
 'travel-left':[[800,230,505,505],[1090,520,530,530]],
 approach:[[210,500,525,525],[1080,790,510,510]],
 separate:[[500,250,520,510],[780,1040,520,530]],
 pursuit:[[160,850,525,525],[390,1080,500,500]],
 retreat:[[520,190,510,520],[800,470,530,530]],
 'face-off':[[350,430,520,520],[930,850,520,520]],
});
export function defaultDirection(index=0){
 const sequence=['arrive','travel-right','face-off','separate','travel-left','approach','pursuit','approach'];
 return {blocking:sequence[Math.max(0,index)%sequence.length],shot:index%3===1?'wide':index%3===2?'reaction':'two-shot',pace:'calm'};
}
export function stageAtTime({segment,index=0,elapsed=0,duration=12,still=false,propState=null,contactOffset=32}){
 const direction=segment.direction?validateDirection(segment.direction):defaultDirection(index);
 const t=clamp(elapsed,0,Math.max(.01,duration)),progress=clamp(t/Math.max(.01,duration));
 const travel=['travel-right','travel-left','pursuit','retreat'].includes(direction.blocking);
 const start=travel ? .03 : .04,end=travel ? .72 : .30;
 const u=still?1:clamp((progress-start)/(end-start)),pathTime=ease(u);
 const moving=!still&&progress>=start&&progress<end;
 const performance=performanceAtTime(segment,t,duration,still);
 const actors=['guide','learner'].map((speaker,i)=>{
  let [from,to,near,far]=PATHS[direction.blocking][i];
  if(propState?.before?.ground&&performance?.actor===speaker&&['pick-up','kick'].includes(performance.interaction))to=propState.before.ground.x-(i===0?contactOffset:-contactOffset);
  if(propState?.before?.ground&&performance?.actor!==speaker&&['pick-up','kick'].includes(performance?.interaction)){const actingTo=propState.before.ground.x-(performance.actor==='guide'?contactOffset:-contactOffset);if(Math.abs(actingTo-to)<250)to=clamp(actingTo+(speaker==='guide'?-250:250),100,1180);}
  const x=mix(from,to,pathTime),y=mix(near,far,pathTime),active=speaker===segment.speaker;
  const facing=moving?(to>from?1:-1):(i===0?1:-1);
  const settled=Math.max(0,t-duration*end),pulse=settled%8;
  let motion=moving?'walk':active?(segment.action==='think'?'think':segment.action==='celebrate'&&settled<2?'celebrate':pulse>2&&pulse<4?'explain':'talk'):(pulse>=4&&pulse<6?'react':'idle');
  if(still)motion=active?(segment.action==='think'?'think':segment.action==='celebrate'?'celebrate':'talk'):'idle';
  let time=still?0:motion==='think'?Math.min(settled,.95):motion==='walk'?t*(direction.pace==='urgent'?1.5:1):settled%2;
  if(performance){
   if(performance.actor===speaker&&performance.move==='run'&&moving){motion='run';time=t;}
   if(performance.active&&!moving&&(performance.actor===speaker||performance.interaction==='pass'&&speaker!==performance.actor)){
    if(performance.move==='jump')motion='jump';
    else if(performance.interaction==='kick')motion='kick';
    else if(['pick-up','place'].includes(performance.interaction))motion='pickup';
    else if(!['none','hold'].includes(performance.interaction))motion='reach';
    if(['jump','kick','reach','pickup'].includes(motion))time=Math.min(1.999,performance.interaction==='place'?2-performance.time:performance.time);
   }
  }
  const holder=propState?(performance?.progress>=.75?propState.after?.owner:propState.before?.owner):null;
  if(holder===speaker&&['talk','explain','think','react','celebrate'].includes(motion)){motion='idle';time=still?0:t%2;}
  return {speaker,x,y,facing,active,motion,time,moving,depth:(y-490)/50};
 });
 const speaker=actors.find(a=>a.active),listener=actors.find(a=>!a.active);
 // Establish geography, then stage the selected shot. No camera movement in still mode.
 const close=!still&&progress>.30&&!moving;
 const contact=['pick-up','place','kick'].includes(performance?.interaction);
 const shot=close&&!contact?direction.shot:'wide';
 const focus=shot==='speaker'?speaker:shot==='reaction'?listener:null;
 const scale=shot==='wide'?1:shot==='two-shot'?1.16:1.38;
 const centre=focus?clamp(focus.x,465,815):640;
 return {direction,progress,actors,performance,camera:{scale,x:640-centre*scale,y:-35*(scale-1)},shot};
}
