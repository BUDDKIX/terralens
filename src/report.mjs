import { createFindings } from "./findings.mjs";
import { pixelToGeo } from "./engine.mjs";

export const escapeHTML = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function reportHTML({
  title,
  scene,
  result,
  reviews,
  before,
  after,
  overlay,
  evidence,
  generatedAt,
  sourceDimensions,
}) {
  const e = escapeHTML,
    approved = result.regions.filter(
      (r) => reviews[r.id]?.status === "approved",
    ).length,
    rejected = result.regions.filter(
      (r) => reviews[r.id]?.status === "rejected",
    ).length;
  const rows = result.regions
    .map((r) => {
      const v = reviews[r.id] ?? {
        status: "unreviewed",
        category: "Unclassified",
        notes: "",
      };
      return `<tr><td>OBS-${String(r.id).padStart(3, "0")}</td><td>${e(v.status === "approved" ? "Verified by analyst" : v.status)}</td><td>${e(v.category)}</td><td>${r.area.toLocaleString()}</td><td>${r.centroid.map((n) => n.toFixed(1)).join(", ")}</td><td>${e(v.notes)}</td></tr>`;
    })
    .join("");
  const map =
    scene.bbox && pixelToGeo(0, 0, result.width, result.height, scene.bbox)
      ? `<svg viewBox="0 0 ${result.width} ${result.height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mapped observation centroids"><image href="${e(after)}" width="${result.width}" height="${result.height}"/>${result.regions.map((r) => `<circle cx="${r.centroid[0] + 0.5}" cy="${r.centroid[1] + 0.5}" r="4" fill="${reviews[r.id]?.status === "approved" ? "#67e6a6" : reviews[r.id]?.status === "rejected" ? "#999" : "#ffc561"}" stroke="#111"/><text x="${r.centroid[0] + 0.5 + 5}" y="${r.centroid[1] + 0.5}" fill="white" stroke="#111" stroke-width=".3" font-size="10">${r.id}</text>`).join("")}</svg><p>North-up EPSG:4326. Bounds [west, south, east, north]: ${scene.bbox.join(", ")}. Marker positions use pixel-center interpolation on the supplied geographic grid. Map colors: amber unreviewed, green approved, gray rejected.</p>`
      : "<p>No geographic bounds supplied. Observations are referenced in image coordinates only.</p>";
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(title)} · TerraLens evidence report</title><style>body{font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#263447;max-width:1000px;margin:36px auto;padding:0 28px}h1{font-size:32px;line-height:1.15}h2{font-size:19px;border-bottom:1px solid #cdd7d0;padding-bottom:8px;margin-top:30px}.eyebrow{letter-spacing:3px;font-size:12px;font-weight:bold;color:#526e91}.meta{color:#5b6861}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}figure{margin:0;break-inside:avoid}img{width:100%;max-height:510px;object-fit:contain;background:#18211d}figcaption{font-size:12px;margin:6px 0}table{border-collapse:collapse;width:100%;font-size:11px}th,td{text-align:left;border-bottom:1px solid #dce1dc;padding:8px;vertical-align:top;overflow-wrap:anywhere}th{background:#edf2f8}tr{break-inside:avoid}.notice{border-left:3px solid #b18d3e;background:#f7f3e7;padding:14px}.evidence{break-inside:avoid;margin-bottom:20px}svg{max-width:460px;width:100%}a{color:#2863a9;overflow-wrap:anywhere}.toolbar{position:sticky;top:0;background:white;padding:12px 0;border-bottom:1px solid #ddd;display:flex;gap:12px;align-items:center}button{background:#2863a9;color:white;border:0;padding:12px 18px;cursor:pointer}small{font-size:11px}@media print{.toolbar{display:none}body{margin:0;max-width:none;padding:0;font-size:10pt}h2{break-after:avoid}h1{font-size:24pt}p{orphans:3;widows:3}a{color:inherit}img{max-height:95mm}thead{display:table-header-group}.grid{gap:10mm}@page{size:A4;margin:15mm}}@media(max-width:600px){.grid{grid-template-columns:1fr}table{font-size:9px}}</style></head><body>
 <div style="border-block:2px solid #324d70;padding:10px 0;text-align:center;font-weight:bold;font-size:11px;letter-spacing:1px">TERRALENS — GEOSPATIAL CHANGE ASSESSMENT</div><div style="text-align:center;padding:8px;font-size:11px">UNCLASSIFIED DEMONSTRATION — ANALYST ASSISTANCE PROTOTYPE</div>
 <p class="meta"><small>Supplied imagery and preliminary automated findings. Analyst interpretations are recorded separately; this is a demonstration, not an officially issued intelligence document.</small></p>
 <div class="toolbar"><button onclick="window.print()">Print / Save as PDF</button><small>Choose “Save as PDF” in your browser’s print dialog. This report is a fixed snapshot.</small></div>
 <p class="eyebrow">TERRALENS / ANALYSIS EVIDENCE</p><h1>${e(title)}</h1><p class="meta">${e(scene.location)} · Generated ${e(generatedAt)}<br>Analysis ${e(result.runId)} · Processed ${e(result.createdAt)}</p>
 <div class="notice"><b>Analyst decision support — visual changes require interpretation.</b> Algorithmic regions are not confirmed terrain changes. Approval records an analyst’s interpretation; it is not independent ground verification. No detection accuracy or confidence score is claimed.</div>
 <h2>01 / Analysis summary</h2><p>${result.regions.length} candidate regions · ${approved} approved · ${rejected} rejected · ${result.regions.length - approved - rejected} unreviewed.<br>${result.changedPercent.toFixed(2)}% of valid processing pixels passed the threshold and region-area filter. This is visual difference coverage, not a measured damage percentage.<br>Processing: ${result.processingMs.toFixed(1)} ms; grid ${result.width} × ${result.height}; difference threshold ${result.threshold}/255; minimum region ${result.minArea} processing pixels.</p>
 ${analysisSections(result, scene)}
 <h2>02 / Source imagery</h2><p>Source dimensions: ${sourceDimensions ? `${sourceDimensions.width} × ${sourceDimensions.height}` : "Not recorded"} pixels. Processing dimensions: ${result.width} × ${result.height} pixels.</p><div class="grid"><figure><img src="${e(before)}"><figcaption>BEFORE · ${e(scene.files?.[0]?.file || "Unnamed image")} · ${e(scene.dates[0] || "Unknown date")}</figcaption></figure><figure><img src="${e(after)}"><figcaption>AFTER · ${e(scene.files?.[1]?.file || "Unnamed image")} · ${e(scene.dates[1] || "Unknown date")}</figcaption></figure></div><p>${e(scene.sensor)} · ${e(scene.color)}<br>${e(scene.attribution)}</p><p>${e(scene.description)}</p>
 <h2>03 / Detection evidence</h2><figure><img src="${e(overlay)}"><figcaption>Amber overlay: algorithmic visual difference mask on the later image.</figcaption></figure>
 <h2>04 / Observation register</h2><p>Pixel measurements refer to the processing grid; region area counts changed pixels, not bounding-box pixels.</p><table><thead><tr><th>Reference</th><th>Review</th><th>Analyst category</th><th>Pixels</th><th>Centroid x, y</th><th>Notes</th></tr></thead><tbody>${rows || '<tr><td colspan="6">No regions detected at these settings.</td></tr>'}</tbody></table>
 <h2>Analyst-approved interpretations</h2><p>Optional analyst review is distinct from automatic findings. Approval is not independent ground verification.</p>${
   approved
     ? `<ul>${result.regions
         .filter((r) => reviews[r.id]?.status === "approved")
         .map(
           (r) =>
             `<li>OBS-${String(r.id).padStart(3, "0")} — ${e(reviews[r.id].category)}: ${e(reviews[r.id].notes || "No notes supplied.")}</li>`,
         )
         .join("")}</ul>`
     : "<p>No observations have been approved. Automated preliminary findings remain available above.</p>"
 }
 <h2>05 / Significant and analyst-reviewed evidence</h2>${evidence.length ? evidence.map((item) => `<div class="evidence"><b>OBS-${String(item.id).padStart(3, "0")} · ${e(reviews[item.id]?.status === "approved" ? "Verified by analyst" : (reviews[item.id]?.status ?? "unreviewed"))} · ${e(reviews[item.id]?.category ?? "Unclassified observation")}</b><div class="grid"><figure><img src="${e(item.before)}"><figcaption>Before crop</figcaption></figure><figure><img src="${e(item.after)}"><figcaption>After crop</figcaption></figure></div><p>${e(reviews[item.id]?.notes || "No analyst notes supplied.")}</p></div>`).join("") : "<p>No findings have been reviewed.</p>"}
 <h2>06 / Geographic reference</h2>${map}
 <h2>07 / Method and limitations</h2><p>RGB absolute difference after a 3 × 3 mean filter, threshold segmentation, four-connected regions, and minimum-area filtering. Transparent and near-black no-data pixels are excluded. No automatic classification, cloud mask, spectral index, or image registration is applied.</p><p>${e(scene.alignment)}</p><ul>${scene.caveats.map((c) => `<li>${e(c)}</li>`).join("")}<li>Shadows, lighting, seasonal differences, and residual misalignment can create false positives.</li><li>Processing downsampling and thresholds can omit small or subtle changes.</li><li>Geographic area and operational route safety are not inferred.</li></ul>
 <h2>08 / Sources and provenance</h2><p>${e(scene.attribution)}</p><ul>${scene.files.map((f, i) => `<li>${i === 0 ? "Before" : "After"}: ${e(f.file)} ${f.sourceUrl ? `— <a href="${e(f.sourceUrl)}">NASA GIBS source request</a>` : ""}</li>`).join("")}${scene.article ? `<li><a href="${e(scene.article)}">Event context from NASA</a></li>` : ""}${scene.licenseUrl ? `<li><a href="${e(scene.licenseUrl)}">Data use policy</a></li>` : ""}</ul><p class="meta">TERRALENS · Prototype evidence report · ${e(result.runId)}</p></body></html>`;
}

/** Uses saved analysis data; never reruns the detector while exporting a report. */
function analysisSections(result, scene) {
  const e = escapeHTML;
  const findings =
    result.findings ?? (result.labels ? createFindings(result, scene) : null);
  const reliability = result.reliability;
  const quality = result.quality;
  const timing = result.timing;
  return `<h2>Automated preliminary findings</h2>
    <p>${e(findings?.summary ?? "This saved analysis predates automated findings. Analyze again to generate a preliminary assessment.")}</p>
    ${
      findings
        ? `<p>Processing-pixel region sizes: minimum ${findings.sizes.smallest}, median ${findings.sizes.median}, maximum ${findings.sizes.largest}. Occupied sectors: ${findings.occupiedCells}/9.</p>
    <table><thead><tr><th>Largest region</th><th>Changed pixels</th><th>Centroid (processing x, y)</th><th>Location (lat, lon)</th></tr></thead><tbody>${findings.largest.map((r) => `<tr><td>OBS-${String(r.id).padStart(3, "0")}</td><td>${r.area}</td><td>${r.centroid.map((n) => n.toFixed(1)).join(", ")}</td><td>${r.location ? `${r.location.lat.toFixed(4)}, ${r.location.lng.toFixed(4)}` : "Unavailable"}</td></tr>`).join("") || '<tr><td colspan="4">No detected regions.</td></tr>'}</tbody></table>
    <p>Spatial distribution (changed pixels by image-grid sector): ${findings.distribution.map((d) => `${e(d.position)}: ${d.pixels}`).join("; ")}.</p>
    <ul>${findings.limitations.map((l) => `<li>${e(l)}</li>`).join("")}</ul>`
        : ""
    }
    <h2>Detection reliability</h2>
    <p><strong>${e(reliability?.status ?? "Insufficient information for reliability assessment")}</strong></p>
    <p>${e(reliability?.reason ?? "This saved analysis has no threshold audit. Analyze again to measure stability.")}</p>
    ${
      reliability
        ? `<p>Tested thresholds: ${reliability.thresholds.join(", ")}. Persistent intersection: ${reliability.persistentPixels} pixels; union: ${reliability.unionPixels} pixels; persistent pixels in selected result: ${reliability.primaryPersistentPixels}. Lowest-threshold-only pixels: ${reliability.lowThresholdOnlyPixels}. Changed coverage ranges from ${reliability.changedPercentMin.toFixed(2)}% to ${reliability.changedPercentMax.toFixed(2)}% (${reliability.rangePercentagePoints.toFixed(2)} percentage points).</p>
    <table><thead><tr><th>RGB threshold</th><th>Regions</th><th>Changed pixels</th><th>Valid-pixel coverage</th></tr></thead><tbody>${reliability.runs.map((r) => `<tr><td>${r.threshold}</td><td>${r.regions}</td><td>${r.changedPixels}</td><td>${r.changedPercent.toFixed(2)}%</td></tr>`).join("")}</tbody></table><p>${e(reliability.method)}</p>`
        : ""
    }
    <h2>Image quality and comparison warnings</h2>
    ${
      quality
        ? `<p>Mean luminance: before ${quality.brightness.meanBefore.toFixed(2)}, after ${quality.brightness.meanAfter.toFixed(2)}, signed difference ${quality.brightness.delta.toFixed(2)} (0–255). Valid overlap: ${(quality.validFraction * 100).toFixed(2)}%.</p>
    <p>Alignment screen: ${e(quality.alignment.status)}. Search ±${quality.alignment.searchRadius} processing pixels; ${quality.alignment.samples} samples. Best tested shift (${quality.alignment.shiftX}, ${quality.alignment.shiftY}); baseline residual ${quality.alignment.baselineResidual.toFixed(2)}, best residual ${quality.alignment.bestResidual.toFixed(2)}. Absence of a shift cue does not establish alignment.</p>
    <ul>${quality.warnings.length ? quality.warnings.map((w) => `<li>${e(w.message)}</li>`).join("") : "<li>No screening warning thresholds were triggered. This is not a quality guarantee.</li>"}</ul><ul>${quality.limitations.map((l) => `<li>${e(l)}</li>`).join("")}</ul>`
        : "<p>No quality screening is stored for this older analysis. Analyze again to assess it.</p>"
    }
    ${timing ? `<p>Measured worker timings: detector ${timing.detectorMs.toFixed(1)} ms; threshold audit ${timing.auditMs.toFixed(1)} ms; quality screen ${(timing.qualityMs ?? 0).toFixed(1)} ms; total analysis ${timing.totalMs.toFixed(1)} ms. Image decoding, report rendering and UI delivery are excluded.</p>` : ""}`;
}
