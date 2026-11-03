import {readFile,writeFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';
import {createHash} from 'node:crypto';
import {submitCreative,checkCreative} from '../server/creative-provider.js';
const output=process.argv[2];if(!output)throw Error('Supply an absolute output path');
const raw=await readFile(new URL('./semantic-v1.json',import.meta.url),'utf8'),suite=JSON.parse(raw),checksum=createHash('sha256').update(raw).digest('hex');
const env=parseEnv(await readFile(new URL('../.dev.vars',import.meta.url),'utf8'));if(!env.META_API_KEY)throw Error('Configured Muse key unavailable');
let result;try{result=JSON.parse(await readFile(output,'utf8'));if(result.checksum!==checksum)throw Error('Suite changed')}catch(e){if(e.code!=='ENOENT')throw e;result={version:suite.version,checksum,model:'muse-wonder-1.0',startedAt:new Date().toISOString(),cases:[]};}
const save=()=>writeFile(output,JSON.stringify(result,null,2));
for(const c of suite.cases.filter(c=>!process.env.EVAL_CASES||process.env.EVAL_CASES.split(',').includes(c.id))){
 const evidence=[{id:'source-'+c.id,title:'Synthetic '+c.id,locator:'Paragraph 1',excerpt:c.source}],job={id:'semantic-'+c.id,kind:'tutor',question:c.question,context:{kind:'tutor',title:c.id,activities:[{key:c.id,prompt:c.question,objective:'Use the supplied evidence to reason',scope:'Synthetic test only'}],evidence,learner:{level:c.level,interests:c.interest,focus:'',goal:'Understand and explain',access:[]}}};
 let item=result.cases.find(x=>x.id===c.id);
 if(!item){item={id:c.id,criteria:c.criteria,status:'submission-started',startedAt:new Date().toISOString()};result.cases.push(item);await save();try{Object.assign(item,await submitCreative(job,env.META_API_KEY));}catch(e){Object.assign(item,{status:'failed-or-uncertain',error:e.message,providerId:e.providerId,usage:e.usage});}await save();}
 if(item.status==='submission-started'||item.status==='failed-or-uncertain'){console.log(JSON.stringify({id:c.id,status:item.status}));continue;}
 for(let n=0;item.status==='running'&&n<80;n++){await new Promise(r=>setTimeout(r,3000));try{Object.assign(item,await checkCreative(item.providerId,job,env.META_API_KEY));await save();}catch(e){item.pollError=e.message;await save();break;}}
 console.log(JSON.stringify({id:c.id,status:item.status,providerId:item.providerId}));
}
result.completedAt=new Date().toISOString();await save();
