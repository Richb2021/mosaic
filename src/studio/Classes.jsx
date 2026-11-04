import React,{useEffect,useRef,useState} from 'react';
import './classes.css';
import {TeacherReview} from './TeacherReview.jsx';
import {HelpSeen} from './HelpSeen.jsx';
import {FeedbackStarters,addStarter} from './feedback-starters.jsx';
import {classCSV,exportName} from './class-export.js';
import {ScoreTiles,NotPlayed,CountUp} from './score-tiles.jsx';

// Classes: teachers see one dashboard per class; learners join with a code and choose
// what to share. Nothing here is a grade, and "not shared" is never shown as inactive.
const STICKERS=[['star','Star'],['lantern','Lantern'],['lightbulb','Bright idea'],['heart','Kind'],['rocket','Big step']];
const STICKER_ICON={star:'★',lantern:'✦',lightbulb:'☀',heart:'♥',rocket:'➶'};
const STATUS_LABEL={practised:'Practised',started:'Started','not-started':'Not started'};
const ago=(ms,verb='Shared')=>{if(!ms)return 'Not shared yet';const d=Math.floor((Date.now()-ms)/86400000);return d<=0?verb+' today':d===1?verb+' yesterday':d<7?verb+' '+d+' days ago':verb+' '+new Date(ms).toLocaleDateString('en-GB',{day:'numeric',month:'short'})};
const initials=label=>String(label||'').split(' ').map(w=>w[0]).join('').slice(0,2);
const pretty=code=>code?code.slice(0,3)+'-'+code.slice(3):'';
export const shareKey=(kind,unitId,extra='')=>(kind+'-'+unitId+(extra?'-'+extra:'')).replace(/[^A-Za-z0-9:_-]/g,'-').slice(0,80);

function useClasses(client){
 const [data,setData]=useState(null),[error,setError]=useState(''),seq=useRef(0);
 const load=async()=>{const n=++seq.current;try{const d=await client.journal.request('classes');if(n===seq.current){setData(d);setError('')}return d}catch(e){if(n===seq.current)setError(e.message)}};
 useEffect(()=>{if(client.journal.user)load()},[client.journal.user?.id]);
 return {data,error,load,setError};
}

function Board({board,compact}){
 if(!board?.enabled)return null;
 if(!board.entries.length)return <p className="cl-muted">No one has joined the leaderboard yet this week.</p>;
 const rows=compact?board.entries.slice(0,5):board.entries;
 return <ol className="cl-board">{rows.map((e,i)=><li key={i} className={(e.you?'is-you ':'')+(e.rank?'':'is-waiting')}><span className="cl-rank">{e.rank||'·'}</span><span className="cl-nick">{e.nickname}{e.you&&<small> · you</small>}</span><span className="cl-steps">{e.rank?<><b><CountUp value={e.tiles}/></b> steps</>:'Not reported yet this week'}</span></li>)}{board.you&&!rows.some(r=>r.you)&&<li className="is-you"><span className="cl-rank">{board.you.rank||'·'}</span><span className="cl-nick">{board.you.nickname} <small>· you</small></span><span className="cl-steps">{board.you.rank?<><b>{board.you.tiles}</b> steps</>:'Not reported yet this week'}</span></li>}</ol>;
}

/* ---------------- Teacher ---------------- */
export function TeacherClasses({client,onCourses}){
 const {data,error,load,setError}=useClasses(client);
 const [selected,setSelected]=useState(null),[overview,setOverview]=useState(null),[name,setName]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[cursor,setCursor]=useState('0');
 const open=async(id,c='0')=>{setSelected(id);setCursor(c);setOverview(null);try{setOverview(await client.journal.request('classes?view=overview&id='+id+'&cursor='+c))}catch(e){setError(e.message)}};
 const act=async(body,message)=>{setBusy(true);setError('');setNotice('');try{const r=await client.journal.request('classes',body);if(message)setNotice(message);const d=await load();if(body.action==='create'&&r.class)await open(r.class.id);else if(selected&&body.action!=='delete')await open(selected,cursor);if(body.action==='delete'){setSelected(null);setOverview(null)}return r}catch(e){setError(e.message)}finally{setBusy(false)}};
 useEffect(()=>{if(!selected&&data?.teaching?.length)open(data.teaching[0].id)},[data]);
 // After a reply from the inbox, update that one item here rather than re-reading every learner's reports.
 const patchInbox=(k,changes)=>setOverview(o=>{if(!o)return o;const inbox=o.inbox.map(i=>i.kind+i.assignment.id===k?{...i,...changes}:i);return {...o,inbox,counts:{...o.counts,workToReview:inbox.filter(i=>i.kind==='work'&&!i.done).length,helpWaiting:inbox.filter(i=>i.kind==='help'&&!i.done).length}}});
 const download=async()=>{setBusy(true);setError('');setNotice('');try{
  const rows=[];let next='';do{const r=await client.journal.request('classes?view=export&id='+selected+(next?'&cursor='+next:''));rows.push(...r.rows);next=r.nextCursor}while(next);
  const url=URL.createObjectURL(new Blob([classCSV(rows)],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=exportName(overview?.class?.name);document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
  setNotice('Spreadsheet downloaded: '+rows.length+(rows.length===1?' row.':' rows.'));
 }catch(e){setError(e.message)}finally{setBusy(false)}};
 const copy=async code=>{try{await navigator.clipboard.writeText(pretty(code));setNotice('Join code copied.')}catch{setNotice('Join code: '+pretty(code))}};
 if(!client.journal.user)return <section className="empty-state"><h1>Sign in to create classes</h1><p>Classes need your teacher account so learners can join with a code.</p><a className="button primary" href="/account.html">Sign in</a></section>;
 const o=overview,c=o?.class;
 return <div className="cl-teacher">
  <div className="page-heading"><div><h1>Classes</h1><p>One place per class: who has joined, what they chose to share, and what needs your review.</p></div></div>
  {error&&<p className="message error" role="alert">{error}</p>}{notice&&<p className="message success" role="status">{notice}</p>}
  <div className="cl-layout">
   <aside className="cl-index" aria-label="Your classes">
    <h2>Your classes</h2>
    {!data?<p className="cl-muted"><span className="ll-loader" aria-hidden="true"><i/><i/><i/><i/></span> Loading…</p>:!data.teaching.length?<p className="cl-muted">No classes yet. Create your first one below.</p>:
     <ul>{data.teaching.map(t=><li key={t.id}><button className={'cl-class'+(t.id===selected?' is-on':'')} aria-current={t.id===selected?'true':undefined} onClick={()=>open(t.id)}><span>{t.name}</span><small>{t.learners} {t.learners===1?'learner':'learners'}{t.archived?' · archived':''}</small></button></li>)}</ul>}
    <form className="cl-create" onSubmit={e=>{e.preventDefault();if(name.trim().length>=2)act({action:'create',name}, 'Class created. Share the join code with your learners.').then(()=>setName(''))}}>
     <label htmlFor="cl-new">New class</label><input id="cl-new" value={name} maxLength={60} placeholder="e.g. Year 8 History" onChange={e=>setName(e.target.value)}/><button className="primary" disabled={busy||name.trim().length<2}>Create class</button>
    </form>
   </aside>
   <section className="cl-main">
    {!selected?<div className="empty-state"><h2>Create a class to get a join code</h2><p>Learners type the code in Me › Classes. You choose whether the class has a leaderboard.</p></div>:!o?<p className="cl-muted"><span className="ll-loader" aria-hidden="true"><i/><i/><i/><i/></span> Opening class…</p>:<>
     <header className="cl-head">
      <div><h2>{c.name}</h2><p>{o.counts.learners} {o.counts.learners===1?'learner':'learners'}{c.archived?' · archived, no new joins':''}</p></div>
      <div className="cl-code"><span>Join code</span><strong>{pretty(c.code)}</strong><button onClick={()=>copy(c.code)}>Copy</button><button className="text-button" disabled={busy} onClick={()=>act({action:'code',id:c.id},'New code ready. The old one no longer works.')}>New code</button></div>
     </header>
     <div className="cl-kpis">
      <button className="cl-kpi" onClick={onCourses}><span className="cl-kpi-icon is-amber">✓</span><span>Your chapters to review <small>(all classes)</small></span><b>{o.counts.review}</b></button>
      <div className="cl-kpi"><span className="cl-kpi-icon is-teal">◆</span><span>Sharing updates{o.counts.partial?' (this page)':''}</span><b>{o.counts.sharing} <small>of {o.counts.partial?o.counts.pageSize:o.counts.learners}</small></b></div>
      <button className="cl-kpi" onClick={()=>document.getElementById('cl-inbox-h')?.scrollIntoView({behavior:'smooth',block:'start'})}><span className="cl-kpi-icon is-coral">♥</span><span>Waiting in your inbox{o.counts.partial?' (this page)':''} <small>{o.counts.workToReview} work · {o.counts.helpWaiting} help</small></span><b>{o.counts.workToReview+o.counts.helpWaiting}</b></button>
      <div className="cl-kpi"><span className="cl-kpi-icon is-violet">✎</span><span>Explanations to read</span><b>{o.counts.unread}</b></div>
     </div>
     <Inbox o={o} client={client} onPatch={patchInbox}/>
     <div className="cl-grid">
      <section className="cl-card" aria-labelledby="cl-mosaic-h">
       <div className="cl-card-head"><h3 id="cl-mosaic-h">Class mosaic</h3><span>Latest shared update</span></div>
       {!o.learners.length?<p className="cl-muted">No one has joined yet. Share the code <b>{pretty(c.code)}</b>.</p>:<div className="cl-mosaic">{o.learners.map(l=><span key={l.handle} title={l.label+' · '+ago(l.lastShared)} className={'cl-tile '+(l.help?'is-help':l.latest==='practised'?'is-practised':l.latest==='started'||l.lastShared?'is-started':'is-quiet')}>{initials(l.label)}</span>)}</div>}
       <div className="cl-legend"><span><i className="is-practised"/>Practised</span><span><i className="is-started"/>Started or shared</span><span><i className="is-help"/>Asked for help</span><span><i className="is-quiet"/>Not sharing</span></div>
       <p className="cl-muted">Learners choose what to share. These are their own updates, not grades. Not sharing is never shown as inactive.</p>
      </section>
      <section className="cl-card" aria-labelledby="cl-board-h">
       <div className="cl-card-head"><h3 id="cl-board-h">Leaderboard</h3><label className="cl-switch"><input type="checkbox" checked={c.leaderboard} disabled={busy} onChange={e=>act({action:'leaderboard',id:c.id,enabled:e.target.checked},e.target.checked?'Leaderboard on. Learners can choose to join it.':'Leaderboard off.')}/><span aria-hidden="true"/>{c.leaderboard?'On':'Off'}</label></div>
       {c.leaderboard?<><Board board={o.leaderboard}/><p className="cl-muted">Steps taken this week, nicknames only. Learners opt in, and it resets every Monday.</p></>:<p className="cl-muted">Off. When it's on, learners who opt in appear by nickname with the steps they took this week. Steps are effort, not scores.</p>}
      </section>
     </div>
     <section className="cl-card" aria-labelledby="cl-learners-h">
      <div className="cl-card-head"><h3 id="cl-learners-h">Learners</h3><span>{o.counts.partial?'Showing '+(o.counts.pageStart+1)+'–'+(o.counts.pageStart+o.counts.pageSize)+' of '+o.counts.learners:o.counts.learners+' in this class'}</span><button className="text-button" disabled={busy||!o.counts.learners} onClick={download} title="A spreadsheet of what learners chose to share with you. Leaderboard nicknames are left out.">Download spreadsheet (CSV)</button></div>
      <div className="cl-assign"><p><b>Set work for the whole class.</b> Open a course, then choose <i>Assign to a whole class</i>. Learners marked “Managed elsewhere” are skipped.</p><button className="text-button" onClick={onCourses}>Open Courses</button></div>
      {!o.learners.length?<p className="cl-muted">Nobody yet.</p>:<div className="cl-table-wrap"><table className="cl-table"><thead><tr><th>Learner</th><th>Last update shared</th><th>Latest</th><th>Scores</th><th>Explanations</th><th><span className="cl-sr">Actions</span></th></tr></thead><tbody>
       {o.learners.map(l=><tr key={l.handle}><td><span className="cl-avatar">{initials(l.label)}</span>{l.label}{l.group==='class'&&<span className="cl-chip is-code" title="Joined with the class code. Class assignments reach them while they stay in the class.">Joined by code</span>}{l.group==='elsewhere'&&<span className="cl-chip is-elsewhere" title="Their school or family organiser manages their access, so class assignments skip them. Ask the administrator to move them to your group.">Managed elsewhere</span>}{l.help&&<span className="cl-chip is-help">Asked for help</span>}</td><td data-label="Last update shared">{ago(l.lastShared)}</td><td data-label="Latest">{l.latest?STATUS_LABEL[l.latest]:'—'}</td><td data-label="Scores">{!l.scores||!l.scores.total?'—':!l.scores.played?<NotPlayed/>:<span className="sc-cell"><ScoreTiles firstTry={l.scores.firstTry} answered={l.scores.answered} help={l.scores.help}/><small>{l.scores.firstTry}/{l.scores.answered} right first time · {l.scores.completed}/{l.scores.total} games done</small></span>}</td><td data-label="Explanations">{l.explanations?l.explanations+(l.unread?' · '+l.unread+' new':''):'—'}</td><td><button className="text-button danger" disabled={busy} onClick={()=>{if(window.confirm?.('Remove '+l.label+' from '+c.name+'? Their shared explanations and leaderboard entry for this class are removed.')!==false)act({action:'remove',id:c.id,handle:l.handle},l.label+' removed from the class.')}}>Remove</button></td></tr>)}
      </tbody></table></div>}
      {o.learners.some(l=>l.scores?.played)&&<p className="sc-legend"><span><i className="is-first"/>Right first time</span><span><i className="is-help"/>Help used</span><span><i className="is-retry"/>Took another try</span><span>Scores come from the games you assigned.</span></p>}
      {(o.nextCursor||cursor!=='0')&&<div className="cl-pager">{cursor!=='0'&&<button onClick={()=>open(c.id,String(Math.max(0,Number(cursor)-20)))}>Previous</button>}{o.nextCursor&&<button onClick={()=>open(c.id,o.nextCursor)}>Next 20</button>}</div>}
     </section>
     <section className="cl-card" aria-labelledby="cl-ex-h">
      <div className="cl-card-head"><h3 id="cl-ex-h">Explanations shared with you</h3><span>{o.counts.explanations} shared</span></div>
      {!o.shares.length?<p className="cl-muted">When a learner shares an "explain it back", it appears here for you to respond to.</p>:o.shares.map(s=><Explanation key={s.handle+s.key} s={s} busy={busy} onSend={f=>act({action:'feedback',id:c.id,handle:s.handle,key:s.key,...f},'Feedback sent to '+s.label+'.')}/>)}
     </section>
     {o.review.length>0&&<section className="cl-card" aria-labelledby="cl-rev-h"><div className="cl-card-head"><h3 id="cl-rev-h">Your chapters waiting for review <small className="cl-muted">· across all your classes</small></h3><button className="text-button" onClick={onCourses}>Open Courses</button></div><ul className="cl-review">{o.review.map(r=><li key={r.id}><strong>{r.title}</strong><span>{r.sources} {r.sources===1?'source':'sources'}</span></li>)}</ul></section>}
     <div className="cl-danger">
      <button disabled={busy} onClick={()=>act({action:c.archived?'restore':'archive',id:c.id},c.archived?'Class reopened.':'Class archived. The join code stops working.')}>{c.archived?'Reopen class':'Archive class'}</button>
      <button className="text-button danger" disabled={busy} onClick={()=>{if(window.confirm?.('Delete '+c.name+'? Members, shared explanations and the leaderboard are removed. This cannot be undone.')!==false)act({action:'delete',id:c.id,confirmed:true},'Class deleted.')}}>Delete class</button>
     </div>
    </>}
   </section>
  </div>
 </div>;
}

// The inbox: work learners sent for feedback and help they asked for, newest first, waiting items on top.
function Inbox({o,client,onPatch}){
 // Items you reply to stay in view (marked done) until you switch the filter, so you can see what happened.
 const [all,setAll]=useState(false),[kept,setKept]=useState(()=>new Set()),[notice,setNotice]=useState('');
 const key=i=>i.kind+i.assignment.id,items=all?o.inbox:o.inbox.filter(i=>!i.done||kept.has(key(i))),done=o.inbox.filter(i=>i.done).length;
 const handled=(i,message)=>async seen=>{setKept(k=>new Set(k).add(key(i)));setNotice(message);onPatch(key(i),{done:true,doneAt:seen?.at||Date.now(),...(i.kind==='help'?{note:seen?.note||null}:{})})};
 const show=v=>{setAll(v);setKept(new Set());setNotice('')};
 return <section className="cl-card cl-inbox" aria-labelledby="cl-inbox-h">
  <div className="cl-card-head"><h3 id="cl-inbox-h">Inbox</h3><div className="cl-pick" role="group" aria-label="Show"><button aria-pressed={!all} onClick={()=>show(false)}>Needs you ({o.inbox.length-done})</button><button aria-pressed={all} onClick={()=>show(true)}>All ({o.inbox.length})</button></div></div>
  <div aria-live="polite">{notice&&<p className="message success">{notice}</p>}</div>
  {o.counts.partial&&<p className="cl-muted">For learners {o.counts.pageStart+1}–{o.counts.pageStart+o.counts.pageSize} of {o.counts.learners}. Use Next 20 under Learners to see the rest.</p>}
  {!items.length?<p className="cl-muted">{o.inbox.length?'You’ve replied to everything here.':'Nothing yet. When learners send work for feedback or ask for help on a course you assigned, it appears here.'}</p>:
   <ul className="cl-inbox-list">{items.map(i=><li key={key(i)} className={'cl-inbox-item'+(i.done?' is-done':'')}>
    <div className="cl-ex-head"><span className="cl-avatar">{initials(i.label)}</span><div><strong>{i.label}</strong><small>{i.kind==='work'?'Sent work for feedback':'Asked for help'} · {i.assignment.title} · {ago(i.at,'Sent')}</small></div><span className={'cl-chip '+(i.done?'is-done':i.kind==='help'?'is-help':'is-work')}>{i.done?(i.kind==='work'?'Feedback sent':'Seen'):i.kind==='work'?'Work to review':'Help requested'}</span></div>
    {i.kind==='help'?<><p className="cl-help-on">Help with:</p><ul className="cl-help-list">{i.objectives.map(t=><li key={t}>{t}</li>)}</ul><HelpSeen client={client} assignment={i.assignment} seen={i.done?{at:i.doneAt,note:i.note}:null} onDone={handled(i,'Marked as seen. '+i.label+' can see that you’ve seen their request.')}/></>:
     <TeacherReview assignment={i.assignment} client={client} teacher onChange={handled(i,'Feedback sent to '+i.label+'.')}/>}
   </li>)}</ul>}
  {o.counts.unread>0&&<p className="cl-muted"><span><a href="#cl-ex-h">{o.counts.unread} {o.counts.unread===1?'explanation':'explanations'} waiting for a reply</a> further down.</span></p>}
 </section>;
}

function Explanation({s,busy,onSend}){
 const [strength,setStrength]=useState(''),[next,setNext]=useState(''),[sticker,setSticker]=useState(null);
 return <article className="cl-ex">
  <div className="cl-ex-head"><span className="cl-avatar">{initials(s.label)}</span><div><strong>{s.label}</strong><small>{s.title} · {ago(s.shared)}</small></div></div>
  <blockquote>{s.text}</blockquote>
  {s.feedback?<div className="cl-sent">{s.feedback.sticker&&<span className="cl-sticker" aria-label={s.feedback.sticker+' sticker'}>{STICKER_ICON[s.feedback.sticker]}</span>}<p><b>What worked:</b> {s.feedback.strength}</p>{s.feedback.nextStep&&<p><b>Next step:</b> {s.feedback.nextStep}</p>}</div>:
  <form className="cl-fb" onSubmit={e=>{e.preventDefault();if(strength.trim())onSend({strength,nextStep:next,sticker})}}>
   <label>What worked<textarea rows={2} maxLength={600} value={strength} onChange={e=>setStrength(e.target.value)}/></label>
   <label>A next step (optional)<textarea rows={2} maxLength={600} value={next} onChange={e=>setNext(e.target.value)}/></label>
   <FeedbackStarters disabled={busy} onStrength={line=>setStrength(v=>addStarter(v,line).slice(0,600))} onNext={line=>setNext(v=>addStarter(v,line).slice(0,600))}/>
   <div className="cl-stickers" role="group" aria-label="Add a sticker">{STICKERS.map(([id,label])=><button type="button" key={id} aria-pressed={sticker===id} onClick={()=>setSticker(sticker===id?null:id)} title={label}><span aria-hidden="true">{STICKER_ICON[id]}</span><span className="cl-sr">{label}</span></button>)}</div>
   <button className="primary" disabled={busy||!strength.trim()}>Send feedback</button>
  </form>}
 </article>;
}

/* ---------------- Learner ---------------- */
export function LearnerClasses({client,onChange}){
 const {data,error,load,setError}=useClasses(client);
 const [code,setCode]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[boards,setBoards]=useState({});
 const act=async(body,message)=>{setBusy(true);setError('');setNotice('');try{const r=await client.journal.request('classes',body);if(message)setNotice(message);await load();onChange?.();return r}catch(e){setError(e.message)}finally{setBusy(false)}};
 useEffect(()=>{(data?.joined||[]).filter(j=>j.leaderboard).forEach(async j=>{try{const r=await client.journal.request('classes?view=board&id='+j.id);setBoards(b=>({...b,[j.id]:r.leaderboard}))}catch{}})},[data]);
 if(!client.journal.user)return <section className="empty-state"><h2>Sign in to join a class</h2><p>Your teacher's class code works once you're signed in, so your class can find your shared work on any device.</p><a className="button primary" href="/account.html">Sign in</a></section>;
 return <div className="cl-learner">
  {error&&<p className="message error" role="alert">{error}</p>}{notice&&<p className="message success" role="status">{notice}</p>}
  <form className="cl-join surface" onSubmit={e=>{e.preventDefault();act({action:'join',code},'You joined the class.').then(()=>setCode(''))}}>
   <div><h2>Join a class</h2><p>Type the 6-character code your teacher gave you.</p></div>
   <label htmlFor="cl-code" className="cl-sr">Class code</label>
   <input id="cl-code" className="cl-code-input" value={code} maxLength={7} autoComplete="off" spellCheck={false} placeholder="ABC-234" onChange={e=>setCode(e.target.value.toUpperCase())}/>
   <button className="primary" disabled={busy||code.replace(/[^A-Za-z0-9]/g,'').length!==6}>Join class</button>
  </form>
  {data&&!data.joined.length&&<p className="cl-muted">You're not in a class yet.</p>}
  {(data?.joined||[]).map(j=><section key={j.id} className="cl-card cl-joined" aria-labelledby={'cl-j-'+j.id}>
   <div className="cl-card-head"><div><h3 id={'cl-j-'+j.id}>{j.name}</h3><span>with {j.teacher}{j.archived?' · class closed':''}</span></div><button className="text-button danger" disabled={busy} onClick={()=>{if(window.confirm?.('Leave '+j.name+'? Anything you shared with this class is removed.')!==false)act({action:'leave',id:j.id},'You left '+j.name+'.')}}>Leave class</button></div>
   {j.archived&&<p className="cl-muted">Your teacher has closed this class. You can still stop sharing or leave.</p>}{j.leaderboard&&<LeaderboardOptIn j={j} busy={busy} board={boards[j.id]} onSave={(optIn,nickname)=>act({action:'board',id:j.id,optIn,nickname},optIn?'You joined the leaderboard as '+nickname+'.':'You left the leaderboard.')}/>}
   <h4>What you've shared</h4>
   {!j.shares.length?<p className="cl-muted">Nothing yet. On your Trail, choose "Share with my class" under an explanation. Only that text is shared.</p>:<ul className="cl-shares">{j.shares.map(s=><li key={s.key}><div><strong>{s.title}</strong><small>{ago(s.shared)}</small>{s.feedback&&<div className="cl-sent">{s.feedback.sticker&&<span className="cl-sticker">{STICKER_ICON[s.feedback.sticker]}</span>}<p><b>{j.teacher}:</b> {s.feedback.strength}</p>{s.feedback.nextStep&&<p><b>Next step:</b> {s.feedback.nextStep}</p>}</div>}</div><button className="text-button" disabled={busy} onClick={()=>act({action:'unshare',id:j.id,key:s.key},'Stopped sharing. Your teacher can no longer see it.')}>Stop sharing</button></li>)}</ul>}
  </section>)}
 </div>;
}

function LeaderboardOptIn({j,busy,board,onSave}){
 const [nick,setNick]=useState(j.nickname||'');
 return <div className="cl-optin">
  <div className="cl-optin-row"><div><strong>Class leaderboard</strong><p className="cl-muted">Shows your nickname and the steps you took this week. Steps are effort, not scores. Your real name is never shown.</p></div>
   {j.optIn?<button disabled={busy} onClick={()=>onSave(false)}>Leave leaderboard</button>:null}</div>
  {!j.optIn&&<form className="cl-nick" onSubmit={e=>{e.preventDefault();onSave(true,nick)}}><label htmlFor={'nick-'+j.id}>Nickname</label><input id={'nick-'+j.id} value={nick} maxLength={20} placeholder="e.g. River Fox" onChange={e=>setNick(e.target.value)}/><button className="primary" disabled={busy||nick.trim().length<2}>Join leaderboard</button></form>}
  {j.optIn&&<Board board={board}/>}
 </div>;
}

/* ---------------- Today card ---------------- */
export function ClassBoardCard({client,weekSteps}){
 const [state,setState]=useState(null);
 useEffect(()=>{if(!client.journal.user)return;let live=true;(async()=>{try{
  const d=await client.journal.request('classes'),open=(d.joined||[]).filter(j=>j.leaderboard&&!j.archived),opted=open.filter(j=>j.optIn),j=opted[0]||open[0];
  if(!j){if(live)setState({joined:(d.joined||[]).length});return}
  // Steps go to every class where the learner opted in; the card shows the first.
  let board=null;
  for(const k of opted){const r=await client.journal.request('classes',{action:'steps',id:k.id,tiles:Math.min(500,weekSteps)});if(k===j)board=r.leaderboard;}
  if(!j.optIn)board=(await client.journal.request('classes?view=board&id='+j.id)).leaderboard;
  if(live)setState({j,board,joined:d.joined.length,more:opted.length-1});
 }catch{}})();return()=>{live=false}},[client.journal.user?.id,weekSteps]);
 if(!client.journal.user||!state)return null;
 if(!state.j)return state.joined?null:<section className="lh-class lh-class-join"><h2>Got a class code?</h2><p>Join your teacher's class in Me › Classes.</p></section>;
 return <section className="lh-class" aria-labelledby="lh-class-h"><div className="lh-class-head"><h2 id="lh-class-h">{state.j.name}</h2><span>This week{state.more>0?` · +${state.more} more ${state.more===1?'class':'classes'}`:''}</span></div>{state.j.optIn?<Board board={state.board} compact/>:<p className="cl-muted">Your class has a leaderboard. Join it with a nickname in Me › Classes.</p>}</section>;
}

/* ---------------- Share an explanation ---------------- */
export function ShareExplanation({client,classes,shareKey:key,title,text,onShared}){
 const [open,setOpen]=useState(false),[pick,setPick]=useState(null),[busy,setBusy]=useState(false),[msg,setMsg]=useState('');
 const all=classes?.joined||[],joined=all.filter(j=>!j.archived||j.shares.some(s=>s.key===key));
 if(!client.journal.user||!joined.length||!text)return null;
 const sharedIn=joined.filter(j=>j.shares.some(s=>s.key===key));
 const send=async(j,on)=>{setBusy(true);setMsg('');try{await client.journal.request('classes',on?{action:'share',id:j.id,key,title,text:text.slice(0,1200),confirmed:true}:{action:'unshare',id:j.id,key});setMsg(on?'Shared with '+j.name+'.':'Stopped sharing with '+j.name+'.');setOpen(false);onShared?.()}catch(e){setMsg(e.message)}finally{setBusy(false)}};
 return <div className="cl-share">
  {sharedIn.map(j=>{const s=j.shares.find(s=>s.key===key);return <div key={j.id} className="cl-share-state"><span>Shared with {j.name}</span>{s.feedback&&<span className="cl-chip">{s.feedback.sticker?STICKER_ICON[s.feedback.sticker]+' ':''}{j.teacher} replied</span>}<button className="text-button" disabled={busy} onClick={()=>send(j,false)}>Stop sharing</button>{s.feedback&&<p className="cl-feedback"><b>{j.teacher}:</b> {s.feedback.strength}{s.feedback.nextStep?' Next: '+s.feedback.nextStep:''}</p>}</div>})}
  {!open&&joined.some(j=>!sharedIn.includes(j)&&!j.archived)&&<button className="text-button" onClick={()=>{setOpen(true);setPick(joined.find(j=>!sharedIn.includes(j)&&!j.archived)?.id)}}>Share with my class</button>}
  {open&&<div className="cl-share-box"><p><b>Only this explanation is shared.</b> Your answers and chats stay private (your teacher sees scores only on work they assigned). You can stop sharing any time.</p><blockquote>{text.slice(0,1200)}</blockquote>
   {joined.filter(j=>!sharedIn.includes(j)&&!j.archived).length>1&&<div className="cl-pick" role="group" aria-label="Class">{joined.filter(j=>!sharedIn.includes(j)&&!j.archived).map(j=><button key={j.id} aria-pressed={pick===j.id} onClick={()=>setPick(j.id)}>{j.name}</button>)}</div>}
   <div className="cl-share-actions"><button className="primary" disabled={busy||!pick} onClick={()=>send(joined.find(j=>j.id===pick),true)}>Share with {joined.find(j=>j.id===pick)?.name||'class'}</button><button onClick={()=>setOpen(false)}>Cancel</button></div></div>}
  {msg&&<p className="cl-muted" role="status">{msg}</p>}
 </div>;
}
