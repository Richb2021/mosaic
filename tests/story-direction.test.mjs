import test from 'node:test';import assert from 'node:assert/strict';
import {storyBrief,validateDirection,STORY_BLOCKING,STORY_SHOTS} from '../src/story-direction.js';
import {stageAtTime} from '../src/studio/media/cartoon-director.js';
import {creativeContext,creativeSchema,validateCreative} from '../src/studio/creative-content.js';
import {creativeRequest} from '../server/creative-provider.js';
import {generationRequest,TEMPLATE_IDS} from '../server/content-service.js';
import {EXTENDED_PACKS} from '../src/game-modes/extended-packs.js';
import {newUnit,activitiesOf} from '../src/studio/programme.js';
const evidence=[{id:'fraction-note',title:'Equal parts',locator:'Paragraph 1',excerpt:'One half and two quarters describe the same amount of the same whole.'}];
const job={id:'story-fixture',kind:'cartoon',storyVersion:2,context:{evidence,story:{genre:'action',interest:'Space'}}};
const fixture=()=>({schemaVersion:2,id:job.id,kind:'cartoon',title:'The missing quarter',summary:'A fictional rescue needs equivalent shares.',story:{...job.context.story,premise:'Two friends must carry supplies.',want:'Reach the garden.',stakes:'The lanterns will go dark.',obstacle:'The crates look unequal.',turn:'They compare equal wholes.',payoff:'Two quarters replace a half.',learningConnection:'Equivalent shares solve the supply problem.'},segments:['hook','setback','attempt','discovery','choice','payoff'].map((beat,i)=>({id:'segment-'+(i+1),speaker:i%2?'learner':'guide',text:'Two quarters can replace one half of the same whole.',sourceRefs:['fraction-note'],scene:i<3?'workshop':'garden',action:'talk',beat,direction:{blocking:['arrive','pursuit','separate','face-off','travel-left','approach'][i],shot:i%2?'speaker':'wide',pace:'urgent'}})),question:{prompt:'Why does the swap work?',answer:'Both quantities describe the same amount of the same whole.',sourceRefs:['fraction-note']}});
test('story inputs are bounded data and selected interest comes from the programme snapshot',()=>{
 assert.deepEqual(storyBrief({genre:'comedy',interest:' Football '}),{genre:'comedy',interest:'Football'});
 for(const x of [{genre:'__proto__'},{genre:'action',interest:'x'.repeat(121)},{genre:'action',code:'run()'},[]])assert.throws(()=>storyBrief(x));
 const pack=EXTENDED_PACKS[0],unit=newUnit(pack,{interests:['Music','Nature','Space']},activitiesOf(pack).map(a=>a.key));
 const c=creativeContext(pack,unit,'cartoon',null,{genre:'drama',interest:'Space'});assert.deepEqual(c.learner.interests,['Space','Music']);assert.equal(c.story.genre,'drama');assert.throws(()=>creativeContext(pack,unit,'cartoon',null,{genre:'drama',interest:'Football'}));
});
test('v2 stories bind exact facts, intent, structure and closed directions; v1 cannot masquerade as v2',()=>{
 const raw=fixture(),clean=validateCreative(raw,job);assert.deepEqual(validateCreative(clean,job),clean);assert.equal(clean.sources[0].excerpt,evidence[0].excerpt);
 const directAddress=structuredClone(raw);directAddress.segments[0].text='Choose, Kit: compare the evidence before spending.';assert.equal(validateCreative(directAddress,job).segments[0].text,directAddress.segments[0].text);
 for(const mutate of [x=>x.story.genre='comedy',x=>x.story.interest='Football',x=>x.segments[0].direction.x=900,x=>x.segments[0].direction.blocking='https://evil/',x=>x.segments[0].sourceRefs=['fake'],x=>x.story.want='',x=>x.segments[0].beat='goal',x=>x.segments.at(-1).beat='choice',x=>x.segments.forEach(s=>s.scene='city'),x=>x.segments.forEach(s=>s.direction.blocking='face-off'),x=>x.schemaVersion=1,x=>x.segments[0].text='Mira: Hello. Kit: Hi.']){const bad=structuredClone(raw);mutate(bad);assert.throws(()=>validateCreative(bad,job));}
 assert.throws(()=>validateCreative(raw,{...job,storyVersion:undefined}));
 const schema=creativeSchema(job);assert.deepEqual(schema.properties.schemaVersion.enum,[2]);assert.equal(schema.properties.segments.items.properties.direction.additionalProperties,false);
 const audio={...raw,kind:'podcast',segments:raw.segments.map(({direction,...s})=>s)};assert.equal(validateCreative(audio,{...job,kind:'podcast'}).schemaVersion,2);assert.throws(()=>validateCreative({...audio,segments:raw.segments},{...job,kind:'podcast'}));
});
test('authored blocking actually crosses the stage, faces travel and freezes deterministically on pause/seek/still',()=>{
 for(const blocking of STORY_BLOCKING)for(const shot of STORY_SHOTS){const segment={speaker:'guide',action:'talk',direction:{blocking,shot,pace:'urgent'}},args={segment,duration:12,index:2};
  const a=stageAtTime({...args,elapsed:1}),b=stageAtTime({...args,elapsed:6});assert.notEqual(a.actors[0].x,b.actors[0].x,blocking);
  for(let t=0;t<=12;t+=.25){const s=stageAtTime({...args,elapsed:t});for(const p of s.actors){assert(p.x>=90&&p.x<=1190);assert(p.y>=490&&p.y<=535);if(p.moving)assert.equal(p.motion,'walk');assert([1,-1].includes(p.facing));}assert.deepEqual(stageAtTime({...args,elapsed:t}),s);}
  assert.deepEqual(stageAtTime({...args,elapsed:1,still:true}).actors,stageAtTime({...args,elapsed:11,still:true}).actors);assert.equal(stageAtTime({...args,elapsed:11,still:true}).camera.scale,1);
 }
 for(const blocking of ['travel-right','pursuit'])assert(stageAtTime({segment:{speaker:'guide',action:'talk',direction:{blocking,shot:'wide',pace:'calm'}},elapsed:4}).actors.every(a=>a.facing===1));
 assert(stageAtTime({segment:{speaker:'guide',action:'talk',direction:{blocking:'travel-left',shot:'wide',pace:'calm'}},elapsed:4}).actors.every(a=>a.facing===-1));
 assert.throws(()=>validateDirection({blocking:'arrive',shot:'wide',pace:'calm',cameraURL:'bad'}));
});
test('all game and media providers use Muse with narrative intent as untrusted data while preserving mechanics and evidence',()=>{
 for(const template of TEMPLATE_IDS){const r=generationRequest({template,chapterId:'story-game',topicId:'fractions',level:'Starting out',goal:'Compare equivalent fractions.',story:{genre:'comedy',interest:'Football'},evidence});const body=JSON.parse(r.input[1].content);assert.equal(r.model,'muse-wonder-1.0');assert.deepEqual(body.story,{genre:'comedy',interest:'Football'});assert.deepEqual(body.evidence,evidence);assert.match(r.input[0].content,/existing template/);assert.match(r.input[0].content,/Do not force an analogy/);}
 for(const kind of ['podcast','cartoon']){const r=creativeRequest({...job,kind});assert.equal(r.text.format.schema.properties.schemaVersion.enum[0],2);assert.match(r.input[0].content,/real original story/);assert.match(r.input[0].content,/six to twelve/);assert.equal(JSON.parse(r.input[1].content).context.story.interest,'Space');}
});

test('the live director holds a thinking pose and ends a celebration instead of looping it',()=>{
 const segment={speaker:'guide',action:'think',direction:{blocking:'face-off',shot:'speaker',pace:'calm'}};
 const a=stageAtTime({segment,elapsed:6,duration:12}),b=stageAtTime({segment,elapsed:10,duration:12});assert.deepEqual(a.actors[0],b.actors[0]);
 segment.action='celebrate';assert.equal(stageAtTime({segment,elapsed:4,duration:12}).actors[0].motion,'celebrate');assert.notEqual(stageAtTime({segment,elapsed:8,duration:12}).actors[0].motion,'celebrate');
});
