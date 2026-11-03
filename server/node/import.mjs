import {mkdir,rename,rm,access} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {SQLStore,ObjectStore} from './storage.mjs';
import {RECOVERY_TABLES} from '../recovery-operations.js';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const need=(ok,message)=>{if(!ok)throw Error(message);};

// Imports only a verified operator export into a NEW private directory. Schema
// comes from our reviewed migrations, never SQL contained in the export.
export async function importRecovery(bundle,{target,migrations}) {
  const destination=resolve(target),stage=destination+'.import-'+randomUUID();
  let DB,BUCKET;
  try {
    try{await access(destination);throw Error('Import target already exists');}catch(error){if(error.code!=='ENOENT')throw error;}
    const {snapshot,objects}=bundle;
    need(snapshot?.schemaVersion===1&&objects&&typeof objects==='object','Invalid recovery bundle');
    need(canonical(Object.keys(snapshot.tables).sort())===canonical([...RECOVERY_TABLES].sort()),'Recovery table set differs');
    need(Array.isArray(snapshot.objects)&&snapshot.objects.length<=5000,'Invalid object inventory');
    need(snapshot.tables.data_controls.every(r=>!r.operation),'Deletion was in flight');
    need(snapshot.tables.data_leases.every(r=>r.expires<=snapshot.at),'Mutation was in flight');
    need(new Set(snapshot.objects.map(o=>o.key)).size===snapshot.objects.length,'Duplicate object');
    need(canonical(Object.keys(objects).sort())===canonical(snapshot.objects.map(o=>o.key).sort()),'Object inventory differs');
    need(snapshot.objects.reduce((sum,o)=>sum+o.size,0)<=256*1024*1024,'Bundle byte limit exceeded');
    await mkdir(dirname(destination),{recursive:true,mode:0o700});await mkdir(stage,{mode:0o700});
    DB=new SQLStore(resolve(stage,'application.sqlite'),{migrations});BUCKET=new ObjectStore(resolve(stage,'objects.sqlite'));
    const report={tables:{},objects:[],databaseIntegrity:'pending'};
    DB.db.exec('BEGIN IMMEDIATE');
    try {
      for(const table of RECOVERY_TABLES) {
        const columns=DB.db.prepare(`PRAGMA table_info("${table}")`).all().map(c=>c.name),rows=snapshot.tables[table];
        need(Array.isArray(rows)&&rows.length<=10000,'Table row limit exceeded');
        const insert=DB.db.prepare(`INSERT INTO "${table}" (${columns.map(c=>'"'+c+'"').join(',')}) VALUES (${columns.map(()=>'?').join(',')})`);
        for(const row of rows){need(canonical(Object.keys(row).sort())===canonical([...columns].sort()),'Recovery columns differ: '+table);insert.run(...columns.map(c=>row[c]));}
        const restored=DB.db.prepare(`SELECT * FROM "${table}" ORDER BY 1`).all();
        need(canonical(restored)===canonical(rows),'Table verification failed: '+table);
        report.tables[table]={rows:rows.length,sha256:hash(canonical(restored))};
      }
      DB.db.exec('COMMIT');
    }catch(error){DB.db.exec('ROLLBACK');throw error;}
    for(const object of snapshot.objects){
      need(/^(narration|rendered|sources)\/[a-zA-Z0-9._/-]+$/.test(object.key)&&!object.key.includes('..'),'Invalid recovery key');
      need(Number.isSafeInteger(object.size)&&object.size>=0&&object.size<=64*1024*1024,'Invalid object size');
      need(typeof objects[object.key]==='string','Invalid object bytes');
      const bytes=Buffer.from(objects[object.key],'base64');need(bytes.length===object.size&&bytes.toString('base64')===objects[object.key],'Object bytes differ');
      await BUCKET.put(object.key,bytes);
      // Preserve inventory identity so the next backup can reconcile exactly.
      const uploaded=Date.parse(object.uploaded);need(Number.isFinite(uploaded)&&typeof object.etag==='string','Invalid object metadata');
      BUCKET.db.prepare('UPDATE objects SET etag=?,uploaded=? WHERE key=?').run(object.etag,uploaded,object.key);
      const actual=new Uint8Array(await (await BUCKET.get(object.key)).arrayBuffer());need(hash(bytes)===hash(actual),'Stored byte hash differs');
      report.objects.push({keyHash:hash(object.key),bytes:bytes.length,sha256:hash(bytes)});
    }
    need(DB.db.prepare('PRAGMA integrity_check').get().integrity_check==='ok','Database integrity failed');report.databaseIntegrity='ok';
    DB.close();DB=null;BUCKET.close();BUCKET=null;
    await rename(stage,destination);return report;
  }catch(error){DB?.close();BUCKET?.close();await rm(stage,{recursive:true,force:true});throw error;}
}
