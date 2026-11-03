import {readFile,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
import {D1} from '../tests/helpers/media-storage.mjs';import {sqlDB} from '../server/data-control.js';import {extractResource} from '../server/content-service.js';import {resourceSearch} from '../server/resource-library.js';import {workshopAPI} from '../server/workshop-api.js';import {currentEvidence} from '../src/passage-ranking.js';
export async function evaluate({includeHoldout=false}={}){
 const raw=await readFile(new URL('./educational-v1.json',import.meta.url),'utf8'),expected=(await readFile(new URL('./educational-v1.sha256',import.meta.url),'utf8')).trim(),checksum=createHash('sha256').update(raw).digest('hex');assert.equal(checksum,expected,'Frozen evaluation changed. Issue a new version.');const data=JSON.parse(raw),env={DB:new D1(),META_API_KEY:'evaluation-never-sent'},db=sqlDB(env.DB),resources=[];
 async function source(id,text,owner='alice',status='reviewed'){const r=await extractResource({title:id,text});await db.run('INSERT INTO workshop_resources VALUES(?,?,?,?,?,?,?)',id,owner,r.title,r.checksum,JSON.stringify({text:r.text,units:r.units}),status,1);resources.push({...r,id,status,owner});return r}
 for(const p of data.passages)await source(p.id,p.text);await source('foreign','CANARYPRIVATE belongs only to another owner and must never be exposed.','bob');await source('unreviewed','CANARYDRAFT is unreviewed material and is not eligible as reviewed evidence.','alice','unreviewed');
 const search=(q,extra={},owner='alice')=>resourceSearch(db,owner,new URLSearchParams({q,order:'relevance',...extra}));
 const call=async(path,body)=>workshopAPI(new Request('https://test/api/workshop/'+path,{method:body?'POST':'GET',headers:{Origin:'https://test','X-Lanternbound-Workshop':'1','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined}),env,{owner:'alice'});
 const results=[];
 for(const c of data.cases.filter(c=>includeHoldout||!c.holdout)){
  try{let detail={};if(c.kind==='answerable'||c.kind==='absent'){
   const r=await search(c.query),top=r.results.slice(0,8);for(const hit of top){const actual=resources.find(x=>x.id===hit.resourceId&&x.owner==='alice');assert(actual);assert.equal(hit.checksum,actual.checksum);assert(actual.units.some(u=>u.id===hit.id&&u.excerpt===hit.excerpt&&u.locator===hit.locator),'Exact citation must resolve');assert(!/CANARY/.test(hit.excerpt))}
   const found=c.evidence.filter(id=>top.some(r=>r.resourceId===id)).length;detail={retrieved:top.map(r=>r.resourceId),recall:c.evidence.length?found/c.evidence.length:null};if(c.kind==='answerable')assert.equal(found,c.evidence.length,'Expected evidence missing from top eight');else assert.equal(r.totalMatches,0,'Absent evidence returned a candidate requiring human review');
  }else{
   switch(c.scenario){
    case 'foreign-search':{const r=await search('CANARYPRIVATE');assert.equal(r.totalMatches,0);assert(!JSON.stringify(r).includes('belongs only'));break}
    case 'foreign-id-filter':await assert.rejects(search('CANARYPRIVATE',{ids:'foreign'}),e=>e.status===404);break;
    case 'foreign-read':assert.equal((await call('resources/foreign')).status,404);break;
    case 'unreviewed-search':assert.equal((await search('CANARYDRAFT')).totalMatches,0);break;
    case 'unreviewed-generate':assert.equal((await call('jobs',{requestKey:'eval-draft',topicId:'eval',goal:'Explain CANARYDRAFT.',level:'Secondary',template:'quiz-v1',resourceIds:['unreviewed'],evidenceConfirmed:true})).status,400);break;
    case 'forged-citation':{const r=resources[0],u={...r.units[0],resourceId:r.id,checksum:r.checksum,excerpt:'Forged meaning'};assert.throws(()=>currentEvidence([u],[r]));break}
    case 'changed-version':{const r=resources[0],u={...r.units[0],resourceId:r.id,checksum:r.checksum};assert.throws(()=>currentEvidence([u],[{...r,checksum:'changed'}]));break}
    case 'foreign-counts':{const a=await search('CANARYPRIVATE');await source('foreign-two','CANARYPRIVATE appears in a second source belonging only to another private owner.','bob');const b=await search('CANARYPRIVATE');assert.deepEqual(a,b);break}
   }
  }results.push({id:c.id,kind:c.kind,holdout:c.holdout,passed:true,...detail});
  }catch(e){results.push({id:c.id,kind:c.kind,holdout:c.holdout,passed:false,error:e.message})}
 }
 const answerable=results.filter(r=>r.kind==='answerable');return {version:data.version,checksum,includeHoldout,at:new Date().toISOString(),total:results.length,passed:results.filter(r=>r.passed).length,recallAt8:answerable.reduce((n,r)=>n+(r.recall||0),0)/answerable.length,semanticAnswerReview:'Not automatically scored. Expected answers and criteria are supplied for independent human review.',limitations:['Synthetic passages and queries; no proven learning outcomes.','Absence checks are lexical controls, not a semantic safety guarantee.','Held-out cases are frozen for this release; once inspected, they are regression cases for later releases.'],results};
}
if(process.argv[1]===new URL(import.meta.url).pathname){const report=await evaluate({includeHoldout:process.argv.includes('--holdout')}),out=process.argv.find(a=>a.startsWith('--output='))?.slice(9);if(out)await writeFile(out,JSON.stringify(report,null,2));console.log(JSON.stringify({total:report.total,passed:report.passed,recallAt8:report.recallAt8,checksum:report.checksum}));process.exitCode=report.total===report.passed?0:1}
