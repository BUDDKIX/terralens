import { useState, useEffect, useRef, useCallback } from "react";
import {
  Aperture,
  ArrowUpRight,
  Check,
  Download,
  FileText,
  Globe2,
  Info,
  Play,
  Upload,
  X,
  Save,
} from "lucide-react";
import SourceMetadata from "./SourceMetadata";
import { safeSourceURL } from "./metadata.mjs";
import Evidence from "./Evidence";
import AnalysisInsights from "./AnalysisInsights";
import UploadDialog from "./UploadDialog";
import Viewer from "./Viewer";
import GeoMap from "./GeoMap";
import { localData, validatePair, processingPixels } from "./images";
import { pixelToGeo, reviewObservation } from "./engine.mjs";
import { loadAnalysis, saveAnalysis, clearAnalysis } from "./storage";
import { createReport, createGeoJSON } from "./export";
import type { Pair, Scene, Result, Review, Saved } from "./types";
import { emptyReview } from "./types";
const number = (n: number) => n.toLocaleString();

export default function App() {
  const [scenes, setScenes] = useState<Scene[]>([]),
    [pair, setPair] = useState<Pair | null>(null),
    [result, setResult] = useState<Result | null>(null),
    [reviews, setReviews] = useState<Record<number, Review>>({}),
    [selected, setSelected] = useState<number | null>(null),
    [threshold, setThreshold] = useState(35),
    [minArea, setMinArea] = useState(100),
    [aligned, setAligned] = useState(false),
    [title, setTitle] = useState(""),
    [filter, setFilter] = useState("all"),
    [query, setQuery] = useState(""),
    [busy, setBusy] = useState("Loading workspace"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [step, setStep] = useState(1),
    [uploadEpoch, setUploadEpoch] = useState(0),
    [reportReady, setReportReady] = useState(false),
    [saved, setSaved] = useState("Not saved"),
    [offline, setOffline] = useState(!navigator.onLine),
    [cached, setCached] = useState(false),
    [tab, setTab] = useState<"imagery" | "map">("imagery"),
    [reportBusy, setReportBusy] = useState(false),
    [reportContent, setReportContent] = useState(""),
    [confirmation, setConfirmation] = useState<{ action: () => void } | null>(
      null,
    );
  const worker = useRef<Worker | null>(null),
    generation = useRef(0),
    reportInFlight = useRef(false),
    loadGeneration = useRef(0),
    saveQueue = useRef<Promise<unknown>>(Promise.resolve()),
    hydrated = useRef(false),
    saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function cancelProcessing() {
    generation.current++;
    setReportContent("");
    setReportReady(false);
    worker.current?.terminate();
    worker.current = null;
  }
  async function openScene(scene: Scene) {
    cancelProcessing();
    const loadId = ++loadGeneration.current;
    setBusy("Loading satellite imagery");
    setError("");
    try {
      const [before, after] = await Promise.all(
        scene.files.map((f) => localData("/imagery/" + f.file)),
      );
      const dimensions = await validatePair(before, after);
      if (loadId !== loadGeneration.current) return null;
      const next = { before, after, ...dimensions, scene };
      setPair(next);
      setStep(2);
      setTitle(scene.title);
      setResult(null);
      setReviews({});
      setSelected(null);
      setThreshold(scene.id === "pakistan" ? 45 : 35);
      setMinArea(scene.id === "pakistan" ? 35 : 100);
      setAligned(false);
      setTab("imagery");
      setFilter("all");
      setQuery("");
      return next;
    } catch (e) {
      if (loadId === loadGeneration.current)
        setError(e instanceof Error ? e.message : "Unable to open scene");
      return null;
    } finally {
      if (loadId === loadGeneration.current) setBusy("");
    }
  }
  useEffect(() => {
    let mounted = true;
    async function init() {
      const initialGeneration = loadGeneration.current;
      // Session recovery and custom upload do not depend on demo availability.
      try {
        const existing = await loadAnalysis();
        if (!mounted) return;
        if (existing && initialGeneration === loadGeneration.current) {
          setPair(existing.pair);
          setResult(existing.result);
          setReviews(existing.reviews);
          setThreshold(existing.threshold);
          setMinArea(existing.minArea);
          setTitle(existing.title);
          setAligned(existing.aligned);
          setSelected(existing.result?.regions[0]?.id ?? null);
          setStep(existing.result ? 3 : 2);
          setSaved("Restored local analysis");
        }
      } catch {
        if (mounted)
          setNotice(
            "Local storage is unavailable. Export a report to retain your work.",
          );
      }
      if (!mounted) return;
      hydrated.current = true;
      setBusy("");
      try {
        const response = await fetch("/imagery/manifest.json");
        if (!response.ok) throw new Error();
        const manifest = await response.json();
        if (mounted) setScenes(manifest.scenes);
      } catch {
        if (mounted)
          setNotice(
            "Demo catalog unavailable. You can still upload your own image pair.",
          );
      }
    }
    init();
    return () => {
      mounted = false;
      cancelProcessing();
      loadGeneration.current++;
    };
  }, []);
  useEffect(() => {
    const online = () => setOffline(!navigator.onLine);
    window.addEventListener("online", online);
    window.addEventListener("offline", online);
    if ("serviceWorker" in navigator && !import.meta.env.DEV) {
      navigator.serviceWorker
        .register("/sw.js")
        .then(async () => {
          await navigator.serviceWorker.ready;
          setCached(true);
        })
        .catch(() =>
          setNotice(
            "Offline caching is unavailable in this browser. Keep the app open for the demo.",
          ),
        );
    }
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", online);
    };
  }, []);
  useEffect(() => {
    if (!hydrated.current || !pair) return;
    let current = true;
    setSaved("Unsaved changes…");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      setSaved("Saving…");
      const snapshot: Saved = {
        version: 1,
        pair,
        result,
        reviews,
        threshold,
        minArea,
        title,
        aligned,
        savedAt: new Date().toISOString(),
      };
      saveQueue.current = saveQueue.current
        .catch(() => {})
        .then(() => saveAnalysis(snapshot));
      saveQueue.current
        .then(() => {
          if (current) setSaved("Saved on this device");
        })
        .catch(() => {
          if (!current) return;
          setSaved("Save failed");
          setNotice(
            "Unable to save locally. Export the evidence report before leaving this page.",
          );
        });
    }, 800);
    return () => {
      current = false;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = null;
    };
  }, [pair, result, reviews, threshold, minArea, title, aligned]);
  useEffect(() => {
    if (!reportContent && !confirmation) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    const controls = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), a[href], input, select, textarea, iframe",
        ) ?? [],
      );
    controls()[0]?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setReportContent("");
        setConfirmation(null);
      }
      if (event.key !== "Tab") return;
      const list = controls(),
        first = list[0],
        last = list.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [reportContent, confirmation]);
  useEffect(() => {
    if (
      saved !== "Unsaved changes…" &&
      saved !== "Saving…" &&
      saved !== "Save failed"
    )
      return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saved]);
  async function analyze(p = pair, t = threshold, area = minArea) {
    if (!p) return;
    cancelProcessing();
    const id = generation.current;
    setBusy("Comparing image pixels");
    setError("");
    try {
      const pixels = await processingPixels(p);
      if (id !== generation.current) return;
      const w = new Worker(new URL("./detector.worker.ts", import.meta.url), {
        type: "module",
      });
      worker.current = w;
      w.onmessage = (e) => {
        if (e.data.id !== generation.current) return;
        if (e.data.stage) {
          setBusy(e.data.stage);
          return;
        }
        if (e.data.error) {
          setError(e.data.error);
          setBusy("");
          w.terminate();
          return;
        }
        const r = {
          ...e.data.result,
          runId: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        } as Result;
        setResult(r);
        setStep(3);
        setReviews({});
        setSelected(r.regions[0]?.id ?? null);
        setFilter("all");
        setQuery("");
        setBusy("");
        w.terminate();
        worker.current = null;
      };
      w.onerror = () => {
        if (id !== generation.current) return;
        setError(
          "Image processing failed. Try a smaller pair or reload the scene.",
        );
        setBusy("");
        w.terminate();
      };
      w.postMessage(
        {
          id,
          ...pixels,
          options: { threshold: t, minArea: area },
          scene: {
            bbox: p.scene.bbox,
            caveats: p.scene.caveats,
            alignment: p.scene.alignment,
          },
        },
        [pixels.before.buffer, pixels.after.buffer],
      );
    } catch (e) {
      if (id === generation.current) {
        setError(e instanceof Error ? e.message : "Processing failed");
        setBusy("");
      }
    }
  }
  // Explicit reruns preserve existing evidence until a replacement completes.
  const reviewed = Object.values(reviews).some(
    (r) =>
      r.status !== "unreviewed" || r.notes || r.category !== "Unclassified",
  );
  const stale =
    !!result && (result.threshold !== threshold || result.minArea !== minArea);
  function updateReview(patch: Partial<Review>) {
    if (
      selected === null ||
      busy ||
      !result?.regions.some((r) => r.id === selected)
    )
      return;
    setReviews((r) => reviewObservation(r, selected, patch));
  }
  function replaceReviewed(action: () => void) {
    if (reviewed) setConfirmation({ action });
    else action();
  }
  function run() {
    replaceReviewed(() => analyze());
  }
  function switchScene(id: string) {
    const s = scenes.find((s) => s.id === id);
    if (s)
      replaceReviewed(() => {
        openScene(s);
      });
  }
  function exportGeoJSON() {
    if (!pair || !result) return;
    try {
      const collection = createGeoJSON(result, reviews, pair.scene.bbox);
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(collection, null, 2)], {
          type: "application/geo+json",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "TerraLens-observations.geojson";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "GeoJSON export failed.",
      );
    }
  }
  async function exportReport(download = false) {
    if (!pair || !result || busy || reportInFlight.current) return;
    const reportGeneration = generation.current;
    reportInFlight.current = true;
    setReportReady(false);
    setReportBusy(true);
    try {
      const html = await createReport(title, pair, result, reviews);
      if (reportGeneration !== generation.current) return;
      if (!download) {
        setStep(4);
        setReportContent(html);
      } else {
        const url = URL.createObjectURL(
          new Blob([html], { type: "text/html" }),
        );
        const a = document.createElement("a");
        a.href = url;
        a.download = "TerraLens-evidence-report.html";
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      }
    } catch (e) {
      if (reportGeneration === generation.current) setError("Report could not be generated. Please try again.");
    } finally {
      reportInFlight.current = false;
      setReportBusy(false);
    }
  }

  const hasGeography = !!(
    pair && pixelToGeo(0, 0, pair.width, pair.height, pair.scene.bbox)
  );
  const selectedRegion = result?.regions.find((r) => r.id === selected),
    review =
      selected === null ? emptyReview : (reviews[selected] ?? emptyReview);
  const geo =
    selectedRegion && result && pair
      ? pixelToGeo(
          selectedRegion.centroid[0],
          selectedRegion.centroid[1],
          result.width,
          result.height,
          pair.scene.bbox,
        )
      : null;
  const approved = Object.values(reviews).filter(
      (r) => r.status === "approved",
    ).length,
    rejected = Object.values(reviews).filter(
      (r) => r.status === "rejected",
    ).length;
  const visible =
    result?.regions.filter(
      (r) =>
        (filter === "all" ||
          (reviews[r.id]?.status ?? "unreviewed") === filter) &&
        (!query ||
          String(r.id).includes(query) ||
          (reviews[r.id]?.category ?? "")
            .toLowerCase()
            .includes(query.toLowerCase())),
    ) ?? [];
  const select = useCallback((id: number) => {
    setSelected(id);
    document
      .getElementById("evidence-panel")
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);
  function adoptPair(p: Pair) {
    replaceReviewed(() => {
      cancelProcessing();
      loadGeneration.current++;
      setPair(p);
      setTitle(p.scene.title);
      setResult(null);
      setReviews({});
      setSelected(null);
      setAligned(false);
      setThreshold(35);
      setMinArea(100);
      setTab("imagery");
      setFilter("all");
      setQuery("");
      setError("");
      setStep(2);
      setBusy("");
    });
  }
  function newAnalysis() {
    replaceReviewed(() => {
      cancelProcessing();
      loadGeneration.current++;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      setUploadEpoch(v=>v+1);
      setPair(null);
      setResult(null);
      setReviews({});
      setSelected(null);
      setAligned(false);
      setTitle("");
      setReportContent("");
      setStep(1);
      setError("");
      setBusy("");
      saveQueue.current = saveQueue.current.catch(() => {}).then(clearAnalysis);
      saveQueue.current.then(
        () => setSaved("New workspace"),
        () => setNotice("Could not clear the saved session."),
      );
    });
  }
  const categories = [
    "Unclassified",
    "Water coverage change",
    "Vegetation or land-cover change",
    "Surface appearance change",
    "Infrastructure requiring inspection",
    "Image artifact",
  ];
  return (
    <div className="app-frame">
      <header className="topbar">
        <div className="wordmark">
          <Aperture size={23} /> TerraLens{" "}
          <span>GEOINT / IMAGE COMPARISON</span>
        </div>
        <div className="header-actions">
          <small>
            {offline
              ? "Offline"
              : cached
                ? "Cache installed"
                : "Local processing"}
          </small>
          <button
            className="secondary"
            onClick={newAnalysis}
            disabled={!!busy || reportBusy}
          >
            <Upload size={15} /> New Analysis
          </button>
        </div>
      </header>
      <main>
        <div className="mission-strip">
          <span>IMAGERY ANALYSIS WORKSTATION</span>
          <span>UNCLASSIFIED / DEMONSTRATION</span>
        </div>
        {error && (
          <div className="error-box" role="alert">
            {error}
            <button aria-label="Dismiss error" onClick={() => setError("")}>
              <X size={16} />
            </button>
          </div>
        )}
        {notice && (
          <div className="notice-box" role="status">
            {notice}
            <button aria-label="Dismiss notice" onClick={() => setNotice("")}>
              <X size={16} />
            </button>
          </div>
        )}
        {busy && (
          <div className="processing" role="status">
            <span /> {busy}…
          </div>
        )}
        {step === 1 && (
          <section className="load-screen">
            <div className="section-intro">
              <h1>Establish the comparison.</h1>
              <p>
                Load an aligned image pair or select a satellite demonstration.
              </p>
            </div>
            <UploadDialog
              key={`${pair?.scene.id ?? "new"}-${uploadEpoch}`}
              inline
              onClose={() => setStep(pair ? 2 : 1)}
              onLoad={adoptPair}
            />
            <div className="demo-picker">
              <div>
                <h2>Reference scenarios</h2>
                <p>Public imagery · documented provenance</p>
              </div>
              <select
                aria-label="Select Demo Scenario"
                value=""
                disabled={!!busy}
                onChange={(e) => switchScene(e.target.value)}
              >
                <option value="">Select Demo Scenario</option>
                {scenes.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </div>
            {pair && (
              <button
                className="secondary"
                onClick={() => setStep(result ? 3 : 2)}
              >
                Return to current analysis
              </button>
            )}
          </section>
        )}
        {pair && step > 1 && (
          <>
            <div className="workspace-heading">
              <div>
                <label className="title-label">
                  Analysis title
                  <input
                    aria-label="Analysis title"
                    value={title}
                    maxLength={120}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </label>
                <p>
                  {pair.width} × {pair.height} source pixels ·{" "}
                  {pair.scene.sensor}
                </p>
              </div>
              <button
                className="secondary"
                onClick={() => setStep(1)}
                disabled={!!busy || reportBusy}
              >
                Change images
              </button>
            </div>
            {step > 1 && (
              <section className="panel analysis-workspace">
                {!result && (
                  <Viewer
                    key={pair.scene.id}
                    pair={pair}
                    result={result}
                    reviews={reviews}
                    selected={selected}
                    onSelect={select}
                  />
                )}
                <div className="analysis-controls">
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={aligned}
                      onChange={(e) => setAligned(e.target.checked)}
                    />{" "}
                    Alignment inspected — residual offsets may produce false
                    changes.
                  </label>
                  <details className="advanced">
                    <summary>Advanced Settings</summary>
                    <div className="form-grid">
                      <label>
                        RGB threshold (0–255)
                        <input
                          type="number"
                          min={0}
                          max={255}
                          step={1}
                          value={threshold}
                          onChange={(e) => setThreshold(Number(e.target.value))}
                        />
                      </label>
                      <label>
                        Minimum region (processing pixels)
                        <input
                          type="number"
                          min={1}
                          max={589824}
                          step={1}
                          value={minArea}
                          onChange={(e) => setMinArea(Number(e.target.value))}
                        />
                      </label>
                    </div>
                    <p>
                      3 × 3 mean filter · 4-connected regions · longest
                      processing edge 768 px. Lower thresholds detect more
                      differences. Settings apply only when you analyze.
                    </p>
                  </details>
                  {stale && (
                    <p className="inline-warning">
                      Settings changed. The existing evidence remains from
                      threshold {result?.threshold}. Analyze again to apply
                      these settings.
                    </p>
                  )}
                  <div className="action-row">
                    <p>No automatic registration or terrain classification.</p>
                    <button
                      className="primary"
                      onClick={run}
                      disabled={
                        !aligned ||
                        !!busy ||
                        !Number.isInteger(threshold) ||
                        threshold < 0 ||
                        threshold > 255 ||
                        !Number.isInteger(minArea) ||
                        minArea < 1 ||
                        minArea > 589824
                      }
                    >
                      <Play size={16} /> Analyze Images
                    </button>
                  </div>
                </div>
              </section>
            )}
            {step > 1 && result && (
              <>
                <AnalysisInsights
                  pair={pair}
                  result={result}
                  stale={stale}
                  onSelect={select}
                />
                <div className="section-heading">
                  <div>
                    <h2>Inspect findings</h2>
                    <p>02 / EVIDENCE WORKSPACE</p>
                  </div>
                  <button
                    className="primary"
                    onClick={() =>
                      document
                        .getElementById("report-section")
                        ?.scrollIntoView({ block: "start" })
                    }
                  >
                    <FileText size={16} /> Report & export
                  </button>
                </div>
                <div className="inspection-layout">
                  <div className="panel">
                    <div className="viewer-toolbar">
                      <div className="segmented">
                        <button
                          className={tab === "imagery" ? "active" : ""}
                          onClick={() => setTab("imagery")}
                        >
                          Imagery
                        </button>
                        <button
                          className={tab === "map" ? "active" : ""}
                          onClick={() => setTab("map")}
                        >
                          Geographic map
                        </button>
                      </div>
                    </div>
                    {tab === "imagery" ? (
                      <Viewer
                        key={pair.scene.id}
                        pair={pair}
                        result={result}
                        reviews={reviews}
                        selected={selected}
                        onSelect={select}
                      />
                    ) : (
                      <GeoMap
                        pair={pair}
                        result={result}
                        reviews={reviews}
                        selected={selected}
                        onSelect={select}
                      />
                    )}
                    <div className="observation-tools">
                      <input
                        aria-label="Search observations"
                        placeholder="Search region or category"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                      <select
                        aria-label="Review filter"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                      >
                        <option value="all">All observations</option>
                        <option value="unreviewed">Unreviewed</option>
                        <option value="approved">Verified by analyst</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </div>
                    <div className="observation-list">
                      {visible.map((r) => (
                        <button
                          key={r.id}
                          className={selected === r.id ? "selected" : ""}
                          onClick={() => select(r.id)}
                        >
                          <strong>Region {r.id}</strong>
                          <span>{number(r.area)} changed px</span>
                          <small>
                            {reviews[r.id]?.status === "approved"
                              ? "Verified by analyst"
                              : (reviews[r.id]?.status ?? "Unreviewed")}
                          </small>
                        </button>
                      ))}
                      {!visible.length && (
                        <p className="empty-state">
                          {result.regions.length
                            ? "No observations match this filter."
                            : "No regions passed the selected settings. A preliminary report is still available."}
                        </p>
                      )}
                    </div>
                  </div>
                  <section className="panel evidence-panel" id="evidence-panel">
                    <div className="panel-heading">
                      <h2>Observation details</h2>
                    </div>
                    {selectedRegion ? (
                      <div className="evidence-body">
                        <div className="evidence-title">
                          <strong>Region {selectedRegion.id}</strong>
                          <span>
                            {review.status === "approved"
                              ? "Verified by analyst"
                              : review.status}
                          </span>
                        </div>
                        <Evidence
                          pair={pair}
                          result={result}
                          region={selectedRegion}
                        />
                        <dl className="region-stats">
                          <div>
                            <dt>Changed pixels</dt>
                            <dd>{number(selectedRegion.area)}</dd>
                          </div>
                          <div>
                            <dt>Mean RGB difference</dt>
                            <dd>
                              {selectedRegion.meanDifference.toFixed(1)} / 255
                            </dd>
                          </div>
                          <div>
                            <dt>Centroid (processing x, y)</dt>
                            <dd>
                              {selectedRegion.centroid
                                .map((n) => n.toFixed(1))
                                .join(", ")}
                            </dd>
                          </div>
                          <div>
                            <dt>Bounds (x0, y0, x1, y1)</dt>
                            <dd>{selectedRegion.bbox.join(", ")}</dd>
                          </div>
                        </dl>
                        {geo && (
                          <p className="coordinates">
                            {geo.lat.toFixed(5)}, {geo.lng.toFixed(5)}{" "}
                            (latitude, longitude)
                          </p>
                        )}
                        {result.reliability?.regionPersistence[
                          selectedRegion.id
                        ] && (
                          <p className="fineprint">
                            {
                              result.reliability.regionPersistence[
                                selectedRegion.id
                              ].label
                            }
                            . Threshold stability is not accuracy.
                          </p>
                        )}
                        <label>
                          Analyst interpretation
                          <select
                            value={review.category}
                            onChange={(e) =>
                              updateReview({ category: e.target.value })
                            }
                          >
                            {!categories.includes(review.category) && (
                              <option>{review.category}</option>
                            )}
                            {categories.map((c) => (
                              <option key={c} value={c}>
                                {c === "Unclassified"
                                  ? "Unclassified observation"
                                  : c}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Optional analyst notes
                          <textarea
                            value={review.notes}
                            maxLength={3000}
                            placeholder="Describe the visible evidence and uncertainty…"
                            onChange={(e) =>
                              updateReview({ notes: e.target.value })
                            }
                          />
                        </label>
                        <div className="review-actions">
                          <button
                            aria-pressed={review.status === "approved"}
                            onClick={() => updateReview({ status: "approved" })}
                          >
                            <Check size={15} /> Mark as Verified
                          </button>
                          <button
                            aria-pressed={review.status === "rejected"}
                            onClick={() => updateReview({ status: "rejected" })}
                          >
                            <X size={15} /> Mark as Rejected
                          </button>
                          <button
                            aria-pressed={review.status === "unreviewed"}
                            onClick={() =>
                              updateReview({ status: "unreviewed" })
                            }
                          >
                            Leave Unreviewed
                          </button>
                        </div>
                        <p className="fineprint">
                          Verification records your interpretation; it does not
                          establish ground truth.
                        </p>
                      </div>
                    ) : (
                      <p className="empty-state">
                        Select a region to inspect its evidence.
                      </p>
                    )}
                  </section>
                </div>
              </>
            )}
            {step > 1 && result && (
              <section className="panel report-screen" id="report-section">
                <FileText size={32} />
                <h1>Analysis record</h1>
                <p>03 / REPORT & GEOSPATIAL EXPORT</p>
                <div className="report-summary">
                  <span>{result.regions.length} observations</span>
                  <span>{approved} verified by analyst</span>
                  <span>{rejected} rejected</span>
                </div>
                <p className="fineprint">
                  Analysis {result.runId} ·{" "}
                  {new Date(result.createdAt).toLocaleString()}
                </p>
                <div className="action-row">
                  <button
                    className="primary"
                    disabled={reportBusy || !!busy}
                    onClick={() => exportReport()}
                  >
                    <FileText size={16} />
                    {reportBusy ? "Preparing report…" : "Generate Report"}
                  </button>
                  <button
                    className="secondary"
                    disabled={!hasGeography}
                    onClick={exportGeoJSON}
                  >
                    <Globe2 size={16} /> Export GeoJSON
                  </button>
                </div>
                {!hasGeography && (
                  <p className="fineprint">
                    Geographic export is unavailable without valid geographic
                    bounds. The report includes image-space measurements.
                  </p>
                )}
              </section>
            )}
            <details className="source-details">
              <summary>
                <Info size={15} /> Sources & methodology
              </summary>
              {pair.scene.id.startsWith("upload-") && <SourceMetadata key={pair.scene.id} scene={pair.scene} disabled={!!busy || reportBusy} onSave={scene=>setPair(current=>current?.scene.id === scene.id ? {...current,scene} : current)}/>}
              <p>{pair.scene.description}</p>
              <p>{pair.scene.alignment}</p>
              <p>{pair.scene.attribution}</p>
              <ul>
                {pair.scene.caveats.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <p>
                Local RGB difference after spatial averaging, threshold
                segmentation and four-connected region extraction. Nearby
                thresholds measure persistence; they do not measure accuracy. No
                automatic cloud detection, registration or classification is
                applied.
              </p>
              {pair.scene.files.map((f) => (
                <p key={f.file}>
                  {safeSourceURL(f.sourceUrl) ? (
                    <a href={safeSourceURL(f.sourceUrl)} target="_blank" rel="noreferrer">
                      {f.file} — source imagery <ArrowUpRight size={12} />
                    </a>
                  ) : (
                    f.file
                  )}
                </p>
              ))}
            </details>
          </>
        )}
        <footer className="app-footer">
          <span>Unclassified demonstration · Analyst assistance prototype</span>
          <span>
            <Save size={13} />
            {saved}
          </span>
        </footer>
      </main>
      {confirmation && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="replace-title"
          >
            <h2 id="replace-title">Replace the current analysis?</h2>
            <p>
              This removes the current detections, notes and review decisions.
              Export a report first if you need to retain them.
            </p>
            <footer>
              <button
                className="secondary"
                onClick={() => setConfirmation(null)}
              >
                Keep current analysis
              </button>
              <button
                className="primary"
                onClick={() => {
                  const action = confirmation.action;
                  setConfirmation(null);
                  action();
                }}
              >
                Replace analysis
              </button>
            </footer>
          </section>
        </div>
      )}
      {reportContent && (
        <div className="modal-backdrop">
          <section
            className="report-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Report preview"
          >
            <header>
              <strong>Analysis report</strong>
              <div>
                <button
                  className="secondary"
                  onClick={() => {
                    const url = URL.createObjectURL(
                      new Blob([reportContent], { type: "text/html" }),
                    );
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "TerraLens-analysis-report.html";
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(url), 10000);
                  }}
                >
                  <Download size={14} /> Download HTML
                </button>
                <button
                  className="secondary"
                  disabled={!reportReady}
                  onClick={() => {
                    const frame = document.getElementById(
                      "report-preview",
                    ) as HTMLIFrameElement;
                    frame.contentWindow?.focus();
                    frame.contentWindow?.print();
                  }}
                >
                  {reportReady ? "Print / Save as PDF" : "Loading report images…"}
                </button>
                <button
                  aria-label="Close report"
                  onClick={() => setReportContent("")}
                >
                  <X size={20} />
                </button>
              </div>
            </header>
            <iframe
              id="report-preview"
              title="TerraLens printable analysis report"
              srcDoc={reportContent}
              onLoad={async e=>{
                const frame=e.currentTarget, doc=frame.contentDocument;
                if (!doc) return;
                await Promise.all(Array.from(doc.images).map(img=>img.decode().catch(()=>{})));
                if (frame.isConnected && frame.contentDocument === doc) {
                  const failed=Array.from(doc.images).some(img=>!img.naturalWidth);
                  setReportReady(!failed);
                  if (failed) setError("A report image failed to load. Regenerate the report before printing.");
                }
              }}
            />
          </section>
        </div>
      )}
    </div>
  );
}
