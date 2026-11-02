# The Thread Atlas and Turning Points

The game library at `/modes.html` shares Lanternbound’s private Resource Library and Muse Wonder connection. The existing 3D RPG remains at `/`. Both entry points link to the library. Included games can be played as a guest. NoCodeBackend sign-in now connects learner progress and the private resource workshop; see [Game depth and accounts](GAME-DEPTH-AND-ACCOUNTS.md). The existing private hosting audience is unchanged.

## The Thread Atlas

A scene-led 2D adventure with three connected illustrated spaces: workshop, woodland and archive. The traveller walks to clicked destinations and interaction anchors; keyboard movement and an accessible places/objects list are also available. Players talk to keepers, inspect evidence, collect a missing object, use it on a mechanism, arrange a meaningful sequence and choose a story ending. Mira and Ren use real transparent Sorceress animation sheets. The engine maintains animation phase while walking and mirrors the right-facing sprite for leftward motion.

The `adventure-v1` pack owns the room descriptions, characters’ dialogue, clue passages, inventory labels, repair context, three-stage sequence, hints, corrective feedback and two endings. Its scene and asset vocabulary is allowlisted. Included examples use a fictional waterworks and a woodland food-chain investigation. These are authored examples, distinct from Muse-generated games.

## Turning Points

Five rounds each offer three cards from a role-specific pool of four. The player makes one selection per role and has one redraw for the run. Four scenarios then reveal the consequences of the assembled capabilities; short reflections and cited explanations record learning attempts separately from the game outcome. Replay can retain a seed or draw a new one.

The original 82-0 game supplied the constrained-draw → pick five → resolve → replay inspiration. Its official rules do not impose positions or synergy penalties. Mosaic’s roles, scenario checks, educational reflections and original artwork are our own adaptation. No original branding or player artwork is copied.

The `draft-v1` contract contains three metrics, five roles, twenty cards and four scenarios. Bounded integer scores and requirements are fictional game rules, not historical measurements or predictions. Validation rejects impossible overall scenario targets, unknown roles/assets/citations and invalid reflection answers. Included subjects cover the Industrial Revolution and ecological restoration. The history material includes working conditions and the connection between cotton and enslaved labour, as well as machinery and transport.

## Uploaded material and generation

Use Resource library → Add learning material → review exact passages → Plan a chapter → choose a game format. `underlight-v1` remains the default for existing RPG jobs. The new library offers the two new formats; existing 3D chapters link back to the RPG.

The server selects reviewed evidence under the existing owner-scoped contract. New format identifiers participate in request hashes; old Underlight request hashes remain compatible. The strict Muse Wonder schema pins the format, identity and every nested source-reference ID. The server attaches original excerpts, validates the complete result and saves it for human review. The model never supplies executable logic or arbitrary asset URLs.

Review the full narrative, solutions, game trade-offs and sources before publishing and playing. Canonical quotations do not establish that an interpretation is educationally sound. An unsupported source or unsuitable goal should be refused, not padded with invented facts. Background jobs retain the existing same-response recovery semantics and never silently launch replacement inference.

## Saves and imported packs

Each mode validates its saved state against the pack’s identity, revision and content fingerprint. A source/content change cannot silently reuse incompatible progress. Browser storage failures are reported while allowing the current session to continue. Signed-in illustrated games and supported 3D RPG chapters sync to the learner account; guest runs remain separate on the device. Generated resource/job records remain in the private server library.

The shared in-game save strip distinguishes confirmed account saves, device-only progress, pending uploads and version conflicts. Completion requests an immediate save; leaving through the game controls waits up to eight seconds for a serialized flush. Smaller save requests use browser keepalive, and hiding or leaving the page attempts a flush. A browser close is not a guaranteed network delivery: pending device progress resumes when that exact game version reopens. Save details provide retry and explicit conflict review; no conflict is overwritten automatically. Guest progress is never silently imported into an account.

Imported JSON passes the same mode validator and a review gate. A reviewed custom version with an included pack’s ID takes precedence consistently in the library and after reload. It does not overwrite the built-in source file. Imports are capped and rendered as text, never HTML or scripts.

## Art pipeline

Production 2D art is generated through the Sorceress API on Baldur. Credentials stay there. Room plates, card illustrations and inventory sprites are separate assets so topic text and object meanings can change without regenerating a scene. Male and female character plates are separately animated, chroma-keyed to true RGBA, inspected and described by exact frame metadata. `public/game-modes/art/manifest.json` is the runtime contract; provider receipts and generation jobs remain outside the published app in `output/game-modes/assets`.

Concept images were made before implementation and added to the existing MagicPath canvas. They are design references, not gameplay evidence. Screenshots in the delivery report distinguish the concepts from the actual running games.

## Click-to-move correction in the RPG

Previously, reaching each grid waypoint consumed a frame and recorded movement after snapping. That frame looked stationary to the character controller and restarted the walk cycle. `advancePath` now spends the current distance budget across successive waypoints and measures displacement from the frame’s actual starting position. Keyboard takeover, collision stops, arrival and action locks remain explicit. Focused regression checks cover 30, 60 and 144 FPS, corners, obstacles and attack/cast locks; browser acceptance inspects real character poses while moving.

## Design resources

The frontend-design skill guided the shared palette, restrained chrome, game-specific compositions and visual critique. The private library informed two adaptations: embedded narrative/tutorial hints in environmental clues (*Pattern Language for Game Design*, 2021, PDF208), and obvious action affordances with meaningful motivation (*Advanced Game Design: A Systems Approach*, 2018, PDF175). PDF134 of the latter supports treating cards and tokens as representations of state, rather than complete world simulations. These are design adaptations, not evidence that the games improve learning. Private book text is not a shipped learning corpus or a model generation source.

## Next extensions

More room plates and event types can expand the vocabulary without adding executable model output. Wider curricula need subject-specific review and live trials. PDF/Word extraction, OCR, semantic retrieval and teacher assignment flows remain separate work. Cloud progress and structured editing of stored chapter copies are now implemented in the accounts phase. The three existing formats provide reusable game loops; additional formats should be added only when they teach something these loops do not cover well.
