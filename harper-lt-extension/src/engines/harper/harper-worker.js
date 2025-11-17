// harper-worker.js
// Web Worker that loads Harper (WASM/JS) and performs lint(text).
// This file is loaded via new Worker(chrome.runtime.getURL(...))

// NOTE: we attempt to load Harper from unpkg CDN (fallbacks) so you don't need to prebuild WASM during dev.
// In production you may bundle the harper WASM + JS with your build and reference relative path.

self.console = { log: (...a) => postMessage({ __log: a }) }; // forward logs optionally to main thread

let HarperInstance = null;
let initPromise = null;

async function loadHarper() {
  if (HarperInstance) return HarperInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // Try CDN first (quick dev). Replace with local bundled file in prod if needed.
      importScripts("https://unpkg.com/@harperjs/core/dist/harper.umd.js");
      // The UMD exposes `Harper` global (verify with package - adjust if different)
      if (typeof Harper === "undefined" && typeof self.Harper === "undefined") {
        throw new Error("Harper global not found after importScripts.");
      }
      const H = self.Harper || Harper;

      // Some Harper builds require async init
      if (H && typeof H.init === "function") {
        HarperInstance = await H.init();
      } else if (H && typeof H.lint === "function") {
        // already ready form
        HarperInstance = H;
      } else {
        throw new Error("Harper did not expose expected API.");
      }

      return HarperInstance;
    } catch (err) {
      postMessage({ type: "ERROR", error: err.toString() });
      throw err;
    }
  })();

  return initPromise;
}

onmessage = async (ev) => {
  const { id, text } = ev.data || {};
  if (!text) {
    postMessage({ id, type: "HARPER_RESULT", payload: { tone: [], terminology: [] } });
    return;
  }

  try {
    const H = await loadHarper();
    // Harper's API shape may vary; adapt if necessary. Here we try `lint(text)` or `check(text)`
    let res = null;
    if (typeof H.lint === "function") {
      res = await H.lint(text);
    } else if (typeof H.check === "function") {
      res = await H.check(text);
    } else {
      res = {};
    }

    // Normalize output: ensure tone[] and terminology[] exist
    const tone = (res.tone && Array.isArray(res.tone)) ? res.tone : [];
    const terminology = (res.terminology && Array.isArray(res.terminology)) ? res.terminology : [];

    postMessage({ id, type: "HARPER_RESULT", payload: { tone, terminology } });
  } catch (err) {
    postMessage({ id, type: "ERROR", error: err.toString() });
  }
};
