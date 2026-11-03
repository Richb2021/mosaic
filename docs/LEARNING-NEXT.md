# Source review, concept practice and RPG cloud progress

> Historical milestone record. For current features, hosting and remaining limits, read the [application README](../README.md), [scope](SCOPE.md) and [deployment guide](DEPLOYMENT.md). Absence statements and test counts below describe this milestone.

This phase extends the existing owner-private site and NoCodeBackend account system. It adds no database tables, migrations, sharing changes or quota increases. The original full-product plan remains broader than this implementation.

## What changes

- RPG autosaves can sync through the existing learner-save API. The save binds the complete included world, settlement and reviewed chapter. Published custom chapters are resolved from the current Sites owner's library. Restoring the cloud keeps a device recovery copy. Guest saves and manual slots remain separate; account settings are read after identity is established. Older guest manual slots remain discoverable for their original chapter.
- RPG snapshots validate bounded world, quest and chapter state. They are **not action-history replay proofs** and do not emit subject-competence observations. The seven illustrated formats retain their existing replay validation.
- Uploads accept text, Markdown, text-layer PDF, Word DOCX, PowerPoint PPTX and VTT/SRT captions. Browser-local extraction produces editable text before upload; original binaries are not uploaded. Page, slide and caption markers survive into citation locators. Limits remain 8 MB input, 80 PDF pages/slides, 60,000 characters and 64 KB extracted text; Office decompression is bounded separately.
- Creators can inspect and change the exact evidence packet before generation. The UI displays selected/omitted passages and goal words absent from sources. The server reconstructs the packet from owned reviewed resources, up to twelve passages/18,000 characters, and rejects foreign/duplicate IDs. This is keyword retrieval, not semantic coverage assessment. Older API clients may still request automatic selection; the new UI always presents selection review.
- Optional reviewed concept maps attach objectives, exact activity keys, sources and acyclic prerequisite suggestions to all eight templates. Existing packs without maps and their save hashes remain valid. Included maps bind to exact authored content hashes. Shared evidence alone never equates different objectives.
- The Study trail uses actual mapped attempts, hints and corrected responses to suggest practice. Preparation is optional. A simple three-day revisit suggestion is based on the last saved run; it is not a calibrated memory or mastery model. RPG learning observations are deliberately excluded until their attempts can be verified.
- New football runs reward successful passes across different lanes and a feint. Repeated lanes influence defenders; keepers remember actual shots. All three formations still have winning routes after corrected answers. Existing version-1 histories replay under their original rules; new runs use version 2.

## Boundaries

PDF reading order, tables, diagrams, equations and slide columns require human checking. Scanned-image OCR, audio transcription, semantic retrieval, adaptive curriculum generation and an AI conversational tutor are not implemented here. The in-game support is a source-based predict/read/explain scaffold.

Generated concept maps are part of strict validation. Invalid activities, unsupported references or cyclic prerequisites fail closed; no map is silently stripped and no extra paid retry is sent. Known activity IDs and concept IDs are constrained in the generation schema where the template fixes them. Creator-prepared maps initially use activity labels and require editorial refinement during review.

The production workshop reached its existing rolling ten-draft daily cap. Fresh live Muse crafting generation and saving the corrected live sports copy remain pending; no provider request was started for the rejected crafting attempt. The new concept-generation schema is unit-tested but not yet proven against a fresh live Muse response. Existing reviewed chapters and new manually reviewed copies remain playable.

Password-reset delivery to a real inbox remains unverified. Public school/college rollout, resource retention/export/deletion, consent and organisation access management still require their planned work. The private book archive remains a design reference, never a product corpus.

## Evidence

See the parent project's `output/learning-next/evidence/` for test/build output, independent audit, upload results and screenshots. Browser acceptance exercised PDF/DOCX/PPTX/VTT extraction, image-only PDF refusal, source review and evidence exclusions, concept-map revision/publication/play, corrected-attempt suggestions, a completed six-possession football match, and RPG save/restore. Office files used synthetic format fixtures; these checks do not establish fidelity for every Office document.

The browser viewport control did not apply the requested mobile size (DOM remained 1280 pixels). New narrow-screen layouts therefore still need acceptance on a real narrow viewport; no mobile conformance is claimed.

The dependency audit reports eight moderate transitive/toolchain findings, no high/critical findings. The new direct `fflate` 0.8.3 is not the older nested version flagged through the existing OpenGraph toolchain. No forced downgrade or broad dependency rewrite was applied.
