import { detectChanges } from "./engine.mjs";
self.onmessage = (event) => {
  try {
    const { before, after, width, height, options, id } = event.data;
    const result = detectChanges(before, after, width, height, options);
    self.postMessage({ id, result }, { transfer: [result.labels.buffer] });
  } catch (e) {
    self.postMessage({
      id: event.data.id,
      error: e instanceof Error ? e.message : "Image processing failed.",
    });
  }
};
