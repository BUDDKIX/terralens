# Intelligence and reliability upgrade — measured validation

The original 13 tests passed before implementation. The production build passed at the baseline and after each implementation phase. The final suite has 27 passing tests. No real-world detection accuracy is claimed.

## Phases completed

1. Inspected engine, worker, viewer, map, reports, storage and both NASA GIBS manifests. Identified sensitivity to thresholds, lack of preliminary explanations and quality cues, and inherited display issues.
2. Added a deterministic findings generator: region count, changed-pixel coverage, sizes, 3 x 3 pixel distribution, largest regions and source-based coordinates.
3. Added a three-threshold pixel-mask audit. Shared score preparation avoids repeating smoothing. The selected run's mask and IDs remain unchanged.
4. Added valid-overlap, mean-luminance, broad-change and limited shift-screening warnings. No geometric or radiometric correction is applied.
5. Added saved automatic findings, reliability, warnings and timings to reports; separated optional analyst-approved interpretations; replaced the previous classification marking with an unclassified demonstration banner.
6. Integrated the three panels into the current dashboard, made Analyze the central action, and preserved viewer, review, mapping, GeoJSON, reports and storage.
7. Ran tests, production build, service-worker harness and three real-image comparisons. Compared upgraded output with the existing baseline engine for every scenario.

## Measured scenarios

Settings are RGB threshold / minimum processing-pixel area. Timings are median total worker analysis time across three actual Node.js runs; each includes the primary detector, threshold audit, quality screen and findings generation. They exclude image decoding, browser rendering and export. These are measurements on the execution host, not guarantees for another device.

| Scene | Processing grid | Settings | Regions | Changed pixels | Nearby-threshold coverage | Median total |
|---|---|---|---|---|---|---|
| Aral Sea shoreline retreat | 768 x 768 | 35 / 100 | 34 | 19.25% | 16.89–22.46% | 126.02 ms |
| Indus floodplain change | 325 x 325 | 45 / 35 | 26 | 55.33% | 43.24–66.89% | 44.55 ms |
| Lake Mead independent comparison | 512 x 512 | 35 / 100 | 39 | 9.12% | 5.26–16.38% | 41.71 ms |

All three scenes received **Sensitive to threshold selection** under the documented intersection/union heuristic. The label is not confidence or accuracy. Aral's most changed grid cell was the center third. Pakistan occupied all nine sectors, with a mean luminance delta of approximately -56.79/255 and broad detected coverage. It triggered brightness-difference and widespread-change warnings. Aral and Lake Mead did not trigger screening warning thresholds; that does not establish image quality or correct registration.

The independent Lake Mead pair (2010-07-01 and 2022-07-01) was downloaded after implementation and processed with the default threshold 35/minimum area 100. No settings were tuned to that pair. Exact NASA GIBS URLs, dates, bounds, attribution and SHA-256 checksums are retained in holdout-manifest.json. All shipped scene and holdout image checksums were verified.

Input preparation: shipped JPEGs decoded by Pillow; Aral resized to 768 x 768 using bilinear resampling, Pakistan kept at 325 x 325, and the independent PNG pair kept at 512 x 512. Canvas decoding/resampling may differ slightly from Pillow. This explains why these Aral counts can differ from earlier browser measurements. Every scenario was also compared with its identical baseline image and yielded zero changed pixels.

Inspection figures show baseline, later imagery and the actual computed overlay, left to right. Aral detects the visible exposed basin plus peripheral differences. Pakistan produces broad differences from both visible scene change and rendering/appearance confounds; the result is not a flood-extent classification. Lake Mead highlights shoreline and surface differences along with other appearance changes. Visual inspection is not labeled ground truth.

## Verification results

- `node --test tests/*.test.mjs`: 27 passed, 0 failed. Includes all 13 original test cases, plus findings, synthetic shift, brightness, stability, report consistency, empty/no-data cases and full assessment persistence.
- `npm.cmd run build`: TypeScript and production build passed.
- `node scripts/check-offline.mjs`: generated worker precache and offline HTML, JavaScript, metadata and both bundled image pairs passed in a deterministic service-worker harness.
- Shared engine validation: current masks and regions equal the baseline detector's outputs for all three scenarios.
- Standalone preliminary reports generated from each actual run with no analyst approvals. They embed the original imagery and actual overlays.

## Browser and demonstration status

Browser control returned **Local browser use is disabled in Work settings**. The upgraded dashboard's interactions, mobile rendering, browser report download/print and browser offline reload were therefore not retested in this upgrade. The offline harness does not establish browser service-worker registration or lifecycle behavior. Historical browser checks are recorded separately in the root VALIDATION.md and do not certify the new panels.

**Live demonstration status: implementation and numerical validation complete; a browser rehearsal is still required before calling the upgrade demonstration-ready.** Keep the local production server running for the offline presentation, load both scenes once, wait for saved status, and rehearse Analyze → automatic findings → evidence → optional review → map → report/GeoJSON export. Test with internet disconnected while leaving the local server running.

## Limitations

- Pixel-level threshold agreement is used instead of cross-run semantic region matching. The stable label requires intersection/union >= 0.80; per-region labels require at least 80% of that region's pixels to persist. These are explicit heuristics, not validated probabilities.
- Brightness warning threshold is a signed mean luminance difference magnitude of at least 20/255. Widespread-change warning begins at 50% valid-pixel coverage. Both can be triggered by real changes.
- Alignment screening samples at most about 4,096 pixels and compares integer shifts in +/-4 processing pixels with a capped brightness-adjusted luminance residual. It warns when an alternative shift lowers the residual by at least 25%, baseline residual is at least 3, and there is enough texture. Actual scene changes can trigger it; rotation, scale, subpixel shifts, perspective and local warps are not assessed. The pixel data used for detection is never corrected.
- No cloud/shadow classifier, geographic area, passability, military object classifier, ground-truth precision/recall, or operational readiness claim.
- Older saved analyses can summarize their stored masks, but have no fabricated reliability or quality audit. Analyze again to generate missing diagnostics; existing reviews require explicit replacement.
- Autosave retains its requested 800 ms pause; wait for Saved on this device before closing. Browser storage may be evicted.

## Files added or modified for this upgrade

Core additions: `src/analysis.mjs`, `src/findings.mjs`, `src/reliability.mjs`, `src/quality.mjs`, `src/AnalysisInsights.tsx`.

Modified existing modules: `src/engine.mjs` (shared score preparation and segmentation), `src/detector.worker.ts` (full analysis and progress), `src/App.tsx` (new panels and workflow), `src/types.ts` (optional backwards-compatible assessment fields), `src/report.mjs` (measured findings and unclassified banner), `src/styles.css` (integrated panel styles), `src/Viewer.tsx` and `src/GeoMap.tsx` (valid geography and display provenance), and `index.html` (demo identity).

Added tests: `tests/findings.test.mjs`, `tests/reliability.test.mjs`, `tests/quality.test.mjs`, `tests/analysis.test.mjs`, `tests/analysis-storage.test.mjs`. Updated `tests/report.test.mjs` for the requested banner. The original engine, GeoJSON and persistence tests remain.

Added validation tools: `scripts/validate-scenarios.mjs`, `scripts/check-offline.mjs`, `scripts/export-validation-reports.mjs`. Updated `README.md` and `VALIDATION.md`; recorded results, source metadata, figures and preliminary reports in `validation/`. Existing uncommitted GeoJSON/export changes from the preceding phase were preserved. No dependencies were added for this upgrade.
