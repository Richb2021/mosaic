# Personal podcast playback

The podcast component reads a reviewed script in two original synthetic voices, with one selectable transcript passage per recording. Script generation, ownership, review and narration admission are enforced by the parent creative API; this player does not call a provider directly or trust a browser-submitted voice ID.

## Integration contract

`PodcastPlayer({script, audioFor, onStatus})` expects the canonical media script described in `src/studio/media/PodcastPlayer.jsx`. `audioFor(segment,index)` returns a real audio `Blob` for the exact reviewed segment. It is called only after a Play, passage-selection or audio-download action. The component does not use browser speech synthesis or label silent audio as narration.

The player supports pause/resume, previous/next passage, keyboard-operable seeking within a passage, four playback rates, visible full transcript, source excerpts, a voluntary explanation reveal, and assembled mono PCM WAV download. The transcript download includes the source excerpts and review question. Preparing a complete download intentionally requests every missing passage. The UI states that pausing playback does not cancel a provider request already in flight.

One media element and one object URL are used at a time. In-flight promises and completed blobs are cached for this mounted episode. Navigation between passages cannot let a late response replace the current audio. Unmount disposes the media element and object URL; changing the script resets the episode. The server now stores approved narration privately across sessions. A reload fetches the exact saved clip without another provider call. Failed or missing recordings need explicit cleanup before regeneration; see MEDIA-LIFECYCLE.md.

## Speech adapter

`server/media-audio.js` exposes `synthesizeSpeech({text,speaker},env,fetcher)` and `speechConfiguration(env)`. The caller must first authenticate the learner, resolve canonical reviewed text and reserve its render budget. The adapter requires:

- `FISH_AUDIO_API_KEY` (server-only secret)
- `FISH_AUDIO_GUIDE_VOICE=dbcbed0b5de6483c9151772d1bced43b`
- `FISH_AUDIO_LEARNER_VOICE=6f6e46546b5e49b79c64db01afbc469a`

These two voices were designed from written descriptions for Mosaic, then registered privately from the generated previews on 1 November 2026. No real person's audio, named character or public-library clone was used. Provenance and local preview recordings are in `../output/media-studio/podcast/voice-provenance.json`.

The adapter pins `s2.1-pro`, POSTs JSON to `https://api.fish.audio/v1/tts`, uses the configured speaker preset and requests MP3. It does not rewrite the reviewed script: normalisation is disabled, so ambiguous numbers and pronunciations should be corrected in the script before approval. It accepts at most 900 characters/3,600 UTF-8 bytes per segment, limits returned audio to 4 MiB and uses a 45-second deadline. Redirects, non-audio responses and invalid MP3 headers fail closed. Error text excludes provider response bodies and credentials. Transport failures do not cause an automatic retry.

Provider contract verified against [Fish's official TTS reference](https://docs.fish.audio/api-reference/endpoint/openapi-v1/text-to-speech) on 1 November 2026. The reference supports explicit `s2.1-pro` model selection, JSON requests, preset voice IDs and MP3 output. The production app's text generation remains Meta Muse Wonder; Fish is only the speech adapter.

## Design direction

The podcast continues Mosaic's Manrope type, ink `#172b48`, cobalt `#294dde`, quiet blue `#abc5eb`, chartreuse paper `#dce5a8` and pale workspace `#f5f7fc`. The one distinctive element is a cobalt episode sleeve with two original headset illustrations. Playback controls remain calm and familiar. The transcript occupies the page rather than a small scrolling chat box, with source evidence beside the relevant passage. There is no fake waveform, decorative autoplay or unrelated stock image.

## Verification and bounds

`node --test tests/media-audio.test.mjs` exercises server request pinning and size bounds, sanitized failures/no retries, shared in-flight caching, late navigation responses, pause/seek/rate, automatic advance, late play acknowledgements and real PCM WAV structure.

An isolated browser fixture used a real 12.591-second `s2.1-pro` guide recording and an 8.591-second designed co-host preview. Play/pause, host changes, automatic advance, 1.25× speed, keyboard seek, explanation/source reveal and a complete WAV download were exercised. The downloaded file was inspected by ffprobe: 21.382 seconds, mono PCM s16le, 44.1 kHz, 1,885,972 bytes. The fixture returned no captured browser warning/error logs. Desktop and 375-pixel mobile screenshots are retained alongside the acceptance JSON; mobile document width equalled scroll width (375 pixels).

This component verification does not establish hosted authentication, source-generation/review persistence, quota enforcement, pronunciation quality across subjects or low-end device performance. The parent mission owns those integration checks. It also does not establish educational efficacy or mastery.
