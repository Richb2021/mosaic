// Classes: one teacher's group of learners, joined with a code.
// Learners choose what reaches the class: explanations they share and, when the
// teacher turns it on, a weekly leaderboard of steps taken. Nothing here is a grade.
// Withdrawal always wins: leaving or stopping sharing works even in archived classes
// and for learners whose access has been withdrawn (see learning-api.js).
import {readJSON,noStore} from './ncb-auth.js';
import {sqlDB,parse,need,DAY,auditEvent} from './data-control.js';
import {activeCourseGrant,grantChapters} from './course-grants.js';
import {readSharedReport} from './course-sharing-api.js';
import {digest} from './content-service.js';

export const classScope=id=>'class:'+id;
export const codeScope=code=>'class-code:'+code;
export const memberScope=(id,learner)=>'class-member:'+id+':'+learner;
export const boardScope=(id,learner)=>'class-board:'+id+':'+learner;
export const shareScope=(id,learner,key)=>'class-share:'+id+':'+learner+':'+key;
const joinLimitScope=learner=>'class-join-limit:'+learner;

const CODE_CHARS='ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const STICKERS=['star','lantern','lightbulb','heart','rocket'];
const STATUS_ORDER=['not-started','started','practised'];
const JOIN_FAILS=10,JOIN_WINDOW=3600000;
const idOk=id=>typeof id==='string'&&/^[a-f0-9]{16}$/.test(id);
const keyOk=k=>typeof k==='string'&&/^[A-Za-z0-9:_-]{1,80}$/.test(k);
const handleOk=h=>typeof h==='string'&&/^[a-f0-9]{32}$/.test(h);
// Weeks start on Monday, UTC.
export const weekOf=ms=>Math.floor((ms-4*DAY)/(7*DAY));
const text=(s,min,max,label)=>{need(typeof s==='string'&&s.trim().length>=min&&s.trim().length<=max,label);return s.trim().replace(/\s+/g,' ')};
const clean=(s,max)=>{need(typeof s==='string'&&s.trim().length>=1&&s.trim().length<=max,'Write a short response.');return s.trim()};
const nicknameOk=s=>typeof s==='string'&&/^[\p{L}\p{N} ._'-]{2,20}$/u.test(s.trim());
const displayLabel=u=>{const parts=String(u?.name||'').trim().split(/\s+/).filter(Boolean);return parts.length?(parts[0]+(parts[1]?' '+parts[1][0]+'.':'')).slice(0,40):'Learner'};
// Rejection sampling keeps every code character equally likely.
const randomCode=()=>{let out='';while(out.length<6){for(const b of crypto.getRandomValues(new Uint8Array(12))){if(b<248&&out.length<6)out+=CODE_CHARS[b%31]}}return out};
const randomId=()=>[...crypto.getRandomValues(new Uint8Array(8))].map(b=>b.toString(16).padStart(2,'0')).join('');
const upsert=(db,scope,value,now)=>db.run('INSERT INTO data_controls(scope,policy,updated) VALUES(?,?,?) ON CONFLICT(scope) DO UPDATE SET policy=excluded.policy,updated=excluded.updated',scope,JSON.stringify(value),now);
// Teachers see a per-class handle, never the learner's account reference.
const handleOf=async(classId,learner)=>(await digest('class-handle:'+classId+':'+learner)).slice(0,32);

async function loadClass(db,id){need(idOk(id),'Choose a class.');const row=await db.one('SELECT policy FROM data_controls WHERE scope=?',classScope(id));need(row,'Class not found.',404);return {c:parse(row.policy),raw:row.policy}}
async function saveClass(db,c,raw,now){const out=await db.run('UPDATE data_controls SET policy=?,updated=? WHERE scope=? AND policy=?',JSON.stringify(c),now,classScope(c.id),raw);need(out.meta.changes===1,'This class changed in another window. Reload and try again.',409)}
async function members(db,id){return (await db.all("SELECT policy FROM data_controls WHERE scope LIKE ? ORDER BY scope",'class-member:'+id+':%')).map(r=>parse(r.policy)).filter(m=>m.status==='active')}
async function newCode(db){for(let i=0;i<8;i++){const code=randomCode();if(!await db.one('SELECT 1 AS x FROM data_controls WHERE scope=?',codeScope(code)))return code}need(false,'Could not create a join code. Try again.',503)}
const publicClass=c=>({id:c.id,name:c.name,code:c.code,created:c.created,archived:!!c.archived,leaderboard:!!c.leaderboard});
async function removeLearnerRows(db,classId,learner){
 await db.run('DELETE FROM data_controls WHERE scope=?',memberScope(classId,learner));
 await db.run('DELETE FROM data_controls WHERE scope=?',boardScope(classId,learner));
 for(const r of await db.all("SELECT scope FROM data_controls WHERE scope LIKE ? AND json_extract(policy,'$.learner')=?",'class-share:'+classId+':%',learner))await db.run('DELETE FROM data_controls WHERE scope=?',r.scope);
}
async function removeClass(db,c){
 for(const r of await db.all("SELECT scope FROM data_controls WHERE (scope LIKE ? OR scope LIKE ? OR scope LIKE ?) OR (scope LIKE 'class-code:%' AND json_extract(policy,'$.classId')=?)",'class-member:'+c.id+':%','class-board:'+c.id+':%','class-share:'+c.id+':%',c.id))await db.run('DELETE FROM data_controls WHERE scope=?',r.scope);
 await db.run('DELETE FROM data_controls WHERE scope=?',classScope(c.id));
}

// Removes everything a learner contributed to classes, and classes a teacher owns.
export async function deleteClassData(env,principal){
 if(!env.DB)return;const db=sqlDB(env.DB);
 for(const r of await db.all("SELECT scope FROM data_controls WHERE (scope LIKE 'class-member:%' OR scope LIKE 'class-board:%' OR scope LIKE 'class-share:%') AND json_extract(policy,'$.learner')=?",principal))await db.run('DELETE FROM data_controls WHERE scope=?',r.scope);
 await db.run('DELETE FROM data_controls WHERE scope=?',joinLimitScope(principal));
 for(const r of await db.all("SELECT policy FROM data_controls WHERE scope LIKE 'class:%' AND json_extract(policy,'$.owner')=?",principal))await removeClass(db,parse(r.policy));
}
// When an organiser loses a learner (revoked or transferred), the learner leaves that organiser's classes.
export async function leaveClassesOf(env,learner,owner){
 if(!env.DB||!owner)return;const db=sqlDB(env.DB);
 for(const r of await db.all("SELECT policy FROM data_controls WHERE scope LIKE 'class:%' AND json_extract(policy,'$.owner')=?",owner))await removeLearnerRows(db,parse(r.policy).id,learner);
}
// The learner's own progress-retention window also applies to what they shared with classes.
export async function expireClassData(env,learner,days,now){
 if(!env.DB||!days)return;const db=sqlDB(env.DB),cutoff=now-days*DAY;
 for(const r of await db.all("SELECT scope FROM data_controls WHERE (scope LIKE 'class-share:%' OR scope LIKE 'class-board:%') AND json_extract(policy,'$.learner')=? AND updated<?",learner,cutoff))await db.run('DELETE FROM data_controls WHERE scope=?',r.scope);
}
export async function countClassRows(env,learner){
 if(!env.DB)return 0;return (await sqlDB(env.DB).one("SELECT COUNT(*) AS n FROM data_controls WHERE (scope LIKE 'class-member:%' OR scope LIKE 'class-board:%' OR scope LIKE 'class-share:%') AND json_extract(policy,'$.learner')=?",learner))?.n||0;
}
// A learner's own class data, for Your data › Export.
export async function exportClassData(env,learner){
 if(!env.DB)return {memberships:[],leaderboard:[],sharedExplanations:[],teaching:[]};
 const db=sqlDB(env.DB),rows=async pattern=>(await db.all("SELECT policy FROM data_controls WHERE scope LIKE ? AND json_extract(policy,'$.learner')=? ORDER BY scope",pattern,learner)).map(r=>parse(r.policy));
 const name=async id=>parse((await db.one('SELECT policy FROM data_controls WHERE scope=?',classScope(id)))?.policy).name||'Deleted class';
 const memberships=[];for(const m of await rows('class-member:%'))memberships.push({className:await name(m.classId),label:m.label,joined:m.joined});
 const leaderboard=[];for(const b of await rows('class-board:%'))leaderboard.push({className:await name(b.classId),nickname:b.nickname,week:b.week,steps:b.tiles});
 const sharedExplanations=[];for(const s of await rows('class-share:%'))sharedExplanations.push({className:await name(s.classId),title:s.title,text:s.text,shared:s.shared,feedback:s.feedback||null});
 const teaching=(await db.all("SELECT policy FROM data_controls WHERE scope LIKE 'class:%' AND json_extract(policy,'$.owner')=?",learner)).map(r=>{const c=parse(r.policy);return {name:c.name,created:c.created,archived:!!c.archived,leaderboard:!!c.leaderboard}});
 return {memberships,leaderboard,sharedExplanations,teaching};
}

async function leaderboard(db,c,now,me,all=false){
 if(!c.leaderboard)return {enabled:false,entries:[],you:null};
 const week=weekOf(now),active=new Set((await members(db,c.id)).map(m=>m.learner));
 const rows=(await db.all("SELECT policy FROM data_controls WHERE scope LIKE ?",'class-board:'+c.id+':%')).map(r=>parse(r.policy)).filter(b=>b.optIn&&active.has(b.learner));
 // Only steps reported this week are ranked. No report this week is "not reported", never zero.
 const ranked=rows.filter(b=>b.week===week).sort((a,b)=>b.tiles-a.tiles||a.updated-b.updated).map((b,i)=>({rank:i+1,nickname:b.nickname,tiles:b.tiles,you:b.learner===me}));
 const waiting=rows.filter(b=>b.week!==week).sort((a,b)=>a.nickname.localeCompare(b.nickname)).map(b=>({rank:null,nickname:b.nickname,tiles:null,you:b.learner===me}));
 const entries=[...ranked,...waiting];
 return {enabled:true,week,entries:all?entries:entries.slice(0,10),you:entries.find(e=>e.you)||null,players:entries.length,reported:ranked.length};
}

// Shared course reports for learners this teacher manages: objective status and help requests only.
async function reportSummary(env,store,db,principal,siteOwner,learner,now){
 const grants=(await db.all("SELECT scope,policy FROM data_controls WHERE scope LIKE 'course-grant:%' AND json_extract(policy,'$.manager')=? AND json_extract(policy,'$.siteOwner')=? AND json_extract(policy,'$.learner')=? ORDER BY updated DESC LIMIT 24",principal,siteOwner,learner)).map(r=>({...parse(r.policy),id:r.scope.slice(13)}));
 let updated=null,latest=null,help=false;
 for(const g of grants){
  try{if(!await activeCourseGrant(env,g)||!(await grantChapters(env,g)).length)continue;const rep=await readSharedReport(env,store,g,now);
   if(rep.state!=='shared')continue;updated=Math.max(updated||0,rep.updated);help=help||rep.updates.some(u=>u.help);
   for(const u of rep.updates)if(STATUS_ORDER.indexOf(u.status)>STATUS_ORDER.indexOf(latest||'not-started'))latest=u.status;
  }catch{}
 }
 return {updated,latest,help};
}

// Learner actions that remove data. They are allowed for withdrawn accounts and in archived classes.
export const WITHDRAWAL_ACTIONS=input=>['leave','unshare'].includes(input?.action)||input?.action==='board'&&input.optIn===false;

export async function classesAPI(req,env,{owner,principal,siteOwner,store,access,user,now=()=>Date.now()}){
 const db=sqlDB(env.DB),input=req.method==='GET'?Object.fromEntries(new URL(req.url).searchParams):await readJSON(req,8000);
 const teaches=access.admitted&&['administrator','teacher','guardian'].includes(access.role);
 const at=now();
 const ownClass=async id=>{const {c,raw}=await loadClass(db,id);need(c.owner===principal&&c.siteOwner===siteOwner,'Only this class’s teacher can do that.',403);return {c,raw}};
 const memberOf=async(id,{write=false}={})=>{const {c}=await loadClass(db,id),m=parse((await db.one('SELECT policy FROM data_controls WHERE scope=?',memberScope(id,principal)))?.policy);need(m.status==='active','Join this class first.',403);if(write)need(!c.archived,'This class is closed. You can still stop sharing or leave.',409);return {c,m}};
 const resolveHandle=async(c,handle)=>{need(handleOk(handle),'Choose a learner.');const learners=new Set([...(await members(db,c.id)).map(m=>m.learner),...(await db.all("SELECT policy FROM data_controls WHERE scope LIKE ?",'class-share:'+c.id+':%')).map(r=>parse(r.policy).learner)]);for(const l of learners)if(await handleOf(c.id,l)===handle)return l;need(false,'That learner is no longer in this class.',404)};

 if(req.method==='GET'&&input.view==='overview'){
  need(teaches,'Only teachers can open a class overview.',403);const {c}=await ownClass(input.id);
  const all=await members(db,c.id),start=Math.max(0,Number.parseInt(input.cursor||'0',10)||0),page=all.slice(start,start+20);
  const shares=(await db.all("SELECT policy FROM data_controls WHERE scope LIKE ?",'class-share:'+c.id+':%')).map(r=>parse(r.policy));
  const sharers=new Set(shares.map(s=>s.learner));
  // At most four report reads at once: the learner store is slow and rate-limited under bursts.
  const reports=new Map();
  for(let i=0;i<page.length;i+=4)await Promise.all(page.slice(i,i+4).map(async m=>reports.set(m.learner,await reportSummary(env,store,db,principal,siteOwner,m.learner,at))));
  const learners=[];for(const m of page){
   const r=reports.get(m.learner)||{},mine=shares.filter(s=>s.learner===m.learner),times=[r.updated,...mine.map(s=>s.shared)].filter(Boolean);
   learners.push({handle:await handleOf(c.id,m.learner),label:m.label,joined:m.joined,lastShared:times.length?Math.max(...times):null,latest:r.latest||null,help:!!r.help,explanations:mine.length,unread:mine.filter(s=>!s.feedback).length});
  }
  const review=await db.all("SELECT id,draft FROM workshop_jobs WHERE owner=? AND status='review' ORDER BY updated DESC LIMIT 5",siteOwner);
  const reviewCount=(await db.one("SELECT COUNT(*) AS n FROM workshop_jobs WHERE owner=? AND status='review'",siteOwner))?.n||0;
  const labels=new Map(all.map(m=>[m.learner,m.label]));
  const recent=[];for(const s of shares.sort((a,b)=>b.shared-a.shared).slice(0,20))recent.push({handle:await handleOf(c.id,s.learner),label:labels.get(s.learner)||'Learner',key:s.key,title:s.title,text:s.text,shared:s.shared,feedback:s.feedback||null});
  await auditEvent(env,'learner:'+owner,'class-overview-viewed',{},at);
  // Course-report counts are read for this page only; explanation counts cover the whole class.
  return noStore({class:publicClass(c),counts:{learners:all.length,pageStart:start,pageSize:page.length,partial:page.length<all.length,sharing:learners.filter(l=>l.lastShared).length,help:learners.filter(l=>l.help).length,explaining:all.filter(m=>sharers.has(m.learner)).length,explanations:shares.length,unread:shares.filter(s=>!s.feedback).length,review:reviewCount,reviewScope:'workshop'},
   learners,nextCursor:start+20<all.length?String(start+20):null,
   review:review.map(j=>{let d={};try{d=JSON.parse(j.draft||'{}')}catch{}return {id:j.id,title:d.title||'Untitled chapter',template:d.template||null,sources:Array.isArray(d.sources)?d.sources.length:0}}),
   shares:recent,leaderboard:await leaderboard(db,c,at,null,true)});
 }
 if(req.method==='GET'&&input.view==='board'){
  const {c}=await loadClass(db,input.id),isOwner=c.owner===principal&&c.siteOwner===siteOwner;
  if(!isOwner)await memberOf(c.id);
  return noStore({class:{id:c.id,name:c.name},leaderboard:await leaderboard(db,c,at,principal)});
 }
 if(req.method==='GET'){
  const owned=teaches?(await db.all("SELECT policy FROM data_controls WHERE scope LIKE 'class:%' AND json_extract(policy,'$.owner')=? AND json_extract(policy,'$.siteOwner')=? ORDER BY updated DESC LIMIT 50",principal,siteOwner)).map(r=>parse(r.policy)):[];
  const teaching=[];for(const c of owned)teaching.push({...publicClass(c),learners:(await members(db,c.id)).length});
  const joined=[];
  for(const r of await db.all("SELECT policy FROM data_controls WHERE scope LIKE 'class-member:%' AND json_extract(policy,'$.learner')=? LIMIT 20",principal)){
   const m=parse(r.policy);if(m.status!=='active')continue;const row=await db.one('SELECT policy FROM data_controls WHERE scope=?',classScope(m.classId));if(!row)continue;const c=parse(row.policy);
   const b=parse((await db.one('SELECT policy FROM data_controls WHERE scope=?',boardScope(c.id,principal)))?.policy);
   const shares=(await db.all("SELECT policy FROM data_controls WHERE scope LIKE ? AND json_extract(policy,'$.learner')=?",'class-share:'+c.id+':%',principal)).map(r=>parse(r.policy)).map(s=>({key:s.key,title:s.title,shared:s.shared,feedback:s.feedback||null}));
   // Archived classes stay listed so learners can still stop sharing or leave.
   joined.push({id:c.id,name:c.name,teacher:c.teacherLabel||'Your teacher',archived:!!c.archived,leaderboard:!!c.leaderboard&&!c.archived,optIn:!!b.optIn,nickname:b.nickname||'',shares});
  }
  return noStore({teaches,teaching,joined,week:weekOf(at)});
 }

 need(req.method==='POST','Class route not found.',404);
 const action=input.action;
 if(action==='create'){
  need(teaches,'Only teachers can create classes.',403);
  const count=(await db.one("SELECT COUNT(*) AS n FROM data_controls WHERE scope LIKE 'class:%' AND json_extract(policy,'$.owner')=?",principal))?.n||0;need(count<50,'You have reached the limit of 50 classes. Delete one first.',409);
  const id=randomId(),code=await newCode(db),c={id,name:text(input.name,2,60,'Give the class a name of 2 to 60 characters.'),code,owner:principal,siteOwner,teacherLabel:displayLabel(user),created:at,archived:false,leaderboard:false};
  await upsert(db,codeScope(code),{classId:id},at);await upsert(db,classScope(id),c,at);
  await auditEvent(env,'learner:'+owner,'class-created',{},at);return noStore({class:publicClass(c)});
 }
 if(['rename','archive','restore','code','leaderboard','remove','feedback','delete'].includes(action)){
  need(teaches,'Only teachers can manage classes.',403);const {c,raw}=await ownClass(input.id);
  if(action==='delete'){need(input.confirmed===true,'Confirm that you want to delete this class.');await removeClass(db,c);await auditEvent(env,'learner:'+owner,'class-deleted',{},at);return noStore({deleted:true})}
  if(action==='remove'){const learner=await resolveHandle(c,input.handle);await removeLearnerRows(db,c.id,learner);await auditEvent(env,'learner:'+owner,'class-member-removed',{},at);return noStore({removed:true})}
  if(action==='feedback'){
   need(keyOk(input.key),'Choose a shared explanation.');const learner=await resolveHandle(c,input.handle);
   const scope=shareScope(c.id,learner,input.key),row=await db.one('SELECT policy FROM data_controls WHERE scope=?',scope);need(row,'The learner stopped sharing this explanation.',409);
   const s=parse(row.policy);need(!input.sticker||STICKERS.includes(input.sticker),'Choose one of the stickers.');
   s.feedback={strength:clean(input.strength,600),nextStep:input.nextStep?clean(input.nextStep,600):'',sticker:input.sticker||null,sentAt:at};
   const out=await db.run('UPDATE data_controls SET policy=?,updated=? WHERE scope=? AND policy=?',JSON.stringify(s),at,scope,row.policy);need(out.meta.changes===1,'This explanation changed. Reload and try again.',409);
   await auditEvent(env,'learner:'+owner,'feedback-sent',{},at);return noStore({sent:true});
  }
  const next={...c};
  if(action==='rename')next.name=text(input.name,2,60,'Give the class a name of 2 to 60 characters.');
  if(action==='archive')next.archived=true;
  if(action==='restore')next.archived=false;
  if(action==='leaderboard'){need(typeof input.enabled==='boolean','Choose on or off.');next.leaderboard=input.enabled}
  if(action==='code'){
   // New code first, then swap it in only if nobody else changed the class; the old code is removed last.
   next.code=await newCode(db);await upsert(db,codeScope(next.code),{classId:c.id},at);
   try{await saveClass(db,next,raw,at)}catch(e){await db.run('DELETE FROM data_controls WHERE scope=?',codeScope(next.code));throw e}
   await db.run('DELETE FROM data_controls WHERE scope=?',codeScope(c.code));return noStore({class:publicClass(next)});
  }
  await saveClass(db,next,raw,at);
  // Turning the leaderboard off removes nicknames and steps rather than keeping them.
  if(action==='leaderboard'&&!next.leaderboard)for(const r of await db.all("SELECT scope FROM data_controls WHERE scope LIKE ?",'class-board:'+c.id+':%'))await db.run('DELETE FROM data_controls WHERE scope=?',r.scope);
  return noStore({class:publicClass(next)});
 }
 if(action==='join'){
  const limit=parse((await db.one('SELECT policy FROM data_controls WHERE scope=?',joinLimitScope(principal)))?.policy),windowStart=limit.since&&limit.since>at-JOIN_WINDOW?limit.since:at,fails=windowStart===limit.since?limit.fails||0:0;
  need(fails<JOIN_FAILS,'Too many codes tried. Wait an hour, or check the code with your teacher.',429);
  const failed=async(message,status)=>{await upsert(db,joinLimitScope(principal),{learner:principal,since:windowStart,fails:fails+1},at);need(false,message,status)};
  const code=typeof input.code==='string'?input.code.trim().toUpperCase().replace(/[\s-]/g,''):'';if(!/^[A-Z0-9]{6}$/.test(code))return failed('Enter the 6-character class code.',400);
  const link=parse((await db.one('SELECT policy FROM data_controls WHERE scope=?',codeScope(code)))?.policy);if(!link.classId)return failed('That code doesn’t match a class. Check it with your teacher.',404);
  const {c}=await loadClass(db,link.classId);if(c.archived||c.code!==code)return failed('This class is closed.',409);
  need(c.owner!==principal,'You teach this class.',409);
  const joinedCount=(await db.one("SELECT COUNT(*) AS n FROM data_controls WHERE scope LIKE 'class-member:%' AND json_extract(policy,'$.learner')=?",principal))?.n||0;
  const existing=parse((await db.one('SELECT policy FROM data_controls WHERE scope=?',memberScope(c.id,principal)))?.policy);
  if(existing.status!=='active'){need(joinedCount<20,'You can be in up to 20 classes.',409);await upsert(db,memberScope(c.id,principal),{classId:c.id,learner:principal,label:displayLabel(user),joined:at,status:'active'},at)}
  await auditEvent(env,'learner:'+owner,'class-joined',{},at);return noStore({joined:{id:c.id,name:c.name,teacher:c.teacherLabel||'Your teacher',leaderboard:!!c.leaderboard}});
 }
 if(action==='leave'){
  const {c}=await memberOf(input.id);await removeLearnerRows(db,c.id,principal);
  await auditEvent(env,'learner:'+owner,'class-left',{},at);return noStore({left:true});
 }
 if(action==='unshare'){
  const {c}=await memberOf(input.id);need(keyOk(input.key),'Choose an explanation.');await db.run('DELETE FROM data_controls WHERE scope=?',shareScope(c.id,principal,input.key));
  await auditEvent(env,'learner:'+owner,'explanation-unshared',{},at);return noStore({shared:false});
 }
 if(action==='board'&&input.optIn===false){const {c}=await memberOf(input.id);await db.run('DELETE FROM data_controls WHERE scope=?',boardScope(c.id,principal));return noStore({optIn:false})}
 const {c}=await memberOf(input.id,{write:true});
 if(action==='board'){
  need(c.leaderboard,'Your teacher hasn’t turned on the leaderboard for this class.',409);
  need(input.optIn===true,'Choose whether to join the leaderboard.');need(nicknameOk(input.nickname),'Choose a nickname of 2 to 20 letters or numbers.');
  const prev=parse((await db.one('SELECT policy FROM data_controls WHERE scope=?',boardScope(c.id,principal)))?.policy),week=weekOf(at);
  await upsert(db,boardScope(c.id,principal),{classId:c.id,learner:principal,optIn:true,nickname:input.nickname.trim(),week:prev.week===week?week:null,tiles:prev.week===week?prev.tiles||0:null,updated:at},at); // no steps until the device reports them
  return noStore({optIn:true,leaderboard:await leaderboard(db,c,at,principal)});
 }
 if(action==='steps'){
  // The learner's device reports how many steps it finished this week; stored only when they opted in.
  need(Number.isInteger(input.tiles)&&input.tiles>=0&&input.tiles<=500,'Send a whole number of steps.');
  const row=c.leaderboard&&await db.one('SELECT policy FROM data_controls WHERE scope=?',boardScope(c.id,principal));if(!row)return noStore({stored:false});
  const b=parse(row.policy),week=weekOf(at);
  const tiles=b.week===week?Math.max(b.tiles||0,input.tiles):input.tiles;
  if(!(b.week===week&&b.tiles===tiles))await upsert(db,boardScope(c.id,principal),{...b,week,tiles,updated:at},at);
  return noStore({stored:true,leaderboard:await leaderboard(db,c,at,principal)});
 }
 if(action==='share'){
  need(input.confirmed===true,'Check the explanation before you share it.');need(keyOk(input.key),'Choose an explanation to share.');
  const count=(await db.one("SELECT COUNT(*) AS n FROM data_controls WHERE scope LIKE ? AND json_extract(policy,'$.learner')=?",'class-share:'+c.id+':%',principal))?.n||0;
  const exists=await db.one('SELECT 1 AS x FROM data_controls WHERE scope=?',shareScope(c.id,principal,input.key));need(exists||count<100,'You have shared 100 explanations with this class. Stop sharing an older one first.',409);
  await upsert(db,shareScope(c.id,principal,input.key),{classId:c.id,learner:principal,key:input.key,title:text(input.title,1,120,'Give the explanation a title.'),text:clean(input.text,1200),shared:at,feedback:null},at);
  await auditEvent(env,'learner:'+owner,'explanation-shared',{},at);return noStore({shared:true});
 }
 need(false,'Class action not found.',404);
}
