import { pixelToGeo } from "./engine.mjs";

/** Screening cues, not a validated registration or atmospheric model. No imagery is corrected. */
export function assessQuality(before, after, prepared, result, scene = {}) {
  const start = performance.now(),
    { width, height, valid, validPixels } = prepared,
    n = width * height;
  if (before.length !== after.length || before.length !== n * 4)
    throw new Error("Quality assessment requires matching dimensions.");
  const a = new Float32Array(n),
    b = new Float32Array(n);
  let sumA = 0,
    sumB = 0;
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    a[p] = 0.2126 * before[i] + 0.7152 * before[i + 1] + 0.0722 * before[i + 2];
    b[p] = 0.2126 * after[i] + 0.7152 * after[i + 1] + 0.0722 * after[i + 2];
    if (valid[p]) {
      sumA += a[p];
      sumB += b[p];
    }
  }
  const meanBefore = validPixels ? sumA / validPixels : 0,
    meanAfter = validPixels ? sumB / validPixels : 0,
    brightnessDelta = meanAfter - meanBefore;
  const warnings = [];
  if (!validPixels)
    warnings.push({
      code: "no-valid-pixels",
      message:
        "No valid overlapping pixels. Detection and reliability results cannot support a scene assessment.",
    });
  else if (validPixels / n < 0.8)
    warnings.push({
      code: "limited-overlap",
      message: `Only ${((validPixels / n) * 100).toFixed(1)}% of the processing grid contains valid pixels in both images. Transparent and near-black pixels are excluded.`,
    });
  if (validPixels && Math.abs(brightnessDelta) >= 20)
    warnings.push({
      code: "brightness-difference",
      message: `Mean luminance differs by ${brightnessDelta.toFixed(1)} on a 0–255 scale (before ${meanBefore.toFixed(1)}, after ${meanAfter.toFixed(1)}). Broad appearance or real surface changes can influence RGB differences. No brightness correction was applied.`,
    });
  if (result.changedPercent >= 50)
    warnings.push({
      code: "widespread-change",
      message: `${result.changedPercent.toFixed(2)}% of valid processing pixels are marked changed. Broad real changes, lighting, rendering differences or misalignment may dominate; inspect the source images before interpretation.`,
    });
  const geographic = !!pixelToGeo(0, 0, width, height, scene.bbox);
  if (!geographic)
    warnings.push({
      code: scene.bbox ? "invalid-geography" : "missing-geography",
      message: scene.bbox
        ? "Supplied geographic bounds are invalid. Image-space findings remain available; map coordinates are unavailable."
        : "Geographic bounds are missing. Findings use image coordinates; geographic location and area are unavailable.",
    });

  // At most ~4,096 spatial samples × 81 shifts in [-4,+4]. Compare capped,
  // globally brightness-adjusted luminance residuals. This is a cue only:
  // real scene changes can also favor a shift; rotation/subpixel shifts are not tested.
  const radius = 4,
    stride = Math.max(1, Math.ceil(Math.sqrt(n / 4096))),
    samples = [];
  let texture = 0;
  for (let y = radius; y < height - radius; y += stride)
    for (let x = radius; x < width - radius; x += stride) {
      const p = y * width + x;
      if (
        !valid[p] ||
        !valid[p - 1] ||
        !valid[p + 1] ||
        !valid[p - width] ||
        !valid[p + width]
      )
        continue;
      samples.push(p);
      texture +=
        Math.abs(a[p + 1] - a[p - 1]) + Math.abs(a[p + width] - a[p - width]);
    }
  const meanTexture = samples.length ? texture / samples.length : 0;
  let alignment = {
    status: "Insufficient information for alignment screening",
    shiftX: 0,
    shiftY: 0,
    baselineResidual: 0,
    bestResidual: 0,
    relativeReduction: 0,
    samples: samples.length,
    meanTexture,
    searchRadius: radius,
  };
  if (samples.length >= 64 && meanTexture >= 3) {
    function residual(dx, dy) {
      let sum = 0,
        count = 0;
      for (const p of samples) {
        const q = p + dy * width + dx;
        if (!valid[q]) continue;
        sum += Math.min(40, Math.abs(b[q] - a[p] - brightnessDelta));
        count++;
      }
      return count >= samples.length * 0.8 ? sum / count : Infinity;
    }
    const baseline = residual(0, 0);
    let best = baseline,
      dxBest = 0,
      dyBest = 0;
    for (let dy = -radius; dy <= radius; dy++)
      for (let dx = -radius; dx <= radius; dx++) {
        const score = residual(dx, dy);
        if (score < best - 1e-6) {
          best = score;
          dxBest = dx;
          dyBest = dy;
        }
      }
    const reduction = baseline > 0 ? (baseline - best) / baseline : 0;
    const possible =
      (dxBest !== 0 || dyBest !== 0) && baseline >= 3 && reduction >= 0.25;
    alignment = {
      ...alignment,
      status: possible
        ? "Possible alignment problem"
        : "No small-shift cue detected",
      shiftX: dxBest,
      shiftY: dyBest,
      baselineResidual: baseline,
      bestResidual: best,
      relativeReduction: reduction,
    };
    if (possible)
      warnings.push({
        code: "possible-misalignment",
        message: `Comparing the later image at a shift of (${dxBest}, ${dyBest}) processing pixels lowers sampled luminance residual from ${baseline.toFixed(2)} to ${best.toFixed(2)}. This may indicate misalignment or actual scene changes. Inspect stable landmarks; no alignment correction was applied.`,
      });
  }
  return {
    version: 1,
    dimensions: { width, height },
    validFraction: n ? validPixels / n : 0,
    brightness: {
      meanBefore,
      meanAfter,
      delta: brightnessDelta,
      warningThreshold: 20,
    },
    alignment,
    geographic,
    warnings,
    limitations: [
      "Quality screening is heuristic and not a validated image-quality or registration score.",
      "The shift screen tests only integer translations within ±4 processing pixels; rotation, scale, subpixel displacement, perspective, and local distortions remain unchecked.",
      "No automatic cloud, shadow or atmospheric detection. No radiometric normalization or geometric correction is applied.",
    ],
    qualityMs: performance.now() - start,
  };
}
