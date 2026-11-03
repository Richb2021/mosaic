import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';import sharp from 'sharp';
const OUT=path.resolve('../output/cartoon-performance'),RAW=path.resolve('../output/cartoon-variety/raw'),PERF=path.join(OUT,'raw'),DEST=path.resolve('public/cartoon-art'),manifest={version:2,provider:'Sorceress',imageModel:'gpt-image-2.5-sunburst',animationModel:'wan/2-7-image-to-video',styles:{}};
const read=async p=>JSON.parse(await fs.readFile(p,'utf8')),exists=async p=>fs.access(p).then(()=>true,()=>false),motions=['idle','talk','explain','think','react','celebrate','walk','run','reach','jump','kick','pickup'];
const selections={...await read(path.resolve('../output/cartoon-variety/frame-selection.json')),...await read(path.join(OUT,'frame-selection.json'))};
const contact=[];const save=async (style,name,buffer,extra)=>{const dir=path.join(DEST,style),sha256=crypto.createHash('sha256').update(buffer).digest('hex'),filename=name+'-'+sha256.slice(0,10)+'.webp';await fs.mkdir(dir,{recursive:true});await fs.writeFile(path.join(dir,filename),buffer);const m=await sharp(buffer).metadata();return {url:`/cartoon-art/${style}/${filename}`,width:m.width,height:m.height,bytes:buffer.length,sha256,...extra}};
const only=process.argv[2];if(only)manifest.styles=(await read(path.join(DEST,'manifest.json'))).styles;
for(const style of ['anime','paper']){
 if(only&&!only.startsWith(style+'-'))continue;
 const pack=manifest.styles[style]||(manifest.styles[style]={backgrounds:{},cast:{}});
 pack.backgrounds=(await read(path.join(OUT,'baseline-manifest.json'))).styles[style].backgrounds;
 for(const speaker of ['guide','learner']){
  if(only&&only!==style+'-'+speaker)continue;
  const clips=[];let minX=Infinity,minY=Infinity,maxX=0,maxY=0,sourceW,sourceH;
  for(const motion of motions){const fresh=['run','reach','jump','kick','pickup'].includes(motion),clipRoot=fresh?PERF:RAW;const actualMotion=motion==='kick'?'sweep':style==='paper'&&speaker==='guide'&&motion==='pickup'?'pickupfix':motion;const folder=path.join(clipRoot,(actualMotion==='sweep'?`key-${style}-${speaker}-sweep`:actualMotion==='pickupfix'?'key-paper-guide-pickupfix':fresh&&motion==='reach'&&((style==='paper'&&speaker==='learner')||(style==='anime'&&speaker==='guide'))?`key-${style}-${speaker}-${motion}-retry`:style==='anime'&&speaker==='learner'&&motion==='explain'?'key-anime-learner-explain-retry':`key-${style}-${speaker}-${motion}`));if(!await exists(path.join(folder,'result.json')))continue;const result=await read(path.join(folder,'result.json')),m=result.spriteSheet,file=path.join(folder,'keyed_sheet.png');if(!await exists(file))continue;
   if(sourceW&&sourceW!==m.frameW||sourceH&&sourceH!==m.frameH)throw Error('Source dimensions differ across cast '+style+speaker);sourceW=m.frameW;sourceH=m.frameH;
   const sourceFrames=selections[`${style}-${speaker}-${motion}`]?.sourceFrames||Array.from({length:m.frameCount},(_,i)=>i),kept=new Set(sourceFrames);
   const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
   for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){const cell=Math.floor(y/m.frameH)*m.cols+Math.floor(x/m.frameW);if(cell>=m.frameCount||!kept.has(cell)||data[(y*info.width+x)*4+3]<32)continue;const px=x%m.frameW,py=y%m.frameH;minX=Math.min(minX,px);maxX=Math.max(maxX,px);minY=Math.min(minY,py);maxY=Math.max(maxY,py);}
   clips.push({motion,result,m,file,sourceFrames,clipRoot,actualMotion});
  }
  if(clips.length!==motions.length)throw Error('Missing action clip '+style+' '+speaker);
  // One crop for the entire cast, never per-frame auto-trimming: stable feet and scale.
  const crop={left:Math.max(0,minX-6),top:Math.max(0,minY-6),width:Math.min(sourceW-1,maxX+6)-Math.max(0,minX-6)+1,height:Math.min(sourceH-1,maxY+6)-Math.max(0,minY-6)+1},frameHeight=style==='anime'?480:440,frameWidth=Math.round(crop.width/crop.height*frameHeight);pack.cast[speaker]={};
  for(const {motion,result,m,file,sourceFrames,clipRoot,actualMotion} of clips){const columns=5,rows=Math.ceil(m.frameCount/columns),layers=[];
   for(let n=0;n<m.frameCount;n++){const sourceFrame=sourceFrames[n],buffer=await sharp(file).extract({left:sourceFrame%m.cols*m.frameW+crop.left,top:Math.floor(sourceFrame/m.cols)*m.frameH+crop.top,width:crop.width,height:crop.height}).resize(frameWidth,frameHeight).flop(style==='paper'&&speaker==='guide'&&motion==='kick').png().toBuffer();layers.push({input:buffer,left:n%columns*frameWidth,top:Math.floor(n/columns)*frameHeight});}
   const buffer=await sharp({create:{width:columns*frameWidth,height:rows*frameHeight,channels:4,background:'#00000000'}}).composite(layers).webp({quality:92,alphaQuality:100}).toBuffer();const anim=await read(path.join(clipRoot,`clip-${style}-${speaker}-${actualMotion}`,'result.json'));
   pack.cast[speaker][motion]=await save(style,`${speaker}-${motion}`,buffer,{frameWidth,frameHeight,columns,frames:m.frameCount,fps:m.fps,alpha:true,sourceCrop:crop,sourceFrames,sourceJobId:anim.jobId,keyJobId:result.jobId,characterAssetId:(await read(path.join(RAW,'cast-'+style+'-'+speaker,'launch.json'))).data.assetId});
   const samples=[];for(const [i,n] of [0,3,6,10,14].map(n=>Math.min(m.frameCount-1,n)).entries()){const frame=await sharp(layers[n].input).resize(180,270,{fit:'contain',background:'#d6d1c8'}).flatten({background:'#d6d1c8'}).toBuffer();samples.push({input:frame,left:i*180,top:0});}
   await sharp({create:{width:900,height:270,channels:3,background:'#d6d1c8'}}).composite(samples).jpeg({quality:90}).toFile(path.join(OUT,`${style}-${speaker}-${motion}-contact.jpg`));
  }
 }

}
await fs.writeFile(path.join(DEST,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({backgrounds:Object.values(manifest.styles).reduce((n,p)=>n+Object.values(p.backgrounds).flat().length,0),clips:Object.values(manifest.styles).reduce((n,p)=>n+Object.values(p.cast).reduce((a,c)=>a+Object.keys(c).length,0),0)}));
