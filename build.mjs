import {build} from 'esbuild';
import {copyFile,cp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
await copyFile('index.html','public/rpg.html');
await copyFile('public/studio.html','public/index.html');
await build({entryPoints:['src/main.js'],bundle:true,external:['/fonts/*','/brand/*','/extraction/*'],minify:true,sourcemap:true,outfile:'public/game.js',target:'es2022'});
await build({entryPoints:['src/game-modes/main.js'],bundle:true,external:['/fonts/*','/brand/*','/extraction/*'],minify:true,sourcemap:true,outfile:'public/modes.js',target:'es2022'});
await build({entryPoints:['src/account.jsx'],bundle:true,format:'esm',external:['/fonts/*','/brand/*','/game-modes/*'],minify:true,sourcemap:true,outfile:'public/account.js',target:'es2022'});
await build({entryPoints:['src/studio/main.jsx'],bundle:true,format:'esm',external:['/fonts/*','/brand/*','/extraction/*'],minify:true,sourcemap:true,outfile:'public/studio.js',target:'es2022'});
await build({entryPoints:['src/welcome.jsx'],bundle:true,format:'esm',external:['/fonts/*','/brand/*'],minify:true,sourcemap:true,outfile:'public/welcome.js',target:'es2022'});
await build({entryPoints:['src/cartoon-showcase.jsx'],bundle:true,format:'esm',external:['/fonts/*','/brand/*'],minify:true,sourcemap:true,outfile:'public/cartoon-showcase.js',target:'es2022'});
console.log('Lanternbound and learning games built.');

await mkdir('public/extraction',{recursive:true});
await build({entryPoints:['src/pdf-reader.js'],bundle:true,format:'esm',minify:true,outfile:'public/extraction/pdf-reader.js',target:'es2022'});
await copyFile('node_modules/pdfjs-dist/build/pdf.worker.mjs','public/extraction/pdf.worker.mjs');
for(const dir of ['standard_fonts','cmaps'])await cp('node_modules/pdfjs-dist/'+dir,'public/extraction/'+dir,{recursive:true});
await copyFile('node_modules/pdfjs-dist/LICENSE','public/extraction/PDFJS-LICENSE.txt');
await mkdir('public/extraction/ocr',{recursive:true});
await build({entryPoints:['src/ocr-reader.js'],bundle:true,format:'esm',minify:true,outfile:'public/extraction/ocr-reader.js',target:'es2022'});
await build({entryPoints:['src/ocr-worker.js'],bundle:true,format:'esm',minify:true,outfile:'public/extraction/ocr-reader-worker.js',target:'es2022'});
await copyFile('node_modules/tesseract.js/dist/worker.min.js','public/extraction/ocr/worker.min.js');
for(const name of ['tesseract-core-lstm.wasm.js','tesseract-core-simd-lstm.wasm.js','tesseract-core-relaxedsimd-lstm.wasm.js'])await copyFile('node_modules/tesseract.js-core/'+name,'public/extraction/ocr/'+name);
await copyFile('node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz','public/extraction/ocr/eng.traineddata.gz');
await copyFile('node_modules/tesseract.js/LICENSE.md','public/extraction/ocr/TESSERACT-LICENSE.txt');
await copyFile('node_modules/tesseract.js-core/LICENSE','public/extraction/ocr/CORE-LICENSE.txt');

// Entry HTML is revalidated, but CDN/browser caches may retain same-name JS.
// Tie entry bundles to their actual bytes so a release cannot mix navigation
// from an older build with the new homepage. Content assets keep their caching.
for(const page of ['index','rpg','modes','studio','account','welcome','cartoons']){
 const path=`public/${page}.html`;let html=await readFile(path,'utf8');
 const matches=[...html.matchAll(/(?:src|href)="\/(\w[\w-]*\.(?:js|css))(?:\?v=[a-f0-9]+)?"/g)];
 for(const match of matches){
  const hash=createHash('sha256').update(await readFile('public/'+match[1])).digest('hex').slice(0,16);
  html=html.replace(match[0],match[0].replace(/\/(\w[\w-]*\.(?:js|css))(?:\?v=[a-f0-9]+)?/,`/${match[1]}?v=${hash}`));
 }
 await writeFile(path,html);
}
