import { prepareDifference, segmentChanges } from "./engine.mjs";
import { createFindings } from "./findings.mjs";
import { auditThresholds } from "./reliability.mjs";
import { assessQuality } from "./quality.mjs";

/** Shared worker/validation path; preserve the selected run's mask and region IDs. */
export function analyzeImages(
  before,
  after,
  width,
  height,
  options = {},
  scene = {},
  onStage = (_stage = "") => {},
) {
  const start = performance.now();
  onStage("Preparing shared difference scores");
  const prepared = prepareDifference(before, after, width, height, options);
  const result = segmentChanges(prepared, options);
  result.processingMs += prepared.preparationMs;
  onStage("Auditing nearby detection thresholds");
  const reliability = auditThresholds(prepared, result);
  onStage("Screening comparison quality");
  const quality = assessQuality(before, after, prepared, result, scene);
  const findings = createFindings(result, scene);
  findings.summary += ` ${reliability.status}.`;
  return {
    ...result,
    findings,
    reliability,
    quality,
    timing: {
      detectorMs: result.processingMs,
      auditMs: reliability.auditMs,
      qualityMs: quality.qualityMs,
      totalMs: performance.now() - start,
    },
  };
}
