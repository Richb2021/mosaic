# Sources and connected programmes

The Library keeps reviewed evidence separate from generated activities. Sources now accept CSV/TSV and XLSX cell values alongside the existing text, PDF, Word, slides, captions and printed-image formats. Word tables retain row/cell coordinates. PDF text extraction is the default; English scan OCR is an explicit option. Spreadsheet formulas are never evaluated: cached values and missing caches are labelled. Dates, formatting, equations, charts and diagrams require checked descriptions.

## Imports and provenance

Permitted public HTML/plain-text pages are fetched through an exact HTTPS host allowlist (`SOURCE_IMPORT_HOSTS`; default Wikipedia English, OpenStax, BBC and CORE Econ). Each redirect is revalidated; no browser cookies, script execution or secondary resources. Review extracted text before approval. Source language and URL are recorded.

Recording imports use the existing Fish account through `transcribe-1-pro`. The first audio track is transcribed; video imagery is not interpreted. Imports use an explicit provider permission step, immutable request identity, generation allowance and cost ledger. Inputs are at most 8 MB and 60 minutes; returned text stays within source bounds. No automatic paid retry after an ambiguous acknowledgement. Raw recordings are not kept unless the user separately retains the original.

Optional original files are private R2 objects, immutable per source version and bound to a SHA-256 digest. Source edits create new records with parent/root lineage; old approved activities retain exact evidence. Resource deletion and workspace retention remove retained bytes and originating transcript jobs. Saved search/transcription requests are separately visible in Your data. Learner-progress deletion preserves curated workspace collections; workspace deletion removes them.

Workspace archives include original files when their combined size is at most 100 MB, with exact digest verification. Above that limit, the archive includes an originals index and files remain individually downloadable. Export pages fail if sources, original metadata, knowledge jobs or collections change between pages.

## Finding and sharing evidence

Muse can suggest terminology or translations for an explicit search. Only the query and optional language go to Muse. Suggestions require selection and then the existing free ranked evidence search. This is terminology expansion, not a vector-embedding search engine or an evidence-coverage guarantee. Unicode word segmentation supports additional scripts; not every language has been tested.

Curators can save 24 collections, each with up to 50 exact reviewed sources. Sharing is limited to at most 20 explicitly selected active members of the existing managed group. Reader/curator membership bindings and live source checks invalidate withdrawn access. Readers receive source text, never original binaries or authoring context. Downloaded copies remain outside withdrawal controls.

## One programme, several formats

A saved programme can connect one reviewed Explore lesson, question cycle, podcast and cartoon to the game and source reading. No AI generation is triggered by choosing formats, opening a programme or recording reflection. Missing formats are explicitly offered for preparation/review. Course organisers can deliver all four frozen versions per objective, in addition to existing course question-bank compatibility.

The suggested order uses the saved starting point, access preferences, first responses/help, and due revisits. Goals and interests remain visible. Users can open any available step. Media-use notes are self-reports, not mastery; written reasoning still needs human review. Game outcomes remain separate from assessment. Game links retain the exact question-cycle return route.

Programme choices and media reflections use owner-only NoCodeBackend records with expected-version conflict protection. Explore and practice keep their existing records. All generated formats receive bounded stage/context/exam/time/access preferences as well as level, goal, interests and focus; no account identifier is sent in that context.

Programme playback retrieves existing private narration only. Authors prepare audio in Creative learning. Missing clips leave transcript playback available. Assigned stories can cover additional related activities beyond a learner's narrower focus and are labelled accordingly. Grants, exact hashes, retention and source withdrawal are rechecked before script/audio delivery.

## Bounds

No new database tables or embedding service. No fixed learning-style classification. No claim of arbitrary file interpretation, any-subject factual accuracy, universal accessibility, formal grading or production scale from these tests. Source and generated-content review remain required.

Acceptance evidence for this increment lives in `../output/knowledge-programme/` relative to this app repository.
