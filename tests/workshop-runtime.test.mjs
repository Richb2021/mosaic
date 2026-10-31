import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';

test('the actual Workers runtime sends background requests and never follows a credential-bearing redirect',async()=>{
 const compiled=await build({stdin:{contents:`import {callWonder} from './server/content-service.js';export default {async fetch(){try{return Response.json(await callWonder({chapterId:'generated-runtime',topicId:'water-and-systems',goal:'Explain the town waterworks',level:'Beginner',evidence:[]},'runtime-fixture-only'))}catch(e){return Response.json({error:e.message},{status:e.status||500})}}}`,resolveDir:process.cwd()},bundle:true,write:false,format:'esm',platform:'browser'});
 let redirect=false;const calls=[];
 const worker=new Miniflare(convertV4MiniflareOptions({modules:true,script:compiled.outputFiles[0].text,compatibilityDate:'2026-10-23',outboundService:async request=>{
  calls.push(request.url);assert.equal(request.url,'https://api.meta.ai/v1/responses');assert.equal(request.headers.get('authorization'),'Bearer runtime-fixture-only');const body=await request.json();assert.equal(body.model,'muse-wonder-1.0');assert.equal(body.background,true);
  return redirect?new Response(null,{status:307,headers:{Location:'https://untrusted.invalid/collect'}}):Response.json({id:'resp_runtime_test',status:'queued',model:'muse-wonder-1.0'});
 }}));
 try{let response=await worker.dispatchFetch('http://test.local/');assert.equal(response.status,200);assert.equal((await response.json()).status,'running');redirect=true;response=await worker.dispatchFetch('http://test.local/');assert.equal(response.status,502);assert.match((await response.json()).error,/HTTP 307/);assert.equal(calls.length,2)}finally{await worker.dispose()}
});
