import { useState, useEffect } from "react";
import { cropData } from "./images";
import type { Pair, Result, Region } from "./types";
export default function Evidence({
  pair,
  result,
  region,
}: {
  pair: Pair;
  result: Result;
  region: Region;
}) {
  const [crops, setCrops] = useState<string[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setCrops([]);
    setError("");
    Promise.all([
      cropData(pair.before, region, result),
      cropData(pair.after, region, result),
    ])
      .then((v) => {
        if (active) setCrops(v);
      })
      .catch(() => {
        if (active) setError("Evidence crops could not be decoded.");
      });
    return () => {
      active = false;
    };
  }, [pair, result, region]);
  return (
    <div className="evidence-crops">
      {error && <p role="alert">{error}</p>}
      {["Before", "After"].map((label, i) => (
        <figure key={label}>
          {crops[i] ? (
            <img
              src={crops[i]}
              alt={`${label} evidence for observation ${region.id}`}
            />
          ) : (
            <div className="crop-loading" />
          )}
          <figcaption>
            {label}
            <span>{pair.scene.dates[i] || "Unknown date"}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
