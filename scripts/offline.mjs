import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
function files(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) =>
      e.isDirectory()
        ? files(path.join(dir, e.name))
        : [path.join(dir, e.name)],
    );
}
const entries = files("dist").filter((f) => !f.endsWith("sw.js"));
const hash = crypto.createHash("sha256");
for (const f of entries) hash.update(fs.readFileSync(f));
const version = "terralens-" + hash.digest("hex").slice(0, 12),
  assets = entries.map(
    (f) => "/" + path.relative("dist", f).replaceAll("\\", "/"),
  );
fs.writeFileSync(
  "dist/sw.js",
  `const CACHE=${JSON.stringify(version)},ASSETS=${JSON.stringify(["/", ...assets])};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('terralens-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin)return;if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));}return r;}).catch(()=>caches.match(e.request).then(r=>r||caches.match('/'))));return;}e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));});`,
);
console.log("Offline cache:", version, assets.length, "assets");
