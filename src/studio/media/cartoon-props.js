import {validatePerformance} from '../../cartoon-performance.js';
const clamp=v=>Math.max(0,Math.min(1,v));
export function performanceAtTime(segment,elapsed,duration,still=false){
 if(!segment.performance)return null;
 const p=validatePerformance(segment.performance),travel=['travel-right','travel-left','pursuit','retreat'].includes(segment.direction?.blocking),start=duration*(travel?.74:.32),length=Math.min(2,duration*(travel?.24:.5)),u=still?1:clamp((elapsed-start)/Math.max(.01,length));
 return {...p,progress:u,active:!still&&elapsed>=start&&elapsed<start+length,time:u*2};
}
export function propAtTime({prop,state,performance,actors,hands={},still=false}){
 if(!prop||prop==='none'||!state)return null;
 const floor=s=>s.ground||({x:s.side==='right'?880:400,y:500}),hand=owner=>hands[owner]||{x:actors.find(a=>a.speaker===owner).x+35,y:actors.find(a=>a.speaker===owner).y-190};
 const point=s=>s.owner==='floor'?floor(s):hand(s.owner),p=performance,u=still?1:p?.progress||0,from=point(state.before),to=point(state.after);
 let progress=u,arc=0;
 if(['pick-up','place'].includes(p?.interaction))progress=u<.5?0:1;
 else if(['pass','kick'].includes(p?.interaction)){
  progress=p.interaction==='kick'?clamp((u-.5)/.45):clamp((u-.35)/.3);if(p.interaction==='pass'||p.interaction==='kick')arc=Math.sin(progress*Math.PI)*(p.interaction==='kick'?90:65);
 }else progress=u>=.6?1:0;
 const x=from.x+(to.x-from.x)*progress,y=from.y+(to.y-from.y)*progress-arc;
 return {kind:prop,x,y,rotation:p?.interaction==='kick'?progress*Math.PI*3:0,activated:(u<.65?state.before:state.after).activated};
}
// Original authored vector props. These never encode source quantities or scores.
export function drawStoryProp(c,p,style='anime'){
 if(!p)return;c.save();c.translate(p.x,p.y);c.rotate(p.rotation);c.lineWidth=style==='paper'?3:2;c.strokeStyle='#243343';
 const rect=(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(x,y,w,h);c.strokeRect(x,y,w,h)},circle=(x,y,r,color)=>{c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=color;c.fill();c.stroke()};
 if(p.activated){c.save();c.globalAlpha=.18;circle(0,0,44,'#ffd768');c.restore();}
 if(p.kind==='football'){circle(0,0,21,'#f9f4df');c.fillStyle='#243343';c.beginPath();for(let i=0;i<5;i++){const a=-Math.PI/2+i*Math.PI*2/5;i?c.lineTo(Math.cos(a)*9,Math.sin(a)*9):c.moveTo(Math.cos(a)*9,Math.sin(a)*9)}c.closePath();c.fill();for(let i=0;i<5;i++){const a=-Math.PI/2+i*Math.PI*2/5;c.beginPath();c.moveTo(Math.cos(a)*9,Math.sin(a)*9);c.lineTo(Math.cos(a)*20,Math.sin(a)*20);c.stroke();}}
 if(p.kind==='lantern'){c.beginPath();c.arc(0,-22,9,Math.PI,0);c.stroke();rect(-14,-22,28,40,'#405d68');rect(-9,-15,18,25,p.activated?'#fff3a9':'#dbb863');rect(-18,18,36,5,'#bb9860');}
 if(p.kind==='key'){circle(-12,-4,12,'#d6af63');circle(-12,-4,4,'#f5db9c');rect(-1,-7,31,7,'#d6af63');rect(16,0,6,9,'#d6af63');rect(25,0,6,9,'#d6af63');}
 if(p.kind==='parcel'){rect(-23,-18,46,36,'#bc8654');rect(-4,-18,8,36,'#efd5a0');c.beginPath();c.moveTo(-23,-7);c.lineTo(23,-7);c.stroke();}
 if(p.kind==='book'){rect(-22,-27,44,54,'#527e93');rect(-17,18,39,7,'#f2e6c8');rect(-22,-27,6,54,'#33495e');c.strokeStyle='#d8bf7f';c.strokeRect(-10,-18,23,25);}
 if(p.kind==='battery'){rect(-14,-24,28,48,'#47627c');rect(-7,-29,14,5,'#b9c7cf');rect(-9,-18,18,35,p.activated?'#9de5c0':'#d3ac67');c.strokeStyle='#304652';c.beginPath();c.moveTo(2,-12);c.lineTo(-5,1);c.lineTo(4,1);c.lineTo(-2,12);c.stroke();}
 c.restore();
}
