import test from "node:test";
import assert from "node:assert/strict";
import {
  prepareDifference,
  segmentChanges,
  detectChanges,
} from "../src/engine.mjs";
import { auditThresholds } from "../src/reliability.mjs";
function scene(value = 200) {
  const a = new Uint8ClampedArray(20 * 20 * 4);
  for (let p = 0; p < 400; p++) a.set([70, 70, 70, 255], p * 4);
  const b = a.slice();
  for (let y = 5; y < 15; y++)
    for (let x = 5; x < 15; x++)
      b.set([value, value, value, 255], (y * 20 + x) * 4);
  return { a, b };
}
test("cached segmentation preserves baseline masks and exact region output", () => {
  const { a, b } = scene();
  const options = { threshold: 35, minArea: 5 };
  const cached = segmentChanges(
      prepareDifference(a, b, 20, 20, options),
      options,
    ),
    original = detectChanges(a, b, 20, 20, options);
  assert.deepEqual(cached.labels, original.labels);
  assert.deepEqual(cached.regions, original.regions);
});
test("strong known changes persist and borderline changes are marked sensitive", () => {
  for (const [value, status] of [
    [200, "Stable across tested thresholds"],
    [108, "Sensitive to threshold selection"],
  ]) {
    const { a, b } = scene(value),
      p = prepareDifference(a, b, 20, 20, { smooth: false });
    const r = segmentChanges(p, { threshold: 35, minArea: 1 }),
      audit = auditThresholds(p, r);
    assert.equal(audit.status, status);
    assert.deepEqual(audit.thresholds, [27, 35, 43]);
    if (value === 200) {
      assert.equal(audit.persistentPixels, 100);
      assert.equal(audit.lowThresholdOnlyPixels, 0);
    } else {
      assert.equal(audit.persistentPixels, 0);
      assert.ok(audit.rangePercentagePoints > 0);
    }
  }
});
test("empty results do not receive a stability endorsement, and boundary thresholds are insufficient", () => {
  const { a } = scene(),
    p = prepareDifference(a, a, 20, 20);
  assert.match(
    auditThresholds(p, segmentChanges(p, { threshold: 35 })).status,
    /Insufficient/,
  );
  assert.match(
    auditThresholds(p, segmentChanges(p, { threshold: 0 })).status,
    /Insufficient/,
  );
});
test("areas appearing only at highest sensitivity are counted exactly", () => {
  const { a, b } = scene(100),
    p = prepareDifference(a, b, 20, 20, { smooth: false });
  const audit = auditThresholds(
    p,
    segmentChanges(p, { threshold: 35, minArea: 1 }),
  );
  assert.equal(audit.lowThresholdOnlyPixels, 100);
  assert.equal(audit.unionPixels, 100);
  assert.equal(audit.persistentPixels, 0);
});
