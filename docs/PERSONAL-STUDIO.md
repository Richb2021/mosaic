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

The private Sites resource identity and the NoCodeBackend learner identity are separate. This release preserves the owner-private Site audience. It does not create school memberships or sharing. Video, cartoons and podcasts are future adapters; the profile's captions preference is stored for that work.

## Acceptance evidence

Root workspace `output/personal-studio/evidence/` contains the unit-test output, real API acceptance, independent audit and browser screenshots. Real NCB checks use synthetic learner accounts, preserve no credentials in artifacts, and verify isolation and stale-write rejection. Browser checks cover profile reload, source review, a starting check, practice correction, a saved reflection, an actual game run, save recovery and its return to the trail. See the final acceptance JSON for the exact tested scope and any environmental limits.
