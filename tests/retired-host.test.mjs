import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {retiredHost} from '../server/retired-host.js';

test('retired host is opt-in, fixed-origin and blocks every learner/writer route while allowing recovery reads',async()=>{
 assert.equal(retiredHost({}),null);
 const response=retiredHost({MOSAIC_MIGRATED_ORIGIN:'https://untrusted.example'});
 assert.equal(response.status,410);assert.equal(response.headers.get('Cache-Control'),'no-store');
 assert.equal((await response.json()).movedTo,'https://mosaic.richardbatt.com');
 for(const file of ['auth/[...path]','auth-providers','pilot','learning/[...path]','workshop/[...path]','maintenance','media-worker','ncb/account/[...path]']){
  const text=await readFile(new URL('../app/api/'+file+'/route.ts',import.meta.url),'utf8');assert.match(text,/retiredHost\(env\)/,file);
 }
 const operations=await readFile(new URL('../app/api/operations/route.ts',import.meta.url),'utf8');
 assert.match(operations,/function GET[^\n]+return operationsAPI/);assert.match(operations,/function POST[^\n]+retiredHost/);
});
