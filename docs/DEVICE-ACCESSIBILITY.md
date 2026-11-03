# Device and accessibility verification — 3 November 2026

The current release fixes observed keyboard and small-screen barriers. It does not establish WCAG conformance or full screen-reader compatibility.

Shared modal behaviour in `src/game-modes/accessibility.js` isolates the dialog from the game and outer save bar, preserves prior inert state, explicitly cycles all visible enabled controls (including links and summaries), and restores focus to newly rendered triggers. This avoids Safari's default button-skipping Tab preference inside dialogs. The RPG, draft, town, current journeys and classic extended games use it. Adventure retains its existing equivalent behaviour.

Journey dialogs use their displayed heading as the accessible name. Quiz encounters focus the question; answer feedback remains focused. Sports stamina and merge delivery actions have explicit names; town and journey outcomes use a persistent polite announcement node. These nodes were inspected in the browser; actual screen-reader speech remains unverified.

RPG titles fit at 320px, and short landscape viewports keep the title screen scrollable without clipping its controls or losing their background contrast. No content, pack, save or backend schema changes are part of this release.

Evidence is in `../output/device-accessibility/`: 24 loaded game/viewport cases (eight formats at 320px portrait, 768px tablet portrait, 844px landscape), named keyboard interactions, native Safari 18.5 merge crafting/delivery/save reload, Safari dialog focus and 200% page zoom, guest studio profile at 320px, screenshots, test/build output and independent review.

## Remaining device gates

- Physical iPhone/iPad and Android: touch, rotation with browser chrome, background/resume, storage and media playback.
- VoiceOver/Safari spoken-output journey: VoiceOver did not remain running after being enabled in the available session. Off state was restored/confirmed; no speech pass is claimed.
- NVDA/Firefox and TalkBack: unavailable here; no pass claimed.
- Representative learner and assistive-technology user sessions, including full endings and personalised media.

Keep these gates separate from automated tests and viewport emulation. Future changes to modal rendering should test background isolation, every Tab step, reverse Tab from the heading, nested evidence return, close, unmount and an existing save. Do not replace inert with ARIA alone or remove evidence links from the focus cycle.
