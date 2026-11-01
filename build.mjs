import {build} from 'esbuild';
import {copyFile} from 'node:fs/promises';
await copyFile('index.html','public/index.html');
await build({entryPoints:['src/main.js'],bundle:true,external:['/fonts/*'],minify:true,sourcemap:true,outfile:'public/game.js',target:'es2022'});
await build({entryPoints:['src/game-modes/main.js'],bundle:true,external:['/fonts/*'],minify:true,sourcemap:true,outfile:'public/modes.js',target:'es2022'});
await build({entryPoints:['src/account.jsx'],bundle:true,format:'esm',external:['/fonts/*','/game-modes/*'],minify:true,sourcemap:true,outfile:'public/account.js',target:'es2022'});
console.log('Lanternbound and learning games built.');
