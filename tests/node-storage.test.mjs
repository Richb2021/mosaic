import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {SQLStore,ObjectStore} from '../server/node/storage.mjs';
import {recoveryExport,RECOVERY_TABLES} from '../server/recovery-operations.js';
import {importRecovery} from '../server/node/import.mjs';
const migrations=new URL('../drizzle/',import.meta.url).pathname;

test('portable SQL persists migrations and rolls back a failed batch',async()=>{
 const root=await mkdtemp(join(tmpdir(),'mosaic-sql-'));let store;
 try {
  const file=join(root,'private','application.sqlite');store=new SQLStore(file,{migrations});
  await store.prepare('INSERT INTO data_controls(scope,policy,updated) VALUES(?,?,?)').bind('test','{}',1).run();
  await assert.rejects(store.batch([store.prepare('UPDATE data_controls SET updated=2 WHERE scope=?').bind('test'),store.prepare('INSERT INTO missing_table VALUES(1)')]));
  assert.equal((await store.prepare('SELECT updated FROM data_controls WHERE scope=?').bind('test').first()).updated,1);
  const snapshot=await store.batch([store.prepare('SELECT scope FROM data_controls WHERE scope=?').bind('test')]);assert.deepEqual(snapshot[0].results,[{scope:'test'}]);
  store.close();store=new SQLStore(file,{migrations});assert.equal(await store.prepare('SELECT updated FROM data_controls WHERE scope=?').bind('test').first('updated'),1);
  assert.equal((await stat(file)).mode&0o777,0o600);
 } finally {store?.close();await rm(root,{recursive:true,force:true});}
});

test('portable import verifies fixed tables and bytes, rejects corruption and never overwrites data',async()=>{
 const root=await mkdtemp(join(tmpdir(),'mosaic-import-')),DB=new SQLStore(':memory:',{migrations}),BUCKET=new ObjectStore(':memory:');
 try {
  await DB.prepare('INSERT INTO data_controls(scope,policy,updated) VALUES(?,?,?)').bind('test','{}',1).run();
  await BUCKET.put('narration/test.mp3',new Uint8Array([1,2,3]));
  const snapshot=await (await recoveryExport(new Request('https://mosaic.example/api/operations'),{DB,BUCKET})).json();
  const bundle={snapshot,objects:{'narration/test.mp3':'AQID'}},target=join(root,'accepted');
  // Exported SQL is never executed by the importer.
  snapshot.schema=[{sql:'DROP TABLE data_controls'}];
  const report=await importRecovery(bundle,{target,migrations});assert.equal(report.tables.data_controls.rows,1);assert.equal(report.objects[0].bytes,3);
  const restored=new SQLStore(join(target,'application.sqlite'));assert.equal(await restored.prepare('SELECT scope FROM data_controls').first('scope'),'test');restored.close();
  await assert.rejects(importRecovery(bundle,{target,migrations}),/already exists/);
  const bad=structuredClone(bundle);bad.objects['narration/test.mp3']='AQI=';
  await assert.rejects(importRecovery(bad,{target:join(root,'bad'),migrations}),/bytes differ/);
  await assert.rejects(stat(join(root,'bad')));
  const wrong=structuredClone(bundle);wrong.snapshot.tables.data_controls[0].injected=1;
  await assert.rejects(importRecovery(wrong,{target:join(root,'wrong'),migrations}),/columns differ/);
 }finally{DB.close();BUCKET.close();await rm(root,{recursive:true,force:true});}
});

test('private objects persist bytes, conditional writes, bound cursors and deletion',async()=>{
 const root=await mkdtemp(join(tmpdir(),'mosaic-objects-'));let store;
 try {
  const file=join(root,'objects.sqlite');store=new ObjectStore(file);
  const results=await Promise.all([store.put('sources/a/original',new Uint8Array([0,1,2]),{onlyIf:{etagDoesNotMatch:'*'}}),store.put('sources/a/original',new Uint8Array([9]),{onlyIf:{etagDoesNotMatch:'*'}})]);
  assert.equal(results.filter(Boolean).length,1);
  await store.put('sources/b/original',new Uint8Array([3]));await store.put('narration/a.mp3',new Uint8Array([4]));
  const page=await store.list({prefix:'sources/',limit:1});assert(page.truncated);assert.equal(page.objects[0].key,'sources/a/original');
  assert.equal((await store.list({prefix:'sources/',limit:1,cursor:page.cursor})).objects[0].key,'sources/b/original');
  await assert.rejects(store.list({prefix:'narration/',cursor:page.cursor}));await assert.rejects(store.get('../outside'));await assert.rejects(store.put('/absolute',new Uint8Array()));
  store.close();store=new ObjectStore(file);assert.deepEqual([...new Uint8Array(await (await store.get('sources/a/original')).arrayBuffer())],[0,1,2]);
  await store.delete('sources/a/original');assert.equal(await store.head('sources/a/original'),null);assert.equal((await store.list()).objects.length,2);
  assert.equal((await stat(file)).mode&0o777,0o600);
 } finally {store?.close();await rm(root,{recursive:true,force:true});}
});

test('existing recovery handler exports every application table and private byte inventory on portable stores',async()=>{
 const DB=new SQLStore(':memory:',{migrations}),BUCKET=new ObjectStore(':memory:');
 try {
  await BUCKET.put('narration/example.mp3',new Uint8Array([1,2,3]));
  const snapshot=await (await recoveryExport(new Request('https://mosaic.example/api/operations'),{DB,BUCKET},123)).json();
  assert.deepEqual(Object.keys(snapshot.tables),[...RECOVERY_TABLES]);assert.equal(snapshot.objects.length,1);assert.equal(snapshot.objects[0].size,3);
  const bytes=await recoveryExport(new Request('https://mosaic.example/api/operations?object=narration%2Fexample.mp3'),{DB,BUCKET});assert.deepEqual([...new Uint8Array(await bytes.arrayBuffer())],[1,2,3]);
 } finally {DB.close();BUCKET.close();}
});

test('private playback pulls bounded chunks and preserves every byte',async()=>{
 const store=new ObjectStore(':memory:');
 try {
  const bytes=Uint8Array.from({length:196631},(_,i)=>i%251);
  await store.put('recording',bytes);
  const item=await store.get('recording'),reader=item.body.getReader(),chunks=[];
  for(;;){const {done,value}=await reader.read();if(done)break;assert(value.byteLength<=65536);chunks.push(value);}
  assert.deepEqual(Buffer.concat(chunks),Buffer.from(bytes));
  assert.deepEqual(new Uint8Array(await item.arrayBuffer()),bytes);
  await store.put('empty',new Uint8Array());assert.equal((await (await store.get('empty')).arrayBuffer()).byteLength,0);
 } finally {store.close();}
});

test('deleting or replacing a recording interrupts a paused stream without mixing versions',async()=>{
 for(const change of ['delete','replace']){
  const store=new ObjectStore(':memory:');
  try {
   await store.put('recording',new Uint8Array(4*65536).fill(7));
   const reader=(await store.get('recording')).body.getReader();assert.equal((await reader.read()).value[0],7);
   if(change==='delete')await store.delete('recording');else await store.put('recording',new Uint8Array(4*65536).fill(9));
   await assert.rejects(async()=>{for(;;){const v=await reader.read();if(v.done)break;assert.equal(v.value[0],7);}},/changed during delivery/);
  } finally {store.close();}
 }
});
