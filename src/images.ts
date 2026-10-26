import type { Pair, Region, Result } from "./types";
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () =>
      reject(
        new Error("The image could not be decoded. Use PNG, JPEG or WebP."),
      );
    i.src = src;
  });
}
export async function fileData(file: File): Promise<string> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    throw new Error("Please select a PNG, JPEG or WebP image.");
  if (file.size > 15 * 1024 * 1024)
    throw new Error("Each upload must be smaller than 15 MB.");
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("Unable to read image."));
    r.onabort = () => reject(new Error("Image read was interrupted."));
    r.readAsDataURL(file);
  });
}
export async function localData(url: string) {
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(
      "Demo imagery unavailable. Connect once to download offline assets.",
    );
  const blob = await response.blob();
  return fileData(new File([blob], "scene.jpg", { type: blob.type }));
}
export async function validatePair(before: string, after: string) {
  const [a, b] = await Promise.all([loadImage(before), loadImage(after)]);
  if (a.naturalWidth !== b.naturalWidth || a.naturalHeight !== b.naturalHeight)
    throw new Error(
      `Dimensions differ (${a.naturalWidth} × ${a.naturalHeight} and ${b.naturalWidth} × ${b.naturalHeight}). Align and export both images on the same grid first.`,
    );
  if (a.naturalWidth * a.naturalHeight > 20_000_000)
    throw new Error(
      "Images exceed 20 megapixels. Export a smaller aligned pair first.",
    );
  if (a.naturalWidth < 32 || a.naturalHeight < 32)
    throw new Error("Images must be at least 32 × 32 pixels.");
  return { width: a.naturalWidth, height: a.naturalHeight };
}
export async function processingPixels(pair: Pair) {
  const scale = Math.min(1, 768 / Math.max(pair.width, pair.height)),
    width = Math.max(1, Math.round(pair.width * scale)),
    height = Math.max(1, Math.round(pair.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const a = await loadImage(pair.before);
  ctx.drawImage(a, 0, 0, width, height);
  const before = ctx.getImageData(0, 0, width, height).data;
  const b = await loadImage(pair.after);
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(b, 0, 0, width, height);
  const after = ctx.getImageData(0, 0, width, height).data;
  return { before, after, width, height };
}
export function maskData(result: Result) {
  const c = document.createElement("canvas");
  c.width = result.width;
  c.height = result.height;
  const ctx = c.getContext("2d")!;
  const data = ctx.createImageData(c.width, c.height);
  for (let p = 0; p < result.labels.length; p++)
    if (result.labels[p]) data.data.set([245, 176, 65, 175], p * 4);
  ctx.putImageData(data, 0, 0);
  return c.toDataURL();
}
export async function cropData(
  src: string | HTMLImageElement,
  r: Region,
  result: Result,
) {
  const image = typeof src === "string" ? await loadImage(src) : src,
    [x0, y0, x1, y1] = r.bbox;
  const margin = 12;
  const left = Math.max(0, x0 - margin),
    top = Math.max(0, y0 - margin),
    w = Math.min(result.width, x1 + margin) - left,
    h = Math.min(result.height, y1 + margin) - top;
  const c = document.createElement("canvas");
  // Keep the same processing-grid footprint, but retain available source detail.
  const sourceWidth = image.naturalWidth || image.width,
    sourceHeight = image.naturalHeight || image.height,
    cropWidth = (w / result.width) * sourceWidth,
    cropHeight = (h / result.height) * sourceHeight;
  const s = Math.min(1, 680 / Math.max(cropWidth, cropHeight));
  c.width = Math.max(1, Math.round(cropWidth * s));
  c.height = Math.max(1, Math.round(cropHeight * s));
  c.getContext("2d")!.drawImage(
    image,
    (left / result.width) * sourceWidth,
    (top / result.height) * sourceHeight,
    cropWidth,
    cropHeight,
    0,
    0,
    c.width,
    c.height,
  );
  return c.toDataURL("image/jpeg", 0.88);
}
