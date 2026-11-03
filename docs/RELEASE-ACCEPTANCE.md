# External learner release acceptance · 3 November 2026

This pass checks the existing individual, school and family release paths. It
does not widen the Site audience, assert accessibility conformance, or establish
classroom-scale capacity. At this milestone the site was owner-private; NoCodeBackend
admission remains a separate application boundary. See [current deployment](DEPLOYMENT.md) for the later external-hosting migration.

## Corrections

- Single-chapter assignments now pin both the learner and organiser membership,
  matching course grants. Withdrawing/restoring either account or transferring
  the learner cannot resurrect an old grant. The organiser assigns the reviewed
  chapter again. Legacy grants remain readable until a membership changes.
- Competing invitations cannot both report that their access arrangement was
  accepted. The winning invitation can still be retried safely.
- A stale restore or transfer reports a conflict when its conditional update
  loses. It does not return success or record a success audit event.
- Twelve simultaneous media workers can claim one queued job only once.

No schema migration, new provider, permission expansion or public access change
is part of these corrections.

## Repeatable checks and their limits

Run from the app repository:

```sh
node --test tests/pilot-launch.test.mjs tests/course-sharing.test.mjs tests/teacher-review.test.mjs tests/media-jobs.test.mjs
node scripts/operations/release-load.mjs /absolute/path/local-load.json
npm test
npm run build
```

The load script starts its own loopback HTTP listener and destroys its in-memory
databases when it exits. It exercises production handlers and the actual NCB
adapter with synthetic verified identities and a SQLite provider double enforcing
the documented unique constraint. It deliberately simulates an 8ms transport;
its timings must not be quoted as production latency.

It covers 30 learners (10 individual adults, 10 school teens, 10 family children),
invitation/onboarding, denied premature access, assigned chapters, child/teen
authoring restrictions, profiles, valid game saves, restoration, owner isolation,
withdrawal/reassignment, a provider outage, competing writes and released data
leases. The retained run passed 776 requests; expected denial, conflict and
injected-outage responses are counted separately. At concurrency 1/4/12, the
540 measured save/read requests had zero unexpected errors.

Two operator-only scripts add limited real-provider evidence:

```sh
node scripts/operations/ncb-release-canary.mjs /absolute/path/ncb-canary.json
node scripts/operations/release-read-canary.mjs /absolute/path/live-reads.json
```

The NCB canary reads the existing untracked `.dev.vars`. It writes only a new
synthetic owner, checks two competing writes for each learner table, verifies
exact readback and idempotent retry, deletes the records and verifies absence.
Its retained descriptor in `.sites-runtime/release-ncb-canary.json` permits cleanup
after interruption and prevents accidentally rerunning a completed test. Archive
the completed descriptor explicitly before a new run. No account or email is
created. The verified run produced one winner and one 409 for each table; first
writes took approximately 3.7 seconds including confirmation, cached retries
approximately 30ms. This checks the real unique constraint as well as the adapter.

The read canary receives `{url,token}` over hidden stdin, restricted to the exact
current Site origin. It uses the existing private administrator credential to
create its own session, checks admission/onboarding/operations and samples seven
reads at concurrency 1/2/4. It then signs out that session. The retained run had
seven 200 responses at 1.56–2.71 seconds, retention enabled, no pending cleanup or
closures, and the existing $20 daily workspace budget. This is one administrator
account, not evidence for hundreds of learners or their network conditions.

Do not include runtime descriptors, cookies, provider keys or the Site service
token in source archives or evidence. A provider throttle/error stops the read
canary; honour its response before another run. The scripts do not spend AI
generation allowance.

Evidence is retained outside the app at `output/release-acceptance/`. Earlier real
NCB email verification/recovery and generated-topic playthroughs remain in their
original evidence folders; they were not recreated by the synthetic load script.

## Remaining external release gates

1. Choose actual testers and grant the intended Site audience separately from
   application invitations. Keep school/family authority and approval records
   with the responsible organiser. This test did not create real child accounts.
2. Complete observed physical iOS/Safari and Android testing, including actual
   assistive technology users. Desktop resizing and automated accessibility
   checks do not substitute for those results. VoiceOver remains off after the
   earlier user interruption.
3. Obtain independent educator review and learner playtesting across the intended
   subjects, levels and interests. The automated educational regression set is
   not evidence of learning efficacy or universal subject coverage.
4. Run a larger, agreed production-like cohort/concurrency exercise before
   institution-wide rollout. Include long media queues, real network latency,
   device memory, operator response and recovery objectives. The present sample
   supports bounded pilot engineering checks only.
5. Confirm operational ownership: support, cost budgets, pending provider identity
   deletions, monitoring and restore rehearsals. Identity closure still requires
   the established operator step; the UI does not claim it is automatic.

The existing [launch operations](LAUNCH-OPERATIONS.md), [device evidence](DEVICE-ACCESSIBILITY.md),
and [teaching checks](PRODUCTION-TEACHING.md) retain their specific controls and limits.
