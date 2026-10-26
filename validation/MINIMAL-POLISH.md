# Minimal release polish — 2026-10-26

Changes restricted to `src/styles.css`, `src/images.ts` and regression tests. No analysis algorithm, navigation or theme changes.

- Inspection grid children may shrink; detail content wraps; desktop details scroll within viewport-height bounds. Mobile details use ordinary page scrolling. Review controls remain inside panel width.
- Evidence crops use original-image dimensions, with the same processing-coordinate footprint and 12-pixel context margin. Output is capped at 680 pixels on the longer edge without upscaling source imagery. Aspect ratio is preserved within integer canvas rounding.

Verified in the running production browser:
- 1280px viewport: document width 1265px; details right edge 1235px.
- 375px viewport: document width 360px; details right edge 348px; all review controls inside the panel. Keyboard Tab reached Mark as Verified and scrolled it into view. Screenshot: polish-mobile.png (local generated artifact, excluded from the submission tree).
- 768px viewport: document width 753px; panel width 693px. Viewport override reset afterward.
- Changes mode initially showed five boxes. Selecting region 4 outside the largest five produced six boxes with region 4 drawn last; details and crops matched region 4. The unchanged mask renderer uses actual nonzero labels (also covered by the pixel-mask regression test).
- Report preview generated from the saved Aral analysis. Both 1000x1000 source images, the 768x768 overlay, and all ten evidence crops decoded successfully; all 13 images were embedded data URLs.
- Optional source organization and attribution are included and HTML-escaped, verified by the report regression test.

Validation: 39 tests passed, 0 failed; TypeScript/production build and complete offline asset harness passed; git diff --check passed.

Remaining verification gap: clicking Print / Save as PDF timed out in the in-app browser. No PDF was produced or inspected; PDF image rendering/page breaks are not claimed as passed. Preview image decoding is verified, not equivalent to PDF validation. The initial blank tab contained an older cached page while the preview server was stopped; restarting localhost and reloading restored the app. Offline reload was not retested in this polish pass.
