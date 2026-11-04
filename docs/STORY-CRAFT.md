# Story craft: stories learners can't put down

Every AI-written story in Mosaic (RPG chapters, game-library games, cartoons and podcasts) should make the learner want to know what happens next, and make the learning the only way to find out. This page lists the techniques we use, where they come from, how each format and age band applies them, and how the server checks and fixes a weak story.

Code: prompts in `src/story-direction.js` (`ANTICIPATION`, `FORMAT_ARCS`, `AUDIENCE_SUSPENSE`, `storyArcBrief`), checks and repairs in `src/story-quality.js`, the one guided retry in `server/story-retry.js`.

## The techniques

Each technique is written into the prompt, and each one has a check (next section).

| # | Technique | What we ask the model for | Why it works | Sources |
|---|---|---|---|---|
| 1 | **Hook with a dramatic question** | In the first two sentences, a named character wants something concrete and something is already going wrong. No "Welcome to…", lesson framing or definitions first. | The opening event has to hook the audience emotionally and rationally, and it has to be a dynamic event, not a static situation. Suspense is an open question hanging over the reader: "what's going to happen next?" | B1 p.188, p.201; B2 p.181; B4 *Story Hooks*; B8 p.60; W16 |
| 2 | **Stakes and a ticking clock** | Say what is lost if they fail, give an in-story deadline, and tighten it each beat. | Suspense grows when the stakes are raised; start subtly so there is somewhere to build. "What happens if they don't succeed?" The midpoint raises stakes, often with a ticking clock. | B2 p.184, p.189; W11 rule 16; W13 |
| 3 | **Curiosity gap: learning is the key** | Before each learning beat, show a puzzle, anomaly or locked thing the learner can't yet explain; the idea in that beat explains or unlocks it. | Interest comes from withholding information, not giving it. A gap in what we know is something we want to close; curiosity is "anomaly + potential benefit". Curiosity is a felt gap in knowledge (W1); people remember answers they were curious about better, even a day or weeks later (W2, W3). When the learning *is* the game mechanic, children learn more and play longer than with an end-of-level quiz (W18), because players learn what the task makes them attend to (W20); in Crystal Island the plot cannot end without the science (W19). | B1 p.334, p.352; B4 *Secrets & Puzzles*, *Curious Tales* (PDF p.18); W1–W3, W18–W20 |
| 4 | **Open loops between beats** | After each beat's consequence, end on a fresh unanswered question or small cliffhanger that only the next idea can resolve. Don't close every thread before the finale. | The penultimate climax should sharpen the main question ("now what's going to happen?"); curiosity drives the story forward. Cliffhangers leave a character in unresolved danger, a dilemma or a revelation at the end of an instalment (W5). Close threads in the reverse order you open them, or tension drops (W9). Note: the popular claim that unfinished tasks are *remembered* better (Zeigarnik) did not hold up in a 2025 meta-analysis; what does hold is a tendency to *resume* interrupted tasks (W4). We use open loops for pull, not as a memory aid. | B1 p.224, p.352; W4, W5, W9 |
| 5 | **Try, fail, learn** | An early attempt uses a plausible misconception and fails visibly (yes-but / no-and); the learned idea turns it round. | Stories need reversals, and audiences go numb if every scene is at full volume. A balanced game teaches through a gap between what the player knows and what the challenge demands. At each transition: "yes, but" (it works, new complication) or "no, and" (it fails, worse) (W7). | B1 p.217, p.221; B6 p.92–93; W7 |
| 6 | **Setup and payoff, nothing wasted** | Plant one object, clue or line early that pays off at the climax only when a character uses the idea, said in plain words ("because…"). Every subplot, gadget and side character sets up the payoff or carries the learning. | Foreshadowing arranges early events to prepare later ones; in a well-designed story the answers have been quietly layered in. "It's wrong to make promises you don't mean to keep" (Chekhov, W8); plot is promises, progress and payoff (W6). In Crystal Island an exciting subplot that didn't serve the learning raised engagement with the story but not with the science ("seductive details", W19), so every subplot must set up the payoff or carry the idea. | B1 p.199, p.234; B3 p.237–238; W6, W8, W10, W19 |
| 7 | **Satisfying resolution** | Answer the opening question with the same goal words and a concrete image of what changed. One small playful question may stay open. | The ending gives the audience what it wants, but not in the way it expects; leaving one small question beyond the main plot keeps the story alive afterwards. The story spine ends "until finally… and ever since then" (W11, W12). | B5 p.55; B3 p.225; W11, W12 |
| 8 | **Fair tension** | The answer is always reachable from the evidence; help never costs the learner the story. No real-time learning deadline (existing rule). | Suspense that feels manipulated, drags on without release, or depends on characters being "too dumb to live" makes readers tune out. Players who are bored or overwhelmed stop playing. | B2 p.194; B9 p.177 |

Existing rules stay in force and win any conflict: learning drives the plot (`LEARNING_IN_PLOT`), interest and style must shape the story (`styleDirection`), audience voice (`AUDIENCE_GUIDE`), no disclaimers in player text (`PLAYER_TEXT_RULE`), Mira and Kit are adults in their early twenties, and characters are always original.

## By format

The arc has to fit each format's fixed structure. These are the `FORMAT_ARCS` in the prompt; "after a correct answer" names the exact field the learner sees, which is where the open loop goes and where repair writes it.

| Format | Arc | Open loop lives in |
|---|---|---|
| RPG chapter (`underlight-v1`) | The waterworks are failing now and the gardens and homes lose out by nightfall. route → balance → transfer are three escalating faults. The aftermath answers the hook. | each challenge's `explanation` (shown when solved) |
| Adventure | Hook gives goal and clock; each room's clue points to the next place; sequence reveals the last fault; repair sets up the final choice; both endings turn on the idea. | room `clue.text`, `sequence.success`, `repair.success` |
| Quiz | An expedition with one goal and a clock; each question opens on a scene problem; questions 7–8 are the climax; the debrief asks why. | the correct option's `feedback` (consequence first, then the next mystery) |
| Sports | One match with a score and minutes left; each possession is a turning point; the last decides the match. | the correct option's `feedback` |
| Visual novel | Six choices under pressure; each consequence creates the next problem; both endings answer the question differently. | each choice `consequence` |
| Town / Economy | One looming problem with a date (town) or a season goal and a rival (economy); events follow from the last decision. | each choice `explanation` |
| Draft | A season building to a final; each scenario is a sharper crisis. | scenario `explanation` |
| Crafting (merge) | Three orders tell one story against a deadline. | order `purpose` |
| Cartoon (~3 min) | Cold open with trouble in line one → question and deadline by segment 2 → confident try fails → mid-point reversal on a question → discovery → payoff using the idea → callback joke. | the segment lines themselves (about a third should end open) |
| Podcast (audio drama) | Open mid-scene with a sound or line of trouble; every line advances the plan or raises a question; mid-point setback; discovery; payoff; callback. Every clue must be audible in dialogue. Radio has the fastest switch-off rate, so hit the ground running and give each voice its own grammar (W14); a cold open drops into the action and forces a question the listener needs answered (W15, W16). | the segment lines |

### Example tied to learning (food webs, sports, primary)

- **Hook:** "Ten minutes to the Food-Web Cup final and Pippa's tactic board is blank — Riverside are already warming up!"
- **Curiosity gap:** "Pippa's arrows point at the fox. Every pass goes backwards. Why?"
- **Learning beat → consequence:** the learner picks "arrows follow energy from the food to the eater"; feedback: "The pass clicks from grass to rabbit and Rovers surge forward!"
- **Open loop:** "…but Rafa's bear is coming down the wing. It eats plants *and* rabbits — where does its arrow go?"
- **Payoff:** "Because energy flows from producers up the chain, Pippa's loop of passes beats Riverside on the final whistle."

## By audience band

| Band | Humour and voice (`AUDIENCE_GUIDE`) | Suspense (`AUDIENCE_SUSPENSE`) |
|---|---|---|
| Primary (5–11) | Short sentences, warmth, playful names, slapstick and wordplay; characters stay kind. | One clear question, playful cliffhangers ("but where did the wrench go?"), mild peril that resolves quickly and safely, a cosy ending. |
| Secondary (11–16) | Wit, banter and a little irony; real stakes and rivalry. | Real rivalry, a reversal the learner can see coming if they read the clues, dramatic irony (the learner knows something a character doesn't). |
| Adult | Dry humour, sharper stakes, no childish framing. | Sharper consequences and trade-offs, an uncomfortable dilemma, understatement instead of exclamation marks, an ending that respects ambiguity. |

Cartoons and podcasts have no audience picker, so the band comes from the learner's stage (`audienceFromStage`).

## Checking every story

`scoreStory` (in `src/story-quality.js`) reads only player-facing text, so stored drafts from before this work can be scored the same way. It scores eight criteria 0–2, for a total out of 16:

| Criterion | 2 means | Main signals |
|---|---|---|
| Hook | Trouble and a character in the first two sentences, not a lesson opener | trouble words, sound effects, `!`/`?`; "Welcome to…", "In this lesson…" score 0 |
| Dramatic question | A goal plus an obstacle or deadline early, or the plan's question visible in the opening | goal phrases, clock/stakes words, `storyArc.dramaticQuestion` |
| Rising stakes | What's lost, a clock, and escalation in the second half | stakes/clock/escalation words |
| Open loops | At least half the beats (a third for cartoons and podcasts) end open after a correct answer | final sentence ends `?`, `…`, `—`, or on "but", "still missing", "won't budge"… |
| Payoff | Correct answers change the story, and the ending turns on the idea | consequence verbs; ending uses ≥2 source concept words with "because/so/thanks to" |
| Voice | Two or more named characters and audience-fit sentence length and humour; 0 with a disclaimer | names, average sentence length, humour markers |
| Resolution | The ending answers the opening with a clear win or change | resolution words; ending repeats the hook's goal words |
| Learning | Most passages used, every beat cited, and an explain-why/what-if task | `learningCoverage`, `sourceRefs`, why/predict wording |

Grades: **strong** 13+, **good** 10–12, **needs work** 7–9, **weak** under 7. Strong and good also need none of the four core criteria (hook, question, open loops, payoff) at 0. Accuracy itself is still checked by the existing validators, exact citations and teacher review; the checker doesn't judge facts.

### Structured plan

Games return a `storyArc` with the game: `dramaticQuestion`, `stakes`, `clock`, `payoff`, and per beat the `learning` that resolves it and the `openLoop` line. Cartoons and podcasts add `dramaticQuestion` and `clock` to their existing story outline. The plan is kept beside the game in the job record, never inside the playable game, so every existing validator, player and published game is unchanged.

### Repair, retry, warn — never drop

1. **Safe repair** (always): remove disclaimer sentences from player text (never from the reflection or debrief, where an analogy's limits belong), add the model's own planned dramatic question to a hook with no goal, and add its own planned open loop to a beat that forgot it. Each edit is kept only if the game still passes its validator.
2. **One guided retry** (only if the repaired story still scores under 10, or a core criterion is 0): the first draft goes back to the same model with the exact fixes. It has its own cost receipt (`<job>:story-retry`) inside the same daily caps, and is skipped if the budget is full. Operators can turn it off with `STORY_RETRY=off`.
3. **Keep the better draft**: the revision wins only if it scores higher. If it fails, times out, scores lower or can't be sent, the first draft goes to review with a note saying so.
4. **Warn the author**: the review screen shows "Story quality: good (12/16). To strengthen: …", scored live from the draft being reviewed, plus what the server already fixed.

A generation is never silently dropped or rejected for story quality.

## Results (4 November 2026)

Scored with the same final checker. "Before" is every story draft stored in the live and staging databases (read-only), "after" is eight real `muse-wonder-1.0` generations on staging with the new prompts, on the same food-web sources.

| Set | n | Mean /16 | Hook | Question | Stakes | Open loops | Payoff | Voice | Resolution | Learning |
|---|---|---|---|---|---|---|---|---|---|---|
| Before: all stored drafts | 47 | 9.4 | 1.04 | 1.26 | 1.66 | 0.62 | 0.89 | 1.23 | 1.32 | 1.36 |
| Before: recent story-styled drafts | 11 | 11.5 | 1.73 | 1.91 | 1.82 | 0.45 | 0.82 | 1.82 | 1.45 | 1.55 |
| After: new staging runs | 8 | 14.5 | 1.88 | 1.88 | 2.00 | 1.88 | 1.50 | 1.50 | 2.00 | 1.88 |

After-runs: sports (football, primary) 15, quiz (anime, secondary) 16, adventure (comic, primary) 15, visual novel (sports, adult) 14, RPG chapter (anime, secondary) 15, crafting (video game, adult) 14, podcast (football) 13 after one guided revision, cartoon (anime) 14. All eight graded strong; before, 4 of 47 were. Cost on staging: about $0.86 for all nine requests (the one revision cost about $0.06).

Replay: all 47 stored drafts pass through validation, repair and scoring with no errors and none lost; 11 had disclaimer sentences removed from player text.

What testing changed: the first podcast ended almost every line on "but—" and the checker rewarded it, so the prompt now asks for two or three varied open endings in spoken scripts and the checker marks a "but—" habit down. A text bug that hid second-half escalation was also fixed.

Limits: the checker uses word patterns, so it measures signs of good craft, not craft itself; the prompts were written to the same rubric, so the after-scores also reflect that. Read the outputs too (raw runs are kept outside the repo). It does not judge factual accuracy.

## Sources

Private library (design reference only; passages were not sent to any external service or to the model):

- **B1** Robert McKee, *Story: Substance, Structure, Style, and the Principles of Screenwriting* (scanned copy), PDF pp. 188, 199, 201, 217, 221, 224, 234, 334, 352.
- **B2** *The Everything Guide to Writing Your First Novel*, PDF pp. 181, 184, 189, 194.
- **B3** Martha Alderson, *The Plot Whisperer*, PDF pp. 159, 225, 237–238.
- **B4** *Storyteller Tactics* cards: Secrets & Puzzles, Story Hooks, Five Ts; Storyteller Tactics PDF p. 18 (Curious Tales).
- **B5** *Edito* booklet, PDF p. 55 (the ending; William Goldman's advice), p. 17 (plot check).
- **B6** *Polished Game Development: From First Steps to Final Release*, PDF pp. 92–93 (balancing is about education).
- **B7** *Pattern Language for Game Design* (2021), PDF p. 275 (greater choice requires greater motivation).
- **B8** White Label Comedy, *Selling With Story* slides, PDF p. 60 (hone the hook).
- **B9** *Advanced Game Design: A Systems Approach* (2018), PDF p. 177 (arousal and attention).

Public web sources (retrieved with Firecrawl via FuseBase Work on Baldur; raw results in `output/story-craft-research/` in the Hackathon folder):

Each was fetched in task-bound Firecrawl batches; task IDs PC31E8-267 (curiosity), -268 (plot craft), -269 (structure and audio), -270 (learning in narrative). "Partial" means only the abstract or part of the page was retrieved, and we cite only what was retrieved.

- **W1** Loewenstein (1994), *The Psychology of Curiosity*, Psychological Bulletin 116(1). Partial (abstract only). https://www.cmu.edu/dietrich/sds/docs/loewenstein/PsychofCuriosity.pdf
- **W2** Gruber, Gelman & Ranganath (2014), *States of curiosity modulate hippocampus-dependent learning*. Partial (abstract). https://pubmed.ncbi.nlm.nih.gov/25284006/
- **W3** Kang et al. (2009), *The wick in the candle of learning*, Psychological Science 20(8). Partial (abstract). https://pubmed.ncbi.nlm.nih.gov/19619181/
- **W4** Ghibellini & Meier (2025), *Interruption, recall and resumption: a meta-analysis*. https://www.nature.com/articles/s41599-025-05000-w
- **W5** Cliffhanger (Wikipedia). https://en.wikipedia.org/wiki/Cliffhanger
- **W6** Brandon Sanderson, *2025 Guide to Plot*, lecture 2. https://www.brandonsanderson.com/blogs/blog/brandon-sandersons-2025-guide-to-plot-lecture-2
- **W7** *Try-Fail Cycles: the "Yes, but" or "No, and" method* (Go Teen Writers). https://goteenwriters.com/2013/07/30/try-fail-cycles-the-yes-but-or-no-and-method-to-creating-plot-twists/
- **W8** Chekhov's gun (Wikipedia). https://en.wikipedia.org/wiki/Chekhov%27s_gun
- **W9** Writing Excuses 16.40, *Nesting Threads in the M.I.C.E. Quotient*. https://writingexcuses.com/16-40-nesting-threads-in-the-m-i-c-e-quotient/
- **W10** Foreshadowing (Wikipedia). https://en.wikipedia.org/wiki/Foreshadowing
- **W11** *Pixar's 22 Rules of Storytelling* (Aerogramme). https://www.aerogrammestudio.com/2013/03/07/pixars-22-rules-of-storytelling/
- **W12** *Back to the Story Spine* (Aerogramme). https://www.aerogrammestudio.com/2013/06/05/back-to-the-story-spine/
- **W13** Save the Cat, *15-beat sheet guide*. https://savethecat.com/get-started
- **W14** BBC Writers, *Writing Radio Drama*. https://www.bbc.com/writers/resources/tips-and-advice/writing-radio-drama
- **W15** The Podcast Host, *Is there a set podcast opening format?* (cold opens). https://www.thepodcasthost.com/storytelling/cold-opens/
- **W16** Descript, *How to write a cold open that will hook listeners*. https://www.descript.com/blog/article/how-to-write-a-cold-open-that-will-hook-listeners-from-the-start
- **W17** Green & Brock (2000), *The role of transportation in the persuasiveness of public narratives*. Partial (abstract). Absorption in a story (transportation) is measurable and shifts beliefs toward the story; a fact or fiction label made little difference. https://pubmed.ncbi.nlm.nih.gov/11079236/
- **W18** Habgood & Ainsworth (2011), *Motivating children to learn effectively: exploring the value of intrinsic integration in educational games*. Partial (ERIC abstract and a 2015 paper). https://tca2.education.illinois.edu/docs/librariesprovider23/default-document-library/j-of-the-learning-sc-2011-habgood.pdf?sfvrsn=c838d23d_2
- **W19** Lester, Rowe & Mott (2013), *Narrative-Centered Learning Environments*. https://public.intellimedia.ncsu.edu/pubmgr/pubdb/pdfs/lester-etc-2013.pdf
- **W20** Cutting & Iacovides (2022), *Learning by doing: intrinsic integration directs attention to increase learning in games*. https://eprints.whiterose.ac.uk/id/eprint/189921/1/LearningByDoingCuttingAndIacovides090822.pdf

Research results and evidence claims are as the sources state them; they support the design choices but do not promise any engagement or learning outcome for Mosaic.
