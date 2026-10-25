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
  useEffect(() => {
    let active = true;
    setCrops([]);
    Promise.all([
      cropData(pair.before, region, result),
      cropData(pair.after, region, result),
    ]).then((v) => {
      if (active) setCrops(v);
    });
    return () => {
      active = false;
    };
  }, [pair, result, region]);
  return (
    <div className="evidence-crops">
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
