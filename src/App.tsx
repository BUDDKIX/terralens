import { useState, useEffect, useRef, useCallback } from "react";
import {
  Aperture,
  ArrowUpRight,
  ChevronRight,
  Check,
  Download,
  FileText,
  Focus,
  Globe2,
  Info,
  Layers,
  Map,
  Play,
  Radio,
  RefreshCw,
  ScanLine,
  Settings2,
  ShieldCheck,
  Upload,
  X,
  Activity,
  Satellite,
  Clock3,
  Search,
  AlertTriangle,
  Save,
} from "lucide-react";
import Evidence from "./Evidence";
import UploadDialog from "./UploadDialog";
import Viewer from "./Viewer";
import GeoMap from "./GeoMap";
import {
  localData,
  validatePair,
  processingPixels,
} from "./images";
import { pixelToGeo, reviewObservation } from "./engine.mjs";
import { loadAnalysis, saveAnalysis } from "./storage";
import { createReport } from "./export";
import type {
  Pair,
  Scene,
  Result,
  Review,
  Saved,
} from "./types";
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
    [upload, setUpload] = useState(false),
    [sources, setSources] = useState(false),
    [saved, setSaved] = useState("Not saved"),
    [offline, setOffline] = useState(!navigator.onLine),
    [cached, setCached] = useState(false),
    [tab, setTab] = useState<"imagery" | "map">("imagery"),
    [feed, setFeed] = useState(""),
    [events, setEvents] = useState<{ time: string; text: string }[]>([]),
    [reportBusy, setReportBusy] = useState(false),
    [reportContent, setReportContent] = useState(""),
    [confirmation, setConfirmation] = useState<{ action: () => void } | null>(
      null,
    );
  const worker = useRef<Worker | null>(null),
    generation = useRef(0),
    feedTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    hydrated = useRef(false);
  function log(text: string) {
    setEvents((a) =>
      [
        {
          time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          }),
          text,
        },
        ...a,
      ].slice(0, 8),
    );
  }
  function cancelProcessing() {
    generation.current++;
    worker.current?.terminate();
    worker.current = null;
  }
  async function openScene(scene: Scene) {
    cancelProcessing();
    setBusy("Loading satellite imagery");
    setError("");
    try {
      const [before, after] = await Promise.all(
        scene.files.map((f) => localData("/imagery/" + f.file)),
      );
      const dimensions = await validatePair(before, after);
      const next = { before, after, ...dimensions, scene };
      setPair(next);
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
      log("Opened " + scene.title);
      return next;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to open scene");
      return null;
    } finally {
      setBusy("");
    }
  }
  useEffect(() => {
    let mounted = true;
    async function init() {
      try {
        const response = await fetch("/imagery/manifest.json");
        if (!response.ok) throw new Error("Scene catalog unavailable.");
        const manifest = await response.json();
        const list = manifest.scenes as Scene[];
        if (!mounted) return;
        setScenes(list);
        let existing: Saved | null = null;
        try {
          existing = await loadAnalysis();
        } catch {
          setNotice(
            "Local storage is unavailable; keep this tab open and export your report.",
          );
        }
        if (!mounted) return;
        if (existing) {
          setPair(existing.pair);
          setResult(existing.result);
          setReviews(existing.reviews);
          setThreshold(existing.threshold);
          setMinArea(existing.minArea);
          setTitle(existing.title);
          setAligned(existing.aligned);
          setSelected(existing.result?.regions[0]?.id ?? null);
          setSaved("Restored local analysis");
          setBusy("");
          log("Restored saved analysis");
        } else await openScene(list[0]);
        hydrated.current = true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Workspace failed to load");
        setBusy("");
      }
    }
    init();
    return () => {
      mounted = false;
      cancelProcessing();
      if (feedTimer.current) clearTimeout(feedTimer.current);
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
    setSaved("Saving…");
    saveAnalysis({
      version: 1,
      pair,
      result,
      reviews,
      threshold,
      minArea,
      title,
      aligned,
      savedAt: new Date().toISOString(),
    })
      .then(() => setSaved("Saved on this device"))
      .catch(() => {
        setSaved("Save failed");
        setNotice(
          "Unable to save locally. Export the evidence report before leaving this page.",
        );
      });
  }, [pair, result, reviews, threshold, minArea, title, aligned]);
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
        if (e.data.error) {
          setError(e.data.error);
          setBusy("");
          setFeed("");
          w.terminate();
          return;
        }
        const r = {
          ...e.data.result,
          runId: crypto.randomUUID(),
          createdAt: new Date().toISOString(),
        } as Result;
        setResult(r);
        setReviews({});
        setSelected(r.regions[0]?.id ?? null);
        setFilter("all");
        setQuery("");
        setBusy("");
        setFeed("");
        log(
          `${r.regions.length} candidate regions · ${r.processingMs.toFixed(0)} ms`,
        );
        w.terminate();
        worker.current = null;
      };
      w.onerror = () => {
        setError(
          "Image processing failed. Try a smaller pair or reload the scene.",
        );
        setBusy("");
        setFeed("");
        w.terminate();
      };
      w.postMessage(
        { id, ...pixels, options: { threshold: t, minArea: area } },
        [pixels.before.buffer, pixels.after.buffer],
      );
    } catch (e) {
      if (id === generation.current) {
        setError(e instanceof Error ? e.message : "Processing failed");
        setBusy("");
        setFeed("");
      }
    }
  }
  // Sensitivity previews remain live until review begins. Reviewed runs are never silently replaced.
  const reviewed = Object.values(reviews).some(
    (r) =>
      r.status !== "unreviewed" || r.notes || r.category !== "Unclassified",
  );
  const stale =
    !!result && (result.threshold !== threshold || result.minArea !== minArea);
  useEffect(() => {
    if (!stale || reviewed || busy || !aligned) return;
    const timer = setTimeout(() => analyze(), 450);
    return () => clearTimeout(timer);
  }, [threshold, minArea]);
  function updateReview(patch: Partial<Review>) {
    if (selected === null) return;
    setReviews((r) => reviewObservation(r, selected, patch));
    if (patch.status)
      log(
        `OBS-${String(selected).padStart(3, "0")} ${patch.status} by analyst`,
      );
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
  function replay() {
    replaceReviewed(startReplay);
  }
  function startReplay() {
    if (!pair || busy || feed) return;
    setFeed("Waiting for scheduled image");
    setResult(null);
    setReviews({});
    setSelected(null);
    log("Simulated imagery feed started");
    feedTimer.current = setTimeout(() => {
      setFeed("Later image received");
      log(
        "Prepared image received · " + (pair.scene.dates[1] || "unknown date"),
      );
      feedTimer.current = setTimeout(() => {
        setFeed("Processing received imagery");
        analyze();
      }, 800);
    }, 1600);
  }
  async function exportReport(download = false) {
    if (!pair || !result) return;
    setReportBusy(true);
    try {
      const html = await createReport(title, pair, result, reviews);
      if (!download) {
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
      log("Evidence report exported");
    } catch (e) {
      setError("Report could not be generated. Please try again.");
    } finally {
      setReportBusy(false);
    }
  }

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
  return (
    <div className="app-frame">
      <aside className="rail">
        <a className="brand-mark" href="/" aria-label="TerraLens workspace">
          <Aperture size={27} />
        </a>
        <div className="rail-items">
          <button
            className={tab === "imagery" ? "selected" : ""}
            title="Imagery workspace"
            aria-label="Imagery workspace"
            onClick={() => setTab("imagery")}
          >
            <Layers size={21} />
          </button>
          <button
            className={tab === "map" ? "selected" : ""}
            title="Observation map"
            aria-label="Observation map"
            onClick={() => setTab("map")}
          >
            <Globe2 size={21} />
          </button>
          <button
            title="Export evidence report"
            aria-label="Export evidence report"
            disabled={!result || reportBusy}
            onClick={() => exportReport()}
          >
            <FileText size={20} />
          </button>
        </div>
        <button
          className="rail-info"
          title="Sources and methodology"
          aria-label="Sources and methodology"
          onClick={() => setSources(true)}
        >
          <Info size={20} />
        </button>
        <div className="avatar">TL</div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="wordmark">
            TERRA<span>LENS</span>
            <i /> <span className="product-label">GEOSPATIAL INTELLIGENCE</span>
          </div>
          <div className="top-status">
            <span className="connection">
              <i className={"status-dot " + (offline ? "offline" : "")} />
              {offline
                ? "Offline"
                : cached
                  ? "Offline ready"
                  : "Local processing"}
            </span>
            <span className="prototype">PROTOTYPE</span>
            <button
              className="icon-button"
              aria-label="View sources"
              onClick={() => setSources(true)}
            >
              <Info size={17} />
            </button>
          </div>
        </header>
        <main>
          <div className="breadcrumb">
            WORKSPACE <ChevronRight size={11} /> RECONNAISSANCE ANALYSIS{" "}
            <span>01 / TERRAIN OBSERVATION</span>
          </div>
          <section className="page-heading">
            <div>
              <div className="eyebrow">
                <span className="tiny-line" /> EVIDENCE BEFORE INTERPRETATION
              </div>
              <h1>
                See what changed.<span> Understand what matters.</span>
              </h1>
              <p>
                Compare satellite imagery. Investigate visual changes. Build a
                traceable evidence record.
              </p>
            </div>
            <div className="heading-actions">
              <button
                className="secondary"
                onClick={() => setUpload(true)}
                disabled={!!busy || !!feed}
              >
                <Upload size={15} /> Upload imagery
              </button>
              <button
                className="primary"
                onClick={() => exportReport()}
                disabled={!result || reportBusy || !!busy}
              >
                <FileText size={16} />
                {reportBusy ? "Preparing…" : "Export report"}
                <ArrowUpRight size={14} />
              </button>
            </div>
          </section>
          {error && (
            <div className="error-box" role="alert">
              <AlertTriangle size={16} />
              {error}
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={15} />
              </button>
            </div>
          )}
          {notice && (
            <div className="notice-box">
              <Info size={15} />
              {notice}
              <button
                aria-label="Dismiss notification"
                onClick={() => setNotice("")}
              >
                <X size={15} />
              </button>
            </div>
          )}
          <div className="workspace-strip">
            <div className="scene-select">
              <Satellite size={20} />
              <div>
                <label htmlFor="scene">ACTIVE SCENE</label>
                <select
                  id="scene"
                  disabled={!!busy || !!feed}
                  value={pair?.scene.id ?? ""}
                  onChange={(e) => switchScene(e.target.value)}
                >
                  {pair?.scene.id.startsWith("upload") && (
                    <option value={pair.scene.id}>{pair.scene.title}</option>
                  )}
                  {scenes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="scene-meta">
              <span>ACQUISITION WINDOW</span>
              <strong>
                {pair?.scene.dates[0] || "Unknown"}
                <span className="date-arrow">→</span>
                {pair?.scene.dates[1] || "Unknown"}
              </strong>
            </div>
            <div className="scene-meta sensor">
              <span>SENSOR / COMPOSITE</span>
              <strong>
                {pair?.scene.sensor || "—"} <small>{pair?.scene.color}</small>
              </strong>
            </div>
            <div className="source-pill">
              <i className="status-dot" />
              {pair?.scene.id.startsWith("upload")
                ? "USER UPLOAD"
                : "REAL SATELLITE DATA"}
            </div>
          </div>
          <div className="stats-grid">
            <div className="stat">
              <span>
                CANDIDATE REGIONS
                <ScanLine size={16} />
              </span>
              <strong>
                {result ? number(result.regions.length) : "—"}
                <small>awaiting interpretation</small>
              </strong>
            </div>
            <div className="stat">
              <span>
                VISUAL DIFFERENCE
                <Layers size={16} />
              </span>
              <strong>
                {result ? result.changedPercent.toFixed(1) : "—"}
                <em>{result ? "%" : ""}</em>
                <small>of valid processing pixels</small>
              </strong>
            </div>
            <div className="stat">
              <span>
                ANALYST REVIEW
                <ShieldCheck size={16} />
              </span>
              <strong>
                {approved}
                <em>/ {result?.regions.length ?? 0}</em>
                <small>approved observations</small>
              </strong>
            </div>
            <div className="stat">
              <span>
                PROCESSING TIME
                <Activity size={16} />
              </span>
              <strong>
                {result ? result.processingMs.toFixed(0) : "—"}
                <em>{result ? "ms" : ""}</em>
                <small>measured detector runtime</small>
              </strong>
            </div>
          </div>
          <div className="analysis-layout">
            <section className="left-workspace">
              <div className="panel main-panel">
                <div className="panel-heading">
                  <div>
                    <span className="panel-index">01</span>
                    <h2>Imagery workspace</h2>
                    <span className="subtle-tag">
                      {pair?.scene.bbox ? "GEOREFERENCED" : "IMAGE SPACE"}
                    </span>
                  </div>
                  <div className="tab-controls">
                    <button
                      className={tab === "imagery" ? "active" : ""}
                      onClick={() => setTab("imagery")}
                    >
                      <Layers size={14} />
                      Imagery
                    </button>
                    <button
                      className={tab === "map" ? "active" : ""}
                      onClick={() => setTab("map")}
                    >
                      <Map size={14} />
                      Map
                    </button>
                  </div>
                </div>
                {pair ? (
                  tab === "imagery" ? (
                    <Viewer
                      key={pair.scene.id}
                      pair={pair}
                      result={result}
                      reviews={reviews}
                      selected={selected}
                      onSelect={select}
                    />
                  ) : (
                    <div className="large-map">
                      <GeoMap
                        pair={pair}
                        result={result}
                        reviews={reviews}
                        selected={selected}
                        onSelect={select}
                      />
                    </div>
                  )
                ) : (
                  <div className="loading-placeholder">
                    <Aperture className="spin" size={32} />
                    <p>{busy || "Select imagery to begin"}</p>
                    {error && (
                      <button
                        className="secondary"
                        onClick={() => location.reload()}
                      >
                        Retry loading
                      </button>
                    )}
                  </div>
                )}
                {!!busy && pair && (
                  <div className="processing-bar" role="status">
                    <RefreshCw size={14} className="spin" />
                    {busy}…
                  </div>
                )}
                <div className="detection-controls">
                  <div className="control-title">
                    <Settings2 size={16} />
                    <strong>Detection settings</strong>
                    <span>RGB difference · 4-connected regions</span>
                  </div>
                  <div className="control-row">
                    <label className="range-control">
                      <span>
                        Sensitivity <b>{Math.round((90 - threshold) / 0.8)}%</b>
                      </span>
                      <input
                        aria-label="Detection sensitivity"
                        type="range"
                        min="0"
                        max="100"
                        value={Math.round((90 - threshold) / 0.8)}
                        disabled={!!busy || !!feed}
                        onChange={(e) =>
                          setThreshold(
                            Math.round(90 - Number(e.target.value) * 0.8),
                          )
                        }
                      />
                      <small>
                        Higher sensitivity detects smaller color differences
                      </small>
                    </label>
                    <label className="area-control">
                      <span>Minimum region</span>
                      <div>
                        <input
                          aria-label="Minimum region area"
                          type="number"
                          min="1"
                          max="100000"
                          value={minArea}
                          disabled={!!busy || !!feed}
                          onChange={(e) =>
                            setMinArea(
                              Math.max(
                                1,
                                Math.min(100000, Number(e.target.value) || 1),
                              ),
                            )
                          }
                        />
                        <span>px</span>
                      </div>
                      <small>On the processing grid</small>
                    </label>
                    <button
                      className="primary run-button"
                      onClick={run}
                      disabled={!pair || !!busy || !aligned || !!feed}
                    >
                      <ScanLine size={17} />
                      {busy
                        ? "Processing…"
                        : result
                          ? "Run new analysis"
                          : "Detect changes"}
                    </button>
                  </div>
                  <label className="alignment-check">
                    <input
                      type="checkbox"
                      checked={aligned}
                      disabled={!!busy || !!feed}
                      onChange={(e) => setAligned(e.target.checked)}
                    />
                    <span>
                      I inspected stable landmarks in both images and accept the
                      alignment for visual screening.
                    </span>
                  </label>
                  {stale && (
                    <div className="inline-warning">
                      Settings changed.{" "}
                      {reviewed
                        ? "Run a new analysis to apply them; current reviews belong to the existing run."
                        : "Updating preview…"}
                    </div>
                  )}
                </div>
                <div className="method-note">
                  <Info size={14} />
                  <p>
                    Visual differences are candidates, not confirmed terrain
                    changes. Clouds, shadows, lighting and residual misalignment
                    require analyst review.
                  </p>
                  <button onClick={() => setSources(true)}>
                    Method & sources
                    <ArrowUpRight size={12} />
                  </button>
                </div>
              </div>
              <div className="lower-grid">
                <section className="panel map-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="panel-index">02</span>
                      <h2>Observation map</h2>
                    </div>
                    <Globe2 size={16} />
                  </div>
                  {pair && (
                    <GeoMap
                      pair={pair}
                      result={result}
                      reviews={reviews}
                      selected={selected}
                      onSelect={select}
                    />
                  )}
                </section>
                <section className="panel activity-panel">
                  <div className="panel-heading">
                    <div>
                      <span className="panel-index">03</span>
                      <h2>Activity log</h2>
                    </div>
                    <Clock3 size={16} />
                  </div>
                  <div className="feed-card">
                    <Radio size={18} />
                    <div>
                      <strong>Simulated imagery feed</strong>
                      <p>
                        {feed ||
                          "Replay this prepared scene through the real detector."}
                      </p>
                    </div>
                    <button
                      className="icon-button"
                      aria-label="Replay simulated imagery feed"
                      disabled={!aligned || !!busy || !!feed || !pair}
                      onClick={replay}
                    >
                      <Play size={16} />
                    </button>
                  </div>
                  <div className="timeline">
                    {events.length ? (
                      events.slice(0, 4).map((e, i) => (
                        <div key={i}>
                          <i />
                          <time>{e.time}</time>
                          <span>{e.text}</span>
                        </div>
                      ))
                    ) : (
                      <p>Analysis actions appear here.</p>
                    )}
                  </div>
                </section>
              </div>
            </section>
            <aside className="review-column">
              <section className="panel queue-panel">
                <div className="panel-heading">
                  <div>
                    <Focus size={17} />
                    <h2>Observation queue</h2>
                    <span className="count-tag">
                      {result?.regions.length ?? 0}
                    </span>
                  </div>
                </div>
                <div className="queue-tools">
                  <div className="queue-filters">
                    {[
                      ["all", "All"],
                      ["unreviewed", "Pending"],
                      ["approved", "Approved"],
                      ["rejected", "Rejected"],
                    ].map(([v, l]) => (
                      <button
                        className={filter === v ? "active" : ""}
                        key={v}
                        onClick={() => setFilter(v)}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                  <div className="queue-search">
                    <Search size={14} />
                    <input
                      aria-label="Search observations"
                      placeholder="Find by region ID or category"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                </div>
                <div className="observation-list">
                  {visible.length ? (
                    visible.map((r) => (
                      <button
                        key={r.id}
                        className={
                          "observation " + (selected === r.id ? "selected" : "")
                        }
                        onClick={() => select(r.id)}
                      >
                        <span
                          className={
                            "observation-icon " +
                            (reviews[r.id]?.status ?? "unreviewed")
                          }
                        >
                          {reviews[r.id]?.status === "approved" ? (
                            <Check size={15} />
                          ) : reviews[r.id]?.status === "rejected" ? (
                            <X size={15} />
                          ) : (
                            <ScanLine size={15} />
                          )}
                        </span>
                        <span>
                          <strong>
                            Region {String(r.id).padStart(3, "0")}
                          </strong>
                          <small>
                            {number(r.area)} px <b>·</b>{" "}
                            {reviews[r.id]?.category ?? "Visual change"}
                          </small>
                        </span>
                        <span className="observation-status">
                          {reviews[r.id]?.status === "approved"
                            ? "APPROVED"
                            : reviews[r.id]?.status === "rejected"
                              ? "REJECTED"
                              : "REVIEW"}
                          <ChevronRight size={12} />
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="queue-empty">
                      <ScanLine size={27} />
                      <strong>
                        {result
                          ? "No matching observations"
                          : "Ready for a closer look"}
                      </strong>
                      <p>
                        {result
                          ? "Adjust the filter or detection settings."
                          : "Inspect alignment, then detect changes to populate this queue."}
                      </p>
                    </div>
                  )}
                </div>
                <div className="queue-summary">
                  <span>
                    <i className="legend-dot green" />
                    {approved} approved
                  </span>
                  <span>
                    <i className="legend-dot muted" />
                    {rejected} rejected
                  </span>
                  <span>
                    {(result?.regions.length ?? 0) - approved - rejected}{" "}
                    pending
                  </span>
                </div>
              </section>
              <section className="panel evidence-panel" id="evidence-panel">
                <div className="panel-heading">
                  <div>
                    <span className="panel-index">04</span>
                    <h2>Evidence & review</h2>
                  </div>
                  <ShieldCheck size={16} />
                </div>
                {pair && result && selectedRegion ? (
                  <div className="evidence-body">
                    <div className="evidence-title">
                      <strong>
                        OBS-{String(selectedRegion.id).padStart(3, "0")}
                      </strong>
                      <span className={"status-label " + review.status}>
                        {review.status}
                      </span>
                    </div>
                    <Evidence
                      pair={pair}
                      result={result}
                      region={selectedRegion}
                    />
                    <div className="evidence-metrics">
                      <div>
                        <span>CHANGED PIXELS</span>
                        <strong>{number(selectedRegion.area)} px</strong>
                      </div>
                      <div>
                        <span>IMAGE CENTROID</span>
                        <strong>
                          {selectedRegion.centroid
                            .map((n) => n.toFixed(0))
                            .join(", ")}
                        </strong>
                      </div>
                    </div>
                    {geo && (
                      <div className="coordinates">
                        <Globe2 size={13} />
                        {geo.lat.toFixed(4)}° N · {geo.lng.toFixed(4)}° E
                        <span>WGS 84</span>
                      </div>
                    )}
                    <label className="field-label">
                      Analyst interpretation
                      <select
                        value={review.category}
                        onChange={(e) =>
                          updateReview({ category: e.target.value })
                        }
                      >
                        {[
                          "Unclassified",
                          "Water extent change",
                          "Vegetation change",
                          "Terrain / surface change",
                          "Infrastructure change",
                          "Cloud / shadow artifact",
                          "Alignment artifact",
                          "Other visual change",
                        ].map((v) => (
                          <option key={v}>{v}</option>
                        ))}
                      </select>
                    </label>
                    <label className="field-label">
                      Evidence notes
                      <textarea
                        value={review.notes}
                        maxLength={3000}
                        placeholder="Describe what you can observe and any uncertainty…"
                        onChange={(e) =>
                          updateReview({ notes: e.target.value })
                        }
                      />
                    </label>
                    <div className="review-actions">
                      <button
                        className={
                          "approve " +
                          (review.status === "approved" ? "is-active" : "")
                        }
                        onClick={() => updateReview({ status: "approved" })}
                      >
                        <Check size={16} />
                        Approve
                      </button>
                      <button
                        className={
                          "reject " +
                          (review.status === "rejected" ? "is-active" : "")
                        }
                        onClick={() => updateReview({ status: "rejected" })}
                      >
                        <X size={16} />
                        Reject
                      </button>
                      <button
                        className="icon-button"
                        title="Reset review status"
                        aria-label="Reset review status"
                        onClick={() => updateReview({ status: "unreviewed" })}
                      >
                        <RefreshCw size={14} />
                      </button>
                    </div>
                    <p className="fineprint">
                      Approval records your interpretation. It does not
                      establish ground truth.
                    </p>
                  </div>
                ) : (
                  <div className="evidence-empty">
                    <Focus size={25} />
                    <p>
                      Select a detected region to inspect its before-and-after
                      evidence.
                    </p>
                  </div>
                )}
              </section>
              <div className="report-card">
                <div className="report-icon">
                  <FileText size={21} />
                </div>
                <div>
                  <strong>Your findings. A clear record.</strong>
                  <p>
                    Export imagery, reviews, mapped observations and detection
                    settings.
                  </p>
                </div>
                <button
                  aria-label="Download HTML evidence report"
                  disabled={!result || reportBusy}
                  onClick={() => exportReport(true)}
                >
                  <Download size={18} />
                </button>
              </div>
            </aside>
          </div>
          <footer className="app-footer">
            <span>
              <Aperture size={14} /> TERRALENS <b>/</b> Evidence-led geospatial
              analysis
            </span>
            <span>
              <Save size={12} />
              {saved}
              <i />
              All image processing stays in your browser
            </span>
          </footer>
        </main>
      </div>
      {confirmation && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="replace-title"
          >
            <header>
              <div>
                <span className="eyebrow">PRESERVE YOUR EVIDENCE</span>
                <h2 id="replace-title">Start a fresh analysis?</h2>
              </div>
            </header>
            <p>
              This replaces the current detections, notes and review decisions.
              Download the current report first if you need to retain a record.
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
                Start fresh analysis
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
            aria-label="Evidence report preview"
          >
            <header>
              <strong>
                <FileText size={17} /> Evidence report
              </strong>
              <div>
                <button
                  className="secondary"
                  onClick={() => exportReport(true)}
                >
                  <Download size={14} /> Download HTML
                </button>
                <button
                  className="icon-button"
                  aria-label="Close report preview"
                  onClick={() => setReportContent("")}
                >
                  <X size={20} />
                </button>
              </div>
            </header>
            <iframe
              title="TerraLens printable evidence report"
              srcDoc={reportContent}
            />
          </section>
        </div>
      )}
      {upload && (
        <UploadDialog
          onClose={() => setUpload(false)}
          onLoad={(p) => {
            setUpload(false);
            replaceReviewed(() => {
              cancelProcessing();
              setPair(p);
              setTitle(p.scene.title);
              setResult(null);
              setReviews({});
              setSelected(null);
              setAligned(false);
              setThreshold(35);
              setMinArea(100);
              setUpload(false);
              setTab("imagery");
              log("Uploaded compatible image pair");
            });
          }}
        />
      )}
      {sources && (
        <div className="modal-backdrop" onClick={() => setSources(false)}>
          <section
            className="modal sources-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sources-title"
            onClick={(e) => e.stopPropagation()}
          >
            <header>
              <div>
                <span className="eyebrow">TRANSPARENCY & PROVENANCE</span>
                <h2 id="sources-title">Evidence you can trace</h2>
              </div>
              <button
                className="icon-button"
                aria-label="Close sources"
                onClick={() => setSources(false)}
              >
                <X size={20} />
              </button>
            </header>
            <h3>Detection method</h3>
            <p>
              Images are compared on a common processing grid, capped at 768
              pixels on the longest edge. A 3 × 3 mean filter reduces pixel
              noise. Mean absolute RGB differences are thresholded, grouped by
              four-connected neighbors, and filtered by changed-pixel count.
            </p>
            <p>
              No automatic cloud removal, image registration, semantic
              classification or accuracy score is applied. Sensitivity changes
              the numeric RGB threshold; it is not confidence. Geographic area
              is not estimated.
            </p>
            <h3>{pair?.scene.title}</h3>
            <p>{pair?.scene.description}</p>
            <p>
              <strong>Alignment:</strong> {pair?.scene.alignment}
            </p>
            <ul>
              {pair?.scene.caveats.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <p>
              <strong>Geography:</strong>{" "}
              {pair?.scene.bbox
                ? `North-up EPSG:4326 bounds [${pair.scene.bbox.join(", ")}]. Pixel centers are linearly interpolated on this geographic grid. Source geolocation has not been independently surveyed.`
                : "No geographic extent supplied."}
            </p>
            <p>{pair?.scene.attribution}</p>
            <div className="source-links">
              {pair?.scene.article && (
                <a href={pair.scene.article} target="_blank" rel="noreferrer">
                  NASA event context
                  <ArrowUpRight size={14} />
                </a>
              )}
              <a href="/imagery/manifest.json" target="_blank" rel="noreferrer">
                Full source manifest
                <ArrowUpRight size={14} />
              </a>
              <a
                href="/imagery/crop-candidates.json"
                target="_blank"
                rel="noreferrer"
              >
                Crop provenance
                <ArrowUpRight size={14} />
              </a>
            </div>
            <h3>Offline & privacy</h3>
            <p>
              Processing and saved reviews stay in this browser. The production
              application caches its assets and prepared imagery after the first
              successful online visit. Maps use bundled imagery. Source links
              require internet access. Browser storage can be cleared or
              evicted; download a report to keep a separate record.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
