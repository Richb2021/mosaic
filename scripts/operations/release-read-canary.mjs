// Bounded, read-only production request sample using a separate admin session.
// Receive {url,token} over hidden stdin; never put credentials in arguments/logs.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import assert from 'node:assert/strict';
const out=process.argv[2];assert(out,'Pass an evidence path');
if(process.stdin.isTTY)process.stdin.setRawMode(true);
console.log('Ready for private Site configuration on stdin (hidden).');
const input=await new Promise(resolve=>{let text='';process.stdin.setEncoding('utf8');process.stdin.on('data',chunk=>{text+=chunk;if(text.includes('\n')){process.stdin.pause();resolve(text.trim())}});process.stdin.resume()});
if(process.stdin.isTTY)process.stdin.setRawMode(false);
const config=JSON.parse(input),origin=new URL(config.url).origin;
assert.equal(origin,'https://mosaic-lanternbound-rpg.rbuk2025.chatgpt.site');assert(config.token);
const account=JSON.parse(await readFile('.sites-runtime/pilot-admin.json','utf8')),cookies=new Map();let user;
const report={kind:'production-read-only-single-account',started:new Date().toISOString(),samples:[],limitations:['One existing administrator, not multiple real learners or a classroom capacity test.','No generation, uploads, edits or audience changes.']};
const request=async(path,body)=>{const started=performance.now(),r=await fetch(origin+path,{method:body?'POST':'GET',headers:{'OAI-Sites-Authorization':'Bearer '+config.token,Origin:origin,'Content-Type':'application/json',Cookie:[...cookies].map(([k,v])=>k+'='+v).join('; '),...(user?{'X-Mosaic-Learner':user.id}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(45000),redirect:'error'});
 for(const item of r.headers.getSetCookie()){const [pair]=item.split(';'),index=pair.indexOf('=');cookies.set(pair.slice(0,index),pair.slice(index+1))}
 const data=await r.json();return {status:r.status,ms:Math.round(performance.now()-started),data,retryAfter:r.headers.get('retry-after')};};
try{
 const login=await request('/api/auth/sign-in/email',{email:account.email,password:account.password});assert.equal(login.status,200,'Separate canary sign-in must succeed');
 const session=await request('/api/auth/get-session');assert.equal(session.status,200);user=session.data.user;assert(user?.id);
 const welcome=await request('/api/pilot');assert.equal(welcome.status,200);assert.equal(welcome.data.admitted,true);report.readiness={role:welcome.data.role,onboarded:welcome.data.onboarding?.completed===true,noticeVersion:welcome.data.noticeVersion,retentionEnabled:welcome.data.operations?.maintenance?.enabled,pendingClosures:welcome.data.operations?.closures?.length,pendingCleanup:welcome.data.operations?.pendingDeletion,dailyBudget:welcome.data.budget?.limitUsd};
 for(const concurrency of [1,2,4]){
  const rows=await Promise.all(Array.from({length:concurrency},async(_,i)=>{const path=i%2?'/api/learning/journal':'/api/pilot',r=await request(path);return {path,status:r.status,ms:r.ms,...(r.retryAfter?{retryAfter:r.retryAfter}:{})}}));
  report.samples.push({concurrency,requests:rows});assert(rows.every(r=>r.status===200),'Stop after a failed request; honour provider throttling before any future run');
 }
 report.pass=true;
}catch(e){report.pass=false;report.failure=e.message;process.exitCode=1}finally{
 if(user)try{report.sessionClosed=(await request('/api/auth/sign-out',{})).status===200}catch{report.sessionClosed=false}
 report.finished=new Date().toISOString();await mkdir(dirname(out),{recursive:true});await writeFile(out,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}
