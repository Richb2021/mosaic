// Operator command. Reads the Site credential JSON on hidden stdin; never writes tokens to logs.
import {execFile,execFileSync} from 'node:child_process';
import {promisify} from 'node:util';
import {createInterface} from 'node:readline';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const run=promisify(execFile);
if(process.stdin.isTTY)execFileSync('stty',['-echo'],{stdio:'inherit'});
console.log('Ready for Site access JSON on hidden stdin.');
const rl=createInterface({input:process.stdin,terminal:false}),config=JSON.parse(await new Promise(r=>rl.once('line',r)));rl.close();process.stdin.pause();
if(config.url!=='https://mosaic-lanternbound-rpg.coiledkoi1.chatgpt.site')throw Error('Unexpected Site destination');
const secret=config.maintenanceSecret||createHash('sha256').update('mosaic-maintenance:'+config.token).digest('hex');
const headers={'OAI-Sites-Authorization':'Bearer '+config.token,Authorization:'Bearer '+secret,'X-Mosaic-Maintenance':'closure-v1','Content-Type':'application/json'};
const request=async body=>{const r=await fetch(config.url+'/api/operations',{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,redirect:'manual',signal:AbortSignal.timeout(30000)}),d=await r.json();if(!r.ok)throw Error('Operations HTTP '+r.status);return d};
const queue=await request(),pending=queue.closures.filter(c=>c.status==='provider-pending');
await run('scp',[fileURLToPath(new URL('./close_ncb_identity.py',import.meta.url)),'baldur:/tmp/mosaic-close-ncb.py']);
for(const item of pending.slice(0,5)){
 const task=run('ssh',['baldur','python3 /tmp/mosaic-close-ncb.py'],{encoding:'utf8'});task.child.stdin.end(JSON.stringify(item));const proof=JSON.parse((await task).stdout);
 if(proof.accountReference!==item.accountReference||proof.providerDeleted!==true)throw Error('Provider deletion not verified');
 await request({action:'confirm-provider-deletion',...proof});console.log(JSON.stringify({accountReference:proof.accountReference,status:'complete'}));
}
const result=await request();console.log(JSON.stringify({pending:result.closures.filter(c=>c.status!=='complete').length,completed:result.closures.filter(c=>c.status==='complete').length}));
