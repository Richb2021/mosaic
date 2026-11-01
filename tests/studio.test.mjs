import test from 'node:test';
import assert from 'node:assert/strict';
import {normaliseProfile} from '../src/game-modes/learning-model.js';
import {DRAFT_PACKS} from '../src/game-modes/draft-content.js';
import {EXTENDED_PACKS} from '../src/game-modes/extended-packs.js';
import {RPG_PACKS} from '../server/rpg-catalog.js';
import {newUnit,applyUnitAction,makeProgramme,activitiesOf,questionsOf,unitKey} from '../src/studio/programme.js';
import {learningAPI} from '../server/learning-api.js';
import {studioCatalog} from '../server/studio-api.js';
import {StoreError} from '../server/ncb-store.js';
import {draftHash} from '../src/game-modes/draft-engine.js';

const domains=[DRAFT_PACKS[0],EXTENDED_PACKS.find(p=>p.id==='riverlight-web-quiz'),EXTENDED_PACKS.find(p=>p.id==='riverlight-fraction-cup')];
test('old profile migrates additively; bounded fields and access preferences remain separate',()=>{
 const p=normaliseProfile({goal:'Explain fractions',formats:['sports-v1']});assert.equal(p.goal,'Explain fractions');assert.equal(p.level,'Not sure yet');assert.equal(p.minutes,25);assert.equal(p.access.captions,true);
 assert.throws(()=>normaliseProfile({interests:['secret unknown category']}));assert.throws(()=>normaliseProfile({access:{reducedMotion:'yes'}}));assert.throws(()=>normaliseProfile({struggles:'x'.repeat(1001)}));
 assert.equal(normaliseProfile({...p,stage:'University',level:'Starting out'}).stage,'University');
});
for(const pack of domains)test(`${pack.id}: novice, mixed and independent checks produce different supported routes`,()=>{
 const keys=activitiesOf(pack).map(a=>a.key),q=questionsOf(pack,keys),profile={goal:'Understand the reviewed idea',level:'Applying ideas independently',interests:['Cooking']};
 let novice=newUnit(pack,{...profile,level:'Starting out'},keys,10),mixed=newUnit(pack,profile,keys,10),independent=newUnit(pack,profile,keys,10);
 for(const [i,item] of q.slice(0,3).entries()){
  novice=applyUnitAction(novice,pack,{type:'answer',key:item.key,answer:null,confidence:'not-sure'},20);
  mixed=applyUnitAction(mixed,pack,{type:'answer',key:item.key,answer:i?item.solution:(item.solution+1)%3,confidence:'tentative'},20);
  independent=applyUnitAction(independent,pack,{type:'answer',key:item.key,answer:item.solution,confidence:'confident'},20);
 }
 const a=makeProgramme(pack,novice),b=makeProgramme(pack,mixed),c=makeProgramme(pack,independent);
 assert.equal(a.title,'Build with support');assert.equal(a.answers[0].correct,null);assert.equal(b.answers[0].correct,false);assert.equal(c.title,'Apply and explain');assert.equal(c.stages[0].id,'practice');assert.equal(a.stages[0].id,'read');assert.ok(c.practiceKeys.every(k=>!independent.answers.some(a=>a.key===k)));assert.match(a.bridge,/cooking/);
 assert.throws(()=>applyUnitAction(novice,pack,{type:'answer',key:q[0].key,answer:q[0].solution,confidence:'confident'}),/already recorded/);
 const accessible=applyUnitAction(independent,pack,{type:'replan',profile:{...profile,access:{textFirst:true,reducedMotion:true},interests:['Football']}});const d=makeProgramme(pack,accessible);assert.equal(d.stages[0].id,'read');assert.equal(d.stages.find(s=>s.id==='game').optional,true);assert.match(d.bridge,/football/);assert.deepEqual(accessible.answers,independent.answers);
});
test('RPG has source-based reflection, no manufactured starting questions or competence',()=>{
 const pack=RPG_PACKS[0],u=newUnit(pack,{},activitiesOf(pack).map(a=>a.key),10),p=makeProgramme(pack,u);assert.equal(p.answers.length,0);assert.equal(p.diagnosticComplete,true);assert.ok(p.sources.length);assert.match(p.reasons[0],/no reviewed/);
});
class MemoryStore{
 rows=new Map();async latest(table,owner,slot){return this.rows.get([table,owner,slot].join(':'))||null}async list(){return []}
 async write(table,owner,slot,version,payload,now){const key=[table,owner,slot].join(':'),old=this.rows.get(key);if((old?.version||0)!==version)throw new StoreError('conflict',409);const r={owner_key:owner,slot_key:slot,payload:JSON.stringify(payload),version:version+1,updated_ms:now};this.rows.set(key,r);return r;}
}
const req=(path,body,user='a')=>new Request('https://game.test/api/learning/'+path,{method:body?'POST':'GET',headers:{Origin:'https://game.test','Content-Type':'application/json','X-Mosaic-Learner':user},body:body?JSON.stringify(body):undefined});
test('studio persists in NCB adapter slot, scopes identity and derives answers from canonical content',async()=>{
 const store=new MemoryStore(),opts=id=>({store,session:async()=>({id}),now:()=>100}),p=domains[0],payload={type:'create',packId:p.id,contentHash:draftHash(p),evidenceConfirmed:true,activityKeys:activitiesOf(p).map(a=>a.key),expectedVersion:0};
 await learningAPI(req('profile',{profile:{goal:'Study the Industrial Revolution',interests:['History']},expectedVersion:0}),{},opts('a'));
 assert.equal((await learningAPI(req('studio',{...payload,evidenceConfirmed:false}),{},opts('a'))).status,400);
 assert.equal((await learningAPI(req('studio',{...payload,packId:'foreign'}),{},opts('a'))).status,422);
 assert.equal((await learningAPI(req('studio',payload),{},opts('a'))).status,200);
 assert.equal((await learningAPI(req('studio',payload),{},opts('a'))).status,409);
 assert.equal((await learningAPI(req('studio',null,'b'),{},opts('a'))).status,401);
 assert.equal((await (await learningAPI(req('studio',null,'b'),{},opts('b'))).json()).state.units.length,0);
 const action={type:'answer',key:p.scenarios[0].id,answer:(p.scenarios[0].solution+1)%3,confidence:'confident'};
 assert.equal((await learningAPI(req('studio',{...payload,type:'update',expectedVersion:1,action,correct:true}),{},opts('a'))).status,200);
 const result=await (await learningAPI(req('studio'),{},opts('a'))).json();assert.equal(result.version,2);assert.equal(result.units[0].programme.answers[0].correct,false);assert.deepEqual(result.state.units[0].profile.interests,['History']);
 assert.equal((await learningAPI(req('studio',{...payload,type:'update',expectedVersion:2,action}),{},opts('a'))).status,400);
 assert.equal((await learningAPI(req('studio',{type:'remove',id:unitKey(p),expectedVersion:2}),{},opts('a'))).status,200);
 assert.equal((await (await learningAPI(req('journal'),{},opts('a'))).json()).profile.goal,'Study the Industrial Revolution');
});
test('studio POST rejects foreign origins and unknown focus IDs; no provider invocation',async()=>{
 const p=domains[0],body={type:'create',packId:p.id,contentHash:draftHash(p),activityKeys:['imaginary'],evidenceConfirmed:true,expectedVersion:0},options={store:new MemoryStore(),session:async()=>({id:'a'})};
 assert.equal((await learningAPI(req('studio',body),{},options)).status,400);
 const r=req('studio',body);r.headers.set('Origin','https://other.test');assert.equal((await learningAPI(r,{},options)).status,403);
});
test('catalogue adds only owner-scoped published valid packs and preserves exact revisions',async()=>{
 let bound;const DB={prepare:sql=>{assert.match(sql,/owner=\? AND status=\?/);return {bind:(...v)=>{bound=v;return {all:async()=>({results:[{id:'job-valid',draft:JSON.stringify({...domains[0],id:'generated-example'})},{id:'job-bad',draft:'broken'}]})}}}}};
 const result=await studioCatalog(new Request('https://game.test',{headers:{'oai-authenticated-user-id':'alice'}}),{DB},domains,'alice');assert.deepEqual(bound,['alice','published']);assert.equal(result.length,4);assert.equal(result.at(-1).jobId,'job-valid');
});
test('practice keeps a wrong attempt and a correction distinct and never changes the initial answer',()=>{
 const p=domains[0],q=questionsOf(p)[0];let u=newUnit(p,{},activitiesOf(p).map(a=>a.key));u=applyUnitAction(u,p,{type:'answer',key:q.key,answer:null,confidence:'not-sure'});
 u=applyUnitAction(u,p,{type:'practice',key:q.key,answer:(q.solution+1)%3,confidence:'tentative'});u=applyUnitAction(u,p,{type:'practice',key:q.key,answer:q.solution,confidence:'confident'});
 const v=makeProgramme(p,u);assert.equal(v.answers[0].correct,null);assert.deepEqual(v.practice.map(a=>a.correct),[false,true]);
});


test('programme RPG links select the exact included chapter for guests and reject stale or wrong cloud chapters',async()=>{
 const {resolveAdventureLink}=await import('../src/rpg-launch.js');
 for(const pack of RPG_PACKS)assert.equal(await resolveAdventureLink('?'+new URLSearchParams({rpg:pack.id,hash:draftHash(pack)}),RPG_PACKS),pack);
 assert.equal(await resolveAdventureLink('',RPG_PACKS),null);
 await assert.rejects(()=>resolveAdventureLink('?rpg=missing',RPG_PACKS),/incomplete/);
 await assert.rejects(()=>resolveAdventureLink('?rpg=missing&hash=old',RPG_PACKS),/Sign in/);
 await assert.rejects(()=>resolveAdventureLink('?rpg=missing&hash=old',RPG_PACKS,async()=>({content:RPG_PACKS[0]})),/exact chapter/);
});
test('profile save reports unavailable device storage and preserves a confirmed cloud save',async()=>{
 const {LearningJournal}=await import('../src/game-modes/learning-client.js');
 const journal=new LearningJournal();Object.defineProperty(journal,'storage',{get:()=>({setItem(){throw Error('Quota exceeded')}})});
 let result=await journal.saveProfile({goal:'Food webs'});assert.equal(result.savedOnDevice,false);assert.equal(result.savedToAccount,false);assert.match(result.notice,/visit only/);
 journal.user={id:'synthetic'};journal.request=async()=>({version:3});result=await journal.saveProfile({goal:'Food webs'});
 assert.equal(result.savedToAccount,true);assert.equal(result.savedOnDevice,false);assert.equal(journal.profileVersion,3);assert.equal(journal.profilePending,false);
 journal.request=async()=>{throw Object.assign(Error('Version conflict'),{status:409})};result=await journal.saveProfile({goal:'Revised'});assert.equal(result.savedToAccount,false);assert.equal(journal.profileConflict,true);assert.equal(journal.profile.goal,'Revised');assert.equal(journal.profileSaving,false);
});
test('corrupt stored profile is explicit, cannot create a programme, and is preserved',async()=>{
 const store=new MemoryStore(),opts={store,session:async()=>({id:'a'}),now:()=>100};
 const {createHash}=await import('node:crypto');const owner=createHash('sha256').update('mosaic-learner:a').digest('hex');
 await store.write('learner_profiles',owner,'profile',0,{profile:{minutes:999}},100);
 const p=domains[0],response=await learningAPI(req('studio',{type:'create',packId:p.id,contentHash:draftHash(p),evidenceConfirmed:true,activityKeys:activitiesOf(p).map(a=>a.key),expectedVersion:0}),{},opts);
 assert.equal(response.status,422);assert.match((await response.json()).error,/profile could not be read/);assert.equal(store.rows.size,1);
});
test('exam dates require a real calendar day',()=>{
 assert.throws(()=>normaliseProfile({examDate:'2027-02-30'}));assert.equal(normaliseProfile({examDate:'2028-02-29'}).examDate,'2028-02-29');
});
