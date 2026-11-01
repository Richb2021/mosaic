import test from 'node:test';
import assert from 'node:assert/strict';
import {LearningJournal,gameSaveKey} from '../src/game-modes/learning-client.js';
import {EXTENDED_PACKS} from '../src/game-modes/extended-packs.js';
import {newJourney,actJourney} from '../src/game-modes/journey-engine.js';
import {observeProgress,progressIdentity} from '../src/game-modes/learning-model.js';
const sports=EXTENDED_PACKS.find(p=>p.template==='sports-v1'),merge=EXTENDED_PACKS.find(p=>p.template==='merge-v1');
const RUNS='mosaic:practice-journal:v1';
function storage(t){const data=new Map(),old=globalThis.localStorage;globalThis.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};t.after(()=>globalThis.localStorage=old);return data;}
const record=(p,s,updated,version=1)=>({key:progressIdentity(p,'journey'),...observeProgress(p,'journey',s),updated,version,pending:true});
test('stale game tabs cannot replace newer entries belonging to another game',t=>{
 storage(t);const a=new LearningJournal(),b=new LearningJournal(),s0=newJourney(sports,1),s1=actJourney(sports,s0,{type:'formation',style:'balanced'});
 const initial=record(sports,s0,1);a.records=[initial];a.storeRecords();b.records=[structuredClone(initial)];
 a.records=[record(sports,s1,2)];a.storeRecords();b.records.unshift(record(merge,newJourney(merge,2),3));b.storeRecords();
 const read=new LearningJournal();assert.equal(read.records.length,2);assert.deepEqual(read.records.find(r=>r.key===initial.key).snapshot,s1);
 a.records[0].version=2;a.records[0].pending=false;a.storeRecords();assert.equal(new LearningJournal().records.length,2);
});
test('device progress ahead of a stale journal is preserved before cloud restoration',async t=>{
 storage(t);const j=new LearningJournal();j.user={id:'alice'};j.loadLocal();const old=newJourney(sports,1),device=actJourney(sports,old,{type:'formation',style:'balanced'}),r=record(sports,old,1);r.pending=false;j.records=[r];j.storeRecords();
 j.storage.setItem(gameSaveKey(sports,'journey'),JSON.stringify(device));j.request=async(path,body)=>{assert.equal(body,undefined);return {save:r}};
 await j.prepare(sports,'journey');assert.deepEqual(JSON.parse(j.storage.getItem(gameSaveKey(sports,'journey'))),device);assert.equal(j.records[0].conflict,true);assert.equal(j.records[0].pending,true);assert.deepEqual(j.records[0].snapshot,device);
 await j.resolveSave(sports,'journey',true);assert.deepEqual(JSON.parse(j.storage.getItem(gameSaveKey(sports,'journey'))),old);assert.deepEqual(JSON.parse(j.storage.getItem(gameSaveKey(sports,'journey')+':previous')),device);assert.equal(j.records[0].pending,false);
});
test('unreadable shared journal is preserved instead of overwritten by another tab',t=>{
 const data=storage(t),j=new LearningJournal();data.set(RUNS,'broken');j.records=[record(sports,newJourney(sports,1),1)];j.storeRecords();assert.equal(data.get(RUNS),'broken');assert.match(j.notice,/preserved/);
});
test('one invalid journal row is backed up while valid progress continues saving',t=>{
 const data=storage(t),old=record(sports,newJourney(sports,1),1);data.set(RUNS,JSON.stringify([old,{broken:true}]));const j=new LearningJournal();
 j.records=[record(sports,actJourney(sports,old.snapshot,{type:'formation',style:'balanced'}),2)];j.storeRecords();
 assert.equal(JSON.parse(data.get(RUNS)).length,1);assert.equal(JSON.parse(data.get(RUNS))[0].updated,2);assert.equal(JSON.parse(data.get(RUNS+':recovery')).length,2);
});
test('a corrupt device save is backed up before valid cloud progress is restored',async t=>{
 storage(t);const j=new LearningJournal();j.user={id:'alice'};j.loadLocal();const r=record(sports,newJourney(sports,1),1);j.storage.setItem(gameSaveKey(sports,'journey'),'{broken');j.request=async()=>({save:r});
 await j.prepare(sports,'journey');assert.deepEqual(JSON.parse(j.storage.getItem(gameSaveKey(sports,'journey'))),r.snapshot);assert.equal(j.storage.getItem(gameSaveKey(sports,'journey')+':recovery'),'{broken');
});
test('an explicit cloud choice survives a stale tab writing another game',async t=>{
 storage(t);const a=new LearningJournal(),b=new LearningJournal();a.user=b.user={id:'alice'};a.loadLocal();b.loadLocal();
 const cloud=record(sports,newJourney(sports,1),1,3),device=record(sports,actJourney(sports,cloud.snapshot,{type:'formation',style:'balanced'}),Date.now(),0);device.conflict=true;
 a.records=[device];a.storeRecords();b.records=[structuredClone(device)];a.request=async()=>({save:cloud});await a.resolveSave(sports,'journey',true);
 b.records.unshift(record(merge,newJourney(merge,2),Date.now()+1));b.storeRecords();const result=JSON.parse(a.storage.getItem(RUNS)).find(r=>r.key===cloud.key);
 assert.equal(result.version,3);assert.equal(result.pending,false);assert.deepEqual(result.snapshot,cloud.snapshot);assert.equal(b.records.length,2);
});
test('partial retention preserves newer device progress without silently restoring deleted cloud records',async t=>{
 storage(t);const j=new LearningJournal();j.user={id:'retention-user'};j.loadLocal();const old=newJourney(sports,1),device=actJourney(sports,old,{type:'formation',style:'balanced'});j.records=[record(sports,old,1)];j.storeRecords();j.storage.setItem(gameSaveKey(sports,'journey'),JSON.stringify(device));j.applyDataReset(Date.now(),'expired');let posts=0;
 j.request=async(path,body)=>{if(body){posts++;return {save:{version:1}}}return {save:null}};
 await j.prepare(sports,'journey');assert.equal(posts,0);assert.equal(j.records[0].conflict,true);assert.deepEqual(j.records[0].snapshot,device);assert.deepEqual(JSON.parse(j.storage.getItem(gameSaveKey(sports,'journey'))),device);
 await j.resolveSave(sports,'journey',false);assert.equal(posts,1);assert.equal(j.records[0].conflict,false);
});
