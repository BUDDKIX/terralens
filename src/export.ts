import { reportHTML } from "./report.mjs";
import { cropData, loadImage, maskData } from "./images";
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
  ctx.drawImage(await loadImage(pair.after), 0, 0, c.width, c.height);
  ctx.globalAlpha = 0.65;
  ctx.drawImage(await loadImage(maskData(result)), 0, 0);
  ctx.globalAlpha = 1;
  const evidence = await Promise.all(
    result.regions
      .filter((r) => reviews[r.id] && reviews[r.id].status !== "unreviewed")
      .map(async (r) => ({
        id: r.id,
        before: await cropData(pair.before, r, result),
        after: await cropData(pair.after, r, result),
      })),
  );
  return reportHTML({
    title,
    scene: pair.scene,
    result,
    reviews,
    before: pair.before,
    after: pair.after,
    overlay: c.toDataURL("image/jpeg", 0.9),
    evidence,
    generatedAt: new Date().toISOString(),
  });
}
