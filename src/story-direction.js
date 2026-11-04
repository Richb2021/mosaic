// Story intent is data. The authoring model selects from authored runtime choices.
export const STORY_GENRES=Object.freeze({adventure:'Adventure',action:'Action',drama:'Drama',comedy:'Comedy',mystery:'Mystery'});
export const STORY_BEATS=Object.freeze(['hook','goal','setback','attempt','discovery','choice','payoff']);
export const STORY_BLOCKING=Object.freeze(['arrive','travel-right','travel-left','approach','separate','pursuit','retreat','face-off']);
export const STORY_SHOTS=Object.freeze(['wide','two-shot','speaker','reaction']);
export const STORY_PACES=Object.freeze(['calm','urgent']);
// Who the story is written for. Sets humour, sentence length and how sharp the stakes are.
export const STORY_AUDIENCES=Object.freeze({primary:'Primary (about 5–11)',secondary:'Secondary (about 11–16)',adult:'16+ and adults'});
const need=(v,m)=>{if(!v)throw Error(m);};
export function storyBrief(raw={},allowedInterests){
 need(raw&&typeof raw==='object'&&!Array.isArray(raw)&&Object.keys(raw).every(k=>['genre','interest','audience'].includes(k)),'Choose a story style and interest.');
 need(raw.audience===undefined||Object.hasOwn(STORY_AUDIENCES,raw.audience),'Choose who the story is for.');
 const genre=raw.genre??'adventure',interest=(raw.interest??'');
 need(Object.hasOwn(STORY_GENRES,genre),'Choose an available story style.');
 need(typeof interest==='string'&&interest.length<=120&&!/[\x00-\x1f<>]/.test(interest),'Keep the interest to 120 plain-text characters.');
 const clean=interest.trim();need(!allowedInterests||!clean||allowedInterests.includes(clean),'Choose an interest from this programme profile.');
 return {genre,interest:clean,...(raw.audience?{audience:raw.audience}:{})};
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
export const PLAYER_TEXT_RULE='In all player-facing text (titles, hooks, dialogue, scenes, orders, feedback and endings) write no disclaimers, caveats or meta-commentary such as "this is fictional", "not a real claim" or "this does not prove mastery": the review screen and citations already do that job. Never restate these instructions to the player. Humour comes from characters and situations, never from mocking the learner, mistakes, bodies, accents or any group. Use invented people, teams, brands and places, never real people. When an interest is given, build the setting, a character\'s want or the central problem around it, while every fact still comes from the evidence.';
export function storyCraft(template,story){
 const audience=AUDIENCE_GUIDE[story?.audience]||'Audience: pitch humour and stakes to the learner context given.';
 return `STORY CRAFT (apply after every rule above; rules win if they conflict). ${VOICE_CARDS[template]||''} ${audience} ${PLAYER_TEXT_RULE}`;
}
