# Personal learning studio

Open `/studio.html` from the game library or account page. The studio connects the existing reviewed game catalogue to learner-controlled goals, a small starting check, source reading, practice, game play and reflection.

## Implemented

- Additive profile schema v2 stores goal, course/context, chosen level, interests, task difficulties, exam reference/date, time budget, format preferences and accessibility choices. Existing profiles receive defaults. The learner can revise these choices; they are not assigned an ability category.
- NoCodeBackend remains the identity and learner persistence provider. The existing `learner_profiles` table holds the `profile` and `studio` slots. No table or authentication migration was needed. The storage contract is in `ncb/storage-contract.json`.
- Find a topic shows the 17 included reviewed activities and valid owner-published packs from the existing private Sites workspace. The learner selects source-bound activities and confirms source review before creating a programme.
- A programme binds the exact canonical pack ID/hash and a server-loaded profile snapshot. Up to three existing reviewed questions provide an optional starting check. Unsupported formats use source reading and reflection; the planner does not invent diagnostic questions.
- The deterministic route explains its sequence and suggested support. Text-first/reduced-motion preferences make game play optional. Interests shape reflection prompts with an explicit analogy-limit question. Replanning preserves all recorded answers.
- Text practice offers remaining reviewed questions where available; first answers, uncertainty, confidence, repeated attempts, game observations and ungraded reflections remain distinct. Game XP is never converted to mastery.
- Materials supports document text extraction, review, upload and passage confirmation using the existing owner-only resource service. The workshop link pre-fills saved context, then uses the existing explicit Muse Wonder generation/review/publish workflow. New published packs can be refreshed into the catalogue.
- Guest programmes use device storage. Signed-in programmes use NCB compare-and-swap versions, with account isolation and explicit conflict recovery. Save failures are visible. Unknown or stale RPG links fail explicitly instead of silently opening another story.

## Scope and limits

The studio adapts support, order and reflection context. It does not rewrite game rules, claim personalised difficulty, certify an exam specification or perform consequential grading. All reviewed content remains inspectable. Suggested time and follow-up intervals are planning heuristics, not validated estimates of learning or retention. No profile change automatically invokes a model.

Programmes are limited to 12; each retains up to 3 starting answers, 80 practice attempts and a 2,000-character reflection. Export downloads the current profile and programmes. Removing a programme leaves its separate game saves and resources intact; older NCB versions are pruned best-effort by the existing adapter. Full account deletion/retention workflows remain separate product work.

The private Sites resource identity and the NoCodeBackend learner identity are separate. This release preserves the owner-private Site audience. It does not create school memberships or sharing. Creative learning adds source-bound Muse conversations, reviewed podcast scripts and captioned cartoons; see CREATIVE-STUDIO.md for exact capabilities and verification limits.

## Acceptance evidence

Root workspace `output/personal-studio/evidence/` contains the unit-test output, real API acceptance, independent audit and browser screenshots. Real NCB checks use synthetic learner accounts, preserve no credentials in artifacts, and verify isolation and stale-write rejection. Browser checks cover profile reload, source review, a starting check, practice correction, a saved reflection, an actual game run, save recovery and its return to the trail. See the final acceptance JSON for the exact tested scope and any environmental limits.

## Guided support (1 Nov 2026)

“Work through an idea” opens a source-bound notebook. Its sequence is an immutable first thought (or explicit uncertainty), an optional reviewed hint, exact activity source passages, an explicitly revealed reviewed explanation when available, an ungraded teach-back, and a learner self-check. Formats without a reviewed explanation remain source-only. The learner's writing is stored literally; no model generates a response or evaluates it. This is structured reviewed help, not live AI conversation.

All eight game formats link to the exact pack ID and content hash. Questions, draft scenarios, town council meetings and Underlight mechanisms select their current activity; general game navigation allows choosing an activity. Help opens in a new tab so the original game remains available. An unavailable or unpublished revision cannot silently resolve to a different chapter. A new programme still requires an explicit source review. Existing programmes resume their saved support.

Support is an optional bounded field in the existing NoCodeBackend `learner_profiles` studio slot, covered by the same verified learner identity, expectedVersion/CAS, export and programme removal. No database migration, additional endpoint or provider call was introduced. See `docs/ncb/storage-contract.json` for limits. Old programmes default to no guided support. A starting/practice answer submitted after using a clue/source/explanation is marked assisted by the server; later help does not rewrite a previous answer. First recorded game attempts do not establish unaided performance. Self-checks and completed text are never grades, mastery estimates or access gates.

Validation: `tests/guided-support.test.mjs`, real NCB API acceptance in `../scripts/check_guided_support_api.mjs`, and browser evidence in `../output/guided-support/evidence/`. These checks use synthetic learners; they do not establish production readiness for school accounts, retention/consent or an unrestricted AI tutor.

## Reviewed questions alongside an adventure

Reviewed four-stage question cycles now appear in the programme before the first answer is recorded. Recommendations bind the learner, exact game-content hash and selected activity; due revisits take precedence over unfinished, new and waiting cycles. An unreadable saved cycle is never advertised as an unanswered one. Drafts and withdrawn reviews stay out of recommendations.

A learner can try the starting question, choose “Not sure”, use help, or go straight to the game. The cycle records the original answer, confidence and in-cycle help separately in the existing NoCodeBackend learner-profile slots. Corrected game answers and XP do not replace that record or establish mastery. The existing fixed one-/three-day revisit schedule is unchanged; returning early does not reveal the later question or move its due date.

“Open the game” from a reviewed cycle adds a return link for that exact chapter version. “Return to learning” flushes pending game progress and reopens the exact reviewed question hash. Changing to another game hides that return link. The URL is local-only; ownership and review checks still run on the server. Reloading the question page resumes the saved cycle rather than silently choosing a different bank.

The current cycles remain private to the learner account that prepared them. This change does not distribute an organiser’s question banks through school assignments or claim unseen assessment when a learner has reviewed the answer key. Those are separate product flows. Each prepared bank covers its stated focus, not necessarily every concept in a larger course objective.
