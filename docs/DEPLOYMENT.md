# Deployment and public access

## Hosting transition

The requested public origin is `https://mosaic.richardbatt.com`, using the domain managed through 20i. The user requested migration away from Sites on 3 November 2026. Sites version 68 remains the private fallback; it has not been made public. A custom address alone would not remove the Sites dependency.

The existing `richardbatt.com` package is 20i Linux Ultimate shared hosting. It can serve built frontend assets, but [20i does not support persistent Node.js backends on shared hosting](https://docs.20i.com/programming-languages/nodejs-supported). No managed cloud server was present in the inventory. The user approved the existing Baldur server after a capacity check: 16 CPU threads, approximately 45 GB available RAM and load 0.12. A separate systemd service caps the API at one CPU and 1 GB RAM; the existing media worker retains its own limits. 20i serves the static artwork and frontend.

Acceptance must verify the public URL without a Sites token, NCB sign-in, protected API denial, data/media integrity, background operations and rollback. Until recorded, this is a target address, not a completed deployment.

## Authentication and permissions

`/account.html` uses NoCodeBackend email/password and enabled methods from `/api/auth-providers`. The maintained Account component supplies account, password and session controls through a same-origin server proxy. Secrets stay on the server. Authentication uses HTTP-only cookies; production cookies require HTTPS. Mutating APIs check Origin and content type.

Public visitors can reach sign-in and included games without a ChatGPT account. Creating an NCB account does not grant another workspace's data. Keep `PILOT_ENABLED=true`: active membership, onboarding and age/organiser permissions protect private learning and authoring. See [onboarding and invitations](PILOT-LAUNCH.md).

Maintenance, recovery exports and media workers require the separate application credential and purpose headers. Removing Sites must not remove these checks. Preserve existing NCB identities, owner digests and the explicitly configured administrator storage alias.

## Server configuration

Store values in the host's private environment/secret store. `.dev.vars`, `.env`, `.sites-runtime/`, backup keys and sessions are not source or public assets.

| Setting | Purpose |
| --- | --- |
| `NCB_INSTANCE`, `NCB_SECRET_KEY` | Existing NCB authentication and learner tables |
| `META_API_KEY` | Muse Wonder Standard generation |
| `FISH_AUDIO_API_KEY` | Speech and explicit transcription |
| `FISH_AUDIO_GUIDE_VOICE`, `FISH_AUDIO_LEARNER_VOICE` | Two distinct synthetic voice IDs |
| `PILOT_ENABLED`, `PILOT_ADMIN_OWNER` | Membership enforcement and exact admin identity |
| `PILOT_ADMIN_STORAGE_OWNER`, `PILOT_KEEP_LEGACY_ADMIN_LIBRARY` | Verified existing admin/library binding |
| `PILOT_SUPPORT_EMAIL` | Displayed support contact |
| `WORKSHOP_GENERATION_LIMIT` | Rolling-day AI allowance, default 10; zero pauses new requests |
| `PILOT_DAILY_BUDGET_USD`, `PILOT_GLOBAL_DAILY_BUDGET_USD` | Estimated daily allocation limits, defaults 5/25 USD |
| `COST_META_INPUT_PER_M`, `COST_META_CACHED_PER_M`, `COST_META_OUTPUT_PER_M`, `COST_FISH_BYTES_PER_M`, `COST_FISH_ASR_PER_HOUR` | Configurable estimate rates; check provider prices when changing them |
| `MAINTENANCE_SECRET` | Separate application secret of at least 32 characters |
| `RETENTION_BACKGROUND_ENABLED`, `MEDIA_WORKER_ENABLED` | Processing flags; require running workers |
| `SOURCE_IMPORT_HOSTS` | Exact permitted HTTPS source hosts |

Manual edits and saved playback do not spend a new inference request. Provider charges, estimates and hosting costs differ. Do not disable membership to make public login appear to work; that changes authoring and cost enforcement too.

## Local and release checks

Use Node 22.23 or newer, `npm ci`, `npm test` and `npm run build`. Existing Worker development uses `npm run dev` (normally port 8878); local SQL/object bindings are separate, but copied NCB/provider secrets still access real services. Use deliberate synthetic fixtures and exact cleanup.

The parent `task-state.json` and `output/public-release/` retain migration IDs, revision and acceptance. Historical Sites helpers remain for fallback; do not publish a public Sites version as a substitute for migration.

## Portable runtime and migration

`npm run build:portable` creates a standalone Node 22.23+ server, public assets, reviewed SQL migrations and the one-time importer. Only public assets and `deploy/20i/` go in the 20i document root. The PHP gateway reads a private file outside that root and relays same-origin API requests to the authenticated Baldur tunnel. The Node service listens on loopback and rejects requests without the gateway credential. Browser cookies remain scoped to the public domain.

Private SQLite files replace the old host’s SQL and object bindings; application validation and NCB ownership checks are shared unchanged. The importer refuses an existing destination, validates the fixed table and column set, rejects active mutations and verifies rows and object bytes before promoting a new directory. It never executes schema text from a backup. NCB accounts, membership and learning records remain in the same NCB instance.

The old host must return HTTP 410 for learner and write APIs before the final export. Operator recovery reads remain available. Preserve its private snapshot during cutover. Before new writes, rollback can restore the old deployment; after any new writes, freeze and reconcile first to avoid losing data. Runtime configuration and backup files must never enter Git or the public document root.
