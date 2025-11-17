// harper-lint.js
// Lightweight wrapper: spawns a Worker (single instance) and returns analyzeWithHarper(text)

let worker = null;
let nextId = 1;
const pending = new Map();

function ensureWorker() {
  if (worker) return worker;

  // create worker from extension files
  const url = chrome.runtime.getURL("src/engines/harper/harper-worker.js");
  worker = new Worker(url);

  worker.onmessage = (ev) => {
    const msg = ev.data;
    // forward console logs from worker if any
    if (msg && msg.__log) {
      console.log("HarperWorker:", ...msg.__log);
      return;
    }
    const id = msg.id;
    if (msg.type === "HARPER_RESULT" && pending.has(id)) {
      pending.get(id).resolve(msg.payload);
      pending.delete(id);
    } else if (msg.type === "ERROR" && pending.has(id)) {
      pending.get(id).reject(new Error(msg.error || "Harper error"));
      pending.delete(id);
    } else {
      // no id: global message; just log
      if (msg.type === "ERROR") console.error("HarperWorker ERROR:", msg.error);
    }
  };

  worker.onerror = (err) => {
    console.error("Harper worker error:", err);
    // reject all pending
    for (const { reject } of pending.values()) reject(err);
    pending.clear();
  };

  return worker;
}

export function analyzeWithHarper(text, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    try {
      ensureWorker();
      const id = nextId++;
      pending.set(id, { resolve, reject });

      worker.postMessage({ id, text });

      // timeout safety
      const t = setTimeout(() => {
        if (pending.has(id)) {
          pending.get(id).reject(new Error("Harper timeout"));
          pending.delete(id);
        }
      }, timeoutMs);

      // wrap resolve/reject to clear timeout
      const origResolve = resolve;
      const origReject = reject;
      pending.set(id, {
        resolve: (payload) => { clearTimeout(t); origResolve(payload); },
        reject: (err) => { clearTimeout(t); origReject(err); }
      });
    } catch (err) {
      reject(err);
    }
  });
}
