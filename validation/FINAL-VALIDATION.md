# Final release validation — 2026-10-26

> Historical 38-test checkpoint. See MINIMAL-POLISH.md for the subsequent 39-test checkpoint and browser checks.

Checkpoint before this pass: `0b6e1fb`. The approved dark stylesheet, page layout, comparison modes, numerical detection engine and worker are unchanged.

## Completed changes

- `src/Viewer.tsx`: Changes defaults to the largest five boxes plus selected observation; All boxes toggle; selected rectangle painted last. Full calculated mask and observation register retained.
- `src/report.mjs`, `src/export.ts`: executive summary, five largest evidence crops, separate analyst records, measured reliability/quality, source provenance, and complete collapsible register. Full register printing is optional. Sources are safe HTTP(S) links. Printing waits for embedded images; no PDF dependency. Each original is decoded only once during report generation.
- `src/metadata.mjs`, `src/SourceMetadata.tsx`, `src/UploadDialog.tsx`, `src/types.ts`: optional organization/attribution/source URLs, validated calendar dates, editable uploaded source metadata, explicit user-provided provenance.
- `src/App.tsx`: integrates metadata within existing disclosure; guards duplicate/stale report generation; resets pending uploads on new analysis; waits for report image decoding before enabling Print.
- `src/images.ts`: interrupted reads reject; crop dimensions cannot round to zero.
- `tests/final-release.test.mjs`: six targeted regressions for metadata, links, 175-region synthetic report, exact crop/mask coordinates, aborted reads, and complete report orchestration with browser IO mocked.

## Actual automated results

- Baseline: 32 passed, 0 failed; TypeScript and production build passed.
- Final: 38 passed, 0 failed, 0 skipped (`node --test tests/*.test.mjs`).
- `npm.cmd run build`: TypeScript + Vite + offline asset generation passed.
- `node scripts/check-offline.mjs`: passed; generated worker installs and serves every production asset byte-for-byte (including the worker and CSS), navigation fallback, catalog and both imagery pairs with network fetch disabled in a Node harness. This does not establish browser lifecycle behavior.
- `git diff --check`: passed.
- Scenario validation: three repeats per pair against the existing decoded RGBA fixtures. Masks and region measurements exactly equal the baseline detector. Comparing each before image with itself returned zero changed pixels.

| Scene | Regions | Changed valid pixels | Total analysis time, three runs (ms) | Median (ms) |
|---|---:|---:|---|---:|
| Aral | 34 | 19.2486% | 303.19 / 346.45 / 354.23 | 346.45 |
| Pakistan | 26 | 55.3335% | 113.80 / 61.74 / 84.66 | 84.66 |
| Lake Mead holdout | 39 | 9.1167% | 109.84 / 103.25 / 96.59 | 103.25 |

Measured on this machine in Node; includes detector, threshold audit, quality screening and findings; excludes image decoding/rendering. Timings vary with runtime and machine load. These are not browser performance claims. Raw results and timing samples: `final-measurements/measured-results.json`.

All three scenes were threshold-sensitive. Coverage across tested thresholds: Aral 16.89–22.46%; Pakistan 43.24–66.89%; Lake Mead 5.26–16.38%. Pakistan triggered brightness-difference and widespread-change warnings. No small-shift cue was detected in these three pairs; that does not prove registration. Other synthetic tests exercise real brightness and translation warnings.

## Remaining limits and manual acceptance

Browser interaction is disabled in Work settings, so this pass did NOT verify interactive upload, visual layout, slider/pan, refresh restoration, report preview, actual PDF output/page breaks, or offline browser reload. Earlier server-stopped reload evidence was inconclusive (blank page); keep the localhost server running and check internet-disconnected reload on the demonstration browser. Do not present the harness as an end-to-end offline browser pass.

Brazil filenames were not found in the searched workspace/Downloads. The user's 175 regions / 34.83% / 108 ms are user-reported, not independently reproduced in this pass. The 175-region report regression is explicitly synthetic, not Brazil data.

Before presenting, execute:

1. Start production preview; open its URL. Load Aral, inspect alignment, acknowledge it and analyze. Confirm actual statistics and warnings.
2. Compare slider → Side by Side → Changes; zoom/pan; select a region outside the largest five; toggle All boxes. Check selected rectangle, crop and register agree.
3. Verify/reject a region; add a note. Wait for Saved on this device, refresh, and check restoration.
4. Generate report without reviews, then with reviews. Check sources, dates, crops, overlay and separate interpretations. Download HTML and print to PDF; verify images and page breaks. Check optional full-register printing.
5. Upload compatible PNG/JPEG/WebP pairs with optional dates/source details. Edit metadata. Test missing, invalid and mismatched inputs. Upload an identical pair and confirm zero changes.
6. Try absent/invalid/valid geographic bounds. No map/GeoJSON without valid reference; valid reference yields lon/lat GeoJSON.
7. Change settings and reanalyze; confirm explicit review-reset confirmation. Switch demos and begin a new analysis during upload; old regions, notes and reports must not reappear.
8. After cache readiness, disconnect internet and reload production preview with localhost server running. Confirm demos, custom upload, analysis and report still work.

Readiness: automated release checks pass; live-demo acceptance is conditional on the above browser checks. This is an analyst-assistance prototype, not operationally validated intelligence. No semantic classification, automatic registration, accuracy claim, cloud/shadow mask or arbitrary GIS reprojection is implemented. Geographic bounds assume north-up EPSG:4326. Wait for the save indicator before closing; browser storage can be denied or evicted.
