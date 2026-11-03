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

## 3 November 2026 — launch assurance follow-up

Native Chrome with VoiceOver enabled: completed the VoiceOver startup prompt, confirmed the process running and Accessibility setting On, then used Tab/Return to start Thread Atlas and open an object. Focus moved to the object-panel heading. Escape closed it and returned focus to the triggering object button. VoiceOver was restored to Off afterwards. The available automation could not capture the spoken output/caption panel, so announcement correctness is still unverified.

In-app Chromium: Thread Atlas's Places and objects panel fit a 320×700 viewport (300px panel, no horizontal overflow); keyboard dismissal restored focus. The signed-in programme, evidence view and programme-choice controls fit 320px and 768px, with all active input/select controls labelled and no captured warning/error logs. Testing exposed a misleading cross-topic saved-learning-need label; the wording now makes clear that the current activity and evidence define the focus. No learner answers or preferences were changed during these checks.

No physical mobile device was attached; USB inventory was empty, Android tooling unavailable, and the installed command-line tools did not include `xctrace`. Physical iOS/Android, NVDA/TalkBack and speech-output verification remain open. These checks do not establish WCAG conformance.

## 3 November 2026 — independent-alerts follow-up

Further inventory found Xcode at `/Applications/Xcode.app/Contents/Developer`. With that explicit developer directory, `xctrace` reported only the MacBook Air. The installed iOS 18.5 simulator runtime was unavailable and no Android device tooling was available. This corrects the earlier tooling inventory, but does not add a mobile-device test pass.

VoiceOver was started for the requested native screen-reader checks. The caption/audio capture could not be verified and native automation stopped responding. After the user asked why it was enabled, the VoiceOver process was stopped and its absence confirmed. It was not enabled again during this session. No spoken-output pass is claimed.

In-app Chromium, local `atlas-water-world` with an existing completed save: keyboard character change returned focus to Menu; Requests opened with heading focus; reverse Tab reached the last quest control and forward Tab wrapped to Close; Escape restored focus to Requests. The 320×568 Requests panel was 300px wide with no page overflow. At 844×390, Places and objects remained within the viewport, its overflow scrolled, and reverse Tab brought the last destination fully into view. Escape returned focus to Places & objects. Background controls were inert during the dialog. No warning/error logs were captured. These checks did not exercise authentication or spoken announcements.

Evidence: `../output/independent-alerts/accessibility.json` and its `screenshots/` directory. Temporary viewport overrides were reset after testing. Physical iOS/Android, NVDA/Firefox, TalkBack and verified VoiceOver speech remain open gates.
