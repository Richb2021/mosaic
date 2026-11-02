import React,{useEffect,useRef,useState} from 'react';
import {pilotRequest} from './client.js';
import {courseDelivery,checkedDelivery,deliverCourse} from './course-delivery.js';
import './course-delivery.css';

export function CourseDelivery({course,job,data,client,onReload}){
 const [selected,setSelected]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[receipts,setReceipts]=useState([]),[review,setReview]=useState(false);
 const mounted=useRef(true),running=useRef(false),identity=client.journal.user.id;
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[]);
 const delivery=courseDelivery(course,job,data.chapters);
 const latest=useRef(delivery.fingerprint);latest.current=delivery.fingerprint;
 const current=()=>mounted.current&&client.journal.user?.id===identity&&latest.current===delivery.fingerprint;
 const learners=(client.access?.roster||[]).filter(m=>m.role==='learner'&&m.status==='active'&&m.manager===client.access.accountReference);
 const confirmed=receipts.filter(r=>r.status==='confirmed').length,complete=receipts.length>0&&confirmed===receipts.length;
 async function send(){
  if(running.current)return;running.current=true;setBusy(true);setError('');
  try{
   // A stale tab must not send yesterday's plan or roster. Server still checks
   // every individual grant, including content changed during this batch.
   const [notebook,plans,people]=await Promise.all([client.journal.request('courses'),client.journal.request('course-plan?'+new URLSearchParams({courseId:course.id})),pilotRequest()]);
   if(!current())return;
   const tasks=checkedDelivery({courseId:course.id,planId:job.id,fingerprint:delivery.fingerprint,selected},{notebook,plans,people});
   const result=await deliverCourse({tasks,previous:receipts,send:pilotRequest,isCurrent:current,onUpdate:setReceipts});
   if(current())setReceipts(result);
  }catch(e){if(current())setError(e.message)}finally{running.current=false;if(mounted.current&&client.journal.user?.id===identity)setBusy(false)}
 }
 return <section className="course-delivery" aria-label="Course delivery"><header><div><span className="cd-eyebrow">SHARE THE REVIEWED ACTIVITIES</span><h4>Ready for your learners?</h4></div><p className="cd-count"><strong>{delivery.steps.filter(s=>s.ready).length}</strong> / {delivery.steps.length} objectives ready</p></header>
 <p>{delivery.reason}</p>{onReload&&<button disabled={busy} onClick={async()=>{if(running.current)return;running.current=true;setBusy(true);setError('');try{await onReload()}catch(e){if(current())setError(e.message)}finally{running.current=false;if(mounted.current&&client.journal.user?.id===identity)setBusy(false)}}}>Reload course and learner list</button>}
 <ol className="cd-readiness">{delivery.steps.map(s=><li key={s.id}><span>{s.objective}</span><b className={s.ready?'cd-ready':'cd-waiting'}>{s.reason}</b></li>)}</ol>
 <p className="cd-note">Each learner receives the exact published activities in their assigned learning shelf. Your personal plan context, source library and private answers stay private. This sends activities; it does not share a learner’s progress or create a locked sequence.</p>
 {delivery.ready&&<><fieldset disabled={busy||receipts.length>0}><legend>Choose learners · up to 20 per delivery</legend>{learners.length?<div className="cd-learners">{learners.map(m=><label className="check" key={m.accountReference}><input type="checkbox" checked={selected.includes(m.accountReference)} disabled={!selected.includes(m.accountReference)&&selected.length>=20} onChange={e=>{setSelected(v=>e.target.checked?[...v,m.accountReference]:v.filter(id=>id!==m.accountReference));setReview(false)}}/><span><b>{m.label||'Learner '+m.accountReference.slice(0,8)}</b>{m.group&&<small>{m.group}</small>}</span></label>)}</div>:<p>No active learners in your group. <a href="/welcome.html">Invite learners</a> before assigning.</p>}</fieldset>
 {!receipts.length&&<label className="check cd-confirm"><input type="checkbox" checked={review} disabled={busy||!selected.length} onChange={e=>setReview(e.target.checked)}/>I checked the objectives, published activities and selected learners.</label>}
 <div className="cd-actions"><button className="primary" disabled={busy||complete||!selected.length||!review} onClick={send}>{busy?'Assigning activities…':complete?'All deliveries confirmed':receipts.length?'Retry unconfirmed deliveries':'Assign course activities'}</button>{receipts.length>0&&!busy&&<button onClick={()=>{setReceipts([]);setSelected([]);setReview(false);setError('')}}>Choose another group</button>}</div></>}
 <div className="cd-results" aria-live="polite">{error&&<p className="message error" role="alert">{error}</p>}{receipts.length>0&&<><p><b>{confirmed} of {receipts.length} deliveries confirmed.</b> {complete?'Learners can open the activities in Studio.':busy?'Keep this course open while delivery finishes.':'Delivery stopped. Confirmed activities stay assigned. You can retry the remaining items.'}</p><p className="cd-note">These receipts last while this course view is open. An unconfirmed request may have reached the server; retrying the same version safely replaces the same assignment.</p><ul>{receipts.map(r=><li key={r.key}><div><b>{r.label}</b><span>{r.title}</span></div><span>{r.status==='confirmed'?'Confirmed':r.status==='pending'?'Not sent':'Unconfirmed'}</span>{r.error&&<p role="alert">{r.error}</p>}</li>)}</ul></>}</div>
 </section>;
}
