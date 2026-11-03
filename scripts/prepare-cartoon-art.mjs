import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';import sharp from 'sharp';
const OUT=path.resolve('../output/cartoon-variety'),RAW=path.join(OUT,'raw'),DEST=path.resolve('public/cartoon-art'),manifest={version:1,provider:'Sorceress',imageModel:'gpt-image-2.5-sunburst',animationModel:'wan/2-7-image-to-video',styles:{}};
const read=async p=>JSON.parse(await fs.readFile(p,'utf8')),exists=async p=>fs.access(p).then(()=>true,()=>false),motions=['idle','talk','explain','think','react','celebrate','walk'];
const selections=await read(path.join(OUT,'frame-selection.json'));
const contact=[];const save=async (style,name,buffer,extra)=>{const dir=path.join(DEST,style),sha256=crypto.createHash('sha256').update(buffer).digest('hex'),filename=name+'-'+sha256.slice(0,10)+'.webp';await fs.mkdir(dir,{recursive:true});await fs.writeFile(path.join(dir,filename),buffer);const m=await sharp(buffer).metadata();return {url:`/cartoon-art/${style}/${filename}`,width:m.width,height:m.height,bytes:buffer.length,sha256,...extra}};
for(const style of ['anime','paper']){
 const pack=manifest.styles[style]={backgrounds:{},cast:{}};
 for(const scene of ['observatory','workshop','garden','city']){pack.backgrounds[scene]=[];for(let n=0;n<3;n++){const folder=path.join(RAW,style==='anime'&&scene==='garden'&&n===0?'background-anime-garden-0-retry':`background-${style}-${scene}-${n}`);if(!await exists(path.join(folder,'result.json')))continue;const r=await read(path.join(folder,'result.json'));const buffer=await sharp(path.join(folder,'gpt-image-2.5-sunburst-1.png')).resize(1280,720,{fit:'cover'}).webp({quality:88}).toBuffer();pack.backgrounds[scene][n]=await save(style,`background-${scene}-${n}`,buffer,{sourceJobId:r.jobId});contact.push({style,label:scene+' / '+n,buffer});}}
 for(const speaker of ['guide','learner']){
  const clips=[];let minX=Infinity,minY=Infinity,maxX=0,maxY=0,sourceW,sourceH;
  for(const motion of motions){const folder=path.join(RAW,(style==='anime'&&speaker==='learner'&&motion==='explain'?'key-anime-learner-explain-retry':`key-${style}-${speaker}-${motion}`));if(!await exists(path.join(folder,'result.json')))continue;const result=await read(path.join(folder,'result.json')),m=result.spriteSheet,file=path.join(folder,'keyed_sheet.png');if(!await exists(file))continue;
   if(sourceW&&sourceW!==m.frameW||sourceH&&sourceH!==m.frameH)throw Error('Source dimensions differ across cast '+style+speaker);sourceW=m.frameW;sourceH=m.frameH;
   const sourceFrames=selections[`${style}-${speaker}-${motion}`]?.sourceFrames||Array.from({length:m.frameCount},(_,i)=>i),kept=new Set(sourceFrames);
   const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
   for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){const cell=Math.floor(y/m.frameH)*m.cols+Math.floor(x/m.frameW);if(cell>=m.frameCount||!kept.has(cell)||data[(y*info.width+x)*4+3]<32)continue;const px=x%m.frameW,py=y%m.frameH;minX=Math.min(minX,px);maxX=Math.max(maxX,px);minY=Math.min(minY,py);maxY=Math.max(maxY,py);}
   clips.push({motion,result,m,file,sourceFrames});
  }
  if(clips.length!==motions.length)continue;
  // One crop for the entire cast, never per-frame auto-trimming: stable feet and scale.
  const crop={left:Math.max(0,minX-6),top:Math.max(0,minY-6),width:Math.min(sourceW-1,maxX+6)-Math.max(0,minX-6)+1,height:Math.min(sourceH-1,maxY+6)-Math.max(0,minY-6)+1},frameHeight=style==='anime'?640:560,frameWidth=Math.round(crop.width/crop.height*frameHeight);pack.cast[speaker]={};
  for(const {motion,result,m,file,sourceFrames} of clips){const columns=5,rows=Math.ceil(m.frameCount/columns),layers=[];
   for(let n=0;n<m.frameCount;n++){const sourceFrame=sourceFrames[n],buffer=await sharp(file).extract({left:sourceFrame%m.cols*m.frameW+crop.left,top:Math.floor(sourceFrame/m.cols)*m.frameH+crop.top,width:crop.width,height:crop.height}).resize(frameWidth,frameHeight).png().toBuffer();layers.push({input:buffer,left:n%columns*frameWidth,top:Math.floor(n/columns)*frameHeight});}
   const buffer=await sharp({create:{width:columns*frameWidth,height:rows*frameHeight,channels:4,background:'#00000000'}}).composite(layers).webp({quality:92,alphaQuality:100}).toBuffer();const anim=await read(path.join(RAW,`clip-${style}-${speaker}-${motion}`,'result.json'));
   pack.cast[speaker][motion]=await save(style,`${speaker}-${motion}`,buffer,{frameWidth,frameHeight,columns,frames:m.frameCount,fps:m.fps,alpha:true,sourceCrop:crop,sourceFrames,sourceJobId:anim.jobId,keyJobId:result.jobId,characterAssetId:(await read(path.join(RAW,'cast-'+style+'-'+speaker,'launch.json'))).data.assetId});
   const samples=[];for(const [i,n] of [0,3,6,10,14].map(n=>Math.min(m.frameCount-1,n)).entries()){const frame=await sharp(layers[n].input).resize(180,270,{fit:'contain',background:'#d6d1c8'}).flatten({background:'#d6d1c8'}).toBuffer();samples.push({input:frame,left:i*180,top:0});}
   await sharp({create:{width:900,height:270,channels:3,background:'#d6d1c8'}}).composite(samples).jpeg({quality:90}).toFile(path.join(OUT,`${style}-${speaker}-${motion}-contact.jpg`));
  }
 }
 const entries=contact.filter(x=>x.style===style),layers=[];for(const [i,a] of entries.entries()){layers.push({input:await sharp(a.buffer).resize(400,225).toBuffer(),left:i%3*400,top:Math.floor(i/3)*250});layers.push({input:Buffer.from(`<svg width="400" height="25"><text x="12" y="18" font-family="Arial" font-size="14" fill="#203145">${a.label}</text></svg>`),left:i%3*400,top:Math.floor(i/3)*250+225});}if(entries.length)await sharp({create:{width:1200,height:Math.ceil(entries.length/3)*250,channels:3,background:'#edeae2'}}).composite(layers).jpeg({quality:90}).toFile(path.join(OUT,style+'-background-contact.jpg'));
}
await fs.writeFile(path.join(DEST,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({backgrounds:contact.length,clips:Object.values(manifest.styles).reduce((n,p)=>n+Object.values(p.cast).reduce((a,c)=>a+Object.keys(c).length,0),0)}));
