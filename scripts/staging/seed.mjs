// First-run staging content: a teacher with a reviewed course (two objectives, two
// published chapters and an Explore lesson), one learner in the teacher's school group,
// and a second teacher who manages a self-directed adult. Everything else is made in the app.
import {sqlDB} from '../../server/data-control.js';
import {learnerOwner,PILOT_NOTICE,workspaceIdentity} from '../../server/pilot-access.js';
import {extractResource,digest} from '../../server/content-service.js';
import {EXTENDED_PACKS} from '../../src/game-modes/extended-packs.js';
import {newUnit,activitiesOf} from '../../src/studio/programme.js';
import {creativeContext,validateCreative} from '../../src/studio/creative-content.js';
import {draftHash} from '../../src/game-modes/draft-engine.js';
import {normaliseProfile} from '../../src/game-modes/learning-model.js';
import {exploreLesson} from './explore-lesson.mjs';

export const SEED_PEOPLE=[
 {id:'staging-teacher',name:'Sam Patel',note:'Teacher and administrator. Owns the seeded course.'},
 {id:'staging-maya',name:'Maya Singh',note:'Learner aged 13–17 in Sam’s school group.'},
 {id:'staging-olu',name:'Olu Ade',note:'Second teacher in Sam’s school.'},
 {id:'staging-ada',name:'Ada Lovelace',note:'Adult learner managed by Olu (self-directed). Can join Sam’s class by code.'},
];
export const personaUser=p=>({id:p.id,email:p.id+'@staging.test',emailVerified:true,name:p.name});

export async function seedStaging(env,store,now=Date.now()){
 const db=sqlDB(env.DB);
 if(await db.one("SELECT 1 AS x FROM data_controls WHERE scope LIKE 'pilot-member:%' LIMIT 1"))return false;
 const [teacher,maya,olu,ada]=SEED_PEOPLE.map(personaUser),identity=await workspaceIdentity(teacher,env);
 const member=async(u,manager,role,extra)=>db.run('INSERT INTO data_controls(scope,policy,updated) VALUES(?,?,?)','pilot-member:'+await learnerOwner(u),JSON.stringify({role,manager:await learnerOwner(manager),status:'active',joined:now,label:u.name,authoringAllowed:role!=='learner',...extra}),now);
 await member(maya,teacher,'learner',{context:'school',managedApproval:true});
 await member(olu,teacher,'teacher',{context:'school',managedApproval:true});
 await member(ada,olu,'learner',{context:'individual',managedApproval:false});
 for(const [u,band] of [[teacher,'18plus'],[maya,'13to17'],[olu,'18plus'],[ada,'18plus']])await store.write('learner_profiles',await learnerOwner(u),'onboarding',0,{onboarding:{completed:true,version:PILOT_NOTICE,ageBand:band}},now);
 const source=await extractResource({title:'Food webs: reviewed classroom notes',text:'Plants are producers. Rabbits eat plants. Foxes eat rabbits. An arrow from a plant to a rabbit shows energy transfer.\n\nA habitat is a place where an organism lives. A population is a group of organisms of the same species living in an area.'}),resourceId='staging-source';
 await db.run('INSERT INTO workshop_resources(id,owner,title,checksum,payload,status,created) VALUES(?,?,?,?,?,?,?)',resourceId,identity.siteOwner,source.title,source.checksum,JSON.stringify({units:source.units}),'reviewed',now);
 const course={id:'staging-course',title:'Living systems',goal:'Explain organisms and their relationships.',topics:[{id:'web',title:'Food webs',goal:'Use the reviewed definitions.',resources:[{id:resourceId,checksum:source.checksum}],chapters:[]}]};
 const steps=[1,2].map(n=>({id:'objective-'+n,topicId:'web',objective:n===1?'Identify producers and consumers.':'Explain habitat and population.',rationale:'Use the exact reviewed notes.',template:'quiz-v1',prerequisites:n===1?[]:['objective-1'],sourceRefs:[source.units[n-1].id]}));
 const p={id:'staging-plan',recordType:'course-plan',learnerOwner:identity.owner,courseId:course.id,resourceVersions:[{id:resourceId,checksum:source.checksum}],courseSnapshot:course.topics.map(t=>({id:t.id,title:t.title,goal:t.goal,resources:t.resources})),context:{courseTitle:course.title,courseGoal:course.goal,topics:[{id:'web',title:'Food webs',resourceIds:[resourceId]}],evidence:source.units.map(u=>({...u,resourceId,checksum:source.checksum})),profile:normaliseProfile({})}};
 const plan={schemaVersion:1,id:p.id,title:'Living systems',summary:'Two reviewed objectives.',steps,gaps:[]},planDraft=JSON.stringify(plan),planHash=await digest(planDraft);
 const job=(id,status,payload,draft)=>db.run('INSERT INTO workshop_jobs(id,owner,request_key,request_hash,status,payload,draft,created,updated) VALUES(?,?,?,?,?,?,?,?,?)',id,identity.siteOwner,id,'staging-seed',status,JSON.stringify(payload),draft,now,now);
 await job(p.id,'plan-approved',p,planDraft);
 const chapters=[];for(let i=0;i<2;i++){const pack={...structuredClone(EXTENDED_PACKS.find(x=>x.id==='riverlight-web-quiz')),id:'staging-chapter-pack-'+i,title:i?'Habitats and populations':'Producers and consumers'},draft=JSON.stringify(pack),id='staging-chapter-'+i;
  await job(id,'published',{goal:steps[i].objective,evidence:source.units,resourceVersions:p.resourceVersions,chapterId:pack.id},draft);chapters.push({id,hash:await digest(draft),pack});}
 course.plan={id:p.id,hash:planHash,links:chapters.map((c,i)=>({objectiveId:steps[i].id,id:c.id,hash:c.hash}))};course.topics[0].chapters=chapters.map(({id,hash})=>({id,hash}));
 await store.write('learner_profiles',identity.owner,'courses',0,{courses:{schemaVersion:1,courses:[course]}},now);
 const pack=chapters[0].pack,unit=newUnit(pack,{level:'Starting out'},activitiesOf(pack).map(a=>a.key));
 const ep={id:'staging-explore',recordType:'creative',kind:'explore',learnerOwner:identity.owner,packId:pack.id,contentHash:draftHash(pack),activityKey:unit.activityKeys[0],context:creativeContext(pack,unit,'explore',unit.activityKeys[0])};
 await job(ep.id,'creative-published',ep,JSON.stringify(validateCreative(exploreLesson(ep),ep)));
 return true;
}
