/** User-entered provenance is validated for format, never authenticated. */
export function safeSourceURL(value) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value.trim());
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : "";
  } catch { return ""; }
}
export function validateMetadata({ dates = ["", ""], organization = "", attribution = "", urls = ["", ""] } = {}) {
  if (dates.length !== 2 || urls.length !== 2) throw new Error("Supply metadata for both images.");
  for (const date of dates) {
    if (!date) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Use acquisition dates in YYYY-MM-DD format.");
    const parsed = new Date(date + "T00:00:00Z");
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw new Error("Acquisition date is not a valid calendar date.");
  }
  const cleanURLs = urls.map((url) => {
    if (!url.trim()) return "";
    const safe = safeSourceURL(url);
    if (!safe) throw new Error("Source URLs must be complete HTTP or HTTPS links without credentials.");
    return safe;
  });
  return { dates: [...dates], organization: organization.trim().slice(0, 200), attribution: attribution.trim().slice(0, 1000), urls: cleanURLs };
}
