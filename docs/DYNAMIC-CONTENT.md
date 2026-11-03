# From learning material to playable content

The Resource Library supports nine templates: RPG, 2D adventure, subject draft, town simulation, economic strategy, visual novel, quiz, football and merge/crafting. `src/game-modes/content-registry.js` is the authoritative registry. The same reviewed evidence can also support Explore lessons, question cycles, podcasts, cartoons and tutor guidance.

## Source and review workflow

Sign in through NoCodeBackend and complete the required invitation/onboarding. Authors import material, inspect extraction and review the exact source version. The [knowledge guide](KNOWLEDGE-PROGRAMME.md) describes supported formats, optional originals, URL allowlists and transcription. The [library guide](RESOURCE-LIBRARY.md) describes the 500-source capacity, pagination and ranked search.

Select up to twelve passages from three reviewed sources within 18,000 characters. Review the evidence packet and choose the learner context, goal and appropriate format. Muse Wonder returns bounded structured content. The server validates identity, schema, allowed solutions and citations; original excerpts are attached from the pinned evidence, never accepted as model-authored quotation text. Human review must check meaning, correctness, suitability and the relationship between each claim and its source before publishing.

The model changes story, examples, dialogue, questions and bounded scenario choices. Authored engines retain geometry, collisions, game rules, costs, animation/asset catalogues and executable code. A new content identity has its own saves. Manual revisions create a separate draft, preserve the original, and require another review; they do not call Muse or consume inference allowance.

## Ownership and personalisation

The server derives ownership from the verified NoCodeBackend identity. Sources and jobs belong to the resulting workspace; learners see explicitly assigned reviewed content. Client owner IDs or hosting-platform headers cannot confer access. Assignment grants recheck membership and source/content versions.

New generation receives bounded goals, interests, starting level, difficulties, context and accessibility preferences. The [adaptive support guide](ADAPTIVE-VOICE.md) describes response-based support and learner overrides. Existing published content is not silently rewritten. A programme can connect reviewed resources in multiple formats while retaining exact versions.

## Model and job lifecycle

The adapter uses `muse-wonder-1.0` Standard exclusively. Background requests store a provider response ID; later checks retrieve that response rather than submit another generation. Selected source excerpts and generated content are processed by Meta. This is not a zero-retention service.

Jobs move through queued, starting, running, review and published, or explicit failed/interrupted states. Request identities and conditional claims prevent duplicate submissions. An ambiguous acknowledgement remains interrupted and is not automatically retried: it may already have incurred provider usage. Provider IDs remain available for recovery. Media jobs use the separate [resilient processing workflow](PRODUCTION-TEACHING.md).

`WORKSHOP_GENERATION_LIMIT` controls the per-workspace rolling-day request allowance (default 10, zero pauses new requests, maximum 1000). Daily monetary allocation and global limits are separate. Edits and stored playback remain available without new inference. These are application controls, not the provider's own rate limits or an invoice.

## Deployment and verification

Runtime configuration and the migration away from Sites are documented in [DEPLOYMENT.md](DEPLOYMENT.md). Secrets belong only in the server environment. The private preview originally used Worker/D1/R2 hosting; NoCodeBackend now supplies application identity, not the old hosting-user header.

Run `npm test` and `npm run build` from the app repository. Test generated output through review, publication, actual play, save/reload and deletion with exact source/version checks. Synthetic fixtures verify contracts; real provider journeys and educator review answer different questions. No template guarantees factual accuracy or suitability for every subject.
