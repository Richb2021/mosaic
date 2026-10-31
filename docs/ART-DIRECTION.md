# Lanternbound art direction

Polyfork's **Medieval Village Kit** is the shared visual reference. The game remains a mid-1990s-inspired JRPG in camera, pacing and interface, while its models use Polyfork's readable low-poly forms. Meshy and Blender additions must belong beside the library assets.

## Shape and materials

- Deliberate broad planar surfaces; clean silhouettes and readable faces. Avoid noisy decimation, crumpled triangle patterns, realistic muscle detail and painted fabric texture.
- Adult human proportions consistent with Polyfork's village guard. Keep Mira and Ren equally practical adventurers; Ivo uses the same body language and scale.
- Muted wood browns, stone greys, cream, dusty blue, restrained teal and moss green. Strong colour is reserved for interactive crystals, spell effects and important landmarks.
- Flat or deliberately faceted geometry, matte materials, no realistic PBR detail. Inspect under the game's lighting; do not hide problems behind a store render or a different tone mapper.
- Buildings and props have ground-level origins and authored collision bounds. Polyfork downloads retain real metre scale. Its cart and barrels are integrated in the harbour and mill as library references.

## Meshy production rule

**New Meshy generations use `meshy-7.1` explicitly.** The original prototype had three T2.5 scenery/creature outputs; their historical receipts remain accurate. Do not relabel an old model as 7.1.

For a new humanoid, create a clean reference image in this style, then use Meshy 7.1 **image-to-3D** with `pose_mode: "t-pose"`. Text prompts and successful job statuses do not prove pose compliance. Aim for approximately 3,000–5,000 triangles for a party character. Preserve topology around shoulders, elbows, hips and knees.

## Required character acceptance

1. Render the actual source mesh from front and side. Arms must extend horizontally, elbows and wrists straight; legs and hands must be separate. No held weapons, capes or geometry bridges between limbs. Keep weapons as independent hand attachments.
2. Record visual approval against the **SHA-256 of that source GLB**. The pipeline must not rig a source with absent or stale approval. A local modification must be uploaded as the rig input, rather than accidentally rigging its old provider task.
3. Inspect the rig's rest pose, joint placement, weights and all exported clips. T-pose alone does not guarantee correct skinning.
4. Sample idle, walk, strike, casting, guard and hit reaction throughout each clip. Check abnormal edge stretching numerically, then review front/side poses and the actual battle camera. Check blends between clips as well as isolated poses.
5. Confirm movement direction, collision, action completion and save/reload in the real game. Reject the asset if the limbs collapse, stretch, fuse, invert or detach.

The rejected guardian and subsequent experiments are retained outside the published game for comparison. They are not acceptable fallback characters. Neither an animation's name nor a changing bone quaternion proves that its mesh deforms correctly.

## Polyfork use

Use the Baldur Polyfork integration; credentials stay on Baldur. Record the source asset ID, kit, licence and conversion in `public/assets/polyfork-manifest.json`. Ship licensed models embedded in the game; do not redistribute them as a standalone asset pack. Library humanoids use their own animation conventions and need an adapter and the same runtime checks before replacing a Meshy rig.

For larger new areas, inspect a complete Polyfork kit composition and its collision/terrain helpers first. Keep educational objectives and story anchors separate from the visual kit, so a harbour, laboratory, forest or stadium can support different topics without rewriting the game rules.

References: [Polyfork Medieval Village Kit](https://polyfork.dev/kit/medieval-village-kit-ca0b43), [village guard](https://polyfork.dev/asset/village-guard-5f0f6f), [licence](https://polyfork.dev/licensing), [Meshy pose-control guidance](https://help.meshy.ai/en/articles/10255659-how-to-generate-3d-models-with-a-pose-t-pose-or-custom-poses).
