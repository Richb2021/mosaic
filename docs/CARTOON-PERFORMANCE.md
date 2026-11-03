# Performed cartoons

New Muse Wonder cartoon requests use schema 3. Existing schema 1/2 records retain their original validation and hashes. Podcasts retain schema 2. Genre, chosen learner interest, starting point, focus and reviewed source packet continue into the request.

Muse chooses one featured prop and scene performances from closed lists. The renderer owns all motion, timing, geometry, contact points and physics. A strict inventory checks pickup, handoff, placement, activation and carrying across settings. The review screen exposes the actor, movement and prop interaction; all edits require fresh exact-hash approval. Existing ownership, narration caching, deletion and retention controls remain in force.

## Animation library

Prism anime and Paper comedy have 12 motions per character: idle, talk, explain, think, react, celebrate, walk, run, reach, jump, kick and pickup. Two characters × two styles = 48 keyed clips, plus 24 backgrounds. Source videos use Sorceress/Wan 2.7 and Corridor Key. Each frame has reviewed/tracked mouth and hand metadata tied to the hashed sprite sheet. One shared crop per character prevents per-frame rescaling. The selected style is bounded to 240 MiB decoded artwork; styles are not all loaded together.

Original vector props: football, lantern, key, parcel, book and power cell. These are story objects, not diagrams encoding assessed quantities. Ground contacts, handoffs and seeking are derived deterministically from the complete script. Field Notes provides a simpler vector performance with its own rig contacts.

## Recorded speech drives mouths

The browser uses self-hosted `lip-sync-engine` 1.0.3, a Rhubarb/PocketSphinx WebAssembly port. The actual decoded narration and exact spoken text produce timed visemes. Original Rhubarb A–H/X semantics are used. Baked sprite mouths are covered at tracked anchors before drawing the selected mouth shape; listeners and gaps have closed mouths.

Analysis runs in one dedicated worker after narration is prepared. It does not call a speech provider, upload recordings, request a microphone or create a new persistent learner record. The worker terminates on completion, cancellation, error and timeout. Models are split below the hosting per-file ceiling; upstream notices and hashes are in `public/lip-sync/v1/`. If analysis fails, the player states that lip sync is unavailable and keeps faces at rest while audio/transcript remain usable.

Playback, pause, speed, scene seeking, reduced motion and WebM export use the same audio clock and cue data. Existing retained narration works without another Fish generation. Speech analysis is currently verified for English; language support and device-memory claims must not be broadened without testing.

## Verification and source assets

Run `npm test` and `npm run build`. The workspace acceptance script `../scripts/cartoon-performance/verify.mjs` checks provider receipts, schemas, artwork hashes, all 21 example recordings and actual WASM analysis of both sample voices. Browser/export evidence and generation receipts are in `../output/cartoon-performance/`.

Provider source jobs are retained on Baldur at `~/projects/mosaic-cartoon-performance`. Scripts there resume saved IDs; a timeout never authorizes duplicate generation. Initial keying failures, baked objects in early kicks and an incomplete pickup are retained as rejected takes; only reviewed replacements enter the manifest. Contact frames, hand annotations, occluded faces and selected-frame repairs are recorded in the workspace evidence.

Primary implementation sources: https://github.com/biolimbo/lip-sync-engine and https://github.com/DanielSWolf/rhubarb-lip-sync . The port's README mouth-shape table differs from the original Rhubarb convention; runtime mapping follows Rhubarb's source/output convention.

### Anime lip correction (v61)

Male anime mouths use reviewed frame-specific lip landmarks, skin-only colour sampling and a smaller, shallower viseme. Already closed source mouths are preserved at rest; hand-occluded mouths are not overpainted. Anime listeners use the closed-mouth idle clip instead of the open-mouth reaction clip when stationary. Other intentional actions remain available. Female anime and Paper artwork/anchors, Field Notes drawing and all narration are retained. The workspace repair script and reviewed landmarks are in `scripts/cartoon-performance/repair-anime-mouths.py` and `output/cartoon-lip-fix/`; reapply them after rebuilding/tracking the atlas. Pixel acceptance renders both speakers across all three styles and checks that speech-cue changes affect only the active character.
