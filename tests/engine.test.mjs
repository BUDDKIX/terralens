import test from "node:test";
import assert from "node:assert/strict";
import {
  detectChanges,
  pixelToGeo,
  reviewObservation,
} from "../src/engine.mjs";
const W = 40,
  H = 30;
function base() {
  const a = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < a.length; i += 4) a.set([60, 70, 80, 255], i);
  return a;
}
function rect(a, x, y, w, h, value) {
  for (let yy = y; yy < y + h; yy++)
    for (let xx = x; xx < x + w; xx++)
      a.set([value, value, value, 255], (yy * W + xx) * 4);
}
test("identical images have no detections", () => {
  const a = base();
  const r = detectChanges(a, a, W, H);
  assert.equal(r.regions.length, 0);
  assert.equal(r.changedPixels, 0);
});
test("known rectangle and disconnected region are located exactly", () => {
  const a = base(),
    b = base();
  rect(b, 5, 6, 8, 7, 200);
  rect(b, 30, 20, 3, 3, 200);
  const r = detectChanges(a, b, W, H, {
    threshold: 30,
    minArea: 1,
    smooth: false,
  });
  assert.equal(r.regions.length, 2);
  assert.deepEqual(r.regions[0].bbox, [5, 6, 13, 13]);
  assert.equal(r.changedPixels, 65);
});
test("minimum area filters small noise", () => {
  const a = base(),
    b = base();
  rect(b, 1, 1, 2, 2, 200);
  rect(b, 10, 10, 5, 5, 200);
  const r = detectChanges(a, b, W, H, {
    threshold: 30,
    minArea: 10,
    smooth: false,
  });
  assert.equal(r.regions.length, 1);
  assert.equal(r.changedPixels, 25);
});
test("raising threshold removes lower magnitude differences", () => {
  const a = base(),
    b = base();
  rect(b, 10, 10, 5, 5, 110);
  assert.equal(
    detectChanges(a, b, W, H, { threshold: 20, minArea: 1, smooth: false })
      .changedPixels,
    25,
  );
  assert.equal(
    detectChanges(a, b, W, H, { threshold: 60, minArea: 1, smooth: false })
      .changedPixels,
    0,
  );
});
test("row boundary does not join disconnected regions", () => {
  const a = base(),
    b = base();
  rect(b, 39, 2, 1, 1, 200);
  rect(b, 0, 3, 1, 1, 200);
  assert.equal(
    detectChanges(a, b, W, H, { threshold: 30, minArea: 1, smooth: false })
      .regions.length,
    2,
  );
});
test("transparent and no-data pixels are excluded", () => {
  const a = base(),
    b = base();
  rect(b, 0, 0, 4, 4, 0);
  const r = detectChanges(a, b, W, H, { minArea: 1 });
  assert.equal(r.changedPixels, 0);
  assert.equal(r.validPixels, W * H - 16);
});
test("invalid sizes and settings reject", () => {
  assert.throws(() => detectChanges(base(), new Uint8Array(2), W, H));
  assert.throws(() => detectChanges(base(), base(), W, H, { threshold: NaN }));
});
test("geographic conversion uses pixel centers and rejects absent bounds", () => {
  assert.deepEqual(pixelToGeo(0, 0, 2, 2, [10, 20, 14, 24]), {
    lat: 23,
    lng: 11,
  });
  assert.equal(pixelToGeo(0, 0, 2, 2, null), null);
});
test("reviews are immutable and preserve notes across status changes", () => {
  const original = {};
  const next = reviewObservation(original, 1, {
    notes: "Possible sediment",
    status: "approved",
  });
  const rejected = reviewObservation(next, 1, { status: "rejected" });
  assert.deepEqual(original, {});
  assert.equal(rejected[1].notes, "Possible sediment");
  assert.equal(next[1].status, "approved");
  assert.throws(() =>
    reviewObservation(next, 1, { status: "confirmed attack" }),
  );
});
