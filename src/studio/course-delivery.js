// Delivery reuses the existing exact-version chapter grant. These are receipts
// for this view, not learner activity or an all-or-nothing server transaction.
export function courseDelivery(course,job,chapters=[]){
 const linked=!!(job?.status==='approved'&&course?.plan?.id===job.id&&course.plan.hash===job.draftHash);
 const valid=linked&&Array.isArray(job.issues)&&!job.issues.length;
 const steps=(job?.draft?.steps||[]).map(step=>{
  const link=course?.plan?.links.find(l=>l.objectiveId===step.id);
  const chapter=link&&chapters.find(c=>c.id===link.id);
  const reason=!link?'Activity not linked':!chapter?'Activity unavailable':chapter.status!=='published'?'Teaching review needed':chapter.hash!==link.hash?'Published version changed':'Ready to assign';
  return {id:step.id,objective:step.objective,topicId:step.topicId,jobId:link?.id,hash:link?.hash,title:chapter?.title||'',ready:reason==='Ready to assign',reason};
 });
 const ready=valid&&steps.length>0&&steps.length<=6&&steps.every(s=>s.ready);
 const fingerprint=JSON.stringify({courseId:course?.id,planId:job?.id,planHash:job?.draftHash,steps:steps.map(s=>[s.id,s.objective,s.jobId,s.hash])});
 return {ready,steps,fingerprint,reason:!linked?'Link an approved course route first.':!valid?'Refresh the plan and resolve its evidence changes before assigning.':!steps.length?'This plan has no supported objectives to assign.':!ready?'Prepare, publish and link every objective before assigning the whole course.':'Every objective has a reviewed, published activity.'};
}
export function deliveryTasks(delivery,learners){
 if(!delivery.ready)throw Error(delivery.reason);
 if(!learners.length||learners.length>20)throw Error('Choose between 1 and 20 learners per delivery.');
 const tasks=[];
 for(const learner of learners)for(const step of delivery.steps){
  const key=JSON.stringify([learner.accountReference,step.jobId,step.hash]);
  if(!tasks.some(t=>t.key===key))tasks.push({key,learner:learner.accountReference,label:learner.label||'Learner',jobId:step.jobId,hash:step.hash,title:step.title,status:'pending'});
 }
 return tasks;
}
export function checkedDelivery({courseId,planId,fingerprint,selected},{notebook,plans,people}){
 const course=notebook.state.courses.find(c=>c.id===courseId),job=plans.jobs.find(j=>j.id===planId),fresh=courseDelivery(course,job,notebook.chapters);
 if(!fresh.ready||fresh.fingerprint!==fingerprint)throw Error('This course or its reviewed material changed. Reopen the course route and check every objective before assigning.');
 const recipients=selected.map(id=>people.roster?.find(m=>m.accountReference===id&&m.role==='learner'&&m.status==='active'&&m.manager===people.accountReference));
 if(!people.manages||recipients.some(r=>!r))throw Error('Your learner group changed. Reopen the course route and choose the current learners.');
 return deliveryTasks(fresh,recipients);
}
export async function deliverCourse({tasks,previous=[],send,isCurrent=()=>true,onUpdate=()=>{}}){
 const receipts=tasks.map(t=>({...t,...(previous.find(p=>p.key===t.key&&p.status==='confirmed')?{status:'confirmed'}:{status:'pending'})}));
 for(let i=0;i<receipts.length;i++){
  if(receipts[i].status==='confirmed')continue;
  if(!isCurrent())break;
  try{
   const t=receipts[i];await send({action:'assign',accountReference:t.learner,jobId:t.jobId,draftHash:t.hash});
   receipts[i]={...t,status:'confirmed'};
  }catch(e){receipts[i]={...receipts[i],status:'unconfirmed',error:e?.message||'No confirmation received.'};if(isCurrent())onUpdate(receipts.map(r=>({...r})));break;}
  if(isCurrent())onUpdate(receipts.map(r=>({...r})));
 }
 return receipts;
}
