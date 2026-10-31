# Settlement content and rooms

The renderer and world layout remain authored. A topic supplies an optional `settlement` object; it cannot supply executable code, assets or arbitrary map coordinates. The three built-in packs load companion files from `public/settlements/`, keeping their original pack hashes and saves intact. Export embeds the active settlement so authors can edit it.

## World anchors

| Region | Stable building IDs |
| --- | --- |
| Sunward Quay | `inn`, `provisioner`, `harbour-hall`, `navigator`, `weaver`, `bakery` |
| Tidewheel Mill | `millhouse`, `pumphouse`, `gardener` |
| Cinder Workshop | `workshop`, `outfitter`, `apprentice`, `carpenter` |
| Cloudscript Archive | `library`, `apothecary`, `scribe`, `records` |
| Starfall Observatory | `star-room` |

Each room exposes `resident`, `ledger` and `workbench` quest anchors. `leave` returns to its exterior doorway. Some rooms also have a conversational visitor. New layouts belong in `src/interiors.js`; field collision and door anchors are generated from existing building footprints. All paths are checked against actual collision geometry.

## Story schema

`settlement.version` is 1. `quests` contains up to six quests with unique lowercase IDs (1–40 characters; unsafe object names are rejected). Optional `residentLines` and `clues` map the stable building IDs to original story text. Text is rendered as escaped text, never HTML.

Each quest contains:

- `id`, `title` (up to 100 characters), `giver` (building ID), `offer`, `done`.
- `reward`: integer `gold` (0–100) and `xp` (0–40).
- `steps`: 2–8 entries. Each has `location`, `target` (`resident`, `ledger` or `workbench`), `title`, `text`, `after` and an optional `challenge`.
- The last step returns to the giver's resident, with no challenge, so the resident acknowledges the outcome and pays the promised reward.

Challenges use one of two validated templates:

```json
{
  "type": "allocation",
  "prompt": "Twelve equal portions are ready. Nine are needed for the crew. Allocate the portions.",
  "total": 12,
  "solution": 9,
  "labels": ["Crew", "Helpers"],
  "unit": "equal portions",
  "hint": "Three quarters of twelve is nine.",
  "explanation": "Nine portions serve the crew and three remain for the helpers."
}
```

Allocation totals are integers from 2 to 20. A `choice` task instead has 2–4 `options` and a zero-based integer `solution`, plus the same prompt, hint and explanation. Every learning task should be justified by the preceding clues and approved resource evidence. A decision should resolve a character's practical problem, not interrupt the story with an unrelated test.

The authored examples are the canonical complete fixtures. Older topic packs without a settlement receive a single household request using their existing mill dialogue and allocation puzzle; the fallback does not invent subject facts. Imported JSON is limited to 256 KB, bounded depth and approved fields/identities. Original built-in IDs cannot be overwritten through import.

## State and persistence

The save remains version 1. Missing village fields receive defaults: no interior, 40 coins, zero ether, no gear or requests. Existing field progress, party, topic hash and battle are retained. Added state includes `interior`, `visitedInteriors`, `gold`, `ether`, `gear`, `quests`, `questContent` and `trackedQuest`. Quest entries retain only step, completion, reward and attempt fields.

Acceptance and step advancement check the current room and interaction target. The final step sets completion and reward flags atomically. Repeated submissions cannot pay again. Incorrect decisions preserve the current step and return a reason/hint. Shared anchors prefer the tracked request; residents list all applicable requests. Quest journal tracking can select a different active request.

Text-only changes to a built-in settlement preserve progress. A structural revision resets unfinished requests while preserving completion/reward for unchanged quest IDs. Removing an ID removes its journal entry; do not remove and later reuse IDs for the same paid request. Edited custom content gets its own pack save, as before. A no-op custom export/import that only embeds the identical generated fallback migrates the existing save. Nothing here is an anti-cheat or server-authoritative ledger: players control their own browser storage.

## Commerce

Provisions and apothecary shops stock tonics (12 coins, sell 5) and ether (18, sell 7). The outfitter stocks a brass pin (35, party maximum HP +6), a focus clasp (40, party maximum MP +3), and tonics. Charms cannot be bought twice or sold. Consumables cap at 99; coins cap at 9,999. A tonic restores 36 HP; ether restores 10 MP to the party member with the lowest remaining proportion. Using an item at full health/focus does not consume it. Inn rest costs 8 coins and is unavailable when the party is already fully recovered.

## Art and licensing

Six original modular props were authored in Blender: table, chair, counter, hearth, ledger desk and crate. Their editable source is in the parent workspace (`output/rpg/assets/lanternbound-interiors.blend`) with its production script. Four Polyfork native resident variants retain the provider's rest skeleton; the feminine villager variant uses the returned geometry variant and default provider palette. `resident.js` uses native bone mapping, with independent cloned skeletons. It does not retarget Meshy animations onto Polyfork residents.

The bundled talking animation is Polyfork's retargeted Quaternius Universal Animation Library clip (CC0), with its source and hash in `public/assets/npc-clips/provenance.json`. No separately restricted Mixamo clip downloads are bundled. Polyfork geometry is embedded as part of the game under the connected account's license; do not distribute it as a standalone asset pack.

## Acceptance

Run `npm test` and `npm run build`. From the parent workspace, run the original adventure and animation checks plus `scripts/check_rpg_interiors.py`. That script uses ordinary input: room navigation, NPC conversations, five complete topic-specific chains, wrong answers, clues, keyboard choices, purchases/sales, paid recovery after battle, mobile layouts, persistence, exports and malformed imports. Its game snapshots are read-only. Inspect the resulting screenshots, including native NPC poses, room furnishings and mobile windows, before publishing.
