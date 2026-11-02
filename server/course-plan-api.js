import {readJSON,noStore} from './ncb-auth.js';
import {StoreError} from './ncb-store.js';
import {sqlDB,parse,need} from './data-control.js';
import {digest,MODEL} from './content-service.js';
import {normaliseProfile} from '../src/game-modes/learning-model.js';
import {emptyCourses,validateCourses} from '../src/studio/course-model.js';
import {validateCoursePlan} from '../src/studio/course-plan.js';
import {submitCoursePlan,checkCoursePlan,coursePlanRequest} from './course-plan-provider.js';
import {generationBudget,GENERATION_ROWS,GENERATION_WINDOW_MS,budgetMessage} from './workshop-budget.js';
import {startCost,finishCost} from './cost-ledger.js';
const kind="json_extract(CASE WHEN json_valid(payload) THEN payload ELSE '{}' END,'$.recordType')";
export async function planCurrent(db,siteOwner,job,course){
 const p=parse(job.payload),issues=[];
 if(!course||JSON.stringify(course.topics.map(t=>({id:t.id,title:t.title,goal:t.goal,resources:t.resources})))!==JSON.stringify(p.courseSnapshot)||course.title!==p.context.courseTitle||course.goal!==p.context.courseGoal)issues.push('The course topics, goals or source links changed. Prepare a new plan for the current course.');
 for(const v of p.resourceVersions||[]){const r=await db.one('SELECT checksum,status FROM workshop_resources WHERE owner=? AND id=?',siteOwner,v.id);if(!r||r.checksum!==v.checksum||r.status!=='reviewed')issues.push('A planned source is unavailable, changed or no longer reviewed.');}
 return [...new Set(issues)];
}
export async function coursePlanAPI(req,env,{store,owner,siteOwner,access,now=()=>Date.now(),provider=submitCoursePlan,reader=checkCoursePlan}){
 need(env.DB&&siteOwner,'Sign in to prepare a course plan.',401);need(env.PILOT_ENABLED!=='true'||access.canAuthor&&access.ageBand==='18plus','Your organiser prepares course plans.',403);
 const db=sqlDB(env.DB),input=req.method==='GET'?Object.fromEntries(new URL(req.url).searchParams):await readJSON(req,90000);
 need(typeof input.courseId==='string'&&input.courseId.length<=100,'Choose a course.');
 const row=await store.latest('learner_profiles',owner,'courses'),state=row?validateCourses(parse(row.payload).courses):emptyCourses(),course=state.courses.find(c=>c.id===input.courseId);need(course,'Course not found.',404);
 const load=async id=>{need(typeof id==='string'&&id.length<=100,'Choose a saved plan.');const j=await db.one(`SELECT * FROM workshop_jobs WHERE id=? AND owner=? AND ${kind}=?`,id,siteOwner,'course-plan');need(j&&parse(j.payload).courseId===course.id&&parse(j.payload).learnerOwner===owner,'Course plan not found.',404);return j};
 const publicJob=async j=>({id:j.id,status:j.status.replace(/^plan-/,''),created:j.created,error:j.error,model:MODEL,draft:j.draft?parse(j.draft):null,draftHash:j.draft?await digest(j.draft):null,context:parse(j.payload).context,issues:await planCurrent(db,siteOwner,j,course)});
 const result=async id=>{const jobs=await db.all(`SELECT * FROM workshop_jobs WHERE owner=? AND ${kind}=? AND json_extract(payload,'$.courseId')=? AND json_extract(payload,'$.learnerOwner')=? ORDER BY created DESC LIMIT 12`,siteOwner,'course-plan',course.id,owner);if(course.plan&&!jobs.some(j=>j.id===course.plan.id)){const linked=await db.one(`SELECT * FROM workshop_jobs WHERE id=? AND owner=? AND ${kind}=?`,course.plan.id,siteOwner,'course-plan');if(linked&&parse(linked.payload).learnerOwner===owner)jobs.push(linked)}return noStore({jobs:await Promise.all(jobs.map(publicJob)),jobId:id||null,budget:await generationBudget(db.one,siteOwner,env,now())})};
 if(req.method==='GET')return result();need(req.method==='POST','Plan route not found.',404);
 if(input.action==='create'){
  need(input.confirmed===true,'Read and confirm the selected evidence before requesting a plan.');need(typeof input.requestKey==='string'&&/^[a-z0-9-]{1,80}$/.test(input.requestKey),'Use a valid request identity.');
  need(typeof input.goal==='string'&&input.goal.trim().length>=10&&input.goal.length<=1200,'Describe the course goal in 10–1,200 characters.');need(Array.isArray(input.evidenceIds)&&input.evidenceIds.length>0&&input.evidenceIds.length<=24&&new Set(input.evidenceIds).size===input.evidenceIds.length,'Choose one to twenty-four different passages.');
  const requestKey='plan-'+input.requestKey,requestHash=await digest(JSON.stringify({owner,courseId:course.id,goal:input.goal,evidenceIds:input.evidenceIds})),existing=await db.one('SELECT * FROM workshop_jobs WHERE owner=? AND request_key=?',siteOwner,requestKey);
  if(existing){need(existing.request_hash===requestHash,'This request identity has different input.',409);return result(existing.id)}
  const versions=[...new Map(course.topics.flatMap(t=>t.resources).map(r=>[r.id,r])).values()];need(versions.length<=12,'This planner handles twelve linked sources per course. Split the course before planning.');
  let totalPassages=0,reviewedSources=0;const available=[],resourceVersions=[];
  for(const v of versions){const r=await db.one('SELECT * FROM workshop_resources WHERE owner=? AND id=?',siteOwner,v.id);if(!r||r.checksum!==v.checksum||r.status!=='reviewed')continue;const units=parse(r.payload).units;reviewedSources++;totalPassages+=units.length;for(const u of units)if(input.evidenceIds.includes(u.id))available.push({...u,resourceId:r.id,checksum:r.checksum});if(units.some(u=>input.evidenceIds.includes(u.id)))resourceVersions.push(v)}
  const evidence=input.evidenceIds.map(id=>available.find(u=>u.id===id));need(evidence.every(Boolean),'A selected passage is outside the current reviewed course sources.',409);const characters=evidence.reduce((n,u)=>n+u.excerpt.length,0);need(characters<=32000,'Keep the plan evidence within 32,000 characters.');
  const profile=await store.latest('learner_profiles',owner,'profile'),preferences=normaliseProfile(profile?parse(profile.payload).profile:{});
  const context={courseTitle:course.title,courseGoal:course.goal,goal:input.goal.trim(),profile:preferences,topics:course.topics.map(t=>({id:t.id,title:t.title,goal:t.goal,resourceIds:t.resources.filter(v=>resourceVersions.some(r=>r.id===v.id&&r.checksum===v.checksum)).map(r=>r.id)})),evidence,coverage:{method:'explicit-reviewed-selection',totalPassages,selectedPassages:evidence.length,omittedPassages:totalPassages-evidence.length,characters,unreviewedOrMissingSources:versions.length-reviewedSources,selectedSources:resourceVersions.length}};
  const payload={id:'plan-'+crypto.randomUUID(),recordType:'course-plan',learnerOwner:owner,courseId:course.id,resourceVersions,courseSnapshot:course.topics.map(t=>({id:t.id,title:t.title,goal:t.goal,resources:t.resources})),context};
  need(env.META_API_KEY,'Muse Wonder is not connected.',503);const budget=await generationBudget(db.one,siteOwner,env,now());need(!budget.configurationError,budgetMessage(budget),503);need(budget.remaining>0,budgetMessage(budget),429);
  await db.run(`INSERT OR IGNORE INTO workshop_jobs(id,owner,request_key,request_hash,status,payload,created,updated) SELECT ?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM workshop_jobs WHERE owner=? AND created>? AND ${GENERATION_ROWS})<?`,payload.id,siteOwner,requestKey,requestHash,'plan-queued',JSON.stringify(payload),now(),now(),siteOwner,now()-GENERATION_WINDOW_MS,budget.limit);
  const saved=await db.one('SELECT * FROM workshop_jobs WHERE owner=? AND request_key=?',siteOwner,requestKey);need(saved,budgetMessage(await generationBudget(db.one,siteOwner,env,now())),429);need(saved.request_hash===requestHash,'This request identity has different input.',409);return result(saved.id);
 }
 const j=await load(input.id),p=parse(j.payload);
 const settle=async(out,from)=>{await finishCost(env,{id:j.id,siteOwner,usage:out.usage,status:out.status,now:now()});const draft=out.content?validateCoursePlan(out.content,p):null,status=draft?'review':out.status;need(['review','running','failed','interrupted'].includes(status),'Invalid Muse plan status.',502);await db.run('UPDATE workshop_jobs SET status=?,draft=?,provider_id=?,error=?,updated=? WHERE id=? AND owner=? AND status=?','plan-'+status,draft?JSON.stringify(draft):null,out.providerId||j.provider_id,out.error||null,now(),j.id,siteOwner,from)};
 const fail=async(e,from)=>{await finishCost(env,{id:j.id,siteOwner,usage:e.usage,status:'unknown',now:now()});const interrupted=['TypeError','TimeoutError','AbortError'].includes(e.name);await db.run('UPDATE workshop_jobs SET status=?,provider_id=?,error=?,updated=? WHERE id=? AND owner=? AND status=?',interrupted?'plan-interrupted':'plan-failed',e.providerId||j.provider_id,interrupted?'The submission acknowledgement was lost. No automatic repeat was sent.':e.status?e.message:'The plan could not be validated. No replacement request was sent.',now(),j.id,siteOwner,from)};
 if(input.action==='run'){
  if(j.status!=='plan-queued')return result(j.id);need(!(await planCurrent(db,siteOwner,j,course)).length,'Course evidence changed. Prepare a new plan.',409);
  const locked=await db.run('UPDATE workshop_jobs SET status=?,updated=? WHERE id=? AND owner=? AND status=?','plan-starting',now(),j.id,siteOwner,j.status);if(!locked.meta.changes)return result(j.id);
  try{await startCost(env,{id:j.id,siteOwner,learnerOwner:owner,model:MODEL,request:coursePlanRequest(p),now:now()});await settle(await provider(p,env.META_API_KEY),'plan-starting')}catch(e){await fail(e,'plan-starting')}return result(j.id);
 }
 if(input.action==='check'){
  if(j.status==='plan-starting'&&now()-j.updated>60000)await db.run('UPDATE workshop_jobs SET status=?,error=?,updated=? WHERE id=? AND owner=? AND status=?','plan-interrupted','Submission acknowledgement was lost. No automatic repeat was sent.',now(),j.id,siteOwner,j.status);
  if(['plan-running','plan-interrupted','plan-failed'].includes(j.status)&&j.provider_id)try{const out=await reader(j.provider_id,p,env.META_API_KEY);if(out.status==='running'&&now()-j.created>30*60*1000){out.status='interrupted';out.error='Automatic checking has stopped after thirty minutes. Check this saved response later; no replacement was sent.'}await settle(out,j.status)}catch(e){if([410,422].includes(e.status))await fail(e,j.status);else throw e}return result(j.id);
 }
 need(j.status==='plan-review'&&j.draft,'Only a draft awaiting review can be changed.',409);need(input.draftHash===await digest(j.draft),'The plan changed in another window. Reload it first.',409);need(!(await planCurrent(db,siteOwner,j,course)).length,'The course or source version changed. Prepare a new plan.',409);
 if(input.action==='edit'||input.action==='approve'){
  let draft;try{draft=validateCoursePlan(input.action==='edit'?input.draft:parse(j.draft),p)}catch(e){throw new StoreError(e.message,400)}if(input.action==='approve'){need(input.confirmed===true,'Review the evidence, prerequisites and stated gaps before approval.');need(draft.steps.length,'Add source-supported objectives before approving this route.');}
  const saved=await db.run('UPDATE workshop_jobs SET status=?,draft=?,updated=? WHERE id=? AND owner=? AND status=? AND draft=?',input.action==='approve'?'plan-approved':'plan-review',JSON.stringify(draft),now(),j.id,siteOwner,j.status,j.draft);need(saved.meta.changes===1,'The plan changed in another window.',409);return result(j.id);
 }
 throw new StoreError('Unknown plan action.',404);
}
