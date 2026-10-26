import test from "node:test";
import assert from "node:assert/strict";
import { detectChanges } from "../src/engine.mjs";
import { createFindings } from "../src/findings.mjs";

function pair() {
  const before = new Uint8ClampedArray(12 * 12 * 4).fill(80);
  for (let p = 0; p < 144; p++) before[p * 4 + 3] = 255;
  const after = before.slice();
  for (let y = 0; y < 3; y++)
    for (let x = 8; x < 11; x++)
      after.set([200, 200, 200, 255], (y * 12 + x) * 4);
  return { before, after };
}
test("automatic findings derive summary, region sizes, distribution and coordinates from the mask", () => {
  const { before, after } = pair();
  const r = detectChanges(before, after, 12, 12, {
    threshold: 35,
    minArea: 1,
    smooth: false,
  });
  const f = createFindings(r, { bbox: [10, 20, 22, 32] });
  assert.equal(f.totalRegions, 1);
  assert.equal(f.changedPixels, 9);
  assert.equal(f.changedPercent, 6.25);
  assert.equal(f.distribution[2].pixels, 9);
  assert.match(f.summary, /upper-right/);
  assert.deepEqual(f.sizes, { smallest: 9, median: 9, largest: 9 });
  assert.deepEqual(f.largest[0].location, { lng: 19.5, lat: 30.5 });
  assert.equal(f.parameters.threshold, r.threshold);
  assert.equal(f.detectorMs, r.processingMs);
});
test("identical and no-data pairs generate explicit empty findings without fabricated geography", () => {
  const { before } = pair();
  const f = createFindings(detectChanges(before, before, 12, 12));
  assert.equal(f.totalRegions, 0);
  assert.equal(f.geographic, false);
  assert.equal(f.largest.length, 0);
  assert.match(f.summary, /No regions passed/);
  assert.ok(!f.summary.includes("NaN"));
  const none = new Uint8ClampedArray(before.length);
  assert.match(
    createFindings(detectChanges(none, none, 12, 12)).summary,
    /No valid overlapping pixels/,
  );
});
