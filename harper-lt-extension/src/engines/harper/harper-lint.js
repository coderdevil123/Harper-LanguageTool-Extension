// -------------------------------------------------------
// harper-lint.js
// Wrapper for Harper Web Worker → returns tone & terminology
// -------------------------------------------------------

let harperWorker = null;

// Initialize worker
export function initHarperWorker() {
    if (!harperWorker) {
        harperWorker = new Worker(chrome.runtime.getURL("src/engines/harper/harper-worker.js"));
        console.log("Harper Worker initialized 🧠🔥");
    }
}

// Main lint function
export function analyzeWithHarper(text) {
    return new Promise((resolve) => {

        initHarperWorker();

        const handleMessage = (event) => {
            if (event.data.type === "HARPER_RESULT") {
                resolve(event.data.payload);
                harperWorker.removeEventListener("message", handleMessage);
            }
        };

        harperWorker.addEventListener("message", handleMessage);

        harperWorker.postMessage({ text });
    });
}
