import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {keepAliveFetch} from '../server/node/keepalive-fetch.mjs';

async function server(handler){
 const sockets=new Set(),s=http.createServer(handler);s.keepAliveTimeout=30000;
 s.on('connection',c=>{sockets.add(c);c.on('close',()=>sockets.delete(c));});
 await new Promise(r=>s.listen(0,'127.0.0.1',r));
 return {url:`http://127.0.0.1:${s.address().port}`,sockets,close:()=>new Promise(r=>{for(const c of sockets)c.destroy();s.close(r);})};
}
const make=(extra={})=>{const agent=new http.Agent({keepAlive:true,maxSockets:4});return keepAliveFetch({protocol:'http:',hosts:new Set(['127.0.0.1']),request:http.request,agent,base:async()=>new Response('base'),...extra});};

test('reuses one connection across requests, and passes status, headers and set-cookies through', async()=>{
 let connections=0;const s=await server((req,res)=>{res.setHeader('Set-Cookie',['a=1; Path=/','b=2; Path=/']);res.setHeader('Retry-After','3');res.statusCode=req.url.includes('missing')?404:200;res.end(JSON.stringify({path:req.url,auth:req.headers.authorization,enc:req.headers['accept-encoding']||null}));});
 const f=make();
 try{
  s.sockets.clear();
  for(let i=0;i<3;i++){const r=await f(s.url+'/x?i='+i,{headers:{Authorization:'Bearer t','Accept-Encoding':'gzip'}});assert.equal(r.status,200);const d=await r.json();assert.equal(d.auth,'Bearer t');assert.equal(d.enc,null);assert.deepEqual(r.headers.getSetCookie(),['a=1; Path=/','b=2; Path=/']);assert.equal(r.headers.get('retry-after'),'3');}
  assert.equal(s.sockets.size,1,'one kept connection');
  assert.equal((await f(s.url+'/missing')).status,404);
 }finally{f.agent.destroy();await s.close();}
});

test('sends POST and DELETE bodies, and returns empty bodies for 204', async()=>{
 const s=await server((req,res)=>{let b='';req.on('data',c=>b+=c);req.on('end',()=>{if(req.method==='DELETE'){res.statusCode=204;return res.end();}res.setHeader('content-type','application/json');res.end(JSON.stringify({method:req.method,body:b,len:req.headers['content-length']}));});});
 const f=make();
 try{
  const d=await (await f(new URL(s.url+'/w'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({x:'é'})})).json();
  assert.deepEqual(d,{method:'POST',body:'{"x":"é"}',len:String(Buffer.byteLength('{"x":"é"}'))});
  const del=await f(s.url+'/d',{method:'DELETE'});assert.equal(del.status,204);assert.equal(await del.text(),'');
 }finally{f.agent.destroy();await s.close();}
});

test('honours timeouts and leaves other hosts, Request objects and streamed bodies to the normal fetch', async()=>{
 const s=await server((req,res)=>setTimeout(()=>res.end('late'),500));
 const f=make();
 try{
  await assert.rejects(f(s.url+'/slow',{signal:AbortSignal.timeout(50)}),e=>e.name==='TimeoutError');
  assert.equal(await (await f('https://example.com/')).text(),'base');
  assert.equal(await (await f(new Request(s.url+'/r'))).text(),'base');
  assert.equal(await (await f(s.url+'/s',{method:'POST',body:new ReadableStream({start(c){c.close();}}),duplex:'half'})).text(),'base');
 }finally{f.agent.destroy();await s.close();}
});

test('retries once on a fresh connection when the kept one was closed by the server', async()=>{
 let n=0;const s=await server((req,res)=>{n++;res.end('ok'+n);});
 const f=make();
 try{
  assert.equal(await (await f(s.url+'/1')).text(),'ok1');
  for(const c of s.sockets)c.destroy();await new Promise(r=>setTimeout(r,20));
  assert.equal(await (await f(s.url+'/2')).text(),'ok2');
 }finally{f.agent.destroy();await s.close();}
});

test('hands GET redirects to the normal fetch but returns them as-is when redirect is manual', async()=>{
 const s=await server((req,res)=>{res.statusCode=302;res.setHeader('Location','/elsewhere');res.end();});
 const f=make();
 try{
  assert.equal(await (await f(s.url+'/r')).text(),'base');
  const m=await f(s.url+'/r',{redirect:'manual'});assert.equal(m.status,302);assert.equal(m.headers.get('location'),'/elsewhere');
 }finally{f.agent.destroy();await s.close();}
});
