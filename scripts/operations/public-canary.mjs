// Real, bounded NCB session on the public domain. No provider generation.
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const origin='https://mosaic.richardbatt.com',out=process.argv[2];assert(out);
const account=JSON.parse(await readFile('.sites-runtime/pilot-admin.json','utf8')),cookies=new Map();let user,epoch;
const report={at:new Date().toISOString(),origin,checks:[],pass:false};
async function request(path,body,{anonymous=false,binary=false,extra={}}={}){
 const start=performance.now(),r=await fetch(origin+path,{method:body?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(60000),headers:{Origin:origin,'Content-Type':'application/json',...(epoch?{'X-Mosaic-Data-Epoch':epoch}:{}),...(!anonymous?{Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; '),...(user?{'X-Mosaic-Learner':user.id}:{})}:{}),...extra},body:body?JSON.stringify(body):undefined});
 for(const item of r.headers.getSetCookie()){
  assert.match(item,/;\s*Secure/i);assert.match(item,/;\s*HttpOnly/i);
  const pair=item.split(';')[0],i=pair.indexOf('=');cookies.set(pair.slice(0,i),pair.slice(i+1));
 }
 if(r.headers.has('x-mosaic-data-epoch'))epoch=r.headers.get('x-mosaic-data-epoch');
 const data=binary?new Uint8Array(await r.arrayBuffer()):await r.json();
 report.checks.push({path:path.split('?')[0],method:body?'POST':'GET',status:r.status,ms:Math.round(performance.now()-start)});
 return {r,data};
}
try{
 assert.equal((await request('/api/learning/journal',null,{anonymous:true})).r.status,401);
 assert.equal((await request('/api/operations',null,{anonymous:true})).r.status,403);
 assert.equal((await request('/api/auth-providers',null,{anonymous:true})).r.status,200);
 assert.equal((await request('/api/auth/sign-in/email',{email:account.email,password:account.password})).r.status,200,'NCB sign-in');
 const session=await request('/api/auth/get-session');assert.equal(session.r.status,200);user=session.data.user;assert(user?.id);
 const welcome=await request('/api/pilot');assert.equal(welcome.r.status,200);assert.equal(welcome.data.admitted,true);assert.equal(welcome.data.role,'administrator');
 report.account={admitted:true,role:welcome.data.role,onboarded:welcome.data.onboarding?.completed===true};
 const library=await request('/api/workshop/library?view=metadata');assert.equal(library.r.status,200);assert(library.data.resources.length>0);assert(library.data.jobs.length>0);
 report.library={resources:library.data.resourcePage.total,jobs:library.data.jobs.length};
 assert.equal((await request('/api/learning/journal')).r.status,200);
 const studio=await request('/api/learning/studio');assert.equal(studio.r.status,200);
 const unit=studio.data.units.find(x=>!x.unavailable&&!x.unreadable)?.unit;assert(unit,'Existing available programme');
 assert.equal((await request('/api/learning/programme?'+new URLSearchParams({packId:unit.packId,contentHash:unit.contentHash}))).r.status,200);
 report.programmes={total:studio.data.units.length,available:studio.data.units.filter(x=>!x.unavailable&&!x.unreadable).length};
 const inventory=await request('/api/learning/data');assert.equal(inventory.r.status,200);assert.equal(inventory.data.storageConnected,true);
 const asset=inventory.data.media.find(a=>a.status==='ready'&&a.bytes>0);assert(asset,'Existing saved media');
 const media=await request('/api/learning/data',{action:'download',id:asset.id,epoch:inventory.data.epoch},{binary:true});assert.equal(media.r.status,200);assert.equal(media.data.byteLength,asset.bytes);
 report.media={bytes:media.data.byteLength,sha256:createHash('sha256').update(media.data).digest('hex'),contentType:media.r.headers.get('content-type')};
 assert.equal((await request('/api/learning/journal',null,{extra:{'X-Mosaic-Learner':'wrong-account'}})).r.status,401);
 assert.equal((await request('/api/pilot',{}, {extra:{Origin:'https://untrusted.invalid'}})).r.status,403);
 for(const concurrency of [1,2,4]){
  const rows=await Promise.all(Array.from({length:concurrency},()=>request('/api/pilot')));assert(rows.every(x=>x.r.status===200));
 }
 report.pass=true;
}catch(error){report.failure=error.message;process.exitCode=1;}
finally{
 if(user){try{assert.equal((await request('/api/auth/sign-out',{})).r.status,200);report.signedOut=(await request('/api/learning/journal')).r.status===401;}catch{report.signedOut=false;report.pass=false;process.exitCode=1;}}
 report.limitations=['One existing administrator and bounded concurrency; not a multi-classroom capacity test.','No new generation, microphone permission or physical device testing.'];
 await writeFile(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}
