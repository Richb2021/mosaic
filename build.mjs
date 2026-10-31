import {build} from 'esbuild';
import {cp,mkdir,rm} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});await mkdir('dist',{recursive:true});
await cp('public','dist',{recursive:true});await cp('index.html','dist/index.html');
await build({entryPoints:['src/main.js'],bundle:true,external:['/fonts/*'],minify:true,sourcemap:true,outfile:'dist/game.js',target:'es2022'});
console.log('Lanternbound built.');
