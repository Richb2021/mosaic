# Mosaic · personalised learning and Lanternbound games

Mosaic turns reviewed learning material into a connected programme of games, Explore lessons, practice, podcasts, cartoons and tutoring. Lanternbound is its 3D JRPG; this repository now contains the wider platform as well as the game.

**Hosting transition:** the requested public address is `https://mosaic.richardbatt.com`. Migration away from Sites is in progress. The existing private preview remains available until deployment and data checks are complete. See [deployment and access](docs/DEPLOYMENT.md) for the authoritative status.

## What is implemented

| Area | Current behaviour |
| --- | --- |
| Personal learning | Goals, level, interests, difficulties, exam/context, time and accessibility preferences; saved programmes; support suggestions from recorded answers and help used; learner overrides. |
| Knowledge library | Up to 500 sources per workspace; paged browsing, ranked passage search, reviewed collections, optional original files, versioned evidence and scoped sharing. Text, PDF, Word, slides, captions, spreadsheets, permitted websites and explicit transcription have bounded import paths. |
| Games | Nine validated templates: 3D RPG, 2D adventure, subject draft, town/business simulation, economic strategy, visual novel, quiz expedition, tactical football and merge/crafting. |
| Explore and assessment | Interactive investigations, numerical and short-answer work, worked reasoning, rubric-guided writing, first-response evidence and later revisits. Written reasoning is not automatically a grade. |
| Creative learning | Source-bound podcasts and animated cartoons with reusable art, action/prop staging and lip sync; private saved narration; transcripts and source references. |
| Tutor | Muse guidance and optional voice input; editable transcription before submission; spoken replies saved for replay. Managed learners require organiser permission. |
| Accounts and teaching | NoCodeBackend sign-in, verified-email invitations, age-band onboarding, individual/school/family permissions, teacher review, assignments and revocable sharing. |
| Data and operations | Owner-bound saves, version conflicts, export, deletion, retention, cost/request limits, media jobs, monitoring and recovery tooling. Identity closure has an operator completion step. |

Generation uses **Meta `muse-wonder-1.0` in Standard mode**. Fish handles transcription and speech. There is no silent model substitution. Reviewed evidence is selected before generation; deterministic validation and exact citations precede human review and publication. The model supplies bounded content, never executable game rules or arbitrary asset URLs.

Support adapts from recorded responses and learner choices, not a fixed “learning style”. Game wins and XP do not establish mastery. A valid citation or schema does not establish educational correctness.

## Open the application

- `/account.html` — NoCodeBackend sign-in and account controls.
- `/welcome.html` — invitations, onboarding and learning-group management.
- `/studio` — personal programme, sources, courses, creative learning and Your data.
- `/modes.html` — all game formats, including guest examples.
- `/` — the Lanternbound JRPG.
- `/cartoons.html` — authored cartoon artwork/player examples, not a personal library.

Included games can be played as a guest. A new login does not grant access to another person's content or automatically authorise a school/family account. Private features require membership and onboarding. See [permissions](docs/PILOT-LAUNCH.md).

In the RPG, move with WASD/arrows or click a destination; use E or click an object to interact. The menu contains reachable destinations, requests, the map, settings and save journal. Choose Mira or Ren as the lead. Linked regions, interiors, shops, side requests and Underlight Works share authored mechanics across topic packs. See [settlements](docs/SETTLEMENTS.md) and [Underlight Works](docs/UNDERLIGHT-WORKS.md).

## Develop and verify

Use Node 22.23 or newer. From this directory:

```sh
npm ci
npm run dev
```

The local address is normally `http://127.0.0.1:8878`. Included games do not need provider keys. Accounts, generation and private storage need the [server configuration](docs/DEPLOYMENT.md); an unconfigured preview is not proof those features work. Do not copy production learner data into a casual preview.

```sh
npm test
npm run build
```

The last complete acceptance before the hosting migration passed **632 tests** and the production build. Real NoCodeBackend, Muse and Fish journeys covered uploaded material, review, gameplay, practice, adaptive support and saved tutor speech. Those provider tests used local application storage; the published preview separately passed a read-only browser check. Evidence is in the parent workspace's `output/adaptive-voice/`.

Physical microphone capture, physical mobile/assistive-technology sessions, independent educator/learner evaluation, an independent code audit and a larger production-like load exercise remain outstanding. This is a working platform with bounded evidence, not a claim of universal subject coverage, classroom-scale capacity or accessibility conformance.

## Repository guide

| Location | Purpose |
| --- | --- |
| `src/studio/` | Programme, knowledge, assessment, creative learning and voice UI |
| `src/game-modes/` | Eight illustrated/simulation templates and shared learning model |
| `src/main.js`, `src/world.js`, `src/engine.js` | RPG UI, rendering/movement and deterministic rules |
| `server/` | Provider adapters, authentication, ownership, validation, lifecycle and operations |
| `app/api/` | Existing Worker HTTP entry points |
| `public/` | Browser assets, authored examples, game art and provenance |
| `drizzle/` | Application SQL migrations |
| `tests/`, `evaluation/` | Behavioural regression and educational evaluation fixtures |
| `scripts/operations/` | Media workers, monitoring, backup and acceptance tools |
| `docs/` | [Documentation index](docs/README.md) and bounded milestone records |

This directory is its own Git repository. The parent Hackathon workspace holds research, plans, editable art, evidence, scripts and `task-state.json`. Private book/course resources are design references, not a product corpus. See [art direction](docs/ART-DIRECTION.md), [asset contracts](docs/ASSET-CONTRACT.md) and [collision/asset documentation](docs/ASSETS-AND-COLLISION.md). Licensed embedded assets are not a standalone asset pack.
