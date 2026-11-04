import test from 'node:test';
import assert from 'node:assert/strict';
import {generationRequest,TEMPLATE_IDS} from '../server/content-service.js';
import {storyBrief,VOICE_CARDS,AUDIENCE_GUIDE,PLAYER_TEXT_RULE} from '../src/story-direction.js';

const job=(template,story)=>({template,goal:'Explain how energy moves through a food web.',level:'Year 8',story,evidence:[{id:'e1',title:'Notes',locator:'p1',excerpt:'Plants are producers.'}],chapterId:'generated-test',resourceVersions:[]});

test('every game format ends its prompt with its own voice card, the audience band and the player-text rule', () => {
 for(const t of TEMPLATE_IDS){
  const r=generationRequest(job(t,{genre:'comedy',interest:'Football',audience:'primary'})),sys=r.input[0].content;
  assert.ok(VOICE_CARDS[t],t+' has a voice card');
  const craft=sys.lastIndexOf('STORY CRAFT');assert.ok(craft>0,t);
  assert.ok(sys.indexOf(VOICE_CARDS[t])>craft&&sys.indexOf(AUDIENCE_GUIDE.primary)>craft&&sys.indexOf(PLAYER_TEXT_RULE)>craft,t+': story craft comes after the rules');
  assert.deepEqual(JSON.parse(r.input[1].content).story,{genre:'comedy',interest:'Football',audience:'primary'});
 }
});

test('the audience is optional and limited to the three bands; old requests are unchanged', () => {
 assert.deepEqual(storyBrief({genre:'action',interest:'Space'}),{genre:'action',interest:'Space'});
 assert.equal(storyBrief({audience:'adult'}).audience,'adult');
 assert.throws(()=>storyBrief({audience:'toddler'}));
 const sys=generationRequest(job('quiz-v1',{genre:'adventure',interest:''})).input[0].content;
 assert.match(sys,/pitch humour and stakes to the learner context/);
});

test('prompts no longer ask for age-neutral language or disclaimers in player text', async () => {
 const {readFile}=await import('node:fs/promises');
 assert.ok(!(await readFile(new URL('../server/creative-provider.js',import.meta.url),'utf8')).includes('age-neutral'));
 for(const t of TEMPLATE_IDS){const sys=generationRequest(job(t,{genre:'drama',interest:'Music'})).input[0].content;assert.match(sys,/no disclaimers/,t)}
});

test('podcast and cartoon prompts fix Mira and Kit as adults so the story matches their adult voices', async () => {
 const {readFile}=await import('node:fs/promises');
 const src=await readFile(new URL('../server/creative-provider.js',import.meta.url),'utf8');
 assert.match(src,/Mira is a woman and Kit is a man, both friends in their early twenties/);
 assert.match(src,/never write either of them as a child/);
});
