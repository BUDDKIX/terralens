import { pixelToGeo } from "./engine.mjs";

const cellNames = [
  "upper-left",
  "upper-center",
  "upper-right",
  "middle-left",
  "center",
  "middle-right",
  "lower-left",
  "lower-center",
  "lower-right",
];

/** Describe measured visual changes, without inferring what caused them. */
export function createFindings(result, scene = {}) {
  const { width, height, regions, labels, validPixels, changedPixels } = result;
  const geographic = !!pixelToGeo(0, 0, width, height, scene.bbox);
  const distribution = cellNames.map((position) => ({ position, pixels: 0 }));
  for (let p = 0; p < labels.length; p++) {
    if (!labels[p]) continue;
    const column = Math.min(2, Math.floor(((p % width) * 3) / width));
    const row = Math.min(2, Math.floor((Math.floor(p / width) * 3) / height));
    distribution[row * 3 + column].pixels++;
  }
  const largest = [...regions]
    .sort((a, b) => b.area - a.area)
    .slice(0, 5)
    .map((region) => ({
      id: region.id,
      area: region.area,
      centroid: [...region.centroid],
      bbox: [...region.bbox],
      location: geographic
        ? pixelToGeo(
            region.centroid[0],
            region.centroid[1],
            width,
            height,
            scene.bbox,
          )
        : null,
    }));
  const areas = regions.map((r) => r.area).sort((a, b) => a - b);
  const middle = Math.floor(areas.length / 2);
  const medianArea = areas.length
    ? areas.length % 2
      ? areas[middle]
      : (areas[middle - 1] + areas[middle]) / 2
    : 0;
  const dominant = distribution.reduce((a, b) =>
    a.pixels >= b.pixels ? a : b,
  );
  const occupiedCells = distribution.filter((cell) => cell.pixels > 0).length;
  const concentration =
    changedPixels && dominant.pixels / changedPixels >= 0.4
      ? `${((dominant.pixels / changedPixels) * 100).toFixed(1)}% of detected change pixels lie in the ${dominant.position} third of the ${geographic ? "north-up scene" : "image"}.`
      : `Detected change pixels are distributed across ${occupiedCells} of 9 image-grid sectors.`;
  let summary;
  if (!validPixels)
    summary =
      "No valid overlapping pixels were available for comparison. No terrain-change conclusion can be drawn.";
  else if (!regions.length)
    summary = `No regions passed threshold ${result.threshold}/255 and minimum area ${result.minArea} processing pixels. This does not establish that the scene is unchanged.`;
  else
    summary = `Analysis identified ${regions.length} visual-change ${regions.length === 1 ? "region" : "regions"}, covering ${result.changedPercent.toFixed(2)}% of valid processing pixels. ${concentration} The largest region contains ${largest[0].area.toLocaleString("en-US")} changed pixels. These are preliminary visual findings requiring evidence inspection.`;
  const limitations = [
    "RGB differences describe appearance, not cause or operational significance. No automatic object or terrain classification is applied.",
    "Lighting, shadows, seasonal variation, clouds and residual misalignment may affect results; clouds and shadows are not automatically detected.",
    "Region sizes refer to the processing grid, not geographic area. Small or low-contrast changes may be missed.",
    ...(geographic
      ? [
          "Coordinates use supplied north-up geographic bounds; geolocation is not independently verified.",
        ]
      : [
          "No valid geographic bounds are supplied; locations are reported in image pixels only.",
        ]),
    ...(scene.caveats ?? []),
  ];
  return {
    version: 1,
    summary,
    totalRegions: regions.length,
    changedPixels,
    validPixels,
    changedPercent: result.changedPercent,
    grid: { width, height },
    sizes: {
      smallest: areas[0] ?? 0,
      median: medianArea,
      largest: areas.at(-1) ?? 0,
    },
    distribution,
    occupiedCells,
    largest,
    geographic,
    parameters: {
      threshold: result.threshold,
      minArea: result.minArea,
      smoothing: result.smoothingRadius === 0 ? "None" : "3 × 3 mean filter",
      connectivity: 4,
    },
    detectorMs: result.processingMs,
    limitations,
  };
}
