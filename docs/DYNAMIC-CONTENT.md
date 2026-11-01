# From learning material to a playable chapter

The Resource Library now supports three explicit formats: the original Underlight RPG, the Thread Atlas 2D adventure and the Turning Points subject draft. See [game modes](GAME-MODES.md) for the new contracts, art pipeline and play flows. The Underlight-specific details below remain applicable to that template.

The user clarified on 31 October 2026 that “dynamic ownership” means **dynamic game content**. This implementation makes the existing Underlight chapter reusable from uploaded learning material. It does not generate executable code, new geometry, an entire campaign or arbitrary game rules.

## Learner journey

Open **Menu → Chapter workshop → Create from learning material**. Sign in using the hosting platform. Paste notes or upload a UTF-8 `.txt`, `.md` or `.markdown` file (60–60,000 characters; at most 64 KB). Review the exact paragraph excerpts, then mark the source reviewed. Select up to three reviewed sources, enter a learning goal and describe the learner’s level and needs. Ask Muse Wonder to create a chapter. Inspect its story, three mechanisms, expected answers, explanations, supporting excerpts and possible endings. Save the reviewed chapter, then activate it through the existing chapter review screen.

The new chapter changes the hook, Nessa’s story context, routing, allocation and transfer activities, hints, feedback and ending. The world geometry, combat, character rigs and other adventures remain authored. A different chapter identity resets only the Underlight progress and preserves a local recovery copy. Existing save slots remain pinned to their topic and chapter identity.

## Implemented data path

The private Sites Worker uses platform-supplied user identity. D1 resources and jobs are scoped to that identity in every lookup and mutation. Cross-origin changes are rejected. The source text is immutable; duplicate bytes are deduplicated within one account. The source checksum and exact paragraph passages are stored with the resource. Review requires the exact checksum. Uploaded text is treated as data, including any instructions embedded in it.

The generation request pins selected resource versions and takes at most twelve relevant paragraphs, totalling at most 18,000 characters. Selection uses lexical relevance to the learner’s goal. This is a bounded first retrieval implementation, not semantic/vector retrieval or a claim that every relevant passage in a long document was found.

The fixed `underlight-v1` contract requires a three-stage sequence, conservation of an integer allocation and a three-dial transfer problem. The model must use those mechanics meaningfully. Unsupported or unsuitable material must not be treated as evidence for invented facts. The model returns source-reference IDs, and the server attaches the original reviewed excerpts directly from the pinned evidence packet. Unknown IDs are rejected; model-authored quotation text is never used. Code then checks identity, schema, available solutions and exact citation equality. Human review checks factual correctness, teaching quality and whether the goal fits the mechanics; a matching citation alone does not establish that a claim is supported.

## Muse Wonder and job lifecycle

The adapter uses **`muse-wonder-1.0`** exclusively. The official [model catalogue](https://dev.meta.ai/docs/models) identifies it as API-available; Wonder Full is not selected. The [Responses API](https://dev.meta.ai/docs/protocols/responses) supports background requests and retrieval by response ID. The request uses `background: true`, `store: true`, a bounded output budget and the JSON chapter schema. Selected passages and the response are therefore stored by Meta for retrieval; this workflow does not claim zero retention.

A job moves through queued → starting → running → review → published, or an explicit failed/interrupted state. A request key deduplicates the submission locally; changing inputs under an existing key is rejected, including concurrent submissions. A conditional database update permits only one active submission per account. New AI generation reservations have a configurable per-owner rolling-day allowance (default ten; manual revisions excluded; see below).

The server records Meta’s background response ID as soon as the acknowledgement arrives. Later status checks retrieve that same response; closing the browser after acknowledgement does not restart inference. Short acknowledgement work is also registered with the Worker execution context. An acknowledgement lost before its ID is stored is marked interrupted after a timeout and is **never silently retried**; that rare window can have used API credit. Refreshing a saved job does not create another generation request. Transient status failures retry the same response. After thirty minutes an overdue background job releases the account lock, retaining its response ID for manual recovery; no replacement request is sent. A manual check can revalidate a failed job’s stored provider response after an adapter repair, without submitting another generation. Valid completed output is stored before review. Publication rechecks exact source versions and the draft hash.

The model has no tools, web access or execution permissions in this adapter. No alternate provider or model is selected on failure. Errors do not expose provider bodies, secrets or uploaded text.

## Runtime setup

Set the production **secret** `META_API_KEY` through Sites environment settings. Do not put it in `.openai/hosting.json`, source, client code or Git. The UI shows generation as unavailable while it is absent; source upload and review continue to work. A key being present does not prove entitlement: a real background request and retrieval must verify access to Wonder.

The migration uses the maintained Sites Vinext integration with D1 binding `DB`. The existing public asset URLs and private site identity are preserved. `npm run build` builds the game into the framework’s static assets, then the Worker. New SQL migrations are under `drizzle/`; production migration application belongs to Sites publication. Local previews use the starter’s loopback-only development sign-in and a separate local D1 database.

## Verification and remaining work

Service tests use real in-memory SQLite and explicit injected provider fixtures to exercise privacy, review, source equality, invalid output, request races, background retrieval, lost acknowledgements and publication. Those fixtures are not shipped as an inference fallback. Browser evidence separately records whether a real API generation was exercised.

PDF/Word extraction, OCR, semantic retrieval, full-world generation, additional mechanism templates, instructional review by educators and server-synchronised game saves remain future work. This release is the resource-to-Underlight content path, not the whole planned learning platform. Account transfers and school administration are separate concerns.

## Configurable AI request allowance (1 Nov 2026)

`WORKSHOP_GENERATION_LIMIT` is a server runtime environment variable: default `10`, an integer from `0` to `1000`. `0` pauses **new** AI request admission. Invalid configuration rejects new generation with 503 while leaving existing chapter reads and manual revisions available. Set it in Sites environment variables and deploy a saved version to apply it. The owner-private development Site now uses `50`, explicitly authorized for merge/sports verification; this is not a product-plan limit for schools.

The allowance counts AI request reservations per authenticated **Sites resource owner** in a rolling 24-hour window. Creating a queued request reserves one slot; failed and interrupted requests keep it because inference may already have incurred cost. Repeating the same request key returns the same job without another reservation. Already accepted queued jobs can still run if the allowance is subsequently lowered; this is an admission limit, not a kill switch, token ledger or currency budget. Provider limits remain separate.

Manual revisions create validated copies without calling Muse or consuming AI allowance. Existing copies carrying server-created `revisionOf` metadata are excluded automatically, with no schema migration. Clients cannot mark generation as a free revision. Identity, source bindings, exact-hash publication, atomic SQL admission, owner isolation and single-flight provider submission stay enforced. The library shows used/available allowance and, when full, the next slot time. It lists the latest 30 chapters; older chapter IDs remain usable.
