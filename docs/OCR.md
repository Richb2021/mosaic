# Reviewed printed scans

In a topic, choose **Add learning material**, enable **Read printed scans**, then select an English printed PDF, PNG, JPEG or WebP. Review and edit the transcription before saving. Saving creates an unreviewed source; the existing checksum-bound source review is still required before chapter generation.

The reader uses Tesseract.js 7.0.0 and its English trained data, with worker, core and language assets served from this Site. Recognition happens in the browser. It does not call Meta, Fish or a new OCR service. Image bytes are not uploaded or persisted. Only text explicitly saved by the author enters the existing private source store and its export/deletion/retention controls. No new storage table or data category is introduced.

Limits: 8 MB per file; OCR PDFs up to 12 pages; text PDFs remain limited to 80 pages; images up to 24 megapixels, rendered to at most 6 megapixels and 8192 pixels per side. PDF rendering is scaled before allocating the canvas. Each OCR document has a three-minute deadline. Cancellation, leaving the workshop or closing its game dialog terminates the document worker. A failed or cancelled extraction preserves previous form text.

When OCR is selected, every PDF page is rendered and recognised, including any embedded scans on a page with a text layer. Page labels are retained. Empty pages are named; errors and size/page limits reject the complete extraction rather than silently truncating it. Extracted text remains capped at 60,000 characters and 64 KB by both extraction and source validation; the source service also limits it to 80 passages.

Recognition confidence is shown for review, not as an accuracy guarantee. English printed text is the tested scope. Handwriting, diagrams, equations, unusual reading order and other languages still require a checked transcription. Modern module/nested-worker, canvas, WebAssembly and AbortSignal support is required; startup failures direct the user to a current browser or manual transcription.

Build with `npm run build`: `build.mjs` packages the pinned worker/core/language dependencies under `public/extraction/`, including licenses. Those generated assets are ignored by Git but included in the deployment archive. Do not deploy a source-only build that omits them.

Verification: `tests/ocr.test.mjs`, existing document-extraction and workshop tests; real browser image, multi-page scanned PDF, mixed text/image PDF, cancellation, page-limit refusal, source review and reopening. Evidence and independent audit disposition are in the workspace's `output/resource-library/` directory. Semantic retrieval and larger-library pagination are separate work; this OCR change does not claim either.
