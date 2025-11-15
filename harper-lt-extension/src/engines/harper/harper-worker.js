// harper-worker.js
// Load Harper WASM or harper.js UMD if available

try {
  importScripts("https://unpkg.com/@harperjs/core/dist/harper.umd.js");
} catch (e) {
  // fallback or log
  console.warn("Could not load harper UMD via importScripts:", e);
}

let harperInstance = null;

onmessage = async (event) => {
  const { text } = event.data;
  try {
    if (!harperInstance) {
      if (typeof Harper !== "undefined" && Harper.init) {
        harperInstance = await Harper.init();
      } else {
        postMessage({ type: "HARPER_ERROR", error: "Harper not available" });
        return;
      }
    }

    const results = await harperInstance.lint(text);
    postMessage({ type: "HARPER_RESULT", payload: { tone: results.tone || [], terminology: results.terminology || [] } });
  } catch (err) {
    postMessage({ type: "HARPER_ERROR", error: err.toString() });
  }
};
