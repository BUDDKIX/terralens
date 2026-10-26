// Usage: node scripts/validate-scenarios.mjs <jobs.json> <output-directory>
// Jobs contain decoded RGBA files, dimensions, scene metadata, and detection settings.
// Browser decoding can differ slightly; this runs the exact same analysis engine/worker path.
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { analyzeImages } from "../src/analysis.mjs";
import { detectChanges } from "../src/engine.mjs";

const [jobsPath, output] = process.argv.slice(2);
if (!jobsPath || !output)
  throw new Error("Supply jobs.json and an output directory.");
fs.mkdirSync(output, { recursive: true });
const jobs = JSON.parse(fs.readFileSync(jobsPath, "utf8"));
const records = [];
for (const job of jobs) {
  const before = new Uint8ClampedArray(fs.readFileSync(job.beforeRGBA));
  const after = new Uint8ClampedArray(fs.readFileSync(job.afterRGBA));
  const baseline = detectChanges(
    before,
    after,
    job.width,
    job.height,
    job.options,
  );
  const runs = [];
  let result;
  for (let i = 0; i < 3; i++) {
    result = analyzeImages(
      before,
      after,
      job.width,
      job.height,
      job.options,
      job.scene,
    );
    assert.deepEqual(
      result.labels,
      baseline.labels,
      `${job.scene.id}: baseline mask must remain unchanged`,
    );
    assert.deepEqual(result.regions, baseline.regions);
    runs.push(result.timing);
  }
  const identical = analyzeImages(
    before,
    before,
    job.width,
    job.height,
    job.options,
    job.scene,
  );
  assert.equal(identical.changedPixels, 0);
  const overlay = after.slice();
  for (let p = 0; p < result.labels.length; p++)
    if (result.labels[p]) {
      overlay[p * 4] = Math.round(overlay[p * 4] * 0.35 + 245 * 0.65);
      overlay[p * 4 + 1] = Math.round(overlay[p * 4 + 1] * 0.35 + 176 * 0.65);
      overlay[p * 4 + 2] = Math.round(overlay[p * 4 + 2] * 0.35 + 65 * 0.65);
    }
  fs.writeFileSync(path.join(output, job.scene.id + "-overlay.rgba"), overlay);
  const record = {
    scene: job.scene,
    preparation: job.preparation,
    options: job.options,
    runs,
    result: { ...result, labels: undefined },
    identicalImageChangedPixels: identical.changedPixels,
    baselinePreserved: true,
  };
  records.push(record);
  console.log(
    JSON.stringify({
      scene: job.scene.id,
      regions: result.regions.length,
      changedPercent: result.changedPercent,
      reliability: result.reliability.status,
      thresholds: result.reliability.runs,
      persistentPixels: result.reliability.persistentPixels,
      qualityWarnings: result.quality.warnings.map((w) => w.code),
      alignment: result.quality.alignment.status,
      timings: runs,
    }),
  );
}
fs.writeFileSync(
  path.join(output, "measured-results.json"),
  JSON.stringify(records, null, 2),
);
