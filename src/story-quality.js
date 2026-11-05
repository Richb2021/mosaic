// Story quality: a deterministic check of whether a generated story makes the learner want to know
// what happens next, and whether the learning is what gets them there. Techniques and sources are in
// docs/STORY-CRAFT.md. The checker reads only player-facing text (plus the optional storyArc plan),
// so stored drafts made before the plan existed can be scored the same way.
import {learningCoverage} from './story-direction.js';

export const STORY_CRITERIA=Object.freeze({
 hook:'Hook in the first lines',
 question:'Clear dramatic question',
 stakes:'Rising stakes',
 loops:'Open loops between learning beats',
 payoff:'Payoffs need the learned idea',
 voice:'Voice and humour for the audience',
 resolution:'Satisfying resolution',
 learning:'Learning coverage and explain-why',
});
// The four that decide whether the story pulls the learner forward at all.
const CORE=['hook','question','loops','payoff'];

const words=s=>String(s||'').toLowerCase().match(/[a-z][a-z'’-]*/g)||[];
const sentences=s=>String(s||'').replace(/\s+/g,' ').trim().split(/(?<=[.!?…])\s+(?=["'“‘A-Z0-9])/).filter(Boolean);
const has=(re,s)=>re.test(String(s||''));
const STOP=new Set('the a an and or but if then so of to in on at by for with from into onto over under is are was were be been being it its this that these those there their they them he she his her you your we our us i me my not no yes can could will would should must may might do does did done have has had as than too very just only also more most some any each every all one two three what which who whom whose when where why how about after before again because while until up down out off here now new old own same other such'.split(' '));
const keyWords=s=>words(s).filter(w=>w.length>3&&!STOP.has(w));

// Lexicons, kept small and specific so a match means something.
const TROUBLE=/\b(broke|broken|breaks|burst|jam(?:med|s)?|stuck|trapped|lost|missing|stolen|vanish\w*|fail(?:s|ed|ing)?|fading|dying|dark(?:ness)?|flood\w*|collaps\w*|crash\w*|scrambl\w*|wrong|backwards?|blank|late|alarm\w*|chaos|disaster|empty|storm|threat\w*|sabotag\w*|rival\w*|emergency|panic\w*|crisis|leak\w*|spill\w*|tangled|cursed?|frozen|ruin\w*|wobbl\w*|crack\w*|snapp?\w*|cancel\w*|disqualif\w*|closes|closing|shut|down|dead|overdue|behind|losing|lose|mess|mix-up|uh-oh|oh no|help)\b/i;
const SOUND=/\b(?:[A-Z]{3,}!|(?:whoosh|krak|zap|bang|clatter|thud|crash|boom|splash|whirr|clang|pop|wham|kaboom|creak|hiss)\b)/i;
const LECTURE=/^\s*(?:in this (?:lesson|game|chapter|activity|quiz)|welcome(?: to)?|today,? (?:we|you)|let'?s learn|you will (?:learn|explore)|this (?:game|chapter|quiz|activity) (?:is|will|teaches|explores)|did you know|learning objective|objective:|[A-Z][a-z]+ (?:is|are) (?:a|an|the) (?:process|type|kind|way|form|measure|part))/i;
const GOAL=/\b(must|needs? to|has to|have to|had to|wants? to|trying to|tries to|race[sd]? to|racing to|determined to|set out to|hopes? to|dreams? of|plans? to|mission|quest|goal|aims? to|bid to|chance to|only .{1,40} can|if .{1,40} (?:can|could)|(?:can|will|could) (?:they|she|he|we|you|the [a-z]+) [a-z]+)\b/i;
const CLOCK=/\b(before|until|deadline|countdown|sunset|sundown|midnight|dawn|nightfall|tonight|by morning|minutes?|seconds?|hours? left|final whistle|whistle|kick-?off|closes|time(?:'s| is)? (?:running|up|short)|clock|last (?:chance|minute|train|light)|running out|ticking|in time|too late|now or never|launch window|full time|half-?time)\b/i;
const STAKE=/\b(or else|otherwise|if (?:they|she|he|we|you|it|the [a-z]+) (?:fail|lose|can'?t|cannot|don'?t)|lose|losing|lost forever|whole|everyone|entire|depends? on|at stake|forever|only hope|last hope|could (?:flood|fall|fail|collapse|go dark|sink|lose|crash|burn|freeze|starve)|will (?:flood|fall|fail|collapse|go dark|sink|lose|crash)|danger|disqualif\w*|relegat\w*|out of the (?:cup|league|race)|no one|nobody|without (?:it|them|power|water|light))\b/i;
const ESCALATE=/\b(worse|even|now|faster|again|bigger|harder|last|final|no time|one (?:more|last) (?:chance|try)|suddenly|but then|only one|second (?:time|attempt|half)|twice|everything|the real|turns out|twist|instead|not enough|too)\b/i;
const LOOP_END=/(?:\?["'”’]?\s*$|(?:…|\.\.\.|—|–)["'”’]?\s*$)/;
const LOOP_WORD=/\b(but|until|suddenly|just as|wait|not yet|unless|only if|meanwhile|somewhere|someone|something (?:else|strange|odd|is|was|moves|glints)|strange|odd|hidden|secret|another|one more|still (?:need|needs|missing|locked|dark|have|has|to|won't|can't)|yet to|what if|next (?:stop|clue|problem|challenge|door|gate|lock|round|possession|order|move|scene)|up ahead|ahead lies|before (?:the|they|we|it|you|anyone)|uh-oh|oh no|no time|refus\w*|won'?t (?:budge|move|open|start|work|turn|light)|can'?t|cannot|isn'?t (?:working|moving|enough|over)|doesn'?t (?:work|move|budge|add up|match)|locked|jammed|stuck|missing|fading|vanish\w*|glints?|half-buried|beneath|underneath|far from over)\b/i;
const CONSEQ=/\b(opens?|opened|unlock\w*|works?|worked|fix(?:es|ed)?|light(?:s|ed)? up|lights|glow\w*|wins?|won|scores?|scored|saves?|saved|gains?|gained|clicks?|clicked|flows?|flowed|runs?|moves?|moved|cheer\w*|powers? up|power(?:s|ed)?|rises?|rose|returns?|turns?|turned|answers?|solves?|solved|cracks?|cracked|frees?|freed|reaches?|reached|lands?|landed|holds?|held|balances?|balanced|spins?|starts?|started|restores?|restored|beats?|beat|takes? the lead|ground|advance\w*|step closer|back on track|hums?|roars?|whirrs?|sparks?)\b/i;
const CAUSAL=/\b(because|so (?:the|that|it|they|we|she|he)|since|thanks to|that'?s why|which (?:means|is why)|this means|due to|means (?:the|that|it)|so now|that is how|that'?s how|when (?:the|you|we|they))\b/i;
const RESOLVE=/\b(fixed|saved|won|wins|home|finally|at last|together|lights? (?:up|on|return)|cheer\w*|safe|done|complete[d]?|restored|celebrat\w*|solved|back on|hums? again|glow\w*|smil\w*|laugh\w*|grins?|hug\w*|victory|champions?|trophy|cup|made it|did it|we did|it worked|works again|thank\w*|peace|calm|dawn|morning|bloom\w*|clear)\b/i;
const WHY=/\b(why|how (?:does|do|did|would|could|can|might)|what (?:would|might|could|will) happen|what if|predict|explain|if .{1,60} changed|suppose|imagine|in your own words|compare)\b/i;
const DISCLAIMER=/\b(this (?:story|game|scenario|chapter|example) is (?:entirely |purely |only )?(?:fictional|made up|imaginary)|(?:fictional|imaginary) (?:framing|example|scenario) only|not (?:a )?real(?: claim| fact| data)?\b|does not (?:prove|measure|show) mastery|for illustration only|not (?:intended|meant) as (?:advice|fact)|(?:is|are|belong to) (?:a )?fictional (?:scenery|story|setting|framing|places?)|(?:tools|places|events|characters) (?:are|belong to) (?:a )?fictional|not a claim about|disclaimer|as an ai|learning objective)\b/i;
const CHILDISH=/\b(yay+|yippee|super-?duper|boys and girls|kiddo|little ones|good job, (?:buddy|kiddo)|teehee)\b/i;
const HUMOUR=/(!|\b(?:oops|whoops|uh-oh|ha+|heh|grins?|grinned|winks?|giggl\w*|laugh\w*|joke\w*|silly|ridiculous|absurd|of course|obviously|naturally|apparently|somehow|again|sock|banana|biscuit|spoon|pigeon|goat|duck|wobbl\w*|trips?|tripped|sighs?|sighed|groans?|groaned|rolls (?:his|her|their) eyes|deadpan|dry(?:ly)?|mutter\w*|sarcas\w*|brilliant\.|marvellous|classic)\b)/i;

// ---- Reading each format into one story view -------------------------------------------------
const join=(...xs)=>xs.flat().filter(x=>typeof x==='string'&&x.trim()).join(' ');
const refsOf=x=>Array.isArray(x?.sourceRefs)?x.sourceRefs:[];
const correct=q=>Array.isArray(q?.options)&&Number.isInteger(q.solution)?q.options[q.solution]:null;
// The learning beats of each format, in play order. `after` lists the [object, field] texts the
// learner sees right after getting the beat right: that is where an open loop belongs, and where
// repair writes one. The same table drives scoring and repair, so they can't drift apart.
export function storyBeats(c){
 const t=c?.template;
 if(Array.isArray(c?.segments))return c.segments.map((s,i)=>({key:s.id||`segment-${i+1}`,text:[],after:[[s,'text']],refs:refsOf(s)}));
 if(t==='underlight-v1')return ['route','balance','transfer'].filter(k=>c.challenges?.[k]).map(k=>{const q=c.challenges[k];return {key:k,text:[q.prompt],after:[[q,'explanation']],refs:refsOf(q)}});
 if(t==='adventure-v1')return [
  ...['workshop','woods','archive'].filter(k=>c.rooms?.[k]).map(k=>{const r=c.rooms[k];return {key:k,text:[r.description,r.npc?.dialogue],after:[[r.clue,'text']],refs:[...refsOf(r.npc),...refsOf(r.clue)]}}),
  ...['sequence','repair'].filter(k=>c[k]).map(k=>({key:k,text:[c[k].prompt],after:[[c[k],'success']],refs:refsOf(c[k])})),
  ...(c.decision?[{key:'decision',text:[c.decision.prompt],after:(c.decision.choices||[]).map(x=>[x,'ending']),refs:(c.decision.choices||[]).flatMap(refsOf)}]:[])];
 if(['quiz-v1','sports-v1'].includes(t))return (c.questions||[]).map((q,i)=>({key:`question-${i}`,text:[q.prompt],after:correct(q)?[[correct(q),'feedback']]:[],refs:refsOf(q)}));
 if(t==='novel-v1')return (c.nodes||[]).map((n,i)=>({key:`scene-${i}`,text:[n.text],after:(n.choices||[]).map(x=>[x,'consequence']),refs:[...refsOf(n),...(n.choices||[]).flatMap(refsOf)]}));
 if(['town-v1','economy-v1'].includes(t))return (c.events||[]).map((e,i)=>({key:`council-${i}`,text:[e.prompt],after:(e.choices||[]).map(x=>[x,'explanation']),refs:(e.choices||[]).flatMap(refsOf)}));
 if(t==='draft-v1')return (c.scenarios||[]).map(s=>({key:s.id,text:[s.prompt,s.question],after:[[s,'explanation']],refs:refsOf(s)}));
 if(t==='merge-v1')return (c.orders||[]).map((o,i)=>({key:`order-${i}`,text:[o.title],after:[[o,'purpose']],refs:refsOf(o)}));
 return [];
}
export function storyView(c){
 const t=c?.template||(c?.kind&&Array.isArray(c?.segments)?c.kind:null);
 const v={format:t,opening:'',summary:'',beats:[],ending:'',explain:'',speakers:[],all:[]};
 for(const b of storyBeats(c)){const afters=b.after.map(([o,k])=>String(o?.[k]||'')).filter(Boolean);v.beats.push({key:b.key,text:join(b.text),after:join(afters),afters,cited:b.refs.length>0})}
 if(Array.isArray(c?.segments)){// cartoon or podcast
  const segs=c.segments;v.opening=join(c.title,segs[0]?.text,segs[1]?.text);v.summary=join(c.summary);
  v.ending=join(segs.slice(-2).map(s=>s.text));v.explain=join(c.question?.prompt);v.speakers=['Mira','Kit'];
 }else{
  v.opening=join(c?.title,c?.subtitle,c?.hook);
  if(t==='underlight-v1'){v.ending=join(c.aftermath?.gardens,c.aftermath?.homes,c.challenges?.transfer?.explanation);v.explain=join(c.challenges?.transfer?.prompt);v.speakers=['Nessa']}
  else if(t==='adventure-v1'){for(const k of ['workshop','woods','archive'])if(c.rooms?.[k]?.npc?.name)v.speakers.push(c.rooms[k].npc.name);v.ending=join((c.decision?.choices||[]).map(x=>x.ending));v.explain=join(c.decision?.prompt,c.repair?.prompt)}
  else if(['quiz-v1','sports-v1'].includes(t)){const last=(c.questions||[]).at(-1);v.ending=join(correct(last)?.feedback,last?.explanation,c.debrief?.explanation);v.explain=join(c.debrief?.question);v.speakers.push(c.teamName,c.opponentName)}
  else if(t==='novel-v1'){v.speakers.push(...(c.nodes||[]).map(n=>n.speaker));v.ending=join((c.endings||[]).map(e=>e.text));v.explain=join(c.debrief?.question)}
  else if(['town-v1','economy-v1'].includes(t)){v.ending=join(c.ending,c.debrief?.explanation);v.explain=join(c.debrief?.question)}
  else if(t==='draft-v1'){v.ending=join(c.ending);v.explain=join((c.scenarios||[]).map(s=>s.question))}
  else if(t==='merge-v1'){v.ending=join(c.debrief?.explanation,(c.orders||[]).at(-1)?.purpose);v.explain=join(c.debrief?.question)}
 }
 // Every player-facing string, never source excerpts or IDs.
 const walk=(x,k)=>{if(['sources','sourceRefs','id','template','topicId','schemaVersion','learningMap','storyArc','asset','icon','scene','action','speaker','beat','direction','performance','preset','focus','story'].includes(k))return;if(typeof x==='string')v.all.push(x);else if(Array.isArray(x))x.forEach(y=>walk(y));else if(x&&typeof x==='object')for(const [kk,vv] of Object.entries(x))walk(vv,kk)};walk(c);
 v.speakers=[...new Set(v.speakers.filter(Boolean))];
 return v;
}

// Names are capitalised words that are not sentence starts and not common words, seen in player text.
function namesIn(text){
 const out=new Map();for(const s of sentences(text)){const ws=s.split(/\s+/).slice(1);for(const raw of ws){const w=raw.replace(/^[^A-Za-z]+|[^A-Za-z'’-]+$/g,'');if(/^[A-Z][a-z]{2,}$/.test(w)&&!STOP.has(w.toLowerCase())&&!/^(The|This|That|Then|When|What|Why|How|Who|Where|Each|Every|Only|Both|Now|One|Two|Three|Yes|Wait|But|And|Our|Your|Their|Coach|Captain|Team|Player|Chapter|Level|Round|Question|Possession|Scene|Order|Day|Night|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|January|February|March|April|May|June|July|August|September|October|November|December)$/.test(w))out.set(w,(out.get(w)||0)+1)}}
 return [...out].filter(([,n])=>n>=2).map(([w])=>w);
}
const avgSentence=text=>{const ss=sentences(text);return ss.length?words(text).length/ss.length:0};
const lastSentence=s=>sentences(s).at(-1)||'';
// Concept words: what the sources and learning map are about, which the payoff should use.
function conceptWords(c){
 const bag=new Map(),add=(s,w=1)=>keyWords(s).forEach(x=>bag.set(x,(bag.get(x)||0)+w));
 for(const s of c?.sources||[])add(s.excerpt);for(const n of c?.learningMap||[])add(n.objective,2);
 return new Set([...bag].filter(([w,n])=>n>=2&&w.length>4).map(([w])=>w));
}

// ---- Scoring ----------------------------------------------------------------------------------
const FIX={
 hook:'Open in the middle of a concrete problem: in the first two sentences a named character is already in trouble (something breaks, goes missing, goes wrong or runs out). No welcome, lesson framing or definition first.',
 question:'State one dramatic question early, as a goal with an obstacle the learner will want answered (for example: can the team fix X before Y?). Put it in the hook/opening and in storyArc.dramaticQuestion.',
 stakes:'Say what is lost if they fail, add a ticking clock (a deadline, a countdown, the final whistle), and make each beat raise the pressure (worse, later, less time) until the payoff.',
 loops:'End each learning beat on an open loop (in a spoken script, two or three well-placed ones, each different, never a bare "but—"): after the consequence, raise the next unanswered question or a small cliffhanger (a new clue, a fresh problem, "but…") that only the next idea can answer. Write it as the last sentence of that beat\'s player text.',
 payoff:'Make each correct answer cause a visible story consequence (the door opens, the team gains ground, the machine works) and make the final payoff happen because a character uses the learned idea, named in plain words ("because…").',
 voice:'Give at least two named characters distinct voices and let them react with audience-appropriate humour; keep sentences short for primary, witty for secondary, dry and direct for adults. Remove any disclaimer or lesson framing from player text.',
 resolution:'End by answering the dramatic question from the opening: show who won, what was fixed or saved and what changed, using the same goal words, with a warm or satisfying final image.',
 learning:'Use every evidence passage somewhere in play with sourceRefs, cite every learning beat, and include one task that asks the learner to explain why or predict what would happen if something changed.',
};
export function scoreStory(content,{story,arc}={}){
 const v=storyView(content),all=v.all.join(' \n '),audience=story?.audience||null;
 const s={},why={};
 // 1 Hook: starts in trouble, with a character, not a lecture.
 const hookText=v.format==='cartoon'||v.format==='podcast'?join(content?.segments?.[0]?.text):join(content?.hook)||v.opening;
 const hookFirst=sentences(hookText).slice(0,2).join(' ');
 // In a cartoon or podcast the first line is always spoken by Mira or Kit, so a character is present.
 const spokenHook=Array.isArray(content?.segments);
 const lecture=has(LECTURE,hookText),trouble=has(TROUBLE,hookFirst)||has(SOUND,hookFirst)||/[!?]/.test(hookFirst),named=namesIn(join(hookText,all)).some(n=>hookFirst.includes(n))||v.speakers.some(n=>hookFirst.includes(n))||/\b(you|your)\b/i.test(hookFirst)||spokenHook;
 s.hook=lecture?0:(trouble&&named?2:trouble||named?1:0);why.hook=lecture?'opens like a lesson':!trouble?'no trouble in the first lines':!named?'no character in the first lines':'';
 // 2 Dramatic question: goal plus obstacle or deadline early; the plan's question must show in the opening.
 const early=join(v.opening,v.summary,v.beats[0]?.text);
 const goal=has(GOAL,early)||/\?/.test(hookText),pressure=has(CLOCK,early)||has(STAKE,early)||has(TROUBLE,early);
 const dq=arc?.dramaticQuestion,dqShown=dq&&keyWords(dq).filter(w=>early.toLowerCase().includes(w)).length>=2;
 s.question=(goal&&pressure)||dqShown?2:goal||pressure?1:0;why.question=s.question<2?(goal?'goal but no obstacle or deadline':'no clear goal early'):'';
 // 3 Rising stakes: stakes stated, a clock somewhere, escalation in the second half.
 const half=v.beats.slice(Math.floor(v.beats.length/2)),late=join(half.flatMap(b=>[b.text,b.after]));
 const sp=[has(STAKE,early)||has(STAKE,v.summary),has(CLOCK,all),has(ESCALATE,late)].filter(Boolean).length;
 s.stakes=sp>=3?2:sp>=1?1:0;if(sp===2)s.stakes=has(CLOCK,all)?2:1;why.stakes=s.stakes<2?'stakes or ticking clock missing':'';
 // 4 Open loops: between beats, the consequence ends on a question, a cliffhanger or an unresolved turn.
 const play=v.beats.filter(b=>b.text||b.after),gaps=Math.max(play.length-1,0);
 const arcLoops=(arc?.beats||[]).map(b=>norm(b.openLoop)).filter(Boolean);
 const isLoop=(t,arcLoop)=>{const end=lastSentence(t);return LOOP_END.test(end)||has(LOOP_WORD,end)||(!!arcLoop&&norm(sentences(t).slice(-2).join(' ')).includes(arcLoop.slice(0,40)))};
 let loops=0;play.slice(0,-1).forEach((b,i)=>{const arcLoop=arcLoops[i]||'';if((b.afters.length?b.afters:[b.text]).some(t=>isLoop(t,arcLoop)))loops++});
 const loopRate=gaps?loops/gaps:0,spoken=Array.isArray(content?.segments);s.loops=loopRate>=(spoken?0.34:0.5)?2:loops>=1?1:0;why.loops=s.loops<2?`${loops} of ${gaps} beats end on an open question`:'';
 // In a spoken script, a cliffhanger on nearly every line turns into a tic, especially the same one.
 const tics=play.slice(0,-1).filter(b=>/(?:\bbut|—|–|-)\s*["'”’]?\s*$/i.test(b.text||b.after)).length;
 if(spoken&&gaps>=4&&(loopRate>0.8||tics/gaps>0.4)){s.loops=1;why.loops=tics/gaps>0.4?`${tics} of ${gaps} lines trail off on "but—"; vary the cliffhangers`:'a cliffhanger on almost every line; vary the rhythm'}
 // 5 Payoffs: consequences after correct answers, and a final payoff that uses the idea.
 const withAfter=play.filter(b=>b.after),conseq=withAfter.filter(b=>has(CONSEQ,b.after)).length;
 const concepts=conceptWords(content),endingConcepts=keyWords(v.ending).filter(w=>concepts.has(w));
 const usesIdea=new Set(endingConcepts).size>=2&&has(CAUSAL,v.ending);
 s.payoff=(withAfter.length&&conseq/withAfter.length>=0.5?1:0)+(usesIdea?1:0);if(!concepts.size&&has(CAUSAL,v.ending)&&s.payoff===1)s.payoff=2;
 why.payoff=s.payoff<2?(usesIdea?'answers rarely change the story':'the ending does not turn on the learned idea'):'';
 // 6 Voice and humour for the audience.
 const names=new Set([...v.speakers,...namesIn(all)]),avg=avgSentence(all),humour=(all.match(new RegExp(HUMOUR.source,'gi'))||[]).length;
 const lengthOk=audience==='primary'?avg<=16:audience==='secondary'?avg<=22:avg<=26;
 const toneOk=audience==='adult'?!has(CHILDISH,all):humour>=2;
 const disclaimer=has(DISCLAIMER,playerText(content));
 s.voice=disclaimer?0:(names.size>=2?1:0)+(lengthOk&&toneOk?1:0);why.voice=disclaimer?'disclaimer or lesson framing in player text':names.size<2?'fewer than two named characters':!lengthOk?`sentences too long for ${audience||'the audience'} (${avg.toFixed(0)} words)`:!toneOk?'little humour or reaction':'';
 // 7 Resolution: answers the opening's question with a satisfying image.
 const goalWords=new Set(keyWords(join(hookText,dq||'')));
 const echoes=keyWords(v.ending).filter(w=>goalWords.has(w)).length;
 s.resolution=v.ending.length<40?0:(has(RESOLVE,v.ending)?1:0)+(echoes>=2?1:0);why.resolution=s.resolution<2?(echoes<2?'ending does not answer the opening problem':'no clear win or change at the end'):'';
 // 8 Learning: sources used, beats cited, an explain-why task. Accuracy itself stays with validators and review.
 const cover=content?.sources?learningCoverage(content):{total:0,used:0,missing:[]};
 const cited=play.filter(b=>b.text||b.after).every(b=>b.cited);
 const covered=!cover.total||cover.used/cover.total>=0.75;
 s.learning=(covered&&cited?1:0)+(has(WHY,v.explain)?1:0);why.learning=s.learning<2?(!has(WHY,v.explain)?'no explain-why or what-if task':'some passages or beats are uncited'):'';
 const total=Object.values(s).reduce((a,b)=>a+b,0),weak=Object.keys(s).filter(k=>s[k]<2);
 const coreZero=CORE.filter(k=>s[k]===0);
 return {score:total,max:16,percent:Math.round(total/16*100),criteria:s,reasons:why,weak,coreZero,disclaimer,
  grade:total>=13&&!coreZero.length?'strong':total>=10&&!coreZero.length?'good':total>=7?'fair':'weak',
  fixes:weak.map(k=>({criterion:k,label:STORY_CRITERIA[k],why:why[k],fix:FIX[k]}))};
}
// A retry is worth its cost only when the story clearly fails to pull the learner forward.
export function needsStoryRetry(report){return !!report&&(report.score<10||report.coreZero.length>0)}
export function storyQualityLine(report){
 if(!report)return '';
 const label={strong:'Strong story',good:'Good story',fair:'Story needs work',weak:'Weak story'}[report.grade];
 const gaps=report.fixes.filter(f=>f.why).slice(0,2).map(f=>f.why).join('; ');
 return `${label} · ${report.score}/16${gaps?` · ${gaps}`:''}`;
}
function playerText(c){const out=[];const walk=(x,k)=>{if(NOT_SCRUBBED.includes(k))return;if(typeof x==='string')out.push(x);else if(Array.isArray(x))x.forEach(y=>walk(y));else if(x&&typeof x==='object')for(const [kk,vv] of Object.entries(x))walk(vv,kk)};walk(c);return out.join(' \n ')}
function norm(s){return String(s||'').toLowerCase().replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim()}

// ---- The storyArc plan the model returns alongside the game (never shown to players) ----------
const STR=max=>({type:'string',minLength:1,maxLength:max});
export const STORY_ARC_SCHEMA=Object.freeze({type:'object',additionalProperties:false,required:['dramaticQuestion','stakes','clock','mistake','beats','payoff'],properties:{
 dramaticQuestion:STR(200),stakes:STR(300),clock:STR(200),mistake:STR(300),payoff:STR(400),
 beats:{type:'array',minItems:1,maxItems:12,items:{type:'object',additionalProperties:false,required:['activity','learning','openLoop'],properties:{activity:STR(60),learning:STR(240),openLoop:STR(240)}}},
}});
export function validateStoryArc(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 const t=(v,n)=>typeof v==='string'&&v.trim()?v.trim().slice(0,n):'';
 const arc={dramaticQuestion:t(raw.dramaticQuestion,200),stakes:t(raw.stakes,300),clock:t(raw.clock,200),mistake:t(raw.mistake,300),payoff:t(raw.payoff,400),beats:(Array.isArray(raw.beats)?raw.beats:[]).slice(0,12).map(b=>({activity:t(b?.activity,60),learning:t(b?.learning,240),openLoop:t(b?.openLoop,240)})).filter(b=>b.activity&&b.openLoop)};
 return arc.dramaticQuestion?arc:null;
}

// The plan (story, storyArc) is never shown to players, and the reflection (question, debrief) is
// where the brief allows an analogy's limits to be stated, so neither is scrubbed or penalised.
const NOT_SCRUBBED=['sources','learningMap','storyArc','story','question','debrief'];
// ---- The learner's weak spot ------------------------------------------------------------------
// Does the story's early mistake take on the learner's weak spot? Compares word stems, so it is a
// check that the topic of the mistake matches, not a judgement of how well it is handled. It is
// only expected when the weak spot relates to this material.
const stems=s=>new Set(keyWords(s).map(w=>w.slice(0,5)));
export function weakSpotUse(content,target,mistake){
 if(!target)return null;
 const want=stems(target),material=stems(join((content?.sources||[]).map(x=>x.excerpt),(content?.learningMap||[]).map(x=>x.objective),playerText(content)));
 const relevant=[...want].filter(w=>material.has(w));
 if(relevant.length<Math.min(2,want.size))return {target:target.slice(0,200),relevant:false,used:null};
 const beats=storyView(content).beats,early=stems(join(content?.hook,content?.segments?.slice(0,Math.ceil(content.segments.length*0.6)).map(x=>x.text),beats.slice(0,Math.ceil(beats.length*0.6)).flatMap(b=>[b.text,b.after]),mistake));
 const hits=relevant.filter(w=>early.has(w)).length;
 return {target:target.slice(0,200),relevant:true,used:hits>=Math.min(2,relevant.length)};
}
export const WEAK_SPOT_FIX={criterion:'weakSpot',label:'Weak spot as the turning point',why:'the early mistake does not take on the learner\'s weak spot',fix:'Make the early try-fail mistake exactly the difficulty named in the learner details, made confidently by a character, failing visibly, then fixed by the evidence; never say it is anyone\'s weakness. Name it in mistake.'};

// ---- Deterministic repair ---------------------------------------------------------------------
// Only safe edits: remove disclaimer sentences from player text, and put the model's own planned
// open loops and dramatic question into the text when it forgot to. Each edit is kept only if the
// result still passes the format validator, so a repair can never break a playable game.
export function repairStory(content,{arc,validate}={}){
 const notes=[];let c=structuredClone(content);
 const tryEdit=(label,edit)=>{const next=structuredClone(c);if(!edit(next))return;try{if(validate)validate(next);c=next;notes.push(label)}catch{}};
 // 1 Disclaimers out of player text (sentence-level, keeping at least one sentence).
 const scrub=(obj,key)=>{const s=obj?.[key];if(typeof s!=='string'||!has(DISCLAIMER,s))return false;const kept=sentences(s).filter(x=>!has(DISCLAIMER,x));if(!kept.length||kept.join(' ')===s)return false;obj[key]=kept.join(' ');return true};
 tryEdit('removed disclaimer wording from player text',next=>{let any=false;const walk=x=>{if(Array.isArray(x))x.forEach(walk);else if(x&&typeof x==='object')for(const k of Object.keys(x)){if(NOT_SCRUBBED.includes(k))continue;if(typeof x[k]==='string')any=scrub(x,k)||any;else walk(x[k])}};walk(next);return any});
 if(!arc)return {content:c,notes};
 // 2 The dramatic question into the hook when the opening has no goal.
 if(typeof c.hook==='string'&&arc.dramaticQuestion&&!has(GOAL,join(c.hook))&&!c.hook.includes(arc.dramaticQuestion))tryEdit('added the dramatic question to the hook',next=>{next.hook=`${next.hook.trim()} ${arc.dramaticQuestion}`;return true});
 // 3 Planned open loops into the beat that should end on them.
 const keys=storyBeats(c).map(b=>b.key);
 for(const b of arc.beats){const i=keys.indexOf(b.activity);if(i<0||i===keys.length-1)continue;// the last beat resolves; it doesn't open a loop
  const slots=()=>storyBeats(c)[i].after.filter(([o,k])=>typeof o?.[k]==='string');
  if(slots().some(([o,k])=>norm(o[k]).includes(norm(b.openLoop).slice(0,40))||LOOP_END.test(lastSentence(o[k]))||has(LOOP_WORD,lastSentence(o[k]))))continue;
  tryEdit(`added the planned open loop after ${b.activity}`,next=>{for(const [o,k] of storyBeats(next)[i].after)if(typeof o?.[k]==='string')o[k]=`${o[k].trim()} ${b.openLoop}`;return true})}
 return {content:c,notes};
}

// The short line on review screens. Scored live from the draft being reviewed (so edits count),
// with what the server already did: safe repairs and the one guided revision.
export function storyQualityNotice(draft,{story,check}={}){
 if(!draft||!(draft.template||Array.isArray(draft.segments)))return null;
 const arc=check?.dramaticQuestion?{dramaticQuestion:check.dramaticQuestion,beats:[]}:(draft.story?.dramaticQuestion?{dramaticQuestion:draft.story.dramaticQuestion,beats:[]}:null);
 const report=scoreStory(draft,{story,arc}),gaps=report.fixes.filter(f=>f.why).slice(0,3).map(f=>f.why);
 const done=[check?.retry,check?.repairs?.length?`Fixed automatically: ${check.repairs.join('; ')}.`:''].filter(Boolean).join(' ');
 const head={strong:'strong',good:'good',fair:'needs work',weak:'weak'}[report.grade];
 return {warn:report.grade==='fair'||report.grade==='weak',report,text:`Story quality: ${head} (${report.score}/16).${gaps.length?` To strengthen: ${gaps.join('; ')}.`:''}${done?` ${done}`:''}`};
}
