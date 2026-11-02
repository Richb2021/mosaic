import React,{useEffect,useRef,useState} from 'react';
import './course-sharing.css';
const labels={'not-started':'Not started','started':'Started','practised':'Practised'};
const blank=g=>g.steps.map(s=>({objectiveId:s.id,status:'not-started',help:false}));
export function OrganiserOverview({client}){const [open,setOpen]=useState(false);return <details className="cs-overview" onToggle={e=>setOpen(e.currentTarget.open)}><summary>All course assignments and shared updates</summary>{open&&<OrganiserReports course={{id:''}} client={client}/>}</details>}

export function LearnerCourses({client,onStart}){
 const [data,setData]=useState(null),[error,setError]=useState('');const sequence=useRef(0),identity=client.journal.user?.id;
 async function load(){const n=++sequence.current,r=await client.journal.request('course-sharing');if(n===sequence.current&&identity===client.journal.user?.id){setData(r);setError('')}return r;}
 useEffect(()=>{setData(null);if(identity)void load().catch(e=>setError(e.message));return()=>{sequence.current++}},[identity]);
 if(!identity)return null;
 return <section className="shared-courses" aria-label="Assigned course routes">{error&&<p role="alert">{error} <button onClick={()=>load().catch(e=>setError(e.message))}>Reload assigned courses</button></p>}{data?.assignments.length>0&&<><header><h2>Your course routes</h2><button onClick={()=>client.refresh().then(()=>load()).catch(e=>setError(e.message))}>Refresh course updates</button></header><p>Explore any activity. Choose what to tell your organiser, and ask for help when you want it.</p>{data.assignments.map(g=><LearnerCourse key={identity+g.id+g.revision+g.version+g.consentToken} assignment={g} client={client} onStart={onStart} onReload={load} onError={setError}/>)}</>}</section>;
}
function LearnerCourse({assignment:g,client,onStart,onReload,onError}){
 const [updates,setUpdates]=useState(g.report?.updates||blank(g)),[enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('');
 const mounted=useRef(true),running=useRef(false),identity=client.journal.user.id;useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[]);
 const current=()=>mounted.current&&identity===client.journal.user?.id;
 async function save(on){if(running.current)return;running.current=true;setBusy(true);setError('');setNotice('');try{
  const result=await client.journal.request('course-sharing',{action:'share',id:g.id,revision:g.revision,enabled:on,consentToken:g.consentToken,expectedVersion:g.version,...(on?{updates}:{})});
  if(!current())return;setNotice(result.notice||(on?'Your chosen update is shared with your current organiser.':'Sharing stopped.'));setEnabled(false);await onReload();
 }catch(e){if(current()){setError(e.message);try{await onReload()}catch{}onError(e.message)}}finally{running.current=false;if(current())setBusy(false)}}
 return <article className="shared-course"><div className="cs-heading"><div><span>ASSIGNED COURSE</span><h3>{g.title}</h3></div><b className="cs-sharing-state">{g.sharing?'Sharing enabled':'Sharing off'}</b></div>
 {!g.available&&<p className="message error">These activities changed or are unavailable. Your organiser needs to assign a reviewed version.</p>}
 <ol>{g.steps.map(s=>{const update=updates.find(u=>u.objectiveId===s.id),item=client.items.find(i=>i.jobId===s.jobId&&i.sourceHash===s.hash);return <li key={s.id}><div><small>{s.topicTitle}</small><h4>{s.objective}</h4><p>{s.title}</p><button disabled={busy||!g.available||!item} onClick={async()=>{try{await onStart(item)}catch(e){setError(e.message)}}}>Open activity</button></div><fieldset disabled={busy||!g.available||!g.storageAvailable}><legend>Your update for this objective</legend><label>Status<select value={update.status} onChange={e=>setUpdates(v=>v.map(u=>u.objectiveId===s.id?{...u,status:e.target.value}:u))}>{Object.entries(labels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label className="check"><input type="checkbox" checked={update.help} onChange={e=>setUpdates(v=>v.map(u=>u.objectiveId===s.id?{...u,help:e.target.checked}:u))}/>I would like help with this</label></fieldset></li>})}</ol>
 <aside className="cs-consent"><h4>You choose what to share.</h4><p>Only the statuses and help requests above go to your current organiser. These are your own updates, not grades. Private answers, conversations, interests and game scores are not included. Editing a choice does not send it.</p>
 {!g.storageAvailable&&<p role="alert">Saved updates are temporarily unavailable. You can still stop sharing.</p>}
 <label className="check"><input type="checkbox" checked={enabled} disabled={busy||!g.available||!g.storageAvailable} onChange={e=>setEnabled(e.target.checked)}/>Share these updates with my current organiser.</label>
 <div className="cs-actions"><button className="primary" disabled={busy||!enabled||!g.available||!g.storageAvailable} onClick={()=>save(true)}>{busy?'Saving…':g.sharing?'Send updated status':'Start sharing these updates'}</button><button disabled={busy||!g.sharing} onClick={()=>save(false)}>Stop sharing now</button></div><p className="cs-small">Stopping hides your updates immediately. Saved updates remain in your private learning data until deleted or expired under your retention settings. <a href="/studio#data">Your data</a></p></aside>
 <div aria-live="polite">{notice&&<p className="message success">{notice}</p>}{error&&<p className="message error" role="alert">{error}</p>}</div>
 </article>;
}

export function OrganiserReports({course,client,revision=0}){
 const [data,setData]=useState(null),[cursor,setCursor]=useState(''),[history,setHistory]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[confirm,setConfirm]=useState(null);
 const life=useRef(0),identity=client.journal.user?.id;
 async function load(next=cursor){const n=++life.current;setBusy(true);setError('');try{const r=await client.journal.request('course-sharing?'+new URLSearchParams({view:'organiser',courseId:course.id,cursor:next}));if(n===life.current&&identity===client.journal.user?.id){setData(r);setCursor(next)}}catch(e){if(n===life.current)setError(e.message)}finally{if(n===life.current)setBusy(false)}}
 useEffect(()=>{setData(null);setHistory([]);setCursor('');setConfirm(null);void load('');return()=>{life.current++}},[course.id,identity,revision]);
 return <section className="course-reports" aria-label="Learner-shared course updates"><header><div><span>LEARNER-SHARED UPDATES</span><h3>Where a little support could help.</h3></div><button disabled={busy} onClick={()=>load()}>Refresh shared updates</button></header><p>These are updates learners explicitly chose to send. “Practised” is a self-report, not evidence of understanding or a grade. Sharing is off until the learner enables it.</p>
 {busy&&<p role="status">Loading current permissions and updates…</p>}{error&&<p role="alert">{error} No missing report has been counted as no activity.</p>}
 {!busy&&!error&&data&&!data.assignments.length&&<p>No course assignments yet. Assign a fully reviewed course above to offer learner-controlled updates.</p>}
 {!busy&&!error&&data?.assignments.map(g=><article key={g.id}><div className="cs-heading"><div><h4>{g.label}</h4><p>{g.title}</p></div><span>{g.revoked?'Assignment withdrawn':!g.available?'Assignment unavailable':g.report.state==='shared'?'Learner update shared':g.report.state==='off'?'Not sharing':g.report.state==='expired'?'Shared update expired':'Updates temporarily unavailable'}</span></div>
 {g.report.state==='shared'&&<><p className="cs-small">Last sent {new Date(g.report.updated).toLocaleString()}</p><ul>{g.steps.map(s=>{const u=g.report.updates.find(u=>u.objectiveId===s.id);return <li key={s.id}><span>{s.objective}</span><b>{labels[u.status]}</b>{u.help&&<strong className="cs-help">Help requested</strong>}</li>})}</ul></>}
 {!g.revoked&&<button disabled={busy} onClick={()=>setConfirm(g)}>Withdraw course assignment</button>}
 {confirm?.id===g.id&&<div className="cs-withdraw"><p>Withdraw this course and its shared updates? The learner’s private saves remain. Chapters assigned separately remain available.</p><button disabled={busy} onClick={async()=>{setBusy(true);try{await client.journal.request('course-sharing',{action:'revoke',id:g.id,revision:g.revision});setConfirm(null);await load()}catch(e){setError(e.message);setBusy(false)}}}>Withdraw this course</button><button disabled={busy} onClick={()=>setConfirm(null)}>Keep assignment</button></div>}
 </article>)}
 {data&&(history.length>0||data.nextCursor)&&<nav aria-label="Shared updates pages"><button disabled={busy||!history.length} onClick={()=>{const next=history.at(-1);setHistory(h=>h.slice(0,-1));void load(next)}}>Previous learners</button><button disabled={busy||!data.nextCursor} onClick={()=>{setHistory(h=>[...h,cursor]);void load(data.nextCursor)}}>Next learners</button></nav>}
 </section>;
}
