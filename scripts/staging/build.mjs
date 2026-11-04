// Builds portable-staging/: the staging server bundle plus the same public assets and migrations as the live build.
import {build} from 'esbuild';
import {mkdir,cp,rm,writeFile} from 'node:fs/promises';
const out='portable-staging';await mkdir(out,{recursive:true});
await build({entryPoints:['scripts/staging/start.mjs'],outfile:out+'/server.mjs',bundle:true,platform:'node',format:'esm',target:'node22',external:['node:*'],banner:{js:"import {createRequire} from 'node:module'; const require=createRequire(import.meta.url);"}});
await rm(out+'/public',{recursive:true,force:true});await cp('public',out+'/public',{recursive:true});
await rm(out+'/drizzle',{recursive:true,force:true});await cp('drizzle',out+'/drizzle',{recursive:true});
await writeFile(out+'/package.json',JSON.stringify({name:'mosaic-staging',private:true,type:'module',scripts:{start:'node server.mjs'}},null,2)+'\n');
console.log('Staging build ready in portable-staging/. Needs STAGING_KEY and MOSAIC_PUBLIC_ORIGIN at runtime.');
