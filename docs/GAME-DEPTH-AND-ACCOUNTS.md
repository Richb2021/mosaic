# Game depth, learner accounts and reviewed copies

This phase adds NoCodeBackend sign-in and cloud progress for the seven illustrated game formats, expands four game loops, and lets a creator revise a stored chapter without changing the original. The existing private Sites audience remains in place. It is still a bounded learning-game platform, not an unrestricted game generator or a complete school management system.

## The four expanded journeys

| Game | Current default journey |
| --- | --- |
| Quiz expedition | An eight-star branching map. Route choices change which stars become reachable. Two lenses remove untried false answers; supply stars replenish them. Corrected and assisted attempts remain distinct. |
| Tactical football | Six possessions, three formations, six stamina, seeded opponent styles and shifting defenders/keeper. Passes, feints, shot power and counterattacks have visible consequences. Corrected answers still allow goals. |
| Crafting | Six progressively unlocked commissions, a 16-slot board, click/keyboard combinations, drag support, recycle and undo. A finite-material challenge allows the full recipe cost plus eight spare pieces. Fraction pieces show eighths of the same whole. |
| Visual novel | Six authored scenes and two endings, scene artwork, source passages kept in a notebook, and read-only previous route histories. Up to twelve paths can be explored in one journal. |

New journeys have separate content-bound save keys. Earlier classic runs remain available from the library when a save exists and through the guide. Generated packs retain their established schemas; the engine supplies the new mechanics. Uploaded or model-generated content cannot supply executable logic or arbitrary asset URLs.

Suno music and small interaction cues are opt-in. Playback stops when the game is destroyed or the page is hidden. Sports uses the existing male/female idle and walking sheets; dedicated football running, kicking and celebration animation is still a future art task.

## Learner identity and progress

`/account.html` uses NoCodeBackend email/password authentication and its maintained `@nocodebackend/account-react` account component. Profile and signed-in device controls use the provider component. Google, Apple and email OTP controls appear only if enabled by the provider; they are currently disabled. Password reset is implemented, but delivery of a real reset email has not been verified.

The active EU instance is `34968_mosaic_learning`. Runtime credentials exist only in the server environment. Two application tables store validated preferences and game snapshots. The earlier empty storage-only instance is retained unused. The exact contract and active schema are in `docs/ncb/`.

Every cloud request derives its owner from the verified NoCodeBackend session. A tab's learner ID must also match that session, preventing stale tabs from syncing an earlier account's data after an account switch. Device keys are separated by account; guest saves stay separate. Signing in does not silently import guest progress.

Saves are bound to the exact game, play kind and content hash. For the illustrated formats, the server replays legal actions against canonical included or reviewed/published content. RPG snapshots instead undergo bounded canonical-state validation and supply no competence observations. Client-supplied scores, owner IDs and completion flags are not trusted. A unique owner/slot/version constraint resolves simultaneous writes. After insertion, bounded polling handles provider read lag without resubmitting the write. Cloud/device conflicts require an explicit choice, and restoring cloud progress keeps the earlier device record as a recovery copy.

The journal retains up to 100 game slots. Suggestions can continue unfinished work, revisit supported questions or offer a different activity using the same source passage. Matching passages do not imply identical coverage. Preferences prefill the next creation form and never trigger generation. These are practice observations, not grades, diagnoses, learning-style labels or evidence of mastery.

**The RPG now supports account cloud snapshots; see [the next-phase contract](LEARNING-NEXT.md).** Resource and generation records still belong to the existing private Sites workspace in D1. Learner accounts have not converted that library into a public multi-tenant resource service.

## Safe chapter corrections

From a stored chapter, choose **Revise a copy**. The structured editor changes narrative, questions, explanations, answers and bounded game values. Identity, source excerpts, source references and asset identifiers remain fixed. A review preview validates the entire result.

Saving creates a separate, unpublished draft with a new content identity and a link to the original. The server checks the original hash, source bindings, owner and complete game validator. An idempotency key avoids duplicate copies after a lost acknowledgement. The original chapter and its saves remain usable. The new copy must pass the existing exact-hash publication review before it can be used as canonical cloud content.

A revised copy does not call Meta. It shares the existing ten stored-draft requests per day; no quota was increased and no D1 migration was added. This workflow is for factual or teaching corrections within a reviewed packet. New sources require the normal source review and generation flow.

## Verification and remaining work

The phase evidence is retained in the parent project's `output/game-depth/evidence/`. Actual browser journeys reached all eight quiz stars, both novel endings/all six scenes, a six-possession 5:1 match and all six crafting commissions using 18 of 26 available materials. Tests also cover seeded variations, every quiz route, legal history replay, corruption handling and completed adventure/draft/town learning adapters.

Real NoCodeBackend requests verified sign-in, account isolation, save restoration, simultaneous-write conflict handling, session revocation and logout. Browser checks covered account/profile controls, guest isolation, sign-out/sign-in restoration, mobile layouts and the revised-copy review-to-play path. The revision browser fixture is explicitly authored local QA content, not a claimed fresh Muse generation.

The wider product still needs longer story and adventure campaigns, stronger football AI and sport-specific art, broader simulations and subject-fit trials. PDF/Word/PowerPoint/caption text extraction and concept-guided practice are implemented in the next phase; OCR and semantic retrieval remain separate. Fresh live merge generation was not performed in this phase; existing provider quotas remain intact. Human learner/teacher trials are still needed to assess engagement, comprehension and accessibility beyond the tested journeys.
