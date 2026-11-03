import test from 'node:test';import assert from 'node:assert/strict';import {evaluate} from '../evaluation/run.mjs';
test('frozen development evaluation checks retrieval, exact citations, absence and access boundaries',async()=>{const r=await evaluate();assert(r.total>=28);assert.equal(r.passed,r.total,JSON.stringify(r.results.filter(c=>!c.passed)));assert(r.recallAt8>=.9)});
