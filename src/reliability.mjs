import { segmentChanges } from "./engine.mjs";

/** Compare final pixel masks, not region IDs (components split and merge between thresholds). */
export function compareMasks(primary, runs) {
  const thresholds = [...new Set(runs.map((r) => r.threshold))].sort(
    (a, b) => a - b,
  );
  const compatible =
    runs.length >= 3 &&
    thresholds.length >= 3 &&
    runs.every(
      (r) =>
        r.width === primary.width &&
        r.height === primary.height &&
        r.labels.length === primary.labels.length &&
        r.minArea === primary.minArea &&
        r.validPixels === primary.validPixels,
    ) &&
    runs.some((r) => r.threshold < primary.threshold) &&
    runs.some((r) => r.threshold > primary.threshold);
  if (!compatible || !primary.validPixels)
    return {
      version: 1,
      status: "Insufficient information for reliability assessment",
      reason:
        "Three compatible runs bracketing the selected threshold and valid overlapping pixels are required.",
      thresholds,
      runs: [],
      persistentPixels: 0,
      unionPixels: 0,
      primaryPersistentPixels: 0,
      lowThresholdOnlyPixels: 0,
      changedPercentMin: 0,
      changedPercentMax: 0,
      rangePercentagePoints: 0,
      regionPersistence: {},
      method:
        "Pixel-mask intersection across tested thresholds after identical minimum-area filtering. Stability does not establish accuracy.",
    };
  let persistentPixels = 0,
    unionPixels = 0,
    primaryPersistentPixels = 0,
    lowThresholdOnlyPixels = 0;
  const regionCounts = {};
  const low = runs.reduce((a, b) => (a.threshold < b.threshold ? a : b));
  for (let p = 0; p < primary.labels.length; p++) {
    const hits = runs.reduce((sum, r) => sum + (r.labels[p] > 0 ? 1 : 0), 0);
    if (hits) unionPixels++;
    if (hits === runs.length) {
      persistentPixels++;
      if (primary.labels[p]) {
        primaryPersistentPixels++;
        regionCounts[primary.labels[p]] =
          (regionCounts[primary.labels[p]] ?? 0) + 1;
      }
    }
    if (low.labels[p] && hits === 1) lowThresholdOnlyPixels++;
  }
  const values = runs.map((r) => r.changedPercent),
    min = Math.min(...values),
    max = Math.max(...values);
  // Explicit heuristic for a descriptive label, not a calibrated confidence estimate.
  const stable = unionPixels > 0 && persistentPixels / unionPixels >= 0.8;
  const empty = unionPixels === 0;
  const regionPersistence = Object.fromEntries(
    primary.regions.map((r) => [
      r.id,
      {
        persistentPixels: regionCounts[r.id] ?? 0,
        totalPixels: r.area,
        label:
          (regionCounts[r.id] ?? 0) / r.area >= 0.8
            ? "Stable across tested thresholds"
            : "Sensitive to threshold selection",
      },
    ]),
  );
  return {
    version: 1,
    status: empty
      ? "Insufficient information for reliability assessment"
      : stable
        ? "Stable across tested thresholds"
        : "Sensitive to threshold selection",
    reason: empty
      ? "All tested thresholds produced empty masks. Empty agreement does not establish detection reliability."
      : `${persistentPixels.toLocaleString("en-US")} pixels persist across all tested thresholds; ${lowThresholdOnlyPixels.toLocaleString("en-US")} appear only at the lowest threshold (highest tested sensitivity).`,
    thresholds,
    runs: [...runs]
      .sort((a, b) => a.threshold - b.threshold)
      .map((r) => ({
        threshold: r.threshold,
        regions: r.regions.length,
        changedPixels: r.changedPixels,
        changedPercent: r.changedPercent,
      })),
    persistentPixels,
    unionPixels,
    primaryPersistentPixels,
    lowThresholdOnlyPixels,
    changedPercentMin: min,
    changedPercentMax: max,
    rangePercentagePoints: max - min,
    regionPersistence,
    method:
      "Pixel-mask intersection across three thresholds, after identical minimum-area filtering. The stable label requires intersection/union ≥ 0.80 (heuristic). Per-region labels require ≥ 80% of that region's pixels to persist. Neither ratio is confidence or accuracy. Region identity is not matched across runs.",
  };
}

export function auditThresholds(prepared, primary) {
  const start = performance.now();
  const thresholds = [
    Math.max(0, primary.threshold - 8),
    primary.threshold,
    Math.min(255, primary.threshold + 8),
  ];
  const runs = [...new Set(thresholds)].map((threshold) =>
    threshold === primary.threshold
      ? primary
      : segmentChanges(prepared, { threshold, minArea: primary.minArea }),
  );
  return {
    ...compareMasks(primary, runs),
    step: 8,
    auditMs: performance.now() - start,
  };
}
