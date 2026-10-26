import test from "node:test";
import assert from "node:assert/strict";
import "fake-indexeddb/auto";
import { fileData, validatePair } from "../src/images.ts";
import { saveAnalysis, loadAnalysis, clearAnalysis } from "../src/storage.ts";
import { pixelToGeo } from "../src/engine.mjs";
import { reportHTML } from "../src/report.mjs";

// Boundary tests isolate browser IO; real image decoding is checked separately in the browser.
class TestReader {
  readAsDataURL(file) {
    this.result = `data:${file.type};base64,TEST`;
    queueMicrotask(() => this.onload());
  }
}
class TestImage {
  set src(src) {
    const [w, h] = src.split("x").map(Number);
    this.naturalWidth = w;
    this.naturalHeight = h;
    queueMicrotask(() => (w && h ? this.onload() : this.onerror()));
  }
}
globalThis.FileReader = TestReader;
globalThis.Image = TestImage;
test("upload boundary accepts PNG, JPEG and WebP; rejects unsupported and oversized files", async () => {
  for (const type of ["image/png", "image/jpeg", "image/webp"])
    assert.match(
      await fileData(new File(["x"], "test", { type })),
      /^data:image/,
    );
  await assert.rejects(
    fileData(new File(["x"], "test.gif", { type: "image/gif" })),
    /PNG, JPEG or WebP/,
  );
  await assert.rejects(
    fileData({ type: "image/png", size: 15 * 1024 * 1024 + 1 }),
    /15 MB/,
  );
});
test("pair compatibility rejects mismatches, decoding errors, tiny and oversized images", async () => {
  assert.deepEqual(await validatePair("320x160", "320x160"), {
    width: 320,
    height: 160,
  });
  await assert.rejects(validatePair("320x160", "160x320"), /Dimensions differ/);
  await assert.rejects(validatePair("bad", "bad"), /decoded/);
  await assert.rejects(validatePair("31x32", "31x32"), /32/);
  await assert.rejects(validatePair("5000x5000", "5000x5000"), /20 megapixels/);
});
test("repeated session resets remove the saved analysis and allow new independent runs", async () => {
  await saveAnalysis({
    version: 1,
    pair: { id: "first" },
    reviews: { 1: { status: "approved" } },
  });
  await clearAnalysis();
  assert.equal(await loadAnalysis(), null);
  await clearAnalysis();
  assert.equal(await loadAnalysis(), null);
  await saveAnalysis({ version: 1, pair: { id: "second" }, reviews: {} });
  assert.deepEqual((await loadAnalysis()).reviews, {});
});
test("geographic conversion rejects invalid coordinates and raster sizes", () => {
  for (const args of [
    [NaN, 0, 10, 10],
    [0, 0, 0, 10],
    [0, 0, 10, Infinity],
  ])
    assert.equal(pixelToGeo(...args, [0, 0, 1, 1]), null);
});
test("non-square report preserves image geometry, source names and demonstration labeling", () => {
  const html = reportHTML({
    title: "Custom",
    scene: {
      files: [{ file: "before.webp" }, { file: "after.png" }],
      dates: [],
      bbox: [0, 0, 2, 1],
      caveats: [],
    },
    result: {
      width: 320,
      height: 160,
      regions: [],
      changedPercent: 0,
      processingMs: 2,
      threshold: 35,
      minArea: 100,
    },
    reviews: {},
    before: "data:",
    after: "data:",
    overlay: "data:",
    evidence: [],
    generatedAt: "release-test",
    sourceDimensions: { width: 640, height: 320 },
  });
  assert.match(html, /viewBox="0 0 320 160"/);
  assert.match(html, /Source dimensions: 640 × 320/);
  assert.match(html, /before.webp/);
  assert.match(html, /after.png/);
  assert.match(html, /GEOSPATIAL CHANGE ASSESSMENT/);
  assert.match(html, /ANALYST ASSISTANCE PROTOTYPE/);
  assert.ok(!html.includes('preserveAspectRatio="none"'));
});
