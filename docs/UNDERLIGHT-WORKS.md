# Underlight Works

An original, reusable chapter underneath Tidewheel Mill. Enter through **Menu → Go to → Underlight Works** at the mill. It is available without finishing the original adventure. The old adventure, shops, equipment, quests and ending remain in place.

## Playable chapter

The Sunken Concourse introduces Nessa, an engineer who joins the expedition. The Hanging Galleries connect to the Counterweight Reservoir and the Heart chamber; a quiet workshop provides a rest point, a cache and a repairable service lift. The lift becomes a return shortcut after the party stabilises the machinery. The gallery catwalk changes the travellers’ elevation; machinery has independently moving parts.

Nessa follows the party with native Polyfork skeletal clips. She acts as a third combatant, can interrupt charged machinery with **Jam governor**, and can heal with **Field repair**. Her recruitment and repaired lift persist. Inside the Works, the three travellers use a chapter-specific expedition HP/MP pool, restored at its camps; their original adventure HP/MP and equipment remain separate. Adventure XP and coins earned in the Works still belong to the main save. This explicit chapter balance avoids making a new player grind the original adventure to enter.

There are three group encounters with target selection, visible intentions and weaknesses. Crawlers are armoured melee machines; moths repair their allies; sentries charge and fire across the party. The Unwinding Heart has a shield that Nessa can interrupt and an overdrive phase below half health. All battles wait for player input. There is no timer on a learning activity. Retreat preserves discoveries; defeat restores the party at the maintenance camp. Story difficulty makes chapter combat gentler.

Three physical mechanisms share a fixed runtime across the three subjects: ordered signal routing, conservation of a total between two branches, and a new configuration requiring transfer to a different representation. Every mechanism includes feedback, a hint, an objective and an exact teaching-note reference. These are authored teaching notes, not automatically retrieved textbook citations. Attempts, correctness and hint usage are separate from adventure XP and do not claim to measure mastery.

The final decision sends the first restored current to gardens or homes. The chosen outcome is saved and changes the mill’s decoration. **Lantern Lines** is a finite territory game in the concourse: stronger adjacent lanterns change sides, and the player must hold five of nine spaces. Its first win awards coins; replay cannot farm that reward.

## Player tools

Three manual save slots per topic revision, a portable JSON backup, staged import and a recovery copy before loading. Changed chapter content requires a new revision, a review screen and explicit activation. Original adventure progress is preserved when a chapter revision changes. The three slots and exported backups are the supported restore interface. Automatic recovery copies are retained locally for manual recovery; backups require the matching chapter revision. Cloud sync and a version rollback interface are not implemented.

Letter-key remapping, permanent arrow-key movement, 100/115/130% dialog text, optional shadows, story combat and separate procedural sound effects. Original Suno music remains. Standard gamepad bindings support walking, interacting and menu focus; physical controller hardware verification is recorded separately from automated input checks. Reduced motion follows the device preference.

## Content and assets

- `src/chapter.js`: chapter state, room gates, combat, mechanism attempts and board rules.
- `src/chapter-maps.js`: five authored room layouts and traversable elevation.
- `src/chapter-world.js`: scenery, Nessa clip adaptation, multi-enemy staging and feedback.
- `src/chapter-content.js`: strict content validation and service-side ownership policy contract.
- `src/expansion.js`: UI integration, reviewed imports, save tools and controller adapter.
- `public/chapters/*.json`: water/systems, fractions/proportion and evidence/arguments.
- Ten original Blender GLBs in `public/assets/works-manifest.json`; source script `../scripts/create_rpg_works.py`, editable `.blend` in `../output/rpg/assets/lanternbound-underlight.blend`.
- Nessa reuses the existing Polyfork native female character and four CC0 Quaternius clips identified by Polyfork’s official clip catalogue. `nessa-provenance.json` records original URLs and file hashes. No new Meshy generation or humanoid re-rigging was needed. The four existing Meshy 7.1 T-pose rigs remain unchanged.

The muted stone, brass, wood and matte finish follow the established Polyfork-aligned art contract. The authored chapter structure is separated from systemic rules and replaceable content, an application of the systems/content distinction in *Advanced Game Design: A Systems Approach* (2018), PDF p.154, private library source `book:365:154`. No private book passages or customer materials are bundled into the product.

## Remaining production depth

This chapter does not imply parity with an entire Final Fantasy campaign. More chapters, fully directed character acting, a broader recruitable cast, long-term relationships, more bespoke location art, equipment appearance variants, a richer recurring side-game, formal curriculum review and classroom accessibility testing remain. Wait-based combat is implemented; real-time ATB is a separate optional design decision. The current service is an owner-private static demo, not a multi-tenant learning platform.
