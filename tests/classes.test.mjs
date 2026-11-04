import test from 'node:test';
import assert from 'node:assert/strict';
import {D1,Bucket} from './helpers/media-storage.mjs';
import {pilotAPI,learnerOwner,PILOT_NOTICE} from '../server/pilot-access.js';
import {learningAPI} from '../server/learning-api.js';
import {deleteClassData,weekOf} from '../server/classes-api.js';
import {sqlDB} from '../server/data-control.js';

class Store{
 rows=new Map();
 async latest(t,o,s){return this.rows.get(t+o+s)||null}
 async list(o){return [...this.rows.values()].filter(r=>r.owner_key===o&&r.table==='learner_saves')}
 async allRows(t,o){return [...this.rows.values()].filter(r=>r.owner_key===o&&r.table===t)}
 async deleteRows(t,o,ids){for(const [key,r] of this.rows)if(r.table===t&&r.owner_key===o&&ids.includes(r.id))this.rows.delete(key)}
 async write(t,o,s,v,p,at){const r={table:t,owner_key:o,slot_key:s,version:v+1,payload:JSON.stringify(p),updated_ms:at,id:crypto.randomUUID()};this.rows.set(t+o+s,r);return r}
}
const user=(id,name=id)=>({id,email:id+'@example.test',name,emailVerified:true});

async function setup(){
 const admin=user('admin'),store=new Store();let clock=Date.UTC(2026,10,4,9);
 const env={DB:new D1(),BUCKET:new Bucket(),PILOT_ENABLED:'true',PILOT_ADMIN_OWNER:await learnerOwner(admin)};
 const req=(u,path,body)=>new Request('https://game.test'+path,{method:body?'POST':'GET',headers:{Origin:'https://game.test','Content-Type':'application/json','X-Mosaic-Learner':u.id},body:body?JSON.stringify(body):undefined});
 const pilot=async(u,body)=>{const r=await pilotAPI(req(u,'/api/pilot',body),env,{session:async()=>u,store});return {status:r.status,...await r.json()}};
 const join=async(u,extra={},manager=admin)=>{const i=await pilot(manager,{action:'invite',email:u.email,...extra});assert.equal(i.status,200,JSON.stringify(i));assert.equal((await pilot(u,{action:'claim',code:i.code})).status,200);assert.equal((await pilot(u,{action:'onboarding',ageBand:'18plus',confirmed:true,noticeVersion:PILOT_NOTICE,expectedVersion:0})).status,200)};
 const classes=async(u,body,query='')=>{const r=await learningAPI(req(u,'/api/learning/classes'+query,body),env,{session:async()=>u,store,now:()=>clock});return {status:r.status,...await r.json()}};
 const teacher=user('teacher','Sam Patel'),other=user('teacher-2','Jo Lee'),a=user('learner-a','Amelia Hughes'),b=user('learner-b','Ben Carter'),c=user('learner-c','Chloe Lewis');
 await join(teacher,{role:'teacher',context:'school',managedApproval:true});await join(other,{role:'teacher',context:'school',managedApproval:true});
 for(const l of [a,b,c])await join(l);
 // Saves a game result to the learner's account: n questions answered (the server counts these as steps).
 const play=async(u,n,slot='game-1')=>{const observations=Array.from({length:n},(_,i)=>({key:'q-'+i,correct:true,attempts:1,assisted:false,sources:[]}));await store.write('learner_saves',await learnerOwner(u),slot,0,{key:slot,summary:{packId:'pack-'+slot,title:'Game',template:'quiz-v1',contentHash:'h',kind:'journey',completed:false,engagement:n,observations}},clock)};
 return {env,store,teacher,other,a,b,c,classes,join,user,play,tick:ms=>{clock+=ms},now:()=>clock};
}

test('teachers create separate classes with their own join codes', async () => {
 const h=await setup();
 const one=await h.classes(h.teacher,{action:'create',name:'Year 8 History'});assert.equal(one.status,200,JSON.stringify(one));
 const two=await h.classes(h.other,{action:'create',name:'Year 9 Science'});
 assert.match(one.class.code,/^[A-HJ-NP-Z2-9]{6}$/);assert.notEqual(one.class.code,two.class.code);
 assert.equal((await h.classes(h.a,{action:'create',name:'Not allowed'})).status,403);
 const mine=await h.classes(h.teacher);assert.deepEqual(mine.teaching.map(c=>c.name),['Year 8 History']);
 assert.equal((await h.classes(h.other,undefined,'?view=overview&id='+one.class.id)).status,403);
 assert.equal((await h.classes(h.other,{action:'rename',id:one.class.id,name:'Taken'})).status,403);
});

test('learners join with a code, see only their classes, and can leave', async () => {
 const h=await setup(),c=(await h.classes(h.teacher,{action:'create',name:'Year 8 History'})).class;
 assert.equal((await h.classes(h.a,{action:'join',code:'ZZZZZZ'})).status,404);
 const joined=await h.classes(h.a,{action:'join',code:c.code.toLowerCase().slice(0,3)+'-'+c.code.slice(3)});assert.equal(joined.status,200,JSON.stringify(joined));
 assert.equal(joined.joined.teacher,'Sam P.');
 const list=await h.classes(h.a);assert.equal(list.joined.length,1);assert.equal(list.joined[0].name,'Year 8 History');assert.equal(list.joined[0].code,undefined,'learners do not see the join code');
 assert.equal((await h.classes(h.b)).joined.length,0);
 const overview=await h.classes(h.teacher,undefined,'?view=overview&id='+c.id);
 assert.equal(overview.counts.learners,1);assert.equal(overview.learners[0].label,'Amelia H.');assert.equal(overview.learners[0].lastShared,null,'not sharing is not activity');
 assert.equal((await h.classes(h.a,{action:'leave',id:c.id})).status,200);
 assert.equal((await h.classes(h.teacher,undefined,'?view=overview&id='+c.id)).counts.learners,0);
 const regen=await h.classes(h.teacher,{action:'code',id:c.id});assert.notEqual(regen.class.code,c.code);
 assert.equal((await h.classes(h.b,{action:'join',code:c.code})).status,404,'old code stops working');
 await h.classes(h.teacher,{action:'archive',id:c.id});assert.equal((await h.classes(h.b,{action:'join',code:regen.class.code})).status,409);
});

test('the leaderboard is off until the teacher enables it, and only opted-in learners appear', async () => {
 const h=await setup(),c=(await h.classes(h.teacher,{action:'create',name:'Year 8 History'})).class;
 for(const l of [h.a,h.b,h.c])await h.classes(l,{action:'join',code:c.code});
 assert.equal((await h.classes(h.a,undefined,'?view=board&id='+c.id)).leaderboard.enabled,false);
 await h.classes(h.teacher,{action:'leaderboard',id:c.id,enabled:true});
 assert.equal((await h.classes(h.a,{action:'board',id:c.id,optIn:true,nickname:'<script>'})).status,400);
 await h.classes(h.a,{action:'board',id:c.id,optIn:true,nickname:'River Fox'});
 await h.classes(h.b,{action:'board',id:c.id,optIn:true,nickname:'Lamp'});
 await h.play(h.a,6);await h.play(h.b,9);await h.play(h.c,4);
 await h.classes(h.a,{action:'steps',id:c.id,tiles:999});await h.classes(h.b,{action:'steps',id:c.id});
 assert.equal((await h.classes(h.c,{action:'steps',id:c.id})).stored,false,'steps are never stored without opting in');
 const board=(await h.classes(h.a,undefined,'?view=board&id='+c.id)).leaderboard;
 assert.deepEqual(board.entries.map(e=>[e.nickname,e.tiles]),[['Lamp',9],['River Fox',6]]);assert.equal(board.you.rank,2);
 assert.ok(!JSON.stringify(board).includes(h.a.id)&&!JSON.stringify(board).includes('Amelia'),'only nicknames are shown');
 h.tick(7*86400000);assert.ok(weekOf(h.now())>board.week);
 const fresh=(await h.classes(h.a,undefined,'?view=board&id='+c.id)).leaderboard;
 assert.deepEqual(fresh.entries.map(e=>[e.rank,e.tiles]),[[null,null],[null,null]],'no report this week is not reported, never zero');
 assert.equal(fresh.reported,0);assert.equal(fresh.you.rank,null);
 await h.classes(h.b,{action:'board',id:c.id,optIn:false});
 assert.deepEqual((await h.classes(h.a,undefined,'?view=board&id='+c.id)).leaderboard.entries.map(e=>e.nickname),['River Fox']);
 assert.equal((await h.classes(h.other,undefined,'?view=board&id='+c.id)).status,403,'non-members cannot see the board');
});

test('explanations reach the teacher only when shared, and stopping sharing removes them', async () => {
 const h=await setup(),c=(await h.classes(h.teacher,{action:'create',name:'Year 8 History'})).class;
 await h.classes(h.a,{action:'join',code:c.code});
 assert.equal((await h.classes(h.a,{action:'share',id:c.id,key:'unit-1:reflect',title:'Mill towns',text:'Mills went where the river drops.'})).status,400,'needs confirmation');
 assert.equal((await h.classes(h.b,{action:'share',id:c.id,key:'x',title:'t',text:'t',confirmed:true})).status,403,'non-members cannot share');
 await h.classes(h.a,{action:'share',id:c.id,key:'unit-1:reflect',title:'Mill towns',text:'Mills went where the river drops.',confirmed:true});
 let o=await h.classes(h.teacher,undefined,'?view=overview&id='+c.id);
 assert.equal(o.shares.length,1);assert.equal(o.shares[0].text,'Mills went where the river drops.');assert.ok(o.learners[0].lastShared);assert.equal(o.counts.unread,1);
 assert.equal((await h.classes(h.other,{action:'feedback',id:c.id,handle:o.shares[0].handle,key:'unit-1:reflect',strength:'x'})).status,403);
 assert.equal((await h.classes(h.teacher,{action:'feedback',id:c.id,handle:o.shares[0].handle,key:'unit-1:reflect',strength:'Great link to the river.',sticker:'skull'})).status,400);
 await h.classes(h.teacher,{action:'feedback',id:c.id,handle:o.shares[0].handle,key:'unit-1:reflect',strength:'Great link to the river.',nextStep:'Add a source.',sticker:'star'});
 const mine=await h.classes(h.a);assert.equal(mine.joined[0].shares[0].feedback.sticker,'star');
 await h.classes(h.a,{action:'unshare',id:c.id,key:'unit-1:reflect'});
 o=await h.classes(h.teacher,undefined,'?view=overview&id='+c.id);assert.equal(o.shares.length,0);assert.equal(o.learners[0].lastShared,null);
});

test('deleting account data removes class membership, shares and owned classes', async () => {
 const h=await setup(),c=(await h.classes(h.teacher,{action:'create',name:'Year 8 History'})).class;
 await h.classes(h.a,{action:'join',code:c.code});await h.classes(h.teacher,{action:'leaderboard',id:c.id,enabled:true});
 await h.classes(h.a,{action:'board',id:c.id,optIn:true,nickname:'River Fox'});await h.classes(h.a,{action:'share',id:c.id,key:'k1',title:'T',text:'Text',confirmed:true});
 const db=sqlDB(h.env.DB),count=async()=>(await db.one("SELECT COUNT(*) AS n FROM data_controls WHERE scope LIKE 'class%'")).n;
 assert.equal(await count(),5);
 await deleteClassData(h.env,await learnerOwner(h.a));assert.equal(await count(),2,'class and code remain');
 await deleteClassData(h.env,await learnerOwner(h.teacher));assert.equal(await count(),0);
});

test('archiving keeps withdrawal open: learners can still stop sharing and leave', async () => {
 const h=await setup(),c=(await h.classes(h.teacher,{action:'create',name:'Year 8 History'})).class;
 await h.classes(h.a,{action:'join',code:c.code});await h.classes(h.a,{action:'share',id:c.id,key:'k1',title:'T',text:'Text',confirmed:true});
 await h.classes(h.teacher,{action:'archive',id:c.id});
 const mine=await h.classes(h.a);assert.equal(mine.joined.length,1);assert.equal(mine.joined[0].archived,true);assert.equal(mine.joined[0].shares.length,1);
 assert.equal((await h.classes(h.a,{action:'share',id:c.id,key:'k2',title:'T',text:'More',confirmed:true})).status,409,'no new sharing into a closed class');
 assert.equal((await h.classes(h.a,{action:'unshare',id:c.id,key:'k1'})).status,200);
 assert.equal((await h.classes(h.a,{action:'leave',id:c.id})).status,200);
 assert.equal((await h.classes(h.a)).joined.length,0);
});

test('a withdrawn learner can still leave and stop sharing, but cannot share more', async () => {
 const h=await setup(),c=(await h.classes(h.other,{action:'create',name:'Year 9 Science'})).class;
 await h.classes(h.a,{action:'join',code:c.code});await h.classes(h.a,{action:'share',id:c.id,key:'k1',title:'T',text:'Text',confirmed:true});
 const admin={id:'admin',email:'admin@example.test',name:'admin',emailVerified:true};
 const r=await pilotAPI(new Request('https://game.test/api/pilot',{method:'POST',headers:{Origin:'https://game.test','Content-Type':'application/json','X-Mosaic-Learner':'admin'},body:JSON.stringify({action:'revoke',accountReference:await learnerOwner(h.a)})}),h.env,{session:async()=>admin,store:h.store});
 assert.equal(r.status,200,await r.clone().text());
 assert.equal((await h.classes(h.a,{action:'share',id:c.id,key:'k2',title:'T',text:'More',confirmed:true})).status,403);
 assert.equal((await h.classes(h.a,{action:'unshare',id:c.id,key:'k1'})).status,200);
 assert.equal((await h.classes(h.a,{action:'leave',id:c.id})).status,200);
});

test('revoking or transferring a learner removes them from the old organiser\'s classes', async () => {
 const h=await setup(),d=user('learner-d','Dana Rose');
 const admin={id:'admin',email:'admin@example.test',name:'admin',emailVerified:true};
 const pilot=async(u,body)=>{const r=await pilotAPI(new Request('https://game.test/api/pilot',{method:'POST',headers:{Origin:'https://game.test','Content-Type':'application/json','X-Mosaic-Learner':u.id},body:JSON.stringify(body)}),h.env,{session:async()=>u,store:h.store});return {status:r.status,...await r.json()}};
 const i=await pilot(h.teacher,{action:'invite',email:d.email,context:'school',managedApproval:true});assert.equal(i.status,200,JSON.stringify(i));
 await pilot(d,{action:'claim',code:i.code});await pilot(d,{action:'onboarding',ageBand:'18plus',confirmed:true,noticeVersion:PILOT_NOTICE,expectedVersion:0});
 const c=(await h.classes(h.teacher,{action:'create',name:'Year 8 History'})).class;await h.classes(d,{action:'join',code:c.code});
 await h.classes(d,{action:'share',id:c.id,key:'k1',title:'T',text:'Text',confirmed:true});
 assert.equal((await h.classes(h.teacher,undefined,'?view=overview&id='+c.id)).counts.learners,1);
 const moved=await pilot(admin,{action:'reassign',accountReference:await learnerOwner(d),manager:await learnerOwner(h.other)});assert.equal(moved.status,200,JSON.stringify(moved));
 const o=await h.classes(h.teacher,undefined,'?view=overview&id='+c.id);assert.equal(o.counts.learners,0);assert.equal(o.shares.length,0);
});

test('teachers see per-class handles, never account references, and handles cannot be wildcards', async () => {
 const h=await setup(),c=(await h.classes(h.teacher,{action:'create',name:'Year 8 History'})).class;
 await h.classes(h.a,{action:'join',code:c.code});await h.classes(h.b,{action:'join',code:c.code});
 await h.classes(h.a,{action:'share',id:c.id,key:'k1',title:'T',text:'Text',confirmed:true});
 const o=await h.classes(h.teacher,undefined,'?view=overview&id='+c.id),body=JSON.stringify(o);
 for(const l of [h.a,h.b])assert.ok(!body.includes(await learnerOwner(l)),'no account references in the overview');
 assert.equal((await h.classes(h.teacher,{action:'remove',id:c.id,handle:'%'})).status,400);
 assert.equal((await h.classes(h.teacher,{action:'remove',id:c.id,handle:'0'.repeat(32)})).status,404);
 const a=o.learners.find(l=>l.label==='Amelia H.');assert.equal((await h.classes(h.teacher,{action:'remove',id:c.id,handle:a.handle})).status,200);
 const after=await h.classes(h.teacher,undefined,'?view=overview&id='+c.id);assert.equal(after.counts.learners,1);assert.equal(after.shares.length,0);
});

test('wrong codes are rate-limited per learner', async () => {
 const h=await setup();
 for(let i=0;i<10;i++)assert.equal((await h.classes(h.a,{action:'join',code:'ZZZZZ'+i})).status,404);
 assert.equal((await h.classes(h.a,{action:'join',code:'ZZZZZZ'})).status,429);
 h.tick(3600001);assert.equal((await h.classes(h.a,{action:'join',code:'ZZZZZZ'})).status,404,'the limit resets after an hour');
});

test('turning the leaderboard off deletes nicknames and steps', async () => {
 const h=await setup(),c=(await h.classes(h.teacher,{action:'create',name:'Year 8 History'})).class;
 await h.classes(h.a,{action:'join',code:c.code});
 assert.equal((await h.classes(h.a,{action:'board',id:c.id,optIn:true,nickname:'River Fox'})).status,409,'cannot opt in while it is off');
 await h.classes(h.teacher,{action:'leaderboard',id:c.id,enabled:true});await h.classes(h.a,{action:'board',id:c.id,optIn:true,nickname:'River Fox'});
 const db=sqlDB(h.env.DB),boards=async()=>(await db.one("SELECT COUNT(*) AS n FROM data_controls WHERE scope LIKE 'class-board:%'")).n;
 assert.equal(await boards(),1);await h.classes(h.teacher,{action:'leaderboard',id:c.id,enabled:false});assert.equal(await boards(),0);
 const o=await h.classes(h.teacher,undefined,'?view=overview&id='+c.id);assert.equal(o.learners[0].lastShared,null,'leaderboard play is not sharing');
});

test('a replaced code stops working and deleting a class leaves no code behind', async () => {
 const h=await setup(),c=(await h.classes(h.teacher,{action:'create',name:'Year 8 History'})).class;
 const fresh=(await h.classes(h.teacher,{action:'code',id:c.id})).class;
 assert.equal((await h.classes(h.a,{action:'join',code:c.code})).status,404);assert.equal((await h.classes(h.a,{action:'join',code:fresh.code})).status,200);
 const db=sqlDB(h.env.DB);await db.run('INSERT INTO data_controls(scope,policy,updated) VALUES(?,?,?)','class-code:STRAY2',JSON.stringify({classId:c.id}),0);
 await h.classes(h.teacher,{action:'delete',id:c.id,confirmed:true});
 assert.equal((await db.one("SELECT COUNT(*) AS n FROM data_controls WHERE scope LIKE 'class%' AND scope NOT LIKE 'class-join-limit:%'")).n,0);
});

test('learners export their class data and retention expires old shares', async () => {
 const h=await setup(),c=(await h.classes(h.teacher,{action:'create',name:'Year 8 History'})).class;
 await h.classes(h.a,{action:'join',code:c.code});await h.classes(h.a,{action:'share',id:c.id,key:'k1',title:'Mill towns',text:'Rivers drop.',confirmed:true});
 const {exportClassData,expireClassData}=await import('../server/classes-api.js');
 const ref=await learnerOwner(h.a),out=await exportClassData(h.env,ref);
 assert.equal(out.memberships[0].className,'Year 8 History');assert.equal(out.sharedExplanations[0].text,'Rivers drop.');
 await expireClassData(h.env,ref,7,h.now()+8*86400000);
 assert.equal((await exportClassData(h.env,ref)).sharedExplanations.length,0);
});

test('steps come from the account, so every device shows the same count, and a new week starts again', async () => {
 const h=await setup(),c=(await h.classes(h.teacher,{action:'create',name:'Year 8 History'})).class;
 await h.classes(h.a,{action:'join',code:c.code});await h.classes(h.teacher,{action:'leaderboard',id:c.id,enabled:true});
 await h.classes(h.a,{action:'board',id:c.id,optIn:true,nickname:'River Fox'});
 await h.play(h.a,6);
 assert.equal((await h.classes(h.a,{action:'steps',id:c.id,tiles:0})).leaderboard.you.tiles,6,'a device with no local count still shows the account total');
 await h.play(h.a,2,'game-2');
 assert.equal((await h.classes(h.a,{action:'steps',id:c.id})).leaderboard.you.tiles,8,'games played on another device add up');
 h.tick(7*86400000);
 assert.equal((await h.classes(h.a,{action:'steps',id:c.id})).leaderboard.you.tiles,0,'last week\'s games don\'t count this week');
 await h.play(h.a,2,'game-3');
 assert.equal((await h.classes(h.a,{action:'steps',id:c.id})).leaderboard.you.tiles,2,'the weekly reset still applies');
});

test('the teacher sees every opted-in learner; learners see the top ten plus themselves', async () => {
 const h=await setup(),c=(await h.classes(h.teacher,{action:'create',name:'Year 8 History'})).class;
 await h.classes(h.teacher,{action:'leaderboard',id:c.id,enabled:true});
 const learners=[];
 for(let i=0;i<12;i++){const u=h.user('bulk-'+i,'Learner '+i);await h.join(u);learners.push(u);
  assert.equal((await h.classes(u,{action:'join',code:c.code})).status,200);
  await h.classes(u,{action:'board',id:c.id,optIn:true,nickname:'Player '+i});
  if(i<11){await h.play(u,20-i);await h.classes(u,{action:'steps',id:c.id});}}
 const o=await h.classes(h.teacher,undefined,'?view=overview&id='+c.id);
 assert.equal(o.leaderboard.entries.length,12,'teacher view is not cut at ten');
 assert.equal(o.leaderboard.reported,11);
 assert.deepEqual(o.leaderboard.entries.at(-1),{rank:null,nickname:'Player 11',tiles:null,you:false},'opted in without a report is listed, not ranked as zero');
 assert.equal(o.counts.reviewScope,'workshop');assert.ok(!('live' in o.counts));
 const mine=(await h.classes(learners[11],undefined,'?view=board&id='+c.id)).leaderboard;
 assert.equal(mine.entries.length,10);assert.equal(mine.you.nickname,'Player 11');assert.equal(mine.you.rank,null);
});
