# Lanternbound — playable JRPG slice

Build date: 31 October 2026. Working demo for Mosaic, not the full learning platform.

## A complete adventure
Mira or Ren, a courier, and Ivo, a lantern keeper, travel through an archipelago whose lighthouse has gone dark. Four old mechanisms hold its seals. Read the landscape, speak to people, restore the mechanisms and face the guardian at the beacon. The ending reflects the chosen topic. Battles are tactical play; knowledge is woven into the investigation and mechanisms rather than charged as a toll before every sword swing.

Eight reusable environments: Sunward Quay, Mossbell Woods, Tidewheel Mill, Prism Hollow, Cinder Workshop, Starfall Observatory, Cloudscript Archive and the Last Beacon. One shared runtime owns all areas. Each map is a configuration of modular scenery, collisions, exits, NPCs and interaction anchors.

Three authored topic packs: water and systems, fractions and proportion, evidence and arguments. Each changes the story, dialogue, clues, four puzzles, explanations, source notes and ending. JSON import/export provides real runtime amendment without executable generated code. A Muse Wonder content adapter can later produce this validated contract; the demo does not claim live AI generation.

## Scope that must work
- Keyboard and click/touch walking, collision and pathfinding, neighbouring-area exits, map and reachable interaction list.
- Two party members, HP/MP, turn order, attack, elemental spells, guard, inspect, items, retreat, enemy telegraphs, victory and recoverable defeat.
- Sequence, allocation, matching and dial mechanisms with feedback, hints, completion state and a visible world change.
- A beginning, four seals, a final guardian and an ending; optional chests, field encounters and lore.
- Topic-specific device saves, reload recovery, explicit fresh-start confirmation, import validation and failure states.
- Original Meshy MCP models and Blender modular art, with receipts, editable sources, normalized exports and browser inspection.

## Visual direction
Mid-1990s JRPG camera, pacing and interface, with **Polyfork Medieval Village Kit** as the model-style reference. Clean broad planar forms, simple readable faces, adult proportions, matte materials, restrained colour and no noisy painted detail. The Blender scenery uses muted moss greens, wood browns, cream, stone grey and dusty blue aligned to Polyfork's guard/tree/prop palette. Party characters and the guardian were rebuilt from matching image references using Meshy 7.1's image-to-3D T-pose control, visually inspected before rigging. See [the full art direction](ART-DIRECTION.md).

The HUD uses bundled VT323 and a restrained navy/ivory/brass palette. The world occupies the screen; the pause menu and battle strip reveal information when needed. Touch controls, visible focus and optional music are available.

## Reuse contract
The immutable world template defines eight area IDs and four puzzle anchors. A topic pack owns educational material and story copy. Rendering does not know the topic. Puzzle types validate their own finite solutions; battle rules remain authored and deterministic. Keep learning observations separate from XP and combat wins. Store attempted mechanisms, hint use and concept notes; do not label these as measured mastery.

## Proof before delivery
Run unit checks for combat, puzzle correctness, topic/save isolation and malicious/invalid imports. Run the real browser from start through the ending, reload during play and battle, switch packs, import an edited pack and exercise mobile controls. Inspect every area and battle, verify all GLBs load, check runtime errors, and retain screenshots and a short recording. Publish a private Sites build after the exact source revision passes.

## Boundaries
This is a focused single-player browser demo with local saves. It has no school accounts, backend resource uploads, production grading, multiplayer, live AI tutoring or generated unlimited worlds. The party and stone guardian have Meshy auto-rigs and six skeletal clips each. The fox remains an unrigged creature; spell effects are authored runtime geometry. The three source-backed topic packs are examples, not a claim of universal subject coverage.

## Revision after playable review
The user rejected the initial block-built party, missing combat animations, reversed facing and generic overlay layout. Replace the party with three proper humanoid Meshy characters (female and male lead options plus Ivo), auto-rigged and animated, prepared in Blender with preserved skeletons. Use an explicit +Z-forward character contract and camera-relative walking. The player chooses the lead's appearance; it persists per adventure.

Revised interface: a restrained console-RPG frame rather than dashboard panels. Location in the upper corner; compact menu and seal status opposite; contextual interaction prompt at the bottom. Party statistics appear in the pause menu and battle strip. Navigation assistance remains available in the menu, not as a permanent list over the world. Dialogue uses a single story window with a character portrait. Battles use a dedicated bottom command bar, animated action timing and visible strike/spell feedback. Remove repeated eyebrows, rounded cards and product implementation copy from normal play. Design palette: ink #152337, ocean #315c74, ivory #eee7d3, brass #bca76c, teal #6ca391; use a locally bundled readable game typeface where available. Asset providers remain isolated behind a manifest with Polyfork now connected through Baldur and its cart/barrels already embedded.

## Soundtrack
Four Suno v6 instrumental cues were generated through the official MCP on Baldur: Roads of Amber (travel), Quiet Constellations (discovery), Courage in the Clockwork (battle), and A Light Restored (victory). The three longer game tracks are about 107–108 seconds and loop with a prepared boundary crossfade; the victory cue is an 18-second one-shot. Volumes are normalized for background use. Music is optional, transitions with game state, pauses when the tab is hidden, and has a player volume control. The compositions carry no topic-specific lyrics, so they remain reusable across stories. Both generated variants per cue and the selected original downloads are retained in the parent workspace; the game uses one prepared version of each.

## Next production work
Use this slice as the executable reference for the wider Mosaic RPG module. Prioritize a reviewed topic authoring workflow linked to the Resource Library; additional regions and more nuanced quest consequences; additional puzzle templates; varied enemies and party abilities; checkpointed content migrations; controller support; and asset art direction across scenery and characters. Expand areas using coherent licensed Polyfork kit compositions, retaining collision and story anchors. New Meshy work explicitly uses 7.1; every humanoid must pass source T-pose review, deformation sampling and actual game playback. Keep subject evidence, world templates, animation controllers and source-provider integrations separate.


## Rig correction and verification
The previous guardian was rejected for severe skin stretching. All four humanoids now have reviewed T-pose source meshes, hash-bound rig inputs and traceable animation outputs. The animation controller also releases completed one-shots properly and settles interrupted actions, preventing stale strike/cast poses from accumulating. The prior rig/world release passed 21 unit tests, 30 focused browser checks, 11 field-world checks and 29 full-adventure checks. Surface motion, stretching and collapse were sampled in all 24 clips; 72 rendered action poses and actual gameplay screenshots were inspected. T-pose is a production requirement, not a substitute for checking skin weights and animation results.

## Connected field-world revision

The normal map now follows the party through full-screen terrain, streets and large library buildings, rather than showing the entire location as a floating diorama. Eight 44 × 36 regions join through geographically consistent roads. Dense forest or quarry rock boundaries restrict exploration, with road openings leading to the next area. Road travel preserves the direction of arrival. Foreground buildings become transparent around the party, and forest canopies use a dithered cutaway to keep both travellers visible.

Seven Polyfork asset types are embedded alongside the Blender kit and Meshy characters. The 360-or-so backdrop placements per area are instanced. This remains a connected-scene JRPG; world streaming remains future scope.

## Living settlements

Eighteen existing building shells lead into furnished rooms with residents, visitors, readable ledgers, planning tables and safe return doorways. The room kit uses six new Blender props alongside the original kit, with a shared matte Polyfork palette. Three shops provide consumables and party charms; the inn and satchel provide paid rest and field recovery.

Three optional four-step request chains per topic make learning part of neighbours’ problems: organising a supper, repairing a signal and resolving a record dispute. Water stories investigate flows, condensation and evidence of evaporation; fractions stories allocate portions, compare measures and reconcile equivalent fractions; evidence stories distinguish narrow claims, independent corroboration and correlation. The teaching content changes while buildings, actors and interaction types remain reusable. This is nine authored chains, not unlimited AI-generated quests.

Residents remember outcomes, the journal preserves clues, next leads name a destination, and completion adds a modest room change. Coins and XP are game rewards; they do not certify learning. Quest progress, room position, visited interiors, gear and consumables persist locally.
