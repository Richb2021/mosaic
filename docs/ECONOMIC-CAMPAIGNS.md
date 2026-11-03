# The Living Economy

`economy-v1` adds a complete 24-month campaign alongside the unchanged `town-v1` game. The library contains The Rivergate Company (enterprise) and A Region Transformed (regional development with reviewed historical context). New packs can be generated from reviewed sources through the existing Muse Wonder workflow, inspected and published before play.

## Authored rules

Three 6×6 district boards provide 108 tiles. Roads connect facilities to their district hall. River tiles, occupied land, locked regions, resource locations and research prerequisites are enforced by the reducer, not just the UI. Existing town saves retain their original engine, fingerprint and storage key.

Six goods form two chains: grain → flour → bread, and timber + iron → tools. Production uses connected staffed shifts, bounded wage effects, inventory and per-good storage capacity. Paused factories avoid wages while retaining upkeep. Prices change demand against one scripted rival; this is not an AI competitor or a market forecast. Marketing, taxes, services, environmental pressure, limited transport, bid/ask spreads, loan principal and interest are explicit rules. Three research projects take time and unlock production/logistics improvements. Six deadline contracts, six council meetings and four known shocks create decisions across the campaign.

Starting cash is 300. The ledger separates construction, trades, contracts and financing from operating income and expenses. End-of-month negative cash ends a run. At month 24, all preset goals determine completion or a review outcome. Source-backed explanations and council observations are separate from success; no outcome is a mastery grade.

## Dynamic content boundary

`economy-content.js` supplies the strict schema and validator. A topic pack selects `enterprise` or `regional`, supplies three region descriptions, four concept notes, six two-option council scenes and a debrief, with exact source references. It cannot change coefficients, map geometry, goods, event effects, executable code or arbitrary asset URLs. The server attaches reviewed excerpts and preserves the existing refusal, review, ownership, cost and quota controls. Generated wording still needs semantic review for alignment with the displayed rules.

The included historical scenario explicitly distinguishes the fictional food/tool economy from the textile histories in its museum and Parliament sources. It includes affected people, factory inspection, education and the connection between cotton and enslaved labour. It does not claim to reconstruct a historical economy or establish causation from game scores.

## Storage and learning integration

Saves contain a bounded action history tied to pack ID, revision and fingerprint. Server-side replay reconstructs cash, inventory, decisions and outcome; client-supplied scores cannot award progress. The same owner-scoped NoCodeBackend learner-save table, version conflicts, deletion, retention and export controls apply. No database migration or new provider is added. Account format preferences and course planning include the new format. Council activities connect to source support and the learning trail without correct/incorrect grading.

## Art and controls

The game uses the existing painterly town and expansion asset library. Its board, inspector, market, research and ledger views share that art direction. Keyboard arrows navigate tiles; a labelled tile list provides another route. Dialogs use the shared inert/focus helpers, announcements persist across renders and smaller screens stack the panels. Tables scroll within their own containers.

## Verification and limits

The workspace evidence is in `../output/economy/`. Unit checks cover cash/stock conservation, no immediate trade arbitrage, staffing, connection/placement rules, research timing, contracts, insolvent and review outcomes, action-tamper rejection, generated schema/source constraints and owner-isolated cloud saves. Both authored campaigns have been played through normal browser controls and restored after reload. Five views are checked at 320×740, 768×1024 and 844×390, with native Safari keyboard/dialog checks.

This is an authored economic strategy campaign, not Capitalism II or Civilization feature parity. There is one scripted rival, a fixed goods/rules library and two authored goal presets. No diplomacy, warfare, stock market, multiplayer or arbitrary historical simulation. Real mobile hardware and spoken assistive-technology journeys remain unverified; viewport/AX testing does not establish conformance.
