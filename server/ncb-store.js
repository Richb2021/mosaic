// Database API and filter contract: docs/ncb/swagger.json. Never accepts client paths.
const TABLES=new Set(['learner_profiles','learner_saves']);
export class StoreError extends Error{constructor(message,status=503){super(message);this.status=status}}
export class NCBStore{
 constructor(env,fetcher=fetch){this.env=env;this.fetcher=fetcher;}
 async request(table,action,params={},payload){
  if(!TABLES.has(table))throw new StoreError('Invalid storage table.',400);
  if(!this.env.NCB_INSTANCE||!this.env.NCB_SECRET_KEY)throw new StoreError('Cloud progress is not connected.');
  const url=new URL('https://eu-api.nocodebackend.com/'+action+'/'+table);url.searchParams.set('Instance',this.env.NCB_INSTANCE);
  for(const [k,v] of Object.entries(params))url.searchParams.set(k,String(v));
  const res=await this.fetcher(url,{method:action==='read'?'GET':(action.startsWith('delete/')||action==='bulk/delete')?'DELETE':'POST',headers:{Authorization:'Bearer '+this.env.NCB_SECRET_KEY,'Content-Type':'application/json','Cache-Control':'no-cache, no-store'},body:payload?JSON.stringify(payload):undefined,signal:AbortSignal.timeout(12000),cache:'no-store'});
  const data=await res.json().catch(()=>null);if(!res.ok||data?.status!=='success')throw new StoreError('Cloud progress could not be saved. Your device save is safe.');return data;
 }
 async rows(table,owner,extra={}){const d=await this.request(table,'read',{owner_key:owner,...extra});if(!Array.isArray(d.data)||d.data.some(r=>r.owner_key!==owner))throw new StoreError('Cloud progress could not be verified.');return d;}
 async latest(table,owner,slot){const d=await this.rows(table,owner,{slot_key:slot,sort:'version',order:'desc',limit:1});const row=d.data[0];if(row&&row.slot_key!==slot)throw new StoreError('Cloud progress could not be verified.');return row||null;}
 async confirm(table,owner,slot,version){
  // NCB's read endpoint can briefly lag a successful insert. Never mistake an
  // older read for a competing writer, and never resubmit the insert to poll.
  let current;for(const delay of [0,150,400,900,1800,3000]){if(delay)await new Promise(r=>setTimeout(r,delay));current=await this.latest(table,owner,slot);if(current&&current.version>=version)return current;}return current;
 }
 async list(owner){const heads=new Map();for(let page=1;page<=20;page++){
  const d=await this.rows('learner_saves',owner,{page,limit:50,sort:'id',order:'desc'});
  for(const row of d.data){if((heads.size<100&&!heads.has(row.slot_key))||(heads.has(row.slot_key)&&heads.get(row.slot_key).version<row.version))heads.set(row.slot_key,row);}
  if(d.metadata?.hasMore===false||d.metadata?.hasMore===undefined&&d.data.length<50)return [...heads.values()];
 }throw new StoreError('The cloud journal needs maintenance before it can be loaded.');}
 async allRows(table,owner){
  const rows=[];for(let page=1;page<=200;page++){const d=await this.rows(table,owner,{page,limit:50,sort:'id',order:'asc'});rows.push(...d.data);if(d.metadata?.hasMore===false||d.metadata?.hasMore===undefined&&d.data.length<50)return rows;}
  throw new StoreError('This export is too large for one request. No records were removed.',413);
 }
 async deleteRows(table,owner,ids){
  if(!ids.length)return;
  const current=await this.allRows(table,owner),wanted=new Set(ids),owned=current.filter(r=>wanted.has(r.id));
  for(let start=0;start<owned.length;start+=500)await this.request(table,'bulk/delete',{}, {ids:owned.slice(start,start+500).map(r=>r.id)});
  for(const delay of [0,200,500,1000,2000]){if(delay)await new Promise(r=>setTimeout(r,delay));const after=await this.allRows(table,owner);if(!after.some(r=>wanted.has(r.id)))return;}
  throw new StoreError('Deletion was submitted, but confirmation is delayed. Resume cleanup to verify it. No duplicate content was created.');
 }
 async write(table,owner,slot,expected,payload,now=Date.now()){
  const latest=await this.latest(table,owner,slot),serialized=JSON.stringify(payload);
  // Recover a successful write whose acknowledgement was lost.
  if(latest&&latest.version===expected+1&&latest.payload===serialized)return latest;
  if((latest?.version||0)!==expected)throw new StoreError('A newer cloud save exists. Choose which version to continue in your learning journal.',409);
  const row={owner_key:owner,slot_key:slot,version:expected+1,payload:serialized,updated_ms:now};
  try{await this.request(table,'create',{},row)}catch(error){const current=await this.confirm(table,owner,slot,row.version);if(current?.version===row.version&&current.payload===serialized)return current;if(current&&current.version>expected)throw new StoreError('Another tab saved first. Both versions are preserved; choose one in your learning journal.',409);throw error;}
  const confirmed=await this.confirm(table,owner,slot,row.version);
  if(!confirmed||confirmed.version<row.version)throw new StoreError('The save was submitted, but confirmation is delayed. Your device save is safe; retry sync to check it.');
  if(confirmed.version!==row.version||confirmed.payload!==serialized)throw new StoreError('Another tab saved first. Your device save is preserved.',409);
  // Best-effort pruning only older versions of this exact owner and slot.
  // The maximum version always wins, even if a stale request arrives after pruning.
  try{const old=await this.rows(table,owner,{slot_key:slot,'version[lt]':row.version,limit:50});for(const r of old.data){if(r.slot_key!==slot||r.version>=row.version)continue;const url=new URL(`https://eu-api.nocodebackend.com/delete/${table}/${r.id}`);url.searchParams.set('Instance',this.env.NCB_INSTANCE);await this.fetcher(url,{method:'DELETE',headers:{Authorization:'Bearer '+this.env.NCB_SECRET_KEY},signal:AbortSignal.timeout(5000)});}}catch{}
  return confirmed;
 }
}
