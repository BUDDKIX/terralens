# Latest upgrade

The final intelligence/reliability upgrade has 27 passing tests and a passing production build. See [the measured upgrade record](validation/UPGRADE-VALIDATION.md) for current scenario results, performance and browser verification limits. The historical checks below refer to the earlier prototype and do not certify the new panels.

# TerraLens validation record

Date: 2026-10-25. These are prototype checks, not a claim of operational detection accuracy.

## Imagery milestone

Two real NASA GIBS before/after pairs were downloaded with identical geographic bounds, dimensions, and projection within each pair. Stable terrain was visually inspected. Aral Sea imagery showed a strong basin-scale visual transition. Pakistan false-color imagery showed extensive visual change but also clouds and radiometric differences; an exact crop excludes the densest cloud band without changing image content.

Initial validation ran the same `detectChanges` engine used by the browser. At 768 × 768, threshold 35, and minimum area 100, the PNG-based Aral trial produced 35 regions and 19.2513% visual difference coverage. The exact shipped JPEG/browser-decoded pair produced 36 regions and approximately 19.3%. This small difference reflects image encoding/resampling and is not an accuracy estimate.

The shipped 325 × 325 Pakistan crop at threshold 45 and minimum area 35 produced 26 regions and 55.3335% visual difference coverage in both the direct engine check and browser. Broad differences are explicitly not interpreted as confirmed flooding. The largest components overlap visibly changed areas; no independent ground-truth segmentation was available.

Measured individual browser detector runs included approximately 90–137 ms for Aral and 65–120 ms for Pakistan on the QA device. These are observations, not a performance guarantee. The application displays each actual run's time.

## Automated checks

11 tests cover:

1. Identical images yield zero regions.
2. Known synthetic rectangles produce exact bounding boxes and areas without smoothing.
3. Minimum-area filtering removes small isolated changes.
4. Raising the threshold removes lower-magnitude changes.
5. Row boundaries do not incorrectly connect separate components.
6. Transparent and near-black no-data pixels are excluded.
7. Invalid dimensions and settings are rejected.
8. Pixel-center geographic interpolation and missing bounds.
9. Immutable review updates, preserved notes, and invalid-status rejection.
10. Reports reflect supplied analysis data and escape malicious text.
11. IndexedDB round trips preserve typed mask arrays, image assets, settings, approval and rejection.

Storage tests use fake-indexeddb; real browser persistence was separately checked.

## Browser workflow checks

- Both real scenes load and run the actual detector.
- Before/after comparison and candidate overlays render.
- Geographic image map and candidate markers render from declared bounds.
- Analyst category and note editing works; approval survives a browser reload.
- Rejection updates the review queue.
- The in-app replacement prompt appears before reviewed analysis is overwritten.
- Simulated replay displays acquisition states and generates a new actual result.
- Report preview contains current counts, source images, mask, reviewed crops, notes, geographic markers, settings and limitations.
- HTML report downloads successfully with embedded image data. Browser Save as PDF is exposed through print styles; a saved PDF was not independently inspected in QA.
- Mismatched uploads (1000 × 1000 versus 325 × 325) are rejected.
- Uploading the same image twice produces zero candidate regions and no geographic location.
- Mobile layout checked at a 390 × 844 viewport; no horizontal document overflow was found.
- With the local HTTP server stopped, switching from an uploaded pair to the cached Aral scene and running a new detection succeeded.
- Reload and full page navigation through the embedded-browser automation returned a blank page while the server was stopped. The cause was not established. Offline refresh is not claimed as verified; keep the local server running for the presentation.

## Issues found and repaired

- Approval could be lost within the initial autosave debounce window: changed to immediate persistence and added a storage regression test.
- Native confirmation dialogs were unreliable in the embedded browser: replaced with an in-app confirmation dialog.
- Report popup handling differed by browser: moved report preview into an in-app iframe, retaining downloadable HTML.
- Rebuilt application could receive stale cached HTML: navigation now uses network-first HTML with offline cache fallback.
- Unreferenced uploads initially displayed a north arrow: removed unless geographic bounds are supplied.

## Known limits

No automatic image registration, cloud masking, scientific reflectance processing, classification, geographic area estimation, validated precision/recall, or operational inference. Shared output grids are not proof of subpixel alignment. Public browse imagery is regional-scale, unsuitable for establishing individual road or building conditions. Review approval is an analyst interpretation, not independent verification.
