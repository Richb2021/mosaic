// Story intent is data. The authoring model selects from authored runtime choices.
export const STORY_GENRES=Object.freeze({adventure:'Adventure',action:'Action',drama:'Drama',comedy:'Comedy',mystery:'Mystery'});
export const STORY_BEATS=Object.freeze(['hook','goal','setback','attempt','discovery','choice','payoff']);
export const STORY_BLOCKING=Object.freeze(['arrive','travel-right','travel-left','approach','separate','pursuit','retreat','face-off']);
export const STORY_SHOTS=Object.freeze(['wide','two-shot','speaker','reaction']);
export const STORY_PACES=Object.freeze(['calm','urgent']);
// Who the story is written for. Sets humour, sentence length and how sharp the stakes are.
// A style is how the story is told (anime, comic book, fairy tale…), separate from its genre.
// Each has conventions the writer must use. Characters, names and catchphrases are always original:
// a style, never a copy of an existing series.
export const STORY_STYLES=Object.freeze({
 anime:{label:'Anime',guide:'Write it like an original anime episode: a determined lead with a big dream, a rival who pushes them, a calm mentor with a secret, big emotional reactions and short inner-monologue moments at the decisive point. When the learning clicks, give the plan or move a dramatic name and a moment of "this is our chance!". End scenes on a mini cliffhanger, and win through teamwork. Settings like a school club, a sky city or a spirit-filled town suit it.',words:['anime','manga','rival','dream','sensei','club','episode','power','chance','team','spirit','next time','sky']},
 comic:{label:'Comic book / superhero',guide:'Write it like an original comic: a hero with a secret identity or gadget, a colourful villain with a scheme, punchy captions, sound-effect words (WHOOSH, KRAK) and a splash-page reveal. The learning is the hero\'s real superpower.',words:['hero','villain','power','gadget','mask','city','whoosh','krak','zap','secret','mission','sidekick']},
 'fairy-tale':{label:'Fairy tale / fable',guide:'Write it like a fairy tale or fable: "Once…", a clever ordinary hero, talking animals or objects, a rule of three (three tries, three doors), a trickster and a moral that the learning earns.',words:['once','kingdom','forest','wise','fox','owl','three','spell','castle','fable','king','queen','moral']},
 'sci-fi':{label:'Sci-fi',guide:'Write it like sci-fi: a starship, colony or lab crew, a malfunctioning system, a quirky AI or robot crewmate, countdowns and status reports. The learning becomes the engineering fix.',words:['ship','station','captain','crew','robot','planet','signal','system','orbit','launch','galaxy','scanner']},
 fantasy:{label:'Fantasy quest',guide:'Write it like a fantasy quest: a map, a guild or fellowship, an enchanted object, a riddle-guarding creature and a dragon-sized problem. The learning is the lore that breaks the curse.',words:['quest','dragon','guild','magic','spell','map','knight','wizard','scroll','realm','curse','enchanted']},
 sports:{label:'Sports drama',guide:'Write it like a sports drama: a team chasing the final, a coach\'s team talk, a rival club, training montages, a last-minute turnaround and commentary. The learning becomes the winning tactic.',words:['team','coach','match','final','goal','score','training','captain','pitch','league','whistle','tactic']},
 detective:{label:'Detective',guide:'Write it like a detective story: a puzzling case, a sharp-eyed detective and their sidekick, clues and red herrings, a suspect line-up and a reveal where the evidence (the learning) solves the case. Nothing gruesome.',words:['case','clue','detective','suspect','evidence','mystery','solve','notebook','alibi','reveal','witness','missing']},
 'retro-game':{label:'Video game',guide:'Write it like a video game: levels, a player character with a health bar and inventory, a quest giver, a boss stage, power-ups and a save point. The learning unlocks the next level.',words:['level','boss','player','quest','power-up','inventory','respawn','checkpoint','save','unlock','score','game']},
 'nature-doc':{label:'Nature documentary',guide:'Write it like a nature documentary: a hushed, warm narrator voice, a small animal hero with a big challenge, the seasons turning, and close-up "and look…" moments. The learning explains what the narrator sees.',words:['habitat','wild','creature','season','narrator','burrow','nest','herd','watch','survive','forest','river']},
 spy:{label:'Spy mission',guide:'Write it like a spy mission: a briefing from HQ, code names, gadgets, a secret base and a double-cross, with a ticking clock and safe, non-violent stakes. The learning cracks the code.',words:['agent','mission','code','briefing','gadget','hq','secret','undercover','decode','base','codename','signal']},
 sitcom:{label:'Sitcom',guide:'Write it like a sitcom: a small, close group, a misunderstanding that snowballs, running jokes, a ridiculous scheme and a warm ending where they learn something together.',words:['plan','scheme','oops','again','neighbour','flat','family','joke','awkward','mix-up','everyone','sorry']},
});
// When no style is chosen, the learner's interest suggests one, so an anime fan gets anime storytelling.
const STYLE_HINTS=[[/anime|manga/i,'anime'],[/super ?hero|comic/i,'comic'],[/dragon|magic|wizard|fantasy|knight/i,'fantasy'],[/fairy|myth|legend|fable/i,'fairy-tale'],[/space|planet|astronaut|robot|sci-?fi|science/i,'sci-fi'],[/football|soccer|sport|basketball|cricket|rugby|tennis|netball|athletic/i,'sports'],[/myster|detective|puzzle|crime/i,'detective'],[/gaming|video game|minecraft|roblox|games?\b/i,'retro-game'],[/animal|nature|wildlife|ocean|pets?\b/i,'nature-doc'],[/\bspy|secret agent/i,'spy']];
export function suggestStyle(interest){for(const [re,style] of STYLE_HINTS)if(re.test(interest||''))return style;return null}
export function styleOf(story){return story?.style||suggestStyle(story?.interest)||null}
export function styleDirection(story){
 const style=styleOf(story),interest=story?.interest;
 const parts=[];
 if(style)parts.push(`Style: ${STORY_STYLES[style].label}. ${STORY_STYLES[style].guide} Never copy an existing series, its characters, names, catchphrases or logos; make original ones in that style.`);
 if(interest)parts.push(`Interest: ${interest}. Make it unmistakable: the title and the opening scene show it${style?' and the style':''} naturally (no need to name it in the first words), at least one named character is defined by it, and the setting or central problem comes from it.`);
 return parts.join(' ');
}
// Related words for each profile interest, so "Superheroes & comics" counts "hero" and "cape".
const INTEREST_WORDS={'superheroes & comics':['superhero','superheroes','hero','heroes','comic','cape','villain'],'anime & manga':['anime','manga'],gaming:['game','gaming','gamer','level','player'],football:['football','match','goal','pitch'],animals:['animal','animals','creature'],'art & drawing':['art','artist','draw','drawing','sketch','paint'],'science & inventions':['science','scientist','invent','invention','inventor','experiment','lab'],'other sports':['sport','sports','team','match','race'],'fantasy & myths':['fantasy','myth','dragon','magic','legend'],'mysteries & puzzles':['mystery','puzzle','clue','detective'],dance:['dance','dancer','dancing','rhythm'],music:['music','song','band','beat'],cooking:['cook','cooking','recipe','kitchen','chef'],nature:['nature','forest','wild','garden'],space:['space','planet','star','rocket'],history:['history','ancient','century'],'building & business':['business','build','shop','company'],'stories & animation':['story','animation','animated','cartoon']};
// A quick check, shown at review, of whether a draft really uses the interest and style.
export function storyFit(content,story){
 const strings=[];const walk=(v,k)=>{if(['sources','sourceRefs','evidence','id','template','schemaVersion'].includes(k))return;if(typeof v==='string')strings.push(v);else if(Array.isArray(v))v.forEach(x=>walk(x));else if(v&&typeof v==='object')for(const [kk,vv] of Object.entries(v))walk(vv,kk)};walk(content);
 const all=strings.join(' \n ').toLowerCase(),opening=[content?.title,content?.hook,content?.summary,content?.segments?.[0]?.text].filter(Boolean).join(' ').toLowerCase();
 const interestWords=[...new Set([...String(story?.interest||'').toLowerCase().split(/[^a-z0-9]+/).filter(w=>w.length>3&&!['stories','building','things','other'].includes(w)),...(INTEREST_WORDS[String(story?.interest||'').toLowerCase()]||[])])];
 const count=w=>(all.match(new RegExp('\\b'+w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'))||[]).length;
 const interestHits=interestWords.reduce((n,w)=>n+count(w),0),interestInOpening=interestWords.some(w=>opening.includes(w));
 const style=styleOf(story),styleWords=style?STORY_STYLES[style].words.filter(w=>all.includes(w)):[];
 // When the style comes from the interest (Gaming → video game), its touches count as using the interest too.
 const viaStyle=!!style&&suggestStyle(story?.interest)===style&&styleWords.length>=4,styleInOpening=!!style&&STORY_STYLES[style].words.some(w=>opening.includes(w));
 const weak=[];if(interestWords.length&&!((interestHits>=2&&interestInOpening)||(viaStyle&&(interestInOpening||styleInOpening))))weak.push('interest');if(style&&styleWords.length<3)weak.push('style');
 return {style,styleLabel:style?STORY_STYLES[style].label:null,interestHits,interestInOpening,styleWords,weak};
}
export const STORY_AUDIENCES=Object.freeze({primary:'Primary (about 5–11)',secondary:'Secondary (about 11–16)',adult:'16+ and adults'});
const need=(v,m)=>{if(!v)throw Error(m);};
export function storyBrief(raw={},allowedInterests){
 need(raw&&typeof raw==='object'&&!Array.isArray(raw)&&Object.keys(raw).every(k=>['genre','interest','audience','style'].includes(k)),'Choose a story style and interest.');
 need(raw.style===undefined||Object.hasOwn(STORY_STYLES,raw.style),'Choose an available style.');
 need(raw.audience===undefined||Object.hasOwn(STORY_AUDIENCES,raw.audience),'Choose who the story is for.');
 const genre=raw.genre??'adventure',interest=(raw.interest??'');
 need(Object.hasOwn(STORY_GENRES,genre),'Choose an available story style.');
 need(typeof interest==='string'&&interest.length<=120&&!/[\x00-\x1f<>]/.test(interest),'Keep the interest to 120 plain-text characters.');
 const clean=interest.trim();need(!allowedInterests||!clean||allowedInterests.includes(clean),'Choose an interest from this programme profile.');
 return {genre,interest:clean,...(raw.audience?{audience:raw.audience}:{}),...(raw.style?{style:raw.style}:{})};
}
export function validateDirection(raw){
 need(raw&&typeof raw==='object'&&!Array.isArray(raw)&&Object.keys(raw).length===3&&Object.keys(raw).every(k=>['blocking','shot','pace'].includes(k)),'Use only the authored scene directions.');
 need(STORY_BLOCKING.includes(raw.blocking)&&STORY_SHOTS.includes(raw.shot)&&STORY_PACES.includes(raw.pace),'Choose an available movement, shot and pace.');
 return {blocking:raw.blocking,shot:raw.shot,pace:raw.pace};
}
export const STORY_BRIEF=`Write a real original story rather than a teaching lecture. Characters want something concrete, meet an obstacle, make a plausible mistaken attempt, discover a source-supported relationship, choose how to apply it, and experience a consequence and earned payoff. Begin in the middle of an event. Learning must change a decision or solve a problem inside the plot; do not interrupt the plot with unrelated quizzes or repeated teacher/student explanations. Both characters have agency and can notice, disagree, fail and help. Use the selected interest as the setting, character motivation or practical problem, not merely a passing mention. Interest connections are explicitly fictional framing or bounded analogies, never additional unsourced facts. Do not force an analogy that contradicts the evidence; keep the concept intact and explain its limits in the reflection. Action: momentum, pursuit or a race against a fictional deadline, with non-graphic safe stakes. Drama: competing values, relationships and a consequential choice. Comedy: a character's overconfident plan, escalating situational complications, visual or verbal callbacks and an earned reversal; never ridicule a learner or protected group. Mystery: clues, a misleading assumption and a source-supported reveal. Adventure: a journey, obstacle, discovery and resourceful resolution. No real-person imitation, graphic violence or adult material. Adapt vocabulary and conceptual support to the chosen level and difficulties without assigning ability. A short self-contained arc is enough; no promise of engagement or mastery.`;
export const GAME_STORY_BRIEF=`${STORY_BRIEF} Express the arc through the existing template's hook, dialogue, missions, choices, feedback and endings. Keep the authored cast/world constraints, all rules, quantities, solutions and resource limits intact. Narrative stakes must not create a real-time learning deadline or punish the learner for needing help. For quiz/sports/draft/merge, use a coherent challenge or campaign framing and a payoff; do not pretend the fixed runtime supports new mechanics. For business/history simulations, keep fictional campaign events and model values separate from sourced historical or economic claims through what is cited and who says it, not through disclaimers in the story.`;

// Story craft goes LAST in each prompt so the rules above don't drown it out.
// Each game format gets a cast and a voice; the audience band sets the humour and stakes.
export const VOICE_CARDS=Object.freeze({
 'underlight-v1':'Nessa carries this chapter: a quick-witted engineer who talks to the broken machines like stubborn old friends and narrates her own near-misses. Open the hook in the middle of trouble (a valve bursts, a gate jams, the lamps die). Let challenge text and the aftermath carry her voice and one light joke, and show what changed for the gardens and homes.',
 'adventure-v1':'Everyone the player meets has a name, a want and a distinct way of talking (for example one dry, one excitable, one suspicious). Their lines react, tease, worry or boast before pointing at the clue; they never read out a textbook. Thread one running joke or callback through the rooms and one moment of urgency (something breaks, someone is late, the light is failing). Make the keepsake and the tool matter to a character.',
 'draft-v1':'Each role is a person with a one-line personality and a reason to want the job. Scenarios are turning points with a ticking problem and a crowd that reacts. Card text shows character as well as capability, and the reflection lands like the end of a match report.',
 'town-v1':'Advisers with competing agendas speak in the town story: a cautious treasurer, an impatient builder and a nature warden who all want the mayor on their side. Events read like small-town life, with gossip, mishaps and pride, and the player is the decisive mayor.',
 'economy-v1':'The rival company bosses have names, personalities and friendly taunts. Monthly news reads like a lively local paper. Give the player\'s company a name and an identity worth rooting for.',
 'novel-v1':'The engineer, archivist and captain are three different people: the engineer blunt and practical, the archivist precise and secretly sentimental about old records, the captain bold and impatient. Each gives their name in their first line. Scenes start mid-action, every choice costs something, and consequences say who was pleased or annoyed.',
 'quiz-v1':'A named quizmaster runs the expedition with a running gag. Each question opens with a one-sentence scene. Option feedback reacts in character (warm on a miss, delighted on a hit, never mocking) before it explains.',
 'sports-v1':'Write it like match day: a named commentator with banter, a named rival captain with a catchphrase, near misses and comebacks in the question framing. Feedback sounds like a coach on the touchline.',
 'merge-v1':'Every delivery order is a mini-story from a named customer with a problem and a personality. The guild master has a voice, and item descriptions have a dash of character.',
});
export const AUDIENCE_GUIDE=Object.freeze({
 primary:'Audience: primary age. Short sentences and everyday words; warmth, playful names, slapstick and wordplay; mild peril that resolves quickly; characters stay kind even when they disagree.',
 secondary:'Audience: secondary age. Wit, banter and a little irony; real stakes and rivalry; characters may be sarcastic with each other but never with the player; stretch vocabulary with context clues.',
 adult:'Audience: adults. Dry humour, sharper stakes and real consequences; treat the player as a capable adult with no childish framing.',
});
// Learning has to drive the story, not interrupt it.
export const LEARNING_IN_PLOT='Learning drives the plot: every idea in the evidence packet changes something in the story at least once (it opens the way, fixes the problem, wins the point or explains the twist). A correct answer has a story consequence (a door opens, the team gains ground, the plan works) and a miss causes a small, recoverable setback that sets up the retry; the next scene follows from what just happened. Include at least one task or debrief that asks the learner to explain why or predict what would happen if something changed, not only to recall.';
export const PLAYER_TEXT_RULE='In all player-facing text (titles, hooks, dialogue, scenes, orders, feedback and endings) write no disclaimers, caveats or meta-commentary such as "this is fictional", "not a real claim" or "this does not prove mastery": the review screen and citations already do that job. Never restate these instructions to the player. Humour comes from characters and situations, never from mocking the learner, mistakes, bodies, accents or any group. Use invented people, teams, brands and places, never real people. When an interest is given, build the setting, a character\'s want or the central problem around it, while every fact still comes from the evidence.';
// Anticipation: make the learner need the next answer, and make the learning the only way to get it.
// Techniques and sources: docs/STORY-CRAFT.md. Each line here is something src/story-quality.js checks.
export const ANTICIPATION='ANTICIPATION (the learner must want to know what happens next, and need the idea to find out): 1) Dramatic question: within the first two sentences a named character wants something concrete and something is already going wrong, so the learner can ask "will they…?". 2) Stakes and a clock: say what is lost if they fail and give a deadline inside the story (sunset, the final whistle, the gate closing, the lamps dying); each beat tightens it (worse, less time, a rival closes in). 3) Curiosity gap: before each learning beat show a puzzle, anomaly or locked thing the learner cannot yet explain; the idea in that beat is the key that explains or unlocks it. 4) Open loops: end each beat, after its consequence, on a fresh unanswered question or small cliffhanger that only the next idea can resolve (a new clue, a second fault, "but…"); never close every thread before the finale. 5) Try, fail, learn: an early attempt uses a plausible misconception and fails visibly (yes-but / no-and), and the learned idea turns it around. 6) Setup and payoff: plant one object, clue or line early that pays off at the climax only when a character uses the idea, said in plain words ("because…"); every subplot, gadget and side character either sets up the payoff or carries the learning, so nothing exciting pulls attention away from the idea. 7) Resolution: answer the opening question with the same goal words and one concrete image of what changed; you may leave one small playful question open. Keep tension fair: the answer is always reachable from the evidence, and help never costs the learner the story.';
// How the arc maps onto each format's fixed structure: where the hook, loops and payoff live.
export const FORMAT_ARCS=Object.freeze({
 'underlight-v1':'Arc: the hook starts with the waterworks failing right now and what the gardens and homes lose by nightfall. route, balance and transfer are three escalating faults; each challenge explanation (shown when it is solved) ends on the next fault appearing. The aftermath answers the hook.',
 'adventure-v1':'Arc: the hook gives the goal and the clock. Each room clue ends on a lead or snag that points to the next place; sequence success reveals the last fault; repair success sets up the final choice; both endings answer the hook and turn on the learned idea.',
 'draft-v1':'Arc: a season building to a final. Each scenario is a sharper crisis; each explanation (shown after a correct pick) ends on what the next crisis will demand. The ending answers the opening question.',
 'town-v1':'Arc: the town faces one looming problem with a date (a storm, a festival, an inspection). Each council event follows from the last decision; each choice explanation ends on what that choice sets in motion. The ending answers the hook.',
 'economy-v1':'Arc: a season with a goal and a rival. Each month\'s news follows from the last choice and each choice explanation ends on a fresh pressure or rumour. The ending answers the opening goal.',
 'novel-v1':'Arc: six scenes, each a choice under pressure; every consequence ends on the new problem the choice creates, so the next scene must follow from it. Both endings answer the opening question differently.',
 'quiz-v1':'Arc: an expedition with one goal and a clock. Each question opens on a scene problem; the CORRECT option\'s feedback first shows the consequence (a door opens, the map lights) and then ends on the next mystery or snag, as its last sentence. Questions 7–8 are the climax. The debrief asks why.',
 'sports-v1':'Arc: one match with a score and a clock (minutes left). Each possession is a turning point; the CORRECT option\'s feedback shows the play working and ends on what the rival does next or what is still at risk, as its last sentence. The last possession decides the match.',
 'merge-v1':'Arc: three orders tell one story against a deadline (a festival, a storm, a launch); each order purpose ends on why the next order matters. The debrief asks why the combinations work.',
 cartoon:'Arc for a three-minute cartoon: segment 1 is a cold open with trouble in the first line; by segment 2 the dramatic question and the deadline are clear; a confident first try fails on a misconception; around the middle a reversal or cliffhanger line ends on a question (two or three open endings in all, each different, never a bare "but—"); the discovery turns it; the payoff answers the opening using the idea; end on a short callback joke.',
 podcast:'Arc for an audio drama: open mid-scene with a sound or line of trouble; establish what they want and the deadline by the second line; every line either advances the plan or raises a question the listener wants answered; leave a question open at two or three turning points (not every line), each in a different way: a direct question, an interruption, a new problem or a sound off-mic; never end lines on a bare "but—"; a mid-point setback; the discovery turns it; the payoff answers the opening; finish on a callback. Make every clue audible in dialogue.',
});
// Suspense differs by audience band as much as humour does.
export const AUDIENCE_SUSPENSE=Object.freeze({
 primary:'Suspense for primary: one clear question, playful cliffhangers ("but where did the wrench go?"), mild peril that resolves quickly and safely, and a cosy ending.',
 secondary:'Suspense for secondary: real rivalry and stakes, a reversal or twist the learner can see coming if they read the clues, and dramatic irony where the learner knows something a character does not.',
 adult:'Suspense for adults: sharper consequences and trade-offs, an uncomfortable dilemma, dry understatement instead of exclamation marks, and an ending that respects ambiguity.',
});
// The learner's weak spot becomes the story's turning point: a character makes that exact mistake,
// it fails where everyone can see, and the learned idea fixes it. The learner is never singled out.
export const WEAK_SPOT_RULE='WEAK SPOT AS THE TURNING POINT: if the learner details below name a difficulty, misconception or point to revisit that relates to this topic, the early try-fail attempt is exactly that mistaken idea, made confidently by a character (never the learner, never described as anyone\'s weakness), it fails visibly, and the discovery and payoff fix it with the evidence, said in plain words. If nothing relevant is named, use the most tempting misconception the evidence warns against or that a beginner would make. Name the mistaken idea in mistake.';
export const WEAK_SPOT_SOURCES=Object.freeze({game:'Learner details: learnerContext.',creative:'Learner details: learner.focus and each adaptation pointToRevisit (feedback on a recent answer that differed from the reviewed one).'});
// Only text that sounds like a difficulty counts; "Year 8, getting started" names none.
const DIFFICULTY=/\b(struggl\w*|confus\w*|mix(?:es|ing)? up|muddl\w*|difficult\w*|hard time|finds? [^.]{0,40}hard|misconceptions?|forget\w*|weak\w*|trouble|thinks? that|believes?|mistak\w*|wrongly|unsure|not sure|keeps? (?:getting|thinking|saying)|gets? [^.]{0,30}wrong)\b/i;
export function weakSpotTarget({level,focus,adaptation}={}){
 const parts=[];if(typeof focus==='string'&&focus.trim())parts.push(focus.trim());
 for(const a of Array.isArray(adaptation)?adaptation:[])if(typeof a?.pointToRevisit==='string'&&a.pointToRevisit.trim())parts.push(a.pointToRevisit.trim());
 if(typeof level==='string'&&DIFFICULTY.test(level))parts.push(level.trim());
 return parts.length?parts.join(' ').slice(0,600):null;
}
// Cartoons and podcasts have no audience picker, so the learner's stage sets the band.
export function audienceFromStage(stage){
 const s=String(stage||'').toLowerCase();
 if(/primary|key stage [12]\b|ks[12]\b|year [1-6]\b|reception|ages? ([5-9]|1[01])\b/.test(s))return 'primary';
 if(/secondary|key stage [34]\b|ks[34]\b|year ([7-9]|1[01])\b|gcse|middle school|high school|ages? 1[1-6]\b|13.?17/.test(s))return 'secondary';
 if(/college|university|sixth form|a.?level|adult|18\+|professional|undergraduate|postgraduate|work/.test(s))return 'adult';
 return null;
}
// Games return a storyArc plan alongside the game. The server checks it against the player text.
export function storyArcBrief(template){
 const keys={'underlight-v1':'route, balance, transfer','adventure-v1':'workshop, woods, archive, sequence, repair, decision','quiz-v1':'question-0 to question-7','sports-v1':'question-0 to question-5','novel-v1':'scene-0 to scene-5','town-v1':'council-0 to council-3','economy-v1':'council-0 to council-5','draft-v1':'each scenario id in order','merge-v1':'order-0 to order-2'}[template];
 return `Also return storyArc, a plan the server checks and players never see: dramaticQuestion (one "will/can…?" question the hook raises), stakes (what is lost if they fail), clock (the in-story deadline), mistake (the mistaken idea a character tries first, and who), payoff (how the learned idea wins at the end), and beats in play order (${keys}), each with activity, learning (the idea that resolves it) and openLoop (the exact last sentence of that activity's player text that leaves the next question open; leave the final beat's openLoop as its resolution line).`;
}
export function storyCraft(template,story){
 const audience=AUDIENCE_GUIDE[story?.audience]||'Audience: pitch humour and stakes to the learner context given.';
 return `STORY CRAFT (apply after every rule above; rules win if they conflict). ${VOICE_CARDS[template]||''} ${styleDirection(story)} ${LEARNING_IN_PLOT} ${ANTICIPATION} ${WEAK_SPOT_RULE} ${WEAK_SPOT_SOURCES.game} ${FORMAT_ARCS[template]||''} ${audience} ${AUDIENCE_SUSPENSE[story?.audience]||''} ${PLAYER_TEXT_RULE}`;
}

// How many of the chapter's source passages the game actually uses (cites somewhere in play).
export function learningCoverage(content){
 const sources=(content?.sources||[]).map(s=>s.id),used=new Set();
 const walk=(v,k)=>{if(k==='sources')return;if(k==='sourceRefs'&&Array.isArray(v)){v.forEach(id=>used.add(id));return}if(Array.isArray(v))v.forEach(x=>walk(x));else if(v&&typeof v==='object')for(const [kk,vv] of Object.entries(v))walk(vv,kk)};
 walk(content);
 const missing=(content?.sources||[]).filter(s=>!used.has(s.id)).map(s=>s.title||s.locator||s.id);
 return {total:sources.length,used:sources.filter(id=>used.has(id)).length,missing};
}
