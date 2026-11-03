# Story direction and moving cartoons

The studio now sends `story: {genre, interest}` with new cartoon and podcast requests. Adventure, action, drama, comedy and mystery are bounded options. A chosen interest must come from the programme's saved profile; it is prioritised ahead of the second context interest. Level, current difficulty and goal remain part of the minimised context. Games accept the same brief in the source workshop, prefilled from the learner's profile.

Muse Wonder (`muse-wonder-1.0`) writes a goal, stakes, obstacle, discovery, consequential choice and payoff before the dialogue. The story should need the source relationship to resolve its problem. Fiction and analogies cannot establish external facts about an interest. The review screen exposes this outline and asks the reviewer to check both learning claims and story quality. Structural validation is not a judgement that a story is compelling or factually supported.

New media uses schema version 2: six to twelve scenes, both characters, a hook and payoff, setback/discovery/choice beats, two settings and exact packet source IDs. One segment belongs to one voice. Cartoons also require closed staging instructions, with varied movement. Existing version-1 scripts and request hashes remain compatible. Free edits invalidate review; narration still requires the exact approved hash, and stored recordings reuse the existing ownership, retention and cost controls.

## Animation

Eight authored blocking paths: arrive, travel right/left, approach, separate, pursuit, retreat and face-off. Four camera choices: wide, two-shot, speaker and reaction. Calm/urgent pace selects the walk timing. Characters walk along stage paths, face their travel direction, turn toward each other when settled, react and gesture. Stage state derives from the audio clock, including pause, playback rate, scene seeking and exported video. Still artwork fixes the actors and camera while audio and captions continue. Both raster styles and the Field Notes vector fallback use the same director.

These are reusable staged 2D scenes. They do not yet depict arbitrary model-written stunts, object interactions or word-level lip sync. The fixed art library has two characters and four setting families. A space or football story can use these worlds, but bespoke spacecraft, balls, instruments and other subject props are not automatically drawn. Further action clips and prop choreography can extend the closed library.

## Working examples

`/cartoons` now contains The Beacon Run (space action), Half-time, Whole Trouble (football comedy) and The Bridge Before the Bell (music audio drama). All three began as real Muse responses, were editorially reviewed against the same authored fractions note, and use 27 retained Fish S2.1-Pro recordings in the existing original Mira/Kit voices. The originals, editorial revisions, provider IDs and receipts are in the root workspace's `output/story-direction/`, outside the published repository.

The examples are curated demonstrations; new user scripts still require review. A directly generated business-mystery visual novel passed the structural validator but is withheld from publication because its branch inventory/consequences need editorial repair. This demonstrates why schema validation cannot replace review. The same story brief is delivered to all nine game providers while preserving their authored mechanics and source validation; existing quiz/sports templates do not become unrestricted RPGs.

## Verification

The test suite covers v1/v2 isolation, exact citations, selected-interest prioritisation, request idempotency, free edits/review/audio reuse, tenant isolation, game-provider transport, all blocking/shot combinations, pause/seek/still determinism, and vector facing via transformed eye positions. Browser checks cover local production players, a clearly labelled UI fixture for create/edit/review controls, phone layout, replay, scene selection, saved audio and full WebM/WAV exports. Direct provider QA is recorded separately from the production cost ledger; no test provider call was represented as a budgeted app request.
