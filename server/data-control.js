import {digest} from './content-service.js';
import {StoreError} from './ncb-store.js';

export const DAY=86400000;
export const need=(ok,message,status=400)=>{if(!ok)throw new StoreError(message,status)};
export const sqlDB=db=>({one:(sql,...v)=>db.prepare(sql).bind(...v).first(),all:async(sql,...v)=>(await db.prepare(sql).bind(...v).all()).results,run:(sql,...v)=>db.prepare(sql).bind(...v).run()});
export const parse=s=>JSON.parse(s||'{}');
export async function controlScopes(siteOwner,owner){return {workspace:'workspace:'+await digest(siteOwner),learner:'learner:'+owner};}
export async function readControls(env,siteOwner,owner,now=Date.now()){
 const db=sqlDB(env.DB),scopes=await controlScopes(siteOwner,owner),controls={};
 for(const [name,scope] of Object.entries(scopes)){await db.run('INSERT OR IGNORE INTO data_controls(scope,updated) VALUES(?,?)',scope,now);controls[name]=await db.one('SELECT * FROM data_controls WHERE scope=?',scope);}
 return {scopes,controls,epoch:controls.learner.epoch+':'+controls.workspace.epoch};
}
export async function auditEvent(env,scope,action,detail,now){
 const db=sqlDB(env.DB);await db.run('INSERT INTO data_events(id,scope,action,detail,created) VALUES(?,?,?,?,?)',crypto.randomUUID(),scope,action,JSON.stringify(detail),now);
 await db.run('DELETE FROM data_events WHERE scope=? AND created<?',scope,now-30*DAY);
}
// Mutation leases make a deletion wait for existing writes, then block stale tabs.
// Leases contain no content and expire after a crashed request.
export async function withDataGuard(req,env,{siteOwner,owner,now=()=>Date.now()},handler){
 if(!env.DB)return handler();siteOwner=siteOwner||'account-session:'+owner;
 const db=sqlDB(env.DB),state=await readControls(env,siteOwner,owner,now()),leases=[];
 need(!Object.values(state.controls).some(c=>c.operation),'A data cleanup needs to finish. Open Your data to resume it.',423);
 if(req.method!=='GET'){
  const supplied=req.headers.get('x-mosaic-data-epoch');need(supplied===state.epoch||!supplied&&state.epoch==='0:0','Your data changed in another window. Reload before saving; old data has not been restored.',409);
  try{for(const c of Object.values(state.controls)){
   const id=crypto.randomUUID(),r=await db.run('INSERT INTO data_leases(id,scope,expires) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM data_controls WHERE scope=? AND epoch=? AND operation IS NULL)',id,c.scope,now()+15*60*1000,c.scope,c.epoch);
   need(r.meta.changes===1,'Data is changing in another window. Reload before saving.',409);leases.push(id);
  }}catch(e){for(const id of leases)await db.run('DELETE FROM data_leases WHERE id=?',id);throw e;}
 }
 try{const response=await handler();const headers=new Headers(response.headers);headers.set('X-Mosaic-Data-Epoch',state.epoch);headers.set('X-Mosaic-Data-Reset',String(state.controls.learner.reset_ms));headers.set('X-Mosaic-Data-Reset-Kind',state.controls.learner.reset_kind);return new Response(response.body,{status:response.status,headers});}
 finally{for(const id of leases)await db.run('DELETE FROM data_leases WHERE id=?',id);}
}
