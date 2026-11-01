# Four further game formats

The library now contains eight formats: the existing 3D RPG, 2D adventure,
subject draft and town simulation, plus these four bounded engines. Each new
engine has two playable authored subjects and uses the existing private source
upload, human review, Muse Wonder generation, canonical publication and import
workflow. These are working browser games; they are not unrestricted game
generation or a complete school learning-management system.

| Format | Runtime | Authored subjects |
| --- | --- | --- |
| `novel-v1` | Six branching conversations, two endings, decision journal | Water cycle; industrial change |
| `quiz-v1` | Eight untimed questions, stable shuffled options, feedback and retries | Water cycle; food webs |
| `sports-v1` | Six knowledge huddles and tactical football possessions | Fractions; food webs |
| `merge-v1` | 4×4 crafting board, two unlimited bases, six recipes, three deliveries | Same-whole fraction addition; food-web study panels |

## Authored mechanics

Novel nodes use the fixed forward-only table in `extended-content.js`. Each
decision records an immediate consequence before moving to the next scene.
Every path terminates, both endings are reachable, and the journal contains only
visited decisions. Topic text must make sense at branch joins.

Quiz answers use canonical indices beneath a seeded presentation order. A wrong
option gives its own feedback and becomes unavailable; the learner can retry.
Progress requires a correct answer. The report separates first-attempt success
from corrected responses and makes no mastery claim. The first six authored
questions establish concepts; the last two apply them to examples.

Football is an untimed tactical game, with a knowledge question before each
possession. First-attempt correctness adds one insight to shot power; corrected
answers still unlock play. Each possession starts with five stamina. A wing pass
costs one and advances one zone; a centre drive costs two and advances two zones.
A blocked lane costs stamina without advancing. The defender shifts after each
action. A shot costs one stamina: power is zone plus insight; an open lane needs
three and the keeper's lane needs four. Exhausting stamina ends the possession.
On possessions two and five, failing to reach zone three permits one opponent
counter goal. These numbers are authored fictional rules, not factual sporting
predictions. Ball motion answers a player action and respects reduced motion.

Crafting uses a finite 16-slot board. Item indices zero and one are unlimited base
tokens. Recipe `r` produces item `r + 2` from two earlier indices; duplicate input
pairs are rejected. This acyclic contract ensures every item is constructible.
Orders consume one or two target items. Recycle frees a slot; Undo reverses any
action, including a delivery. A 2,000-action record limit remains recoverable
through Undo or Restart. Illustrations are symbols: topic packs must explain
conceptual composition, not assert false chemical or biological transformations.

## Content and persistence boundaries

`extended-content.js` contains strict model schemas, prompts and the shared
validator. Model output configures text, cited questions, choices and bounded
recipes; it cannot provide code, URLs, assets, formulas or new engine rules.
Canonical source excerpts come from the server's reviewed packet, not the model.
All eight formats are explicitly dispatched in generation, validation, review,
library selection and mounting; no unsupported template falls through to another
game.

Saves are browser-local action histories bound to identity, revision, seed and
content hash. Loading replays legal transitions to reconstruct scores, inventory
and progress. Saved balances or completion flags are never trusted. Restart is
confirmed in the game; changing source content gives it a different save key.
Storage failure is visible without preventing play. This is progress storage for
the local game, not a trusted assessment record.

Teacher/creator review remains necessary for factual accuracy, meaningful
questions, branch coherence and recipe analogies. Structural validation is not
semantic validation. The existing source uploader still accepts TXT/Markdown;
PDF/Word ingestion remains outside these four game additions.

## Design and assets

The interfaces share Lanternbound's navy, brass and painted late-1990s world,
with distinct layouts for conversation, retrieval, football and crafting. The
asset manifest at `public/game-modes/extended-art/manifest.json` holds four
backgrounds, three transparent portraits and eight symbolic icons. All 15 new
Sorceress jobs completed; seed and gear icons reuse prior project art. No remote
asset paths are supplied by imported or generated packs.

The four-panel image concept and actual game screenshots are retained in the
parent project's `output/remaining-games/` directory; the concept is also in the
existing MagicPath project. Research notes retain Firecrawl job receipts and
distinguish authored teaching paraphrases from short primary-source quotations.

## Verification

Run `npm test` and `npm run build` from this app. Focused tests cover every novel
route, canonical answers, retries, all game completions, tactical scoring and
exhaustion, merge quantities/full-board recovery/undo, corrupted histories,
review rendering, schema identity and private cross-template API publication.
The parent task additionally retains actual desktop/phone journeys, screenshots,
independent audit findings and real Muse Wonder generation evidence. Use
`scripts/verify_remaining_games.py` in the parent workspace for release evidence
acceptance; passing unit tests alone is not a complete release check.
