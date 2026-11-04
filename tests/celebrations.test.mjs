import test from 'node:test';
import assert from 'node:assert/strict';
import {newlyDone,completedUnits,nextCelebration,readSet,writeSet} from '../src/studio/celebrations.js';

const step=(unitId,id,done,optional=false)=>({id:unitId+':'+id,unitId,kind:'is-read',done,optional});

test('a new device animates nothing', () => {
  const steps=[step('a','read',true),step('a','practice',true)];
  assert.equal(newlyDone(steps,null).size,0);
  assert.equal(nextCelebration(steps,null),null);
});

test('only steps finished since the last visit drop in', () => {
  const steps=[step('a','read',true),step('a','practice',true),step('a','reflect',false)];
  assert.deepEqual([...newlyDone(steps,new Set(['a:read']))],['a:practice']);
});

test('a programme completes when every required step is done, optional steps aside', () => {
  const steps=[step('a','read',true),step('a','game',false,true),step('a','reflect',true),step('b','read',true),step('b','reflect',false)];
  assert.deepEqual(completedUnits(steps),['a']);
});

test('each completed programme is celebrated once', () => {
  const steps=[step('a','read',true),step('a','reflect',true)];
  assert.equal(nextCelebration(steps,new Set()),'a');
  assert.equal(nextCelebration(steps,new Set(['a'])),null);
});

test('memory is kept per account and survives a broken store', () => {
  const data=new Map(),store={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
  writeSet('tiles','user-1',new Set(['a:read']),store);
  assert.deepEqual([...readSet('tiles','user-1',store)],['a:read']);
  assert.equal(readSet('tiles','user-2',store),null);
  const broken={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}};
  assert.equal(readSet('tiles','user-1',broken),null);
  assert.doesNotThrow(()=>writeSet('tiles','user-1',new Set(),broken));
});

test('weekly steps count up within a week and restart the next Monday', async () => {
 const {weekSteps,addWeekSteps}=await import('../src/studio/celebrations.js');
 const data=new Map(),store={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
 const mon=Date.UTC(2026,10,2,9),fri=Date.UTC(2026,10,6,9),nextMon=Date.UTC(2026,10,9,9);
 addWeekSteps('u',2,mon,store);assert.equal(addWeekSteps('u',3,fri,store),5);
 assert.equal(weekSteps('u',nextMon,store),0);assert.equal(weekSteps('other',fri,store),0);
});
