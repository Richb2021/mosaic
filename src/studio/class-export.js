// Builds the class CSV from the export view. Only what learners chose to share is in it;
// a blank status means "not shared", never "not started". Leaderboard data is left out.
// The learner key is the start of this class's private handle, so two learners with the same name can be told apart.
const GROUP={yours:'Your group',class:'Joined by code',elsewhere:'Managed elsewhere'};
const STATUS={practised:'Practised',started:'Started','not-started':'Not started'};
const SHARING={off:'Not shared',expired:'Shared update expired',unavailable:'Not available right now'};
export const COLUMNS=['Learner','Learner key (this class)','Group','Joined class','Course','Objective','Learner’s own status (self-report)','Asked for help','Help marked seen','Update shared on','Work sent for feedback on','Your feedback sent on','Explanations shared','Explanations you replied to'];
const day=ms=>ms?new Date(ms).toISOString().slice(0,10):'';
// Quote every cell; a leading = + - @ or control character is neutralised so spreadsheets never run it as a formula.
export const cell=v=>{let s=v==null?'':String(v);if(/^[=+\-@\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'};
export function rowValues(r){
 const status=!r.course?'No course from you':r.status?STATUS[r.status]||'':SHARING[r.sharing]||'Not shared';
 return [r.learner,r.key||'',GROUP[r.group]||'',day(r.joined),r.course||'',r.objective||'',status,r.help==null?'':r.help?'Yes':'No',day(r.helpSeenAt),day(r.updateSharedAt),day(r.workSubmittedAt),day(r.feedbackSentAt),r.explanations??'',r.explanationsAnswered??''];
}
export function classCSV(rows){return '﻿'+[COLUMNS,...rows.map(rowValues)].map(r=>r.map(cell).join(',')).join('\r\n')+'\r\n'}
export const exportName=(name,now=Date.now())=>(String(name||'class').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'class')+'-shared-updates-'+day(now)+'.csv';
