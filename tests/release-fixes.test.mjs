import test from 'node:test';
import assert from 'node:assert/strict';
import {repairLearningMap,validateLearningMap} from '../src/learning-map.js';
import {balanceNumberWarning} from '../src/chapter-content.js';
import {storyFit} from '../src/story-direction.js';

const pack={template:'quiz-v1',sources:[{id:'s1'},{id:'s2'}],questions:[{prompt:'A',sourceRefs:['s1']},{prompt:'B',sourceRefs:['s2']},{prompt:'C',sourceRefs:['s1','s2']}]};

test('AI learning maps are repaired instead of losing the whole chapter', () => {
 const broken=[
  {id:'concept-1',objective:'Producers',activityKeys:['question-0','question-1'],sourceRefs:['s1'],prerequisites:['concept-2']},
  {id:'concept-2',objective:'Habitats',activityKeys:['question-9'],sourceRefs:['nope'],prerequisites:['concept-1']},
  {id:'concept-3',objective:'Both',activityKeys:['question-2'],sourceRefs:['s2','zzz'],prerequisites:['concept-1','concept-3']},
 ];
 assert.throws(()=>validateLearningMap(broken,pack),'the strict check alone rejects it');
 const fixed=repairLearningMap(broken,pack);
 assert.deepEqual(fixed.map(n=>[n.id,n.activityKeys,n.sourceRefs,n.prerequisites]),[['concept-1',['question-0'],['s1'],[]],['concept-3',['question-2'],['s2'],['concept-1']]]);
 assert.ok(validateLearningMap(fixed,pack));
 const fallback=repairLearningMap([{id:'concept-1',objective:'x',activityKeys:['nothing'],sourceRefs:['s1'],prerequisites:[]}],pack);
 assert.equal(fallback.length,3,'one concept per activity when nothing survives');assert.ok(validateLearningMap(fallback,pack));
});

test('RPG balance puzzles whose explanation uses other numbers are flagged for review', () => {
 const c=b=>({template:'underlight-v1',challenges:{balance:{title:'Reservoir',total:12,solution:4,...b}}});
 assert.deepEqual(balanceNumberWarning(c({explanation:'Sending 7 units to the gardens leaves exactly 5 for homes.'})).odd,[7,5]);
 assert.equal(balanceNumberWarning(c({explanation:'4 to the gardens leaves 8 of the 12 for homes.'})),null);
});

test('story fit recognises related words for an interest', () => {
 assert.deepEqual(storyFit({title:'Captain Cascade',hook:'The hero swoops in, cape swirling, as the villain floods the city.'},{interest:'Superheroes & comics',style:'comic'}).weak,[]);
});

test('a podcast or cartoon with a chosen style survives being checked again after saving', async () => {
 const src=await (await import('node:fs/promises')).readFile(new URL('../src/studio/creative-content.js',import.meta.url),'utf8');
 assert.match(src,/'genre','interest','audience','style','premise'/);
});

test('open sign-up is off by default; when on, a verified adult joins as an independent learner (18+ only)', async () => {
 const {sharingFixture}=await import('./helpers/course-sharing.mjs');
 const h=await sharingFixture(),visitor={id:'visitor-1',email:'visitor@example.test',emailVerified:true,name:'Vera Visitor'};
 assert.equal((await h.call(visitor,'pilot',{action:'join-open'})).http,403,'off by default');
 h.env.PILOT_OPEN_SIGNUP='true';
 const status=await h.call(visitor,'pilot');assert.equal(status.openSignup,true);assert.equal(status.admitted,false);
 const joined=await h.call(visitor,'pilot',{action:'join-open'});assert.equal(joined.http,200,JSON.stringify(joined));
 assert.equal((await h.call(visitor,'pilot',{action:'join-open'})).http,409,'only once');
 const s=await h.call(visitor,'pilot');assert.equal(s.admitted,true);assert.equal(s.context,'individual');
 assert.notEqual((await h.call(visitor,'pilot',{action:'onboarding',ageBand:'13to17',confirmed:true,noticeVersion:s.noticeVersion,expectedVersion:s.version||0})).http,200,'under-18s cannot self-join');
 assert.equal((await h.call(visitor,'pilot',{action:'onboarding',ageBand:'18plus',confirmed:true,noticeVersion:s.noticeVersion,expectedVersion:s.version||0})).http,200);
 assert.equal((await h.call(visitor,'learning/classes')).http,200,'Studio works after joining');
 const unverified={id:'visitor-2',email:'v2@example.test',emailVerified:false,name:'Uma'};
 assert.equal((await h.call(unverified,'pilot',{action:'join-open'})).http,403,'email must be verified');
});
