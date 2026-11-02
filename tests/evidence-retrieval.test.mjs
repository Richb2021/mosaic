import test from 'node:test';
import assert from 'node:assert/strict';
import {D1} from './helpers/media-storage.mjs';
import {sqlDB} from '../server/data-control.js';
import {extractResource} from '../server/content-service.js';
import {resourceSearch} from '../server/resource-library.js';
import {workshopAPI} from '../server/workshop-api.js';
import {retrievalQuery,evidenceChoice,currentEvidence} from '../src/passage-ranking.js';
import {retrievalCorpus,retrievalCases} from './fixtures/retrieval-corpus.mjs';
async function setup(){
 const env={DB:new D1()},db=sqlDB(env.DB),batches=[];
 const source=async(id,text,{owner='alice',status='reviewed',created=1,title=id}={})=>{const r=await extractResource({title,text});await db.run('INSERT INTO workshop_resources VALUES(?,?,?,?,?,?,?)',id,owner,r.title,r.checksum,JSON.stringify({text:r.text,units:r.units}),status,created);return {...r,id,status}};
 const all=async(sql,...v)=>{const rows=await db.all(sql,...v);if(sql.includes('payload FROM workshop_resources'))batches.push(rows.length);return rows};
 const search=(q,extra={},owner='alice')=>resourceSearch({all},owner,new URLSearchParams({q,order:'relevance',...extra}));
 return {env,db,source,search,batches};
}
test('ranked search finds older late passages before newer single-word distractors, keeps canonical quotations',async()=>{
 const h=await setup(),r=await h.source('old',Array.from({length:65},(_,i)=>i===39?'Food web arrows show energy transfer from grass to rabbits and then to foxes.':'This unrelated notebook entry describes the colour of a garden gate. Entry '+i+'.').join('\n\n'));
 for(let i=0;i<45;i++)await h.source('new-'+i,'Energy is one word in this unrelated catalogue about electric lamps and their switches, entry '+i+'.',{created:100+i});
 const p=await h.search('food web arrows energy');assert.equal(p.results[0].resourceId,'old');assert.equal(p.results[0].locator,'Paragraph 40');assert.equal(p.results[0].excerpt,r.units[39].excerpt);assert.equal(p.scanned,46);assert.equal(p.passagesScanned,110);assert.equal(p.totalMatches,46);assert.equal(p.notFound.length,0);assert(h.batches.every(n=>n<=20));
});
test('ranked pages traverse all hits exactly once with stable order, and bind query, alternatives, owner and source snapshot',async()=>{
 const h=await setup();for(let i=0;i<43;i++)await h.source('s-'+i,'Evaporation changes liquid water into water vapour in this independently numbered passage '+i+'.');
 const a=await h.search('evaporation'),b=await h.search('evaporation',{cursor:a.nextCursor}),c=await h.search('evaporation',{cursor:b.nextCursor});assert.equal(new Set([...a.results,...b.results,...c.results].map(x=>x.id)).size,43);assert.equal(c.nextCursor,null);
 await assert.rejects(h.search('condensation',{cursor:a.nextCursor}),/different search/);await assert.rejects(h.search('evaporation',{related:'water',cursor:a.nextCursor}),/different search/);await assert.rejects(h.search('evaporation',{cursor:a.nextCursor},'bob'),/different search/);await assert.rejects(h.search('evaporation',{cursor:'garbage'}),/invalid/);
 await h.db.run('UPDATE workshop_resources SET status=? WHERE id=?','unreviewed','s-0');await assert.rejects(h.search('evaporation',{cursor:a.nextCursor}),e=>e.status===409);
});
test('reviewed-only retrieval excludes foreign and unreviewed sources; title matches never impersonate quotation matches',async()=>{
 const h=await setup();await h.source('a','Trees take up water through roots. Leaves need light for photosynthesis.',{title:'Quantum gravity'});await h.source('unreviewed','Quantum gravity is a placeholder term in this source that has not been reviewed.',{status:'unreviewed'});await h.source('secret','Quantum gravity appears in another owner private material and must never be returned.',{owner:'bob'});
 const p=await h.search('quantum gravity');assert.deepEqual(p.results,[]);assert.equal(p.excludedSources,1);assert.equal(p.scanned,1);assert.deepEqual(p.notFound,['quantum','gravity']);await assert.rejects(h.search('quantum',{ids:'secret'}),e=>e.status===404);await assert.rejects(h.search('quantum',{status:'all'}),/reviewed sources only/);
});
test('alternative phrases are token-bound, visible and optional; empty or too broad inputs fail without inference',async()=>{
 const h=await setup();await h.source('motion','Inertia describes resistance to a change of motion. Constant velocity means speed and direction stay the same.');
 assert.equal((await h.search('keeps moving forever')).totalMatches,0);const p=await h.search('keeps moving forever',{related:'inertia\nconstant velocity'});assert.equal(p.results.length,1);assert.deepEqual(p.results[0].matched,[]);assert.deepEqual(p.results[0].relatedMatched,['inertia','constant velocity']);assert.deepEqual(p.notFound,['keeps','moving','forever']);
 assert.equal((await h.search('tin')).totalMatches,0);assert.equal((await h.search('none',{related:'constant speed'})).totalMatches,0);
 assert.throws(()=>retrievalQuery('the and'),/meaningful/);assert.throws(()=>retrievalQuery('a'.repeat(241)),/240/);assert.throws(()=>retrievalQuery('water',Array.from({length:9},(_,i)=>'x'+i).join('\n')),/eight/);assert.throws(()=>retrievalQuery('water','x'.repeat(61)),/eight/);
});
test('source changes during a search fail closed instead of mixing versions',async()=>{
 const h=await setup();await h.source('a','Evaporation changes liquid water to vapour and condensation changes it back.');let mutated=false;
 const all=async(sql,...v)=>{const rows=await h.db.all(sql,...v);if(!mutated&&sql.includes('payload FROM')){mutated=true;await h.db.run('DELETE FROM workshop_resources WHERE id=?','a')}return rows};
 await assert.rejects(resourceSearch({all},'alice',new URLSearchParams({q:'evaporation',order:'relevance'})),e=>e.status===409);
});
test('500-source full scan is bounded in database batches and does not reserve a generation request',async()=>{
 const h=await setup();for(let i=0;i<500;i++)await h.source('s-'+i,Array.from({length:80},(_,n)=>`This measured passage describes evaporation number ${i} and position ${n}.`).join('\n\n'));
 const p=await h.search('evaporation');assert.equal(p.scanned,500);assert.equal(p.passagesScanned,40000);assert.equal(p.totalMatches,40000);assert.equal(p.results.length,20);assert.equal(Math.max(...h.batches),20);assert.equal((await h.db.one('SELECT COUNT(*) n FROM workshop_jobs')).n,0);
 const res=await workshopAPI(new Request('https://test/api/workshop/search?order=relevance&q=evaporation'),h.env,{owner:'alice',provider:()=>{throw Error('Search must not call Muse')}});assert.equal(res.status,200);assert.equal((await res.json()).passagesScanned,40000);
});
test('selected evidence enforces chapter limits, rechecks canonical source version and never silently substitutes',async()=>{
 const h=await setup(),r=await h.source('a','Evaporation changes liquid water to vapour and condensation changes it back.'),p={...r.units[0],resourceId:r.id,checksum:r.checksum};
 const chosen=evidenceChoice([],p);assert.equal(chosen.length,1);assert.equal(evidenceChoice(chosen,p).length,0);assert.deepEqual(currentEvidence(chosen,[r]),chosen);
 assert.throws(()=>currentEvidence(chosen,[{...r,status:'unreviewed'}]),/changed/);assert.throws(()=>currentEvidence(chosen,[{...r,checksum:'changed'}]),/changed/);assert.throws(()=>currentEvidence([{...p,excerpt:'forged'}],[r]),/changed/);assert.throws(()=>currentEvidence([p,p],[r]),/different/);
 assert.throws(()=>evidenceChoice([0,1,2].map(i=>({...p,resourceId:'r'+i})),p),/three/);assert.throws(()=>evidenceChoice(Array.from({length:12},(_,i)=>({...p,id:'p'+i})),p),/twelve/);assert.throws(()=>evidenceChoice([{...p,id:'long',excerpt:'x'.repeat(18000)}],p),/18,000/);
});
test('ranked search retains the workshop account-identity gateway',async()=>{
 const {workshopGateway}=await import('../server/workshop-gateway.js'),h=await setup();
 const req=new Request('https://test/api/workshop/search?order=relevance&q=evaporation',{headers:{'X-Mosaic-Learner':'wrong-account'}});
 const result=await workshopGateway(req,h.env,{session:async()=>({id:'right-account'}),store:{}});assert.equal(result.status,401);assert.match((await result.json()).error,/account changed/);
 const signedOut=await workshopGateway(req,h.env,{session:async()=>null,store:{}});assert.equal(signedOut.status,401);
});
test('synthetic relevance cases retrieve labelled evidence in the first five, including French and Spanish; unsupported query stays empty',async()=>{
 const h=await setup();for(const r of retrievalCorpus)await h.source(r.id,r.text);
 for(let i=0;i<35;i++)await h.source('distractor-'+i,'Fractions, steam, energy, ecosystem, evaporation, DNA, loop, metaphor, photosynthèse and evaporación are catalogue words without an explanation. Entry '+i+'.',{created:100+i});
 for(const c of retrievalCases){const p=await h.search(c.query,{related:c.related||''});const top=p.results.slice(0,5).map(p=>p.resourceId);assert(c.relevant.every(id=>top.includes(id)),c.id+': '+top.join(','));if(!c.relevant.length)assert.equal(p.totalMatches,0)}
});
