import { pixelToGeo } from "./engine.mjs";
import { reportHTML } from "./report.mjs";
import { cropData, loadImage, maskData } from "./images.ts";
import type { Pair, Result, Review } from "./types";
export async function createReport(
  title: string,
  pair: Pair,
  result: Result,
  reviews: Record<number, Review>,
) {
  const c = document.createElement("canvas");
  c.width = result.width;
  c.height = result.height;
  const ctx = c.getContext("2d")!;
  const afterImage = await loadImage(pair.after);
  ctx.drawImage(afterImage, 0, 0, c.width, c.height);
  ctx.globalAlpha = 0.65;
  ctx.drawImage(await loadImage(maskData(result)), 0, 0);
  ctx.globalAlpha = 1;
  // Reuse decoded originals and render sequentially, rather than decoding full images for every region.
  const beforeImage = await loadImage(pair.before);
  const evidence = [];
  for (const r of [...result.regions].sort((a,b)=>b.area-a.area).slice(0,5)) {
    evidence.push({
      id: r.id,
      before: await cropData(beforeImage, r, result),
      after: await cropData(afterImage, r, result),
    });
  }
  return reportHTML({
    title,
    scene: pair.scene,
    sourceDimensions: { width: pair.width, height: pair.height },
    result,
    reviews,
    before: pair.before,
    after: pair.after,
    overlay: c.toDataURL("image/jpeg", 0.9),
    evidence,
    generatedAt: new Date().toISOString(),
  });
}

/** WGS84 Point features. Region bounds are properties, not Point geometry bounds. */
export function createGeoJSON(
  result: Pick<Result, "regions" | "width" | "height">,
  reviews: Record<number, Review>,
  bounds: import("./types").Bounds | null,
) {
  if (!(result.width > 0 && result.height > 0))
    throw new Error("Invalid processing dimensions.");
  if (!bounds || !pixelToGeo(0, 0, result.width, result.height, bounds))
    throw new Error(
      "GeoJSON export requires valid north-up geographic bounds.",
    );
  return {
    type: "FeatureCollection" as const,
    features: result.regions.map((region) => {
      const center = pixelToGeo(
        region.centroid[0],
        region.centroid[1],
        result.width,
        result.height,
        bounds,
      )!;
      const [x0, y0, x1, y1] = region.bbox;
      // pixelToGeo adds half a pixel: subtract it to convert rectangle edges.
      const northwest = pixelToGeo(
        x0 - 0.5,
        y0 - 0.5,
        result.width,
        result.height,
        bounds,
      )!;
      const southeast = pixelToGeo(
        x1 - 0.5,
        y1 - 0.5,
        result.width,
        result.height,
        bounds,
      )!;
      const review = reviews[region.id];
      return {
        type: "Feature" as const,
        id: region.id,
        geometry: {
          type: "Point" as const,
          coordinates: [center.lng, center.lat],
        },
        properties: {
          id: region.id,
          category: review?.category ?? "Unclassified",
          reviewStatus: review?.status ?? "unreviewed",
          meanDifference: region.meanDifference,
          bbox: [northwest.lng, southeast.lat, southeast.lng, northwest.lat],
          bboxOrder: "west,south,east,north",
          notes: review?.notes ?? "",
        },
      };
    }),
  };
}
