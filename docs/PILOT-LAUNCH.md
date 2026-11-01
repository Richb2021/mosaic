# Ownership, onboarding and pilot operations

This release uses NoCodeBackend for sign-in, email verification, recovery and learner records. The application enforces resource ownership and managed-learning permissions around the verified NCB identity. The Site audience remains owner-private until named pilot access is explicitly authorised.

## Accounts and ownership

A new account receives its own resource namespace, derived server-side from the verified NCB user ID. Client headers, email text and uploaded owners cannot confer ownership. Passwords and provider keys never appear in browser bundles. The official NoCodeBackend Account component retains profile, password and session management.

The configured administrator uses `PILOT_ADMIN_OWNER` (SHA-256 of `mosaic-learner:` plus the verified NCB ID). For the existing development library only, `PILOT_KEEP_LEGACY_ADMIN_LIBRARY=true` binds the existing workspace recorded in `maintenance:workspace`. `PILOT_ADMIN_STORAGE_OWNER` can bind its original learner namespace to that administrator. The old development identity is then denied all learning/data access. This explicit account transfer preserves existing sources, content IDs, saved progress, media keys and cost receipts without moving or regenerating them. Never reuse the alias for an unrelated account. Record and verify the exact source identity before enabling it.

The approved administrator is `contact@graysongames.com`. Credentials are in the private Baldur credential store, not this repository. Recovery uses the existing 20i mailbox. NCB currently sends a provider-hosted recovery link; the UI tells learners to return to Mosaic afterward. The real recovery acceptance checks delivery, one-use token, old-password rejection and new-password sign-in.

## Individual, family and school journeys

1. An administrator authorises an individual learner, teacher or guardian. Only administrators can grant organiser roles.
2. A teacher or guardian can invite learners in their authorised setting. Invitations bind an email hash and a random secret, expire after seven days and are shared privately by the organiser. The application does not send invitation emails itself.
3. Learners sign in using NoCodeBackend. An email-code sign-in verifies ownership of the email before an invitation can be claimed. A password-only session with an unverified email cannot consume a code.
4. The learner chooses an age band and acknowledges the learning/data notice. No date of birth is collected. Under-18s require school/guardian authorisation on their membership. The learner cannot rewrite a completed age declaration to grant themselves permissions.
5. Managed authoring permission comes from the organiser's membership record. School/family learners receive reviewed assignments by default. An organiser may explicitly permit a verified adult learner to author; a learner's own age declaration cannot grant this permission.
6. Reviewed published chapters appear in the learner's Studio. Assignments are read-only; source libraries and other learners' records are not shared. Personal progress remains in the learner's own NCB records.
7. Organisers can withdraw and restore access. The administrator can transfer a learner to an authorised organiser. A transfer withdraws the previous organiser's assignments; the new organiser must assign their own reviewed content. Organisers must transfer or close dependents before closing their account.

These product controls do not verify a school's legal authority or replace its safeguarding/consent process. Organisers retain their authorisation records outside the app. Group management is not an SIS integration, institution-wide analytics product or proof of accessibility conformity.

## Launch controls

- `PILOT_ENABLED=true` requires membership and completed onboarding for learning/library use.
- `PILOT_DAILY_BUDGET_USD` and `PILOT_GLOBAL_DAILY_BUDGET_USD` are estimated daily allocation limits (defaults $5 / $25). Both reservations are atomic. Unknown provider usage retains its reservation; actual measured usage replaces it. Provider invoices, storage and hosting costs remain separate.
- `WORKSHOP_GENERATION_LIMIT` independently limits AI reservations in the rolling 24-hour window. Manual revisions and cached playback do not consume inference allowance.
- The administrator can pause new paid generation without disabling saved content or recordings.
- `PILOT_SUPPORT_EMAIL` is the displayed support contact.
- `RETENTION_BACKGROUND_ENABLED=true` enables the background writer. It requires a distinct application bearer credential `MAINTENANCE_SECRET` plus its purpose header, even if the Site later becomes public.
- A malformed cost setting disables new generation while leaving Welcome and data controls usable.

Before widening access, check the deployed version, admin identity, notice version, per-user/global budgets, support mailbox, current retention run and pending closures. Keep an external-pilot cohort and its subject coverage explicit; do not claim every subject, automatic mastery or high-stakes assessment.

## Data and account closure

Revoked or closing members retain access to their own exports/deletion controls while their NCB identity exists. Uninvited accounts cannot create storage by visiting those routes. Operations preserve deletion locks, content-version checks and stale-tab protection.

A closure request withdraws app access first, clears the personal source workspace and learner record through the existing verified deletion workflow, then enters `provider-pending`. Cleanup failures remain visible and resumable. The administrator account must be transferred before closure. The UI explicitly distinguishes data cleanup from identity removal.

The operator reads `/api/operations` with the server maintenance credential and `X-Mosaic-Maintenance: closure-v1`. Only a queue item in `provider-pending` may be supplied to `scripts/pilot/close_ncb_identity.py` on Baldur. That command checks the NCB user ID against the account reference, deletes exactly that requested identity through the official NCB administrative MCP, and queries it again to prove absence. The operator then submits `confirm-provider-deletion`; repeated acknowledgement is harmless. Never substitute an email address or arbitrary user ID for a queued request. Normal learners cannot call this endpoint.

Closure completion removes identity details from its control record and removes obsolete assignment grants. Completed closure records, closed membership tombstones and operational audit metadata expire after 30 days. Unused invitations expire after seven days and are pruned by maintenance. Outstanding provider cleanup is not presented as completed or silently expired.

## Recovery and incident response

- Stop new generation with the administrator control when provider spend or content generation needs investigation. Existing playback stays available.
- Inspect the saved job/provider ID before retrying. A timeout is not permission to issue another paid request.
- For storage trouble, leave the current record intact and use its saved version/conflict response. Do not replace unreadable learner records with empty defaults.
- Download a workspace and learner export before a destructive change. Exports include extracted sources and original media; original uploaded documents are not retained by this app. Restore learning through the validated source-review/programme/save interfaces; never insert untrusted export JSON directly into production tables.
- Application rollback uses a previously saved Sites version and preserves the existing access policy. A source-version rollback is not a database restore. Infrastructure-level D1/NCB/R2 restoration must be arranged and tested with the hosting providers before claiming a production disaster-recovery SLA.
- Account-recovery email is an independently tested external dependency. NCB sign-in rate limits remain authoritative; preserve Retry-After and wait instead of trying alternate identities to evade throttling.

## Verification evidence

Root `output/pilot-launch/evidence/` holds source/build/test logs, provider contracts, real NCB/20i acceptance, independent audit and its disposition, browser screenshots, deployment and maintenance readback. The delivered acceptance includes 374 passing automated tests, real NoCodeBackend/20i admission and recovery, a real Muse Wonder fractions chapter completed in the browser, exact saved state restored after a distinct sign-in, and all ten inherited audio clips served from storage while generation was paused. The original generated chapter required an editorial correction before publication; that free revision did not consume AI allowance. Credentials, email codes and recovery links belong only in private runtime files. Provider creation responses must be filtered because 20i can echo a newly created mailbox password.

## Unattended writer and remaining launch gates

The current development deployment uses $20 per learner/workspace and $100 globally per UTC day, with the existing 50-generation allowance. Review these settings before inviting real learners.

The private operator command receives `{url,token}` through hidden stdin. `token` is the current Sites service-access token obtained from `get_site`, never a learner cookie. Send it only to the exact Mosaic origin using `OAI-Sites-Authorization`. The independently checked `MAINTENANCE_SECRET` is configured as the lowercase SHA-256 digest of `mosaic-maintenance:` followed by that token, and is sent in `Authorization: Bearer ...`. After a Site-token rotation, update this secret and redeploy before the next run. A 403 must fail closed, not bypass authorisation.

For retention, use `X-Mosaic-Maintenance: retention-v1`, POST an empty body to `/api/maintenance` until `more` is false (at most 20 batches), then GET the same route and compare the saved `lastRun.runId`. Treat status `attention`, pending cleanup, an uncompleted sweep or a stale daily run as operational failures. A 409 means another pass has the lease; read its status and resume later. The fixed cutoff is retained between batches and after interruption. Saved account closures in `cleaning` are retried by this worker without requiring the departing learner to return.

For account identity closure, use the same credentials with purpose `closure-v1` on `/api/operations`. Run `node scripts/pilot/complete-closures.mjs` with the private input on stdin. It transfers the checked operator helper to Baldur, verifies the exact NCB identity is absent and acknowledges completion. The background schedule reports outstanding requests; it does not perform this administrative identity deletion. Completion removes the account from the sweep queue and removes its empty data-control scopes; completed operation metadata expires after 30 days.

Daily retention runs on Baldur using the user systemd unit `mosaic-retention.timer` at 03:15 Europe/London, with persistent missed-run catch-up. `mosaic-retention.service` and its exact writer were both run successfully; readback is saved in `~/.local/state/mosaic-pilot/retention-last.json` (mode 600). Its exit status is nonzero on failures or pending closures. Configuration stays in `~/.config/mosaic-pilot/maintenance.json` (mode 600); never copy it into the source archive. Check `systemctl --user status mosaic-retention.timer mosaic-retention.service` and the saved result during launch operations. The host has user lingering enabled, so the timer does not require an interactive login. The former hosted task `Automation_d1e775a6c78c8191a3a4c088861f4ebc` was updated, actually run and found to lack Sites capabilities; it is paused to avoid duplicate maintenance. Its failed run is retained as evidence, not reported as a success. No email or push alert integration is claimed; the operator checks service failures, the saved status and Welcome’s last retention run.

External rollout remains gated on named Site access, appropriate school/family authorisation records, confirmed daily maintenance, an operator handling pending account closure, and the cohort's tested subject/device coverage. The current Site remains owner-private. Provider-level disaster recovery, institutional contract/safeguarding arrangements and broad accessibility validation are separate readiness work; passing this engineering journey does not establish them.
