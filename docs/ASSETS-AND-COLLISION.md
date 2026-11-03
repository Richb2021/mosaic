# Shared game art and ground collision

The November 2026 expansion adds 51 painterly Sorceress images (five scenes,
16 draft illustrations, 12 adventure props, 10 town buildings and eight craft
pieces), plus 12 native-scale Polyfork medieval-village models. Both public
manifests retain source job/asset IDs and SHA-256 checksums. Polyfork files are
embedded game assets, not a standalone downloadable asset pack.

Artwork is an authored library. Reviewed topic packs choose existing content
slots; generation cannot provide arbitrary URLs, geometry, code or new rules.
The legacy pack fingerprint and save schemas are unchanged. Historic positions
covered by newly solid scenery are moved to the closest safe ground position;
quest progress is preserved.

## Spatial games

`navigation.js` supplies bounds, radius-expanded ground rectangles, swept
segment tests, reachable grid routes and clear interaction approaches.
`movement.js` checks the whole travelled segment, including thin fences and
large frame budgets. Keyboard movement slides along unobstructed axes.
`prop-collision.js` supplies model base footprints, rotated/scaled footprints,
bridge rails and NPC/enemy occupancy. Character and companion click paths use
the same navigation geometry. Trees block at their trunks, not their canopies.
Door openings and bridge decks remain walkable.

The 2D adventure uses percentage ground coordinates with a fixed depth scale,
matching prop bases and NPC footprints. Keys, click-to-walk, reduced motion
and direct interaction resolve through the same safe routes. Sprite layering
uses foot depth inside the scene's isolated stacking context; dialogue stays
above every actor and prop.

These are authored ground collisions for exploration, not a general 3D rigid
body physics engine or pixel-perfect tests against painted scenery.

## Board and story games

Town tiles reject occupied land and river construction. Merge slots preserve
occupied pieces, validate recipes, and permit recovery through undo/recycling.
Sports uses authored lane interceptions and possession transitions, not free
movement of physics bodies. Draft slots, quiz graph edges and novel branches
retain their deterministic legality checks. Art does not change those rules.

## Verification

Run `npm test` and `npm run build`. `tests/collision.test.mjs` exercises thin
obstacles, sliding, off-grid starts, all authored RPG interaction anchors,
five dungeon rooms, all legacy/expanded adventure hotspots, rotated prop
footprints, save-position recovery and line of sight to interactions.
Asset manifests and browser evidence are checked by the workspace release
verifier `scripts/verify_assets_collision.py`.

## Scenery collections (November 2026)

The new `public/game-modes/variety-art/manifest.json` adds Sunstone Coast,
Frostvale Highlands and Copperfield Reach. Each collection contains six adventure
rooms, a football pitch, a crafting bench, a town backdrop, twenty civic/industry
sprites, twelve ground props, eight crafting icons and sixteen draft illustrations.
These are fictional visual settings, not historical evidence. Characters retain
the existing approved animated sheets.

`src/game-modes/scenery.js` resolves only curated local paths. A deterministic
story palette or a per-game device preference selects the artwork. It never changes
a reviewed pack, citation, content hash, game rule or learner save. Returning to the
original Riverlight art remains available. The selector flushes the existing save
workflow before remounting; game modal accessibility also covers this outer control.
Only images used by the current game are fetched, not every image in every collection.

The RPG adds twelve native-scale Polyfork Medieval Village models and twelve original
Blender models. `public/assets/variety-manifest.json` records provenance, SHA-256,
measured bounds and bytes; `src/variety-props.js` records ground footprints. All are
placed in `src/maps.js`. Tree canopies remain passable above a solid trunk. Tall
buildings participate in the existing character-visibility fade. Existing enterable
buildings, interaction positions and travel corridors retain their original roles.

Production sources, provider job receipts, editable Blender source, contact sheets
and browser evidence live in `../output/asset-variety/`. The Sorceress pipeline uses
`gpt-image-2.5-sunburst`; each cutout is cropped before cloud background removal to
avoid the keyer's whole-sheet resolution cap. Copperfield card captions are cropped out,
and its woodland scene uses the reviewed forest revision recorded in the output
overrides manifest. No new Meshy or humanoid rig was
created in this batch. Polyfork assets remain embedded in the game, not distributed
as a standalone asset download.

Acceptance: `tests/scenery.test.mjs`, `tests/collision.test.mjs`,
`tests/world.test.mjs`, legacy identity fixtures, full `npm test`, `npm run build`,
and the nine-format browser record referenced by
`../scripts/asset-variety/verify.mjs`. Physical-device and spoken screen-reader
conformance are separate from these browser checks.
