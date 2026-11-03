import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';import sharp from 'sharp';
const ROOT=path.resolve('..'),OUT=path.join(ROOT,'output/asset-variety'),DEST=path.resolve('public/game-modes/variety-art');
const prompts=JSON.parse(await fs.readFile(path.join(OUT,'prompts.json'),'utf8')),manifest={version:1,provider:'Sorceress',model:'gpt-image-2.5-sunburst',themes:{}};
const overrides=JSON.parse(await fs.readFile(path.join(OUT,'overrides.json'),'utf8'));
const exists=async p=>fs.access(p).then(()=>true,()=>false);const contact=[];
// Retain the central object; generated grids can leave a disconnected sliver
// from the neighbouring cell. Crop from the actual alpha, not a colour key.
async function mainSilhouette(buffer){
 const {data,info}=await sharp(buffer).ensureAlpha().raw().toBuffer({resolveWithObject:true}),w=info.width,h=info.height,seen=new Uint8Array(w*h);let best=[];
 for(let i=0;i<w*h;i++){if(seen[i]||data[i*4+3]<64)continue;const q=[i];seen[i]=1;for(let n=0;n<q.length;n++){const a=q[n],x=a%w,y=Math.floor(a/w);for(const j of [x>0?a-1:-1,x<w-1?a+1:-1,y>0?a-w:-1,y<h-1?a+w:-1])if(j>=0&&!seen[j]&&data[j*4+3]>=64){seen[j]=1;q.push(j)}}if(q.length>best.length)best=q;}
 if(!best.length)throw Error('Empty keyed sprite');let l=w,t=h,r=0,b=0;for(const a of best){l=Math.min(l,a%w);r=Math.max(r,a%w);t=Math.min(t,Math.floor(a/w));b=Math.max(b,Math.floor(a/w));}l=Math.max(0,l-3);t=Math.max(0,t-3);r=Math.min(w-1,r+3);b=Math.min(h-1,b+3);return sharp(buffer).extract({left:l,top:t,width:r-l+1,height:b-t+1}).png().toBuffer();
}
for(const item of prompts){
 const folder=path.join(OUT,'raw',overrides[item.key]||item.key);if(!await exists(path.join(folder,'result.json')))continue;
 const result=JSON.parse(await fs.readFile(path.join(folder,'result.json'),'utf8')),source=result;
 const downloaded=result.downloaded.map(p=>path.basename(p));const file=path.join(folder,downloaded.find(p=>/\.png$/.test(p))||downloaded[0]);if(!await exists(file))continue;
 const meta=await sharp(file).metadata(),theme=manifest.themes[item.theme]??={scenes:{},town:{},props:{},craft:{},cards:{}};await fs.mkdir(path.join(DEST,item.theme),{recursive:true});
 for(const [i,name] of item.names.entries()){
  const x=Math.round(i%item.columns*meta.width/item.columns),y=Math.round(Math.floor(i/item.columns)*meta.height/item.rows),right=Math.round((i%item.columns+1)*meta.width/item.columns),bottom=Math.round((Math.floor(i/item.columns)+1)*meta.height/item.rows);
  let tile=sharp(file).extract({left:x,top:y,width:right-x,height:item.key==='copperfield-cards'?Math.floor((bottom-y)*.88):bottom-y}),buffer,keyResult;
  if(item.alpha){const tileDir=path.join(OUT,'raw','tiles',item.key+'-'+name);if(!await exists(path.join(tileDir,'result.json')))continue;keyResult=JSON.parse(await fs.readFile(path.join(tileDir,'result.json'),'utf8'));tile=sharp(path.join(tileDir,path.basename(keyResult.downloaded[0])));}
  if(item.alpha){
   const cell=await tile.png().toBuffer();const trimmed=await mainSilhouette(cell);const resized=await sharp(trimmed).resize({width:440,height:440,fit:'inside'}).png().toBuffer();const size=await sharp(resized).metadata();buffer=await sharp({create:{width:512,height:512,channels:4,background:'#00000000'}}).composite([{input:resized,left:Math.round((512-size.width)/2),top:Math.round(512*.94)-size.height}]).webp({quality:90}).toBuffer();
  }else if(item.group==='scenes')buffer=await tile.resize({width:1600,height:900,fit:'cover'}).webp({quality:84}).toBuffer();
  else buffer=await tile.resize(480,480,{fit:'cover'}).webp({quality:84}).toBuffer();
  const filename=item.group+'-'+name+'.webp',dest=path.join(DEST,item.theme,filename);await fs.writeFile(dest,buffer);const size=await sharp(buffer).metadata();
  const entry={url:'/game-modes/variety-art/'+item.theme+'/'+filename,width:size.width,height:size.height,bytes:buffer.length,sha256:crypto.createHash('sha256').update(buffer).digest('hex'),sourceJobId:source.jobId,...(item.alpha?{alpha:true,keyJobId:keyResult.jobId,anchor:[.5,.94]}:{})};theme[item.group][name]=entry;contact.push({theme:item.theme,label:item.group+'/'+name,buffer});
 }
}
await fs.mkdir(DEST,{recursive:true});await fs.writeFile(path.join(DEST,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
for(const id of Object.keys(manifest.themes)){
 const items=contact.filter(x=>x.theme===id),cols=5,w=260,h=190,layers=[];
 for(const [i,item] of items.entries()){const thumb=await sharp(item.buffer).resize(w-12,h-28,{fit:'contain',background:'#d7d2c3'}).png().toBuffer();layers.push({input:thumb,left:i%cols*w+6,top:Math.floor(i/cols)*h});layers.push({input:Buffer.from(`<svg width="260" height="24"><text x="8" y="17" font-family="sans-serif" font-size="13" fill="#142b34">${item.label}</text></svg>`),left:i%cols*w,top:Math.floor(i/cols)*h+h-25});}
 await sharp({create:{width:cols*w,height:Math.ceil(items.length/cols)*h,channels:3,background:'#d7d2c3'}}).composite(layers).jpeg({quality:90}).toFile(path.join(OUT,id+'-contact.jpg'));
}
console.log(JSON.stringify({assets:contact.length,bytes:contact.reduce((n,x)=>n+x.buffer.length,0),themes:Object.keys(manifest.themes)}));
