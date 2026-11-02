# Course workspace and learner entry

The Studio now connects an organiser's course notebook to the existing reviewed-source workshop and the learner's personal programme. `#courses` is **My courses** for admitted adult authors and **Assignments** for managed learners. `#today` prioritises an available revisit or the saved active programme.

## Organiser journey

1. Create a course, then topics with a clear learning goal.
2. Add notes or a supported document; check the extracted passages and mark the source reviewed. Link it to a topic, or reuse an owned source.
3. Find exact source passages using word-based search across the reviewed topic sources or the owned library. Unreviewed results are labelled. Search ranking is not a claim of evidence coverage.
4. Prepare a chapter inside the topic. The existing Muse Wonder request, job polling, evidence checks and human teaching review remain authoritative. Reopen existing drafts and revise copies through the same workshop.
5. Link the reviewed chapter to the topic. Use a published chapter for personal learning, or select active learners in the organiser's group and assign that exact version.

A learner's assignment introduction includes the hook and objectives. Starting an assigned programme checks a real, active, exact-version server grant; the learner does not have to tick the author's source-review checkbox. Each learner keeps their own programme, attempts and saves.

Starting personal learning from a course uses that topic's goal for the new programme. Assigned starts derive a goal from the chapter's reviewed concept objectives. This does not overwrite the account's saved preferences or change older programmes; an existing programme continues with its own saved context.

## Data contract

- NoCodeBackend `learner_profiles`, slot `courses`; no new table or schema migration.
- Expected-version writes use the existing owner-scoped CAS adapter and data epoch guard.
- Maximum 12 courses, 16 topics per course, 12 source and 12 chapter references per topic, 48,000 serialized characters in the notebook. Existing source-library maximum remains 40.
- Resource links bind to the server's SHA-256 checksum; chapters bind to the exact server draft digest. Missing or changed content is explicit. Removing a notebook link does not delete sources, assignments or learning records.
- Export, learner deletion, account closure and retention already enumerate every profile slot, so notebooks use those same controls.
- Course API requires verified account identity, admission and completed onboarding; managed learners cannot mutate or read the author's notebook. The catalogue exposes only assigned published content, not the author's source collection.
- New assignment grants carry a canonical draft hash. Historical unhashed grants retain their earlier compatibility behavior until explicitly reassigned.

## Validation scope

The course acceptance harness uses two real NoCodeBackend accounts and isolated local D1. Memberships and an already-generated chapter are explicitly seeded local fixtures; it does not claim a fresh email verification or AI inference. Normal APIs exercise source review, course persistence, stale writes, authorisation, exact-version assignment, learner programme creation, game save, fresh-session restore and export.

The browser evidence and production result are recorded in `output/course-workspace/evidence/` at the workspace root. The mission gate also runs the repository tests and production build. Existing real Muse generation and eight-game verification evidence remains in the earlier phase directories.

## Remaining boundaries

This is a bounded course notebook and lexical passage finder, not a semantic search engine or a formal curriculum map. Scanned documents still need reviewed text; OCR, diagram and equation extraction, large-library pagination, curricular standards alignment, group-level reporting and bulk term planning are later work. The Site audience remains private to its owner. No new email service, provider model or billing arrangement is introduced here.
