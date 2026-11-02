import {D1,Bucket} from './media-storage.mjs';
import {StoreError} from '../../server/ncb-store.js';
import {learningAPI} from '../../server/learning-api.js';
import {pilotAPI,learnerOwner,PILOT_NOTICE,workspaceIdentity} from '../../server/pilot-access.js';
import {sqlDB} from '../../server/data-control.js';
import {extractResource,digest} from '../../server/content-service.js';
import {EXTENDED_PACKS} from '../../src/game-modes/extended-packs.js';
export class SharingStore{
 rows=new Map();failReports=false;beforeWrite=null;afterRead=null;
 async latest(t,o,s){if(this.failReports&&s.startsWith('course-report:'))throw new StoreError('NCB report unavailable');const row=this.rows.get(t+o+s)||null;if(this.afterRead&&s.startsWith('course-report:')){const fn=this.afterRead;this.afterRead=null;await fn()}return row}
 async list(o){return (await this.allRows('learner_saves',o))}
 async allRows(t,o){return [...this.rows.values()].filter(r=>r.table===t&&r.owner_key===o)}
 async deleteRows(t,o,ids){for(const [k,r] of this.rows)if(r.table===t&&r.owner_key===o&&ids.includes(r.id))this.rows.delete(k)}
 async write(t,o,s,v,p,n){if(this.beforeWrite&&s.startsWith('course-report:')){const fn=this.beforeWrite;this.beforeWrite=null;await fn()}if(this.failReports&&s.startsWith('course-report:'))throw new StoreError('NCB report unavailable');if(((await this.latest(t,o,s))?.version||0)!==v)throw new StoreError('Version conflict',409);const r={table:t,owner_key:o,slot_key:s,version:v+1,payload:JSON.stringify(p),updated_ms:n,id:crypto.randomUUID()};this.rows.set(t+o+s,r);return r}
}
export async function sharingFixture(){
 const user=id=>({id,email:id+'@example.test',emailVerified:true,name:id}),teacher=user('sharing-teacher'),learner=user('sharing-learner'),other=user('sharing-other'),second=user('sharing-second');
 const store=new SharingStore(),env={DB:new D1(),BUCKET:new Bucket(),PILOT_ENABLED:'true',PILOT_ADMIN_OWNER:await learnerOwner(teacher)},db=sqlDB(env.DB),identity=await workspaceIdentity(teacher,env);let stamp=1800000000000;
 for(const [u,manager,role] of [[learner,teacher,'learner'],[other,teacher,'teacher'],[second,other,'learner']])await db.run('INSERT INTO data_controls(scope,policy,updated) VALUES(?,?,?)','pilot-member:'+await learnerOwner(u),JSON.stringify({role,manager:await learnerOwner(manager),status:'active',joined:1,context:'school',label:u.name,managedApproval:true,authoringAllowed:role==='teacher'}),stamp);
 for(const u of [teacher,learner,other,second])await store.write('learner_profiles',await learnerOwner(u),'onboarding',0,{onboarding:{completed:true,version:PILOT_NOTICE,ageBand:u===learner||u===second?'13to17':'18plus'}},stamp);
 const epochs=new Map();
 const call=async(u,path,body,headers={})=>{const req=new Request('https://test.local/api/'+path,{method:body?'POST':'GET',headers:{Origin:'https://test.local','Content-Type':'application/json','X-Mosaic-Learner':u.id,'X-Mosaic-Data-Epoch':epochs.get(u.id)||'0:0',...headers},body:body?JSON.stringify(body):undefined}),fn=path==='pilot'?pilotAPI:learningAPI,r=await fn(req,env,{store,session:async()=>u,now:()=>stamp});const data=await r.json();if(!body)epochs.set(u.id,r.headers.get('X-Mosaic-Data-Epoch')||data.epoch||epochs.get(u.id)||'0:0');return {http:r.status,...data}};
 const source=await extractResource({title:'Reviewed classroom notes',text:'Plants are producers. Rabbits eat plants. Foxes eat rabbits. An arrow from a plant to a rabbit shows energy transfer.\n\nA habitat is a place where an organism lives. A population is a group of organisms of the same species living in an area.'}),resourceId='sharing-source';
 await db.run('INSERT INTO workshop_resources(id,owner,title,checksum,payload,status,created) VALUES(?,?,?,?,?,?,?)',resourceId,identity.siteOwner,source.title,source.checksum,JSON.stringify({units:source.units}),'reviewed',stamp);
 const course={id:'sharing-course',title:'Living systems · shared route',goal:'Explain organisms and their relationships.',topics:[{id:'web',title:'Food webs',goal:'Use the reviewed definitions.',resources:[{id:resourceId,checksum:source.checksum}],chapters:[]}]};
 const steps=[1,2].map(n=>({id:'objective-'+n,topicId:'web',objective:n===1?'Identify producers and consumers.':'Explain habitat and population.',rationale:'Use the exact reviewed notes.',template:'quiz-v1',prerequisites:n===1?[]:['objective-1'],sourceRefs:[source.units[n-1].id]}));
 const p={id:'sharing-plan',recordType:'course-plan',learnerOwner:identity.owner,courseId:course.id,resourceVersions:[{id:resourceId,checksum:source.checksum}],courseSnapshot:course.topics.map(t=>({id:t.id,title:t.title,goal:t.goal,resources:t.resources})),context:{courseTitle:course.title,courseGoal:course.goal,topics:[{id:'web',title:'Food webs',resourceIds:[resourceId]}],evidence:source.units.map(u=>({...u,resourceId,checksum:source.checksum})),profile:{context:'PRIVATE_PROFILE_NEVER_SHARE'}}};
 const plan={schemaVersion:1,id:p.id,title:'Living systems',summary:'Two reviewed objectives.',steps,gaps:[]},planDraft=JSON.stringify(plan),planHash=await digest(planDraft);
 await db.run('INSERT INTO workshop_jobs(id,owner,request_key,request_hash,status,payload,draft,created,updated) VALUES(?,?,?,?,?,?,?,?,?)',p.id,identity.siteOwner,p.id,'fixture','plan-approved',JSON.stringify(p),planDraft,stamp,stamp);
 const chapters=[];for(let i=0;i<2;i++){const pack={...structuredClone(EXTENDED_PACKS.find(p=>p.template==='quiz-v1')),id:'generated-sharing-'+i},draft=JSON.stringify(pack),hash=await digest(draft),id='sharing-chapter-'+i;
  await db.run('INSERT INTO workshop_jobs(id,owner,request_key,request_hash,status,payload,draft,created,updated) VALUES(?,?,?,?,?,?,?,?,?)',id,identity.siteOwner,id,'fixture','published',JSON.stringify({goal:steps[i].objective,evidence:source.units,resourceVersions:p.resourceVersions,chapterId:pack.id}),draft,stamp,stamp);chapters.push({id,hash,pack});
 }
 course.plan={id:p.id,hash:planHash,links:chapters.map((c,i)=>({objectiveId:steps[i].id,id:c.id,hash:c.hash}))};course.topics[0].chapters=chapters.map(({id,hash})=>({id,hash}));await store.write('learner_profiles',identity.owner,'courses',0,{courses:{schemaVersion:1,courses:[course]}},stamp);
 const assignCourse=async(u=learner,extra={})=>call(teacher,'learning/course-sharing',{action:'assign',learner:await learnerOwner(u),courseId:course.id,planHash,...extra});
 const own=()=>call(learner,'learning/course-sharing');
 const report=()=>call(teacher,'learning/course-sharing?view=organiser&courseId='+course.id);
 const share=async(extra={})=>{const {assignments}=await own(),g=assignments[0];return call(learner,'learning/course-sharing',{action:'share',id:g.id,revision:g.revision,enabled:true,expectedVersion:g.version,consentToken:g.consentToken,updates:g.steps.map((s,i)=>({objectiveId:s.id,status:i?'started':'practised',help:i===1})),...extra})};
 return {teacher,learner,other,second,env,db,store,call,identity,source,resourceId,course,planHash,chapters,assignCourse,own,report,share,now:()=>stamp,advance:n=>stamp+=n};
}
