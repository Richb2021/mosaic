# The Living Town

A fourth reusable Mosaic activity template (`town-v1`): a twelve-month town and business simulation. The player places buildings on an8×8 board, connects roads to the town hall, manages production/demand/storage and pays for services. Four council decisions connect source-supported ideas to visible consequences. All coefficients and quantitative outcomes are fictional teaching rules.

## Included scenarios

- Market Town: enterprise; finish with180 treasury,12 residents,4 services and50 nature.
- River Commons: stewardship; finish with80 treasury,12 residents,8 services and80 nature.

Both use the same rules and reusable art. These are small complete scenarios, not a full open-ended SimCity replacement. No population dynamics, taxes by jurisdiction, realistic hydrology, zoning, finance advice or mastery assessment is claimed.

## Economics and space

A home holds4 residents and provides3 monthly civic income. The hall provides8 and costs2. Each staffed workshop needs4 residents and makes4 goods; inputs cost1 per good, whether sold or not. Every placed facility incurs fixed upkeep, even when disconnected. A connected market sells at most6 goods for4 each, constrained by stock and one demand unit per resident. Production is stored before sales; surplus above capacity is lost. Warehouses add16 to base storage12. There is no real-time clock.

Only orthogonal roads linked to the hall activate adjoining facilities. Schools and clinics each provide2 service points to homes within3 Manhattan grid steps; duplicates of one service type do not multiply coverage. Gardens and riverside water stores improve a bounded nature index; active workshops reduce it. These are fixed transparent abstractions, not sourced empirical estimates. Construction is immediate, removal returns half its price, and the ledger separates these cash movements from monthly operations. End-of-month negative treasury ends the run. Every council event retains a free choice, avoiding an unaffordable-choice deadlock.

## Dynamic content contract

The existing upload→source review→Wonder generation→content review→publish→play workflow accepts `town-v1`. The server pins identity, exact arrays, source IDs and canonical excerpt text. The model supplies names, purpose, story, four ordered two-choice events and a debrief. It cannot change formulas, effects, assets, map, costs, goals or JavaScript. A reviewer must check semantic fit as well as source support; a valid citation does not itself prove that prose is correct. An unrelated subject may be unsuitable for this format.

Generation uses `muse-wonder-1.0`, with the existing server-only credential and owner-scoped resource/job storage. No new API, database migration, account flow or audience change. Upload remains UTF-8 TXT/Markdown,64KB maximum; PDF/Word extraction is not connected. Generated and imported packs can be downloaded/reused. Browser progress is local; cross-device progress is not implemented.

## Save and accessibility

Saves contain bounded action history, content fingerprint and version, not trusted balances. Restore replays every legal action; forged balances and impossible histories cannot become a valid state. Future economic rule changes require an engine/save format revision. Board keyboard navigation uses arrows and Enter/Space; build controls retain focus, dialogs trap and restore focus, reduced motion disables ambient smoke. Mobile contains horizontal map and palette scrolling rather than overflowing the page.

## Asset provenance and design evidence

Ten original Sorceress structures plus one painted landscape; manifest has file paths, true-alpha dimensions, shared anchor and provenance. The power asset is reserved for a future rules expansion. Blueprint concept lives in the existing MagicPath project as image467412787954618368. Source research uses four primary SBA/EPA pages; stored notes are labelled paraphrases. The private book corpus was not transmitted externally.

## Verification

See `tests/town.test.mjs` for full-year solvability, road disconnection, demand/capacity/storage, service range, affordability, terminal states, immutable actions, save replay and schema bounds. Shared template API tests include owner isolation, identity, source binding and publish. Release evidence outside the app records real browser journeys, the independent audit, live Wonder generation, screenshots and exact private deployment.
