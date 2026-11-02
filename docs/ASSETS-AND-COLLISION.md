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
