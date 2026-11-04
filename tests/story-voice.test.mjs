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

test('an interest picks a matching style unless one is chosen; the prompt then asks for that style', async () => {
 const {STORY_STYLES,suggestStyle}=await import('../src/story-direction.js');
 assert.equal(suggestStyle('Anime & manga'),'anime');assert.equal(suggestStyle('Fantasy & myths'),'fantasy');assert.equal(suggestStyle('Football'),'sports');assert.equal(suggestStyle('Cooking'),null);
 const anime=generationRequest(job('adventure-v1',{genre:'action',interest:'Anime & manga'})).input[0].content;
 assert.ok(anime.includes('Style: Anime.')&&anime.includes(STORY_STYLES.anime.guide));
 assert.match(anime,/the title and the opening scene show it and the style naturally/);
 assert.match(anime,/Never copy an existing series/);
 const comic=generationRequest(job('quiz-v1',{genre:'comedy',interest:'Anime & manga',style:'comic'})).input[0].content;
 assert.ok(comic.includes('Style: Comic book')&&!comic.includes('Style: Anime.'),'a chosen style wins');
 assert.equal(JSON.parse(generationRequest(job('quiz-v1',{genre:'comedy',interest:'Gaming',style:'retro-game'})).input[1].content).story.style,'retro-game');
 assert.throws(()=>storyBrief({style:'copy-a-real-show'}));
 const src=await (await import('node:fs/promises')).readFile(new URL('../server/creative-provider.js',import.meta.url),'utf8');
 assert.match(src,/styleDirection\(job\.context\?\.story\)/,'podcasts and cartoons get the same style direction');
});

test('the story-fit check flags drafts that ignore the interest or style', async () => {
 const {storyFit}=await import('../src/story-direction.js');
 const good={title:'Rival Dreams in the Anime Club',hook:'The anime club has one chance to win the festival.',dialogue:['My rival trains every day, but our team has a dream!','Sensei smiles: this is our chance.']};
 const fit=storyFit(good,{interest:'Anime & manga'});assert.deepEqual(fit.weak,[]);assert.equal(fit.style,'anime');assert.ok(fit.interestInOpening);
 const flat=storyFit({title:'Food webs',hook:'Plants are producers.',feedback:['Correct.']},{interest:'Anime & manga'});
 assert.deepEqual(flat.weak,['interest','style']);
 assert.deepEqual(storyFit({title:'x',sources:[{excerpt:'anime anime anime'}]},{interest:'Anime & manga',style:'anime'}).interestHits,0,'source excerpts never count');
});

test('learners can choose the new interests in their profile', async () => {
 const {normaliseProfile}=await import('../src/game-modes/learning-model.js');
 assert.deepEqual(normaliseProfile({interests:['Anime & manga','Gaming','Animals']}).interests,['Anime & manga','Gaming','Animals']);
});

test('style touches count for the interest when the interest chose the style; game titles are free', async () => {
 const {storyFit}=await import('../src/story-direction.js');
 const gaming={title:'The Star Archive',hook:'Level One loads: your player has an empty inventory and a boss waits.',questions:[{prompt:'Unlock the checkpoint.'},{prompt:'Grab the power-up.'}]};
 assert.deepEqual(storyFit(gaming,{interest:'Gaming'}).weak,[],'video-game writing counts as using Gaming');
 assert.deepEqual(storyFit({title:'Food webs',hook:'Plants are producers.'},{interest:'Gaming'}).weak,['interest','style']);
 for(const t of ['quiz-v1','novel-v1','sports-v1','merge-v1'])assert.match(generationRequest(job(t,{genre:'comedy',interest:'Gaming'})).input[0].content,/title that fits the story|should fit the story/,t);
});

test('learning drives the plot in every format, and coverage shows which source passages a game uses', async () => {
 const {LEARNING_IN_PLOT,learningCoverage}=await import('../src/story-direction.js');
 for(const t of TEMPLATE_IDS){const sys=generationRequest(job(t,{genre:'action',interest:'Space'})).input[0].content;assert.ok(sys.includes(LEARNING_IN_PLOT),t);assert.match(sys,/explain why or predict/)}
 const c={sources:[{id:'a',title:'Producers'},{id:'b',title:'Habitats'}],questions:[{sourceRefs:['a']},{options:[{sourceRefs:['a']}]}]};
 assert.deepEqual(learningCoverage(c),{total:2,used:1,missing:['Habitats']});
 assert.deepEqual(learningCoverage({...c,debrief:{sourceRefs:['b']}}).missing,[]);
});
