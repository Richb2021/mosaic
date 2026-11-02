# Source library

Each owner can keep 500 sources in the existing D1 `workshop_resources` table. No schema or account changes are required. Uploads retain the existing byte, paragraph, checksum and explicit review requirements. An atomic insert guard enforces the cap even for simultaneous uploads; an exact duplicate remains reusable at capacity.

## Browsing and retrieval

- `GET /api/workshop/resources`: 25 metadata rows, title substring filter `q`, review `status`, optional topic `ids`, and `nextCursor`. No source text or passages are included. Unicode title matching is case-insensitive.
- `GET /api/workshop/resources/:id`: canonical owned source, including exact passages, loaded only for reading, review or evidence preparation.
- `GET /api/workshop/search`: exact lexical word matches in passage text, with at most 30 passages per page. Titles and locator labels do not count as passage-text matches. Sources are newest first, then original passage order. It scans owned full text in batches of 20 sources and can resume inside a source. A long document's later passages are reachable; a zero-result page may be needed to establish the end when the last matching result was on an earlier page.
- All reads use the authenticated owner. Topic IDs outside that owner return 404. Cursors bind to owner, query, review filter and topic IDs; they never grant access. Stable `created DESC, id DESC` ordering resolves equal upload timestamps. New uploads before a cursor appear after refreshing the search, not midway through an existing page walk.
- `GET /library?view=metadata` seeds the workshop with the first metadata page. Legacy `/library` consumers retain the newest 40 full sources and receive `resourcesTruncated` plus pagination metadata. The course notebook uses only its linked source metadata, regardless of upload age.

The UI separates draft title input from the applied search and retains up to three selected reviewed sources across pages. Evidence preparation fetches those canonical sources again; the server still validates exact checksums, confirmation, request identity and citations. Generation remains Muse Wonder Standard, with the existing 12-passage budget and teaching review.

## Lifecycle

Deletion and retention enumerate source IDs and creation dates without loading every source payload. Existing derived-content cleanup and failure/retry behavior is preserved.

Workspace export uses `POST /api/learning/data` with `action: export`, `scope: workspace`, `paged: true`. It returns 20 sources and a cursor per response. The cursor also requires a snapshot digest of the owner, data epoch, catalogue and chapter versions. A changed catalogue aborts continuation. Chapters are included in the first part. The browser downloads one ZIP with `manifest.json`, ordered `materials-NN.json` parts and a README, and refuses incomplete or repeated pages. It never offers a partial archive as a complete export. The legacy single-response export remains bounded at 24 MB. Learner/audio export is unchanged.

## Limits and verification

This is word matching, not semantic retrieval or proof that a source covers a goal. OCR, diagrams, languages and curricula have their separately documented bounds. Pages are a live view, not an immutable search snapshot; removals and review changes can affect subsequent results.

`tests/resource-library.test.mjs` exercises same-time pagination, owner and cursor isolation, paragraph 40 in a 65-passage source, older-source generation/review with a stub provider, concurrent capacity enforcement, linked metadata, and archive/deletion/retention over 500 large sources. Browser evidence, independent audit, production build and deployment are recorded at the workspace root in `output/large-library/`.
