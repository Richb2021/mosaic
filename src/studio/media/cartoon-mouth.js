// Original vector visemes, using Rhubarb A–H/X semantics. Coordinates are authored
// or tracked asset anchors; Muse cannot supply facial geometry.
export function drawViseme(c,{x=0,y=0,width=20,shape='X',angle=0,paper=false}){
 c.save();c.translate(x,y);c.rotate(angle);c.lineWidth=paper?Math.max(1.5,width*.075):Math.max(1,width*.06);c.strokeStyle=paper?'#242431':'#583a39';
 const ellipse=(w,h,fill)=>{c.beginPath();c.ellipse(0,0,w/2,h/2,0,0,Math.PI*2);c.fillStyle=fill;c.fill();c.stroke()};
 if(shape==='X'||shape==='A'){c.beginPath();c.moveTo(-width*.42,0);c.quadraticCurveTo(0,shape==='A'?-width*.04:width*.06,width*.42,-width*.02);c.stroke();}
 else{
  const sizes={B:[1,.2],C:[.85,.5],D:[.85,.85],E:[.64,.58],F:[.4,.55],G:[.86,.29],H:[.8,.5]},[w,h]=sizes[shape]||sizes.C;
  ellipse(width*w,width*h,'#532d3d');
  if(['B','C','D','G','H'].includes(shape)){c.save();c.beginPath();c.ellipse(0,0,width*w/2,width*h/2,0,0,Math.PI*2);c.clip();c.fillStyle='#ffefd9';c.fillRect(-width/2,-width*h/2,width,width*(shape==='G'?.18:.12));if(['D','H'].includes(shape)){c.fillStyle='#d88a8e';c.beginPath();c.ellipse(0,width*h*.35,width*.25,width*.12,0,0,Math.PI*2);c.fill();}c.restore();}
 }
 c.restore();
}
export function drawSpriteMouth(ctx,clip,frame,w,h,shape,style){
 const a=clip.anchors?.[frame]?.mouth;if(!a||a.visible===false)return;
 const sx=w/clip.frameWidth,sy=h/clip.frameHeight,x=-w/2+a.x*sx,y=-h+a.y*sy;
 ctx.save();ctx.translate(x,y);ctx.rotate(a.angle||0);
 // Cover the baked speech mouth with sampled cheek colour before applying the
 // recording's viseme. Each anchor is tied to this exact sprite frame.
 ctx.fillStyle=a.skin;ctx.beginPath();ctx.ellipse(0,0,a.coverW*sx/2,a.coverH*sy/2,0,0,Math.PI*2);ctx.fill();
 drawViseme(ctx,{width:a.width*sx,shape,paper:style==='paper'});ctx.restore();
}
