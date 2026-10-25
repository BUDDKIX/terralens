import type { Saved } from "./types";
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("terralens", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("analyses");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export async function saveAnalysis(value: Saved) {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("analyses", "readwrite");
      tx.objectStore("analyses").put(value, "current");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export async function loadAnalysis(): Promise<Saved | null> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const req = db
        .transaction("analyses")
        .objectStore("analyses")
        .get("current");
      req.onsuccess = () =>
        resolve(req.result?.version === 1 ? req.result : null);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}
