import {withLearningMap} from './learning-map.js';
const text=(v,n=1600)=>typeof v==='string'&&v.trim().length>0&&v.length<=n;
const id=v=>text(v,80)&&/^[a-z][a-z0-9-]*$/.test(v);
export function validateChapterContent(raw){
 if(typeof raw==='string'){if(new TextEncoder().encode(raw).length>131072)throw Error('Chapter files must be below 128 KB.');raw=JSON.parse(raw)}
 let nodes=0;function scan(x,d=0){if(++nodes>1500||d>8)throw Error('Chapter is too complex.');if(typeof x==='string'&&x.length>4000)throw Error('Chapter passage is too long.');if(x&&typeof x==='object')for(const k of Object.keys(x)){if(['__proto__','constructor','prototype'].includes(k))throw Error('Unsafe field.');scan(x[k],d+1)}}scan(raw);
 if(!raw||raw.schemaVersion!==1||raw.template!=='underlight-v1'||!id(raw.id)||!id(raw.topicId)||!Number.isInteger(raw.revision)||raw.revision<1||raw.revision>100000||!text(raw.title,100)||!text(raw.hook)||!text(raw.aftermath?.gardens)||!text(raw.aftermath?.homes))throw Error('Use a versioned Underlight chapter with a title, hook and two aftermaths.');
 if(!Array.isArray(raw.sources)||!raw.sources.length||raw.sources.length>12||raw.sources.some(s=>!id(s.id)||!text(s.title,160)||!text(s.locator,160)||!text(s.excerpt,3000))||new Set(raw.sources.map(s=>s.id)).size!==raw.sources.length)throw Error('Each source needs a unique id, title, precise locator and excerpt.');
 const challenges={};for(const [key,type] of Object.entries({route:'sequence',balance:'allocation',transfer:'dials'})){
  const q=raw.challenges?.[key];if(!q||q.type!==type||!text(q.title,100)||!text(q.prompt)||!text(q.hint)||!text(q.explanation)||!text(q.feedback)||!text(q.objective,240)||!Array.isArray(q.sourceRefs)||!q.sourceRefs.length||q.sourceRefs.some(r=>!raw.sources.some(s=>s.id===r)))throw Error('Every mechanism needs an objective, feedback and valid source references.');
  if(type==='sequence'&&(!Array.isArray(q.labels)||q.labels.length!==3||!Array.isArray(q.solution)||q.solution.length!==3||new Set(q.solution).size!==3||q.solution.some(x=>!Number.isInteger(x)||x<0||x>2)))throw Error('Routing needs three labels and a permutation.');
  if(type==='allocation'&&(!Array.isArray(q.labels)||q.labels.length!==2||!Number.isInteger(q.total)||q.total<2||q.total>20||!Number.isInteger(q.solution)||q.solution<0||q.solution>q.total))throw Error('Balance needs two labels, a total and a valid left allocation.');
  if(type==='dials'&&(!Array.isArray(q.labels)||q.labels.length!==3||!Array.isArray(q.options)||q.options.length!==3||q.options.some(v=>!text(v,100))||!Array.isArray(q.solution)||q.solution.length!==3||q.solution.some(x=>!Number.isInteger(x)||x<0||x>2)))throw Error('Transfer needs three dials with three options each.');
  if(q.labels.some(v=>!text(v,120)))throw Error('Mechanism labels are too long.');
  challenges[key]={type,title:q.title,prompt:q.prompt,hint:q.hint,explanation:q.explanation,feedback:q.feedback,objective:q.objective,sourceRefs:[...new Set(q.sourceRefs)],labels:[...q.labels],solution:Array.isArray(q.solution)?[...q.solution]:q.solution,...(type==='allocation'?{total:q.total}:{}),...(type==='dials'?{options:[...q.options]}:{})};
 }
 return withLearningMap(raw,{schemaVersion:1,template:'underlight-v1',id:raw.id,topicId:raw.topicId,revision:raw.revision,title:raw.title,hook:raw.hook,aftermath:{gardens:raw.aftermath.gardens,homes:raw.aftermath.homes},sources:raw.sources.map(s=>({id:s.id,title:s.title,locator:s.locator,excerpt:s.excerpt})),challenges});
}
// This runs in the trusted service, not as browser authorization. Browser ownership
// labels never confer access. Both operations and source references are scoped.
export function authorizeWorkspace(principal,workspace,operation){
 if(!principal?.authenticated||!principal.subject||!workspace?.id)throw Error('Authentication required');
 const m=principal.memberships?.find(m=>m.workspaceId===workspace.id);
 if(!m||!['owner','editor','learner'].includes(m.role))throw Error('Workspace access denied');
 if(operation==='read')return {subject:principal.subject,workspaceId:workspace.id,role:m.role};
 if(['create','review'].includes(operation)&&['owner','editor'].includes(m.role))return {subject:principal.subject,workspaceId:workspace.id,role:m.role};
 if(operation==='transfer'&&m.role==='owner')return {subject:principal.subject,workspaceId:workspace.id,role:m.role};
 throw Error('Operation denied');
}
export function preparePublication(principal,workspace,draft,resources,expectedRevision){
 const access=authorizeWorkspace(principal,workspace,'review'),content=validateChapterContent(draft.content);
 if(draft.workspaceId!==access.workspaceId||draft.revision!==expectedRevision)throw Error('Scope or revision conflict');
 if(!Array.isArray(draft.bindings)||draft.bindings.length!==content.sources.length||new Set(draft.bindings.map(b=>b.sourceId)).size!==content.sources.length)throw Error('Complete source bindings required');
 for(const source of content.sources){const binding=draft.bindings.find(b=>b.sourceId===source.id),resource=resources.find(r=>r.id===binding?.resourceId&&r.version===binding?.resourceVersion);if(!resource||resource.workspaceId!==workspace.id||resource.status!=='reviewed'||!resource.units?.some(u=>u.id===binding.unitId&&u.text===source.excerpt&&u.locator===source.locator))throw Error('Source is missing, unreviewed, changed or out of scope');}
 return {workspaceId:workspace.id,reviewer:access.subject,content,bindings:structuredClone(draft.bindings),expectedRevision};
}
// The model sometimes explains a balance puzzle with different numbers from its own answer
// (for example answer 4 and 8, explanation "7 to the gardens leaves 5"). Flag it for the reviewer.
export function balanceNumberWarning(c){
 const b=c?.template==='underlight-v1'?c.challenges?.balance:null;if(!b||!Number.isInteger(b.total)||!Number.isInteger(b.solution))return null;
 const allowed=new Set([b.total,b.solution,b.total-b.solution]),text=[b.prompt,b.explanation,b.feedback,b.hint,b.objective].filter(v=>typeof v==='string').join(' ');
 const odd=[...new Set((text.match(/\b\d+\b/g)||[]).map(Number))].filter(n=>n>1&&n<=b.total&&!allowed.has(n));
 return odd.length?{title:b.title||'Balance',answer:[b.solution,b.total-b.solution],odd}:null;
}
