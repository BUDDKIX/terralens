# TerraLens final release verification

Date: 2026-10-26. Existing repository retained; no backend or runtime dependencies added.

## Release status

The local core demonstration workflow is verified. The full acceptance criteria are not all complete: embedded-browser reload with the preview server stopped failed, PDF saving was not completed, and hosted publication is blocked by Sites returning project not found. Keep the local preview server running for the presentation. No operational readiness or detection accuracy is claimed.

## Changes

- Light, neutral four-step interface: Load Images → Analyze Changes → Inspect Findings → Generate Report.
- Inline before/after file selection and drag-and-drop handlers; PNG, JPEG and WebP support.
- Synchronized side-by-side imagery with Before, After and Changes modes; shared zoom/pan and selectable regions.
- Automatic summaries remain primary. Reliability and quality warnings remain visible; exact numeric settings are expandable and require explicit analysis.
- Neutral analyst categories; Verified, Rejected and Unreviewed actions preserve the existing stored status values for compatibility.
- Stale demo loading and worker errors are guarded. Session restoration no longer depends on fetching the demo catalog. Pending upload completion is ignored after its component unmounts.
- Serialized debounced saves, persistent new-session reset, unsaved-exit warning, and review-replacement confirmation.
- Report snapshots include source filenames/dimensions and top-five evidence crops even without reviews. Decoded originals are reused for sequential crop generation, avoiding concurrent full-image decoding per observation.
- Non-square report maps preserve raster geometry. New demonstration header, print styles, HTML download and valid-geography GeoJSON export.
- Dialog focus handling and responsive layout.

Removed: dark dashboard/rail, wipe comparison slider, simulated replay feed and event log, prominent sensitivity sliders, duplicate export controls and unsupported military category suggestions. Existing saved analyst categories remain readable.

## Files modified in this sprint

`src/App.tsx`, `src/Viewer.tsx`, `src/UploadDialog.tsx`, `src/AnalysisInsights.tsx`, `src/Evidence.tsx`, `src/styles.css`, `src/images.ts`, `src/storage.ts`, `src/export.ts`, `src/report.mjs`, `src/engine.mjs`, `index.html`, `README.md`, `tests/report.test.mjs`.

Added: `tests/release.test.mjs`, this report, labeled upload fixtures, release measurements, screenshots and browser-exported evidence in `validation/`.

The numerical segmentation, findings, quality and stability algorithms were retained. The engine change only adds invalid-coordinate/raster-size rejection to geographic conversion.

## Automated validation

- Baseline: all 27 existing tests passed before editing; TypeScript and Vite build passed.
- Final: `node --test tests/*.test.mjs` — 32 passed, 0 failed. Original tests retained; report banner assertion updated for requested wording.
- `npm.cmd run build` — TypeScript and production build passed.
- `node scripts/check-offline.mjs` — generated service-worker asset install/fetch harness passed. This does not establish browser offline behavior.
- `git diff --check` — passed; Windows line-ending notices only.
- New tests cover supported upload MIME types, oversized files, decoding/compatibility boundaries, repeated session reset, invalid geography and non-square report geometry/source metadata. Browser IO is mocked in boundary tests; actual uploads were separately exercised below.
- Three actual numerical runs each for Aral, Pakistan and Lake Mead. Baseline mask and region equivalence assertions passed; identical-image checks returned zero changed pixels for all three.

## Actual numerical scenario results

These use Pillow-decoded RGBA and the same analysis function as the worker. Total timings exclude image decoding, UI delivery and report rendering; values are medians of three runs.

| Scene | Regions | Changed valid pixels | Median total analysis |
|---|---:|---:|---:|
| Aral | 34 | 19.2486% | 124.42 ms |
| Pakistan | 26 | 55.3335% | 27.63 ms |
| Lake Mead holdout | 39 | 9.1167% | 42.95 ms |

All three were sensitive to threshold selection. Pakistan triggered brightness and widespread-change warnings. Raw timings and outputs are in `release-measurements/measured-results.json`. Lake Mead remains a validation-only real pair, not a new demo catalog entry.

## Actual browser verification

Performed through the supported in-app browser on a separate local origin at port 5186. Existing sessions at ports/origins used earlier were not cleared.

Passed:

- Initial load screen and disabled actions for missing inputs.
- Real custom WebP before + PNG after upload, 320 × 160 pixels. One region, 3,832 changed pixels, 7.48% coverage, 41.3 ms total for the recorded run. The fixture is explicitly synthetic; smoothing expands its 60 × 60 high-contrast rectangle boundary.
- Evidence crops, actual mask visualization, region selection, optional note, neutral category and verified status.
- Refresh restores custom imagery, notes and verified status.
- HTML report preview and actual browser download; report contains the same run ID, measurements, images and review. Saved as `release-custom-upload-report.html`.
- GeoJSON correctly disabled for unreferenced uploads.
- Mismatched JPEG dimensions rejected; corrupt PNG rejected with decoding error.
- Identical WebP/PNG content produces zero regions and zero coverage, insufficient reliability rather than invented confidence, and a useful empty-results report.
- Reviewed-session replacement confirmation and new-analysis reset.
- Aral demo: 36 regions, 19.28%, largest 99,867 pixels, approximately 146 ms total in recorded run. Thresholds 27/35/43 yielded 22.48/19.28/16.84% coverage. Map rendered; browser GeoJSON download contained 36 unreviewed Point features within source bounds. HTML report downloaded without analyst approval.
- Pakistan demo: 26 regions, 55.33%, largest 27,613 pixels, approximately 72 ms total in recorded run. Brightness delta −56.8/255 and widespread-change warnings displayed.
- Desktop visual inspection; findings layout inspected at 390 × 844 mobile viewport. Viewport override reset afterward.
- Browser console check returned no warning/error entries during the tested workflow.

Browser and numerical Aral counts differ due to image decoding/resampling. Use the live displayed result when presenting; neither is ground-truth accuracy.

Incomplete or failed:

- With the port-5186 preview server stopped, reloading twice returned a blank root despite cached HTML. Cause was not established. The server was restarted and the application recovered. Do not promise serverless offline reload in this browser.
- Print/Save as PDF action was invoked, but the browser tool timed out and no PDF file was produced. HTML export is verified; PDF requires a rehearsal in the presentation browser.
- Drag/drop handlers, exhaustive mobile interactions, maximum-size browser uploads and forced rapid-run race stress were not individually exercised in the browser. Corresponding validation/guards are implemented, but these checks are not claimed as passed.
- Sites lookup returned `Sites project not found` for the existing project ID; no replacement Site was created and no new hosted release is claimed.

## Launch

From PowerShell:

```powershell
Set-Location 'C:\Users\logme\Documents\Codex\2026-10-25\im-x20\outputs\terralens'
npm.cmd ci
npm.cmd run build
npm.cmd run preview -- --port 5186 --strictPort
```

Open http://127.0.0.1:5186/. If dependencies already exist, `npm.cmd ci` is unnecessary. The production output is `dist/`. Do not open its index file directly; use HTTP localhost or HTTPS. Keep the server running during the demo; local serving and computation do not require internet once installed.

## Three-minute presentation

1. 0:00–0:25: select Aral Sea and explain public source dates.
2. 0:25–0:55: compare side-by-side imagery, inspect landmarks, acknowledge alignment limits, Analyze Images.
3. 0:55–1:50: show computed findings, Changes overlay and threshold sensitivity.
4. 1:50–2:15: select a region, inspect both crops, optionally add a qualified analyst interpretation.
5. 2:15–3:00: Generate Report and download HTML; show GeoJSON if useful. Pakistan is the validated backup scene.

Recoverable pre-edit snapshot: `../TerraLens-before-release.zip`. Final source and production archives are in the parent outputs directory.
