# The Living Economy

The library now offers **Rivals on the River** and **Threads of Industry**, expanded 24-month campaigns with two adaptive competitors and four retail industries. The original Rivergate Company and A Region Transformed remain available, with their exact original rules and saves.

## Choose a strategy

Build connected districts, manage a shared workforce and keep enough cash for materials, wages, upkeep and interest. Ten goods support four retail sectors:

| Sector | Production | Research |
| --- | --- | --- |
| Food | grain → flour → bread | Machinery improves mills and bakeries |
| Tools | timber + iron → tools | Workshop machinery |
| Textiles | two wool → one cloth → one garment | Textile workshops |
| Upholstery | two timber + one cloth → one furniture item | Upholstered furniture |

Seventeen facility types include sheep pastures, weaving houses, tailor shops and furniture works. Five research projects unlock production and logistics improvements. Six timed contracts now cover bread, tools, clothing and furniture. Existing treasury, district, service, nature and research goals are joined by diversification: manufacture at least four units in three of the four retail sectors. Reselling purchases does not establish an industry.

Production runs raw materials first, then flour/cloth, then bread/tools/garments/furniture. Staff are shared across connected districts. Garments use cloth before furniture; expand weaving or pause a tailor if upholstery needs more material. Buildings incur upkeep even while disconnected or paused. Wages still apply to staffed shifts with missing inputs. Warehouse capacity is per good; excess after production is lost before retail.

## Competing companies

Meridian Trading pursues volume. Bramble & Co. starts with higher quality and prioritises a quality upgrade. Both fund production, upkeep and upgrades from their own treasuries; they cannot inspect learner data or receive hidden cash injections. Their current prices and capacities are visible, alongside recent decisions and reconciled cash movements.

Finite customer pools allocate whole-unit sales between the player and both rivals. Lower prices, quality and promotion increase relative appeal. Stock and shop capacity cap sales; unfilled orders can go to another supplier. Ties rotate deterministically by month. Market-share bars include text equivalents and distinguish current forecasts from actual final-month results.

After a month ends, rivals adjust next-month prices by at most one based on public sales and the player's price. Every third month a rival with at least 190 cash may invest 80 in a sold-out product's capacity; Bramble first spends 85 to improve quality to its cap of two. Production and upkeep must still be funded. The history records opening funds, production, upkeep, revenue, investment and closing funds.

The player can upgrade each product's quality twice, for 35 then 70 cash. Each sold unit also incurs its quality level in finishing costs. Marketing adds eight appeal points for one month; council fairs add six for three months. Neither guarantees customers or sales. Prices, demand, outputs and other values are fictional teaching assumptions, not real-world forecasts.

## Dynamic topics and source review

The `economy-v1` schema now generates `rulesVersion: 2`. The same reviewed-evidence → Muse Wonder → strict validation → human review → private publication pipeline applies. Source-backed packs select a fixed enterprise or regional preset, supply three district descriptions, four concept notes, six two-option council scenes and a debrief. They cannot author economic rules, rival policies, geometry, recipes, asset URLs or executable code. Manual revisions cannot change the rules version or the engine-owned ending.

Six council activities retain their existing learning-trail keys and source-support links. Winning, producing, selling or outperforming a rival never establishes subject mastery. Historical framing distinguishes this fictional wool economy from the cited history of cotton textiles and includes affected people rather than treating profit as justification for historical harm.

## Compatibility and storage

`economy-engine.js` dispatches validated packs to `economy-classic.js` or `economy-industry.js`. The classic engine is byte-identical to the v54 implementation. Old packs omit `rulesVersion`; their hashes, storage keys and replay outcomes are unchanged. Expanded campaigns have distinct IDs and encode version two in the action-history envelope. Cross-version replays are rejected.

The existing owner-scoped NoCodeBackend learner-save table, optimistic versions, export, deletion and retention apply. Server replay derives progress from permitted actions, never client-supplied outcomes. No database migration, new provider, permission expansion or additional per-turn model call is introduced. Rival simulation runs deterministically on the device and during server replay.

## Art, controls and scope

The expanded industries reuse the painterly town asset library, with product labels on the new buildings. The district board, inspector, recipe guide, market controls and competition exchange retain the existing visual system. Tile arrows, the tile list, visible focus, modal containment, persistent announcements and responsive panels remain available.

Evidence is in `../output/economy-expansion/`. Tests cover old replay compatibility, full campaign balance, conservation, finite market allocation, pricing/quality influence, rival finances, research, input/worker/road constraints, manufacturing-only goals, schema/source binding and reviewed generation. Browser evidence records normal-control playthroughs, reloads, responsive layouts and keyboard checks.

This release adds two deterministic competitors and four retail industries. It does not add takeovers, diplomacy, warfare, stock exchanges, multiplayer or arbitrary economic simulation. Physical mobile hardware and spoken screen-reader journeys remain unverified; browser viewport and accessibility-tree checks do not establish conformance.
