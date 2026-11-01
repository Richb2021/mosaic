import {build} from 'esbuild';
import {copyFile,cp,mkdir} from 'node:fs/promises';
await copyFile('index.html','public/index.html');
await build({entryPoints:['src/main.js'],bundle:true,external:['/fonts/*','/extraction/*'],minify:true,sourcemap:true,outfile:'public/game.js',target:'es2022'});
await build({entryPoints:['src/game-modes/main.js'],bundle:true,external:['/fonts/*','/extraction/*'],minify:true,sourcemap:true,outfile:'public/modes.js',target:'es2022'});
await build({entryPoints:['src/account.jsx'],bundle:true,format:'esm',external:['/fonts/*','/game-modes/*'],minify:true,sourcemap:true,outfile:'public/account.js',target:'es2022'});
await build({entryPoints:['src/studio/main.jsx'],bundle:true,format:'esm',external:['/fonts/*','/extraction/*'],minify:true,sourcemap:true,outfile:'public/studio.js',target:'es2022'});
console.log('Lanternbound and learning games built.');

await mkdir('public/extraction',{recursive:true});
await build({entryPoints:['src/pdf-reader.js'],bundle:true,format:'esm',minify:true,outfile:'public/extraction/pdf-reader.js',target:'es2022'});
await copyFile('node_modules/pdfjs-dist/build/pdf.worker.mjs','public/extraction/pdf.worker.mjs');
for(const dir of ['standard_fonts','cmaps'])await cp('node_modules/pdfjs-dist/'+dir,'public/extraction/'+dir,{recursive:true});
await copyFile('node_modules/pdfjs-dist/LICENSE','public/extraction/PDFJS-LICENSE.txt');
