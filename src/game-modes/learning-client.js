import {rpgSaveKey} from '../rpg-progress.js';
import {normaliseProfile,observeProgress,progressIdentity,validPracticeRecord} from './learning-model.js';
import {journeyKey} from './journey-engine.js';
import {extendedSaveKey} from './extended-engine.js';
import {adventureSaveKey} from './adventure-engine.js';
import {draftSaveKey,draftHash} from './draft-engine.js';
import {townSaveKey} from './town-engine.js';
const PROFILE='mosaic:learning-profile:v1',RUNS='mosaic:practice-journal:v1';
export const gameSaveKey=(pack,kind)=>kind==='rpg'?rpgSaveKey(pack):kind==='journey'?journeyKey(pack):pack.template==='adventure-v1'?adventureSaveKey(pack):pack.template==='draft-v1'?draftSaveKey(pack):pack.template==='town-v1'?townSaveKey(pack):extendedSaveKey(pack);
export class LearningJournal{
 constructor(){this.user=null;this.profile=normaliseProfile();this.profileVersion=0;this.records=[];this.notice='';this.listeners=new Set();this.inflight=new Map();this.timers=new Map();this.loadLocal();}
 get prefix(){return this.user?'mosaic:account:'+this.user.id+':':'';}
 get storage(){const prefix=this.prefix;return {getItem:key=>localStorage.getItem(prefix+key),setItem:(key,value)=>localStorage.setItem(prefix+key,value),removeItem:key=>localStorage.removeItem(prefix+key)};}
 loadLocal(){this.profile=normaliseProfile();this.records=[];this.profileVersion=0;this.profilePending=false;this.keepCorrupt=false;
  try{const raw=JSON.parse(this.storage.getItem(PROFILE)||'{}');this.profile=normaliseProfile(raw.profile||raw);this.profilePending=raw.pending===true;this.profileVersion=Number.isInteger(raw.version)&&raw.version>=0?raw.version:0;}catch{this.notice='Your saved preferences could not be read. Game saves and practice history are unchanged.';}
  try{const raw=this.storage.getItem(RUNS)||'[]',records=JSON.parse(raw);if(!Array.isArray(records)||records.length>100)throw Error();this.records=records.filter(validPracticeRecord);if(this.records.length!==records.length){this.storage.setItem(RUNS+':recovery',raw);this.notice='Some journal entries could not be read; a recovery copy is kept on this device.';}}
  catch{this.notice='The practice journal could not be read. Existing game saves are unchanged.';try{const raw=this.storage.getItem(RUNS);if(raw)this.storage.setItem(RUNS+':recovery',raw);}catch{this.keepCorrupt=true;}}
 }
 async request(path,body){const r=await fetch('/api/learning/'+path,{method:body?'POST':'GET',credentials:'include',cache:'no-store',headers:{'X-Mosaic-Learner':this.user?.id||'','X-Mosaic-Data-Epoch':this.dataEpoch||'0:0',...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const d=await r.json();if(r.ok&&!body){this.dataEpoch=r.headers.get('X-Mosaic-Data-Epoch')||this.dataEpoch;this.applyDataReset(Number(r.headers.get('X-Mosaic-Data-Reset')||0),r.headers.get('X-Mosaic-Data-Reset-Kind'));}if(!r.ok)throw Object.assign(Error(d.error||'Cloud progress is unavailable.'),{status:r.status});return d;}
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
  const next={key,summary,snapshot,updated:Math.max(Date.now(),(previous?.updated||0)+1),version:previous?.version||0,pending:!!this.user,conflict:previous?.conflict||false};this.records=[next,...this.records.filter(r=>r.key!==key)].slice(0,100);this.storeRecords();this.changed();
  if(this.user&&!next.conflict){clearTimeout(this.timers.get(key));this.timers.set(key,setTimeout(()=>void this.sync(key),1200));}
 }catch{this.notice='This practice record could not be validated. Your game save remains separate.';}}
 async sync(key){if(!this.user||this.inflight.has(key))return;const record=this.records.find(r=>r.key===key);if(!record?.pending||record.conflict)return;const sent=JSON.stringify(record.snapshot);this.inflight.set(key,true);try{
  const d=await this.request('save',{packId:record.summary.packId,contentHash:record.summary.contentHash,kind:record.summary.kind,snapshot:record.snapshot,expectedVersion:record.version});const current=this.records.find(r=>r.key===key);if(current){current.version=d.save.version;current.updated=Math.max(Date.now(),current.updated+1);current.pending=JSON.stringify(current.snapshot)!==sent;current.error='';}this.notice='Progress saved to your learner account.';
 }catch(e){const current=this.records.find(r=>r.key===key);if(current){current.conflict=e.status===409;current.error=e.message;}this.notice=e.message;}
 finally{this.inflight.delete(key);this.storeRecords();this.changed();const current=this.records.find(r=>r.key===key);if(current?.pending&&!current.conflict&&!current.error)this.timers.set(key,setTimeout(()=>void this.sync(key),1200));}}
 async prepare(pack,kind){const key=progressIdentity(pack,kind);if(!this.user)return;try{
  const d=await this.request('save?'+new URLSearchParams({packId:pack.id,contentHash:draftHash(pack),kind}));let local=this.records.find(r=>r.key===key);
  const deviceRaw=this.storage.getItem(gameSaveKey(pack,kind));let device;
  if(deviceRaw)try{device=observeProgress(pack,kind,JSON.parse(deviceRaw))}catch{this.storage.setItem(gameSaveKey(pack,kind)+':recovery',deviceRaw);this.notice='An unreadable device save was preserved as a recovery copy.';}
  if(device){if(JSON.stringify(device.snapshot)!==JSON.stringify(local?.snapshot)&&JSON.stringify(device.snapshot)!==JSON.stringify(d.save?.snapshot)){
   local={key,...device,updated:Math.max(Date.now(),(local?.updated||0)+1),version:local?.version||0,pending:true,conflict:!!d.save,cloudVersion:d.save?.version};this.records=[local,...this.records.filter(r=>r.key!==key)];this.storeRecords([key]);
   if(d.save){this.notice='Your device progress differs from the journal and cloud save. It has been preserved. Choose a version in your learning journal.';return;}
  }}
  if(!d.save){if(local?.pending)await this.sync(key);return;}
  const clean=observeProgress(pack,kind,d.save.snapshot);if(local?.snapshot&&local.version!==d.save.version){local.conflict=true;local.cloudVersion=d.save.version;this.notice='A different cloud save is available. Choose a version in your learning journal.';this.storeRecords([key]);return;}
  if(local?.snapshot&&local.pending){local.conflict=false;local.error='';this.storage.setItem(gameSaveKey(pack,kind),JSON.stringify(observeProgress(pack,kind,local.snapshot).snapshot));await this.sync(key);return;}
  this.storage.setItem(gameSaveKey(pack,kind),JSON.stringify(clean.snapshot));this.records=[{...d.save,...clean,pending:false},...this.records.filter(r=>r.key!==key)].slice(0,100);this.storeRecords([key]);
 }catch(e){this.notice=e.message;}}
 async resolveSave(pack,kind,useCloud){const key=progressIdentity(pack,kind);if(this.inflight.has(key))throw Error('A save is still being confirmed. Wait a moment, then choose a version.');clearTimeout(this.timers.get(key));const d=await this.request('save?'+new URLSearchParams({packId:pack.id,contentHash:draftHash(pack),kind})),local=this.records.find(r=>r.key===key),resolvedAt=Math.max(Date.now(),(local?.updated||0)+1);if(useCloud){if(!d.save)throw Error('There is no cloud save for this game.');const clean=observeProgress(pack,kind,d.save.snapshot);const previous=this.storage.getItem(gameSaveKey(pack,kind));if(previous)this.storage.setItem(gameSaveKey(pack,kind)+':previous',previous);this.storage.setItem(gameSaveKey(pack,kind),JSON.stringify(clean.snapshot));this.records=[{...d.save,...clean,updated:resolvedAt,pending:false},...this.records.filter(r=>r.key!==key)];this.notice='Cloud progress restored. Your earlier device save is kept as a recovery copy.';}else{if(!local?.snapshot)throw Error('There is no device save to use.');local.version=d.save?.version||0;local.updated=resolvedAt;local.conflict=false;local.pending=true;local.error='';this.storeRecords([key]);await this.sync(key);}this.storeRecords([key]);this.changed();}
 changed(){for(const fn of this.listeners)fn();}
}
export const learningJournal=new LearningJournal();
