import React,{useState} from 'react';
import './teacher-invites.css';

// Shared by Welcome and Studio › Classes: the teacher-verification notice, the invitation links
// (no email is sent, so the teacher copies them), and the "who are you inviting" mapping.
export const VERIFY_NOTICE='To invite pupils under 18, the organiser needs to verify you as a teacher.';
export const UNDER18_CODE_NOTICE='Pupils under 18 join with a personal invitation from their teacher.';
export const AGE_BANDS=[['13to17','Pupils 13–17'],['under13','Pupils under 13'],['18plus','Adults (18 or over)']];
export const canInvitePupils=s=>!!s&&(s.admin||s.verified!==false);
const when=t=>new Date(t).toLocaleString([],{weekday:'short',day:'numeric',month:'short',hour:'numeric',minute:'2-digit'});

export async function pilotRequest(userId,body){
 const r=await fetch('/api/pilot',{method:body?'POST':'GET',credentials:'include',cache:'no-store',headers:{'X-Mosaic-Learner':userId||'',...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined}),d=await r.json().catch(()=>({}));
 if(!r.ok)throw Object.assign(Error(d.error||'Account access could not be checked. Please try again.'),{status:r.status});return d;
}

// One email per line, optionally followed by a name: "ray@school.org, Ray Smith".
export function parseInviteLines(text){
 return String(text||'').split(/\n+/).flatMap(line=>{const t=line.trim();if(!t)return [];
  const m=t.match(/^([^\s,;<>]+@[^\s,;<>]+)\s*[,;\t]\s*(.+)$/);if(m)return [{email:m[1],name:m[2].trim().slice(0,60)}];
  return t.split(/[\s,;]+/).filter(Boolean).map(email=>({email,name:''}));});
}
// Builds the invite or invite-many body. Under-18s use the managed school setting and adults are invited as
// individuals (so their own setup only accepts 18+); a parent or guardian always uses the family setting.
export function inviteBody({lines,ageBand,label,classId,approved,role}){
 const minor=ageBand!=='18plus',context=role==='guardian'?'family':minor?'school':'individual',base={ageBand,context,managedApproval:context!=='individual'&&!!approved,...(classId?{classId}:{})};
 if(lines.length===1)return {action:'invite',email:lines[0].email,label:lines[0].name||label||'',...base};
 return {action:'invite-many',emails:lines.map(l=>l.email),...(lines.some(l=>l.name)?{labels:lines.map(l=>l.name)}:{}),group:label||'',...base};
}
export const invitesOf=r=>!r?[]:r.invites||(r.url?[{email:r.email||'',code:r.code,url:r.url,expires:r.expires}]:[]);

export function VerifyNotice({state,busy,onAsk}){
 const q=state?.verificationRequest;
 return <div className="ti-verify" role="note"><p><b>{VERIFY_NOTICE}</b> You can already create courses and classes, share class codes, assign work and invite adults.</p>
  {q?.status==='open'?<p className="ti-muted">Request sent {when(q.updated)}. The organiser will review it.</p>:q?.status==='declined'?<p className="ti-muted">Your last request wasn’t approved. You can ask again.</p>:null}
  <div className="ti-row">{q?.status!=='open'&&<button type="button" disabled={busy} onClick={onAsk}>Ask to be verified</button>}{state?.supportEmail&&<span className="ti-muted">or email <a href={'mailto:'+state.supportEmail}>{state.supportEmail}</a></span>}</div></div>;
}

export function InviteLinks({result,onDone}){
 const invites=invitesOf(result),[copied,setCopied]=useState('');
 if(!invites.length)return null;
 const copy=async(text,what)=>{try{await navigator.clipboard.writeText(text);setCopied(what)}catch{setCopied('Copy failed. Select the links and copy them yourself.')}};
 const all=invites.map(i=>(i.email?i.email+'\t':'')+i.url).join('\n');
 return <div className="ti-links" role="status"><div className="ti-row ti-links-head"><b>{invites.length===1?'Invitation ready':invites.length+' invitations ready'}{result.className?(invites.length===1?' · joins ':' · each joins ')+result.className:''}</b><button type="button" className="primary" onClick={()=>copy(all,invites.length===1?'Link copied.':'All '+invites.length+' links copied, one per line with its email.')}>{invites.length===1?'Copy link':'Copy all links'}</button>{onDone&&<button type="button" className="ti-quiet" onClick={onDone}>Done</button>}</div>
  <p className="ti-muted">No email has been sent. Send each link privately to its own person: it only works for the email it was made for, and expires in 7 days.</p>
  {copied&&<p className="ti-muted" aria-live="polite">{copied}</p>}
  <ul>{invites.map(i=><li key={i.code||i.url}>{i.email&&<span>{i.email}</span>}<input readOnly value={i.url} aria-label={'Invitation link'+(i.email?' for '+i.email:'')} onFocus={e=>e.currentTarget.select()}/><button type="button" className="ti-quiet" onClick={()=>copy(i.url,'Link copied'+(i.email?' for '+i.email:'')+'.')}>Copy</button></li>)}</ul></div>;
}
