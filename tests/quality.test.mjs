import test from "node:test";
import assert from "node:assert/strict";
import { prepareDifference, segmentChanges } from "../src/engine.mjs";
import { assessQuality } from "../src/quality.mjs";
const W = 48,
  H = 48;
function texture() {
  const a = new Uint8ClampedArray(W * H * 4);
  let seed = 12;
  for (let p = 0; p < W * H; p++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const v = 40 + (seed % 130);
    a.set([v, v, v, 255], p * 4);
  }
  return a;
}
function quality(a, b, scene = {}) {
  const p = prepareDifference(a, b, W, H);
  return assessQuality(
    a,
    b,
    p,
    segmentChanges(p, { threshold: 35, minArea: 1 }),
    scene,
  );
}
test("brightness and image-wide change warnings are measured, not classifications", () => {
  const a = texture(),
    b = a.slice();
  for (let p = 0; p < W * H; p++)
    for (let c = 0; c < 3; c++) b[p * 4 + c] += 45;
  const q = quality(a, b, { bbox: [10, 20, 30, 40] });
  assert.ok(Math.abs(q.brightness.delta - 45) < 0.001);
  assert.ok(q.warnings.some((w) => w.code === "brightness-difference"));
  assert.ok(q.warnings.some((w) => w.code === "widespread-change"));
  assert.ok(!q.warnings.some((w) => w.code === "possible-misalignment"));
});
test("known translated textured image is flagged without image correction", () => {
  const a = texture(),
    b = a.slice();
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W - 2; x++)
      b.set(
        a.subarray((y * W + x) * 4, (y * W + x) * 4 + 4),
        (y * W + x + 2) * 4,
      );
  const original = b.slice(),
    q = quality(a, b);
  assert.equal(q.alignment.shiftX, 2);
  assert.equal(q.alignment.shiftY, 0);
  assert.ok(q.warnings.some((w) => w.code === "possible-misalignment"));
  assert.deepEqual(b, original);
});
test("missing and invalid geography, low texture and no valid pixels are explicit", () => {
  const a = new Uint8ClampedArray(W * H * 4).fill(80);
  for (let p = 0; p < W * H; p++) a[p * 4 + 3] = 255;
  assert.match(quality(a, a).alignment.status, /Insufficient/);
  assert.ok(quality(a, a).warnings.some((w) => w.code === "missing-geography"));
  assert.ok(
    quality(a, a, { bbox: [30, 20, 10, 40] }).warnings.some(
      (w) => w.code === "invalid-geography",
    ),
  );
  const empty = new Uint8ClampedArray(a.length);
  assert.ok(
    quality(empty, empty).warnings.some((w) => w.code === "no-valid-pixels"),
  );
  assert.throws(() => quality(a, new Uint8Array(4)), /matching dimensions/);
});
test("identical textured imagery has no false shift or brightness warning", () => {
  const a = texture(),
    q = quality(a, a, { bbox: [10, 20, 30, 40] });
  assert.equal(q.warnings.length, 0);
  assert.equal(q.brightness.delta, 0);
  assert.equal(q.alignment.status, "No small-shift cue detected");
});
