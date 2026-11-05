# Mosaic: learning, made yours

Mosaic turns a teacher's reviewed learning material into games, stories, cartoons, podcasts and practice. Each one is personalised to the learner's interests and age, and every fact can be traced back to a reviewed source.

It's built on Meta's **Muse Wonder** (text) and **Muse Image** (pictures) through the Meta Model API, for the Meta Global AI Developer Hackathon (theme: *Build for Your World*).

- **Live app:** https://mosaic.richardbatt.com
- **Game library (no sign-in needed):** https://mosaic.richardbatt.com/modes.html
- **3D RPG, Lanternbound:** https://mosaic.richardbatt.com/rpg.html

---

## The problem

Learners switch off when lessons don't connect to them. Teachers don't have time to rewrite every lesson for 30 different interests and reading levels, and most AI tools invent facts, which a teacher can't trust.

## What Mosaic does

**For teachers**
- Add your own material (notes, a PDF, Word, slides or a web page) and review it. Mosaic generates only from passages you've reviewed, and every activity cites them.
- Turn a course goal into a route of objectives, then prepare an activity for each one in any format below.
- Nothing reaches learners until a person approves it.
- Create classes, invite pupils, and assign courses or chapters.
- See scores on the games you assigned (right first time, help used, retries), plus an inbox of work and help requests and a CSV export.

**For learners**
- Today shows what's next, the Trail shows everything done so far, and learners can choose to share updates with their teacher.
- Activities are written around their interests (anime, football, gaming, animals and more), in a story style they pick, at the right reading level.
- They can play, revisit, ask for a hint, and export or delete their data at any time.

### Formats
| Format | What it is |
| --- | --- |
| **Lanternbound (3D RPG)** | Explore a world, then an "Underlight" chapter generated for the lesson: puzzles, battles and a boss, where the learning is how you win |
| **Game library** | Quiz expedition, tactical football, visual novel, 2D adventure, crafting, town and business simulation, economic strategy |
| **Explore lessons** | Interactive investigations with experiments, graphs and worked reasoning |
| **Question cycles** | Four-stage adaptive practice spread across the learning focuses, with hints that never give the answer away |
| **Cartoons and podcasts** | Narrated episodes with Mira and Kit, with backdrops painted by Muse Image for the subject, and a downloadable MP4 or MP3 |

## How Meta's models are used

| Model | Used for | Where in the code |
| --- | --- | --- |
| **Muse Wonder** (`muse-wonder-1.0`, Responses API) | Course plans, RPG chapters, all game formats, Explore lessons, question cycles, cartoon and podcast scripts, tutor replies, search suggestions | `server/content-service.js`, `server/creative-provider.js`, `server/course-plan-provider.js`, `src/story-direction.js` |
| **Muse Image** (1.0) | Subject-specific cartoon backdrops in the episode's art style (game art is in progress) | `server/cartoon-backdrops.js`, `docs/CARTOON-BACKDROPS.md` |

Every generation uses **structured JSON output** with a strict schema. The server then:
1. **Checks the facts and numbers:** it validates every citation against the reviewed passages, repairs learning-map links, and checks answers and numbers before a person reviews anything.
2. **Scores the story:** it scores the craft against an 8-part rubric (hook, dramatic question, stakes, ticking clock, open loops between learning beats, payoff and more; see `src/story-quality.js` and `docs/STORY-CRAFT.md`). A clearly weak story gets one guided rewrite.
3. **Writes for the learner:** the prompt carries the learner's age band, interests, chosen style (11 styles) and the weak spot to practise. The weak spot becomes the story's early mistake.

Measured result: across 8 real generations, the average story-craft score rose from **9.4/16 to 14.5/16**.

## Safety, privacy and cost
- **Under-18s:** they join only through a personal invitation from a teacher the organiser has verified, and the invitation needs the school's or guardian's approval. Open sign-up is for adults (18+).
- **Your data:** learners can export or delete their data, and sharing with a teacher is their choice. Teachers see scores only on the work they assigned.
- **Cost:** every AI call reserves its estimated cost before it's sent, against a per-person daily limit and an app-wide daily cap. The administrator can pause all generation, and can give individual people a higher allowance (for example judges) for a set time. A typical game costs about $0.09; a Muse Image backdrop costs $0.01.
- **No hidden switches:** Mosaic never silently swaps to another model or provider.

## Try it
1. **No account:** open the [game library](https://mosaic.richardbatt.com/modes.html) or the [RPG](https://mosaic.richardbatt.com/rpg.html). The included games are free to play.
2. **As a teacher:** sign up, then on Welcome choose **"I'm a teacher (18+)"**. You can create courses and classes straight away. Inviting under-18 pupils unlocks once the organiser verifies you.
3. **As an adult learner:** choose **"Start learning on my own (18+)"**.
4. **Need more AI generations?** Use **Ask for more** on the Welcome page. Judges can ask for a judge allowance.

## How it's built
```
Browser (React Studio, Three.js RPG, game library)
   │  static files: UK web host (20i)
   ▼
/api/* ──► small PHP gateway ──► Cloudflare tunnel ──► Node.js server (our own Linux box)
                                                         ├─ SQLite: app data, cost ledger, jobs
                                                         ├─ NoCodeBackend: sign-in and learner records
                                                         ├─ Meta Model API (via a UK relay)
                                                         └─ Fish Audio: narration and transcription
Background worker: renders narrated MP4/MP3 episodes
```
- Meta's API refuses requests from the server's region, so calls go through a small authenticated relay on the UK host (`deploy/20i/meta-relay.php`, `docs/META-RELAY.md`).
- Keep-alive connections and DNS caching cut signed-in page loads from 10–17 s to about 4 s (`server/node/keepalive-fetch.mjs`, `server/node/dns-cache.mjs`).

## Run it locally
Requires Node 22.23 or newer.
```sh
npm ci
npm run dev          # http://127.0.0.1:8878
npm test             # 780+ behavioural tests
npm run build        # production build
```
The included games work without any keys. Sign-in, AI generation, narration and private storage need server settings, which are described in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) and [docs/STAGING.md](docs/STAGING.md). Keys are never committed.

## Repository guide
| Location | Purpose |
| --- | --- |
| `src/studio/` | The Studio: courses, classes, programme, creative learning, Explore, cycles, Your data |
| `src/game-modes/` | Game library templates and built-in example packs |
| `src/main.js`, `src/world.js`, `src/engine.js` | The 3D RPG |
| `src/story-direction.js`, `src/story-quality.js` | Story styles, audience voice and the story-craft checker |
| `server/` | API, validation, cost ledger and allowances, classes, sharing, media jobs, provider adapters |
| `server/node/` | Node server start-up, Meta relay, DNS cache and keep-alive connections |
| `scripts/staging/` | Private staging copy with test people |
| `tests/` | Behavioural tests |
| `docs/` | Feature docs ([index](docs/README.md)) |

## Honest limits
- **Content quality:** story and learning quality are checked by rules and by human review. A valid citation doesn't prove a lesson is educationally right, which is why a person approves everything.
- **Not yet done:**
  - formal accessibility conformance testing
  - testing with assistive technology on physical devices
  - an independent classroom evaluation
- **Scale:** load has been tested at small scale only; see [docs/CAPACITY.md](docs/CAPACITY.md).

## Licence and third-party assets
The Mosaic code is released under the [MIT licence](LICENSE).

Some assets used by the live site are licensed for use in Mosaic only and are **not included in this repository**:
- **Fonts:** GC Bumble, GC Arturm and Planner Notes (Envato Elements). These go in `public/fonts/lantern/`. Without them, pages fall back to system fonts.
- **3D models:** the Polyfork kit models (`public/assets/polyfork_*.glb`, see `public/assets/polyfork-manifest.json`). The RPG needs your own licensed copies, or replacement models with the same names.

Other bundled assets keep their own licences, for example the open-font licences in `public/fonts/` and the lip-sync licences in `public/lip-sync/v1/licenses/`.
