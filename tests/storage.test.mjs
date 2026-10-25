import "fake-indexeddb/auto";
import test from "node:test";
import assert from "node:assert/strict";
import { saveAnalysis, loadAnalysis } from "../src/storage.ts";
test("IndexedDB preserves typed masks, analyst decisions and image assets", async () => {
  const value = {
    version: 1,
    pair: {
      before: "data:image/png;base64,AA",
      after: "data:image/png;base64,BB",
      width: 2,
      height: 2,
      scene: { id: "test" },
    },
    result: {
      labels: new Int32Array([0, 1, 1, 0]),
      regions: [{ id: 1, area: 2 }],
      runId: "run-test",
    },
    reviews: {
      1: {
        status: "approved",
        category: "Terrain / surface change",
        notes: "Verified in test",
      },
    },
    threshold: 35,
    minArea: 1,
    title: "Persistence fixture",
    aligned: true,
    savedAt: "2026-10-25",
  };
  await saveAnalysis(value);
  const loaded = await loadAnalysis();
  assert.deepEqual(loaded, value);
  assert.ok(loaded.result.labels instanceof Int32Array);
  await saveAnalysis({
    ...value,
    reviews: { 1: { ...value.reviews[1], status: "rejected" } },
  });
  assert.equal((await loadAnalysis()).reviews[1].status, "rejected");
});
