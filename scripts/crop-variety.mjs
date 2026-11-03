import fs from 'node:fs/promises';import path from 'node:path';import sharp from 'sharp';
const root=path.resolve('../output/asset-variety'),items=JSON.parse(await fs.readFile(path.join(root,'prompts.json'),'utf8'));await fs.mkdir(path.join(root,'crops'),{recursive:true});let count=0;
for(const item of items.filter(i=>i.alpha)){
 const file=path.join(root,'raw',item.key,'gpt-image-2.5-sunburst-1.png');try{await fs.access(path.join(root,'raw',item.key,'result.json'));await sharp(file).raw().toBuffer()}catch{continue}const m=await sharp(file).metadata();
 for(const [i,name] of item.names.entries()){const out=path.join(root,'crops',item.key+'-'+name+'.png');count++;try{await fs.access(out);continue}catch{}
 const x=Math.round(i%item.columns*m.width/item.columns),y=Math.round(Math.floor(i/item.columns)*m.height/item.rows),r=Math.round((i%item.columns+1)*m.width/item.columns),b=Math.round((Math.floor(i/item.columns)+1)*m.height/item.rows);
 await sharp(file).extract({left:x,top:y,width:r-x,height:b-y}).png().toFile(out+'.tmp');await fs.rename(out+'.tmp',out);
 }}console.log(count);
