// Generate standalone preliminary reports from recorded actual scenario analyses.
import fs from "node:fs";
import path from "node:path";
import { reportHTML } from "../src/report.mjs";
import { randomUUID } from "node:crypto";
const records = JSON.parse(
  fs.readFileSync("validation/measured-results.json", "utf8"),
);
for (const record of records) {
  const id = record.scene.id,
    holdout = id === "lake-mead-holdout";
  const images = record.scene.files.map((file) => {
    const filepath = path.join(
      holdout ? "validation" : "public/imagery",
      file.file,
    );
    return `data:image/${file.file.endsWith(".png") ? "png" : "jpeg"};base64,${fs.readFileSync(filepath).toString("base64")}`;
  });
  const overlay =
    "data:image/jpeg;base64," +
    fs.readFileSync(`validation/${id}-overlay.jpg`).toString("base64");
  const generatedAt = new Date().toISOString();
  const result = {
    ...record.result,
    runId: "validation-" + randomUUID(),
    createdAt: generatedAt,
  };
  const html = reportHTML({
    title: record.scene.title + " — preliminary validation run",
    scene: record.scene,
    result,
    reviews: {},
    before: images[0],
    after: images[1],
    overlay,
    evidence: [],
    generatedAt,
  });
  fs.writeFileSync(`validation/${id}-preliminary-report.html`, html);
  console.log(
    `Generated validation/${id}-preliminary-report.html from ${result.regions.length} measured regions, without analyst reviews.`,
  );
}
