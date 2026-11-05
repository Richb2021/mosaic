import test from 'node:test';
import assert from 'node:assert/strict';
import {allowanceSummary,ALLOWANCE_HREF} from '../src/studio/allowance-summary.js';
const time=t=>'T'+t;
test('the Studio allowance line uses the combined generation estimate, never dollars',()=>{
 const s=allowanceSummary({configured:true,aboutGenerations:12,remainingUsd:2.4,resetsAt:100,generations:{limit:20,used:8,remaining:12}},time);
 assert.equal(s.text,'About 12 AI creations left today · resets T100');
 assert.equal(s.used,false);assert.doesNotMatch(s.text,/\$/);
 assert.equal(allowanceSummary({configured:true,aboutGenerations:1,resetsAt:5},time).text,'About 1 AI creation left today · resets T5');
 assert.equal(ALLOWANCE_HREF,'/welcome.html#allowance');
});
test('a used allowance says when more opens, preferring the rolling generation slot',()=>{
 assert.equal(allowanceSummary({configured:true,aboutGenerations:0,resetsAt:100,generations:{limit:20,used:20,remaining:0,nextAvailableAt:50}},time).text,'No AI creations left today · more from T50');
 const byCost=allowanceSummary({configured:true,aboutGenerations:0,resetsAt:100,generations:{limit:20,used:3,remaining:17,nextAvailableAt:null}},time);
 assert.equal(byCost.text,'No AI creations left today · more from T100');assert.equal(byCost.used,true);
});
test('the app-wide limit and missing estimates are handled plainly',()=>{
 assert.equal(allowanceSummary({configured:true,aboutGenerations:4,appLimitReached:true,resetsAt:9},time).text,'AI creation is paused for everyone today · resets T9');
 assert.equal(allowanceSummary({configured:true,aboutGenerations:null}),null);
 assert.equal(allowanceSummary({configured:false,notice:'x'}),null);
 assert.equal(allowanceSummary(null),null);
});
