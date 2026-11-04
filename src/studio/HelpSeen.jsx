import React,{useState} from 'react';
import './feedback.css';

// "Help seen": tells a learner their help request reached you. It's a receipt, not a reply or a grade.
// It clears by itself when the learner sends a new update or stops sharing.
export const HELP_NOTES=[['','No note'],['check-in','I’ll check in with you next lesson.'],['feedback','I’ve left you feedback on your work.'],['try-again','Have another go, then send me an update.']];
const date=ms=>new Date(ms).toLocaleDateString('en-GB',{day:'numeric',month:'short'});
export function HelpSeen({client,assignment,seen,onDone}){
 const [note,setNote]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 if(seen)return <p className="hs-seen"><span aria-hidden="true">✓</span> You marked this seen on {date(seen.at)}{seen.note?<> · “{seen.note}”</>:null}</p>;
 const mark=async()=>{setBusy(true);setError('');try{const r=await client.journal.request('course-sharing',{action:'help-seen',id:assignment.id,revision:assignment.revision,note});await onDone?.(r.seen)}catch(e){setError(e.message)}finally{setBusy(false)}};
 return <div className="hs-form">
  <label>Short note (optional)<select value={note} disabled={busy} onChange={e=>setNote(e.target.value)}>{HELP_NOTES.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
  <button className="primary" disabled={busy} onClick={mark}>{busy?'Saving…':'Mark as seen'}</button>
  <p className="hs-small">The learner sees that you've seen it{note?', with your note':''}. It isn't a grade.</p>
  {error&&<p className="message error" role="alert">{error}</p>}
 </div>;
}
