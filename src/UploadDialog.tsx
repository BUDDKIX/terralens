import { useEffect, useRef, useState } from "react";
import { Upload, X, ArrowUpRight } from "lucide-react";
import { fileData, validatePair } from "./images";
import { pixelToGeo } from "./engine.mjs";
import type { Pair, Bounds } from "./types";
export default function UploadDialog({
  onClose,
  onLoad,
  inline = false,
}: {
  inline?: boolean;
  onClose: () => void;
  onLoad: (p: Pair) => void;
}) {
  const [before, setBefore] = useState<File | null>(null),
    [after, setAfter] = useState<File | null>(null),
    [title, setTitle] = useState("Uploaded imagery"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [geo, setGeo] = useState(false),
    [bounds, setBounds] = useState(["", "", "", ""]),
    [dates, setDates] = useState(["", ""]);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!before || !after) return;
    setBusy(true);
    setError("");
    try {
      const [a, b] = await Promise.all([fileData(before), fileData(after)]);
      const dimensions = await validatePair(a, b);
      if (!active.current) return;
      let bbox: Bounds | null = null;
      if (geo) {
        if (bounds.some((v) => !v.trim()))
          throw new Error("Supply all four bounds, or disable georeferencing.");
        bbox = bounds.map(Number) as Bounds;
        if (!pixelToGeo(0, 0, dimensions.width, dimensions.height, bbox))
          throw new Error(
            "Invalid bounds. Use west < east, south < north, and valid latitude/longitude.",
          );
      }
      onLoad({
        before: a,
        after: b,
        ...dimensions,
        scene: {
          id: "upload-" + Date.now(),
          title,
          location: geo
            ? "User-supplied geographic extent"
            : "Unreferenced imagery",
          dates,
          bbox,
          sensor: "User upload",
          color: "Rendered RGB",
          description:
            "User-supplied imagery. Source dates and geographic metadata are not independently verified.",
          caveats: [
            "Registration, sensor compatibility, and metadata must be checked by the analyst.",
          ],
          alignment:
            "User upload. No automatic registration performed. Analyst alignment inspection required.",
          attribution: "User-supplied imagery",
          files: [{ file: before.name }, { file: after.name }],
        },
      });
    } catch (e) {
      if (active.current)
        setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      if (active.current) setBusy(false);
    }
  }
  return (
    <div
      className={inline ? "inline-upload" : "modal-backdrop"}
      onClick={inline ? undefined : onClose}
    >
      <section
        className="modal"
        role={inline ? undefined : "dialog"}
        aria-modal={inline ? undefined : true}
        aria-labelledby="upload-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <div>
            <span className="eyebrow">NEW ANALYSIS</span>
            <h2 id="upload-title">Bring your own imagery</h2>
          </div>
          <button
            hidden={inline}
            className="icon-button"
            aria-label="Close upload"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        <p>
          Use two PNG, JPEG or WebP images of the same area, aligned to the same
          pixel grid. Maximum 15 MB each and 20 megapixels.
        </p>
        <form onSubmit={submit}>
          <label>
            Analysis title
            <input
              value={title}
              required
              maxLength={120}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <div className="form-grid">
            {["Before image", "After image"].map((s, i) => (
              <label
                className="file-field"
                key={s}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "copy";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!busy)
                    (i === 0 ? setBefore : setAfter)(
                      e.dataTransfer.files[0] ?? null,
                    );
                }}
              >
                <Upload size={20} />
                <strong>{s}</strong>
                <span>
                  {(i === 0 ? before : after)?.name ||
                    "Drop or choose PNG / JPEG / WebP"}
                </span>
                <input
                  aria-label={s}
                  disabled={busy}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) =>
                    (i === 0 ? setBefore : setAfter)(
                      e.target.files?.[0] ?? null,
                    )
                  }
                />
              </label>
            ))}
          </div>
          <div className="form-grid">
            {["Before date (optional)", "After date (optional)"].map((s, i) => (
              <label key={s}>
                {s}
                <input
                  type="date"
                  value={dates[i]}
                  onChange={(e) =>
                    setDates((d) =>
                      d.map((v, j) => (i === j ? e.target.value : v)),
                    )
                  }
                />
              </label>
            ))}
          </div>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={geo}
              onChange={(e) => setGeo(e.target.checked)}
            />{" "}
            Supply known north-up EPSG:4326 bounds
          </label>
          {geo && (
            <>
              <p className="fineprint">
                Only use bounds from your source metadata. Rotated, perspective,
                or other-projection imagery must be reprojected first.
              </p>
              <div className="bounds-grid">
                {["West", "South", "East", "North"].map((s, i) => (
                  <label key={s}>
                    {s}
                    <input
                      type="number"
                      step="any"
                      required
                      value={bounds[i]}
                      onChange={(e) =>
                        setBounds((b) =>
                          b.map((v, j) => (i === j ? e.target.value : v)),
                        )
                      }
                    />
                  </label>
                ))}
              </div>
            </>
          )}
          {error && (
            <div className="error-box" role="alert">
              {error}
            </div>
          )}
          <footer>
            <button
              type="button"
              hidden={inline}
              className="secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button className="primary" disabled={busy || !before || !after}>
              {busy ? "Checking images…" : "Open comparison"}
              <ArrowUpRight size={16} />
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
