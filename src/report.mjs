import { createFindings } from "./findings.mjs";
import { safeSourceURL } from "./metadata.mjs";
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
  const largest = [...result.regions].sort((a,b)=>b.area-a.area).slice(0,5);
  const link = (url,label) => safeSourceURL(url) ? `<a href="${e(safeSourceURL(url))}">${e(label)}</a>` : "";
  const findings = result.findings ?? (result.labels ? createFindings(result,scene) : null);
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
      ? `<svg viewBox="0 0 ${result.width} ${result.height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mapped observation centroids"><image href="${e(after)}" width="${result.width}" height="${result.height}"/>${largest.map((r) => `<circle cx="${r.centroid[0] + 0.5}" cy="${r.centroid[1] + 0.5}" r="4" fill="${reviews[r.id]?.status === "approved" ? "#67e6a6" : reviews[r.id]?.status === "rejected" ? "#999" : "#ffc561"}" stroke="#111"/><text x="${r.centroid[0] + 0.5 + 5}" y="${r.centroid[1] + 0.5}" fill="white" stroke="#111" stroke-width=".3" font-size="10">${r.id}</text>`).join("")}</svg><p>North-up EPSG:4326. Bounds [west, south, east, north]: ${scene.bbox.join(", ")}. Marker positions use pixel-center interpolation on the supplied geographic grid. Five largest region centroids shown. Map colors: amber unreviewed, green verified by analyst, gray rejected.</p>`
      : "<p>No geographic bounds supplied. Observations are referenced in image coordinates only.</p>";
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(title)} · TerraLens evidence report</title><style>body{font:14px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#263447;max-width:1000px;margin:36px auto;padding:0 28px}h1{font-size:32px;line-height:1.15}h2{font-size:19px;border-bottom:1px solid #cdd7d0;padding-bottom:8px;margin-top:30px}.eyebrow{letter-spacing:3px;font-size:12px;font-weight:bold;color:#526e91}.meta{color:#5b6861}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}figure{margin:0;break-inside:avoid}img{width:100%;max-height:510px;object-fit:contain;background:#18211d}figcaption{font-size:12px;margin:6px 0}table{border-collapse:collapse;width:100%;font-size:11px}th,td{text-align:left;border-bottom:1px solid #dce1dc;padding:8px;vertical-align:top;overflow-wrap:anywhere}th{background:#edf2f8}tr{break-inside:avoid}.notice{border-left:3px solid #b18d3e;background:#f7f3e7;padding:14px}.evidence{break-inside:avoid;margin-bottom:20px}svg{max-width:460px;width:100%}a{color:#2863a9;overflow-wrap:anywhere}.toolbar{position:sticky;top:0;background:white;padding:12px 0;border-bottom:1px solid #ddd;display:flex;gap:12px;align-items:center}button{background:#2863a9;color:white;border:0;padding:12px 18px;cursor:pointer}small{font-size:11px}.appendix{margin-top:30px}.appendix summary{cursor:pointer;font-weight:bold}@media print{.toolbar,.appendix{display:none}body.include-register .appendix{display:block}body{margin:0;max-width:none;padding:0;font-size:10pt}h2{break-after:avoid}h1{font-size:24pt}p{orphans:3;widows:3}a{color:inherit}img{max-height:95mm}thead{display:table-header-group}.grid{gap:10mm}@page{size:A4;margin:15mm}}@media(max-width:600px){.grid{grid-template-columns:1fr}table{font-size:9px}}</style></head><body>
 <div style="border-block:2px solid #324d70;padding:10px 0;text-align:center;font-weight:bold;font-size:11px;letter-spacing:1px">TERRALENS — GEOSPATIAL CHANGE ASSESSMENT</div><div style="text-align:center;padding:8px;font-size:11px">UNCLASSIFIED DEMONSTRATION — ANALYST ASSISTANCE PROTOTYPE</div>
 <p class="meta"><small>Supplied imagery and preliminary automated findings. Analyst interpretations are recorded separately; this is a demonstration, not an officially issued intelligence document.</small></p>
 <div class="toolbar"><button onclick="Promise.all(Array.from(document.images).map(i=>i.decode())).then(()=>window.print()).catch(()=>alert('An evidence image could not load. Regenerate this report.'))">Print / Save as PDF</button><small>Choose “Save as PDF” in your browser’s print dialog. This report is a fixed snapshot.</small><label><input type="checkbox" onchange="document.body.classList.toggle('include-register',this.checked);document.querySelector('.appendix').open=this.checked"> Print full register</label></div>
 <p class="eyebrow">TERRALENS / ANALYSIS EVIDENCE</p><h1>${e(title)}</h1><p class="meta">${e(scene.location)} · Generated ${e(generatedAt)}<br>Analysis ${e(result.runId)} · Processed ${e(result.createdAt)}</p>
 <div class="notice"><b>Analyst decision support — visual changes require interpretation.</b> Algorithmic regions are not confirmed terrain changes. Approval records an analyst’s interpretation; it is not independent ground verification. No detection accuracy or confidence score is claimed.</div>
 <p>Before: ${e(scene.files?.[0]?.file || "Unnamed image")} (${e(scene.dates?.[0] || "Unknown date")})<br>After: ${e(scene.files?.[1]?.file || "Unnamed image")} (${e(scene.dates?.[1] || "Unknown date")})<br>Source: ${e(scene.sourceOrganization || scene.attribution || "Not supplied")}${scene.metadataOrigin === "user" ? " · User-provided metadata; not independently verified." : ""}<br>Geographic reference: ${scene.bbox && pixelToGeo(0,0,result.width,result.height,scene.bbox) ? "Supplied north-up EPSG:4326 bounds" : "Unavailable; image pixels only"}.</p>
 <h2>01 / Executive summary</h2><p>${e(findings?.summary ?? "Candidate regions reflect visual differences at the recorded settings.")}</p><p>Largest region: ${largest[0]?.area ?? 0} changed processing pixels. ${e(result.reliability?.status ?? "Threshold audit unavailable")}.</p><p>${result.regions.length} candidate regions · ${approved} approved (verified by analyst) · ${rejected} rejected · ${result.regions.length - approved - rejected} unreviewed.<br>${result.changedPercent.toFixed(2)}% of valid processing pixels passed the threshold and region-area filter. This is visual difference coverage, not a measured damage percentage.<br>Processing: ${result.processingMs.toFixed(1)} ms; grid ${result.width} × ${result.height}; difference threshold ${result.threshold}/255; minimum region ${result.minArea} processing pixels.</p>

 ${result.quality?.warnings?.length ? `<p><b>Quality screening:</b> ${result.quality.warnings.map(w=>e(w.message)).join(" ")}</p>` : ""}
 <h2>02 / Source imagery</h2><p>Source dimensions: ${sourceDimensions ? `${sourceDimensions.width} × ${sourceDimensions.height}` : "Not recorded"} pixels. Processing dimensions: ${result.width} × ${result.height} pixels.</p><div class="grid"><figure><img src="${e(before)}"><figcaption>BEFORE · ${e(scene.files?.[0]?.file || "Unnamed image")} · ${e(scene.dates[0] || "Unknown date")}</figcaption></figure><figure><img src="${e(after)}"><figcaption>AFTER · ${e(scene.files?.[1]?.file || "Unnamed image")} · ${e(scene.dates[1] || "Unknown date")}</figcaption></figure></div><p>${e(scene.sensor)} · ${e(scene.color)}<br>${e(scene.attribution)}</p><p>${e(scene.description)}</p>
 <h2>03 / Detection evidence</h2><figure><img src="${e(overlay)}"><figcaption>Amber overlay: algorithmic visual difference mask on the later image.</figcaption></figure>
 <h2>04 / Significant observations</h2><p>Largest five regions by changed-pixel area. All detections remain in the appendix.</p>${largest.map(r=>{const item=evidence.find(item=>item.id===r.id), geo=pixelToGeo(r.centroid[0],r.centroid[1],result.width,result.height,scene.bbox);return `<div class="evidence"><b>OBS-${String(r.id).padStart(3,"0")} · ${r.area} changed pixels · ${e(reviews[r.id]?.status === "approved" ? "Verified by analyst" : reviews[r.id]?.status ?? "unreviewed")}</b><p>Centroid (x, y): ${r.centroid.map(n=>n.toFixed(1)).join(", ")}${geo ? `; latitude ${geo.lat.toFixed(4)}, longitude ${geo.lng.toFixed(4)}` : "; geography unavailable"}.</p>${item ? `<div class="grid"><figure><img alt="Before observation crop" src="${e(item.before)}"><figcaption>Before crop</figcaption></figure><figure><img alt="After observation crop" src="${e(item.after)}"><figcaption>After crop</figcaption></figure></div>` : ""}${reviews[r.id]?.notes ? `<p>Analyst note: ${e(reviews[r.id].notes)}</p>` : ""}</div>`;}).join("") || "<p>No regions detected at these settings.</p>"}
 ${analysisSections(result, scene)}
 <h2>06 / Analyst verification</h2><p>Optional analyst review is distinct from automatic findings. Approval is not independent ground verification.</p>${
   result.regions.some(r=>reviews[r.id] && (reviews[r.id].status !== "unreviewed" || reviews[r.id].notes || reviews[r.id].category !== "Unclassified"))
     ? `<ul>${result.regions
         .filter((r) => reviews[r.id] && (reviews[r.id].status !== "unreviewed" || reviews[r.id].notes || reviews[r.id].category !== "Unclassified"))
         .map(
           (r) =>
             `<li>OBS-${String(r.id).padStart(3, "0")} — ${e(reviews[r.id].status === "approved" ? "Verified by analyst" : reviews[r.id].status)} · ${e(reviews[r.id].category)}: ${e(reviews[r.id].notes || "No notes supplied.")}</li>`,
         )
         .join("")}</ul>`
     : "<p>No observations have been approved. Automated preliminary findings remain available above.</p>"
 }
 <h2>Geographic reference</h2>${map}
 <h2>07 / Method and limitations</h2><p>${result.smoothingRadius === 0 ? "Unsmoothed RGB absolute difference" : "RGB absolute difference after a 3 × 3 mean filter"}, threshold segmentation, four-connected regions, and minimum-area filtering. Transparent and near-black no-data pixels are excluded. No automatic classification, cloud mask, spectral index, or image registration is applied.</p><p>${e(scene.alignment)}</p><ul>${scene.caveats.map((c) => `<li>${e(c)}</li>`).join("")}<li>Clouds, shadows, lighting, sensor differences, seasonal differences, and residual misalignment can create false positives. Clouds and shadows are not detected automatically.</li><li>Processing downsampling and thresholds can omit small or subtle changes.</li><li>Geographic area and operational route safety are not inferred.</li></ul>
 <h2>08 / Sources and provenance</h2><p>${e(scene.sourceOrganization)} · ${e(scene.attribution)}${scene.metadataOrigin === "user" ? " — User-provided metadata; not independently verified." : ""}</p><ul>${scene.files.map((f, i) => `<li>${i === 0 ? "Before" : "After"}: ${e(f.file)} ${link(f.sourceUrl,"Source image URL")}</li>`).join("")}${safeSourceURL(scene.article) ? `<li>${link(scene.article,"Source context")}</li>` : ""}${safeSourceURL(scene.licenseUrl) ? `<li>${link(scene.licenseUrl,"Data use policy")}</li>` : ""}</ul><details class="appendix"><summary>Appendix / Complete observation register (${result.regions.length} regions)</summary><p>Pixel measurements refer to the processing grid; region area counts changed pixels, not bounding-box pixels.</p><table><thead><tr><th>Reference</th><th>Review</th><th>Analyst category</th><th>Pixels</th><th>Centroid x, y</th><th>Notes</th></tr></thead><tbody>${rows || '<tr><td colspan="6">No regions detected at these settings.</td></tr>'}</tbody></table>
</details><p class="meta">TERRALENS · Prototype evidence report · ${e(result.runId)}</p></body></html>`;
}

/** Uses saved analysis data; never reruns the detector while exporting a report. */
function analysisSections(result, scene) {
  const e = escapeHTML;
  const reliability = result.reliability;
  const quality = result.quality;
  const timing = result.timing;
  return `<h2>05 / Detection reliability</h2>
    <p><strong>${e(reliability?.status ?? "Insufficient information for reliability assessment")}</strong></p>
    <p>${e(reliability?.reason ?? "This saved analysis has no threshold audit. Analyze again to measure stability.")}</p>
    ${
      reliability
        ? `<p>Tested thresholds: ${reliability.thresholds.join(", ")}. Region labels: ${Object.values(reliability.regionPersistence ?? {}).filter(r=>r.label === "Stable across tested thresholds").length} stable, ${Object.values(reliability.regionPersistence ?? {}).filter(r=>r.label === "Sensitive to threshold selection").length} threshold-sensitive. Persistent intersection: ${reliability.persistentPixels} pixels; union: ${reliability.unionPixels} pixels; persistent pixels in selected result: ${reliability.primaryPersistentPixels}. Lowest-threshold-only pixels: ${reliability.lowThresholdOnlyPixels}. Changed coverage ranges from ${reliability.changedPercentMin.toFixed(2)}% to ${reliability.changedPercentMax.toFixed(2)}% (${reliability.rangePercentagePoints.toFixed(2)} percentage points).</p>
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
