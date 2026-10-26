import test from "node:test";
import assert from "node:assert/strict";
import { createGeoJSON } from "../src/export.ts";

const result = {
  width: 10,
  height: 10,
  regions: [
    { id: 3, centroid: [4.5, 4.5], bbox: [2, 3, 8, 9], meanDifference: 48.5 },
  ],
};
test("GeoJSON uses longitude/latitude, exact region edges, and analyst properties", () => {
  const collection = createGeoJSON(
    result,
    {
      3: {
        category: "Forward Staging Area",
        status: "approved",
        notes: "Analyst interpretation",
      },
    },
    [10, 20, 30, 40],
  );
  assert.equal(collection.type, "FeatureCollection");
  const feature = collection.features[0];
  assert.deepEqual(feature.geometry, { type: "Point", coordinates: [20, 30] });
  assert.deepEqual(feature.properties.bbox, [14, 22, 26, 34]);
  assert.equal(feature.properties.reviewStatus, "approved");
  assert.equal(feature.properties.category, "Forward Staging Area");
  assert.equal(feature.properties.meanDifference, 48.5);
});
test("GeoJSON rejects unavailable geography and supports empty detections", () => {
  assert.throws(() => createGeoJSON(result, {}, null), /geographic bounds/);
  assert.throws(
    () => createGeoJSON(result, {}, [30, 20, 10, 40]),
    /geographic bounds/,
  );
  assert.deepEqual(
    createGeoJSON({ ...result, regions: [] }, {}, [10, 20, 30, 40]).features,
    [],
  );
  assert.equal(
    createGeoJSON(result, {}, [10, 20, 30, 40]).features[0].properties
      .reviewStatus,
    "unreviewed",
  );
});
