import {generationBudget,generationLimit,GENERATION_ROWS,GENERATION_WINDOW_MS,budgetMessage} from './workshop-budget.js';
import {evidencePacket} from '../src/evidence-selection.js';
import {WorkshopError,requireValue,boundedText,safeId,digest,extractResource,selectEvidence,callWonder,readWonder,validateGenerated,MODEL,TEMPLATE_IDS} from './content-service.js';

const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
async function body(req){const reader=req.body?.getReader();requireValue(reader,'A request body is required.');let size=0,parts=[];try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;requireValue(size<=100000,'The upload exceeds 100 KB.',413);parts.push(value)}}finally{await reader.cancel().catch(()=>{})}const data=new Uint8Array(size);let at=0;for(const p of parts){data.set(p,at);at+=p.length}try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(data))}catch{throw new WorkshopError('Send a valid UTF-8 JSON request.')}}
const publicResource=r=>({id:r.id,title:r.title,checksum:r.checksum,status:r.status,created:r.created,units:JSON.parse(r.payload).units});
const BACKGROUND_LIMIT=30*60*1000;
const overdueMessage='This request has taken more than 30 minutes. Its Meta response may still finish; check this saved request again to recover it. No replacement generation was sent.';
const publicJob=async (r,at=Date.now())=>({id:r.id,status:r.status==='starting'&&at-r.updated>60000?'interrupted':r.status,created:r.created,updated:r.updated,error:r.error,goal:JSON.parse(r.payload).goal,topicId:JSON.parse(r.payload).topicId,template:JSON.parse(r.payload).template||'underlight-v1',coverage:JSON.parse(r.payload).coverage||null,model:MODEL,revisionOf:JSON.parse(r.payload).revisionOf||null,draft:r.draft?JSON.parse(r.draft):null,draftHash:r.draft?await digest(r.draft):null});

export async function workshopAPI(req,env,{provider=callWonder,reader=readWonder,defer=()=>{},now=()=>Date.now()}={}){
 try{
  const url=new URL(req.url),path=url.pathname.replace(/^\/api\/workshop\/?/,'').split('/').filter(Boolean),method=req.method;
  if(method==='GET'&&path.join('/')==='health')return json({service:'resource-workshop',model:MODEL,configured:!!env.META_API_KEY,formats:['txt','md','pdf','docx','pptx','vtt','srt'],extraction:'browser-text-only',maxFileBytes:8388608,templates:TEMPLATE_IDS,maxBytes:65536,generationLimit:generationLimit(env)});
  const owner=req.headers.get('oai-authenticated-user-id');requireValue(owner&&owner.length<=200,'Sign in with ChatGPT to use your resource library.',401);
  requireValue(env.DB,'Resource storage is not configured.',503);
  if(method!=='GET'){requireValue(req.headers.get('origin')===url.origin,'Open the workshop on this site before saving.',403);requireValue(req.headers.get('content-type')?.startsWith('application/json')&&req.headers.get('x-lanternbound-workshop')==='1','Use the workshop form to make changes.',403)}
  const db=env.DB,one=(sql,...v)=>db.prepare(sql).bind(...v).first(),all=async(sql,...v)=>(await db.prepare(sql).bind(...v).all()).results,run=(sql,...v)=>db.prepare(sql).bind(...v).run();
  const resource=async id=>{const r=await one('SELECT * FROM workshop_resources WHERE id=? AND owner=?',id,owner);requireValue(r,'Resource not found.',404);return r};
  const job=async id=>{const j=await one('SELECT * FROM workshop_jobs WHERE id=? AND owner=?',id,owner);requireValue(j,'Draft not found.',404);return j};
  const sweepStarting=()=>run('UPDATE workshop_jobs SET status=?,error=?,updated=? WHERE owner=? AND status=? AND updated<?','interrupted','The submission acknowledgement was lost. It may have used API credits; no automatic retry was sent.',now(),owner,'starting',now()-60000);
  const settle=async(j,result,from)=>{
   const content=result.content?validateGenerated(result.content,JSON.parse(j.payload)):null,status=content?'review':result.status;
   requireValue(['review','running','failed','interrupted'].includes(status),'Invalid generation result.',502);
   await run('UPDATE workshop_jobs SET status=?,draft=?,provider_id=?,error=?,updated=? WHERE id=? AND owner=? AND status=?',status,content?JSON.stringify(content):null,result.providerId||j.provider_id,result.error||null,now(),j.id,owner,from);
   return job(j.id);
  };
  const syncJob=async j=>{
   // A manual check can revalidate an existing provider response after an
   // adapter repair. It never creates a new inference request.
   if(!['running','interrupted','failed'].includes(j.status)||!j.provider_id)return j;
   try{const result=await reader(j.provider_id,JSON.parse(j.payload),env.META_API_KEY);if(result.status==='running'&&now()-j.created>BACKGROUND_LIMIT){result.status='interrupted';result.error=overdueMessage}return await settle(j,result,j.status)}
   catch(e){if(e.status===422||e.status===410){await run('UPDATE workshop_jobs SET status=?,error=?,updated=? WHERE id=? AND owner=? AND status=?','failed',e.message,now(),j.id,owner,j.status);return job(j.id)}throw e}
  };
  if(method==='GET'&&path.join('/')==='library')return json({generationBudget:await generationBudget(one,owner,env,now()),resources:(await all('SELECT * FROM workshop_resources WHERE owner=? ORDER BY created DESC LIMIT 40',owner)).map(publicResource),jobs:await Promise.all((await all('SELECT * FROM workshop_jobs WHERE owner=? ORDER BY created DESC LIMIT 30',owner)).map(r=>publicJob(r,now())))});
  if(method==='POST'&&path.join('/')==='resources'){
   const input=await body(req),r=await extractResource(input),existing=await one('SELECT * FROM workshop_resources WHERE owner=? AND checksum=?',owner,r.checksum);if(existing)return json({resource:publicResource(existing),duplicate:true});
   requireValue((await one('SELECT COUNT(*) AS n FROM workshop_resources WHERE owner=?',owner)).n<40,'This workshop holds 40 resources. Reuse an existing source for now.',409);
   const id='resource-'+crypto.randomUUID();await run('INSERT OR IGNORE INTO workshop_resources(id,owner,title,checksum,payload,status,created) SELECT ?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM workshop_resources WHERE owner=?)<40',id,owner,r.title,r.checksum,JSON.stringify({text:r.text,units:r.units}),'unreviewed',now(),owner);
   const saved=await one('SELECT * FROM workshop_resources WHERE owner=? AND checksum=?',owner,r.checksum);requireValue(saved,'The resource library is full.',409);return json({resource:publicResource(saved)},201);
  }
  if(method==='POST'&&path[0]==='resources'&&path[2]==='review'&&path.length===3){const r=await resource(path[1]),input=await body(req);requireValue(input.checksum===r.checksum&&input.confirmed===true,'Review the exact source text before confirming.');await run('UPDATE workshop_resources SET status=? WHERE id=? AND owner=?','reviewed',r.id,owner);return json({resource:publicResource(await resource(r.id))})}
  if(method==='POST'&&path.join('/')==='jobs'){
   const input=await body(req);requireValue(boundedText(input.requestKey,80)&&/^[a-z0-9-]+$/.test(input.requestKey),'A valid request identity is required.');
   requireValue(safeId(input.topicId)&&boundedText(input.goal,1200,10)&&boundedText(input.level,240),'Choose a goal and describe the learner’s level.');
   requireValue(Array.isArray(input.resourceIds)&&input.resourceIds.length>0&&input.resourceIds.length<=3&&input.resourceIds.every(safeId)&&new Set(input.resourceIds).size===input.resourceIds.length,'Select one to three different reviewed resources.');
   const template=input.template||'underlight-v1';requireValue(TEMPLATE_IDS.includes(template),'Choose a supported game format.');
   if(input.evidenceIds!==undefined){requireValue(input.evidenceConfirmed===true,'Review the selected evidence packet before generation.');requireValue(Array.isArray(input.evidenceIds)&&input.evidenceIds.length>=1&&input.evidenceIds.length<=12&&input.evidenceIds.every(id=>typeof id==='string')&&new Set(input.evidenceIds).size===input.evidenceIds.length,'Choose one to twelve unique evidence passages.');}
   const normalized={...(input.evidenceIds!==undefined?{evidenceIds:input.evidenceIds.slice().sort()}:{}),...(template==='underlight-v1'?{}:{template}),topicId:input.topicId,goal:input.goal.trim(),level:input.level.trim(),resourceIds:input.resourceIds.slice().sort()},requestHash=await digest(JSON.stringify(normalized)),existing=await one('SELECT * FROM workshop_jobs WHERE owner=? AND request_key=?',owner,input.requestKey);
   if(existing){requireValue(existing.request_hash===requestHash,'This request identity belongs to different inputs.',409);return json({job:await publicJob(existing,now())})}
   requireValue(env.META_API_KEY,'Muse Wonder is not connected. Configure the server’s META_API_KEY first.',503);
   const budget=await generationBudget(one,owner,env,now());requireValue(!budget.configurationError,budgetMessage(budget),503);requireValue(budget.remaining>0,budgetMessage(budget),429);
   const resources=await Promise.all(normalized.resourceIds.map(resource));requireValue(resources.every(r=>r.status==='reviewed'),'Review all selected sources first.');
   let selected;try{selected=evidencePacket(resources.map(publicResource),normalized.goal,input.evidenceIds)}catch(e){throw new WorkshopError(e.message)}
   const id='job-'+crypto.randomUUID(),payload={...normalized,chapterId:'generated-'+crypto.randomUUID(),evidence:selected.evidence,coverage:selected.coverage,resourceVersions:resources.map(r=>({id:r.id,checksum:r.checksum}))};
   await run(`INSERT OR IGNORE INTO workshop_jobs(id,owner,request_key,request_hash,status,payload,created,updated) SELECT ?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM workshop_jobs WHERE owner=? AND created>? AND ${GENERATION_ROWS})<?`,id,owner,input.requestKey,requestHash,'queued',JSON.stringify(payload),now(),now(),owner,now()-GENERATION_WINDOW_MS,budget.limit);
   const saved=await one('SELECT * FROM workshop_jobs WHERE owner=? AND request_key=?',owner,input.requestKey);if(!saved)throw new WorkshopError(budgetMessage(await generationBudget(one,owner,env,now())),429);requireValue(saved.request_hash===requestHash,'This request identity belongs to different inputs.',409);return json({job:await publicJob(saved,now())},201);
  }
  if(path[0]==='jobs'&&path.length>=2){
   let j=await job(path[1]);
   if(method==='GET'&&path.length===2)return json({job:await publicJob(j,now())});
   if(method==='POST'&&path[2]==='revise'&&path.length===3){
    const input=await body(req);requireValue(['review','published'].includes(j.status)&&j.draft,'This chapter is not ready to revise.',409);
    requireValue(input.draftHash===await digest(j.draft),'The original chapter changed. Reopen it before revising.',409);
    requireValue(boundedText(input.requestKey,80)&&/^[a-z0-9-]+$/.test(input.requestKey),'A valid revision identity is required.');
    const originalPayload=JSON.parse(j.payload);let edited;try{edited=validateGenerated(input.draft,originalPayload)}catch(e){throw new WorkshopError(e instanceof TypeError||e instanceof SyntaxError?'The edited chapter could not be validated. Check its fields and source references.':e.message)}
    for(const binding of originalPayload.resourceVersions){const r=await resource(binding.id);requireValue(r.status==='reviewed'&&r.checksum===binding.checksum,'A source changed or is no longer reviewed.',409)}
    const requestHash=await digest(JSON.stringify({revisionOf:j.id,sourceHash:input.draftHash,draft:edited}));
    const existing=await one('SELECT * FROM workshop_jobs WHERE owner=? AND request_key=?',owner,input.requestKey);
    if(existing){requireValue(existing.request_hash===requestHash,'This revision identity belongs to different edits.',409);return json({job:await publicJob(existing,now())})}
    const id='job-'+crypto.randomUUID(),chapterId='generated-'+crypto.randomUUID();
    const payload={...originalPayload,chapterId,revisionOf:{jobId:j.id,draftHash:input.draftHash}},copy=validateGenerated({...edited,id:chapterId},payload);
    // Manual revisions are stored copies, independent of AI admission allowance.
    // It never submits inference or mutates the original canonical content.
    await run('INSERT OR IGNORE INTO workshop_jobs(id,owner,request_key,request_hash,status,payload,draft,created,updated) VALUES(?,?,?,?,?,?,?,?,?)',id,owner,input.requestKey,requestHash,'review',JSON.stringify(payload),JSON.stringify(copy),now(),now());
    const saved=await one('SELECT * FROM workshop_jobs WHERE owner=? AND request_key=?',owner,input.requestKey);requireValue(saved,'The revised copy could not be saved. Your edits remain in this window.',409);requireValue(saved.request_hash===requestHash,'This revision identity belongs to different edits.',409);
    return json({job:await publicJob(saved,now())},201);
   }
   if(method==='POST'&&path[2]==='check'&&path.length===3){await body(req);await sweepStarting();return json({job:await publicJob(await syncJob(await job(j.id)),now())})}
   if(method==='POST'&&path[2]==='run'&&path.length===3){
    await body(req);await sweepStarting();j=await job(j.id);if(j.status!=='queued')return json({job:await publicJob(j,now())});requireValue(env.META_API_KEY,'Muse Wonder is not connected.',503);
    await run('UPDATE workshop_jobs SET status=?,error=?,updated=? WHERE owner=? AND status=? AND created<?','interrupted',overdueMessage,now(),owner,'running',now()-BACKGROUND_LIMIT);
    for(const active of await all('SELECT * FROM workshop_jobs WHERE owner=? AND status=?',owner,'running'))await syncJob(active);
    const lock=await run('UPDATE workshop_jobs SET status=?,updated=? WHERE id=? AND owner=? AND status=? AND NOT EXISTS (SELECT 1 FROM workshop_jobs WHERE owner=? AND status IN (?,?))','starting',now(),j.id,owner,'queued',owner,'starting','running');
    if(!lock.meta.changes)return json({job:await publicJob(await job(j.id),now()),message:'Another request is already running.'},409);
    const work=(async()=>{
     try{await settle(j,await provider(JSON.parse(j.payload),env.META_API_KEY),'starting')}
     catch(e){const uncertain=['TimeoutError','TypeError'].includes(e.name),message=e instanceof WorkshopError?e.message:uncertain?'The submission acknowledgement was lost. It may have used API credits; no automatic retry was sent.':'The generated draft could not be validated. No chapter was activated.';await run('UPDATE workshop_jobs SET status=?,error=?,updated=? WHERE id=? AND owner=? AND status=?',uncertain?'interrupted':'failed',message,now(),j.id,owner,'starting')}
    })();
    defer(work);await work;return json({job:await publicJob(await job(j.id),now())});
   }
   if(method==='POST'&&path[2]==='publish'&&path.length===3){
    const input=await body(req);requireValue(['review','published'].includes(j.status)&&j.draft,'This draft is not ready for review.',409);requireValue(input.confirmed===true&&input.draftHash===await digest(j.draft),'Review the current draft and confirm its sources first.',409);
    const payload=JSON.parse(j.payload);for(const binding of payload.resourceVersions){const r=await resource(binding.id);requireValue(r.status==='reviewed'&&r.checksum===binding.checksum,'A source changed or is no longer reviewed.',409)}
    const validated=validateGenerated(JSON.parse(j.draft),payload);await run('UPDATE workshop_jobs SET status=?,draft=?,updated=? WHERE id=? AND owner=? AND status=?','published',JSON.stringify(validated),now(),j.id,owner,'review');return json({job:await publicJob(await job(j.id),now())});
   }
  }
  return json({error:'Workshop route not found.'},404);
 }catch(e){return json({error:e instanceof WorkshopError?e.message:'The workshop could not complete this request. Your current game is unchanged.'},e.status||500)}
}
