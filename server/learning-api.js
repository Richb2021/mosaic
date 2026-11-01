import {studioAPI} from './studio-api.js';
import {creativeAPI} from './creative-api.js';
import {RPG_PACKS,bundlePublishedChapter} from './rpg-catalog.js';
import {ncbSession,noStore,checkOrigin,readJSON} from './ncb-auth.js';
import {NCBStore,StoreError} from './ncb-store.js';
import {normaliseProfile,observeProgress,progressIdentity,validPracticeRecord} from '../src/game-modes/learning-model.js';
import {ADVENTURE_PACKS} from '../src/game-modes/adventure-content.js';
import {DRAFT_PACKS} from '../src/game-modes/draft-content.js';
import {TOWN_PACKS} from '../src/game-modes/town-packs.js';
import {EXTENDED_PACKS} from '../src/game-modes/extended-packs.js';
import {validatePlayableContent} from '../src/game-modes/content-registry.js';
import {digest} from './content-service.js';
import {draftHash} from '../src/game-modes/draft-engine.js';
const packs=[...RPG_PACKS,...ADVENTURE_PACKS,...DRAFT_PACKS,...TOWN_PACKS,...EXTENDED_PACKS];
const need=(x,m,status=400)=>{if(!x)throw new StoreError(m,status)};
export async function canonicalPack(id,hash,req,env){
 let pack=packs.find(p=>p.id===id&&draftHash(p)===hash);
 // Generated content is accepted only after the existing source-review/publish gate.
 if(!pack&&env.DB){const owner=req.headers.get('oai-authenticated-user-id');need(owner,'Open your private resource library to sync this game.',403);const result=await env.DB.prepare("SELECT draft FROM workshop_jobs WHERE owner=? AND status=? AND json_extract(CASE WHEN json_valid(draft) THEN draft ELSE '{}' END,'$.id')=? ORDER BY updated DESC LIMIT 1").bind(owner,'published',id.startsWith('rpg-')?id.slice(4):id).all();pack=result.results.map(r=>{try{const p=validatePlayableContent(JSON.parse(r.draft));return id.startsWith('rpg-')&&p.template==='underlight-v1'?bundlePublishedChapter(p):p}catch{return null}}).find(p=>p&&p.id===id&&draftHash(p)===hash);}
 need(pack,'This game is available on this device only. Publish its reviewed source in the Resource Library to enable cloud progress.',422);return pack;
}
const unpack=row=>row?{version:row.version,updated:Number(row.updated_ms),...JSON.parse(row.payload)}:null;
export async function learningAPI(req,env,{session=ncbSession,store=new NCBStore(env),resolve=canonicalPack,now=()=>Date.now()}={}){try{
 checkOrigin(req);const user=await session(req,env);need(user,'Sign in to your learner account to save across devices.',401);need(req.headers.get('x-mosaic-learner')===user.id,'Your signed-in account changed. Reload this page before syncing progress.',401);
 const owner=await digest('mosaic-learner:'+user.id),url=new URL(req.url),path=url.pathname.replace(/^\/api\/learning\/?/,'');
 if(path==='creative'||path==='creative/audio')return await creativeAPI(req,env,{store,owner,resolve,now});
 if(path==='studio'||path.startsWith('studio/'))return await studioAPI(req,env,{path,store,owner,resolve,included:packs,now});
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
  const pack=await resolve(input.packId,input.contentHash,req,env),key=progressIdentity(pack,input.kind),slot=await digest(key);
  if(req.method==='GET'){const value=unpack(await store.latest('learner_saves',owner,slot));if(value){const clean=observeProgress(pack,input.kind,value.snapshot);value.snapshot=clean.snapshot;value.summary=clean.summary;value.key=key;}return noStore({save:value,...(input.kind==='rpg'?{content:pack}:{})});}
  need(Number.isInteger(input.expectedVersion)&&input.expectedVersion>=0&&input.expectedVersion<2147483646,'Invalid save version.');
  const clean=observeProgress(pack,input.kind,input.snapshot),row=await store.write('learner_saves',owner,slot,input.expectedVersion,{key,...clean},now());return noStore({save:unpack(row)});
 }
 return noStore({error:'Learning route not found.'},404);
 }catch(e){return noStore({error:e instanceof StoreError?e.message:e.status?e.message:'The learning record could not be validated. Your device save is unchanged.'},e.status||400)}}
