import { analyzeImages } from "./analysis.mjs";
self.onmessage = (event) => {
  try {
    const { before, after, width, height, options, id, scene } = event.data;
    const result = analyzeImages(
      before,
      after,
      width,
      height,
      options,
      scene,
      (stage) => self.postMessage({ id, stage }),
    );
    self.postMessage({ id, result }, { transfer: [result.labels.buffer] });
  } catch (e) {
    self.postMessage({
      id: event.data.id,
      error: e instanceof Error ? e.message : "Image processing failed.",
    });
  }
};
