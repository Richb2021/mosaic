import test from 'node:test';
import assert from 'node:assert/strict';
import {DRAFT_PACKS,DRAFT_SCHEMA,DRAFT_PROMPT,validateDraftContent,getDraftReferences,DRAFT_SOURCE_LINKS,getDraftSourceLink} from '../src/game-modes/draft-content.js';
import {newDraft,draftPhase,draftHand,draftReflectionOptions,pickDraftCard,redrawDraft,draftTotals,draftOutcome,answerDraft,nextDraftScenario,validateDraftState,draftSaveKey,loadDraft,saveDraft} from '../src/game-modes/draft-engine.js';
const clone=v=>structuredClone(v);
const [industry,eco]=DRAFT_PACKS;
const finishDraft=(pack,seed=11)=>{let s=newDraft(pack,seed);for(let i=0;i<5;i++)s=pickDraftCard(pack,s,draftHand(pack,s)[0].id);return s};
test('both authored packs are valid, bounded, distinct and fully cited',()=>{assert.notEqual(industry.topicId,eco.topicId);for(const p of DRAFT_PACKS){assert.deepEqual(validateDraftContent(p),p);assert.equal(p.cards.length,20);assert.equal(p.scenarios.length,4);assert.ok(JSON.stringify(p).length<102400);assert.ok(getDraftReferences(p).every(id=>p.sources.some(s=>s.id===id)))}});
test('every exact-source citation maps to a reviewed primary URL; no page exceeds 25 quoted words',()=>{const words={};for(const p of DRAFT_PACKS)for(const s of p.sources){const u=DRAFT_SOURCE_LINKS[s.id];assert.match(u,/^https:\/\//);words[u]=(words[u]||0)+s.excerpt.trim().split(/\s+/).length}for(const [url,n]of Object.entries(words))assert.ok(n<=25,`${url}: ${n} words`)});
test('source-less model schema remains strict and asset bounded',()=>{assert.equal(DRAFT_SCHEMA.additionalProperties,false);assert.equal(DRAFT_SCHEMA.properties.sources,undefined);assert.ok(DRAFT_SCHEMA.properties.cards.items.properties.asset.enum.includes('steam'))});
test('generation schema requires the complete draft and nonempty evidence on every card and scenario',()=>{
 const p=DRAFT_SCHEMA.properties;
 for(const [key,count]of [['metrics',3],['roles',5],['cards',20],['scenarios',4]])assert.deepEqual([p[key].minItems,p[key].maxItems],[count,count],key);
 const card=p.cards.items.properties,scenario=p.scenarios.items.properties;
 for(const field of [card.scores,scenario.requirements,scenario.options])assert.deepEqual([field.minItems,field.maxItems],[3,3]);
 for(const field of [card.sourceRefs,scenario.sourceRefs])assert.deepEqual([field.minItems,field.maxItems],[1,12]);
 for(const [field,max]of [[card.scores.items,4],[scenario.requirements.items,20],[scenario.solution,2]])assert.deepEqual([field.type,field.minimum,field.maximum],['integer',0,max]);
 assert.match(DRAFT_PROMPT,/Exactly 3 metrics, exactly 5 roles, exactly 4 cards for each role \(20 cards total\), and exactly 4 scenarios/);
 assert.match(DRAFT_PROMPT,/3 integer scores 0\.\.4/);assert.match(DRAFT_PROMPT,/3 integer capability requirements 0\.\.20/);assert.match(DRAFT_PROMPT,/solution index 0\.\.2/);assert.match(DRAFT_PROMPT,/nonempty sourceRefs array of 1–12 exact packet IDs/);
});
test('generation schema bounds identity and prose to the runtime contract',()=>{
 const p=DRAFT_SCHEMA.properties,card=p.cards.items.properties,scenario=p.scenarios.items.properties;
 assert.deepEqual(p.schemaVersion.enum,[1]);assert.deepEqual([p.revision.minimum,p.revision.maximum],[1,100000]);
 for(const field of [p.id,p.topicId,p.metrics.items.properties.id,p.roles.items.properties.id,card.id,card.roleId,scenario.id,card.sourceRefs.items]){assert.equal(field.maxLength,80);assert.equal(field.pattern,'^[a-z][a-z0-9-]*$')}
 for(const [field,max]of [[p.title,100],[p.hook,1000],[p.subtitle,100],[p.ending,1000],[p.metrics.items.properties.label,30],[p.roles.items.properties.label,40],[p.roles.items.properties.prompt,180],[card.title,80],[card.description,260],[card.tradeoff,180],[scenario.title,80],[scenario.prompt,360],[scenario.question,240],[scenario.options.items,180],[scenario.explanation,500],[scenario.feedback,500]])assert.deepEqual([field.minLength,field.maxLength],[1,max]);
});
test('reviewed source fields retain leading and trailing whitespace verbatim',()=>{
 const p=clone(industry);for(const field of ['title','locator','excerpt'])p.sources[0][field]=' \t'+p.sources[0][field]+'\n ';
 const clean=validateDraftContent(JSON.stringify(p));assert.deepEqual(clean.sources,p.sources);assert.deepEqual(validateDraftContent(clean).sources,p.sources);
 for(const field of ['title','locator','excerpt']){const invalid=clone(p);invalid.sources[0][field]=' \t\n ';assert.throws(()=>validateDraftContent(invalid),/Invalid source/)}
 for(const [field,max]of [['title',160],['locator',160],['excerpt',3000]]){const invalid=clone(p);invalid.sources[0][field]='x'.repeat(max+1);assert.throws(()=>validateDraftContent(invalid),/Invalid source|too long/)}
});
test('trusted evidence links require the complete authored source, not a reused id',()=>{
 for(const p of DRAFT_PACKS)for(const source of p.sources)assert.equal(getDraftSourceLink(clone(source)),DRAFT_SOURCE_LINKS[source.id]);
 for(const field of ['title','locator','excerpt']){const p=clone(industry);p.sources[0][field]=' '+p.sources[0][field];assert.equal(getDraftSourceLink(validateDraftContent(p).sources[0]),'')}
 const imported=clone(industry);imported.sources[0]={...imported.sources[0],title:'Uploaded notes',locator:'Page 1',excerpt:'An unrelated reviewed passage.'};assert.equal(getDraftSourceLink(validateDraftContent(imported).sources[0]),'');
 assert.equal(getDraftSourceLink({...industry.sources[0],id:'unlisted'}),'');assert.equal(getDraftSourceLink(null),'');
});
test('validator rejects unknown citations, assets and impossible game thresholds',()=>{let p=clone(industry);p.cards[0].sourceRefs=['invented'];assert.throws(()=>validateDraftContent(p),/sources/);p=clone(industry);p.cards[0].asset='https://evil.example/image';assert.throws(()=>validateDraftContent(p),/asset/);p=clone(industry);p.scenarios[0].requirements=[20,20,20];assert.throws(()=>validateDraftContent(p),/No valid/)});
test('validator rejects duplicated card ids, malformed roles and unsafe object fields',()=>{let p=clone(industry);p.cards[1].id=p.cards[0].id;assert.throws(()=>validateDraftContent(p),/Duplicate/);p=clone(industry);p.cards[0].roleId='unlisted';assert.throws(()=>validateDraftContent(p),/role/);p=JSON.parse(JSON.stringify(industry).replace('"hook":','"constructor":{},"hook":'));assert.throws(()=>validateDraftContent(p),/Unsafe/)});
test('same seed yields same three choices without mutating the pack',()=>{const before=JSON.stringify(industry);assert.deepEqual(draftHand(industry,newDraft(industry,4)),draftHand(industry,newDraft(industry,4)));assert.equal(draftHand(industry,newDraft(industry,4)).length,3);assert.equal(JSON.stringify(industry),before)});
test('redraw introduces exactly one unseen choice and can happen only once',()=>{const s=newDraft(industry,5),first=draftHand(industry,s).map(c=>c.id),redrawn=redrawDraft(industry,s),second=draftHand(industry,redrawn).map(c=>c.id);assert.equal(second.filter(id=>!first.includes(id)).length,1);assert.equal(second.filter(id=>first.includes(id)).length,2);assert.throws(()=>redrawDraft(industry,redrawn),/already/)});
test('off-hand picks are rejected and five legal picks cover all five roles',()=>{let s=newDraft(industry,8);const hand=draftHand(industry,s).map(c=>c.id),unseen=industry.cards.find(c=>c.roleId===industry.roles[0].id&&!hand.includes(c.id));assert.throws(()=>pickDraftCard(industry,s,unseen.id),/hand/);s=finishDraft(industry);assert.equal(s.picks.length,5);assert.equal(new Set(s.picks).size,5);assert.deepEqual(s.picks.map(id=>industry.cards.find(c=>c.id===id).roleId),industry.roles.map(r=>r.id));assert.equal(draftPhase(s),'scenario');assert.throws(()=>pickDraftCard(industry,s,s.picks[0]),/complete/)});
test('all seeded hands remain playable for both topics',()=>{for(const p of DRAFT_PACKS)for(let seed=1;seed<=64;seed++){let s=newDraft(p,seed);for(let round=0;round<5;round++){if(round===seed%5)s=redrawDraft(p,s);assert.equal(draftHand(p,s).length,3);s=pickDraftCard(p,s,draftHand(p,s)[seed%3].id)}assert.deepEqual(validateDraftState(s,p),s)}});
test('scenario outcome is transparent and deterministic',()=>{const s=finishDraft(industry);const totals=draftTotals(industry,s);assert.deepEqual(totals,s.picks.reduce((a,id)=>a.map((n,i)=>n+industry.cards.find(c=>c.id===id).scores[i]),[0,0,0]));assert.deepEqual(draftOutcome(industry,s,0),draftOutcome(industry,clone(s),0));assert.equal(draftOutcome(industry,s,0).passed,totals[0]>=8)});
test('reflection display order is a stable per-seed permutation with canonical option text',()=>{
 const before=JSON.stringify(industry),orders=new Set();
 for(let seed=1;seed<=64;seed++)for(let i=0;i<4;i++){
  const state=finishDraft(industry,seed),shown=draftReflectionOptions(industry,state,i);
  assert.deepEqual(shown,draftReflectionOptions(industry,clone(state),i));
  assert.deepEqual(shown.map(o=>o.canonicalIndex).sort(),[0,1,2]);
  for(const o of shown)assert.equal(o.text,industry.scenarios[i].options[o.canonicalIndex]);
  orders.add(shown.map(o=>o.canonicalIndex).join(''));
 }
 assert.equal(orders.size,6);assert.equal(JSON.stringify(industry),before);
 assert.deepEqual(draftReflectionOptions(industry,finishDraft(industry),4),[]);
});
test('even a generated pack with all canonical answers first does not make one display letter correct throughout',()=>{
 const p=clone(industry);p.scenarios.forEach(s=>{[s.options[0],s.options[s.solution]]=[s.options[s.solution],s.options[0]];s.solution=0});
 for(let seed=1;seed<=128;seed++){
  const state=finishDraft(p,seed),positions=p.scenarios.map((s,i)=>draftReflectionOptions(p,state,i).findIndex(o=>o.canonicalIndex===s.solution));
  assert.ok(new Set(positions).size>1,`seed ${seed} repeats one correct letter`);
 }
});
test('displayed choices preserve canonical reducer answers and remain stable after feedback and save reload',()=>{
 for(const p of DRAFT_PACKS){let state=finishDraft(p,37);for(let i=0;i<4;i++){
  const shown=draftReflectionOptions(p,state),correct=shown.find(o=>o.canonicalIndex===p.scenarios[i].solution),wrong=shown.find(o=>o.canonicalIndex!==correct.canonicalIndex);
  state=answerDraft(p,state,wrong.canonicalIndex);assert.deepEqual(draftReflectionOptions(p,state),shown);
  state=answerDraft(p,state,correct.canonicalIndex);state=validateDraftState(JSON.parse(JSON.stringify(state)),p);
  assert.deepEqual(state.reflections[i],[wrong.canonicalIndex,p.scenarios[i].solution]);assert.deepEqual(draftReflectionOptions(p,state),shown);
  state=nextDraftScenario(p,state);
 }assert.equal(draftPhase(state),'complete')}
});
test('wrong reflection records feedback path without changing draft outcome',()=>{let s=finishDraft(industry);const outcome=draftOutcome(industry,s,0),correct=industry.scenarios[0].solution;s=answerDraft(industry,s,(correct+1)%3);assert.throws(()=>nextDraftScenario(industry,s),/Reflect/);assert.deepEqual(draftOutcome(industry,s,0),outcome);s=answerDraft(industry,s,correct);assert.equal(s.reflections[0].length,2);assert.equal(nextDraftScenario(industry,s).scenarioIndex,1)});
test('complete journey can finish regardless of scenario outcome; answers persist separately',()=>{for(const p of DRAFT_PACKS){let s=finishDraft(p,22);for(let i=0;i<4;i++){s=answerDraft(p,s,(p.scenarios[i].solution+1)%3);s=answerDraft(p,s,p.scenarios[i].solution);s=nextDraftScenario(p,s)}assert.equal(draftPhase(s),'complete');assert.equal(s.reflections.flat().length,8);assert.deepEqual(validateDraftState(JSON.parse(JSON.stringify(s)),p),s)}});
test('saves reject forged picks, premature answers and skipped reflections',()=>{let s=finishDraft(industry);s.picks[0]='unlisted';assert.throws(()=>validateDraftState(s,industry),/hand/);s=newDraft(industry);s.reflections[0]=[0];assert.throws(()=>validateDraftState(s,industry),/before/);s=finishDraft(industry);s.scenarioIndex=2;assert.throws(()=>validateDraftState(s,industry),/previous/)});
test('save key changes with revision and content, and differs by topic',()=>{const p=clone(industry);assert.notEqual(draftSaveKey(industry),draftSaveKey(eco));p.revision++;assert.notEqual(draftSaveKey(industry),draftSaveKey(p));p.revision--;p.cards[0].description+=' Revised.';assert.notEqual(draftSaveKey(industry),draftSaveKey(p))});
test('valid mid-draft saves resume; malformed records fail closed without deletion',()=>{const map=new Map(),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)},s=pickDraftCard(industry,newDraft(industry,9),draftHand(industry,newDraft(industry,9))[0].id);assert.equal(saveDraft(storage,industry,s),'');assert.deepEqual(loadDraft(storage,industry,11).state,s);storage.setItem(draftSaveKey(industry),'{broken');assert.equal(loadDraft(storage,industry,11).state.picks.length,0);assert.equal(storage.getItem(draftSaveKey(industry)),'{broken')});
test('blocked storage reports a useful limitation without preventing play',()=>{const storage={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}};assert.equal(loadDraft(storage,eco,3).state.seed,3);assert.match(saveDraft(storage,eco,newDraft(eco,3)),/Saving is unavailable/)});

test('duplicate reflection answers are rejected instead of creating ambiguous feedback',()=>{const p=clone(industry);p.scenarios[0].options[1]=p.scenarios[0].options[0].toUpperCase();assert.throws(()=>validateDraftContent(p),/distinct/) });
test('save rejects attempts after a correct answer and a forged future redraw',()=>{let s=finishDraft(industry);s.reflections[0]=[industry.scenarios[0].solution,(industry.scenarios[0].solution+1)%3];assert.throws(()=>validateDraftState(s,industry),/answer order/);s=newDraft(industry,1);s.redrawRound=4;assert.throws(()=>validateDraftState(s,industry),/redraw/)});
