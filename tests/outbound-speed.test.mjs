import test from 'node:test';
import assert from 'node:assert/strict';
import {cachedLookup} from '../server/node/dns-cache.mjs';
import {sessionCache,ncbSession} from '../server/ncb-auth.js';

const call=(lookup,host,options)=>new Promise((ok,fail)=>lookup(host,options,(e,a,f)=>e?fail(e):ok(options?.all?a:{address:a,family:f})));
function fakeDns(){
 const calls=[];let answer=[{address:'192.0.2.1',family:4}],error=null,hold=null;
 const lookup=(host,opts,cb)=>{calls.push({host,opts});const go=()=>error?cb(error):cb(null,answer);hold?hold.push(go):process.nextTick(go);};
 return {lookup,calls,set:v=>{answer=v},fail:e=>{error=e},pause:()=>{hold=[]},release:()=>{const h=hold;hold=null;h.forEach(f=>f())}};
}

test('name lookups are reused while fresh and both answer styles work', async()=>{
 let t=0;const d=fakeDns(),lookup=cachedLookup({lookup:d.lookup,now:()=>t});
 assert.deepEqual(await call(lookup,'eu-api.example.com',{}),{address:'192.0.2.1',family:4});
 assert.deepEqual(await call(lookup,'eu-api.example.com',{all:true}),[{address:'192.0.2.1',family:4}]);
 t=119000;await call(lookup,'eu-api.example.com',{});
 assert.equal(d.calls.length,1);
});

test('a stale answer is served at once while a slow refresh runs, and kept if the refresh fails', async()=>{
 let t=0;const d=fakeDns(),lookup=cachedLookup({lookup:d.lookup,now:()=>t});
 await call(lookup,'api.example.com',{});
 t=200000;d.pause();
 assert.deepEqual(await call(lookup,'api.example.com',{}),{address:'192.0.2.1',family:4});
 assert.equal(d.calls.length,2,'refresh started in the background');
 await call(lookup,'api.example.com',{});assert.equal(d.calls.length,2,'one refresh at a time');
 d.fail(Object.assign(Error('timeout'),{code:'ETIMEOUT'}));d.release();
 assert.deepEqual(await call(lookup,'api.example.com',{}),{address:'192.0.2.1',family:4});
});

test('new answers replace old ones, misses wait, and failures with nothing cached are reported', async()=>{
 let t=0;const d=fakeDns(),lookup=cachedLookup({lookup:d.lookup,now:()=>t});
 await call(lookup,'a.example.com',{});d.set([{address:'192.0.2.9',family:4}]);
 t=200000;await call(lookup,'a.example.com',{});await new Promise(r=>setImmediate(r));
 assert.equal((await call(lookup,'a.example.com',{})).address,'192.0.2.9');
 d.fail(Object.assign(Error('nope'),{code:'ENOTFOUND'}));
 await assert.rejects(call(lookup,'b.example.com',{}),/nope/);
 t=10*3600000;await assert.rejects(call(lookup,'a.example.com',{}),/nope/,'very old answers are not used');
});

test('IP addresses and localhost go straight to the system resolver', async()=>{
 const d=fakeDns(),lookup=cachedLookup({lookup:d.lookup});
 await call(lookup,'127.0.0.1',{all:true});await call(lookup,'localhost',{all:true});await call(lookup,'127.0.0.1',{all:true});
 assert.equal(d.calls.length,3);
});

const request=cookie=>new Request('https://mosaic.example/api/learning/journal',{headers:cookie?{cookie}:{}});
const env={NCB_INSTANCE:'inst',NCB_SECRET_KEY:'k'};
test('a confirmed sign-in is reused for 20 s per cookie and shared by requests that arrive together', async()=>{
 let t=0,checks=0;const cache=sessionCache({now:()=>t});
 const check=()=>{checks++;return new Promise(r=>setTimeout(()=>r({id:'u1',name:'Ada'}),5));};
 const [a,b]=await Promise.all([cache.get(request('better-auth.session_token=one'),env,check),cache.get(request('better-auth.session_token=one'),env,check)]);
 assert.equal(checks,1);assert.deepEqual(a,b);assert.notEqual(a,b,'each caller gets its own copy');
 a.name='changed';assert.equal((await cache.get(request('better-auth.session_token=one'),env,check)).name,'Ada');
 await cache.get(request('better-auth.session_token=two'),env,check);assert.equal(checks,2,'a different cookie is checked separately');
 t=20001;await cache.get(request('better-auth.session_token=one'),env,check);assert.equal(checks,3,'checked again after 20 s');
 await cache.forget(request('better-auth.session_token=one'),env);await cache.get(request('better-auth.session_token=one'),env,check);assert.equal(checks,4,'forget clears it');
});

test('signed-out answers and failures are never kept', async()=>{
 let checks=0;const cache=sessionCache(),r=request('better-auth.session_token=x');
 await cache.get(r,env,async()=>{checks++;return null;});await cache.get(r,env,async()=>{checks++;return null;});
 await assert.rejects(cache.get(r,env,async()=>{checks++;throw Error('down');}),/down/);
 assert.equal(await cache.get(r,env,async()=>{checks++;return {id:'u'};}).then(u=>u.id),'u');
 assert.equal(checks,4);assert.equal(cache.size,1);
});

test('ncbSession with an injected fetcher always asks the account service', async()=>{
 let calls=0;const fetcher=async()=>{calls++;return Response.json({user:{id:'u1',name:'A',email:'a@example.com'}});};
 const r=request('better-auth.session_token=abc');
 await ncbSession(r,env,fetcher);await ncbSession(r,env,fetcher);
 assert.equal(calls,2);assert.equal(await ncbSession(request(''),env,fetcher),null);
});

test('with the real fetch, sessions are cached and a sign-out clears them', async()=>{
 const {authAPI}=await import('../server/ncb-auth.js');
 const original=globalThis.fetch;let sessionCalls=0;
 globalThis.fetch=async url=>{if(String(url).includes('/get-session')){sessionCalls++;return Response.json({user:{id:'u9',name:'B',email:'b@example.com'}});}return Response.json({success:true});};
 try{
  const cookie='better-auth.session_token=signout-test';
  await ncbSession(request(cookie),env);await ncbSession(request(cookie),env);
  assert.equal(sessionCalls,1);
  const out=new Request('https://mosaic.example/api/auth/sign-out',{method:'POST',headers:{cookie,origin:'https://mosaic.example','content-type':'application/json'},body:'{}'});
  assert.equal((await authAPI(out,env)).status,200);
  await ncbSession(request(cookie),env);assert.equal(sessionCalls,2);
 }finally{globalThis.fetch=original;}
});

test('the page identity check fills the session cache so the next API call skips a second check', async()=>{
 const {authAPI}=await import('../server/ncb-auth.js');
 const original=globalThis.fetch;let sessionCalls=0;
 globalThis.fetch=async()=>{sessionCalls++;return Response.json({user:{id:'u7',name:'C',email:'c@example.com',emailVerified:true}});};
 try{
  const cookie='better-auth.session_token=prime-test';
  const res=await authAPI(new Request('https://mosaic.example/api/auth/get-session',{headers:{cookie}}),env);
  assert.deepEqual(await res.json(),{user:{id:'u7',name:'C',email:'c@example.com'}});
  assert.deepEqual(await ncbSession(request(cookie),env),{id:'u7',name:'C',email:'c@example.com',emailVerified:true});
  assert.equal(sessionCalls,1);
 }finally{globalThis.fetch=original;}
});
