import test from "node:test";
import assert from "node:assert/strict";
import { analyzeImages } from "../src/analysis.mjs";
import { reportHTML } from "../src/report.mjs";
const scene = {
  location: "Test scene",
  bbox: [10, 20, 30, 40],
  dates: ["2020-01-01", "2020-01-02"],
  sensor: "Synthetic",
  color: "RGB",
  attribution: "Test fixture",
  description: "Known synthetic change",
  alignment: "Same grid",
  caveats: [],
  files: [],
};
function analysis(changed = true) {
  const a = new Uint8ClampedArray(24 * 24 * 4);
  for (let p = 0; p < 576; p++) a.set([60, 70, 80, 255], p * 4);
  const b = a.slice();
  if (changed)
    for (let y = 4; y < 12; y++)
      for (let x = 4; x < 12; x++)
        b.set([200, 200, 200, 255], (y * 24 + x) * 4);
  return {
    ...analyzeImages(a, b, 24, 24, { threshold: 35, minArea: 1 }, scene),
    runId: "fixture-run",
    createdAt: "2026-10-25",
  };
}
test("full analysis produces measured findings, audit and quality independently of analyst approval", () => {
  const r = analysis();
  assert.ok(r.regions.length > 0);
  assert.equal(r.findings.changedPixels, r.changedPixels);
  assert.equal(r.reliability.runs.length, 3);
  assert.ok(r.quality);
  assert.ok(r.timing.totalMs >= r.processingMs);
  assert.ok(r.timing.auditMs >= 0);
});
test("report preserves automatic findings and reliability measurements without reviewed observations", () => {
  const r = analysis(),
    html = reportHTML({
      title: "Preliminary",
      scene,
      result: r,
      reviews: {},
      before: "data:",
      after: "data:",
      overlay: "data:",
      evidence: [],
      generatedAt: "2026-10-25",
    });
  assert.ok(html.includes(r.findings.summary));
  assert.ok(html.includes(r.reliability.status));
  assert.ok(html.includes(`${r.reliability.persistentPixels} pixels`));
  assert.ok(html.includes(r.changedPercent.toFixed(2) + "%"));
  assert.ok(html.includes("No observations have been approved"));
  assert.ok(html.includes("UNCLASSIFIED DEMONSTRATION"));
  assert.ok(!html.includes("RESTRICTED //"));
  assert.ok(html.includes("Image quality and comparison warnings"));
});
test("identical images and empty results export a useful, honest preliminary report", () => {
  const r = analysis(false),
    html = reportHTML({
      title: "Identical",
      scene,
      result: r,
      reviews: {},
      before: "data:",
      after: "data:",
      overlay: "data:",
      evidence: [],
      generatedAt: "now",
    });
  assert.equal(r.changedPixels, 0);
  assert.equal(r.regions.length, 0);
  assert.match(r.reliability.status, /Insufficient/);
  assert.ok(html.includes("No regions passed"));
  assert.ok(!html.includes("NaN"));
  assert.ok(!html.includes("undefined"));
});
