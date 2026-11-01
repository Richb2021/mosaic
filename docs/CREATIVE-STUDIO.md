# Creative learning studio

The programme's Creative learning view adds a Muse Wonder tutor, a two-presenter podcast and a reusable illustrated cartoon. Each request resolves the same canonical pack/hash as the programme and reads its saved profile snapshot. Level, up to two interests, goal and focus are sent to Meta with exact reviewed evidence; learner identity and scores are excluded. Interests frame fictional examples, never add external facts. This is not a fixed learning-style classifier or a mastery assessment.

## Ownership and sources

The existing learning route checks origin, NoCodeBackend session and account header before entering `creative-api.js`. All creative rows also match Sites owner, hashed learner owner, pack ID and content hash. Existing `workshop_jobs` stores the request lifecycle; creative-prefixed statuses cannot enter the game lifecycle, and game endpoints exclude creative records. No new table, R2 bucket, school membership or public sharing is introduced. A tutor request records AI assistance in the existing version-protected NCB programme before inference; later starting answers retain that marker.

The server supplies source excerpts. Generated media can only reference packet IDs and preset scenes/speakers/actions. Script review is an explicit current-hash confirmation; free edits invalidate approval. These checks prove structural citation integrity, not factual entailment. The reviewer still checks every claim, analogy and pronunciation. Tutor messages are labelled AI guidance and are never promoted to reviewed model answers. Obvious answer-copying requests receive a fixed scaffold without inference; other requests use a source-limited prompt and may refuse missing evidence. This is not a complete safeguarding or assessment-integrity system.

## Lifecycle and allowance

Create reserves one request from the existing configurable workshop allowance. Run submits once; check resumes the retained Meta response ID. Ambiguous submission failures stay interrupted and never trigger automatic replacement inference. Manual script edits and local integrity scaffolds do not use allowance. Each new speech clip reserves one request and is saved in private R2 storage. Playback after reload checks the approved-script/voice/model cache before budget admission, so a saved clip uses no new inference request. Provider credit and this app admission allowance are distinct.

Media scripts and tutor text are retained in the existing private workshop store; removing a programme does not erase those generation records. The Your data screen now exports and deletes learning records, creative content and saved audio, with configurable on-access retention and retryable deletion of known Meta responses. Sign-in account deletion and provider/infrastructure backups are outside this control; see MEDIA-LIFECYCLE.md. The UI shows the latest forty creative requests for each exact programme version.

## Narration and export

Server-only `FISH_AUDIO_API_KEY`, with `FISH_AUDIO_GUIDE_VOICE` and `FISH_AUDIO_LEARNER_VOICE`, connects Fish S2.1-Pro. The two voices were designed synthetically and registered privately, with no real-person or character recordings. Only the reviewed spoken text and preset voice ID go to Fish. Meta remains `muse-wonder-1.0` Standard for scripts/tutor; there is no silent provider substitution.

Podcasts support passage navigation, pause, speed, transcript/source downloads and a combined PCM WAV export. Cartoons use four original reusable Canvas settings, two presenters, speech-timed scenes, captions, still-artwork preference and narrated WebM export where supported. Export runs in the browser and must finish before the file is available. Low-end-device rendering and every browser codec combination are not established by desktop acceptance.

See `PODCAST.md`, `CARTOON.md`, `tests/creative.test.mjs`, `tests/media-audio.test.mjs`, `tests/cartoon-renderer.test.mjs`, and `../output/media-studio/` for implementation and acceptance evidence. Hosted end-to-end verification is recorded separately from isolated component evidence.
