# TerraLens

A browser-based geospatial image change-analysis application that uses deterministic computer-vision methods to identify visual differences between imagery from different dates. It produces preliminary findings, supports analyst verification, and generates evidence reports.

Developed for the defense technology hackathon's **Geospatial Intelligence & Reconnaissance Analysis** problem statement. Analysis runs locally; no account, API key or server-side processing is required.

## Key capabilities

- PNG, JPEG and WebP image-pair uploads and two bundled satellite scenarios.
- Comparison slider, synchronized side-by-side viewing, zoom/pan and actual pixel-mask overlays.
- Region measurements, preliminary summaries, threshold stability and image-quality warnings.
- Optional analyst verification, rejection, categories and notes, saved in IndexedDB.
- Embedded HTML evidence reports with browser printing and a complete observation appendix.
- Geographic display and GeoJSON export when valid north-up geographic bounds are supplied.

## Technology stack

React 19, TypeScript, Vite, Canvas, Web Workers, Leaflet, IndexedDB and a service worker. Tests use Node's built-in test runner and fake-indexeddb. Dependencies are pinned by `package-lock.json`.

## How it works

The browser checks compatible image dimensions and reduces the processing grid to at most 768 pixels on its longer edge. The Web Worker excludes transparent/near-black no-data pixels, averages signed RGB differences over a 3 × 3 neighborhood, takes their absolute channel magnitudes, and thresholds the resulting scores. Four-connected component labeling groups changed pixels; a minimum-area filter removes small regions.

The engine measures changed-pixel counts, bounding boxes and centroids. Nearby thresholds reuse the calculated scores to assess pixel-mask stability. Separate quality screening checks brightness, valid overlap and possible small translations. Summaries describe the measured results; analyst interpretations are stored separately. With valid geographic bounds, pixel centers are interpolated into longitude/latitude.

## Getting started

Use **Node.js 24** (tested) and npm. Node 24 supports the TypeScript imports used by the test suite.

```sh
npm ci
npm run dev
```

Open the localhost URL printed by Vite. Select a demo or upload two aligned images of the same area, inspect alignment, and analyze. Select an observation to inspect its crops and optionally record a review. Generate an HTML report or export GeoJSON when georeferencing is available.

Uploads must have identical dimensions, be at least 32 × 32 pixels, and stay within 15 MB and 20 megapixels per image. Acquisition dates, source attribution and optional geographic bounds are user-provided metadata.

## Running tests

```sh
npm run test
```

Tests cover numerical detection, known synthetic changes, stability, quality warnings, geographic conversion, upload boundaries, storage, crop coordinates and report data. Browser IO is mocked in relevant unit tests. See [validation records](VALIDATION.md) for actual results and verification limits.

## Building for production

```sh
npm run build
node scripts/check-offline.mjs
npm run preview
```

The build runs TypeScript validation, creates `dist/` and generates the service-worker asset list. The separate offline harness checks cached resources with network access disabled. Preview serves the build on localhost. Use HTTP localhost or HTTPS; opening `index.html` as a local file does not support the application workflow.

## Offline operation

Load the production application once and wait for **Cache installed**. Keep the localhost preview server running for the demonstration; it can run without internet after installation. The development server does not install the production service worker. The geographic view overlays supplied imagery and markers without a remote basemap.

Offline asset tests pass in a deterministic harness. Browser lifecycle, cache eviction and offline reload require checking on the target browser. Wait for **Saved on this device** before closing; browser storage can be denied or evicted.

## Known limitations

- Visual differences require interpretation. The application does not automatically establish terrain changes, damage, military objects or operational intelligence.
- Lighting, clouds, shadows, seasonal differences, sensor rendering and misregistration can produce false positives. No automatic registration, atmospheric correction, cloud/shadow classification or semantic classifier is implemented.
- Threshold stability is a heuristic about processing sensitivity, not confidence or real-world detection accuracy.
- Areas are changed processing-pixel counts; geographic area and route safety are not calculated. Downsampling can omit small changes.
- Geographic handling assumes a north-up EPSG:4326 raster with supplied west/south/east/north bounds. No arbitrary reprojection or GeoTIFF metadata extraction is implemented.
- Source images and ten crops loaded in the latest browser report preview. Actual PDF saving/pagination remains unverified because the in-app print action timed out. Verify print output in the presentation browser.

## Imagery sources and attribution

Bundled imagery is provided by **NASA Global Imagery Browse Services (GIBS), part of ESDIS**:

| Scenario | Sensor / rendered product | Acquisition dates |
| --- | --- | --- |
| South Aral Sea | Terra / MODIS, true color | 2000-08-25 and 2014-08-19 |
| Indus floodplain, Pakistan | NOAA-20 / VIIRS, false color M11-I2-I1 | 2022-08-04 and 2022-08-28 |

Exact source requests, bounds, checksums, attribution and image preparation are recorded in [the imagery manifest](public/imagery/manifest.json). The Pakistan demo is an integer crop of the source raster. Rendered image dimensions do not establish sensor resolution. Source event descriptions are contextual information, not classifications generated by TerraLens.

An additional Lake Mead validation pair is documented in [the holdout manifest](validation/holdout-manifest.json). Image use remains subject to the [NASA Earthdata data-use policy](https://www.earthdata.nasa.gov/engage/open-data-services-software/data-use-policy). Uploaded imagery must be public or authorized; supplied provenance is not independently verified.

## Development and submission

Development used OpenAI Codex assistance. Preserve any additional AI-tool disclosure required by the hackathon. This repository makes no claim of certified military readiness or validated detection accuracy.

See [submission notes](SUBMISSION.md) for repository preparation, publishing commands and deferred maintainability work. An application-code license has not yet been selected; imagery attribution does not license the application code.
