import test from 'node:test';
import assert from 'node:assert/strict';
import {routeMetaThroughRelay} from '../server/node/meta-relay.mjs';
import {metaRequest} from '../server/content-service.js';

const RELAY='https://relay.example.test/mosaic/meta-relay.php',SECRET='s'.repeat(40);
function recorder(){const calls=[];const base=async(url,init={})=>{calls.push({url:String(url),init});return new Response(JSON.stringify({ok:true}),{status:200,headers:{'Content-Type':'application/json'}})};return {calls,base}}

test('only api.meta.ai calls go through the relay, with the method, path, credential and body', async () => {
 const {calls,base}=recorder(),f=routeMetaThroughRelay({url:RELAY,secret:SECRET},base);
 await f('https://eu-api.nocodebackend.com/read/learner_profiles',{method:'GET'});
 assert.equal(calls[0].url,'https://eu-api.nocodebackend.com/read/learner_profiles','other services are untouched');
 await f('https://api.meta.ai/v1/responses',{method:'POST',headers:{Authorization:'Bearer abc',ContentType:'application/json'},body:'{"model":"muse-wonder-1.0"}'});
 const sent=calls[1];assert.equal(sent.url,RELAY);assert.equal(sent.init.method,'POST');assert.equal(sent.init.headers['X-Mosaic-Relay'],SECRET);assert.equal(sent.init.redirect,'manual');
 assert.deepEqual(JSON.parse(sent.init.body),{method:'POST',path:'/v1/responses',authorization:'Bearer abc',body:'{"model":"muse-wonder-1.0"}'});
 await f('https://api.meta.ai/v1/responses/resp_123',{method:'DELETE',headers:{Authorization:'Bearer abc'}});
 assert.deepEqual(JSON.parse(calls[2].init.body),{method:'DELETE',path:'/v1/responses/resp_123',authorization:'Bearer abc'});
});

test('without relay settings nothing changes, and weak settings are refused', () => {
 const base=async()=>{};assert.equal(routeMetaThroughRelay({},base),base);
 assert.throws(()=>routeMetaThroughRelay({url:RELAY,secret:'short'},base));
 assert.throws(()=>routeMetaThroughRelay({url:'http://insecure.test/r.php',secret:SECRET},base));
});

test('Mosaic’s own Meta request reaches the relay and reads its response as before', async () => {
 let seen;const base=async(url,init)=>{seen=JSON.parse(init.body);return new Response(JSON.stringify({id:'resp_1',status:'queued'}),{status:200,headers:{'Content-Type':'application/json'}})};
 const data=await metaRequest('','key-123',{method:'POST',body:'{}'},routeMetaThroughRelay({url:RELAY,secret:SECRET},base));
 assert.equal(data.id,'resp_1');assert.equal(seen.path,'/v1/responses');assert.equal(seen.authorization,'Bearer key-123');
});
