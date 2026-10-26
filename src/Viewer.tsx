import { useId, useMemo, useRef, useState } from "react";
import { ZoomIn, ZoomOut, Maximize } from "lucide-react";
import { pixelToGeo } from "./engine.mjs";
import { maskData } from "./images";
import type { Pair, Result, Review } from "./types";

export default function Viewer({
  pair,
  result,
  reviews,
  selected,
  onSelect,
}: {
  pair: Pair;
  result: Result | null;
  reviews: Record<number, Review>;
  selected: number | null;
  onSelect: (id: number) => void;
}) {
  const [mode, setMode] = useState<
    "Compare" | "Side by Side" | "Before" | "After" | "Changes"
  >(result ? "Compare" : "Side by Side");
  const clipId = useId().replaceAll(":", "");
  const [split, setSplit] = useState(50);
  const [zoom, setZoom] = useState(1),
    [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{
    x: number;
    y: number;
    px: number;
    py: number;
    scale: number;
  } | null>(null);
  const mask = useMemo(() => (result ? maskData(result) : ""), [result]);
  const width = result?.width ?? pair.width,
    height = result?.height ?? pair.height;
  const roles = mode === "Side by Side" ? [0, 1] : [mode === "Before" ? 0 : 1];
  return (
    <div className="viewer-shell">
      <div className="viewer-toolbar">
        <div className="segmented" aria-label="Image view">
          {(
            ["Compare", "Side by Side", "Before", "After", "Changes"] as const
          ).map((m) => (
            <button
              key={m}
              aria-pressed={mode === m}
              disabled={m === "Changes" && !result}
              className={mode === m ? "active" : ""}
              onClick={() => setMode(m)}
            >
              {m}
            </button>
          ))}
        </div>
        <div className="zoom-controls">
          <button
            aria-label="Zoom out"
            disabled={zoom <= 1}
            onClick={() => setZoom((z) => Math.max(1, z - 0.25))}
          >
            <ZoomOut size={16} />
          </button>
          <span>{zoom.toFixed(2)}×</span>
          <button
            aria-label="Zoom in"
            disabled={zoom >= 5}
            onClick={() => setZoom((z) => Math.min(5, z + 0.25))}
          >
            <ZoomIn size={16} />
          </button>
          <button
            aria-label="Reset view"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
          >
            <Maximize size={16} />
          </button>
        </div>
      </div>
      <div
        className={"image-panes " + (roles.length === 2 ? "paired" : "single")}
      >
        {roles.map((i) => (
          <figure key={i} className="image-pane">
            <figcaption>
              <strong>
                {mode === "Compare"
                  ? "Before / After"
                  : i === 0
                    ? "Before"
                    : "After"}
                {mode === "Changes" ? " · detected changes" : ""}
              </strong>
              <span>
                {mode === "Compare"
                  ? `${pair.scene.dates[0] || "Undated"} / ${pair.scene.dates[1] || "Undated"}`
                  : pair.scene.dates[i] || "Date not supplied"}
              </span>
            </figcaption>
            <div
              className="image-stage"
              onPointerDown={(e) => {
                if ((e.target as Element).closest("[data-region]")) return;
                const bounds = e.currentTarget.getBoundingClientRect();
                drag.current = {
                  x: e.clientX,
                  y: e.clientY,
                  px: pan.x,
                  py: pan.y,
                  scale: Math.min(bounds.width / width, bounds.height / height),
                };
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (drag.current && zoom > 1) {
                  const d = drag.current;
                  setPan({
                    x: Math.max(
                      -width,
                      Math.min(width, d.px + (e.clientX - d.x) / d.scale),
                    ),
                    y: Math.max(
                      -height,
                      Math.min(height, d.py + (e.clientY - d.y) / d.scale),
                    ),
                  });
                }
              }}
              onPointerUp={() => (drag.current = null)}
              onPointerCancel={() => (drag.current = null)}
            >
              <svg
                viewBox={`0 0 ${width} ${height}`}
                aria-label={`${i === 0 ? "Before" : "After"} imagery`}
              >
                <g
                  transform={`translate(${width / 2 + pan.x} ${height / 2 + pan.y}) scale(${zoom}) translate(${-width / 2} ${-height / 2})`}
                >
                  <image
                    href={i === 0 ? pair.before : pair.after}
                    width={width}
                    height={height}
                  />
                  {mode === "Compare" && (
                    <>
                      <defs>
                        <clipPath id={clipId}>
                          <rect width={(width * split) / 100} height={height} />
                        </clipPath>
                      </defs>
                      <image
                        href={pair.before}
                        width={width}
                        height={height}
                        clipPath={`url(#${clipId})`}
                      />
                      <line
                        x1={(width * split) / 100}
                        x2={(width * split) / 100}
                        y1={0}
                        y2={height}
                        stroke="#d9e8b6"
                        strokeWidth={2}
                        vectorEffect="non-scaling-stroke"
                      />
                    </>
                  )}
                  {result && (
                    <>
                      {mode === "Changes" && (
                        <image
                          href={mask}
                          width={width}
                          height={height}
                          opacity={0.65}
                        />
                      )}
                      {result.regions
                        .filter((r) => mode === "Changes" || r.id === selected)
                        .map((r) => (
                          <g
                            key={r.id}
                            data-region={r.id}
                            role="button"
                            tabIndex={0}
                            aria-label={`Inspect region ${r.id}`}
                            onClick={() => onSelect(r.id)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                onSelect(r.id);
                              }
                            }}
                          >
                            <rect
                              x={r.bbox[0]}
                              y={r.bbox[1]}
                              width={r.bbox[2] - r.bbox[0]}
                              height={r.bbox[3] - r.bbox[1]}
                              fill="transparent"
                              stroke={
                                selected === r.id
                                  ? "#ffffff"
                                  : reviews[r.id]?.status === "rejected"
                                    ? "#94a3b8"
                                    : "#70b8ff"
                              }
                              strokeWidth={selected === r.id ? 2 : 1}
                              strokeDasharray={
                                reviews[r.id]?.status === "rejected"
                                  ? "4 3"
                                  : undefined
                              }
                              vectorEffect="non-scaling-stroke"
                            />
                          </g>
                        ))}
                    </>
                  )}
                </g>
              </svg>
              {pixelToGeo(0, 0, pair.width, pair.height, pair.scene.bbox) && (
                <div className="north-arrow">N ↑</div>
              )}
            </div>
            <div className="image-filename" title={pair.scene.files[i]?.file}>
              {pair.scene.files[i]?.file} · {pair.width} × {pair.height}
            </div>
          </figure>
        ))}
      </div>
      {mode === "Compare" && (
        <div className="comparison-control">
          <span>BEFORE</span>
          <input
            aria-label="Before and after comparison slider"
            type="range"
            min={0}
            max={100}
            value={split}
            onChange={(e) => setSplit(Number(e.target.value))}
          />
          <span>AFTER</span>
        </div>
      )}
      <div className="viewer-caption">
        <span>
          {mode === "Changes"
            ? "Calculated visual differences; not confirmed terrain changes."
            : "Matched image geometry · synchronized zoom and pan"}
        </span>
        <span>Drag to pan when zoomed</span>
      </div>
    </div>
  );
}
