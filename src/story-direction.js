// Story intent is data. The authoring model selects from authored runtime choices.
export const STORY_GENRES=Object.freeze({adventure:'Adventure',action:'Action',drama:'Drama',comedy:'Comedy',mystery:'Mystery'});
export const STORY_BEATS=Object.freeze(['hook','goal','setback','attempt','discovery','choice','payoff']);
export const STORY_BLOCKING=Object.freeze(['arrive','travel-right','travel-left','approach','separate','pursuit','retreat','face-off']);
export const STORY_SHOTS=Object.freeze(['wide','two-shot','speaker','reaction']);
export const STORY_PACES=Object.freeze(['calm','urgent']);
const need=(v,m)=>{if(!v)throw Error(m);};
export function storyBrief(raw={},allowedInterests){
 need(raw&&typeof raw==='object'&&!Array.isArray(raw)&&Object.keys(raw).every(k=>['genre','interest'].includes(k)),'Choose a story style and interest.');
 const genre=raw.genre??'adventure',interest=(raw.interest??'');
 need(Object.hasOwn(STORY_GENRES,genre),'Choose an available story style.');
 need(typeof interest==='string'&&interest.length<=120&&!/[\x00-\x1f<>]/.test(interest),'Keep the interest to 120 plain-text characters.');
 const clean=interest.trim();need(!allowedInterests||!clean||allowedInterests.includes(clean),'Choose an interest from this programme profile.');
 return {genre,interest:clean};
}
export function validateDirection(raw){
 need(raw&&typeof raw==='object'&&!Array.isArray(raw)&&Object.keys(raw).length===3&&Object.keys(raw).every(k=>['blocking','shot','pace'].includes(k)),'Use only the authored scene directions.');
 need(STORY_BLOCKING.includes(raw.blocking)&&STORY_SHOTS.includes(raw.shot)&&STORY_PACES.includes(raw.pace),'Choose an available movement, shot and pace.');
 return {blocking:raw.blocking,shot:raw.shot,pace:raw.pace};
}
export const STORY_BRIEF=`Write a real original story rather than a teaching lecture. Characters want something concrete, meet an obstacle, make a plausible mistaken attempt, discover a source-supported relationship, choose how to apply it, and experience a consequence and earned payoff. Begin in the middle of an event. Learning must change a decision or solve a problem inside the plot; do not interrupt the plot with unrelated quizzes or repeated teacher/student explanations. Both characters have agency and can notice, disagree, fail and help. Use the selected interest as the setting, character motivation or practical problem, not merely a passing mention. Interest connections are explicitly fictional framing or bounded analogies, never additional unsourced facts. Do not force an analogy that contradicts the evidence; keep the concept intact and explain its limits in the reflection. Action: momentum, pursuit or a race against a fictional deadline, with non-graphic safe stakes. Drama: competing values, relationships and a consequential choice. Comedy: a character's overconfident plan, escalating situational complications, visual or verbal callbacks and an earned reversal; never ridicule a learner or protected group. Mystery: clues, a misleading assumption and a source-supported reveal. Adventure: a journey, obstacle, discovery and resourceful resolution. No real-person imitation, graphic violence or adult material. Adapt vocabulary and conceptual support to the chosen level and difficulties without assigning ability. A short self-contained arc is enough; no promise of engagement or mastery.`;
export const GAME_STORY_BRIEF=`${STORY_BRIEF} Express the arc through the existing template's hook, dialogue, missions, choices, feedback and endings. Keep the authored cast/world constraints, all rules, quantities, solutions and resource limits intact. Narrative stakes must not create a real-time learning deadline or punish the learner for needing help. For quiz/sports/draft/merge, use a coherent challenge or campaign framing and a payoff; do not pretend the fixed runtime supports new mechanics. For business/history simulations, distinguish fictional campaign events and model values from sourced historical or economic claims.`;
