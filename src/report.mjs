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
      return `<tr><td>OBS-${String(r.id).padStart(3, "0")}</td><td>${e(v.status)}</td><td>${e(v.category)}</td><td>${r.area.toLocaleString()}</td><td>${r.centroid.map((n) => n.toFixed(1)).join(", ")}</td><td>${e(v.notes)}</td></tr>`;
    })
    .join("");
  const map = scene.bbox
    ? `<svg viewBox="0 0 600 600" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mapped observation centroids"><image href="${e(after)}" width="600" height="600" preserveAspectRatio="none"/>${result.regions.map((r) => `<circle cx="${((r.centroid[0] + 0.5) / result.width) * 600}" cy="${((r.centroid[1] + 0.5) / result.height) * 600}" r="4" fill="${reviews[r.id]?.status === "approved" ? "#67e6a6" : reviews[r.id]?.status === "rejected" ? "#999" : "#ffc561"}" stroke="#111"/><text x="${((r.centroid[0] + 0.5) / result.width) * 600 + 5}" y="${((r.centroid[1] + 0.5) / result.height) * 600}" fill="white" stroke="#111" stroke-width=".3" font-size="10">${r.id}</text>`).join("")}</svg><p>North-up EPSG:4326. Bounds [west, south, east, north]: ${scene.bbox.join(", ")}. Marker positions use pixel-center interpolation on the supplied geographic grid. Map colors: amber unreviewed, green approved, gray rejected.</p>`
    : "<p>No geographic bounds supplied. Observations are referenced in image coordinates only.</p>";
  return `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(title)} · TerraLens evidence report</title><style>body{font:14px/1.55 Arial,sans-serif;color:#1e302b;max-width:1000px;margin:36px auto;padding:0 28px}h1{font-size:32px;line-height:1.15}h2{font-size:19px;border-bottom:1px solid #cdd7d0;padding-bottom:8px;margin-top:30px}.eyebrow{letter-spacing:3px;font-size:12px;font-weight:bold;color:#59734a}.meta{color:#5b6861}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}figure{margin:0;break-inside:avoid}img{width:100%;max-height:510px;object-fit:contain;background:#18211d}figcaption{font-size:12px;margin:6px 0}table{border-collapse:collapse;width:100%;font-size:11px}th,td{text-align:left;border-bottom:1px solid #dce1dc;padding:8px;vertical-align:top;overflow-wrap:anywhere}th{background:#edf1ea}tr{break-inside:avoid}.notice{border-left:3px solid #b18d3e;background:#f7f3e7;padding:14px}.evidence{break-inside:avoid;margin-bottom:20px}svg{max-width:460px;width:100%}a{color:#345c4e;overflow-wrap:anywhere}.toolbar{position:sticky;top:0;background:white;padding:12px 0;border-bottom:1px solid #ddd;display:flex;gap:12px;align-items:center}button{background:#203b30;color:white;border:0;padding:12px 18px;cursor:pointer}small{font-size:11px}@media print{.toolbar{display:none}body{margin:0;max-width:none;padding:0;font-size:10pt}h2{break-after:avoid}a{color:inherit}img{max-height:95mm}thead{display:table-header-group}.grid{gap:10mm}@page{size:A4;margin:15mm}}@media(max-width:600px){.grid{grid-template-columns:1fr}table{font-size:9px}}</style></head><body>
 <div class="toolbar"><button onclick="window.print()">Print / Save as PDF</button><small>Choose “Save as PDF” in your browser’s print dialog. This report is a fixed snapshot.</small></div>
 <p class="eyebrow">TERRALENS / GEOSPATIAL EVIDENCE</p><h1>${e(title)}</h1><p class="meta">${e(scene.location)} · Generated ${e(generatedAt)}<br>Analysis ${e(result.runId)} · Processed ${e(result.createdAt)}</p>
 <div class="notice"><b>Analyst decision support — visual changes require interpretation.</b> Algorithmic regions are not confirmed terrain changes. Approval records an analyst’s interpretation; it is not independent ground verification. No detection accuracy or confidence score is claimed.</div>
 <h2>01 / Analysis summary</h2><p>${result.regions.length} candidate regions · ${approved} approved · ${rejected} rejected · ${result.regions.length - approved - rejected} unreviewed.<br>${result.changedPercent.toFixed(2)}% of valid processing pixels passed the threshold and region-area filter. This is visual difference coverage, not a measured damage percentage.<br>Processing: ${result.processingMs.toFixed(1)} ms; grid ${result.width} × ${result.height}; difference threshold ${result.threshold}/255; minimum region ${result.minArea} processing pixels.</p>
 <h2>02 / Source imagery</h2><div class="grid"><figure><img src="${e(before)}"><figcaption>BEFORE · ${e(scene.dates[0] || "Unknown date")}</figcaption></figure><figure><img src="${e(after)}"><figcaption>AFTER · ${e(scene.dates[1] || "Unknown date")}</figcaption></figure></div><p>${e(scene.sensor)} · ${e(scene.color)}<br>${e(scene.attribution)}</p><p>${e(scene.description)}</p>
 <h2>03 / Detection evidence</h2><figure><img src="${e(overlay)}"><figcaption>Amber overlay: algorithmic visual difference mask on the later image.</figcaption></figure>
 <h2>04 / Observation register</h2><p>Pixel measurements refer to the processing grid; region area counts changed pixels, not bounding-box pixels.</p><table><thead><tr><th>Reference</th><th>Review</th><th>Analyst category</th><th>Pixels</th><th>Centroid x, y</th><th>Notes</th></tr></thead><tbody>${rows || '<tr><td colspan="6">No regions detected at these settings.</td></tr>'}</tbody></table>
 <h2>05 / Reviewed evidence</h2>${evidence.length ? evidence.map((item) => `<div class="evidence"><b>OBS-${String(item.id).padStart(3, "0")} · ${e(reviews[item.id]?.status)} · ${e(reviews[item.id]?.category)}</b><div class="grid"><figure><img src="${e(item.before)}"><figcaption>Before crop</figcaption></figure><figure><img src="${e(item.after)}"><figcaption>After crop</figcaption></figure></div><p>${e(reviews[item.id]?.notes || "No analyst notes supplied.")}</p></div>`).join("") : "<p>No findings have been reviewed.</p>"}
 <h2>06 / Geographic reference</h2>${map}
 <h2>07 / Method and limitations</h2><p>RGB absolute difference after a 3 × 3 mean filter, threshold segmentation, four-connected regions, and minimum-area filtering. Transparent and near-black no-data pixels are excluded. No automatic classification, cloud mask, spectral index, or image registration is applied.</p><p>${e(scene.alignment)}</p><ul>${scene.caveats.map((c) => `<li>${e(c)}</li>`).join("")}<li>Shadows, lighting, seasonal differences, and residual misalignment can create false positives.</li><li>Processing downsampling and thresholds can omit small or subtle changes.</li><li>Geographic area and operational route safety are not inferred.</li></ul>
 <h2>08 / Sources and provenance</h2><p>${e(scene.attribution)}</p><ul>${scene.files.map((f, i) => `<li>${i === 0 ? "Before" : "After"}: ${e(f.file)} ${f.sourceUrl ? `— <a href="${e(f.sourceUrl)}">NASA GIBS source request</a>` : ""}</li>`).join("")}${scene.article ? `<li><a href="${e(scene.article)}">Event context from NASA</a></li>` : ""}${scene.licenseUrl ? `<li><a href="${e(scene.licenseUrl)}">Data use policy</a></li>` : ""}</ul><p class="meta">TERRALENS · Prototype evidence report · ${e(result.runId)}</p></body></html>`;
}
