import test from 'node:test';
import assert from 'node:assert/strict';
import {programmeCycles,cycleLocation,requestedCycle,cycleGameLocation,gameReturnLocation,modeGameLocation} from '../src/studio/cycle-navigation.js';
const unit={packId:'chapter',contentHash:'revision-a',activityKeys:['sequence']},hash='a'.repeat(64);
const cycle=(id,extra={})=>({bankId:id,bankHash:hash,packId:unit.packId,contentHash:unit.contentHash,activityKey:'sequence',updated:100,attempts:0,stage:'diagnostic',...extra});
test('reviewed cycle routing chooses due, unfinished, fresh and waiting work without crossing content or focus',()=>{
 const rows=[cycle('waiting',{stage:'revisit',waiting:true,attempts:3}),cycle('wrong-revision',{contentHash:'revision-b'}),cycle('wrong-focus',{activityKey:'repair'}),cycle('fresh'),cycle('active',{stage:'practice',attempts:1}),cycle('due-later',{stage:'revisit',attempts:3,dueAt:20}),cycle('due-first',{stage:'revisit',attempts:3,dueAt:10}),cycle('complete',{stage:'complete',attempts:4})];
 assert.deepEqual(programmeCycles(rows,unit).map(c=>c.bankId),['due-first','due-later','active','fresh','waiting','complete']);
 assert.equal(rows[0].bankId,'waiting');assert.deepEqual(programmeCycles(rows,null),[]);
});
test('question→game→question links retain exact versions and permit only local learning destinations',()=>{
 const url=cycleGameLocation('/modes.html?job=job-one','creative-one',hash,unit),parsed=new URL(url,'https://test');assert.equal(parsed.searchParams.get('job'),'job-one');
 const back=gameReturnLocation(parsed.search,unit);assert.equal(gameReturnLocation(parsed.search,{...unit,packId:'another-chapter'}),null);assert.equal(gameReturnLocation(parsed.search,{...unit,contentHash:'different'}),null);assert.equal(back,cycleLocation('creative-one',hash));assert.deepEqual(requestedCycle(new URL(back,'https://test').search),{id:'creative-one',hash});
 assert.equal(cycleLocation('https://evil.example',hash),null);assert.equal(gameReturnLocation('?returnCycle=javascript:alert(1)&returnHash='+hash),null);assert.equal(cycleLocation('creative-one','changed'),null);assert.deepEqual(requestedCycle('?cycle=creative-one'),{invalid:true});assert.equal(requestedCycle('?support=some-game'),null);
});

test('canonical game URLs survive reload with a bound return cycle and discard unrelated or stale routes',()=>{
 const initial=cycleGameLocation('/modes.html?job=job-one&unrelated=value','creative-one',hash,unit);
 const url=modeGameLocation(new URL(initial,'https://test').search,unit,true),parsed=new URL(url,'https://test');
 assert.equal(parsed.searchParams.get('game'),unit.packId);assert.equal(parsed.searchParams.get('classic'),'1');assert.equal(parsed.searchParams.has('job'),false);assert.equal(parsed.searchParams.has('unrelated'),false);
 assert.equal(gameReturnLocation(parsed.search,unit),cycleLocation('creative-one',hash));
 assert.equal(modeGameLocation(parsed.search,unit,true),url);
 assert.equal(modeGameLocation(parsed.search,{...unit,packId:'another-chapter'}),'/modes.html?game=another-chapter');
 assert.equal(modeGameLocation(parsed.search,{...unit,contentHash:'changed'}),'/modes.html?game=chapter');
 assert.equal(modeGameLocation('?returnCycle=bad&returnHash=invalid&returnPack=chapter&returnContent=revision-a',unit),'/modes.html?game=chapter');
});
