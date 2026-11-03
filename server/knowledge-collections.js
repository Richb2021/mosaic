import {memberBinding} from './course-grants.js';
import {sqlDB,parse,need,auditEvent} from './data-control.js';
import {readJSON,noStore} from './ncb-auth.js';
import {admission} from './pilot-access.js';
import {digest,safeId} from './content-service.js';
const prefix='knowledge-collection:';
const validId=id=>typeof id==='string'&&/^[a-f0-9-]{36}$/.test(id);
async function member(env,id){return parse((await sqlDB(env.DB).one('SELECT policy FROM data_controls WHERE scope=?','pilot-member:'+id))?.policy)}
async function allowed(env,c,principal){
 const author=await admission(env,c.curator);if(!author.admitted||c.curatorBinding!==(await memberBinding(env,c.curator)).key)return false;
 if(c.curator===principal)return true;
 const a=await admission(env,principal),m=await member(env,principal);
 return a.admitted&&c.readerBindings?.[principal]===(await memberBinding(env,principal)).key&&c.readers.includes(principal)&&m.manager===c.curator&&['administrator','teacher','guardian'].includes(author.role);
}
export async function collectionsAPI(req,env,{owner,principal,siteOwner,access,now=()=>Date.now()}){
 const db=sqlDB(env.DB),input=req.method==='GET'?Object.fromEntries(new URL(req.url).searchParams):await readJSON(req,16000),isAuthor=env.PILOT_ENABLED!=='true'||access.canAuthor&&access.ageBand==='18plus';
 const load=async id=>{need(validId(id),'Choose a saved collection.');const row=await db.one('SELECT * FROM data_controls WHERE scope=?',prefix+id),c=parse(row?.policy);need(row&&!c.deleted&&await allowed(env,c,principal),'Collection unavailable.',404);return {row,c}};
 if(req.method==='GET'){
  if(input.id){const {c}=await load(input.id);const rows=[];for(const ref of c.sources){const r=await db.one('SELECT id,title,checksum,status,created,payload FROM workshop_resources WHERE id=? AND owner=?',ref.id,c.siteOwner);rows.push(r&&r.checksum===ref.checksum&&r.status==='reviewed'?{id:r.id,title:r.title,checksum:r.checksum,available:true,...(input.sourceId===r.id?{units:parse(r.payload).units}:{})}:{id:ref.id,title:ref.title,available:false})}
   const latest=await load(input.id);need(latest.c.revision===c.revision,'Collection changed while opening. Reload its current version.',409);
   return noStore({collection:{...c,canEdit:c.curator===principal,readers:c.curator===principal?c.readers:undefined,siteOwner:undefined,curator:undefined,readerBindings:undefined,curatorBinding:undefined,sources:rows}});
  }
  const rows=await db.all("SELECT scope,policy FROM data_controls WHERE scope LIKE 'knowledge-collection:%' AND (json_extract(policy,'$.curator')=? OR EXISTS(SELECT 1 FROM json_each(json_extract(policy,'$.readers')) WHERE value=?)) ORDER BY updated DESC LIMIT 80",principal,principal),collections=[];
  for(const row of rows){const c=parse(row.policy);if(!c.deleted&&await allowed(env,c,principal))collections.push({id:c.id,title:c.title,description:c.description,revision:c.revision,count:c.sources.length,canEdit:c.curator===principal})}
  return noStore({collections,canCreate:isAuthor});
 }
 need(isAuthor,'Your organiser curates shared source collections.',403);need(req.method==='POST','Collection route not found.',404);
 let prior=null;if(input.id){const loaded=await load(input.id);need(loaded.c.curator===principal&&loaded.c.siteOwner===siteOwner,'Only this collection’s curator can change it.',403);prior=loaded;need(input.revision===prior.c.revision,'Collection changed on another device. Reload before saving.',409)}
 if(input.action==='delete'){need(prior,'Choose a collection to remove.');const r=await db.run('DELETE FROM data_controls WHERE scope=? AND policy=?',prior.row.scope,prior.row.policy);need(r.meta.changes===1,'Collection changed. Reload before removing it.',409);return noStore({deleted:true})}
 need(input.action==='save'&&typeof input.title==='string'&&input.title.trim().length>0&&input.title.length<=160&&typeof input.description==='string'&&input.description.length<=1000,'Give the collection a title and a short description.');
 need(Array.isArray(input.sources)&&input.sources.length<=50&&new Set(input.sources.map(r=>r.id)).size===input.sources.length,'Choose up to 50 different reviewed sources.');
 need(Array.isArray(input.readers)&&input.readers.length<=20&&new Set(input.readers).size===input.readers.length&&input.readers.every(r=>/^[a-f0-9]{64}$/.test(r)),'Choose up to twenty existing group members.');
 need(!input.readers.length||input.sharingConfirmed===true,'Confirm permission to share these exact sources with the selected group members.');
 const sources=[];for(const ref of input.sources){need(safeId(ref.id),'Choose a saved source.');const r=await db.one('SELECT id,title,checksum,status FROM workshop_resources WHERE id=? AND owner=?',ref.id,siteOwner);need(r?.status==='reviewed'&&r.checksum===ref.checksum,'A selected source changed or needs review.',409);sources.push({id:r.id,title:r.title,checksum:r.checksum})}
 for(const id of input.readers){const a=await admission(env,id),m=await member(env,id);need(['administrator','teacher','guardian'].includes(access.role)&&a.admitted&&m.manager===principal,'Share only with active members of your existing learning group.',403)}
 const readerBindings={};for(const id of input.readers)readerBindings[id]=(await memberBinding(env,id)).key;
 const id=prior?.c.id||crypto.randomUUID(),c={id,curator:principal,curatorBinding:(await memberBinding(env,principal)).key,readerBindings,siteOwner,title:input.title.trim(),description:input.description.trim(),sources,readers:input.readers,revision:crypto.randomUUID(),updated:now()},scope=prefix+id;
 const r=prior?await db.run('UPDATE data_controls SET policy=?,updated=? WHERE scope=? AND policy=?',JSON.stringify(c),now(),scope,prior.row.policy):await db.run("INSERT OR IGNORE INTO data_controls(scope,policy,updated) SELECT ?,?,? WHERE (SELECT COUNT(*) FROM data_controls WHERE scope LIKE 'knowledge-collection:%' AND json_extract(policy,'$.curator')=?)<24",scope,JSON.stringify(c),now(),principal);need(r.meta.changes===1,'The collection changed or you already have 24 collections. Reload before saving.',409);
 await auditEvent(env,'learner:'+owner,'collection-saved',{sources:sources.length,readers:c.readers.length},now());return noStore({id,revision:c.revision});
}
