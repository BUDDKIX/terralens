import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPinOff } from "lucide-react";
import { pixelToGeo } from "./engine.mjs";
import type { Pair, Result, Review } from "./types";
export default function GeoMap({
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
  const el = useRef<HTMLDivElement>(null),
    map = useRef<L.Map | null>(null),
    markers = useRef<L.LayerGroup | null>(null),
    click = useRef(onSelect);
  click.current = onSelect;
  useEffect(() => {
    if (
      !el.current ||
      !pair.scene.bbox ||
      !pixelToGeo(0, 0, pair.width, pair.height, pair.scene.bbox)
    )
      return;
    const [west, south, east, north] = pair.scene.bbox;
    const m = L.map(el.current, {
      crs: L.CRS.EPSG4326,
      attributionControl: true,
      scrollWheelZoom: false,
      minZoom: 1,
      maxZoom: 16,
    });
    map.current = m;
    const bounds: L.LatLngBoundsExpression = [
      [south, west],
      [north, east],
    ];
    L.imageOverlay(pair.after, bounds).addTo(m);
    L.rectangle(bounds, { color: "#b8c99b", weight: 1, fill: false }).addTo(m);
    m.fitBounds(bounds);
    // Match the scene provenance; user uploads must not inherit NASA credit.
    // addAttribution accepts HTML, so encode metadata before passing it to Leaflet.
    const attribution = pair.scene.attribution.replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[character]!,
    );
    m.attributionControl.addAttribution(`${attribution} · EPSG:4326`);
    markers.current = L.layerGroup().addTo(m);
    const observer = new ResizeObserver(() => {
      m.invalidateSize();
    });
    observer.observe(el.current);
    return () => {
      observer.disconnect();
      m.remove();
      map.current = null;
    };
  }, [pair]);
  useEffect(() => {
    const group = markers.current;
    if (!group) return;
    group.clearLayers();
    if (!result || !pair.scene.bbox) return;
    for (const r of result.regions) {
      const geo = pixelToGeo(
        r.centroid[0],
        r.centroid[1],
        result.width,
        result.height,
        pair.scene.bbox,
      );
      if (!geo) continue;
      const status = reviews[r.id]?.status ?? "unreviewed";
      const marker = L.circleMarker([geo.lat, geo.lng], {
        radius: selected === r.id ? 7 : 4,
        color:
          selected === r.id
            ? "#ffffff"
            : status === "approved"
              ? "#79d6ad"
              : status === "rejected"
                ? "#82908d"
                : "#efb956",
        fillOpacity: 0.8,
        weight: 1.5,
      }).addTo(group);
      marker.bindTooltip(`Region ${String(r.id).padStart(3, "0")} · ${status}`);
      marker.on("click", () => click.current(r.id));
    }
  }, [result, reviews, selected, pair]);
  if (
    !pair.scene.bbox ||
    !pixelToGeo(0, 0, pair.width, pair.height, pair.scene.bbox)
  )
    return (
      <div className="map-unavailable">
        <MapPinOff size={25} />
        <strong>Geography unavailable</strong>
        <p>
          Valid geographic bounds are unavailable. Findings use image
          coordinates.
        </p>
      </div>
    );
  return (
    <>
      <div
        className="geo-map"
        ref={el}
        aria-label="Georeferenced satellite map with observation markers"
      />
      <div className="map-caption">
        Image-backed map · WGS 84 <span>Scroll disabled · use + / −</span>
      </div>
    </>
  );
}
