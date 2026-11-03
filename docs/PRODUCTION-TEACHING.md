# Production media and teaching workflows

Mosaic now keeps episode preparation in a persisted job rather than a browser tab. Authors queue an approved podcast MP3 or cartoon MP4 in the Creative Studio. An authenticated operations worker claims a bounded lease, reuses saved narration, renders the existing artwork and Rhubarb speech animation, then stores the complete file privately. The same script hash, format, artwork and data epoch identify a request. Repeating a click does not create another job.

## Recovery and operations

`server/media-jobs.js` owns admission, exact approved-script checks, lease tokens, cancellation, progress and output publication. The worker never chooses owners or supplies new script text. `scripts/media/worker.mjs` runs on the operations host and calls only its pinned origin, refusing redirects. Its configuration is outside the repository, mode 600. Temporary audio is removed after every job and on process restart. The worker reuses the browser renderer and bundled speech model; model-generated code is never executed.

A lost worker lease can be reclaimed after 15 minutes. Audio uses the existing content-addressed `persistentAudio` path, budget reservation and cost ledger. Missing or uncertain provider acknowledgements are not automatically billed again. A failed job offers an explicit retry that reuses saved narration. An uncertain voice request still requires the author to inspect and clear its failed recording through Your data. A data epoch change, account withdrawal, unapproved script or cancellation prevents late publication.

The administrator's course overview includes service health: worker heartbeat, queue counts, failures and the last retention run. The existing daily retention service and the media worker write local operational receipts. This release does not configure external email/SMS alert delivery or claim a provider uptime SLA.

Saved MP3/MP4 output shares the existing media inventory, owner checks, export and deletion. A full video is represented by `segment=-1`; a full podcast by `segment=-2`. There is no new database migration. Narration remains separately reusable. Deleting an episode also removes its queued renders and outputs; deleting a rendered file retires its job. Recreating media after deletion is an explicit new request in a new data epoch.

## Teaching and assignment

The existing reviewed course route supports teacher instructions and an optional suggested due date. Late work is still accessible. No timed examination, locked accommodation or automatic grading is implied.

An assigned learner can open **Send work for feedback**, select a reviewed Explore lesson and preview saved answers. Only the chosen responses, written working and recorded hint use are submitted. Other answers, predictions, interests and conversations remain private. A separate consent receipt is off until its exact NoCodeBackend submission is confirmed. Turning off sharing wins over an in-flight submission.

The current organiser opens **Review submitted work**, compares the response with its exact lesson evidence and writes two human feedback fields: what the reasoning shows and a useful next step. Feedback is not a score. It is bound to the submission hash and assignment revision; replacement, source withdrawal, group changes and consent withdrawal hide stale work. Submissions and feedback use the existing owner-scoped NoCodeBackend profile storage. Existing personal exports and retention cover those records; learner/source cleanup removes review-sharing receipts.

## Educational evaluation

`evaluation/educational-v1.json` contains 40 frozen synthetic cases: 24 answerable (factual, quantitative, argumentative and language), 8 lexical absence controls and 8 access/citation boundaries. Twelve cases are held out from development execution. `educational-v1.sha256` protects the file. `node evaluation/run.mjs` checks the development slice; `--holdout` checks all cases. The report lists every result rather than hiding misses in one aggregate.

Expected answers and a human review rubric are included. Automated retrieval success and exact citation identity do not verify semantic truth, age suitability or educational effectiveness. Near-miss evidence refusal, independent teacher review, native-speaker review and real learner retention/transfer studies remain separate release gates. Once the held-out set is inspected, treat it as a regression set for subsequent changes.

## Verification boundaries

The isolated restore drill reconstructs D1 rows and media bytes in a fresh local test database and proves a claimed job resumes without a second voice charge. It is not a destructive live restore or a provider disaster-recovery guarantee. The NCB journey uses two real disposable identities, with admission and reviewed-content fixtures confined to local D1. Existing recorded Muse content is reused with pinned source passages; no fresh inference is claimed for that fixture.
