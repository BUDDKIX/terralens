import { useMemo } from "react";
import { Activity, AlertTriangle, FileText, ScanLine } from "lucide-react";
import { createFindings } from "./findings.mjs";
import type { Pair, Result } from "./types";

export default function AnalysisInsights({
  pair,
  result,
  stale,
  onSelect,
}: {
  pair: Pair;
  result: Result;
  stale: boolean;
  onSelect: (id: number) => void;
}) {
  // Older saved analyses can summarize their stored mask. Never invent an audit.
  const findings = useMemo(
    () => result.findings ?? createFindings(result, pair.scene),
    [result, pair],
  );
  const audit = result.reliability,
    quality = result.quality;
  return (
    <section
      className="analysis-insights"
      aria-label="Automated analysis findings"
    >
      <div className="panel findings-panel">
        <div className="panel-heading">
          <div>
            <FileText size={17} />
            <h2>Preliminary assessment</h2>
          </div>
        </div>
        <div className="findings-body">
          <details className="assessment-text">
            <summary>Read automated assessment</summary>
            <p className="preliminary-summary">{findings.summary}</p>
          </details>
          {stale && (
            <p className="inline-warning">
              These findings use the completed run's threshold{" "}
              {result.threshold} and minimum area {result.minArea} px. Analyze
              again to apply the current controls.
            </p>
          )}
          <div className="findings-metrics">
            <span>
              <strong>{findings.totalRegions}</strong> regions
            </span>
            <span>
              <strong>{findings.changedPercent.toFixed(2)}%</strong> valid-pixel
              coverage
            </span>
            <span>
              <strong>{findings.sizes.largest.toLocaleString()}</strong> largest
              region px
            </span>
            <span>
              <strong>
                {(result.timing?.totalMs ?? result.processingMs).toFixed(0)} ms
              </strong>{" "}
              processing time
            </span>
          </div>
          <details className="insight-method">
            <summary>Largest regions & spatial distribution</summary>
            <div className="findings-evidence-grid">
              <div>
                <h3>Largest measured regions</h3>
                {findings.largest.length ? (
                  <ol className="largest-regions">
                    {findings.largest.map((region) => (
                      <li key={region.id}>
                        <button onClick={() => onSelect(region.id)}>
                          <ScanLine size={13} />
                          <strong>
                            OBS-{String(region.id).padStart(3, "0")}
                          </strong>
                          <span>{region.area.toLocaleString()} px</span>
                          <small>
                            {region.location
                              ? `${region.location.lat.toFixed(4)}, ${region.location.lng.toFixed(4)} (lat, lon)`
                              : `${region.centroid.map((n) => n.toFixed(1)).join(", ")} (image x, y)`}
                          </small>
                        </button>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="insight-detail">
                    No detected region passed these settings.
                  </p>
                )}
              </div>
              <div>
                <h3>Changed-pixel distribution</h3>
                <div
                  className="distribution-grid"
                  role="img"
                  aria-label="Changed pixels by image-grid sector"
                >
                  {findings.distribution.map((cell) => (
                    <div
                      key={cell.position}
                      style={{
                        background: `rgba(185,211,147,${0.03 + (findings.changedPixels ? (cell.pixels / findings.changedPixels) * 0.35 : 0)})`,
                      }}
                    >
                      <span>{cell.position}</span>
                      <strong>{cell.pixels.toLocaleString()}</strong>
                    </div>
                  ))}
                </div>
                <p className="insight-detail">
                  Image-grid thirds; counts are processing pixels, not
                  geographic area.
                </p>
              </div>
            </div>
          </details>
          <details className="insight-method">
            <summary>Parameters, timing & interpretation limits</summary>
            <p>
              Grid {result.width} × {result.height} · RGB threshold{" "}
              {result.threshold}/255 · minimum region {result.minArea} px · 3 ×
              3 smoothing · 4-connected components.
            </p>
            <p>
              Detector {result.processingMs.toFixed(1)} ms
              {result.timing &&
                ` · audit ${result.timing.auditMs.toFixed(1)} ms · quality ${(result.timing.qualityMs ?? 0).toFixed(1)} ms · total ${result.timing.totalMs.toFixed(1)} ms`}
              . Timings exclude image decoding and UI delivery.
            </p>
            <ul>
              {findings.limitations.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </details>
        </div>
      </div>
      <details className="diagnostics">
        <summary>
          Detection reliability & comparison warnings{" "}
          {quality?.warnings.length
            ? `· ${quality.warnings.length} warnings`
            : ""}{" "}
          · {audit?.status ?? "Not assessed"}
        </summary>
        <div className="insights-secondary">
          <section className="panel reliability-panel">
            <div className="panel-heading">
              <div>
                <Activity size={16} />
                <h2>Detection Reliability</h2>
              </div>
            </div>
            <div className="insight-body">
              <strong className="insight-status">
                {audit?.status ??
                  "Insufficient information for reliability assessment"}
              </strong>
              <p className="insight-detail">
                {audit?.reason ??
                  "This saved analysis has no threshold audit. Analyze again to measure stability."}
              </p>
              {audit && (
                <>
                  <table className="audit-table">
                    <thead>
                      <tr>
                        <th>Threshold</th>
                        <th>Regions</th>
                        <th>Changed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {audit.runs.map((run) => (
                        <tr
                          key={run.threshold}
                          className={
                            run.threshold === result.threshold
                              ? "selected-run"
                              : ""
                          }
                        >
                          <td>
                            {run.threshold}
                            {run.threshold === result.threshold
                              ? " · selected"
                              : ""}
                          </td>
                          <td>{run.regions}</td>
                          <td>{run.changedPercent.toFixed(2)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="insight-detail">
                    Coverage range: {audit.changedPercentMin.toFixed(2)}–
                    {audit.changedPercentMax.toFixed(2)}% (
                    {audit.rangePercentagePoints.toFixed(2)} percentage points).{" "}
                    {audit.primaryPersistentPixels.toLocaleString()} selected
                    pixels persist in all runs.
                  </p>
                  <details className="insight-method">
                    <summary>How stability is measured</summary>
                    <p>{audit.method}</p>
                    <p>
                      Pixels seen only at the lowest threshold:{" "}
                      {audit.lowThresholdOnlyPixels.toLocaleString()}. Nearby
                      thresholds are selected ±{audit.step} from the chosen
                      threshold, bounded to 0–255.
                    </p>
                  </details>
                </>
              )}
              <p className="insight-caution">
                Threshold persistence is not detection accuracy or confidence.
              </p>
            </div>
          </section>
          <section className="panel quality-panel">
            <div className="panel-heading">
              <div>
                <AlertTriangle size={16} />
                <h2>Comparison quality warnings</h2>
              </div>
            </div>
            <div className="insight-body">
              {quality ? (
                <>
                  <ul className="quality-warnings">
                    {quality.warnings.length ? (
                      quality.warnings.map((warning) => (
                        <li key={warning.code}>{warning.message}</li>
                      ))
                    ) : (
                      <li className="no-warning">
                        No warning thresholds were triggered. This is not a
                        quality guarantee.
                      </li>
                    )}
                  </ul>
                  <p className="insight-detail">
                    Luminance: {quality.brightness.meanBefore.toFixed(1)} →{" "}
                    {quality.brightness.meanAfter.toFixed(1)} (delta{" "}
                    {quality.brightness.delta.toFixed(1)}/255). Valid overlap:{" "}
                    {(quality.validFraction * 100).toFixed(1)}%.
                  </p>
                  <details className="insight-method">
                    <summary>Alignment screen & limits</summary>
                    <p>
                      {quality.alignment.status}. {quality.alignment.samples}{" "}
                      samples; best tested shift ({quality.alignment.shiftX},{" "}
                      {quality.alignment.shiftY}) processing pixels. Residual{" "}
                      {quality.alignment.baselineResidual.toFixed(2)} →{" "}
                      {quality.alignment.bestResidual.toFixed(2)}.
                    </p>
                    <ul>
                      {quality.limitations.map((limit, i) => (
                        <li key={i}>{limit}</li>
                      ))}
                    </ul>
                  </details>
                </>
              ) : (
                <p className="insight-detail">
                  No quality screening is stored for this older analysis.
                  Analyze again to assess brightness and possible alignment
                  problems.
                </p>
              )}
            </div>
          </section>
        </div>
      </details>
    </section>
  );
}
