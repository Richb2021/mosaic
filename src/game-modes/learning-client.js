import {rpgSaveKey} from '../rpg-progress.js';
import {normaliseProfile,observeProgress,progressIdentity,validPracticeRecord} from './learning-model.js';
import {journeyKey} from './journey-engine.js';
import {extendedSaveKey} from './extended-engine.js';
import {adventureSaveKey} from './adventure-engine.js';
import {draftSaveKey,draftHash} from './draft-engine.js';
import {economySaveKey} from './economy-engine.js';
import {townSaveKey} from './town-engine.js';
const PROFILE='mosaic:learning-profile:v1',RUNS='mosaic:practice-journal:v1';
export const gameSaveKey=(pack,kind)=>kind==='rpg'?rpgSaveKey(pack):kind==='journey'?journeyKey(pack):pack.template==='adventure-v1'?adventureSaveKey(pack):pack.template==='draft-v1'?draftSaveKey(pack):pack.template==='economy-v1'?economySaveKey(pack):pack.template==='town-v1'?townSaveKey(pack):extendedSaveKey(pack);
export class LearningJournal{
 constructor(){this.user=null;this.profile=normaliseProfile();this.profileVersion=0;this.records=[];this.notice='';this.listeners=new Set();this.inflight=new Map();this.timers=new Map();this.loadLocal();}
 get prefix(){return this.user?'mosaic:account:'+this.user.id+':':'';}
 get storage(){const prefix=this.prefix;return {getItem:key=>localStorage.getItem(prefix+key),setItem:(key,value)=>localStorage.setItem(prefix+key,value),removeItem:key=>localStorage.removeItem(prefix+key)};}
 loadLocal(){this.profile=normaliseProfile();this.records=[];this.profileVersion=0;this.profilePending=false;this.keepCorrupt=false;
  try{const raw=JSON.parse(this.storage.getItem(PROFILE)||'{}');this.profile=normaliseProfile(raw.profile||raw);this.profilePending=raw.pending===true;this.profileVersion=Number.isInteger(raw.version)&&raw.version>=0?raw.version:0;}catch{this.notice='Your saved preferences could not be read. Game saves and practice history are unchanged.';}
  try{const raw=this.storage.getItem(RUNS)||'[]',records=JSON.parse(raw);if(!Array.isArray(records)||records.length>100)throw Error();this.records=records.filter(validPracticeRecord);if(this.records.length!==records.length){this.storage.setItem(RUNS+':recovery',raw);this.notice='Some journal entries could not be read; a recovery copy is kept on this device.';}}
  catch{this.notice='The practice journal could not be read. Existing game saves are unchanged.';try{const raw=this.storage.getItem(RUNS);if(raw)this.storage.setItem(RUNS+':recovery',raw);}catch{this.keepCorrupt=true;}}
 }
 async request(path,body){const payload=body?JSON.stringify(body):undefined;const r=await fetch('/api/learning/'+path,{method:body?'POST':'GET',credentials:'include',cache:'no-store',headers:{'X-Mosaic-Learner':this.user?.id||'','X-Mosaic-Data-Epoch':this.dataEpoch||'0:0',...(body?{'Content-Type':'application/json'}:{})},body:payload,keepalive:path==='save'&&!!payload&&new TextEncoder().encode(payload).length<60000});const d=await r.json();if(r.ok&&!body){this.dataEpoch=r.headers.get('X-Mosaic-Data-Epoch')||this.dataEpoch;this.applyDataReset(Number(r.headers.get('X-Mosaic-Data-Reset')||0),r.headers.get('X-Mosaic-Data-Reset-Kind'));}if(!r.ok)throw Object.assign(Error(d.error||'Cloud progress is unavailable.'),{status:r.status,code:d.code});return d;}
 applyDataReset(stamp,kind='all'){
  if(!this.user||!stamp)return;const key=this.prefix+'mosaic:data-reset';if(Number(localStorage.getItem(key)||0)>=stamp)return;
  for(const timer of this.timers.values())clearTimeout(timer);this.timers.clear();
  if(kind==='expired'){
   this.records=this.records.map(r=>({...r,pending:false,conflict:true,error:'Account retention removed old records. This device copy is preserved; choose explicitly before syncing it again.'}));
   this.profilePending=false;this.storage.setItem(RUNS,JSON.stringify(this.records));this.storage.setItem(PROFILE,JSON.stringify({profile:this.profile,version:this.profileVersion,pending:false}));localStorage.setItem(key,String(stamp));this.dataResetNotice='Account retention ran. Unsynced device copies are preserved for review, not automatically uploaded again.';this.notice=this.dataResetNotice;return;
  }
  for(const k of Object.keys(localStorage))if(k.startsWith(this.prefix))localStorage.removeItem(k);
  localStorage.setItem(key,String(stamp));this.loadLocal();
 }
 async connect(){this.connected=false;try{const response=await fetch('/api/auth/get-session',{credentials:'include',cache:'no-store'});if(!response.ok)throw Error('Account service is unavailable. Device saves are still available.');const {user}=await response.json();this.user=user||null;this.loadLocal();if(!user){this.connected=true;return;}const d=await this.request('journal');if(d.profile&&this.profilePending){this.profileConflict=d.profileVersion!==this.profileVersion;}else if(d.profile){this.profile=normaliseProfile(d.profile);this.profileVersion=d.profileVersion;this.storage.setItem(PROFILE,JSON.stringify({profile:this.profile,version:this.profileVersion}));}
  for(const cloud of d.records.filter(validPracticeRecord)){const local=this.records.find(r=>r.key===cloud.key);if(!local)this.records.push(cloud);else if(local.version!==cloud.version){local.conflict=true;local.cloudVersion=cloud.version;}}
  if(!d.profile&&!this.profilePending)this.profileVersion=d.profileVersion;this.storeRecords();this.connected=true;this.notice=d.warning||this.dataResetNotice||'Signed in. Your learner account stores preferences and supported game progress.';
 }catch(e){this.notice=e.message;}this.changed();}
 storeRecords(authoritative=[]){if(this.keepCorrupt)return;try{
  const raw=this.storage.getItem(RUNS)||'[]',stored=JSON.parse(raw);if(!Array.isArray(stored)||stored.length>100)throw Error('Unreadable journal');
  const valid=stored.filter(validPracticeRecord);if(valid.length!==stored.length)this.storage.setItem(RUNS+':recovery',raw);
  const merged=new Map(valid.map(r=>[r.key,r]));
  for(const r of this.records){const existing=merged.get(r.key);if(!existing||authoritative.includes(r.key)||r.updated>existing.updated||(r.updated===existing.updated&&(r.version||0)>=(existing.version||0)))merged.set(r.key,r);}
  this.records=[...merged.values()].sort((a,b)=>b.updated-a.updated).slice(0,100);this.storage.setItem(RUNS,JSON.stringify(this.records));
 }catch{this.notice='The practice journal could not be updated. Existing game saves are preserved.';}}
 async saveProfile(raw){
  if(this.profileSaving)throw Error('Preferences are still saving. Please wait a moment.');
  const profile=normaliseProfile(raw);this.profileSaving=true;this.profile=profile;this.profilePending=!!this.user;
  let savedOnDevice=false,savedToAccount=false;
  try{
   try{this.storage.setItem(PROFILE,JSON.stringify({profile,version:this.profileVersion,pending:this.profilePending}));savedOnDevice=true;}catch{}
   if(this.user){
    try{
     const result=await this.request('profile',{profile,expectedVersion:this.profileVersion});this.profileVersion=result.version;this.profileConflict=false;this.profilePending=false;savedToAccount=true;
     try{this.storage.setItem(PROFILE,JSON.stringify({profile,version:result.version}));savedOnDevice=true;}catch{savedOnDevice=false;}
     this.notice=savedOnDevice?'Preferences saved to your learner account.':'Preferences saved to your learner account. Device storage is unavailable.';
    }catch(e){this.profileConflict=e.status===409;this.notice=e.message+(savedOnDevice?' Your edited preferences remain on this device.':' Keep this page open; your edited preferences are available for this visit only.');}
   }else this.notice=savedOnDevice?'Preferences saved on this device. Sign in to save across devices.':'Device storage is unavailable. Preferences are available for this visit only.';
   return {savedOnDevice,savedToAccount,notice:this.notice};
  }finally{this.profileSaving=false;this.changed();}
 }
 async reloadProfile(){const d=await this.request('journal');this.profile=normaliseProfile(d.profile||{});this.profileVersion=d.profileVersion;this.profileConflict=false;this.profilePending=false;this.storage.setItem(PROFILE,JSON.stringify({profile:this.profile,version:this.profileVersion}));this.notice='Loaded your cloud preferences.';this.changed();}
 observe({pack,record,kind='classic'}){try{const {snapshot,summary}=observeProgress(pack,kind,record),key=progressIdentity(pack,kind),previous=this.records.find(r=>r.key===key);if(previous&&JSON.stringify(previous.snapshot)===JSON.stringify(snapshot))return;
  const next={key,summary,snapshot,updated:Math.max(Date.now(),(previous?.updated||0)+1),version:previous?.version||0,pending:!!this.user,conflict:previous?.conflict||false,requiresReload:previous?.requiresReload||false};this.records=[next,...this.records.filter(r=>r.key!==key)].slice(0,100);this.storeRecords();this.changed();
  if(this.user&&!next.conflict&&!next.requiresReload){clearTimeout(this.timers.get(key));if(summary.completed&&!previous?.summary.completed)void this.flush(key);else this.timers.set(key,setTimeout(()=>void this.sync(key),1200));}
 }catch{this.notice='This practice record could not be validated. Your game save remains separate.';}}
 saveStatus(pack,kind='classic'){
  const key=progressIdentity(pack,kind),r=this.records.find(x=>x.key===key);let device=false;
  try{const stored=JSON.parse(this.storage.getItem(RUNS)||'[]').find(x=>x.key===key);device=!!r?.snapshot&&JSON.stringify(stored?.snapshot)===JSON.stringify(r.snapshot)}catch{}
  const local=device?'Your latest progress is saved on this device.':'Keep this tab open until a save is confirmed.';
  if(r?.conflict)return {state:'conflict',label:'Choose a save',detail:local+' A different account save needs your review. Neither version will be overwritten automatically.',canReview:true};
  if(r?.requiresReload)return {state:'pending',label:'Reload before saving',detail:local+' Account data changed in another window. Reopen this game to check the current account state before syncing.',canReload:true};
  if(this.inflight.has(key))return {state:'saving',label:'Saving to account…',detail:local+' Waiting for the account to confirm this progress.'};
  if(r?.error)return {state:'pending',label:device?'Saved on device · not synced':'Progress not saved',detail:local+' '+r.error,canRetry:!!this.user};
  if(this.user&&r?.pending)return {state:'pending',label:device?'Saved on device · waiting to sync':'Waiting to save',detail:local+' The account save is still pending.',canRetry:true};
  if(r?.snapshot&&!device&&!this.user)return {state:'pending',label:'Progress not saved',detail:local};
  if(this.user&&r?.version>0)return {state:'saved',label:'Saved to account',detail:'This game version and your latest progress are confirmed in your learner account.'};
  return {state:'device',label:device?'Saved on this device':this.user?'Autosave ready':'Device saves only',detail:device?local+(this.user?'':' Sign in to use separate account saves across devices.'):this.user?'Your first game action will be saved automatically.':'Play on this device, or sign in for account saves.'};
 }
 async flush(key){
  const keys=key?[key]:this.records.filter(r=>r.pending&&!r.conflict).map(r=>r.key);
  await Promise.all(keys.map(async k=>{
   // Drain an older in-flight snapshot before sending the newest one, without parallel writes.
   for(let pass=0;pass<3;pass++){
    clearTimeout(this.timers.get(k));this.timers.delete(k);
    const r=this.records.find(x=>x.key===k);if(!this.user||!r?.pending||r.conflict||r.requiresReload)return;
    await this.sync(k);const latest=this.records.find(x=>x.key===k);if(!latest?.pending||latest.conflict||latest.requiresReload||latest.error)return;
   }
  }));
 }
 sync(key){
  if(this.inflight.has(key))return this.inflight.get(key);
  const record=this.records.find(r=>r.key===key);if(!this.user||!record?.pending||record.conflict||record.requiresReload)return Promise.resolve();
  clearTimeout(this.timers.get(key));this.timers.delete(key);
  const owner=this.user.id,epoch=this.dataEpoch,sent=JSON.stringify(record.snapshot),body={packId:record.summary.packId,contentHash:record.summary.contentHash,kind:record.summary.kind,snapshot:JSON.parse(sent),expectedVersion:record.version};
  const sameAccount=()=>this.user?.id===owner&&this.dataEpoch===epoch;
  const task=(async()=>{await Promise.resolve();try{
   if(!sameAccount())return;
   const d=await this.request('save',body);if(!sameAccount())return;
   const current=this.records.find(r=>r.key===key);if(current){current.version=d.save.version;current.updated=Math.max(Date.now(),current.updated+1);current.pending=JSON.stringify(current.snapshot)!==sent;current.error='';}this.notice='Progress saved to your learner account.';
  }catch(e){if(!sameAccount())return;const current=this.records.find(r=>r.key===key);if(current){current.requiresReload=e.code==='DATA_RELOAD_REQUIRED';current.conflict=e.status===409&&!current.requiresReload;current.error=e.message;}this.notice=e.message;
  }finally{
   if(this.inflight.get(key)===task)this.inflight.delete(key);
   const current=this.records.find(r=>r.key===key);
   if(this.user?.id===owner&&this.dataEpoch!==epoch&&current?.pending&&!current.conflict){current.requiresReload=true;current.error='Account data changed while a save was in flight. Reopen this game before syncing again.';}
   if(sameAccount()||this.user?.id===owner&&current?.requiresReload)this.storeRecords();
   this.changed();
   if(current?.pending&&!current.conflict&&!current.requiresReload&&!current.error)this.timers.set(key,setTimeout(()=>void this.sync(key),1200));
  }})();
  this.inflight.set(key,task);this.changed();return task;
 }
 async prepare(pack,kind){const key=progressIdentity(pack,kind);if(!this.user)return;try{
  const d=await this.request('save?'+new URLSearchParams({packId:pack.id,contentHash:draftHash(pack),kind}));let local=this.records.find(r=>r.key===key);
  const deviceRaw=this.storage.getItem(gameSaveKey(pack,kind));let device;
  if(deviceRaw)try{device=observeProgress(pack,kind,JSON.parse(deviceRaw))}catch{this.storage.setItem(gameSaveKey(pack,kind)+':recovery',deviceRaw);this.notice='An unreadable device save was preserved as a recovery copy.';}
  if(device){if(JSON.stringify(device.snapshot)!==JSON.stringify(local?.snapshot)&&JSON.stringify(device.snapshot)!==JSON.stringify(d.save?.snapshot)){
   local={key,...device,updated:Math.max(Date.now(),(local?.updated||0)+1),version:local?.version||0,pending:true,conflict:!!d.save||!!local?.conflict,cloudVersion:d.save?.version};this.records=[local,...this.records.filter(r=>r.key!==key)];this.storeRecords([key]);
   if(d.save){this.notice='Your device progress differs from the journal and cloud save. It has been preserved. Choose a version in your learning journal.';return;}
  }}
  if(local?.conflict){this.notice='Your device copy needs review before syncing. Choose a version in your learning journal.';return;}
  if(!d.save){if(local?.pending){local.requiresReload=false;local.error='';await this.sync(key);}return;}
  const clean=observeProgress(pack,kind,d.save.snapshot);if(local?.snapshot&&local.version!==d.save.version){local.conflict=true;local.cloudVersion=d.save.version;this.notice='A different cloud save is available. Choose a version in your learning journal.';this.storeRecords([key]);return;}
  if(local?.snapshot&&local.pending){local.conflict=false;local.requiresReload=false;local.error='';this.storage.setItem(gameSaveKey(pack,kind),JSON.stringify(observeProgress(pack,kind,local.snapshot).snapshot));await this.sync(key);return;}
  this.storage.setItem(gameSaveKey(pack,kind),JSON.stringify(clean.snapshot));this.records=[{...d.save,...clean,pending:false},...this.records.filter(r=>r.key!==key)].slice(0,100);this.storeRecords([key]);
 }catch(e){this.notice=e.message;}}
 async resolveSave(pack,kind,useCloud){const key=progressIdentity(pack,kind);if(this.inflight.has(key))throw Error('A save is still being confirmed. Wait a moment, then choose a version.');clearTimeout(this.timers.get(key));const d=await this.request('save?'+new URLSearchParams({packId:pack.id,contentHash:draftHash(pack),kind})),local=this.records.find(r=>r.key===key),resolvedAt=Math.max(Date.now(),(local?.updated||0)+1);if(useCloud){if(!d.save)throw Error('There is no cloud save for this game.');const clean=observeProgress(pack,kind,d.save.snapshot);const previous=this.storage.getItem(gameSaveKey(pack,kind));if(previous)this.storage.setItem(gameSaveKey(pack,kind)+':previous',previous);this.storage.setItem(gameSaveKey(pack,kind),JSON.stringify(clean.snapshot));this.records=[{...d.save,...clean,updated:resolvedAt,pending:false},...this.records.filter(r=>r.key!==key)];this.notice='Cloud progress restored. Your earlier device save is kept as a recovery copy.';}else{if(!local?.snapshot)throw Error('There is no device save to use.');local.version=d.save?.version||0;local.updated=resolvedAt;local.conflict=false;local.requiresReload=false;local.pending=true;local.error='';this.storeRecords([key]);await this.sync(key);}this.storeRecords([key]);this.changed();}
 changed(){for(const fn of this.listeners)fn();}
}
export const learningJournal=new LearningJournal();
