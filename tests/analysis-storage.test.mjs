import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert/strict";
import { analyzeImages } from "../src/analysis.mjs";
import { saveAnalysis, loadAnalysis } from "../src/storage.ts";
test("saved automated assessment, reliability and warnings round-trip with reviews unchanged", async () => {
  const a = new Uint8ClampedArray(32 * 32 * 4);
  for (let p = 0; p < 1024; p++) a.set([70, 70, 70, 255], p * 4);
  const b = a.slice();
  for (let p = 0; p < 1024; p++) b[p * 4] += 60;
  const result = {
    ...analyzeImages(a, b, 32, 32, { threshold: 10, minArea: 5 }),
    runId: "persist-audit",
    createdAt: "now",
  };
  const reviews = {
    1: {
      status: "approved",
      category: "Other visual change",
      notes: "Prior review",
    },
  };
  const record = {
    version: 1,
    result,
    reviews,
    title: "Assessment storage",
    threshold: 10,
    minArea: 5,
    aligned: true,
    pair: {
      before: "data:",
      after: "data:",
      width: 32,
      height: 32,
      scene: { id: "fixture" },
    },
    savedAt: "now",
  };
  await saveAnalysis(record);
  const saved = await loadAnalysis();
  assert.deepEqual(saved.result, result);
  assert.deepEqual(saved.reviews, reviews);
  assert.ok(saved.result.labels instanceof Int32Array);
  assert.ok(saved.result.quality.warnings.length > 0);
});
