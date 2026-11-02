import test from 'node:test';
import assert from 'node:assert/strict';
import {LearningJournal} from '../src/game-modes/learning-client.js';
import {progressIdentity} from '../src/game-modes/learning-model.js';
import {ADVENTURE_PACKS} from '../src/game-modes/adventure-content.js';
import {initialAdventureState,reduceAdventure} from '../src/game-modes/adventure-engine.js';

const pack=ADVENTURE_PACKS[0],kind='classic',key=progressIdentity(pack,kind);
function fixture(t){
 const old=globalThis.localStorage,data=new Map();globalThis.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const j=new LearningJournal();j.user={id:'save-test'};j.dataEpoch='0:0';j.connected=true;j.loadLocal();
 t.after(()=>{for(const timer of j.timers.values())clearTimeout(timer);globalThis.localStorage=old});return {j,data};
}
function finished(){let s=initialAdventureState(pack);for(const a of [{type:'hero',hero:'male'},{type:'travel',room:'woods'},{type:'collect'},{type:'travel',room:'workshop'},{type:'repair',item:'tool'},{type:'travel',room:'archive'},{type:'inspect'},...pack.sequence.solution.map(index=>({type:'plate',index})),{type:'sequence'},{type:'choice',id:pack.decision.choices[0].id}])s=reduceAdventure(pack,s,a).state;assert(s.completed);return s;}
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('a completed run bypasses debounce and shows account saved only after acknowledgement',async t=>{
 const {j}=fixture(t);let acknowledge,body;j.request=async(path,input)=>{body=input;return new Promise(resolve=>{acknowledge=resolve})};
 j.observe({pack,kind,record:finished()});await tick();assert(body.snapshot.completed);assert.equal(j.saveStatus(pack,kind).state,'saving');
 acknowledge({save:{version:1}});await j.flush(key);assert.equal(j.saveStatus(pack,kind).state,'saved');assert.equal(j.records[0].pending,false);
});
test('completion during an older upload drains serially at the acknowledged version',async t=>{
 const {j}=fixture(t),calls=[];let acknowledge,active=0,max=0;j.request=async(path,body)=>{calls.push(structuredClone(body));max=Math.max(max,++active);if(calls.length===1)await new Promise(resolve=>{acknowledge=resolve});active--;return {save:{version:calls.length}}};
 j.observe({pack,kind,record:initialAdventureState(pack)});const first=j.sync(key);await tick();j.observe({pack,kind,record:finished()});const drain=j.flush(key);acknowledge();await Promise.all([first,drain]);
 assert.equal(calls.length,2);assert.equal(max,1);assert.equal(calls[1].expectedVersion,1);assert(calls[1].snapshot.completed);assert.equal(j.saveStatus(pack,kind).state,'saved');
});
test('failed account save remains device-pending, retry works, conflicts are never auto-overwritten',async t=>{
 const {j}=fixture(t);let calls=0;j.request=async()=>{calls++;throw Error('Connection unavailable')};j.observe({pack,kind,record:initialAdventureState(pack)});await j.flush(key);
 assert.equal(calls,1);assert.equal(j.saveStatus(pack,kind).label,'Saved on device · not synced');
 j.request=async()=>({save:{version:1}});await j.flush(key);assert.equal(j.saveStatus(pack,kind).state,'saved');
 j.request=async()=>{calls++;throw Object.assign(Error('Another save is available'),{status:409})};j.observe({pack,kind,record:finished()});await j.flush(key);const before=calls;await j.flush(key);assert.equal(calls,before);assert.equal(j.saveStatus(pack,kind).state,'conflict');assert(j.records[0].snapshot.completed);
});
test('guest and blocked device storage never claim a confirmed account save',t=>{
 const {j}=fixture(t);j.user=null;j.loadLocal();j.observe({pack,kind,record:initialAdventureState(pack)});assert.equal(j.saveStatus(pack,kind).label,'Saved on this device');
 globalThis.localStorage.setItem=()=>{throw Error('quota')};j.observe({pack,kind,record:finished()});assert.notEqual(j.saveStatus(pack,kind).label,'Saved on this device');assert.match(j.saveStatus(pack,kind).detail,/Play on this device|Keep this tab open/);
});
test('late acknowledgement after an account or cleanup epoch change cannot mark the new state saved',async t=>{
 const {j}=fixture(t);let done;j.request=async()=>new Promise(resolve=>{done=resolve});j.observe({pack,kind,record:initialAdventureState(pack)});const pending=j.sync(key);await tick();j.dataEpoch='1:1';j.records=[];done({save:{version:8}});await pending;assert.equal(j.records.length,0);
 j.dataEpoch='0:0';j.observe({pack,kind,record:initialAdventureState(pack)});const second=j.sync(key);await tick();j.user={id:'other'};j.loadLocal();done({save:{version:9}});await second;assert.equal(j.records.length,0);
});
test('save requests retain identity headers and use keepalive only below the conservative body bound',async t=>{
 const {j}=fixture(t),old=globalThis.fetch,calls=[];globalThis.fetch=async(url,options)=>{calls.push(options);return Response.json({save:{version:1}})};t.after(()=>{globalThis.fetch=old});
 await j.request('save',{snapshot:{completed:true}});await j.request('save',{snapshot:'x'.repeat(61000)});await j.request('profile',{goal:'test'});
 assert.equal(calls[0].keepalive,true);assert.equal(calls[1].keepalive,false);assert.equal(calls[2].keepalive,false);assert.equal(calls[0].headers['X-Mosaic-Learner'],'save-test');assert.equal(calls[0].headers['X-Mosaic-Data-Epoch'],'0:0');assert.equal(calls[0].credentials,'include');
});

test('cleanup guards request reload without pretending there is a competing save or retrying stale data',async t=>{
 const {j}=fixture(t);let calls=0;j.request=async()=>{calls++;throw Object.assign(Error('Your data changed in another window.'),{status:409,code:'DATA_RELOAD_REQUIRED'})};
 j.observe({pack,kind,record:initialAdventureState(pack)});await j.flush(key);
 assert.equal(j.records[0].conflict,false);assert.equal(j.saveStatus(pack,kind).canReload,true);assert.equal(j.saveStatus(pack,kind).canReview,undefined);
 j.observe({pack,kind,record:finished()});await j.flush(key);assert.equal(calls,1);assert.equal(j.saveStatus(pack,kind).label,'Reload before saving');
 // A fresh read reconciles the policy/epoch before sending preserved progress.
 j.request=async(path)=>{calls++;if(path.startsWith('save?')){j.dataEpoch='1:0';return {save:null}}return {save:{version:1}}};
 await j.prepare(pack,kind);assert.equal(j.saveStatus(pack,kind).state,'saved');assert.equal(calls,3);
});

test('an epoch change during an older upload leaves an explicit recovery state for the newer snapshot',async t=>{
 const {j}=fixture(t);let done,calls=0;j.request=async()=>{calls++;return new Promise(resolve=>{done=resolve})};
 j.observe({pack,kind,record:initialAdventureState(pack)});const first=j.sync(key);await tick();j.dataEpoch='3:0';
 const moved=reduceAdventure(pack,initialAdventureState(pack),{type:'hero',hero:'male'}).state;j.observe({pack,kind,record:moved});const joined=j.sync(key);done({save:{version:4}});await Promise.all([first,joined]);
 assert.equal(calls,1);assert.equal(j.records[0].version,0);assert.equal(j.records[0].snapshot.hero,'male');assert(j.records[0].pending);assert.equal(j.saveStatus(pack,kind).canReload,true);await j.flush(key);assert.equal(calls,1);
});

test('request preserves the cleanup error code from the server',async t=>{
 const {j}=fixture(t),old=globalThis.fetch;globalThis.fetch=async()=>Response.json({error:'Reload before saving.',code:'DATA_RELOAD_REQUIRED'},{status:409});t.after(()=>{globalThis.fetch=old});
 await assert.rejects(j.request('save',{}),e=>e.status===409&&e.code==='DATA_RELOAD_REQUIRED');
});
