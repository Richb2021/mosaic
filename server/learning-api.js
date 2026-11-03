import {mediaJobsAPI,mediaHealth} from './media-jobs.js';
import {teacherReviewAPI} from './teacher-review.js';
import {connectedProgrammeAPI} from './connected-programme-api.js';
import {collectionsAPI} from './knowledge-collections.js';
import {exploreAPI} from './explore-api.js';
import {WORLD_PACKS} from '../src/game-modes/adventure-world-packs.js';
import {assignedChapters} from './assignments.js';
import {coursePlanAPI} from './course-plan-api.js';
import {courseAPI} from './course-api.js';
import {courseSharingAPI} from './course-sharing-api.js';
import {workspaceIdentity,requireAdmission,admission} from './pilot-access.js';
import {registerRetentionSubject} from './background-retention.js';
import {learningLoopAPI,assignedLoopList} from './learning-loop-api.js';
import {studioAPI} from './studio-api.js';
import {withDataGuard} from './data-control.js';
import {dataAPI,enforceRetention} from './data-lifecycle.js';
import {creativeAPI} from './creative-api.js';
import {RPG_PACKS,bundlePublishedChapter} from './rpg-catalog.js';
import {ncbSession,noStore,checkOrigin,readJSON} from './ncb-auth.js';
import {NCBStore,StoreError} from './ncb-store.js';
import {normaliseProfile,observeProgress,progressIdentity,validPracticeRecord} from '../src/game-modes/learning-model.js';
import {ADVENTURE_PACKS} from '../src/game-modes/adventure-content.js';
import {DRAFT_PACKS} from '../src/game-modes/draft-content.js';
import {ECONOMY_PACKS} from '../src/game-modes/economy-packs.js';
import {TOWN_PACKS} from '../src/game-modes/town-packs.js';
import {EXTENDED_PACKS} from '../src/game-modes/extended-packs.js';
import {validatePlayableContent} from '../src/game-modes/content-registry.js';
import {digest} from './content-service.js';
import {draftHash} from '../src/game-modes/draft-engine.js';
const packs=[...RPG_PACKS,...WORLD_PACKS,...ADVENTURE_PACKS,...DRAFT_PACKS,...TOWN_PACKS,...ECONOMY_PACKS,...EXTENDED_PACKS];
const need=(x,m,status=400)=>{if(!x)throw new StoreError(m,status)};
export async function canonicalPack(id,hash,req,env,workspace,learner){
 let pack=packs.find(p=>p.id===id&&draftHash(p)===hash);
 // Generated content is accepted only after the existing source-review/publish gate.
 if(!pack&&env.DB){const owner=workspace;need(owner,'Open your private resource library to sync this game.',403);const result=await env.DB.prepare("SELECT draft FROM workshop_jobs WHERE owner=? AND status=? AND json_extract(CASE WHEN json_valid(draft) THEN draft ELSE '{}' END,'$.id')=? ORDER BY updated DESC LIMIT 1").bind(owner,'published',id.startsWith('rpg-')?id.slice(4):id).all();pack=result.results.map(r=>{try{const p=validatePlayableContent(JSON.parse(r.draft));return id.startsWith('rpg-')&&p.template==='underlight-v1'?bundlePublishedChapter(p):p}catch{return null}}).find(p=>p&&p.id===id&&draftHash(p)===hash);}
 if(!pack)for(const row of await assignedChapters(env,learner)){try{let p=validatePlayableContent(JSON.parse(row.draft));if(p.template==='underlight-v1')p=bundlePublishedChapter(p);if(p.id===id&&draftHash(p)===hash)pack=p;}catch{}}
 need(pack,'This game is available on this device only. Publish its reviewed source in the Resource Library to enable cloud progress.',422);return pack;
}
const unpack=row=>row?{version:row.version,updated:Number(row.updated_ms),...JSON.parse(row.payload)}:null;
export async function learningAPI(req,env,{session=ncbSession,store=new NCBStore(env),resolve=canonicalPack,now=()=>Date.now()}={}){try{
 checkOrigin(req);const user=await session(req,env);need(user,'Sign in to your learner account to save across devices.',401);need(req.headers.get('x-mosaic-learner')===user.id,'Your signed-in account changed. Reload this page before syncing progress.',401);
 const {owner,principal,siteOwner}=await workspaceIdentity(user,env),url=new URL(req.url),path=url.pathname.replace(/^\/api\/learning\/?/,'');
 const scopedResolve=(id,hash,r,e)=>resolve(id,hash,r,e,siteOwner,owner);
 if(path==='data'){const access=await admission(env,principal);need(access.admitted||['active','revoked','closing'].includes(access.status),'Accept your invitation before using account data controls.',403);return await dataAPI(req,env,{owner,siteOwner,store,now});}
 const withdrawal=['course-sharing','teacher-review'].includes(path)&&req.method==='POST'&&await req.clone().json().then(x=>path==='course-sharing'?x.action==='share'&&x.enabled===false:x.action==='withdraw').catch(()=>false);
 const access=await requireAdmission(env,principal,{store,onboarding:!withdrawal,storageOwner:owner});
 if(req.method==='POST'&&path.startsWith('creative')&&env.PILOT_ENABLED==='true'&&(!access.canAuthor||access.ageBand!=='18plus'))return noStore({error:'Ask your organiser to prepare and review new AI learning material. Your assigned games and learning record remain available.'},403);
 await registerRetentionSubject(env,{siteOwner,owner,now:now()});
 if(req.method==='GET')await enforceRetention(env,{owner,siteOwner,store,now});
 return await withDataGuard(req,env,{owner,siteOwner,now},async()=>{
 if(path==='media-jobs')return await mediaJobsAPI(req,env,{owner,principal,siteOwner,access,now});
 if(path==='operations'){need(access.role==='administrator','Administrator access required.',403);return noStore(await mediaHealth(env,now()));}
 if(path==='programme')return await connectedProgrammeAPI(req,env,{store,owner,principal,siteOwner,resolve:scopedResolve,now});
 if(path==='collections')return await collectionsAPI(req,env,{store,owner,principal,siteOwner,access,now});
 if(path==='course-plan')return await coursePlanAPI(req,env,{store,owner,siteOwner,access,now});
 if(path==='courses')return await courseAPI(req,env,{store,owner,siteOwner,access,now});
 if(path==='teacher-review')return await teacherReviewAPI(req,env,{store,owner,principal,siteOwner,access,now});
 if(path==='course-sharing')return await courseSharingAPI(req,env,{store,owner,principal,siteOwner,access,now});
 if(path==='loop/banks')return await assignedLoopList(req,env,{store,owner,principal,siteOwner,resolve:scopedResolve});
 if(path==='explore')return await exploreAPI(req,env,{store,owner,principal,siteOwner,resolve:scopedResolve,now});
 if(path==='loop')return await learningLoopAPI(req,env,{store,owner,principal,siteOwner,resolve:scopedResolve,now});
 if(path==='creative'||path==='creative/audio')return await creativeAPI(req,env,{store,owner,siteOwner,resolve:scopedResolve,now});
 if(path==='studio'||path.startsWith('studio/'))return await studioAPI(req,env,{path,store,owner,siteOwner,resolve:scopedResolve,included:packs,now});
 if(req.method==='GET'&&path==='journal'){
  const [p,rows]=await Promise.all([store.latest('learner_profiles',owner,'profile'),store.list(owner)]);let profile=null,unreadable=0;
  if(p)try{profile=normaliseProfile(JSON.parse(p.payload).profile)}catch{unreadable++;}
  const records=[];for(const row of rows)try{const r=unpack(row);if(!validPracticeRecord(r))throw Error();const {key,summary,updated,version}=r;records.push({key,summary,updated,version});}catch{unreadable++;}
  return noStore({user,profile,profileVersion:p?.version||0,records,warning:unreadable?'Some cloud records could not be read. Other progress is available; no unreadable records were removed.':''});
 }
 if(req.method==='POST'&&path==='profile'){
  const input=await readJSON(req,10000);need(Number.isInteger(input.expectedVersion)&&input.expectedVersion>=0,'Invalid save version.');const profile=normaliseProfile(input.profile),row=await store.write('learner_profiles',owner,'profile',input.expectedVersion,{profile},now());return noStore({profile,version:row.version});
 }
 if(path==='save'&&['GET','POST'].includes(req.method)){
  const input=req.method==='POST'?await readJSON(req):Object.fromEntries(url.searchParams);
  need(typeof input.packId==='string'&&input.packId.length<=100&&typeof input.contentHash==='string'&&input.contentHash.length<=100&&['classic','journey','rpg'].includes(input.kind),'Choose a valid game save.');
  const pack=await scopedResolve(input.packId,input.contentHash,req,env),key=progressIdentity(pack,input.kind),slot=await digest(key);
  if(req.method==='GET'){const value=unpack(await store.latest('learner_saves',owner,slot));if(value){const clean=observeProgress(pack,input.kind,value.snapshot);value.snapshot=clean.snapshot;value.summary=clean.summary;value.key=key;}return noStore({save:value,...(input.kind==='rpg'?{content:pack}:{})});}
  need(Number.isInteger(input.expectedVersion)&&input.expectedVersion>=0&&input.expectedVersion<2147483646,'Invalid save version.');
  const clean=observeProgress(pack,input.kind,input.snapshot),row=await store.write('learner_saves',owner,slot,input.expectedVersion,{key,...clean},now());return noStore({save:unpack(row)});
 }
 return noStore({error:'Learning route not found.'},404);
 });
 }catch(e){return noStore({error:e instanceof StoreError?e.message:e.status?e.message:'The learning record could not be validated. Your device save is unchanged.',...(e.code==='DATA_RELOAD_REQUIRED'?{code:e.code}:{})},e.status||400)}}
