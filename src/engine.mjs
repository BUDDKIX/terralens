/** Deterministic RGB change detector shared by the worker and validation tests. */
export function prepareDifference(before, after, width, height, options = {}) {
  const start = performance.now();
  const threshold = options.threshold ?? 35;
  const minArea = options.minArea ?? 80;
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width * height > 4_000_000
  )
    throw new Error(
      "Invalid processing dimensions (maximum 4 million pixels).",
    );
  const n = width * height;
  if (before.length !== n * 4 || after.length !== n * 4)
    throw new Error("Images must have matching dimensions.");
  if (
    !Number.isFinite(threshold) ||
    threshold < 0 ||
    threshold > 255 ||
    !Number.isFinite(minArea) ||
    minArea < 1
  )
    throw new Error("Invalid detection settings.");
  const valid = new Uint8Array(n),
    score = new Uint8Array(n);
  let validPixels = 0;
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    // Transparent pixels and black no-data backgrounds are excluded, not treated as terrain.
    valid[p] =
      before[i + 3] > 0 &&
      after[i + 3] > 0 &&
      before[i] + before[i + 1] + before[i + 2] > 6 &&
      after[i] + after[i + 1] + after[i + 2] > 6
        ? 1
        : 0;
    validPixels += valid[p];
  }
  const blur = options.smooth !== false;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const p = y * width + x;
      if (!valid[p]) continue;
      let r = 0,
        g = 0,
        b = 0,
        count = 0;
      const radius = blur ? 1 : 0;
      for (let dy = -radius; dy <= radius; dy++)
        for (let dx = -radius; dx <= radius; dx++) {
          const xx = x + dx,
            yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue;
          const q = yy * width + xx,
            j = q * 4;
          if (!valid[q]) continue;
          r += after[j] - before[j];
          g += after[j + 1] - before[j + 1];
          b += after[j + 2] - before[j + 2];
          count++;
        }
      score[p] = Math.round(
        (Math.abs(r) + Math.abs(g) + Math.abs(b)) / (3 * count),
      );
    }
  return {
    width,
    height,
    valid,
    score,
    validPixels,
    smoothingRadius: blur ? 1 : 0,
    preparationMs: performance.now() - start,
  };
}

/** Segment a cached difference score field. Uses the same region algorithm at each threshold. */
export function segmentChanges(prepared, options = {}) {
  const start = performance.now();
  const { width, height, valid, score, validPixels } = prepared;
  const threshold = options.threshold ?? 35,
    minArea = options.minArea ?? 80;
  if (
    !Number.isFinite(threshold) ||
    threshold < 0 ||
    threshold > 255 ||
    !Number.isFinite(minArea) ||
    minArea < 1
  )
    throw new Error("Invalid detection settings.");
  const n = width * height,
    binary = new Uint8Array(n);
  for (let p = 0; p < n; p++)
    binary[p] = valid[p] && score[p] > threshold ? 1 : 0;
  const labels = new Int32Array(n),
    queue = new Int32Array(n),
    visited = new Uint8Array(n);
  const regions = [];
  let changedPixels = 0;
  for (let p = 0; p < n; p++) {
    if (!binary[p] || visited[p]) continue;
    let head = 0,
      tail = 1,
      x0 = width,
      y0 = height,
      x1 = 0,
      y1 = 0,
      sx = 0,
      sy = 0,
      sum = 0;
    queue[0] = p;
    visited[p] = 1;
    while (head < tail) {
      const q = queue[head++],
        x = q % width,
        y = Math.floor(q / width);
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
      sx += x;
      sy += y;
      sum += score[q];
      for (const next of [
        x > 0 ? q - 1 : -1,
        x < width - 1 ? q + 1 : -1,
        y > 0 ? q - width : -1,
        y < height - 1 ? q + width : -1,
      ]) {
        if (next >= 0 && binary[next] && !visited[next]) {
          visited[next] = 1;
          queue[tail++] = next;
        }
      }
    }
    if (tail < minArea) continue;
    const id = regions.length + 1;
    for (let j = 0; j < tail; j++) labels[queue[j]] = id;
    changedPixels += tail;
    regions.push({
      id,
      area: tail,
      bbox: [x0, y0, x1 + 1, y1 + 1],
      centroid: [sx / tail, sy / tail],
      meanDifference: sum / tail,
    });
  }
  regions.sort((a, b) => b.area - a.area);
  return {
    width,
    height,
    threshold,
    minArea,
    smoothingRadius: prepared.smoothingRadius,
    regions,
    labels,
    validPixels,
    changedPixels,
    changedPercent: validPixels ? (changedPixels / validPixels) * 100 : 0,
    processingMs: performance.now() - start,
  };
}

export function detectChanges(before, after, width, height, options = {}) {
  const prepared = prepareDifference(before, after, width, height, options);
  const result = segmentChanges(prepared, options);
  result.processingMs += prepared.preparationMs;
  return result;
}

/** Pixel centers in a north-up EPSG:4326 raster. Bounds are [west,south,east,north]. */
export function pixelToGeo(x, y, width, height, bounds) {
  if (
    ![x, y, width, height].every(Number.isFinite) ||
    width <= 0 ||
    height <= 0 ||
    !bounds ||
    bounds.length !== 4 ||
    !bounds.every(Number.isFinite)
  )
    return null;
  const [west, south, east, north] = bounds;
  if (
    west >= east ||
    south >= north ||
    west < -180 ||
    east > 180 ||
    south < -90 ||
    north > 90
  )
    return null;
  return {
    lat: north - ((y + 0.5) / height) * (north - south),
    lng: west + ((x + 0.5) / width) * (east - west),
  };
}

export function reviewObservation(reviews, id, patch) {
  if (
    patch.status &&
    !["unreviewed", "approved", "rejected"].includes(patch.status)
  )
    throw new Error("Invalid review status");
  return {
    ...reviews,
    [id]: {
      status: "unreviewed",
      category: "Unclassified",
      notes: "",
      ...reviews[id],
      ...patch,
    },
  };
}
