// Deterministic service-worker harness. This is not a browser/PWA certification.
// Run after npm run build. It verifies the actual generated precache and fetch fallback.
import fs from "node:fs/promises";
import vm from "node:vm";
import assert from "node:assert/strict";
import path from "node:path";

const origin = "https://terralens.test",
  listeners = new Map(),
  stores = new Map();
let offline = false;
const key = (request) =>
  new URL(typeof request === "string" ? request : request.url, origin).href;
const fetch = async (request) => {
  if (offline) throw new TypeError("Network unavailable in offline harness");
  const pathname = new URL(key(request)).pathname;
  const local = path.join(
    "dist",
    pathname === "/" ? "index.html" : decodeURIComponent(pathname),
  );
  return new Response(await fs.readFile(local));
};
const caches = {
  async open(name) {
    if (!stores.has(name)) stores.set(name, new Map());
    const data = stores.get(name);
    return {
      async addAll(assets) {
        for (const asset of assets) data.set(key(asset), await fetch(asset));
      },
      async put(request, response) {
        data.set(key(request), response);
      },
    };
  },
  async keys() {
    return [...stores.keys()];
  },
  async delete(name) {
    return stores.delete(name);
  },
  async match(request) {
    for (const data of stores.values()) {
      const response = data.get(key(request));
      if (response) return response.clone();
    }
  },
};
const context = {
  URL,
  fetch,
  caches,
  self: {
    location: { origin },
    addEventListener: (event, handler) => listeners.set(event, handler),
    skipWaiting: async () => {},
    clients: { claim: async () => {} },
  },
};
vm.runInNewContext(await fs.readFile("dist/sw.js", "utf8"), context);
for (const event of ["install", "activate"]) {
  let waiting;
  listeners.get(event)({ waitUntil: (p) => (waiting = p) });
  await waiting;
}
offline = true;
async function request(url, mode = "cors") {
  let response;
  listeners.get("fetch")({
    request: { url: origin + url, method: "GET", mode },
    respondWith: (p) => (response = p),
  });
  return response;
}
const page = await request("/", "navigate");
const html = await page.text();
assert.ok(html.includes('id="root"'));
const script = html.match(/src="([^"]+\.js)"/)[1];
assert.ok((await (await request(script)).arrayBuffer()).byteLength > 1000);
for (const file of [
  "manifest.json",
  "aral-before.jpg",
  "aral-after.jpg",
  "pakistan-focused-before.jpg",
  "pakistan-focused-after.jpg",
])
  assert.ok(
    (await (await request("/imagery/" + file)).arrayBuffer()).byteLength > 10,
  );
const manifest = JSON.parse(
  await (await request("/imagery/manifest.json")).text(),
);
assert.equal(manifest.scenes.length, 2);
console.log(
  "PASS: generated service worker installs all local assets and serves HTML, bundle, scene metadata and both image pairs with fetch offline in the harness.",
);
console.log(
  "Limit: browser service-worker registration, lifecycle, storage eviction, and real offline reload remain unverified.",
);
