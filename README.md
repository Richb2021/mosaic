# Lanternbound

A working browser JRPG for Mosaic: eight reusable areas, a two-person party, turn-based combat and story-integrated learning mechanisms. Choose Mira (female) or Ren (male) as the lead; Ivo travels with either. The choice changes the model and story name and persists with the adventure.

## Play locally

Requires Node 22 or a compatible modern Node runtime.

```sh
npm ci
npm run build
npm run dev
```

Open the printed localhost URL (default port 8878). WebGL is required. Music starts only after the player enables it. Saves and imported topics stay in the browser.

Move with WASD/arrows, click the ground or an object, or open **Menu → Go to**. Press **E** near an interaction. The map offers return travel to discovered places. Restore mechanisms in the woods, mill, archive and observatory, then challenge the Warden at the Last Beacon. Rest at the harbour spring to restore the party.

Combat: Strike, three elemental spells, Guard, Inspect, Tonic and Retreat. Spells cost 4 MP. Guard reduces incoming damage and restores 3 MP. Every third enemy round brings a heavy attack. The game preserves completed mechanisms after defeat.

## Change the topic

Menu → Change story contains three authored packs: water and systems, fractions and proportion, and evidence and arguments. Export a pack, edit the JSON and give it a new lowercase `id`; import it through the same screen. Original built-in ids are protected. The story, eight keeper dialogues, four mechanisms, hints, explanations, references and ending change without rebuilding the world. Each content version has a separate save.

The demo does not call Muse Wonder or claim to generate arbitrary curriculum content. The intended production connection is: reviewed resource evidence → Muse Wonder authored pack → schema and solution validation → teacher review → this runtime. Keep the game rules and executable code authored.

## Code map

- `src/engine.js`: deterministic combat, puzzle checks, topic and save validation.
- `src/maps.js`: eight declarative area layouts, interaction anchors, collisions and routes.
- `src/world.js`: Three.js renderer, movement, path following, battle staging and spell effects.
- `src/character.js`: cloned skeletons, animation blending, in-place locomotion and action clips.
- `src/music.js`: user-enabled audio, transitions, instance cleanup and background-tab pause.
- `src/main.js`: game state, accessible HTML controls, dialogue, menus, import/export and local saves.
- `public/topics/`: editable examples of the topic contract.
- `public/assets/`: actual Blender and Meshy GLBs; portraits, manifests and editable-asset provenance.
- `public/audio/`: four prepared Suno cues, with original clip links in `manifest.json`.

## Art and animation

The active asset set has 37 GLBs, combining original modular Blender scenery and weapons, Meshy creatures/landmark, four rigged Meshy 7.1 characters, and seven licensed Polyfork buildings, trees, cart and barrel models. The four humanoids use new Polyfork-style references, Meshy 7.1 image-to-3D with T-pose control, reviewed source hashes and six skeletal clips: idle, walk, strike, casting, guard and hit reaction. Blender preserves the skeletons and clips, normalizes exports and prepares portraits. The former guardian rig has been rejected and removed. Completed combat actions fade out correctly rather than remaining blended into idle.

[Art direction and character acceptance](docs/ART-DIRECTION.md) defines the shared Polyfork palette, shape language, T-pose requirement, deformation review and explicit Meshy 7.1 production rule. The two original non-humanoid Meshy assets are historical T2.5 outputs; provenance is retained accurately. The fox remains unrigged.

Source-generation scripts and editable Blender files are retained in the parent Hackathon workspace under `scripts/`, `output/rpg/assets/` and `output/rpg/characters/`. Credentials and expiring service download links are excluded from this application repository. VT323 is bundled under the SIL Open Font License in `public/fonts/OFL.txt`. Three.js and esbuild retain their package licences.

## Add another asset provider

Use GLB with Y up, a ground-level origin and +Z forward for characters. Keep semantic role names stable (for example `house`, `tree`, `hero_female`), then replace their mapped file or add a role to the asset catalog. Animated replacements need equivalent named clips or a mapping in `character.js`; root travel belongs to the controller. Keep collision and interaction anchors in `maps.js`, independent of visual meshes. Record provider, original asset id, licence, dimensions and any conversion in the asset manifest. Polyfork is connected through Baldur and its first two props are embedded in this build. Its models are licensed for use inside the game, not redistribution as a standalone asset pack.

## Verification

```sh
npm test
npm run build
```

The parent workspace also contains real-browser journey checks (`scripts/play_rpg_demo.py`) and focused character, animation, direction, sound and mobile checks (`scripts/check_rpg_revision.py`). They operate normal UI controls and inspect read-only snapshots. `window.__LANTERNBOUND__` returns copies for observation; it does not expose a mutation or teleport API.

This is a single-player demo, not the full school platform. It has no school accounts, resource ingestion backend, grading, multiplayer or validated mastery model. Puzzle observations and battle XP are deliberately separate.

## Field world

All eight regions use larger 44 × 36 walkable maps, continuous surrounding terrain and a close orthographic camera that follows the party. Forest belts and quarry rocks block the edges; Polyfork cottages and two-storey buildings enclose streets. Roads connect cardinal neighbours and arrive on the matching side. Walk to a road end to travel, or select its sign from the menu. Foreground buildings fade when they hide the party. Fast travel still returns to the town centre. Existing version-1 saves remain compatible.

The regions are connected scenes, with a transition between them; this is not a streamed open world. Buildings currently provide scenery and collision, without explorable interiors.
