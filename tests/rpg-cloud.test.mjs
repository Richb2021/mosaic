import test from 'node:test';
import assert from 'node:assert/strict';
import {RPG_PACKS,bundlePublishedChapter} from '../server/rpg-catalog.js';
import {initialState,travel,beginBattle,battleAction,enterBuilding} from '../src/engine.js';
import {bindSettlement,acceptQuest} from '../src/quests.js';
import {bindChapter,enterWorks,recruit,moveRoom,solveMechanism} from '../src/chapter.js';
import {rpgBundle,validateRPGSave} from '../src/rpg-progress.js';
import {observeProgress,progressIdentity,validPracticeRecord} from '../src/game-modes/learning-model.js';
import {LearningJournal,gameSaveKey} from '../src/game-modes/learning-client.js';
import {canonicalPack,learningAPI} from '../server/learning-api.js';
import {draftHash} from '../src/game-modes/draft-engine.js';
import {StoreError} from '../server/ncb-store.js';
const setup=b=>{const s=initialState(b.world);s.attempts={sequence:0,allocation:0,matching:0,dials:0};bindSettlement(s,b.settlement);bindChapter(s,b.chapter);return s};
test('RPG snapshots restore interiors, quests, a battle and a solved chapter against exact canonical content',()=>{
 for(const b of RPG_PACKS){let s=setup(b);s.started=true;s.hero='male';s.party[0].name='Ren';enterBuilding(s,'inn');acceptQuest(s,b.settlement,b.settlement.quests.find(q=>q.giver==='inn').id);
  assert.deepEqual(validateRPGSave(s,b),s);
  s=setup(b);travel(s,'woods');beginBattle(s,'bramble');s=battleAction(s,'inspect').state;assert.deepEqual(validateRPGSave(s,b),s);
  s=setup(b);travel(s,'mill');enterWorks(s);recruit(s);moveRoom(s,'gallery');s.chapter.mechanisms.route=[...b.chapter.challenges.route.solution];solveMechanism(s,b.chapter,'route');
  const result=observeProgress(b,'rpg',s);assert.equal(result.snapshot.chapter.solved[0],'route');assert.deepEqual(result.summary.observations,[]);assert.ok(validPracticeRecord({key:progressIdentity(b,'rpg'),updated:1,summary:result.summary}));
 }
});
test('RPG cloud validation rejects mismatched chapters, settlements, forged quest ids and impossible mechanisms',()=>{
 const b=RPG_PACKS[0],s=setup(b),bad=patch=>Object.assign(structuredClone(s),patch);
 assert.throws(()=>validateRPGSave(bad({questContent:'wrong'}),b));
 assert.throws(()=>validateRPGSave(bad({chapter:{...s.chapter,content:'foreign@1'}}),b));
 assert.throws(()=>validateRPGSave(bad({quests:{foreign:{step:0,completed:false,rewarded:false,attempts:0}}}),b));
 assert.throws(()=>validateRPGSave(bad({chapter:{...s.chapter,solved:['route'],attempts:{...s.chapter.attempts,route:1}}}),b));
 assert.throws(()=>validateRPGSave(bad({chapter:{...s.chapter,mechanisms:{...s.chapter.mechanisms,balance:21}}}),b));
 const next=rpgBundle(b.world,b.settlement,{...b.chapter,revision:2});assert.notEqual(gameSaveKey(b,'rpg'),gameSaveKey(next,'rpg'));assert.throws(()=>validateRPGSave(s,next));
 const polluted=bad({pos:{...s.pos,privateText:'do not persist'},party:s.party.map(p=>({...p,foreign:{text:'no'}}))});assert.equal(validateRPGSave(polluted,b).pos.privateText,undefined);assert.equal(validateRPGSave(polluted,b).party[0].foreign,undefined);
});
test('RPG canonical lookup only accepts included or owner-published chapters, bound to the included world',async()=>{
 const {DatabaseSync}=await import('node:sqlite');const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE workshop_jobs(owner TEXT,status TEXT,draft TEXT,updated INTEGER)');
 const chapter={...RPG_PACKS[0].chapter,id:'generated-rpg-check'},bundle=bundlePublishedChapter(chapter);db.prepare('INSERT INTO workshop_jobs VALUES(?,?,?,?)').run('a','review',JSON.stringify(chapter),1);
 const DB={prepare:sql=>({bind:(...v)=>({all:async()=>({results:db.prepare(sql).all(...v)})})})},req=owner=>new Request('https://game.test',{headers:{'oai-authenticated-user-id':owner}});
 await assert.rejects(()=>canonicalPack(bundle.id,draftHash(bundle),req('a'),{DB}));db.prepare('UPDATE workshop_jobs SET status=?').run('published');assert.equal((await canonicalPack(bundle.id,draftHash(bundle),req('a'),{DB})).chapter.id,chapter.id);await assert.rejects(()=>canonicalPack(bundle.id,draftHash(bundle),req('b'),{DB}));db.close();
});
test('RPG uses existing account/version checks and returns canonical content for another device',async()=>{
 const b=RPG_PACKS[0],rows=new Map(),store={latest:async(t,o,s)=>rows.get(o+s),write:async(t,o,s,v,p)=>{if((rows.get(o+s)?.version||0)!==v)throw new StoreError('conflict',409);const row={version:v+1,payload:JSON.stringify(p),updated_ms:1};rows.set(o+s,row);return row}},session=async()=>({id:'a'}),opts={store,session};
 const input={packId:b.id,contentHash:draftHash(b),kind:'rpg',expectedVersion:0,snapshot:setup(b)};
 const req=(method,body,user='a')=>new Request('https://game.test/api/learning/save'+(method==='GET'?'?'+new URLSearchParams({packId:b.id,contentHash:draftHash(b),kind:'rpg'}):''),{method,headers:{Origin:'https://game.test','X-Mosaic-Learner':user,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 assert.equal((await learningAPI(req('POST',input),{},opts)).status,200);assert.equal((await learningAPI(req('POST',input),{},opts)).status,409);assert.equal((await learningAPI(req('POST',{...input,expectedVersion:1},'other'),{},opts)).status,401);
 const response=await(await learningAPI(req('GET'),{},opts)).json();assert.deepEqual(response.save.snapshot,setup(b));assert.equal(response.content.chapter.id,b.chapter.id);
 const other=await(await learningAPI(req('GET',null,'other'),{},{store,session:async()=>({id:'other'})})).json();assert.equal(other.save,null);
});
test('RPG cloud restore keeps a device recovery copy and never consumes guest progress',async t=>{
 const data=new Map(),old=globalThis.localStorage;globalThis.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};t.after(()=>{globalThis.localStorage=old});const b=RPG_PACKS[0],guest=setup(b);data.set(gameSaveKey(b,'rpg'),JSON.stringify(guest));const j=new LearningJournal();j.user={id:'learner'};j.loadLocal();assert.equal(j.storage.getItem(gameSaveKey(b,'rpg')),null);const local=setup(b);local.started=true;j.storage.setItem(gameSaveKey(b,'rpg'),JSON.stringify(local));const cloud=setup(b);cloud.hero='male';cloud.party[0].name='Ren';const clean=observeProgress(b,'rpg',cloud);j.request=async()=>({save:{key:progressIdentity(b,'rpg'),version:2,updated:1,...clean}});await j.resolveSave(b,'rpg',true);assert.equal(JSON.parse(j.storage.getItem(gameSaveKey(b,'rpg'))).hero,'male');assert.deepEqual(JSON.parse(j.storage.getItem(gameSaveKey(b,'rpg')+':previous')),local);assert.deepEqual(JSON.parse(data.get(gameSaveKey(b,'rpg'))),guest);
});

test('closing with pending RPG progress resumes sync at the same cloud version, while a newer cloud version stays a conflict',async t=>{
 const data=new Map(),old=globalThis.localStorage;globalThis.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};t.after(()=>{globalThis.localStorage=old});
 const b=RPG_PACKS[0],j=new LearningJournal();j.user={id:'returning'};j.loadLocal();const cloud=observeProgress(b,'rpg',setup(b)),local=setup(b);local.pos={x:1,z:4};const clean=observeProgress(b,'rpg',local),key=progressIdentity(b,'rpg');let posts=0;
 j.records=[{key,...clean,version:1,pending:true,updated:1}];j.request=async(path,body)=>{if(body){posts++;assert.equal(body.expectedVersion,1);assert.deepEqual(body.snapshot.pos,{x:1,z:4});return {save:{version:2}}}return {save:{key,...cloud,version:1,updated:1}}};await j.prepare(b,'rpg');assert.equal(posts,1);assert.equal(j.records[0].pending,false);assert.equal(j.records[0].conflict,false);assert.deepEqual(JSON.parse(j.storage.getItem(gameSaveKey(b,'rpg'))).pos,{x:1,z:4});
 j.records=[{key,...clean,version:1,pending:true,updated:1}];j.request=async()=>({save:{key,...cloud,version:3,updated:2}});await j.prepare(b,'rpg');assert.equal(j.records[0].conflict,true);assert.equal(j.records[0].cloudVersion,3);assert.equal(posts,1);
});
test('RPG settings and legacy manual slots respect the connected learner and exact chapter',async t=>{
 const {Expansion}=await import('../src/expansion.js'),{learningJournal}=await import('../src/game-modes/learning-client.js'),{hashPack}=await import('../src/engine.js');
 const data=new Map(),oldStorage=globalThis.localStorage,oldUser=learningJournal.user;globalThis.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};t.after(()=>{globalThis.localStorage=oldStorage;learningJournal.user=oldUser});learningJournal.user=null;
 const b=RPG_PACKS[0],g={pack:b.world,state:setup(b)},e=new Expansion(()=>g);e.content.set(b.world.id,b.chapter);data.set('lanternbound:settings',JSON.stringify({...e.settings,text:130}));const envelope=e.envelope(),legacy=`lanternbound:slot:${b.world.id}:${hashPack(b.world)}:1`;data.set(legacy,JSON.stringify(envelope));assert.deepEqual(e.slot(1),envelope);
 learningJournal.user={id:'settings-account'};e.loadSettings();assert.notEqual(e.settings.text,130);assert.equal(e.slot(1),null);learningJournal.storage.setItem('lanternbound:settings',JSON.stringify({...e.settings,text:115}));e.loadSettings();assert.equal(e.settings.text,115);
 learningJournal.user=null;e.loadSettings();assert.equal(e.settings.text,130);e.content.set(b.world.id,{...b.chapter,revision:2});assert.equal(e.slot(1),null);
});
