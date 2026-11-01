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

The active asset set has 47 GLBs, combining original modular Blender scenery and weapons, Meshy creatures/landmark, four rigged Meshy 7.1 characters, and eleven licensed Polyfork buildings, trees, props and resident models. The four humanoids use new Polyfork-style references, Meshy 7.1 image-to-3D with T-pose control, reviewed source hashes and six skeletal clips: idle, walk, strike, casting, guard and hit reaction. Blender preserves the skeletons and clips, normalizes exports and prepares portraits. The former guardian rig has been rejected and removed. Completed combat actions fade out correctly rather than remaining blended into idle.

[Art direction and character acceptance](docs/ART-DIRECTION.md) defines the shared Polyfork palette, shape language, T-pose requirement, deformation review and explicit Meshy 7.1 production rule. The two original non-humanoid Meshy assets are historical T2.5 outputs; provenance is retained accurately. The fox remains unrigged.

Source-generation scripts and editable Blender files are retained in the parent Hackathon workspace under `scripts/`, `output/rpg/assets/` and `output/rpg/characters/`. Credentials and expiring service download links are excluded from this application repository. VT323 is bundled under the SIL Open Font License in `public/fonts/OFL.txt`. Three.js and esbuild retain their package licences.

## Add another asset provider

Use GLB with Y up, a ground-level origin and +Z forward for characters. Keep semantic role names stable (for example `house`, `tree`, `hero_female`), then replace their mapped file or add a role to the asset catalog. Animated replacements need equivalent named clips or a mapping in `character.js`; root travel belongs to the controller. Keep collision and interaction anchors in `maps.js`, independent of visual meshes. Record provider, original asset id, licence, dimensions and any conversion in the asset manifest. Polyfork is connected through Baldur; its scenery and four native resident variants are embedded in this build. Its models are licensed for use inside the game, not redistribution as a standalone asset pack.

## Verification

```sh
npm test
npm run build
```

The parent workspace also contains real-browser journey checks (`scripts/play_rpg_demo.py`) and focused character, animation, direction, sound and mobile checks (`scripts/check_rpg_revision.py`). They operate normal UI controls and inspect read-only snapshots. `window.__LANTERNBOUND__` returns copies for observation; it does not expose a mutation or teleport API.

This is a single-player demo, not the full school platform. It has no school accounts, resource ingestion backend, grading, multiplayer or validated mastery model. Puzzle observations and battle XP are deliberately separate.

## Field world

All eight regions use larger 44 × 36 walkable maps, continuous surrounding terrain and a close orthographic camera that follows the party. Forest belts and quarry rocks block the edges; Polyfork cottages and two-storey buildings enclose streets. Roads connect cardinal neighbours and arrive on the matching side. Walk to a road end to travel, or select its sign from the menu. Foreground buildings fade when they hide the party. Fast travel still returns to the town centre. Existing version-1 saves remain compatible.

The regions are connected scenes, with a transition between them; this is not a streamed open world. Eighteen buildings now have explorable interiors, residents and persistent story interactions.

## Enter the towns

Click a building or choose its entrance under **Menu → Go to**. Walk through the doorway, speak to the resident, inspect ledgers and use work tables. Select the exit or walk to the open south doorway to leave. The world contains an inn, homes, shops, a bakery, workshops, a millhouse, reading rooms and an observatory study. Native Polyfork residents use a separate skeletal adapter with a CC0 Quaternius talking clip; four source variants retain their T-pose rest skeletons.

Start a request with Maren at **The Amber Lantern** in Sunward Quay, Jori at **Jori’s Workshop** in Cinder Workshop, or Sable at **Cloudscript Reading Room** in the Archive. Each of the three topics has three distinct four-step stories. Find clues in other households, make a practical decision, then return to the resident. Hints explain the reasoning; an unsuccessful plan preserves progress. Completed requests change resident dialogue and add a small visible room consequence. **Menu → Requests** tracks the next lead and keeps collected clues.

Shops buy and sell tonics and ether. The outfitter sells two permanent party charms. The inn costs eight coins and restores HP/MP. **Menu → Satchel** uses supplies outside battle. Coins come from encounters, supply chests and completed requests. Rewards are granted once per request, and a room, inventory and request progress survive reloads. Original version-1 adventure saves retain their progress.

The content contract and room identifiers are documented in [SETTLEMENTS.md](docs/SETTLEMENTS.md). Companion stories live in `public/settlements/`. Exports include the editable `settlement` section; older custom topics receive a household request using their own allocation task. Unchanged custom export/import retains its save. Built-in story wording edits retain request progress; structural edits reset unfinished requests but preserve completed rewards.

`tests/settlement.test.mjs` covers room reachability, save migration, shops, healing, all nine quest chains and malformed content. `tests/resident.test.mjs` parses all four GLBs and checks animation/clone isolation. The parent `scripts/check_rpg_interiors.py` walks all eighteen interiors, completes five quest chains across the three topics, checks commerce, inn recovery, persistence, keyboard focus, mobile layouts and imports through the real UI.

### JRPG depth release

Individual equipment and permanent AP techniques, support ability budgets, distinct hero roles, enemy tactics, Rally abilities, eight companion scenes, six exploration rewards, practice battles and directed battle/victory presentation are now available. Existing topic saves migrate additively. See [the comparison, controls and remaining production gaps](docs/JRPG-GAP-REVIEW.md).

## Underlight Works chapter

From Tidewheel Mill, open **Menu → Underlight Works** in the destination list. Recruit Nessa in the concourse, restore the gallery and reservoir, repair the workshop shortcut, then configure and confront the Unwinding Heart. Three topic-specific versions share the five-room world and its rules. The chapter includes group battles, a third companion, machine intentions, a boss phase change, a persistent town decision and Lantern Lines.

**Menu → Save journal** provides manual slots and portable backups. **Player settings** provides remapping, text size, graphics, gentler chapter combat and sound effects. **Chapter workshop** stages edited topic content for review before activation.

See [the chapter guide](docs/UNDERLIGHT-WORKS.md) and [dynamic content / ownership contract](docs/DYNAMIC-OWNERSHIP.md). This is still an owner-private static preview with browser saves. Authenticated workspaces, uploaded-resource retrieval, cross-device sessions and live Muse Wonder calls are not yet connected.


Resource workshop: see [Dynamic game content](docs/DYNAMIC-CONTENT.md). The private site now has a server-backed resource and chapter library; existing game saves remain browser-local.

## Personal learning studio

Open `/studio.html` for saved learner preferences, reviewed topics, starting checks, explainable programmes and a shared practice trail. See [the implementation scope](docs/PERSONAL-STUDIO.md) for behavior, storage and tested limits.
