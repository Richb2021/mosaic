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
