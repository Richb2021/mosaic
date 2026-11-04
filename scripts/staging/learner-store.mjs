// Staging stand-in for the NCB learner store (server/ncb-store.js): the same methods and
// version rules, backed by one private SQLite file. Like NCB after pruning, it keeps the
// latest version of each slot. Staging never talks to NCB.
import {DatabaseSync} from 'node:sqlite';
import {StoreError} from '../../server/ncb-store.js';
const TABLES=new Set(['learner_profiles','learner_saves']);
export class StagingLearnerStore{
 constructor(file){
  this.db=new DatabaseSync(file);
  this.db.exec('PRAGMA journal_mode=WAL;PRAGMA busy_timeout=5000;CREATE TABLE IF NOT EXISTS learner_rows(id TEXT PRIMARY KEY,tbl TEXT NOT NULL,owner_key TEXT NOT NULL,slot_key TEXT NOT NULL,version INTEGER NOT NULL,payload TEXT NOT NULL,updated_ms INTEGER NOT NULL,UNIQUE(tbl,owner_key,slot_key))');
 }
 check(t){if(!TABLES.has(t))throw new StoreError('Invalid storage table.',400)}
 out(r){return r?{id:r.id,owner_key:r.owner_key,slot_key:r.slot_key,version:Number(r.version),payload:r.payload,updated_ms:Number(r.updated_ms)}:null}
 async latest(t,o,s,min){this.check(t);const r=this.db.prepare('SELECT * FROM learner_rows WHERE tbl=? AND owner_key=? AND slot_key=?').get(t,o,s);return r&&(min===undefined||r.version>=min)?this.out(r):null}
 async confirm(t,o,s,v){return this.latest(t,o,s,v)}
 async list(o){return (await this.allRows('learner_saves',o)).slice(0,100)}
 async allRows(t,o){this.check(t);return this.db.prepare('SELECT * FROM learner_rows WHERE tbl=? AND owner_key=? ORDER BY id').all(t,o).map(r=>this.out(r))}
 async deleteRows(t,o,ids){this.check(t);for(const id of ids)this.db.prepare('DELETE FROM learner_rows WHERE tbl=? AND owner_key=? AND id=?').run(t,o,id)}
 async write(t,o,s,expected,payload,now=Date.now()){
  this.check(t);const serialized=JSON.stringify(payload),current=await this.latest(t,o,s);
  if(current&&current.version===expected+1&&current.payload===serialized)return current;
  if((current?.version||0)!==expected)throw new StoreError('A newer cloud save exists. Choose which version to continue in your learning journal.',409);
  const row={id:crypto.randomUUID(),owner_key:o,slot_key:s,version:expected+1,payload:serialized,updated_ms:now};
  const r=this.db.prepare('INSERT INTO learner_rows(id,tbl,owner_key,slot_key,version,payload,updated_ms) VALUES(?,?,?,?,?,?,?) ON CONFLICT(tbl,owner_key,slot_key) DO UPDATE SET id=excluded.id,version=excluded.version,payload=excluded.payload,updated_ms=excluded.updated_ms WHERE learner_rows.version=?').run(row.id,t,o,s,row.version,row.payload,now,expected);
  if(Number(r.changes)!==1)throw new StoreError('Another tab saved first. Your device save is preserved.',409);
  return row;
 }
 close(){this.db.close()}
}
