import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {balanceNumberWarning,chapterCopyLabel} from '../src/chapter-content.js';
import {answerText,gameReviewHTML} from '../src/game-modes/content-registry.js';
import {ResourceWorkshop} from '../src/resource-workshop.js';
import {modeGameLocation} from '../src/studio/cycle-navigation.js';
const chapter=JSON.parse(readFileSync(new URL('../public/chapters/water-and-systems.json',import.meta.url)));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const panel=(modal,options={})=>{const g={modal,pack:{id:chapter.topicId},renderModal(){},openModal(){}},w=new ResourceWorkshop({get:()=>g},options);return w.panel(modal,{esc,button:(label,action,attrs='')=>`<button data-act="${action}" ${attrs}>${label}</button>`,wrap:h=>h})};

test('an original chapter and its revised copy are labelled apart without renaming the chapter',()=>{
 const at=Date.UTC(2026,10,4,14,2),options={locale:'en-GB',timeZone:'UTC'};
 const original=chapterCopyLabel({status:'published',created:at,revisionOf:null},options),copy=chapterCopyLabel({status:'review',created:at+60000,revisionOf:'job-1'},options);
 assert.equal(original,'Original · Published · 4 Nov, 14:02');assert.equal(copy,'Revised copy · Draft · 4 Nov, 14:03');
 const html=panel({kind:'resource-library'});assert.match(html,/Generated chapters will appear here/);
});

test('review screens show expected answers in words, not raw indexes',()=>{
 const {route,balance,transfer}=chapter.challenges;
 assert.equal(answerText(route),'Evaporation → Condensation → Storage');assert.equal(answerText(balance),'Gardens: 4; Homes: 8');assert.equal(answerText(transfer),'Rising vapour: Gas; Cloud chamber: Liquid; Water collected: Liquid');
 const preview=gameReviewHTML(chapter,esc).replace(/<[^>]+>/g,' ');
 assert.doesNotMatch(preview,/\[\d/);assert.doesNotMatch(preview,/Solution:\s*\d/);assert.match(preview,/Evaporation → Condensation → Storage/);
 const job=panel({kind:'resource-job',job:{id:'job-1',status:'review',goal:'Water',draft:chapter}});assert.match(job,/Expected answer:<\/b> Gardens: 4; Homes: 8/);
 assert.equal(answerText({options:[{label:'A'},{label:'B'}],solution:1}),'B');assert.equal(answerText({solution:2}),null);
});

test('an opened generated game keeps a reopenable job link in the address bar',()=>{
 const unit={packId:'generated-1',contentHash:'v1'};
 assert.equal(modeGameLocation('',{...unit,jobId:'job-42'}),'/modes.html?job=job-42');
 assert.equal(modeGameLocation('',{...unit,jobId:'job-42'},true),'/modes.html?job=job-42&classic=1');
 assert.equal(modeGameLocation('',unit),'/modes.html?game=generated-1');
 const main=readFileSync(new URL('../src/game-modes/main.js',import.meta.url),'utf8');
 assert.match(main,/start\(register\(data\.job\.draft,data\.job\.id\)/);assert.match(main,/onActivate:async\(draft,jobId\)=>\{start\(register\(draft,jobId\)\)\}/);
});

test('the reported balance mismatch is caught and its draft cannot be saved until the numbers are checked',()=>{
 const c=structuredClone(chapter);Object.assign(c.challenges.balance,{title:'Balance the Heart’s Reservoir',total:12,solution:4,explanation:'Sending 7 units to the gardens leaves exactly 5 for homes.'});
 assert.equal(balanceNumberWarning(chapter),null,'a 1:2 ratio is not a stray amount');
 const w=balanceNumberWarning(c);assert.deepEqual(w.answer,[4,8]);assert.deepEqual(w.odd,[7,5]);
 const modal={kind:'resource-job',confirmed:true,job:{id:'job-1',status:'review',goal:'Water',draft:c}};
 const locked=panel(modal);assert.match(locked,/id="numbers-confirm"/);assert.match(locked,/data-act="resource-publish" disabled/);
 modal.numbersChecked=true;assert.doesNotMatch(panel(modal),/data-act="resource-publish" disabled/);
 assert.doesNotMatch(panel({kind:'resource-job',confirmed:true,job:{id:'job-2',status:'review',goal:'Water',draft:chapter}}),/numbers-confirm/);
});
