import test from "node:test";
import assert from "node:assert/strict";
import { reportHTML } from "../src/report.mjs";
test("report uses real review values and escapes user content", () => {
  const html = reportHTML({
    title: "<script>alert(1)</script>",
    scene: {
      location: "Test",
      dates: ["a", "b"],
      sensor: "Test sensor",
      color: "RGB",
      attribution: "Test",
      description: "Synthetic test",
      alignment: "Aligned",
      caveats: [],
      files: [],
      bbox: null,
    },
    result: {
      regions: [{ id: 7, area: 24, centroid: [2, 3] }],
      changedPercent: 2,
      processingMs: 8,
      width: 40,
      height: 30,
      threshold: 35,
      minArea: 10,
      runId: "test-run",
      createdAt: "now",
    },
    reviews: {
      7: {
        status: "approved",
        category: "Terrain",
        notes: "<img src=x onerror=alert(1)>",
      },
    },
    before: "data:",
    after: "data:",
    overlay: "data:",
    evidence: [],
    generatedAt: "now",
  });
  assert.ok(html.includes("TERRALENS — GEOSPATIAL CHANGE ASSESSMENT"));
  assert.ok(html.includes("1 approved"));
  assert.ok(html.includes("OBS-007"));
  assert.ok(html.includes("test-run"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("No geographic bounds"));
});
