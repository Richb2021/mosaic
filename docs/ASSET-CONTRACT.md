# Reusable asset and area contract

An area is a name, palette, audio cue, list of visual props, rectangular collision bounds and typed interaction anchors. Rendering and pathfinding never inspect educational content. `src/maps.js` contains all eight configurations.

| Area | Reusable setting | Interaction function |
|---|---|---|
| Sunward Quay | Harbour settlement | Introduction, rest, supplies, three routes |
| Mossbell Woods | Woodland trail | Sequence mechanism, optional battle |
| Tidewheel Mill | Waterworks / resource plant | Allocation mechanism |
| Prism Hollow | Cave / crystal quarry | Optional encounter and evidence dialogue |
| Cinder Workshop | Forge / engineering yard | Optional encounter and evidence dialogue |
| Starfall Observatory | Sky station / laboratory | Three-dial mechanism |
| Cloudscript Archive | Library / research station | Matching mechanism |
| The Last Beacon | Landmark / final arena | Four-seal gate, guardian, ending |

A topic pack does not need to make every area a literal representation of its subject. It can retell an investigation or embed quantities and evidence in the fictional world's problems. Preserve the distinction between a fictional scenario constraint and a real-world claim. All three examples state their context and include public reference links.

For new models, follow [the Polyfork-based art direction](ART-DIRECTION.md). New Meshy jobs must explicitly use **7.1**. Humanoid source meshes require a visually inspected T-pose before rigging, with approval tied to the exact source-file hash. Normalize scale and orientation in Blender, preserve supported skeletal clips, limit textures to the intended device budget, provide separate authored colliders, and test actual walking and actions. Keep provider receipts outside published code; publish only safe asset provenance. Never treat an automatically generated rig as proof of correct animation—inspect both surface deformation and the runtime.

Polyfork is connected through Baldur. Cottages, two-storey houses, cart and barrels from the Medieval Village Kit, plus maple, pine and birch trees, are imported with original dimensions, named nodes and colours retained. For further licensed GLBs, use the same pipeline. Keep level logic and learning content independent of its API. Start with buildings, terrain transitions, interiors and props; verify rig and clip compatibility independently for characters.

## Region layout

Each region has a cardinal `worldCell`, shared `bounds` (22 m either side of the origin, 18 m north/south), roads, solid props, collision belts and instanced backdrop scenery. Every neighbouring road must have a reciprocal exit. Road travel places the party 2.5 m inside that exit; fast travel uses the central safe spawn. Keep a clear 7.2 m corridor through backdrop trees around each road. Test routes from every arrival to every interaction anchor.

Use a screen-door canopy cutaway around both party members to prevent foreground trees hiding them. Keep licensed tree meshes instanced so dense boundaries do not add one draw call per tree. Dispose instance buffers and cloned occlusion materials on area changes, while retaining shared cached source geometries. Large foreground buildings receive per-instance materials for the party cutaway.
