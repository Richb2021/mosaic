import test from 'node:test';
import assert from 'node:assert/strict';
import {D1,Bucket} from './helpers/media-storage.mjs';
import {pilotAPI,learnerOwner,PILOT_NOTICE,VERIFY_NOTICE} from '../server/pilot-access.js';
import {learningAPI} from '../server/learning-api.js';
import {UNDER18_CODE_NOTICE} from '../server/classes-api.js';
import {sqlDB} from '../server/data-control.js';
import {distinctLabels} from '../src/learner-labels.js';

class Store{
 rows=new Map();
 async latest(t,o,s){return this.rows.get(t+o+s)||null}
 async list(o){return [...this.rows.values()].filter(r=>r.owner_key===o&&r.table==='learner_saves')}
 async allRows(t,o){return [...this.rows.values()].filter(r=>r.owner_key===o&&r.table===t)}
 async deleteRows(t,o,ids){for(const [key,r] of this.rows)if(r.table===t&&r.owner_key===o&&ids.includes(r.id))this.rows.delete(key)}
 async write(t,o,s,v,p,at){assert.equal((await this.latest(t,o,s))?.version||0,v);const r={table:t,owner_key:o,slot_key:s,version:v+1,payload:JSON.stringify(p),updated_ms:at,id:crypto.randomUUID()};this.rows.set(t+o+s,r);return r}
}
const user=(id,name=id)=>({id,email:id+'@example.test',name,emailVerified:true});
async function setup(){
 const admin=user('admin','Ada Admin'),store=new Store(),env={DB:new D1(),BUCKET:new Bucket(),PILOT_ENABLED:'true',PILOT_OPEN_SIGNUP:'true',PILOT_SUPPORT_EMAIL:'help@example.test',PILOT_ADMIN_OWNER:await learnerOwner(admin)};
 let stamp=1800000000000;const now=()=>stamp;
 const req=(u,path,body)=>new Request('https://game.test'+path,{method:body?'POST':'GET',headers:{Origin:'https://game.test','Content-Type':'application/json','X-Mosaic-Learner':u.id,'X-Mosaic-Data-Epoch':'0:0'},body:body?JSON.stringify(body):undefined});
 const pilot=async(u,body)=>{const r=await pilotAPI(req(u,'/api/pilot',body),env,{session:async()=>u,store,now});return {status:r.status,...await r.json()}};
 const classes=async(u,body)=>{const r=await learningAPI(req(u,'/api/learning/classes',body),env,{session:async()=>u,store,now});return {status:r.status,...await r.json()}};
 const overview=async(u,id)=>{const r=await learningAPI(req(u,'/api/learning/classes?view=overview&id='+id),env,{session:async()=>u,store,now});return {status:r.status,...await r.json()}};
 const welcome=async(u,ageBand='18plus')=>{const s=await pilot(u);return pilot(u,{action:'onboarding',ageBand,confirmed:true,noticeVersion:PILOT_NOTICE,expectedVersion:s.version||0})};
 const claim=async(u,code)=>pilot(u,{action:'claim',code});
 const selfTeacher=async(u)=>{const j=await pilot(u,{action:'join-open',as:'teacher'});assert.equal(j.status,200,JSON.stringify(j));assert.equal((await welcome(u)).status,200);return j};
 const member=async u=>JSON.parse((await sqlDB(env.DB).one('SELECT policy FROM data_controls WHERE scope=?','pilot-member:'+await learnerOwner(u))).policy);
 return {admin,env,store,pilot,classes,overview,welcome,claim,selfTeacher,member,db:sqlDB(env.DB),advance:n=>stamp+=n};
}
const pupilInvite=(email,extra={})=>({action:'invite',email,context:'school',managedApproval:true,ageBand:'13to17',...extra});

test('a self-signed-up teacher gets teacher access straight away, starts unverified, and must be 18+', async () => {
 const h=await setup(),t=user('teach-1','Tess Teacher');
 const j=await h.pilot(t,{action:'join-open',as:'teacher'});assert.equal(j.status,200,JSON.stringify(j));assert.equal(j.role,'teacher');
 const s=await h.pilot(t);assert.equal(s.admitted,true);assert.equal(s.role,'teacher');assert.equal(s.manages,true);assert.equal(s.canAuthor,true);assert.equal(s.verified,false);
 assert.equal((await h.pilot(t,{action:'onboarding',ageBand:'13to17',confirmed:true,noticeVersion:PILOT_NOTICE,expectedVersion:0})).status,403,'teachers are adults');
 assert.equal((await h.welcome(t)).status,200);
 assert.equal((await h.member(t)).verified,false);
 assert.equal((await h.pilot(t,{action:'join-open',as:'teacher'})).status,409,'only once');
 const unverifiedEmail={...user('teach-2'),emailVerified:false};
 assert.equal((await h.pilot(unverifiedEmail,{action:'join-open',as:'teacher'})).status,403,'needs a verified email');
 assert.equal((await h.pilot(user('teach-3'),{action:'join-open',as:'headteacher'})).status,400);
 h.env.PILOT_OPEN_SIGNUP='false';assert.equal((await h.pilot(user('teach-4'),{action:'join-open',as:'teacher'})).status,403,'open sign-up off');
});

test('an unverified teacher can create a class and invite adults, but every route for under-18s is refused', async () => {
 const h=await setup(),t=user('teach-1','Tess Teacher');await h.selfTeacher(t);
 const c=(await h.classes(t,{action:'create',name:'Evening coders'})).class;assert.ok(c?.code,'class created');
 // Adults: individual setting, into the class.
 const adult=user('adult-1','Alan Adult'),ai=await h.pilot(t,{action:'invite',email:adult.email,context:'individual',ageBand:'18plus',classId:c.id,label:'Alan A'});
 assert.equal(ai.status,200,JSON.stringify(ai));assert.equal(ai.className,'Evening coders');
 assert.equal((await h.claim(adult,ai.code)).joinedClass,true);
 assert.equal((await h.welcome(adult,'13to17')).status,403,'an adult invitation cannot become an under-18 account');
 assert.equal((await h.welcome(adult)).status,200);
 // Under-18s, school context, bulk with a minor band, classId for minors, contradictory settings.
 for(const body of [pupilInvite('kid@example.test'),pupilInvite('kid@example.test',{ageBand:'under13'}),pupilInvite('kid@example.test',{classId:c.id}),{action:'invite',email:'kid@example.test',context:'school',managedApproval:true},{action:'invite-many',emails:['a@example.test','b@example.test'],context:'school',managedApproval:true,ageBand:'13to17',classId:c.id},{action:'invite',email:'kid@example.test',context:'individual',ageBand:'13to17'}]){
  const r=await h.pilot(t,body);assert.equal(r.status,403,JSON.stringify(body));assert.equal(r.error,VERIFY_NOTICE);
 }
 // A pupil a verified teacher already admitted cannot use the unverified teacher's class code.
 const verified=user('teach-v','Vera Verified'),vi=await h.pilot(h.admin,{action:'invite',email:verified.email,role:'teacher',context:'school',managedApproval:true});await h.claim(verified,vi.code);await h.welcome(verified);
 const pupil=user('pupil-1','Pip Pupil'),pi=await h.pilot(verified,pupilInvite(pupil.email));assert.equal(pi.status,200,JSON.stringify(pi));await h.claim(pupil,pi.code);assert.equal((await h.welcome(pupil,'13to17')).status,200);
 const tried=await h.classes(pupil,{action:'join',code:c.code});assert.equal(tried.status,403);assert.equal(tried.error,UNDER18_CODE_NOTICE);
 const vc=(await h.classes(verified,{action:'create',name:'Year 9'})).class;assert.equal((await h.classes(pupil,{action:'join',code:vc.code})).status,200,'a verified teacher’s class still works');
 assert.equal((await h.classes(adult,{action:'join',code:c.code})).status,200,'adults can use the code');
 // The administrator can't move managed pupils to an unverified teacher either.
 assert.equal((await h.pilot(h.admin,{action:'reassign',accountReference:await learnerOwner(pupil),manager:await learnerOwner(t)})).status,403);
 // The class page shows only adults; nobody under 18 reached the class.
 const o=await h.overview(t,c.id);assert.equal(o.counts.learners,1);
});

test('teachers ask to be verified; only the administrator verifies (audited), and then pupils can be invited', async () => {
 const h=await setup(),t=user('teach-1','Tess Teacher'),other=user('teach-2','Otto Other');await h.selfTeacher(t);await h.selfTeacher(other);const ref=await learnerOwner(t);
 const asked=await h.pilot(t,{action:'verify-request',note:'Science teacher at Hillside'});assert.equal(asked.status,200,JSON.stringify(asked));
 assert.equal((await h.pilot(t)).verificationRequest.status,'open');
 const ops=(await h.pilot(h.admin)).operations;assert.equal(ops.teacherRequests.length,1);assert.equal(ops.teacherRequests[0].note,'Science teacher at Hillside');assert.equal(ops.teacherRequests[0].email,t.email);
 assert.equal((await h.pilot(t)).operations,null,'teachers never see the request list');
 // Only the administrator can verify: not the teacher themself, not another teacher, not a learner.
 for(const u of [t,other])assert.equal((await h.pilot(u,{action:'teacher-verify',accountReference:ref})).status,403);
 assert.equal((await h.member(t)).verified,false);
 const v=await h.pilot(h.admin,{action:'teacher-verify',accountReference:ref});assert.equal(v.status,200,JSON.stringify(v));assert.equal(v.closedRequest,true);
 const m=await h.member(t);assert.equal(m.verified,true);assert.ok(m.verifiedAt);
 assert.ok(await h.db.one('SELECT 1 AS x FROM data_events WHERE scope=? AND action=?','pilot-member:'+ref,'teacher-verified'),'verification is audited');
 assert.equal((await h.pilot(h.admin)).operations.teacherRequests.length,0,'request closed');
 assert.equal((await h.pilot(t,{action:'verify-request'})).status,409,'already verified');
 // Now pupils work, into a class too.
 const c=(await h.classes(t,{action:'create',name:'Year 8 Science'})).class,pupil=user('pupil-1','Noah Brown');
 const pi=await h.pilot(t,pupilInvite(pupil.email,{classId:c.id,label:'Noah Brown'}));assert.equal(pi.status,200,JSON.stringify(pi));
 assert.equal((await h.claim(pupil,pi.code)).joinedClass,true);assert.equal((await h.welcome(pupil,'13to17')).status,200);
 const o=await h.overview(t,c.id);assert.equal(o.learners[0].label,'Noah Brown','the teacher’s own label, not “Noah B.”');
 // Declining keeps the teacher unverified.
 await h.pilot(other,{action:'verify-request'});
 assert.equal((await h.pilot(h.admin,{action:'teacher-verify-decline',accountReference:await learnerOwner(other)})).status,200);
 assert.equal((await h.member(other)).verified,false);assert.equal((await h.pilot(other)).verificationRequest.status,'declined');
 assert.equal((await h.pilot(other,pupilInvite('kid@example.test'))).status,403);
});

test('teachers the administrator invited, including old rows with no flag, count as verified', async () => {
 const h=await setup(),t=user('legacy-teacher','Lee Legacy');
 await h.db.run('INSERT INTO data_controls(scope,policy,updated) VALUES(?,?,?)','pilot-member:'+await learnerOwner(t),JSON.stringify({status:'active',joined:1,role:'teacher',context:'school',manager:h.env.PILOT_ADMIN_OWNER,label:'Lee Legacy',managedApproval:true,authoringAllowed:true}),1);
 await h.welcome(t);assert.equal((await h.pilot(t)).verified,true);
 assert.equal((await h.pilot(t,pupilInvite('kid@example.test'))).status,200);
 const invited=user('new-teacher'),i=await h.pilot(h.admin,{action:'invite',email:invited.email,role:'teacher',context:'school',managedApproval:true});await h.claim(invited,i.code);await h.welcome(invited);
 assert.equal((await h.pilot(invited)).verified,true);assert.equal((await h.pilot(invited,pupilInvite('kid2@example.test'))).status,200);
});

test('a pupil cannot join by open sign-up or class code on their own', async () => {
 const h=await setup(),kid=user('kid-1','Kit Kid'),teacher=user('teach-v');
 const i=await h.pilot(h.admin,{action:'invite',email:teacher.email,role:'teacher',context:'school',managedApproval:true});await h.claim(teacher,i.code);await h.welcome(teacher);
 const c=(await h.classes(teacher,{action:'create',name:'Year 7'})).class;
 assert.equal((await h.classes(kid,{action:'join',code:c.code})).status,403,'no access arrangement yet');
 assert.equal((await h.pilot(kid,{action:'join-open'})).status,200);
 assert.equal((await h.welcome(kid,'13to17')).status,403,'open sign-up is 18+ only');assert.equal((await h.welcome(kid,'under13')).status,403);
 assert.equal((await h.classes(kid,{action:'join',code:c.code})).status,428,'no class code without finishing an 18+ setup');
 assert.equal((await h.pilot(kid,{action:'join-open',as:'teacher'})).status,409,'cannot switch to teacher afterwards');
});

test('learner names: clashes get a short disambiguator and never an email or account reference', async () => {
 assert.deepEqual(distinctLabels([{label:'Noah B.',joined:3},{label:'Ada L.',joined:1},{label:'noah b.',joined:2},{label:'',joined:4},{label:'Noah B.',joined:5}]),['Noah B. · 2','Ada L.','noah b.','Learner','Noah B. · 3']);
 const h=await setup(),admin=h.admin;await h.welcome(admin);const c=(await h.classes(admin,{action:'create',name:'Hack night'})).class;
 for(const n of ['a','b']){const u={...user('noah-'+n),name:'Noah Brown'};await h.pilot(u,{action:'join-open'});await h.welcome(u);assert.equal((await h.classes(u,{action:'join',code:c.code})).status,200);h.advance(1000)}
 const o=await h.overview(admin,c.id),labels=o.learners.map(l=>l.label).sort();
 assert.deepEqual(labels,['Noah B.','Noah B. · 2']);
 const text=JSON.stringify(o);for(const n of ['a','b']){assert.ok(!text.includes('noah-'+n+'@example.test'));assert.ok(!text.includes(await learnerOwner(user('noah-'+n))))}
 // Bulk invitations can carry the inviter's names.
 const many=await h.pilot(admin,{action:'invite-many',emails:['x1@example.test','x2@example.test'],labels:['Xena One','']});assert.equal(many.status,200,JSON.stringify(many));
 const rows=(await h.db.all("SELECT policy FROM data_controls WHERE scope LIKE 'pilot-invite:%'")).map(r=>JSON.parse(r.policy).label).sort();assert.deepEqual(rows,['X','Xena One']);
 assert.equal((await h.pilot(admin,{action:'invite-many',emails:['x1@example.test'],labels:['a','b']})).status,400);
});

test('“New code” still replaces the class code, and the old one stops working', async () => {
 const h=await setup(),t=user('teach-1');await h.selfTeacher(t);
 const c=(await h.classes(t,{action:'create',name:'Code club'})).class,next=await h.classes(t,{action:'code',id:c.id});
 assert.equal(next.status,200);assert.notEqual(next.class.code,c.code);
 const adult=user('adult-1');await h.pilot(adult,{action:'join-open'});await h.welcome(adult);
 assert.equal((await h.classes(adult,{action:'join',code:c.code})).status,404,'old code gone');
 assert.equal((await h.classes(adult,{action:'join',code:next.class.code})).status,200);
});
