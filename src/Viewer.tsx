import { useState, useMemo, useRef } from "react";
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  Layers,
  SplitSquareHorizontal,
  Image as ImageIcon,
} from "lucide-react";
import type { Pair, Result, Review } from "./types";
import { maskData } from "./images";
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
  const [mode, setMode] = useState<"compare" | "after" | "before">("compare"),
    [slider, setSlider] = useState(50),
    [overlays, setOverlays] = useState(true),
    [zoom, setZoom] = useState(1),
    [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(
    null,
  );
  const mask = useMemo(() => (result ? maskData(result) : ""), [result]);
  const w = result?.width ?? pair.width,
    h = result?.height ?? pair.height;
  return (
    <div className="viewer-shell">
      <div className="viewer-toolbar">
        <div className="segmented">
          {(["compare", "before", "after"] as const).map((m) => (
            <button
              key={m}
              className={mode === m ? "active" : ""}
              onClick={() => setMode(m)}
            >
              {m === "compare" ? (
                <SplitSquareHorizontal size={14} />
              ) : (
                <ImageIcon size={14} />
              )}
              <span>
                {m === "compare"
                  ? "Compare"
                  : m === "before"
                    ? "Before"
                    : "After"}
              </span>
            </button>
          ))}
        </div>
        <button
          className={"small-button " + (overlays ? "toggled" : "")}
          onClick={() => setOverlays(!overlays)}
          aria-pressed={overlays}
        >
          <Layers size={14} /> Changes
        </button>
      </div>
      <div
        className="image-stage"
        onWheel={(e) =>
          setZoom((z) =>
            Math.max(1, Math.min(5, z + (e.deltaY < 0 ? 0.15 : -0.15))),
          )
        }
        onPointerDown={(e) => {
          if ((e.target as Element).closest("[data-region]")) return;
          drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (drag.current && zoom > 1)
            setPan({
              x: drag.current.px + e.clientX - drag.current.x,
              y: drag.current.py + e.clientY - drag.current.y,
            });
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      >
        <svg
          className="imagery-svg"
          viewBox={`0 0 ${w} ${h}`}
          style={{
            transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
          }}
          role="img"
          aria-label="Satellite image comparison with selectable candidate change regions"
        >
          <defs>
            <clipPath id="before-clip">
              <rect width={(w * slider) / 100} height={h} />
            </clipPath>
          </defs>
          <image
            href={mode === "before" ? pair.before : pair.after}
            width={w}
            height={h}
          />
          {mode === "compare" && (
            <image
              href={pair.before}
              width={w}
              height={h}
              clipPath="url(#before-clip)"
            />
          )}
          {overlays && result && (
            <>
              <image href={mask} width={w} height={h} opacity={0.58} />
              {result.regions.map((r) => {
                const [x0, y0, x1, y1] = r.bbox,
                  status = reviews[r.id]?.status;
                return (
                  <g
                    key={r.id}
                    data-region={r.id}
                    tabIndex={0}
                    role="button"
                    aria-label={`Inspect region ${r.id}`}
                    onClick={() => onSelect(r.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onSelect(r.id);
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    <rect
                      x={x0}
                      y={y0}
                      width={x1 - x0}
                      height={y1 - y0}
                      fill="transparent"
                      stroke={
                        selected === r.id
                          ? "#fff"
                          : status === "approved"
                            ? "#70d5af"
                            : status === "rejected"
                              ? "#86938d"
                              : "#f0bc62"
                      }
                      strokeWidth={selected === r.id ? 2 : 1}
                      strokeDasharray={
                        status === "rejected" ? "4 3" : undefined
                      }
                      vectorEffect="non-scaling-stroke"
                    />
                    {(selected === r.id || r.area > 2000) && (
                      <>
                        <rect
                          x={x0}
                          y={Math.max(0, y0 - 18)}
                          width={42}
                          height={18}
                          fill={selected === r.id ? "#edf4ef" : "#19251e"}
                        />
                        <text
                          x={x0 + 5}
                          y={Math.max(0, y0 - 18) + 13}
                          fontSize={11}
                          fontFamily="monospace"
                          fill={selected === r.id ? "#17231d" : "#edc77e"}
                        >
                          {String(r.id).padStart(3, "0")}
                        </text>
                      </>
                    )}
                  </g>
                );
              })}
            </>
          )}
          {mode === "compare" && (
            <line
              x1={(w * slider) / 100}
              x2={(w * slider) / 100}
              y1={0}
              y2={h}
              stroke="#f3f5ef"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          )}
        </svg>
        <div className="image-tag left">
          {mode === "after" ? "AFTER" : "BEFORE"}{" "}
          <span>
            {pair.scene.dates[mode === "after" ? 1 : 0] || "Date unknown"}
          </span>
        </div>
        {mode === "compare" && (
          <div className="image-tag right">
            AFTER <span>{pair.scene.dates[1] || "Date unknown"}</span>
          </div>
        )}
        <div className="north-arrow">
          N<span>↑</span>
        </div>
        <div className="zoom-controls">
          <button
            aria-label="Zoom in"
            onClick={() => setZoom((z) => Math.min(5, z + 0.25))}
          >
            <ZoomIn size={17} />
          </button>
          <button
            aria-label="Zoom out"
            onClick={() => setZoom((z) => Math.max(1, z - 0.25))}
          >
            <ZoomOut size={17} />
          </button>
          <button
            aria-label="Reset view"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
          >
            <Maximize size={17} />
          </button>
        </div>
        <div className="image-credit">{pair.scene.attribution}</div>
      </div>
      {mode === "compare" && (
        <div className="comparison-control">
          <span>BEFORE</span>
          <input
            aria-label="Before and after comparison"
            type="range"
            min="0"
            max="100"
            value={slider}
            onChange={(e) => setSlider(Number(e.target.value))}
          />
          <span>AFTER</span>
        </div>
      )}
      <div className="viewer-caption">
        <span>
          <i className="legend-dot amber" />
          Candidate visual change
        </span>
        <span>
          {zoom.toFixed(2)}× <b>·</b> Drag to pan when zoomed
        </span>
      </div>
    </div>
  );
}
