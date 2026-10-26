export type Bounds = [number, number, number, number];
export type Region = {
  id: number;
  area: number;
  bbox: number[];
  centroid: number[];
  meanDifference: number;
};
export type Review = {
  status: "unreviewed" | "approved" | "rejected";
  category: string;
  notes: string;
};
export type Result = {
  // Optional for analyses saved before automated findings were introduced.
  findings?: ReturnType<typeof import("./findings.mjs").createFindings>;
  reliability?: ReturnType<typeof import("./reliability.mjs").auditThresholds>;
  quality?: ReturnType<typeof import("./quality.mjs").assessQuality>;
  timing?: {
    detectorMs: number;
    auditMs: number;
    totalMs: number;
    qualityMs?: number;
  };
  width: number;
  height: number;
  threshold: number;
  minArea: number;
  smoothingRadius?: number;
  regions: Region[];
  labels: Int32Array;
  validPixels: number;
  changedPixels: number;
  changedPercent: number;
  processingMs: number;
  runId: string;
  createdAt: string;
};
export type Scene = {
  id: string;
  title: string;
  location: string;
  dates: string[];
  bbox: Bounds | null;
  sensor: string;
  color: string;
  description: string;
  caveats: string[];
  alignment: string;
  attribution: string;
  sourceOrganization?: string;
  metadataOrigin?: "user";
  article?: string;
  licenseUrl?: string;
  files: { file: string; sourceUrl?: string }[];
};
export type Pair = {
  before: string;
  after: string;
  width: number;
  height: number;
  scene: Scene;
};
export type Saved = {
  version: 1;
  pair: Pair;
  result: Result | null;
  reviews: Record<number, Review>;
  threshold: number;
  minArea: number;
  title: string;
  aligned: boolean;
  savedAt: string;
};
export const emptyReview: Review = {
  status: "unreviewed",
  category: "Unclassified",
  notes: "",
};
