import test from 'node:test';import assert from 'node:assert/strict';
import {learningAPI} from '../server/learning-api.js';
import {StoreError,NCBStore} from '../server/ncb-store.js';
import {authAPI,ncbSession,authCookies} from '../server/ncb-auth.js';
import {EXTENDED_PACKS} from '../src/game-modes/extended-packs.js';
import {newJourney,actJourney} from '../src/game-modes/journey-engine.js';
import {draftHash} from '../src/game-modes/draft-engine.js';
import {LearningJournal} from '../src/game-modes/learning-client.js';
import {observeProgress,progressIdentity,recommendations,normaliseProfile} from '../src/game-modes/learning-model.js';
import {ADVENTURE_PACKS} from '../src/game-modes/adventure-content.js';
import {initialAdventureState,reduceAdventure} from '../src/game-modes/adventure-engine.js';
import {DRAFT_PACKS} from '../src/game-modes/draft-content.js';
import {newDraft,draftHand,pickDraftCard,answerDraft,nextDraftScenario} from '../src/game-modes/draft-engine.js';
import {TOWN_PACKS} from '../src/game-modes/town-packs.js';
import {newTown,actTown,pendingEvent,encodeTown} from '../src/game-modes/town-engine.js';
const p=EXTENDED_PACKS.find(p=>p.template==='quiz-v1'),raw=actJourney(p,newJourney(p,17),{type:'travel',index:0});
class MemoryStore{rows=new Map();async latest(table,owner,slot){return this.rows.get([table,owner,slot].join(':'))||null}async list(owner){return [...this.rows.values()].filter(r=>r.owner===owner&&r.table==='learner_saves')}async write(table,owner,slot,version,payload,now){const key=[table,owner,slot].join(':'),old=this.rows.get(key);if((old?.version||0)!==version)throw new StoreError('conflict',409);const row={table,owner,payload:JSON.stringify(payload),version:version+1,updated_ms:now};this.rows.set(key,row);return row;}}
const req=(path,body,user='a',origin='https://game.test')=>new Request('https://game.test/api/learning/'+path,{method:body?'POST':'GET',headers:{'X-Mosaic-Learner':user,Origin:origin,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
test('learner storage requires a validated NCB identity and rejects cross-origin/account-switched writes',async()=>{const store=new MemoryStore(),body={expectedVersion:0,profile:{goal:'test'}};
 assert.equal((await learningAPI(req('profile',body),{}, {store,session:async()=>null})).status,401);
 assert.equal((await learningAPI(req('profile',body,'b'),{}, {store,session:async()=>({id:'a'})})).status,401);
 assert.equal((await learningAPI(req('profile',body,'a','https://evil.test'),{}, {store,session:async()=>({id:'a'})})).status,403);assert.equal(store.rows.size,0);
});
test('profiles and validated saves are isolated by account; stale versions cannot overwrite',async()=>{const store=new MemoryStore(),opts=id=>({store,session:async()=>({id})});
 assert.equal((await learningAPI(req('profile',{expectedVersion:0,profile:{goal:'Account A'},owner:'b'}),{},opts('a'))).status,200);
 assert.equal((await learningAPI(req('profile',{expectedVersion:0,profile:{goal:'stale'}}),{},opts('a'))).status,409);
 assert.equal((await (await learningAPI(req('journal',null,'b'),{},opts('b'))).json()).profile,null);
 const input={packId:p.id,contentHash:draftHash(p),kind:'journey',expectedVersion:0,snapshot:raw,summary:{completed:true}};
 const saved=await (await learningAPI(req('save',input),{},opts('a'))).json();assert.equal(saved.save.summary.completed,false);
 assert.equal((await (await learningAPI(req('journal',null,'b'),{},opts('b'))).json()).records.length,0);
 assert.equal((await learningAPI(req('save',{...input,snapshot:{...raw,history:[{type:'award',score:999}]},expectedVersion:1}),{},opts('a'))).status,400);
 assert.equal((await learningAPI(req('save',{...input,packId:'unpublished'}),{},opts('a'))).status,422);
});
test('NCB adapter verifies returned ownership rather than trusting upstream filtering',async()=>{const store=new NCBStore({NCB_INSTANCE:'test',NCB_SECRET_KEY:'not-a-key'},async()=>Response.json({status:'success',data:[{owner_key:'other',slot_key:'profile'}]}));await assert.rejects(()=>store.latest('learner_profiles','a','profile'),/verified/);});
test('a damaged cloud row does not prevent other records from loading',async()=>{const clean=observeProgress(p,'journey',raw),payload=JSON.stringify({key:progressIdentity(p,'journey'),...clean});const store={latest:async()=>({version:2,payload:'broken'}),list:async()=>[{version:1,updated_ms:1,payload:'{'},{version:1,updated_ms:2,payload}]};const response=await learningAPI(req('journal'),{},{store,session:async()=>({id:'a'})});assert.equal(response.status,200);const data=await response.json();assert.equal(data.profile,null);assert.equal(data.profileVersion,2);assert.equal(data.records.length,1);assert.match(data.warning,/could not be read/);});
test('a delayed read after insertion is polled without a second insertion',async()=>{let inserts=0,reads=0;const payload={profile:normaliseProfile({goal:'test'})};const saved={owner_key:'a',slot_key:'profile',version:1,payload:JSON.stringify(payload),updated_ms:1};const store=new NCBStore({NCB_INSTANCE:'test',NCB_SECRET_KEY:'not-a-key'},async(url,options)=>{if(options.method==='POST'){inserts++;return Response.json({status:'success',id:1})}reads++;return Response.json({status:'success',data:reads<3?[]:new URL(url).searchParams.has('version[lt]')?[]:[saved],metadata:{hasMore:false}})});assert.equal((await store.write('learner_profiles','a','profile',0,payload)).version,1);assert.equal(inserts,1);});
test('auth gateway pins database and origin, strips client token fields, and preserves secure production cookies',async()=>{let seen;const env={NCB_INSTANCE:'test',NCB_SECRET_KEY:'not-a-key'},fetcher=async(url,opts)=>{seen={url,opts};return new Response(JSON.stringify({user:{id:'a'},token:'secret'}),{headers:{'Set-Cookie':'__Secure-better-auth.session_token=example; Domain=app.nocodebackend.com; Path=/; HttpOnly; Secure'}})};
 const response=await authAPI(new Request('https://game.test/api/auth/sign-in/email?instance=attacker',{method:'POST',headers:{Origin:'https://game.test','Content-Type':'application/json',Cookie:'unrelated=private; better-auth.session_token=old'},body:JSON.stringify({email:'x@example.test',password:'sample',instance:'attacker',user_id:'b'})}),env,fetcher);
 assert.ok(seen.url.includes('instance=test'));assert.equal(seen.opts.headers.Cookie,'better-auth.session_token=old');assert.deepEqual(JSON.parse(seen.opts.body),{email:'x@example.test',password:'sample'});assert.equal((await response.json()).token,undefined);assert.match(response.headers.get('set-cookie'),/Secure/);assert.doesNotMatch(response.headers.get('set-cookie'),/Domain=/);
 assert.equal(authCookies(new Request('https://game.test',{headers:{Cookie:'a=1; better-auth.session_token=x; abcbetter-auth.session_token=evil'}})),'better-auth.session_token=x');
});
test('corrupt preferences cannot erase journal history, and corrupt observations cannot break suggestions',()=>{const data=new Map(),storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};globalThis.localStorage=storage;
 const {summary}=observeProgress(p,'journey',raw),record={key:progressIdentity(p,'journey'),summary,updated:1};data.set('mosaic:learning-profile:v1','{broken');data.set('mosaic:practice-journal:v1',JSON.stringify([record]));let journal=new LearningJournal();assert.equal(journal.records.length,1);journal.observe({pack:p,record:raw,kind:'journey'});assert.equal(JSON.parse(data.get('mosaic:practice-journal:v1')).length,1);
 const bad={...record,summary:{...summary,observations:[null]}};data.set('mosaic:practice-journal:v1',JSON.stringify([record,bad]));journal=new LearningJournal();assert.equal(journal.records.length,1);assert.ok(data.get('mosaic:practice-journal:v1:recovery'));assert.doesNotThrow(()=>recommendations(EXTENDED_PACKS,[bad],normaliseProfile()));
 journal.user={id:'b'};journal.loadLocal();assert.equal(journal.records.length,0);assert.equal(journal.storage.getItem('mosaic:practice-journal:v1'),null);delete globalThis.localStorage;
});
test('completed adventures, drafts and towns produce validated topic-bound learning records',()=>{
 for(const pack of ADVENTURE_PACKS){let state=initialAdventureState(pack);const step=a=>state=reduceAdventure(pack,state,a).state;for(const a of [{type:'talk'},{type:'inspect'},{type:'travel',room:'woods'},{type:'inspect'},{type:'collect'},{type:'travel',room:'workshop'},{type:'repair',item:'tool'},{type:'travel',room:'archive'},{type:'inspect'},...pack.sequence.solution.map(index=>({type:'plate',index})),{type:'sequence'},{type:'choice',id:pack.decision.choices[0].id}])step(a);const result=observeProgress(pack,'classic',state);assert.equal(result.summary.completed,true);assert.equal(result.summary.observations[0].correct,true);assert.deepEqual(result.snapshot,state);}
 for(const pack of DRAFT_PACKS){let state=newDraft(pack,33);for(let i=0;i<5;i++)state=pickDraftCard(pack,state,draftHand(pack,state)[0].id);for(let i=0;i<4;i++){state=answerDraft(pack,state,pack.scenarios[i].solution);state=nextDraftScenario(pack,state);}const result=observeProgress(pack,'classic',state);assert.equal(result.summary.completed,true);assert.equal(result.summary.observations.length,4);assert.deepEqual(result.snapshot,state);}
 for(const pack of TOWN_PACKS){let state=newTown();while(state.status==='playing'){if(pendingEvent(state)>=0)state=actTown(pack,state,{type:'decision',choice:1});state=actTown(pack,state,{type:'advance'});}const result=observeProgress(pack,'classic',encodeTown(pack,state));assert.equal(result.summary.completed,true);assert.equal(result.summary.observations.length,4);assert.ok(result.summary.observations.every(o=>o.correct===null&&o.sources.length));}
});


test('older published chapters remain canonical after more than thirty newer copies',async()=>{
 const {DatabaseSync}=await import('node:sqlite'),{canonicalPack}=await import('../server/learning-api.js');const db=new DatabaseSync(':memory:');
 db.exec('CREATE TABLE workshop_jobs(owner TEXT,status TEXT,draft TEXT,updated INTEGER)');
 const source=structuredClone(EXTENDED_PACKS.find(p=>p.template==='quiz-v1'));source.id='generated-old-revision';
 const insert=db.prepare('INSERT INTO workshop_jobs VALUES (?,?,?,?)');insert.run('alice','published',JSON.stringify(source),1);
 for(let i=0;i<35;i++)insert.run('alice','published',JSON.stringify({...source,id:'generated-new-'+i}),i+2);
 insert.run('alice','published','invalid-json',100);insert.run('bob','published',JSON.stringify({...source,title:'Foreign copy'}),101);
 const DB={prepare:sql=>({bind:(...values)=>({all:async()=>({results:db.prepare(sql).all(...values)})})})};
 const request=new Request('https://game.test/api/learning/save',{headers:{'oai-authenticated-user-id':'alice'}});
 assert.equal((await canonicalPack(source.id,draftHash(source),request,{DB},'alice')).title,source.title);db.close();
});
test('NCB network interruption is a temporary service error rather than invalid learner data',async()=>{
 let attempts=0;const store=new NCBStore({NCB_INSTANCE:'test',NCB_SECRET_KEY:'not-a-key'},async()=>{attempts++;throw new TypeError('Network unavailable')});
 await assert.rejects(()=>store.latest('learner_profiles','a','profile'),e=>e instanceof StoreError&&e.status===503&&/temporarily unavailable/.test(e.message));assert.equal(attempts,1);
});

test('saving prunes fifty old versions in one owner-checked request and keeps the confirmed version',async()=>{
 const calls=[],payload={profile:{goal:'capacity'}},confirmed={id:51,owner_key:'a',slot_key:'profile',version:51,payload:JSON.stringify(payload)};
 let inserted=false;
 const store=new NCBStore({NCB_INSTANCE:'test',NCB_SECRET_KEY:'not-a-key'},async(url,options)=>{
  assert(options.signal instanceof AbortSignal);calls.push({url:String(url),method:options.method,body:options.body});
  if(String(url).includes('/create/')){inserted=true;return Response.json({status:'success'});}
  if(String(url).includes('/bulk/delete/')){assert.deepEqual(JSON.parse(options.body).ids,Array.from({length:50},(_,i)=>i+1));return Response.json({status:'success'});}
  const old=new URL(url).searchParams.has('version[lt]');
  return Response.json({status:'success',data:old?Array.from({length:50},(_,i)=>({id:i+1,owner_key:'a',slot_key:'profile',version:i+1})):[inserted?confirmed:{...confirmed,id:50,version:50,payload:'{}'}]});
 });
 assert.equal((await store.write('learner_profiles','a','profile',50,payload)).version,51);
 assert.equal(calls.length,5);assert.equal(calls.filter(c=>c.method==='DELETE').length,1);
});

test('a whole-save deadline interrupts confirmation and an acknowledged retry never inserts twice',async t=>{
 const timeout=AbortSignal.timeout.bind(AbortSignal);
 t.mock.method(AbortSignal,'timeout',ms=>timeout(ms===55000?25:ms));
 const payload={profile:{goal:'deadline'}},saved={id:1,owner_key:'a',slot_key:'profile',version:1,payload:JSON.stringify(payload)};
 let inserts=0,allowRead=false;
 const store=new NCBStore({NCB_INSTANCE:'test',NCB_SECRET_KEY:'not-a-key'},async(url,options)=>{
  if(options.method==='POST'){inserts++;return Response.json({status:'success'});}
  if(inserts&&!allowRead)return new Promise((resolve,reject)=>{
   if(options.signal.aborted)reject(options.signal.reason);else options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true});
  });
  return Response.json({status:'success',data:inserts?[saved]:[]});
 });
 // AbortSignal timers are unref'ed; this keeps the isolated test alive.
 const keepAlive=setTimeout(()=>{},1000);
 try {
  await assert.rejects(store.write('learner_profiles','a','profile',0,payload),e=>e.status===503&&/whether the cloud save completed/.test(e.message));
  allowRead=true;assert.equal((await store.write('learner_profiles','a','profile',0,payload)).id,1);assert.equal(inserts,1);
 } finally {clearTimeout(keepAlive);}
});

test('confirmation avoids cached pre-write latest results but still detects a newer competing version',async()=>{
 for(const competing of [false,true]){
  let writes=0,qualified=0;
  const payload={profile:{goal:'fresh confirmation'}};
  const store=new NCBStore({NCB_INSTANCE:'test',NCB_SECRET_KEY:'not-a-key'},async(url,options)=>{
   if(options.method==='POST'){writes++;return Response.json({status:'success'});}
   const q=new URL(url).searchParams;
   if(q.has('version[gte]')){qualified++;assert.equal(q.get('version[gte]'),writes?'1':'0');if(!writes)return Response.json({status:'success',data:[]});return Response.json({status:'success',data:[{owner_key:'a',slot_key:'profile',version:competing?2:1,payload:competing?'{}':JSON.stringify(payload)}]});}
   return Response.json({status:'success',data:[]}); // stale pre-write cache
  });
  if(competing)await assert.rejects(store.write('learner_profiles','a','profile',0,payload),e=>e.status===409);
  else assert.equal((await store.write('learner_profiles','a','profile',0,payload)).version,1);
  assert.equal(writes,1);assert.equal(qualified,2);
 }
});

 test('initial save reads include the expected version and reject newer competing writes',async()=>{
 for(const expected of [0,5]){
  let requests=0;const payload={profile:{goal:'conflict'}};
  const store=new NCBStore({NCB_INSTANCE:'test',NCB_SECRET_KEY:'not-a-key'},async(url,options)=>{
   requests++;assert.equal(options.method,'GET');assert.equal(new URL(url).searchParams.get('version[gte]'),String(expected));
   return Response.json({status:'success',data:[{owner_key:'a',slot_key:'profile',version:expected+1,payload:'{}'}]});
  });
  await assert.rejects(store.write('learner_profiles','a','profile',expected,payload),e=>e.status===409);assert.equal(requests,1);
 }
});

test('a first save uses different version bounds before and after insertion',async()=>{
 const cached=new Map();let stored=null;
 const store=new NCBStore({NCB_INSTANCE:'test',NCB_SECRET_KEY:'not-a-key'},async(url,options)=>{
  if(options.method==='POST'){stored=JSON.parse(options.body);return Response.json({status:'success'});}
  const q=new URL(url).searchParams;if(q.has('version[lt]'))return Response.json({status:'success',data:[]});
  const key=q.get('version[gte]');assert.notEqual(key,null);
  if(!cached.has(key))cached.set(key,stored?[stored]:[]);
  return Response.json({status:'success',data:cached.get(key)});
 });
 assert.equal((await store.write('learner_profiles','a','profile',0,{profile:{goal:'fresh'}})).version,1);
 assert.deepEqual([...cached.keys()],['0','1']);
});

test('upstream account throttling fails closed and logs only status metadata',async t=>{
 const logs=[];t.mock.method(console,'warn',text=>logs.push(JSON.parse(text)));
 const request=new Request('https://mosaic.example/api/learning/journal',{headers:{Cookie:'better-auth.session_token=private-cookie'}});
 await assert.rejects(ncbSession(request,{NCB_INSTANCE:'private-instance',NCB_SECRET_KEY:'private-key'},async()=>new Response('{}',{status:429,headers:{'Retry-After':'30'}})),e=>e.status===503&&/rate-limited/.test(e.message));
 assert.deepEqual(logs,[{event:'ncb_session_failure',status:429,retryAfterSeconds:30}]);
});
