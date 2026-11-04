import {storyBrief} from '../src/story-direction.js';
import {knowledgeAPI} from './knowledge-api.js';
import {permittedSourceURL} from './knowledge-import.js';
import {resourcePage,resourceSearch,RESOURCE_LIMIT} from './resource-library.js';
import {startCost,finishCost} from './cost-ledger.js';
import {generationBudget,generationLimit,GENERATION_ROWS,GENERATION_WINDOW_MS,budgetMessage} from './workshop-budget.js';
import {evidencePacket} from '../src/evidence-selection.js';
import {balanceNumberWarning} from '../src/chapter-content.js';
import {scoreStory} from '../src/story-quality.js';
import {RETRY_COST_SUFFIX,storyCheckSummary,shouldRetryStory,retryState,retryJob,chooseAfterRetry} from './story-retry.js';
import {WorkshopError,requireValue,boundedText,safeId,digest,generationRequest,extractResource,selectEvidence,callWonder,readWonder,validateGenerated,MODEL,TEMPLATE_IDS} from './content-service.js';

const json=(data,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
async function body(req){const reader=req.body?.getReader();requireValue(reader,'A request body is required.');let size=0,parts=[];try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;requireValue(size<=100000,'The upload exceeds 100 KB.',413);parts.push(value)}}finally{await reader.cancel().catch(()=>{})}const data=new Uint8Array(size);let at=0;for(const p of parts){data.set(p,at);at+=p.length}try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(data))}catch{throw new WorkshopError('Send a valid UTF-8 JSON request.')}}
const publicResource=r=>{const p=JSON.parse(r.payload);return {id:r.id,title:r.title,checksum:r.checksum,status:r.status,created:r.created,units:p.units,provenance:p.provenance||null,original:p.original||null}};
const BACKGROUND_LIMIT=30*60*1000;
const overdueMessage='This request has taken more than 30 minutes. Its Meta response may still finish; check this saved request again to recover it. No replacement generation was sent.';
const publicJob=async (r,at=Date.now())=>({id:r.id,status:r.status==='starting'&&at-r.updated>60000?'interrupted':r.status,created:r.created,updated:r.updated,error:r.error,goal:JSON.parse(r.payload).goal,topicId:JSON.parse(r.payload).topicId,template:JSON.parse(r.payload).template||'underlight-v1',coverage:JSON.parse(r.payload).coverage||null,storyCheck:JSON.parse(r.payload).storyCheck||null,story:JSON.parse(r.payload).story||null,model:MODEL,revisionOf:JSON.parse(r.payload).revisionOf||null,draft:r.draft?JSON.parse(r.draft):null,draftHash:r.draft?await digest(r.draft):null});

export async function workshopAPI(req,env,{provider=callWonder,reader=readWonder,defer=()=>{},now=()=>Date.now(),owner=null,learnerOwner=null,fetcher=fetch}={}){
 try{
  const url=new URL(req.url),path=url.pathname.replace(/^\/api\/workshop\/?/,'').split('/').filter(Boolean),method=req.method;
  if(method==='GET'&&path.join('/')==='health')return json({service:'resource-workshop',model:MODEL,configured:!!env.META_API_KEY,formats:['txt','md','pdf','docx','pptx','csv','tsv','xlsx','vtt','srt','png','jpg','jpeg','webp'],extraction:'browser-text-and-optional-english-ocr',maxFileBytes:8388608,templates:TEMPLATE_IDS,maxBytes:65536,generationLimit:generationLimit(env)});
  requireValue(owner&&owner.length<=200,'Sign in to your learner account to use your resource library.',401);
  requireValue(env.DB,'Resource storage is not configured.',503);
  if(method!=='GET'){requireValue(req.headers.get('origin')===url.origin,'Open the workshop on this site before saving.',403);requireValue(req.headers.get('content-type')?.startsWith('application/json')&&req.headers.get('x-lanternbound-workshop')==='1','Use the workshop form to make changes.',403)}
  const db=env.DB,one=(sql,...v)=>db.prepare(sql).bind(...v).first(),all=async(sql,...v)=>(await db.prepare(sql).bind(...v).all()).results,run=(sql,...v)=>db.prepare(sql).bind(...v).run();
  if(path[0]==='knowledge')return await knowledgeAPI(req,env,{owner,learnerOwner,now,fetcher});
  const resource=async id=>{const r=await one('SELECT * FROM workshop_resources WHERE id=? AND owner=?',id,owner);requireValue(r,'Resource not found.',404);return r};
  const job=async id=>{const j=await one('SELECT * FROM workshop_jobs WHERE id=? AND owner=?',id,owner);requireValue(j&&!JSON.parse(j.payload).recordType,'This chapter hasn’t been shared with you. Ask your teacher to assign it, then open it from Today.',404);return j};
  // A weak story gets one guided revision; the first draft waits in the job record until then.
  const restoreRetry=async(j,from,reason)=>{const p=JSON.parse(j.payload),r=p.storyRetry,chosen=chooseAfterRetry(r,null,null);chosen.storyCheck.retry=reason;
   await run('UPDATE workshop_jobs SET status=?,draft=?,payload=?,error=?,updated=? WHERE id=? AND owner=? AND status=?','review',JSON.stringify(validateGenerated(chosen.content,p)),JSON.stringify({...p,storyRetry:{state:'done',score:r.score},storyCheck:chosen.storyCheck}),null,now(),j.id,owner,from);return job(j.id)};
  const sweepStarting=async()=>{
   for(const r of await all('SELECT * FROM workshop_jobs WHERE owner=? AND status=? AND updated<?',owner,'starting',now()-60000))if(JSON.parse(r.payload).storyRetry?.fallback)await restoreRetry(r,'starting','The revision request could not be confirmed, so this is the first draft. No further request was sent.');
   return run('UPDATE workshop_jobs SET status=?,error=?,updated=? WHERE owner=? AND status=? AND updated<?','interrupted','The submission acknowledgement was lost. It may have used API credits; no automatic retry was sent.',now(),owner,'starting',now()-60000);
  };
  const settle=async(j,result,from)=>{
   const p=JSON.parse(j.payload),retry=p.storyRetry?.state==='running'?p.storyRetry:null;
   await finishCost(env,{id:retry?j.id+RETRY_COST_SUFFIX:j.id,siteOwner:owner,usage:result.usage,status:result.status,now:now()});
   const content=result.content?validateGenerated(result.content,p):null,status=content?'review':result.status;
   requireValue(['review','running','failed','interrupted'].includes(status),'Invalid generation result.',502);
   if(retry&&status!=='running'){const chosen=chooseAfterRetry(retry,content,content?(result.storyCheck||scoreStory(content,{story:p.story})):null);
    await run('UPDATE workshop_jobs SET status=?,draft=?,payload=?,provider_id=?,error=?,updated=? WHERE id=? AND owner=? AND status=?','review',JSON.stringify(validateGenerated(chosen.content,p)),JSON.stringify({...p,storyRetry:{state:'done',score:retry.score},storyCheck:chosen.storyCheck}),result.providerId||j.provider_id,null,now(),j.id,owner,from);return job(j.id)}
   const check=content?(result.storyCheck||scoreStory(content,{story:p.story})):null;
   // Only on a fresh completion: a manual re-check of an old response never creates a new request.
   if(content&&['running','starting'].includes(from)&&env.META_API_KEY&&shouldRetryStory(env,p,check)){
    const r=retryState(p,check,content),lock=await run('UPDATE workshop_jobs SET status=?,payload=?,provider_id=?,updated=? WHERE id=? AND owner=? AND status=?','starting',JSON.stringify({...p,storyRetry:r}),result.providerId||j.provider_id,now(),j.id,owner,from);
    if(!lock.meta.changes)return job(j.id);
    const locked=await job(j.id),next=retryJob(p,r);
    try{await startCost(env,{id:j.id+RETRY_COST_SUFFIX,siteOwner:owner,learnerOwner,model:MODEL,request:generationRequest(next),now:now()});return await settle(locked,await provider(next,env.META_API_KEY),'starting')}
    catch(e){await finishCost(env,{id:j.id+RETRY_COST_SUFFIX,siteOwner:owner,usage:e.usage,status:'unknown',now:now()});return restoreRetry(locked,'starting',e.status===429?'The daily generation budget had no room for a revision, so this is the first draft.':'The revision could not be completed, so this is the first draft.')}
   }
   await run('UPDATE workshop_jobs SET status=?,draft=?,payload=?,provider_id=?,error=?,updated=? WHERE id=? AND owner=? AND status=?',status,content?JSON.stringify(content):null,JSON.stringify(check?{...p,storyCheck:storyCheckSummary(check)}:p),result.providerId||j.provider_id,result.error||null,now(),j.id,owner,from);
   return job(j.id);
  };
  const syncJob=async j=>{
   // A manual check can revalidate an existing provider response after an
   // adapter repair. It never creates a new inference request.
   if(!['running','interrupted','failed'].includes(j.status)||!j.provider_id)return j;
   try{const result=await reader(j.provider_id,JSON.parse(j.payload),env.META_API_KEY);if(result.status==='running'&&now()-j.created>BACKGROUND_LIMIT){result.status='interrupted';result.error=overdueMessage}return await settle(j,result,j.status)}
   catch(e){const retrying=JSON.parse(j.payload).storyRetry?.state==='running';await finishCost(env,{id:retrying?j.id+RETRY_COST_SUFFIX:j.id,siteOwner:owner,usage:e.usage,status:'unknown',now:now()});if(e.status===422||e.status===410){if(retrying)return restoreRetry(j,j.status,'The revision came back unusable, so this is the first draft.');await run('UPDATE workshop_jobs SET status=?,error=?,updated=? WHERE id=? AND owner=? AND status=?','failed',e.message,now(),j.id,owner,j.status);return job(j.id)}throw e}
  };
  if(method==='GET'&&path.join('/')==='resources')return json(await resourcePage({all},owner,url.searchParams));
  if(method==='GET'&&path.join('/')==='search')return json(await resourceSearch({all},owner,url.searchParams));
  if(method==='GET'&&path[0]==='resources'&&path.length===2)return json({resource:publicResource(await resource(path[1]))});
  if(method==='GET'&&path.join('/')==='library'){
   const page=await resourcePage({all},owner,new URLSearchParams());
   return json({generationBudget:await generationBudget(one,owner,env,now()),resourcePage:page,resources:url.searchParams.get('view')==='metadata'?page.resources:(await all('SELECT * FROM workshop_resources WHERE owner=? ORDER BY created DESC,id DESC LIMIT 40',owner)).map(publicResource),resourcesTruncated:page.total>40,jobs:await Promise.all((await all("SELECT * FROM workshop_jobs WHERE owner=? AND json_extract(CASE WHEN json_valid(payload) THEN payload ELSE '{}' END,'$.recordType') IS NULL ORDER BY created DESC LIMIT 30",owner)).map(r=>publicJob(r,now())))});
  }
  if(method==='POST'&&path.join('/')==='resources'){
   const input=await body(req),r=await extractResource(input),existing=await one('SELECT * FROM workshop_resources WHERE owner=? AND checksum=?',owner,r.checksum);if(existing)return json({resource:publicResource(existing),duplicate:true});
   requireValue((await one('SELECT COUNT(*) AS n FROM workshop_resources WHERE owner=?',owner)).n<RESOURCE_LIMIT,'Your library holds up to 500 sources. Use Your data to remove material you no longer need.',409);
   const id='resource-'+crypto.randomUUID(),provenance={filename:input.filename||null,language:input.language||'',rootId:id,parentId:null};
   requireValue(typeof provenance.language==='string'&&provenance.language.length<=60,'Use a short source language name or code.');
   if(input.importJobId){const imported=await one('SELECT * FROM workshop_jobs WHERE id=? AND owner=?',input.importJobId,owner);requireValue(imported,'Saved transcript not found.',404);const details=JSON.parse(imported.payload);requireValue(details.recordType==='knowledge'&&details.kind==='transcript'&&imported.status==='knowledge-review','Choose a completed transcript from this workspace.');provenance.importJobId=imported.id;}
   if(input.url)provenance.url=permittedSourceURL(input.url,env).href;
   if(input.parentId){const parent=await resource(input.parentId);requireValue(input.parentChecksum===parent.checksum,'The previous source version changed. Reopen it first.',409);provenance.rootId=JSON.parse(parent.payload).provenance?.rootId||parent.id;provenance.parentId=parent.id;}
   await run('INSERT OR IGNORE INTO workshop_resources(id,owner,title,checksum,payload,status,created) SELECT ?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM workshop_resources WHERE owner=?)<500',id,owner,r.title,r.checksum,JSON.stringify({text:r.text,units:r.units,provenance}),'unreviewed',now(),owner);
   const saved=await one('SELECT * FROM workshop_resources WHERE owner=? AND checksum=?',owner,r.checksum);requireValue(saved,'The resource library is full.',409);return json({resource:publicResource(saved)},201);
  }
  if(method==='POST'&&path[0]==='resources'&&path[2]==='review'&&path.length===3){const r=await resource(path[1]),input=await body(req);requireValue(input.checksum===r.checksum&&input.confirmed===true,'Review the exact source text before confirming.');await run('UPDATE workshop_resources SET status=? WHERE id=? AND owner=?','reviewed',r.id,owner);return json({resource:publicResource(await resource(r.id))})}
  if(method==='POST'&&path.join('/')==='jobs'){
   const input=await body(req);requireValue(boundedText(input.requestKey,80)&&/^[a-z0-9-]+$/.test(input.requestKey),'A valid request identity is required.');
   requireValue(safeId(input.topicId)&&boundedText(input.goal,1200,10)&&boundedText(input.level,240),'Choose a goal and describe the learner’s level.');
   requireValue(Array.isArray(input.resourceIds)&&input.resourceIds.length>0&&input.resourceIds.length<=3&&input.resourceIds.every(safeId)&&new Set(input.resourceIds).size===input.resourceIds.length,'Select one to three different reviewed resources.');
   const template=input.template||'underlight-v1';requireValue(TEMPLATE_IDS.includes(template),'Choose a supported game format.');
   if(input.evidenceIds!==undefined){requireValue(input.evidenceConfirmed===true,'Review the selected evidence packet before generation.');requireValue(Array.isArray(input.evidenceIds)&&input.evidenceIds.length>=1&&input.evidenceIds.length<=12&&input.evidenceIds.every(id=>typeof id==='string')&&new Set(input.evidenceIds).size===input.evidenceIds.length,'Choose one to twelve unique evidence passages.');}
   let story;try{story=input.story===undefined?undefined:storyBrief(input.story)}catch(e){throw new WorkshopError(e.message)}
   const normalized={...(story?{story}:{}),...(input.evidenceIds!==undefined?{evidenceIds:input.evidenceIds.slice().sort()}:{}),...(template==='underlight-v1'?{}:{template}),topicId:input.topicId,goal:input.goal.trim(),level:input.level.trim(),resourceIds:input.resourceIds.slice().sort()},requestHash=await digest(JSON.stringify(normalized)),existing=await one('SELECT * FROM workshop_jobs WHERE owner=? AND request_key=?',owner,input.requestKey);
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
     try{await startCost(env,{id:j.id,siteOwner:owner,learnerOwner,model:MODEL,request:generationRequest(JSON.parse(j.payload)),now:now()});await settle(j,await provider(JSON.parse(j.payload),env.META_API_KEY),'starting')}
     catch(e){await finishCost(env,{id:j.id,siteOwner:owner,usage:e.usage,status:'unknown',now:now()});const uncertain=['TimeoutError','TypeError','AbortError'].includes(e.name),message=e.status?e.message:uncertain?'The submission acknowledgement was lost. It may have used API credits; no automatic retry was sent.':'The generated draft could not be validated. No chapter was activated.';await run('UPDATE workshop_jobs SET status=?,error=?,provider_id=?,updated=? WHERE id=? AND owner=? AND status=?',uncertain?'interrupted':'failed',message,e.providerId||j.provider_id,now(),j.id,owner,'starting')}
    })();
    defer(work);await work;return json({job:await publicJob(await job(j.id),now())});
   }
   if(method==='POST'&&path[2]==='publish'&&path.length===3){
    const input=await body(req);requireValue(['review','published'].includes(j.status)&&j.draft,'This draft is not ready for review.',409);requireValue(input.confirmed===true&&input.draftHash===await digest(j.draft),'Review the current draft and confirm its sources first.',409);
    const payload=JSON.parse(j.payload);for(const binding of payload.resourceVersions){const r=await resource(binding.id);requireValue(r.status==='reviewed'&&r.checksum===binding.checksum,'A source changed or is no longer reviewed.',409)}
    const validated=validateGenerated(JSON.parse(j.draft),payload),nums=balanceNumberWarning(validated);
    // A balance answer whose explanation uses other numbers is held until the author fixes or confirms it.
    requireValue(!nums||input.numbersChecked===true,`Check the numbers in “${nums?.title}”: the expected answer splits ${nums?.answer.join(' and ')}, but the text also mentions ${nums?.odd.join(', ')}. Fix it with Revise a copy, or tick “I've checked the numbers” if they are right.`,409);
    await run('UPDATE workshop_jobs SET status=?,draft=?,updated=? WHERE id=? AND owner=? AND status=?','published',JSON.stringify(validated),now(),j.id,owner,'review');return json({job:await publicJob(await job(j.id),now())});
   }
  }
  return json({error:'Workshop route not found.'},404);
 }catch(e){return json({error:e.status?e.message:'The workshop could not complete this request. Your current game is unchanged.'},e.status||500)}
}
