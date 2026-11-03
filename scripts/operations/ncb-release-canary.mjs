// Explicit operator check against configured NCB. Only this run's synthetic
// owner is written/deleted. No identity account, learner or email is created.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import assert from 'node:assert/strict';
import {NCBStore} from '../../server/ncb-store.js';
import {digest} from '../../server/content-service.js';
const output=process.argv[2];assert(output,'Pass an evidence path');
const runtime=resolve('.sites-runtime/release-ncb-canary.json');
const env=Object.fromEntries((await readFile('.dev.vars','utf8')).split('\n').map(l=>l.match(/^([^#=]+)=(.*)$/)).filter(Boolean).map(m=>[m[1],m[2].replace(/^"|"$/g,'')]));
let state;try{state=JSON.parse(await readFile(runtime,'utf8'))}catch(e){if(e.code!=='ENOENT')throw e;state={nonce:crypto.randomUUID()};state.owner=await digest('release-canary:'+state.nonce);await mkdir(dirname(runtime),{recursive:true});await writeFile(runtime,JSON.stringify(state),{mode:0o600})}
assert.equal(state.owner,await digest('release-canary:'+state.nonce));assert(!state.complete,'This run is complete. Archive its runtime descriptor before starting a new canary.');
const store=new NCBStore(env),report={started:new Date().toISOString(),kind:'real-ncb-synthetic-records',checks:[],latenciesMs:[]};
const measured=async(fn)=>{const start=performance.now();try{return await fn()}finally{report.latenciesMs.push(Math.round(performance.now()-start))}};
try{
 // If an interrupted attempt left rows, clean only the exact retained owner.
 for(const table of ['learner_profiles','learner_saves']){const rows=await store.allRows(table,state.owner);if(rows.length)await store.deleteRows(table,state.owner,rows.map(r=>r.id))}
 for(const table of ['learner_profiles','learner_saves']){
  const results=await Promise.allSettled([1,2].map(n=>measured(()=>store.write(table,state.owner,'release-check',0,{synthetic:true,candidate:n}))));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1,'One concurrent write must win');
  assert.equal(results.filter(r=>r.status==='rejected'&&r.reason.status===409).length,1,'The competing write must report a conflict');
  const rows=await store.allRows(table,state.owner);assert.equal(rows.length,1);assert.equal(rows[0].version,1);
  const expected=results.find(r=>r.status==='fulfilled').value;assert.equal(rows[0].payload,expected.payload);
  const retried=await measured(()=>store.write(table,state.owner,'release-check',0,JSON.parse(expected.payload)));assert.equal(retried.id,expected.id);
  assert.equal((await store.allRows(table,state.owner)).length,1);report.checks.push(table+': one winner / one 409, one stored version, idempotent retry, exact readback');
 }
 report.pass=true;
}catch(e){report.pass=false;report.failure=e.message;process.exitCode=1}finally{
 try{for(const table of ['learner_profiles','learner_saves']){const rows=await store.allRows(table,state.owner);await store.deleteRows(table,state.owner,rows.map(r=>r.id));assert.equal((await store.allRows(table,state.owner)).length,0)}report.cleaned=true;state.complete=true;await writeFile(runtime,JSON.stringify(state),{mode:0o600})}catch(e){report.cleaned=false;report.cleanupError=e.message;process.exitCode=1}
 report.finished=new Date().toISOString();await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}
