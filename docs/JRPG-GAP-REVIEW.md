# Lanternbound — closing the gap to PlayStation-era FFVII / FFIX

Comparison: the original games’ structure and feel, not the modern FFVII remakes. This is a development benchmark for an original educational JRPG, not a plan to copy their characters, worlds, music or assets. Reviewed 31 October 2026.

## What changed in this release

The previous build had a connected world, 18 interiors, residents, shops and topic-specific quests, but the two heroes mostly shared the same actions. Exploring did little for character builds, and the plot arrived mainly through isolated text boxes. This release connects exploration, equipment, character identity, battles and story.

| Gap | Previous build | Now playable | Still needed for the benchmark |
|---|---|---|---|
| Character identity | Almost identical commands | Courier sword techniques; Ivo’s protection, healing and spell preparation; individual loadouts | Larger recruitable cast, party composition and character-specific field skills |
| Equipment decisions | Two shared stat charms | 10 weapons/coats including starters; attack, magic and defence bonuses; new techniques | Visible weapon variants, accessories, trade-offs and a larger balanced catalogue |
| Long-term growth | Shared XP/levels | AP from worn equipment makes techniques permanent; support abilities use a three-point budget | Richer build combinations, respec explanations, level/encounter balance across a campaign |
| Combat decisions | Weakness spell or basic attack | Expose, Shelter, Focus, Mend, scorch, resistance, crystal shell and a stronger second boss phase; visible enemy intent | Multiple foes, target selection, formation/rows, more statuses, multi-phase bespoke bosses |
| Dramatic abilities | None | Earned Rally: Courier’s Dawnstride attack; Ivo’s Hearthlight party recovery | Unique action choreography and effects for each hero; wider tactical interactions |
| Battle rhythm | Fixed party turns | Fixed party turns retained; clearer enemy telegraphs and action camera | Real-time ATB with a readable wait mode and accessibility controls; this release does **not** claim ATB |
| Character scenes | Topic dialogue at anchors | Eight optional original “Between the roads” scenes, choices, portraits, camera focus and a chapter journal | Branching consequences, character acting, staged blocking, more NPC-to-NPC events and a longer authored arc |
| Exploration rewards | Supply chests | Six off-road discoveries grant useful equipment; collected glints disappear and enter the chronicle | Secret passages, vertical routes, environmental riddles, rare encounters and traversal abilities |
| Continued play | Four one-time battles | Practice defeated road foes at the harbour for AP; no duplicated story rewards or supply consumption | Repeatable field encounters, difficulty curves and diverse enemy models |
| Presentation | Static battle camera and text logs | Action framing, floating damage/recovery numbers, victory/AP screen, room fade and console-style equipment/chronicle menus | Authored camera compositions per location, stronger silhouettes, detailed lighting, bespoke animation and audio effects |
| Town life / quests | 18 furnished interiors, nine quest chains across three topics | Preserved; equipment added to the Brass Thread outfitter | NPC movement/schedules, more varied interiors and multi-area quest consequences |
| Side activities / world scale | Four reusable learning mechanisms | Preserved, with character/exploration rewards alongside them | Original card/table game, fishing or another coherent recurring activity; world travel, vehicles and more regions |

The most significant remaining visual gap is environmental composition and asset variety. Systems now give the player more reasons to explore and make decisions; the art still uses the existing stylised low-poly kit. No new Meshy, Blender or Polyfork models were created for this release. All existing humanoid source/rig checks remain required.

## How to try the new features

1. Continue your existing save. Open **Menu → Party & equipment** to inspect both heroes’ techniques and loadouts. Older saves receive starter equipment without losing their quests, topic, character selection or progress.
2. Choose **A moment with Ivo** in the field, or **Menu → Story so far**. Scenes unlock when their area is visited; the final scene needs four seals. Leaving early does not mark a scene complete. Remembered scenes preserve the original recorded choice and return to the current location, including interiors.
3. Look off the main roads for small crystal glints. Sunward Quay’s discovery gives a Reed coat. Equip it and activate Steadfast in the support section.
4. Visit the **Brass Thread** outfitter for weapons and coats. Weapons are role-specific; coats are usable by either traveller. Ownership is a shared catalogue, so both heroes may use an owned coat. Equipment cannot be sold in this build.
5. In battle, use **Feint** to expose a foe, **Shelter** to reduce incoming damage, or learn the abilities granted by new gear. Equipment AP advances only the weapon and coat currently worn. Once mastered, a technique remains available after changing equipment. Support abilities must also be activated within the point budget.
6. Rally grows through actions and damage. At 100, **Dawnstride** or **Hearthlight** becomes available. It is a dramatic ability meter, not an ATB gauge or an assessment of learning.
7. At Sunward Quay, choose **Menu → Practice by the spring**. Defeated Bramble, Prism and Cinder foes unlock repeatable practice. Each win grants 3 equipment AP. Practice restores HP/MP and resets Rally, uses no supplies, and grants no XP, coins, tonic or quest reward. Mid-practice reloads are supported.

## Narrative and learning relationship

The original companion arc follows Ivo confronting his role in centralising the beacon and erasing warnings from its records. The party rebuilds trust through listening, comparing evidence, repairing local systems and sharing responsibility. Those themes support the existing topic-specific quests without asserting unverified facts about a subject. Choices currently select an immediate response and a saved memory; they do not change combat statistics or create branching endings.

The three authored topic packs and editable/importable topic format remain intact. Learning lives in residents’ needs, evidence, planning and mechanisms. Battle rewards describe game progression explicitly: AP is not subject mastery. Wrong answers keep the request open with feedback and hints. No school assessment, account sync, resource retrieval or Muse API inference has been added to this local game release; those remain full-product work.

## Next releases, in order

1. **Battle system and encounter roster.** Target selection and multiple opponents first, then an optional ATB/wait scheduler. Separate encounter configuration, AI intent and resolution. Add 6–8 original enemy archetypes with distinct native rigs; at least two bosses should change the arena or rules. Acceptance: interruption/KO/status timing tests, save/reload at each phase, keyboard/touch parity and a complete balanced run without grinding.
2. **Directed world art.** Author scene compositions instead of uniformly scattering kit pieces: harbour skyline and quayside, layered woodland, moving mill, quarry terraces, enclosed workshop lanes. Keep collision, occlusion and camera tests. Source Polyfork-compatible props first; create missing models with Meshy 7.1 and Blender. Rigged humanoids must start in a reviewed T-pose. Acceptance: strong entrances, landmarks, readable routes, camera-safe roofs, distinct silhouettes and no rig deformation.
3. **Party and campaign.** Recruit a third and fourth character through quest arcs, with a coherent conflict and consequences across regions. Introduce one noncombat character skill per region. Keep educational facts in reviewed topic content, separate from reusable fantasy story scaffolding. Acceptance: a beginning-to-ending chapter with foreshadowing, a setback, a meaningful choice and an earned payoff; no mandatory practice loop.
4. **One substantial side activity.** Build a reusable original strategy/table game or expedition puzzle tied to collections and world residents. A small polished activity is a stronger next step than adding several disconnected minigames. Acceptance: optional, replayable, learnable within two minutes, with rewards that do not invalidate combat.
5. **Production playability.** Controller input, remapping, text speed, save slots/export, scalable UI, sound effects and location/character musical motifs. Then playtest difficulty, pacing and learning transfer with varied learners and topics. Acceptance should include observed play sessions, not only automated checks.

These are substantial remaining production steps. This release is a deeper working slice; it is not equivalent in content, visual polish or scale to either reference game.

## Evidence and references

- Square Enix’s [FFIX retrospective](https://www.square-enix-games.com/en_AU/news/whats-good-about-final-fantasy-ix) describes the equipment/skill relationship and constrained support choices. Lanternbound adapts the principle into a smaller original system rather than duplicating abilities.
- The official [FFIX system page](https://www.jp.square-enix.com/ff9/system/ate.html) documents Active Time Events and ATB. Its port conveniences should not be confused with original PlayStation features. Lanternbound’s optional scenes are currently linear memories, not parallel location events.
- Square Enix’s [FFVII Classic Mode explainer](https://www.square-enix-games.com/en_EU/news/final-fantasy-vii-remake-classic-mode) explicitly describes the original VII’s ATB command timing before discussing the remake. Only that original-game description was used for this comparison.
- The official [FFIX PC manual](https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/377840/manuals/Manual_EN.pdf?t=1769661336) provides additional reference for battle and equipment menus. This is port documentation, not proof that every convenience existed in the 2000 release.
- Public pages were captured through the requested Firecrawl route; the completed task and results are retained in the parent project’s `output/rpg/research`. No private book passages were transmitted to that service.
- Local design references used: *Pattern Language for Game Design* (2021), PDF p271, for a case study connecting exploration and progression; *Beginning RPG Maker MV*, PDF p25, for RPG components; *Fabula Ultima* introductory booklet, PDF p10, for character arcs. These informed implementation decisions; the case study is not evidence of a universal learning benefit. Private excerpts are retained locally, outside the published application.

## Screenshots

Release screenshots are retained in the parent project’s `output/rpg/screenshots` with the `depth-` prefix. The acceptance and visual review records identify the tested bundle; screenshots are actual gameplay, not concept renders.
