import {OperationsHealth} from './MediaJobs.jsx';
import {TeacherReview} from './TeacherReview.jsx';
import {HelpSeen} from './HelpSeen.jsx';
import {ScoreTiles,StatusPill} from './score-tiles.jsx';
import React,{useEffect,useRef,useState} from 'react';
import {unitKey,formatName,contentOf} from './programme.js';
import './course-sharing.css';
const labels={'not-started':'Not started','started':'Started','practised':'Practised'};
const blank=g=>g.steps.map(s=>({objectiveId:s.id,status:'not-started',help:false}));
export function OrganiserOverview({client}){const [open,setOpen]=useState(false);return <details className="cs-overview" onToggle={e=>setOpen(e.currentTarget.open)}><summary>All course assignments and shared updates</summary>{open&&<><OrganiserReports course={{id:''}} client={client}/>{client.access?.role==='administrator'&&<OperationsHealth client={client}/>}</>}</details>}

export function LearnerCourses({client,onStart,heading=true,reloadKey=0,onAssignments}){
 // The confirmation lives here: each course card is redrawn after a save, which would clear its own message.
 const [data,setData]=useState(null),[error,setError]=useState(''),[notice,setNotice]=useState('');const sequence=useRef(0),identity=client.journal.user?.id;
 async function load(){const n=++sequence.current,r=await client.journal.request('course-sharing');if(n===sequence.current&&identity===client.journal.user?.id){setData(r);setError('');onAssignments?.(r.assignments)}return r;}
 useEffect(()=>{setData(null);if(identity)void load().catch(e=>setError(e.message));return()=>{sequence.current++}},[identity,reloadKey]);
 if(!identity)return null;
 return <section className="shared-courses" aria-label="Assigned course routes">{error&&<p role="alert">{error} <button onClick={()=>load().catch(e=>setError(e.message))}>Reload assigned courses</button></p>}{notice&&<p className="message success" role="status">{notice}</p>}{data?.assignments.length>0&&<>{heading&&<><header><h2>Your course routes</h2><button onClick={()=>client.refresh().then(()=>load()).catch(e=>setError(e.message))}>Refresh course updates</button></header><p>Explore any activity. Choose what to tell your organiser, and ask for help when you want it.</p></>}{data.assignments.map(g=><LearnerCourse key={identity+g.id+g.revision+g.version+g.consentToken} assignment={g} client={client} onStart={onStart} onReload={load} onError={setError} onNotice={setNotice}/>)}</>}</section>;
}
// One list for everything assigned: course routes first, then chapters sent on their own.
// A chapter that already appears as a course step is not listed again.
export function LearnerAssigned({client,onStart,busy=false,page=false}){
 const [courses,setCourses]=useState(null),[reloadKey,setReloadKey]=useState(0),[error,setError]=useState(''),identity=client.journal.user?.id;
 useEffect(()=>{setCourses(identity?null:[])},[identity]);
 const steps=(courses||[]).flatMap(g=>g.steps||[]),inCourse=i=>steps.some(s=>s.jobId===i.jobId&&s.hash===i.sourceHash);
 const items=client.items.filter(i=>i.readOnly&&!inCourse(i)),loaded=courses!==null;
 const started=item=>client.state.units.some(u=>u.id===unitKey(item.pack));
 return <section className="assigned-learning" aria-labelledby="assigned-title"><div className={page?'page-heading':'assigned-heading'}><div>{page?<h1 id="assigned-title" tabIndex={-1}>Your assigned learning</h1>:<h2 id="assigned-title">Your assigned learning</h2>}<p>Your teacher or organiser has reviewed everything here. Start or continue any activity. Your progress stays private unless you choose to share it.</p></div>{identity&&<button disabled={busy} onClick={()=>{setError('');client.refresh().then(()=>setReloadKey(k=>k+1)).catch(e=>setError(e.message))}}>Check for new work</button>}</div>
 {error&&<p className="message error" role="alert">{error}</p>}
 <LearnerCourses client={client} onStart={onStart} heading={false} reloadKey={reloadKey} onAssignments={setCourses}/>
 {items.length>0&&<div className="assignment-shelf">{courses?.length>0&&<h2>Other assigned activities</h2>}{items.map(item=><article key={unitKey(item.pack)}><div><span>{formatName(item.pack.template)}</span><h3>{item.pack.title}</h3><p>{contentOf(item.pack).hook}</p></div><button className="primary" aria-label={(started(item)?'Continue ':'Start ')+item.pack.title} disabled={busy} onClick={()=>onStart(item)}>{started(item)?'Continue':'Start'}</button></article>)}</div>}
 {loaded&&!courses.length&&!items.length&&<div className="cw-empty"><p>No assignments yet. Your organiser can send a reviewed chapter to this account.</p><a href="/welcome.html">Check my group</a></div>}
 </section>;
}
function LearnerCourse({assignment:g,client,onStart,onReload,onError,onNotice}){
 const [updates,setUpdates]=useState(g.report?.updates||blank(g)),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState('');
 const mounted=useRef(true),running=useRef(false),identity=client.journal.user.id;useEffect(()=>{mounted.current=true;return()=>{mounted.current=false}},[]);
 const current=()=>mounted.current&&identity===client.journal.user?.id;
 async function save(on){if(running.current)return;running.current=true;setBusy(true);setError('');setNotice('');onNotice?.('');try{
  const result=await client.journal.request('course-sharing',{action:'share',id:g.id,revision:g.revision,enabled:on,consentToken:g.consentToken,expectedVersion:g.version,...(on?{updates}:{})});
  if(!current())return;const message=result.notice||(on?'Your chosen update is shared with '+(g.className?'your teacher for '+g.className:'your current organiser')+'.':'Sharing stopped.');if(onNotice)onNotice(message);else setNotice(message);/* one confirmation, shown above the list */await onReload();
 }catch(e){if(current()){setError(e.message);try{await onReload()}catch{}onError(e.message)}}finally{running.current=false;if(current())setBusy(false)}}
 return <article className="shared-course"><div className="cs-heading"><div><span>{g.className?'FROM YOUR CLASS · '+g.className.toUpperCase():'ASSIGNED COURSE'}</span><h3>{g.title}</h3></div><b className="cs-sharing-state">{g.sharing?'Sharing on':'Sharing off'}</b></div>
 {g.settings?.instructions&&<p>{g.settings.instructions}</p>}{g.settings?.dueAt&&<p>Suggested due date: {new Date(g.settings.dueAt).toLocaleString()}. You can continue after this date.</p>}
 {g.helpSeen&&<p className="cs-seen" role="status"><span aria-hidden="true">✓</span> {g.className?'Your teacher for '+g.className:'Your organiser'} has seen your help request ({new Date(g.helpSeen.at).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}).{g.helpSeen.note?<> “{g.helpSeen.note}”</>:null}</p>}
 {!g.available&&<p className="message error">These activities changed or are unavailable. Your organiser needs to assign a reviewed version.</p>}
 <ol>{g.steps.map(s=>{const update=updates.find(u=>u.objectiveId===s.id),item=client.items.find(i=>i.jobId===s.jobId&&i.sourceHash===s.hash);return <li key={s.id}><div><small>{s.topicTitle}</small><h4>{s.objective}</h4><p>{s.title}</p><button className="primary" aria-label={item?(client.state.units.some(u=>u.id===unitKey(item.pack))?'Continue ':'Start ')+s.title:undefined} disabled={busy||!g.available||!item} onClick={async()=>{try{await onStart(item)}catch(e){setError(e.message)}}}>{!item?'Not available yet':client.state.units.some(u=>u.id===unitKey(item.pack))?'Continue':'Start'}</button></div><fieldset disabled={busy||!g.available||!g.storageAvailable}><legend>Your update for this objective</legend><label>Status<select value={update.status} onChange={e=>setUpdates(v=>v.map(u=>u.objectiveId===s.id?{...u,status:e.target.value}:u))}>{Object.entries(labels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label className="check"><input type="checkbox" checked={update.help} onChange={e=>setUpdates(v=>v.map(u=>u.objectiveId===s.id?{...u,help:e.target.checked}:u))}/>I would like help with this</label></fieldset></li>})}</ol>
 {g.available&&<TeacherReview assignment={g} client={client}/>}
 <aside className="cs-consent"><h4>You choose what to share.</h4><p className="cs-small"><b>Your scores on these activities</b> (games completed, questions right first time, help used) are visible to {g.className?'your teacher for '+g.className:'your organiser'}.</p><p>The statuses and help requests above go to {g.className?'your teacher for '+g.className:'your current organiser'}. These are your own updates, not grades. Private answers, conversations and interests are not included. Editing a choice does not send it.</p>
 {!g.storageAvailable&&<p role="alert">Saved updates are temporarily unavailable. You can still stop sharing.</p>}
 <div className="cs-switch-row"><span id={'cs-share-'+g.id}>Share my updates with {g.className?'my teacher for '+g.className:'my current organiser'}</span><button type="button" role="switch" className="cs-switch" aria-checked={!!g.sharing} aria-labelledby={'cs-share-'+g.id} disabled={busy||!g.sharing&&(!g.available||!g.storageAvailable)} onClick={()=>save(!g.sharing)}><span className="cs-switch-track" aria-hidden="true"><i/></span><b>{busy?'Saving…':g.sharing?'On':'Off'}</b></button></div>
 {!g.sharing&&<p className="cs-small">Turning this on sends the statuses and help requests above.</p>}{g.sharing&&<><div className="cs-actions"><button disabled={busy||!g.available||!g.storageAvailable} onClick={()=>save(true)}>{busy?'Saving…':'Send my updated status'}</button></div><p className="cs-small">Turn sharing off to stop sharing. Stopping hides your updates immediately. Saved updates remain in your private learning data until deleted or expired under your retention settings. <a href="/studio#data">Your data</a></p></>}</aside>
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
 {g.report.state==='shared'&&<><p className="cs-small">Last sent {new Date(g.report.updated).toLocaleString()}</p><ul>{g.steps.map(s=>{const u=g.report.updates.find(u=>u.objectiveId===s.id);return <li key={s.id}><span>{s.objective}</span><b>{labels[u.status]}</b>{u.help&&<strong className="cs-help">Help requested</strong>}</li>})}</ul>{g.report.updates.some(u=>u.help)&&<HelpSeen client={client} assignment={g} seen={g.helpSeen} onDone={()=>load()}/>}</>}
 {g.scores?.steps?.length>0&&<div className="cs-scores"><h5>Scores on this course</h5><ul>{g.scores.steps.map((s,i)=><li key={s.objectiveId} style={{'--i':i}}><span>{s.objective}</span><span className="sc-score">{!s.played?<><span className="sc-tiles" aria-hidden="true">{[0,1,2,3].map(k=><i key={k} className="sc-tile is-empty" style={{'--i':k}}/>)}</span><StatusPill state="none"/></>:<><ScoreTiles firstTry={s.firstTry} answered={s.answered} help={s.help}/><span>{s.firstTry}/{s.answered}</span><StatusPill state={s.completed?'done':'doing'}/></>}</span></li>)}</ul><p className="cs-small">From the assigned games. Teachers see these whether or not the learner shares updates.</p></div>}{g.available&&!g.revoked&&<TeacherReview assignment={g} client={client} teacher/>}
 {!g.revoked&&<button disabled={busy} onClick={()=>setConfirm(g)}>Withdraw course assignment</button>}
 {confirm?.id===g.id&&<div className="cs-withdraw"><p>Withdraw this course and its shared updates? The learner’s private saves remain. Chapters assigned separately remain available.</p><button disabled={busy} onClick={async()=>{setBusy(true);try{await client.journal.request('course-sharing',{action:'revoke',id:g.id,revision:g.revision});setConfirm(null);await load()}catch(e){setError(e.message);setBusy(false)}}}>Withdraw this course</button><button disabled={busy} onClick={()=>setConfirm(null)}>Keep assignment</button></div>}
 </article>)}
 {data&&(history.length>0||data.nextCursor)&&<nav aria-label="Shared updates pages"><button disabled={busy||!history.length} onClick={()=>{const next=history.at(-1);setHistory(h=>h.slice(0,-1));void load(next)}}>Previous learners</button><button disabled={busy||!data.nextCursor} onClick={()=>{setHistory(h=>[...h,cursor]);void load(data.nextCursor)}}>Next learners</button></nav>}
 </section>;
}
