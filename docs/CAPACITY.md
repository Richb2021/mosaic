# Public capacity — 4 November 2026

**No sustained concurrency recommendation passed.** Five, ten and twenty active-learner workloads all received NoCodeBackend session-rate-limit responses. The final 5-learner run was scheduled for 7 minutes and completed 106 requests with 2 errors. The deployed fixes and cleanup are verified; the larger-cohort capacity gate remains blocked. This is a measured provider-path limitation, not evidence that Baldur exhausted its hardware.

The public entry is https://mosaic.richardbatt.com/. It opens the platform; Lanternbound is at /rpg.html. Existing chapter links redirect while retaining their parameters. Login is /account.html, using the existing NoCodeBackend account. Password recovery remains on that page.

## What was measured

All public tests travelled through HTTPS → 20i PHP gateway → Cloudflare tunnel → Baldur → real NoCodeBackend authentication and learner tables. The generator ran on the Mac mini, not the busy developer Mac. Forty disposable NCB identities were provisioned; each had a distinct owner, operator-seeded learner membership, a programme, and a four-minute synthetic 3.66 MiB MP3. Runtime requests still passed normal session, ownership, admission and save validation.

The mix was 50% learning-journal reads, 30% studio reads, 10% valid game saves and 10% complete stored-audio downloads. Every download had its length and SHA-256 checked. The ordinary pattern was one server action every 20 seconds per learner; the intensive pattern used eight seconds. These are explicit test assumptions. Movement, battles and much gameplay run in the browser and do not each call the API.

Targets were p95 below 2.5 seconds for reads and five seconds for saves/downloads, zero invalid responses, p95 client scheduling delay below one second, and no resource safety stop. The runner stopped on repeated errors, a 429, a 15-second request, sustained high latency or host pressure. Early stops remain failures and are included below.

| Run | Learners / action interval | Requests | Errors | Journal p95 (s) | Save p95 (s) | Audio p95 (s) | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| revised-10 | 10 / 8s | 28 | 0 | 7.28 | 6.65 | 8.38 | Below acceptance |
| direct-10 | 10 / 8s | 76 | 0 | 1.64 | 5.16 | 1.61 | Below acceptance |
| steady-10 | 10 / 8s | 28 | 0 | 7.51 | 6.93 | 8.52 | Below acceptance |
| confirmed-10 | 10 / 8s | 98 | 4 | 2.78 | 3.26 | 4.63 | Below acceptance |
| ordinary-20 | 20 / 20s | 97 | 3 | 5.08 | 6.17 | 7.98 | Below acceptance |
| ordinary-10 | 10 / 20s | 95 | 3 | 5.28 | 5.61 | 12.03 | Below acceptance |
| ordinary-5 | 5 / 20s | 106 | 2 | 4.50 | 3.23 | 2.81 | Below acceptance |

The direct run bypassed 20i and Cloudflare but used the same real NCB authentication and application. The initial baseline-3 run is excluded because its expected audio checksum was overwritten by a concurrent fixture check. See baseline-disposition.json. Ordinary-20 preceded the final distinct zero/one version-bound refinement; the final run used the release hash below.

## Bottlenecks and changes

- Baldur was not saturated. In the final run its service peaked at **59.98 MiB** and **31.89% of one CPU core**. Its configured caps remain one CPU and 1 GiB. No OOM kill or unplanned restart occurred.
- Stored audio now streams in 64 KiB chunks with object-version checks. In the isolated sixteen-reader, eight-MiB-per-object experiment, RSS fell from 195.79 to 60.51 MiB; retained ArrayBuffers fell from 128.02 to 1.02 MiB. This experiment is separate from the smaller MP3 workload.
- Save confirmation now asks for the expected version or newer, avoiding a cached pre-insert result. A real probe improved from 3.52 seconds to 0.06 seconds for the storage portion; end-to-end times still include authentication and the gateway. Initial and confirming queries use different version bounds. Writes retain a shared 55-second fetch deadline, conflict handling and idempotent retry. Up to fifty sequential old-row deletes became one bounded bulk delete.
- NoCodeBackend returned **HTTP 429** for session checks during the higher sustained workloads. Content-free server diagnostics confirmed this; table reads and host resources were healthy. The provider did not expose a numeric limit or Retry-After in those observed responses, so no exact provider quota is claimed. The application now identifies this as a temporary sign-in-service rate limit while preserving the device save.
- Public bursts showed additional time outside the upstream handler. For ten concurrent journal reads, some requests took about 2.8–3.2 seconds while the measured upstream portion was about 1.4–1.6 seconds. This is evidence of queueing in the public relay path; it is not a verified PHP-worker allocation.

## Scope and next capacity gate

This does not establish simultaneous Muse generation, Fish speech generation, large uploads, classroom-wide initial page loads, maximum-size libraries, video delivery or browser/GPU performance. Signup was deliberately paced and is not a high-volume onboarding benchmark. No paid AI generation was used by this load exercise.

Registered account count is not the same as active concurrency. Before a larger concurrent cohort, resolve the NCB session rate limit for this proxied deployment and re-test the public relay queue. Increasing Baldur RAM alone will not remove either limit. There is no validated active-learner number to use for a larger rollout yet; manual individual testing can continue, but that is not a capacity certification. Preserve fresh session verification and tenant checks; do not bypass them to improve the benchmark. NCB's [published troubleshooting guidance](https://docs.nocodebackend.com/) mentions rate/credit limits but does not specify the session limit observed here.

## Safety, cleanup and release evidence

All forty test identities, their learner rows and the exact synthetic audio objects were removed. Revoked-session readback rejected all forty old sessions. Functional readback verified every fixture's expected saved or untouched version; switched-account, foreign-audio and stale-save checks were denied. Live first-save retry and racing-write tests passed and removed their own records.

The deployed server SHA-256 is `7f8463676d26e324960e55ca0fbafb1e8774c223fd86a9605489baf2856358f2`, matched by remote readback. The capacity bundle excludes concurrent, unrelated producer-agent/MCP changes. Exact evidence, raw stage results, audit reports, fixture cleanup receipts and screenshots are in the parent output/load-capacity directory. Reproduce the evidence checks with `node scripts/load-capacity/verify.mjs` from the workspace root; this validates recorded results and does not rerun load or delete accounts.

![Public platform homepage](../../output/load-capacity/platform-home.jpg)

![Dedicated RPG route](../../output/load-capacity/rpg-route.jpg)
