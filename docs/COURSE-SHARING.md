# Learner-controlled course sharing

An organiser assigns a complete reviewed course route to an active learner in their group. Every objective must link to a published chapter with its exact SHA-256 version; the route and reviewed sources are checked again on access. An assignment is a reference to authored content, not a copy of a learner profile.

The learner sees an ordered route and can open its games. Sharing starts off. They may explicitly submit `not-started`, `started` or `practised`, plus a help request, for each objective. Editing controls alone sends nothing. Every submission requires its own checked confirmation. These are self-reports, not grades or mastery evidence. Private answers, tutor conversations, interests, scores, confidence and private programme state are excluded.

The organiser's Courses screen shows only these chosen updates and the last sent time. Missing, expired or unavailable reports never become zero activity. Reports are paged in groups of twenty; a learner can have twenty-four active course bindings. Withdrawn assignments are excluded from the learner's route list. The overview keeps assignments withdrawable even when their notebook course was removed.

## Storage and concurrency

No new table or migration. Existing D1 `data_controls` holds exact course grants and consent receipts; existing NoCodeBackend `learner_profiles` stores reports in owner-scoped JSON slots. The `course-report:` prefix plus lossless base64url SHA-256 identity is 57 characters, within NCB's existing 64-character key column. Authentication remains NoCodeBackend.

Enabling sharing reserves an off receipt, writes a versioned NCB report, then conditionally commits the matching receipt. Failed or unacknowledged writes never enable sharing. Turning off changes the receipt without requiring a report read; it wins over earlier in-flight updates. Source-workspace and recipient cleanup leases cover cross-account reads and writes. Membership changes invalidate both learner and organiser bindings, even if later restored. Replacement of a reviewed route requires the old revision and resets consent.

## Deletion, export and retention

Learner export contains their own NCB reports, public course binding and effective consent. Organiser export contains their own assignment metadata, not other learners' private consent tokens or NCB rows. Deletion previews include assignment and sharing-setting counts. Removing a source or plan cascades unusable bindings and visibility consent, while preserving recipients' private reports and saves. The normal learner deletion and progress-retention policy removes those NCB rows; expired or stranded consent is cleared under the cleanup lock. Audit events are content-free.

## Acceptance

`node --test tests/course-sharing.test.mjs` exercises role isolation, exact reviewed versions, opt-in/out races, membership revoke/restore/reassignment, assignment withdrawal, NCB unavailability, export/deletion, retention, source cleanup leases, capacity, key length and version replacement. Full-suite and browser evidence is recorded in the parent workspace's `output/course-sharing/` and `task-state.json`.

Real-service acceptance uses two disposable NoCodeBackend identities, normal auth and persistence APIs, isolated local D1 membership and pre-reviewed plan/chapter fixtures. Those fixture chapters are reused game content: this checks delivery and reporting, not pedagogical alignment or new Muse generation. Screenshots are labelled test evidence. The accounts and their stored content are closed after verification. Production remains owner-private.
