// Explicit loopback-only browser test harness. Never imported by the application
// or production Worker. It makes no model/API calls.
import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {readFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {build} from 'esbuild';
import {workshopAPI} from '../server/workshop-api.js';
const root=process.cwd(),out=path.resolve('../output/rpg/dynamic-fixture-preview');await mkdir(out,{recursive:true});
await build({entryPoints:['src/main.js'],bundle:true,external:['/fonts/*'],minify:true,sourcemap:true,outfile:path.join(out,'game.js'),target:'es2022'});
const sqlite=new DatabaseSync(':memory:');for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')))sqlite.exec(readFileSync('drizzle/'+file,'utf8'));
const DB={prepare(sql){return {bind(...v){return {
 async first(){return sqlite.prepare(sql).get(...v)||null},
 async all(){return {results:sqlite.prepare(sql).all(...v)}},
 async run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...v).changes)}}}
}}}}};
const template=JSON.parse(readFileSync('public/chapters/water-and-systems.json'));const requests=new Map();let starts=0,reads=0;
const provider=async job=>{starts++;const id='resp_fixture_'+starts;requests.set(id,{job,reads:0});return {status:'running',providerId:id}};
const reader=async id=>{reads++;const item=requests.get(id);if(!item||++item.reads<2)return {status:'running',providerId:id};const c=structuredClone(template);c.id=item.job.chapterId;c.topicId=item.job.topicId;c.revision=1;c.title='Acceptance fixture · The copper current';c.hook='Nessa needs the water changes traced before the town can share its supply. This chapter is an explicit browser-test fixture, not model output.';c.sources=item.job.evidence;for(const q of Object.values(c.challenges))q.sourceRefs=c.sources.map(s=>s.id);return {status:'review',providerId:id,content:c}};
http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://127.0.0.1:8880');
 if(url.pathname.startsWith('/api/workshop/')){let bytes=[];for await(const part of req)bytes.push(part);const headers=new Headers(req.headers);headers.set('oai-authenticated-user-id','browser-acceptance-fixture');const request=new Request(url,{method:req.method,headers,...(req.method==='POST'?{body:Buffer.concat(bytes)}:{})});const response=await workshopAPI(request,{DB,META_API_KEY:'explicit-test-fixture'},{provider,reader});res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));await writeFile(path.join(out,'provider-counts.json'),JSON.stringify({starts,reads,mode:'explicit-test-fixture',real_model_calls:0}));return}
 let file=url.pathname==='/'?path.join(root,'index.html'):path.resolve(url.pathname.startsWith('/game.')?out:path.join(root,'public'),'.'+decodeURIComponent(url.pathname));if(!file.startsWith(root+path.sep)&&!file.startsWith(out+path.sep))throw Error('Invalid path');
 const data=await readFile(file),ext=path.extname(file);res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.svg':'image/svg+xml'}[ext]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
 }catch(e){res.writeHead(500);res.end('Fixture preview error: '+e.message)}}).listen(8880,'127.0.0.1',()=>console.log('Explicit fixture preview: http://127.0.0.1:8880 · no live model calls'));
