# Cartoon story backdrops (Muse Image)

A cartoon can now be set where its subject is: a water-cycle episode shows clouds and rain, a food-web episode a pond and a nature workroom. The cast, staging and narration are unchanged.

## How it works

1. **Approved script first.** Backdrops can only be made for an approved (`creative-published`) cartoon, by its author.
2. **One picture per setting the episode uses** (2–4 of observatory, workshop, garden, city). Each preset keeps its role in the story; the place changes with the subject:
   - Suggestions come from the reviewed source's name, for example "The water cycle: teacher notes" gives "the water cycle". The playful chapter title is only the fallback.
   - The author can edit each place line (3–160 characters, no links) before making it.
3. **Prompt** (`server/cartoon-backdrops.js`, `backdropPrompt`): the art-style text from the curated packs (Prism anime or Paper comedy), the place, the subject, and the story premise for mood only. It also sets the stage layout: open floor along the bottom third, calm areas at 30% and 70% where Mira and Kit stand, horizon at about 55%. Fixed rules: no people, characters, animals, faces, statues or portraits; suitable for all ages; no text, letters, numbers, signs, logos, flags or diagrams.
4. **Request:** `POST https://api.meta.ai/v1/images/generations` with these settings:
   - `model: muse-image-1.0`, `size: 1280x720` (sets the aspect ratio; Meta returns 2048×1152), `output_format: webp`, `response_format: b64_json`, `reasoning_strength: low` (about 15–20 s each).
   - `user` is a hash of the workspace.
   - `tool_enablement` turns web search, image search and shell off, so the picture is an original illustration, never a copied photo.
   - `moderation` is not sent; Muse Image rejects it.
5. **Checks on the reply:** exactly one WebP, at least 512×288 and at most 4096 px on each side, aspect between 1.5 and 2.
6. **Review:** each setting can be made once and remade once (`MAX_ATTEMPTS=2`), and the author picks which of the two to use.
   - The author ticks "I checked every picture…" and approves.
   - Any new picture puts the set back into draft. Learners see only approved sets, and Withdraw hides them again.
7. **Fallback:** any scene without an approved picture uses the standard library backdrop. This covers refused, failed, deleted, expired or withdrawn pictures, and a load failure in the browser. A cartoon never breaks because of a backdrop.

## Where things live

| Piece | Where |
|---|---|
| Author API | `GET/POST /api/learning/creative/backdrops`: view, `generate`, `choose`, `approve`, `withdraw`; `?image=1` returns a picture |
| Learner read | `/api/learning/programme?…&resourceId&resourceHash&backdrop=<scene>&backdropStyle=<style>`; the script response lists approved sets as `backdrops` |
| Record | `workshop_jobs` row `recordType: cartoon-backdrops`, one per script and style |
| Pictures | Object store `backdrops/<id>.webp`, `media_assets` segment `-(10×scene+10+attempt)`, `-10` to `-41`. They follow media retention, Your data listing, export, download and episode deletion. |
| Player | `CartoonPlayer` `backdrops={sets,load}` adds "Made for this story" (edition 3) and makes it the default when a set exists (`src/studio/media/story-backdrops.js`) |
| Author panel | `src/studio/CartoonBackdrops.jsx`. The preview player shows draft pictures before approval. |
| MP4 | Media job `edition: 3` needs an approved set in that style. The worker fetches the pictures (`action: backdrop`) and `render.mjs` swaps them in, keeping the library picture for any that fail. A new approval makes a new render. |

## Cost and limits

- **Price:** $0.01 per returned image (Meta pricing page, checked 4 November 2026), so about $0.03 for a 3-setting episode and $0.01 per remake.
- **Ledger:** `cost-ledger.js` prices `muse-image-1.0` per image and reserves $0.01 before each call, through `startCost`. That one check covers the admin pause switch and the per-person and global daily limits.
- **Allowance:** each image also takes one slot in the rolling generation allowance.
- **Not billed:** a refused image is recorded at $0, because Meta bills only returned images. A lost or uncertain reply keeps its reservation and is never retried automatically.
- **Override:** `COST_META_IMAGE_PER_IMAGE` changes the price.

## Switches

- `CARTOON_BACKDROPS=on` turns generation on. Without it the panel says it is off, and existing approved pictures are still shown.
- **Relay:** Meta calls from Baldur go through the UK relay. `deploy/20i/meta-relay.php` now also allows `POST /v1/images/generations` (POST only, 95 s timeout, 16 MB reply cap). Image edits and other paths stay refused. Live's `meta-relay.php` must be replaced with this version before turning the feature on live. Until then, image calls get "Path not allowed" and fall back.

## Verification, 4 November 2026

- **Tests:** `tests/cartoon-backdrops.test.mjs` has 12 tests covering prompts, suggestions, WebP checks, refusals and outages, pricing, relay paths, the author flow, pause and limits, permissions, player and MP4 fallback, the learner read path and episode deletion. Full suite 752/752.
- **Real images:** 8 images through a private copy of staging (own port, copy of staging data, test relay file `meta-relay-images.php`). Shared staging and live were not changed.
  - Food webs, Prism anime, 3 pictures: a pond, a riverside market and a nature workroom.
  - Water cycle, Paper comedy, 3 pictures plus 1 remake: an evaporation and rain valley, a lookout with a waterfall, and a street with a fountain and water tower.
  - All on-style, with no people, writing or logos.
- **Browser:** player on desktop and phone with "Made for this story", no console errors and no sideways scroll.
- **Video:** narrated MP4, 32 s, 1280×720, H.264 and AAC, with story backdrops in every scene.
- **The water-cycle script was hand-written for the test copy**, because two Muse Wonder story drafts failed the existing story checks. The images, player and MP4 for it are real.
