import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {request as httpRequest} from 'node:http';
import {createApp} from '../server/node/app.mjs';
import {createHTTPServer} from '../server/node/http.mjs';

test('portable app keeps private routes protected and static paths contained',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'mosaic-http-')),outside=dir+'-private';
 try {
  await writeFile(join(dir,'index.html'),'<h1>Mosaic</h1>');await writeFile(join(dir,'audio.mp3'),'abcdef');await writeFile(outside,'private');await symlink(outside,join(dir,'escape'));
  const app=createApp({MAINTENANCE_SECRET:'x'.repeat(40),RETENTION_BACKGROUND_ENABLED:'true',DB:{}},{staticDirectory:dir});
  for(const path of ['/api/pilot','/api/learning/journal','/api/learning/voice-tutor','/api/workshop/library'])assert.equal((await app(new Request('https://mosaic.example'+path))).status,401,path);
  for(const path of ['/api/maintenance','/api/operations'])assert.equal((await app(new Request('https://mosaic.example'+path))).status,403,path);
  assert.equal((await app(new Request('https://mosaic.example/api/auth/sign-in/email',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:'{}'}))).status,503);
  assert.equal((await app(new Request('https://mosaic.example/api/pilot',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:'{}'}))).status,403);
  for(const path of ['/escape','/.env','/%5cprivate','/server/ncb-auth.js'])assert.equal((await app(new Request('https://mosaic.example'+path))).status,404,path);
  const range=await app(new Request('https://mosaic.example/audio.mp3',{headers:{Range:'bytes=1-3'}}));assert.equal(range.status,206);assert.equal(await range.text(),'bcd');
  assert.equal((await app(new Request('https://mosaic.example/audio.mp3',{headers:{Range:'bytes=20-30'}}))).status,416);
  assert.equal(await (await app(new Request('https://mosaic.example/'))).text(),'<h1>Mosaic</h1>');
 } finally {await rm(dir,{recursive:true,force:true});await rm(outside,{force:true});}
});

test('HTTP bridge pins origin, verifies gateway, preserves cookies and limits bodies',async()=>{
 const gatewayKey='g'.repeat(40),origin='https://mosaic.example';
 const server=createHTTPServer(async req=>{assert.equal(new URL(req.url).origin,origin);assert.equal(req.headers.get('x-mosaic-gateway'),null);const headers=new Headers();headers.append('Set-Cookie','one=1; HttpOnly; Secure');headers.append('Set-Cookie','two=2; HttpOnly; Secure');headers.set('X-Test-Cookie',req.headers.get('cookie')||'');return new Response(await req.text()||'ok',{headers});},{origin,gatewayKey,upstreamHost:'backend.internal',maxBodyBytes:8});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+server.address().port;
 const send=(options={})=>new Promise((resolve,reject)=>{const req=httpRequest(url+(options.path||''),{method:options.method||'GET',headers:options.headers},res=>{let body='';res.on('data',chunk=>body+=chunk);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body}));});req.on('error',reject);req.end(options.body);});
 try {
  assert.equal((await send()).status,421);
  assert.equal((await send({headers:{Host:'mosaic.example'}})).status,403);
  const headers={Host:'mosaic.example','X-Mosaic-Gateway':gatewayKey};
  const response=await send({headers});assert.equal(response.status,200);assert.equal(response.headers['set-cookie'].length,2);assert.equal(response.body,'ok');
  assert.equal((await send({method:'POST',headers,body:'123456789'})).status,413);
  assert.equal((await send({method:'POST',headers,body:'hello'})).body,'hello');
  assert.equal((await send({headers:{...headers,Host:'backend.internal'}})).status,200);
  assert.equal((await send({headers:{...headers,Cookie:['one=1','two=2']}})).headers['x-test-cookie'],'one=1; two=2');
  assert.equal((await send({method:'HEAD',headers})).body,'');
  assert.equal((await send({headers:{...headers,'Content-Length':'1'},body:'x'})).status,400);
  assert.equal((await send({method:'POST',path:'/api/media-worker',headers,body:'123456789'})).status,200);
  assert.equal((await send({method:'POST',path:'/api/media-worker',headers:{...headers,'Content-Length':String(64*1024*1024+1)}})).status,413);
 } finally {await new Promise(resolve=>server.close(resolve));}
});
