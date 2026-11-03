import {DatabaseSync} from 'node:sqlite';
import {mkdirSync, chmodSync, readFileSync, readdirSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {createHash} from 'node:crypto';

function openPrivateDatabase(file) {
  if (file !== ':memory:') mkdirSync(dirname(file), {recursive:true, mode:0o700});
  const db = new DatabaseSync(file);
  if (file !== ':memory:') chmodSync(file, 0o600);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  return db;
}

class Statement {
  constructor(store, sql, values=[]) { this.store=store; this.sql=sql; this.values=values; }
  bind(...values) { return new Statement(this.store, this.sql, values); }
  async first(column) {
    const row=this.store.db.prepare(this.sql).get(...this.values);
    return row ? (column ? row[column] : {...row}) : null;
  }
  async all() { return this.execute(); }
  execute() {
    const statement=this.store.db.prepare(this.sql);
    if (statement.columns().length) return {success:true, results:statement.all(...this.values).map(r=>({...r})), meta:{}};
    const result=statement.run(...this.values);
    return {success:true, results:[], meta:{changes:Number(result.changes), last_row_id:Number(result.lastInsertRowid)}};
  }
  async run() { return this.execute(); }
}

// Only the API subset actually used by Mosaic. The business handlers are shared
// with the existing host; they still own validation, access and lifecycle rules.
export class SQLStore {
  constructor(file, {migrations}={}) {
    this.db=openPrivateDatabase(file);
    if (migrations) {
      this.db.exec('CREATE TABLE IF NOT EXISTS mosaic_migrations (name TEXT PRIMARY KEY, sha256 TEXT NOT NULL)');
      for (const name of readdirSync(migrations).filter(f=>f.endsWith('.sql')).sort()) {
        const sql=readFileSync(join(migrations,name),'utf8'), sha256=createHash('sha256').update(sql).digest('hex');
        const prior=this.db.prepare('SELECT sha256 FROM mosaic_migrations WHERE name=?').get(name);
        if (prior) { if(prior.sha256!==sha256) throw Error('Applied migration changed: '+name); continue; }
        this.db.exec('BEGIN IMMEDIATE');
        try { this.db.exec(sql); this.db.prepare('INSERT INTO mosaic_migrations VALUES (?,?)').run(name,sha256); this.db.exec('COMMIT'); }
        catch(error) { this.db.exec('ROLLBACK'); throw error; }
      }
    }
  }
  prepare(sql) { return new Statement(this,sql); }
  async batch(statements) {
    if (!Array.isArray(statements)||statements.some(s=>!(s instanceof Statement)||s.store!==this)) throw Error('Statements must belong to this database');
    this.db.exec('BEGIN IMMEDIATE');
    try { const results=statements.map(s=>s.execute()); this.db.exec('COMMIT'); return results; }
    catch(error) { this.db.exec('ROLLBACK'); throw error; }
  }
  close() { this.db.close(); }
}

const validKey=key=>typeof key==='string'&&key.length>0&&key.length<=256&&/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(key)&&!key.includes('..')&&!key.includes('//');
const checkKey=key=>{if(!validKey(key))throw Error('Invalid object key');};
const metadata=row=>({key:row.key,size:row.size,etag:row.etag,uploaded:new Date(row.uploaded),httpMetadata:JSON.parse(row.http_metadata),customMetadata:JSON.parse(row.custom_metadata)});

// Private byte store in its own database. Each put is a single atomic operation;
// keys never become filesystem paths. Neither database belongs in public/.
export class ObjectStore {
  constructor(file) {
    this.db=openPrivateDatabase(file);
    this.db.exec('CREATE TABLE IF NOT EXISTS objects (key TEXT PRIMARY KEY, bytes BLOB NOT NULL, size INTEGER NOT NULL, etag TEXT NOT NULL, uploaded INTEGER NOT NULL, http_metadata TEXT NOT NULL, custom_metadata TEXT NOT NULL)');
  }
  async put(key, input, options={}) {
    checkKey(key);
    if (!(input instanceof Uint8Array)&&!(input instanceof ArrayBuffer)) throw Error('Expected bounded object bytes');
    const bytes=new Uint8Array(input), size=bytes.byteLength;
    if(size>64*1024*1024)throw Error('Object exceeds 64 MB');
    if(options.onlyIf&&options.onlyIf.etagDoesNotMatch!=='*')throw Error('Unsupported object precondition');
    const etag=createHash('sha256').update(bytes).digest('hex'), uploaded=Date.now();
    const sql=options.onlyIf?'INSERT OR IGNORE INTO objects VALUES (?,?,?,?,?,?,?)':'INSERT INTO objects VALUES (?,?,?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET bytes=excluded.bytes,size=excluded.size,etag=excluded.etag,uploaded=excluded.uploaded,http_metadata=excluded.http_metadata,custom_metadata=excluded.custom_metadata';
    const result=this.db.prepare(sql).run(key,bytes,size,etag,uploaded,JSON.stringify(options.httpMetadata||{}),JSON.stringify(options.customMetadata||{}));
    return result.changes ? this.head(key) : null;
  }
  async head(key) { checkKey(key); const row=this.db.prepare('SELECT key,size,etag,uploaded,http_metadata,custom_metadata FROM objects WHERE key=?').get(key); return row?metadata(row):null; }
  async get(key) { checkKey(key); const row=this.db.prepare('SELECT * FROM objects WHERE key=?').get(key); if(!row)return null; const blob=new Blob([row.bytes]); return {...metadata(row),body:blob.stream(),arrayBuffer:()=>blob.arrayBuffer()}; }
  async delete(key) { checkKey(key); this.db.prepare('DELETE FROM objects WHERE key=?').run(key); }
  async list({limit=1000,cursor,prefix=''}={}) {
    if(!Number.isInteger(limit)||limit<1||limit>1000||prefix&&!validKey(prefix))throw Error('Invalid object list bounds');
    let after='';
    if(cursor) { try { const c=JSON.parse(Buffer.from(cursor,'base64url').toString()); if(c.prefix!==prefix||!validKey(c.after))throw Error(); after=c.after; } catch { throw Error('Invalid object cursor'); } }
    const rows=this.db.prepare('SELECT key,size,etag,uploaded,http_metadata,custom_metadata FROM objects WHERE key>? AND substr(key,1,?)=? ORDER BY key LIMIT ?').all(after,prefix.length,prefix,limit+1);
    const truncated=rows.length>limit, objects=rows.slice(0,limit).map(metadata);
    return {objects,truncated,...(truncated?{cursor:Buffer.from(JSON.stringify({prefix,after:objects.at(-1).key})).toString('base64url')}:{})};
  }
  close() { this.db.close(); }
}
