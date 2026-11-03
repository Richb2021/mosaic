import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ResourceWorkshop} from '../src/resource-workshop.js';
const draft=JSON.parse(readFileSync(new URL('../public/chapters/water-and-systems.json',import.meta.url)));
function ui(){const opened=[],g={modal:{kind:'resource-library'},pack:{id:draft.topicId},renderModal(){},openModal(m){opened.push(m);g.modal=m}};return {g,opened,w:new ResourceWorkshop({get:()=>g})}}
test('source selection survives page changes, and unapplied title edits do not change a cursor scope',async()=>{
 const {w}=ui();w.resources=[{id:'old',status:'reviewed',title:'Older source'}];w.selected.add('old');w.page={resources:[{id:'new',status:'reviewed'}],nextCursor:'next'};w.sourceQuery='applied';w.sourceQueryDraft='not applied';w.pageCursor=null;w.pageHistory=[];
 const requested=[];w.request=async path=>{requested.push(path);return {resources:[{id:'later',status:'reviewed'}],nextCursor:null}};
 await w.act('resource-page-next',{});assert.match(requested[0],/q=applied/);assert.match(requested[0],/cursor=next/);assert.equal(w.planSources().find(r=>r.id==='old').title,'Older source');assert.deepEqual(w.pageHistory,[null]);
 w.sourceQueryDraft='fresh query';await w.act('resource-find',{});assert.match(requested[1],/q=fresh\+query/);assert(!requested[1].includes('cursor='));assert.equal(w.pageHistory.length,0);
});
test('canonical source loading cannot reopen a closed source dialog',async()=>{
 const {w,g,opened}=ui();let resolve;w.request=()=>new Promise(r=>resolve=r);const pending=w.act('resource-source',{dataset:{id:'old'}});g.modal=null;resolve({resource:{id:'old',status:'reviewed',units:[]}});await pending;assert.equal(opened.length,0);
});
test('refresh keeps selected older source metadata visible for deselection',async()=>{
 const {w}=ui();w.resources=[{id:'older',status:'reviewed',title:'Older source'}];w.selected.add('older');w.request=async path=>path==='health'?{}:{resourcePage:{resources:[{id:'newer',status:'reviewed'}]},resources:[{id:'newer',status:'reviewed'}],jobs:[]};await w.refresh();assert.deepEqual(w.planSources().map(r=>r.id),['older','newer']);
});
test('a response arriving after closing the job dialog cannot reopen it',async()=>{const {g,w,opened}=ui();let resolve;w.request=()=>new Promise(r=>resolve=r);const work=w.showJob('job-one');g.modal=null;resolve({job:{id:'job-one',status:'review'}});await work;assert.equal(opened.length,0)});
test('closing a dialog before a scheduled poll prevents a request and a null-modal crash',async t=>{const {g,w}=ui();g.modal={kind:'resource-job',job:{id:'job-one',status:'running'}};let scheduled,requests=0;const oldSet=setTimeout,oldClear=clearTimeout;globalThis.setTimeout=callback=>{scheduled=callback;return 1};globalThis.clearTimeout=()=>{};t.after(()=>{globalThis.setTimeout=oldSet;globalThis.clearTimeout=oldClear});w.request=async()=>{requests++;return {job:{}}};w.poll('job-one');g.modal=null;await scheduled();assert.equal(requests,0)});
test('review acknowledgement does not steal focus back from the world',async()=>{const {g,w,opened}=ui();g.modal={kind:'resource-source',resource:{id:'resource-one',checksum:'sum'},confirmed:true};let resolve;w.request=()=>new Promise(r=>resolve=r);const work=w.act('resource-review',{});g.modal=null;resolve({});await work;assert.equal(opened.length,0)});
test('activation validates the generated chapter and its target topic in the handler',async()=>{const {g,w,opened}=ui();g.pack.id='different-topic';g.modal={kind:'resource-job',job:{status:'published',draft}};await w.act('resource-use',{});assert.equal(opened.length,0);assert.match(g.modal.feedback,/Switch to the story/);g.pack.id=draft.topicId;g.modal.job.draft={...draft,sources:[]};await w.act('resource-use',{});assert.equal(opened.length,0)});
test('temporary polling failure schedules another retrieval without starting generation',async t=>{const {g,w}=ui();g.modal={kind:'resource-job',job:{id:'job-one',status:'running'}};const scheduled=[];const oldSet=setTimeout,oldClear=clearTimeout;globalThis.setTimeout=(callback,delay)=>{scheduled.push({callback,delay});return 1};globalThis.clearTimeout=()=>{};t.after(()=>{globalThis.setTimeout=oldSet;globalThis.clearTimeout=oldClear});let calls=0;w.request=async path=>{assert.equal(path,'jobs/job-one/check');if(++calls===1)throw Error('Temporary outage');return {job:{id:'job-one',status:'review'}}};w.poll('job-one');await scheduled[0].callback();assert.equal(scheduled[1].delay,15000);await scheduled[1].callback();assert.equal(g.modal.job.status,'review');assert.equal(g.modal.feedback,'');assert.equal(calls,2)});
test('saved request can be opened without contacting the model provider',async()=>{const {w,g}=ui();w.request=async(path,body)=>{assert.equal(path,'jobs/job-one');assert.equal(body,undefined);return {job:{id:'job-one',status:'interrupted'}}};await w.showJob('job-one');assert.equal(g.modal.job.status,'interrupted')});

test('revision editor locks identity and evidence, validates fields, and keeps the original untouched',async()=>{
 const {revisionFields,editRevisionField}=await import('../src/revision-editor.js');const original=structuredClone(draft),copy=structuredClone(draft),fields=revisionFields(copy);
 assert.ok(fields.some(f=>f.path==='challenges/route/prompt'));assert.ok(!fields.some(f=>f.path==='id'||f.path.startsWith('sources/')||f.path.includes('/sourceRefs/')));
 editRevisionField(copy,'challenges/route/prompt','A revised question');assert.equal(copy.challenges.route.prompt,'A revised question');assert.deepEqual(draft,original);
 assert.throws(()=>editRevisionField(copy,'sources/0/excerpt','fake'));assert.throws(()=>editRevisionField(copy,'__proto__/polluted','yes'));assert.throws(()=>editRevisionField(copy,'challenges/balance/solution',''));
});


test('editor preserves invalid raw input with an inline error and never offers the fixed town ending',async()=>{
 const {revisionFields,revisionEditorHTML}=await import('../src/revision-editor.js'),{TOWN_PACKS}=await import('../src/game-modes/town-packs.js');
 assert.ok(!revisionFields(TOWN_PACKS[0]).some(f=>f.path==='ending'));
 const {g,w}=ui();g.modal={kind:'resource-revision',edited:structuredClone(draft),job:{draft},requestKey:'test'};
 await w.change({target:{dataset:{revisionPath:'challenges/balance/solution'},value:''}});
 await w.act('resource-revision-review',{});assert.equal(g.modal.kind,'resource-revision');assert.equal(g.modal.rawValues['challenges/balance/solution'],'');
 const html=revisionEditorHTML(g.modal.edited,String,g.modal);assert.match(html,/aria-invalid="true" type="number" step="1" value=""/);assert.match(html,/Balance · Solution: use a whole number/);
 await w.change({target:{dataset:{revisionPath:'challenges/balance/solution'},value:'4'}});await w.act('resource-revision-review',{});assert.equal(g.modal.kind,'resource-revision-review');
});

test('economic revisions cannot offer the engine-owned ending as an editable field',async()=>{const {revisionFields}=await import('../src/revision-editor.js'),{ECONOMY_PACKS}=await import('../src/game-modes/economy-packs.js');assert.ok(!revisionFields(ECONOMY_PACKS[0]).some(f=>f.path==='ending'))});
