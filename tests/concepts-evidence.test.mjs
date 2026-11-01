import test from 'node:test';import assert from 'node:assert/strict';
import {conceptsFor,conceptTrail} from '../src/concept-progress.js';
import {validateLearningMap,suggestedLearningMap} from '../src/learning-map.js';
import {EXTENDED_PACKS} from '../src/game-modes/extended-packs.js';
import {DRAFT_PACKS} from '../src/game-modes/draft-content.js';
import {ADVENTURE_PACKS} from '../src/game-modes/adventure-content.js';
import {TOWN_PACKS} from '../src/game-modes/town-packs.js';
import {RPG_PACKS} from '../server/rpg-catalog.js';
import {validatePlayableContent} from '../src/game-modes/content-registry.js';
import {draftHash} from '../src/game-modes/draft-engine.js';
import {evidencePacket} from '../src/evidence-selection.js';
import {generationRequest,bindGeneratedEvidence} from '../server/content-service.js';
test('reviewed concept maps survive all eight validators and reject invented activities, sources and prerequisite cycles',()=>{
 for(const p of [...EXTENDED_PACKS,...DRAFT_PACKS,...ADVENTURE_PACKS,...TOWN_PACKS,...RPG_PACKS.map(p=>p.chapter)]){
  const map=suggestedLearningMap(p),clean=validatePlayableContent({...p,learningMap:map});assert.deepEqual(clean.learningMap,map);
  assert.throws(()=>validateLearningMap([{...map[0],activityKeys:['invented']}],p));assert.throws(()=>validateLearningMap([{...map[0],sourceRefs:['foreign']}],p));
  if(map.length>1)assert.throws(()=>validateLearningMap([{...map[0],prerequisites:[map[1].id]},{...map[1],prerequisites:[map[0].id]}],p),/cycle/);
 }
});
test('curated maps preserve old content identities and never attach to altered imports',()=>{const p=EXTENDED_PACKS.find(p=>p.id==='riverlight-water-quiz'),before=draftHash(p);assert.equal(conceptsFor(p).length,8);assert.equal(draftHash(p),before);assert.equal(conceptsFor({...p,title:'Altered teaching material'}).length,0)});
test('three domains produce distinct transparent next-step guidance from first, corrected and delayed attempts',()=>{
 const ids=['riverlight-water-quiz','riverlight-fraction-cup','turning-points-industry'],all=[...EXTENDED_PACKS,...DRAFT_PACKS];
 for(const id of ids){const p=all.find(p=>p.id===id),map=conceptsFor(p),a=map[0].activityKeys[0],record={updated:100,summary:{packId:p.id,contentHash:draftHash(p),kind:p.template==='draft-v1'?'classic':'journey',observations:[{key:a,correct:true,attempts:2,assisted:false,sources:[]}]}};
  assert.equal(conceptTrail([p],[],200).every(c=>c.status==='new'),true);
  const support=conceptTrail([p],[record],200).find(c=>c.objective===map[0].objective);assert.equal(support.status,'support');assert.match(support.reason,/feedback/);
  record.summary.observations[0].attempts=1;assert.equal(conceptTrail([p],[record],200).find(c=>c.key===support.key).status,'practised');assert.equal(conceptTrail([p],[record],4*86400000).find(c=>c.key===support.key).status,'due');
  record.summary.kind='rpg';assert.equal(conceptTrail([p],[record],200).every(c=>c.status==='new'),true);
 }
});
test('cross-format transfer requires the same explicit objective and source, not just a shared passage',()=>{const packs=EXTENDED_PACKS.filter(p=>['riverlight-web-quiz','riverlight-ecology-cup'].includes(p.id));const trail=conceptTrail(packs,[]);assert.equal(trail.length,8);assert.equal(trail.find(c=>c.objective==='Explain how producers make food').activities.length,2);assert.equal(trail.find(c=>c.objective==='Interpret food-web arrow direction').activities.length,2);assert.ok(trail.find(c=>c.objective==='Identify primary consumers').preparation.length);});
test('long-document selection finds paragraph forty and exposes omitted or absent goal words',()=>{const units=Array.from({length:40},(_,i)=>({id:'source-'+i,title:'Notes',locator:'Paragraph '+(i+1),excerpt:i===39?'Condensation cools vapour into liquid droplets.':'Background scenery and context.'})),r=[{units}];const p=evidencePacket(r,'Explain condensation and photosynthesis');assert.equal(p.evidence[0].id,'source-39');assert.equal(p.coverage.totalPassages,40);assert.equal(p.coverage.omittedPassages,28);assert.deepEqual(p.coverage.notFound,['photosynthesis']);const manual=evidencePacket(r,'Explain condensation',['source-0']);assert.deepEqual(manual.coverage.elsewhere,['condensation']);assert.throws(()=>evidencePacket(r,'condensation',['foreign']),/outside/);assert.throws(()=>evidencePacket(r,'condensation',['source-0','source-0']),/different/);});
test('new Wonder requests include source-constrained concept mappings; old stored responses still validate',()=>{const p=EXTENDED_PACKS.find(p=>p.template==='quiz-v1'),job={template:p.template,chapterId:p.id,topicId:p.topicId,evidence:p.sources,goal:'Explain water processes',level:'New learner'},request=generationRequest(job);assert.ok(request.text.format.schema.required.includes('learningMap'));assert.deepEqual(request.text.format.schema.properties.learningMap.items.properties.sourceRefs.items.enum,p.sources.map(s=>s.id));assert.equal(bindGeneratedEvidence(p,job).id,p.id);const mapped={...p,learningMap:suggestedLearningMap(p)};assert.ok(bindGeneratedEvidence(mapped,job).learningMap.length);});
