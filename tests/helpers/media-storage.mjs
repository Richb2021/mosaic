import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
export class D1{
 constructor(){this.db=new DatabaseSync(':memory:');for(const f of readdirSync(new URL('../../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())this.db.exec(readFileSync(new URL('../../drizzle/'+f,import.meta.url),'utf8'));}
 prepare(sql){return {bind:(...v)=>({first:async()=>this.db.prepare(sql).get(...v)||null,all:async()=>({results:this.db.prepare(sql).all(...v)}),run:async()=>({meta:{changes:Number(this.db.prepare(sql).run(...v).changes)}})})}}
}
export class Bucket{
 objects=new Map();puts=0;failDelete=false;failPut=false;
 async put(key,bytes){if(this.failPut)throw Error('fixture put failure');this.objects.set(key,new Uint8Array(bytes));this.puts++;return {size:bytes.byteLength}}
 async get(key){const bytes=this.objects.get(key);return bytes?{body:new Blob([bytes]).stream(),size:bytes.byteLength}:null}
 async head(key){return this.objects.has(key)?{size:this.objects.get(key).byteLength}:null}
 async delete(key){if(this.failDelete)throw Error('fixture delete failure');this.objects.delete(key)}
}
