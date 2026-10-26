# TerraLens

A browser-based satellite change-review workspace for Defense Hackathon Problem Statement 3.

**Workflow:** one continuous dark workstation: load imagery → analyze → inspect findings → optional review → report/export. Comparison slider, side-by-side imagery and change-mask modes share the same viewer.

## Start locally

Tested with Node.js 24 on Windows. Run from this project folder:

```powershell
npm.cmd ci
npm.cmd run dev
```

For the production build, including offline caching:

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run preview -- --port 5174
```

Open the URL printed by Vite. Keep the local preview server running during the hackathon; it does not need an internet connection after dependencies and assets are installed. Do not open `index.html` directly using a `file:` URL. Browser workers, IndexedDB, and service workers require HTTP localhost or HTTPS.

## Three-minute demo

1. **Load Images (0:00–0:25):** choose Aral Sea shoreline retreat from Select Demo Scenario. Explain the public NASA GIBS source and dates.
2. **Analyze Changes (0:25–0:55):** inspect the synchronized side-by-side imagery and stable landmarks; acknowledge the alignment limitation; click Analyze Images. Exact settings are in Advanced Settings.
3. **Inspect Findings (0:55–1:50):** read actual coverage, region count and timing. Explain threshold stability and quality warnings. Select Changes to see the calculated mask; select a region and compare evidence crops.
4. **Optional review (1:50–2:15):** add an evidence-based note and Mark as Verified. This records analyst interpretation, not ground truth. Geographic map is available for valid bounds.
5. **Generate Report (2:15–3:00):** continue to report, generate the preview and download HTML. GeoJSON is available for georeferenced data. PDF uses the browser print dialog and needs a rehearsal in the presentation browser.

Backup: Indus floodplain change, which demonstrates brightness and widespread-change warnings. Custom uploads accept compatible PNG/JPEG/WebP pairs, including unreferenced imagery. The Compare slider is available alongside Side by Side and Changes in the evidence workspace. The simulated replay feed remains removed.

See `validation/RELEASE-REPORT.md` for the final tested scope and remaining release limitations.

## Real demonstration imagery

| Scene | Dates | Assets | Geographic extent |
|---|---|---|---|
| Aral Sea shoreline retreat | 2000-08-25 / 2014-08-19 | Terra MODIS, natural color, 1000 × 1000 | EPSG:4326 [58, 43, 61.5, 46.5] |
| Indus floodplain change | 2022-08-04 / 2022-08-28 | NOAA-20 VIIRS, false color M11-I2-I1, 325 × 325 exact crop | EPSG:4326 [67.55, 26.9, 68.2, 27.55] |

Bounds are ordered west, south, east, north. Both dates in each scene use identical geographic grids. This is not independent subpixel registration validation. Sensor resolution is not the same as the export pixel spacing.

`public/imagery/manifest.json` contains exact WMS source URLs, dates, SHA-256 checksums, attribution, source context, preparation details, and limitations. `crop-candidates.json` preserves the exact integer crop provenance. Uncropped Pakistan JPEGs are retained for inspection. No synthetic demo scenes are used.

We acknowledge imagery provided by NASA Global Imagery Browse Services (GIBS), part of NASA's Earth Science Data and Information System (ESDIS), with Terra/MODIS and NOAA-20/VIIRS observations. See the source manifest for NASA's data-use policy and contextual articles. Images were converted to JPEG; the Pakistan pair was identically cropped. No generative editing or invented image content was used.

## Detection method

- Processing grid capped at 768 pixels on the longest edge, preserving aspect ratio.
- Transparent pixels and near-black no-data backgrounds excluded from comparisons.
- 3 × 3 mean filter, followed by mean absolute RGB-channel difference.
- User-controlled difference threshold and minimum changed-pixel region area.
- Four-connected component extraction yields exact mask labels, bounding boxes, pixel area, and centroids.
- Worker execution keeps processing off the main UI thread; stale workers are terminated.
- Every run has a UUID, timestamp, settings, and separately measured detector/audit/quality/total runtimes.
- Three nearby thresholds reuse cached difference scores and compare final pixel masks.
- Preliminary findings and heuristic quality warnings are generated from actual analysis data.

The same engine runs in automated tests and the browser worker. Review decisions are separate from algorithm output. Settings apply on an explicit Analyze Images action; reviewed runs require confirmation before replacement. Reports preserve the completed run's settings even when numeric controls have subsequently changed.

## Compatibility and limits

Uploads accept PNG/JPEG/WebP, up to 15 MB each and 20 megapixels. Unequal dimensions are rejected. Matching dimensions do not establish matching geography; the analyst must inspect alignment. No automatic registration, cloud masking, spectral analysis, object recognition, or machine-learning classifier is implemented.

Clouds, shadows, color rendering, lighting, vegetation seasonality, and residual registration can create false positives. The Pakistan scene has stronger radiometric and cloud-related confounds. It is a review exercise, not a validated flood-extent segmentation. No accuracy or confidence percentage is claimed. Changed-pixel percentage is not damage percentage.

Geographic mapping is available only for the prepared georeferenced scenes or uploads with explicitly supplied valid north-up EPSG:4326 bounds. Unreferenced uploads have no fabricated coordinates or map location. Maps use an image overlay on Leaflet's EPSG:4326 CRS, with pixel-center coordinates. No geographic area, road passability, operational conclusions, or ground verification is inferred.

## Persistence, offline operation, and privacy

The current analysis, image data, mask, settings, and review decisions are stored in IndexedDB on this browser. Saving is debounced by 800 ms after edits stop. Wait for **Saved on this device** before closing. Browser storage is not a backup; export reports for a separate record. Only one current analysis is retained; use the replacement prompt to avoid accidental loss of reviewed evidence.

All processing is client-side. There are no API keys, paid model services, accounts in the application, database servers, external fonts, or online map-tile dependencies. Source links require internet access. The hosting service may apply its own access control.

The production build precaches its static assets and both prepared scenarios. Normal navigation requests the current HTML when online and falls back to the cache when offline. Browser policies can restrict service workers. Scene switching and fresh processing with the local server stopped were verified. Reload and full navigation while the server was stopped failed in the embedded QA browser; the cause was not established. Use a running local production preview for the offline presentation. It requires no internet connection, but refresh after stopping the local server is not a verified capability.

## Project structure

- `src/App.tsx`: workspace state, analysis lifecycle, review workflow, and dashboard.
- `src/Viewer.tsx`: comparison, overlays, shared pan/zoom, and region selection.
- `src/GeoMap.tsx`: geographic image overlay and observation markers.
- `src/UploadDialog.tsx`, `src/Evidence.tsx`: upload validation UI and evidence crops.
- `src/engine.mjs`: deterministic image comparison, coordinate conversion, review updates.
- `src/detector.worker.ts`: background processing boundary and stage updates.
- `src/analysis.mjs`: shared complete analysis path used by the worker and scenario validation.
- `src/findings.mjs`, `src/reliability.mjs`, `src/quality.mjs`: numerical summaries, threshold mask agreement and quality screening.
- `src/AnalysisInsights.tsx`: automated findings, reliability and quality panels.
- `src/images.ts`: image decoding, dimension validation, processing copies, masks, crops.
- `src/storage.ts`: IndexedDB persistence.
- `src/report.mjs`, `src/export.ts`: escaped HTML report and embedded evidence rendering.
- `scripts/offline.mjs`: build-derived service-worker asset manifest.
- `tests/`: algorithm, coordinate, report-escaping, review, and persistence checks.

## Validation

See `VALIDATION.md`. Run `npm.cmd test` for deterministic checks, then `npm.cmd run build` for TypeScript and production packaging. `imagery-validation.json` records the initial PNG-based threshold sweep; the shipped JPEG/browser pipeline can differ slightly due to decoding and resampling. Timing depends on the runtime and device.

## GeoJSON export

Use **Export GeoJSON** beside the report export controls to download a WGS84 FeatureCollection. Features contain Point centroids in longitude/latitude order, analyst category, reviewStatus, meanDifference, notes, and a region bbox property ordered west/south/east/north. Rectangle edges are converted without an extra half-pixel offset. Export requires geographic bounds. Neutral categories are analyst interpretations, never automatic conclusions. Reports use “TERRALENS — GEOSPATIAL CHANGE ASSESSMENT” and “UNCLASSIFIED DEMONSTRATION — ANALYST ASSISTANCE PROTOTYPE” and make no official classification or authentication claim.

## Reliability upgrade verification

The original 13 tests and subsequent upgrade tests are preserved within 32 passing tests. `npm.cmd run build` passes TypeScript and production packaging. After building, `node scripts/check-offline.mjs` validates the generated service worker in an offline harness. This is not a substitute for browser offline testing.

`validation/measured-results.json` records both bundled scenes plus a real Lake Mead holdout pair, source checksums and three measured runs per scene. `validation/UPGRADE-VALIDATION.md` explains preprocessing, actual results, methods and remaining limits. Standalone preliminary HTML reports and before/after/overlay figures are saved in the same directory. The Lake Mead data is validation-only; it does not change the demo scene catalog.

For repeat numerical validation, decode the originals to RGBA without changing their relative grids, create jobs with scene metadata, dimensions, options, beforeRGBA and afterRGBA file paths, and run `node scripts/validate-scenarios.mjs <jobs.json> <output-directory>`. Use the source URLs and checksums in the manifests to reproduce downloads. `node scripts/export-validation-reports.mjs` regenerates the saved preliminary reports from recorded measurements.

Final-release browser checks passed custom WebP/PNG uploads, corrupt/mismatched rejection, identical-image zero results, analysis, evidence, reviews, refresh/restore, demo switching, HTML downloads and GeoJSON downloads. Mobile findings were inspected at 390 × 844. Save as PDF was invoked but not completed through the in-app browser. With the preview server stopped, reload produced a blank application in that browser; offline reload is not release-certified. Keep the local production server running during a presentation. No operational readiness or real-world detection accuracy is claimed.


## Dark workstation revision

The latest frontend replaces the separate step navigation with a continuous evidence workspace. Static charcoal/olive surfaces, compact labeled measurements and an expanded image viewer prioritize inspection. Longer assessment text, numerical diagnostics and methodology remain available through labeled disclosures. No detection, persistence, upload, review, mapping or export capabilities were removed. The report document stays print-friendly.

Validation: 32 tests passed; TypeScript/Vite build and offline asset harness passed. Browser access became disabled during this revision, so the latest layout and restored slider have not yet been browser-verified. Earlier browser evidence and screenshots describe the prior light revision. Existing PDF/offline reload/hosting limitations still apply.
