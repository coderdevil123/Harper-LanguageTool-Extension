// background.js - Manifest V3 Service Worker
import { analyzeWithHarper } from "../engines/harper/harper-lint.js";
import { mergeResults } from "../engines/merge/merge-results.js";

async function analyzeText(text) {
    const lt = await checkWithLanguageTool(text);
    const harper = await analyzeWithHarper(text);

    return mergeResults(lt, harper);
}

console.log("Background service worker loaded 🚀");

// store last results per tabId
const tabResults = new Map();

// Listen for incoming messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const tabId = sender?.tab?.id;

  if (request.type === "USER_TEXT") {
    analyzeText(request.payload.text)
      .then((mergedOutput) => {
        // store results for this tab
        if (tabId) tabResults.set(tabId, mergedOutput);

        sendResponse({ success: true, data: mergedOutput });

        // Send results back to content-script for highlighting
        if (tabId) {
          chrome.tabs.sendMessage(tabId, {
            type: "COMBINED_RESULTS",
            payload: mergedOutput
          }).catch(() => {});
        }
      })
      .catch((err) => {
        console.error("Analysis error:", err);
        sendResponse({ success: false, error: err.toString() });
      });

    return true; // async response
  }

  // UI bubble asks for suggestions for currently clicked highlight
  if (request.type === "GET_SUGGESTIONS") {
    // payload.raw contains the encoded issue from span attribute
    try {
      const raw = request.payload.raw;
      const issue = raw ? JSON.parse(decodeURIComponent(raw)) : null;

      // Build suggestion list: if issue came from LanguageTool, check issue.replacements
      let suggestions = [];
      if (issue && issue.replacements && Array.isArray(issue.replacements)) {
        suggestions = issue.replacements.map(r => r.value);
      } else if (issue && issue.suggestions && Array.isArray(issue.suggestions)) {
        suggestions = issue.suggestions;
      }

      // Send back suggestions (background may choose to fetch more context)
      sendResponse({ success: true, suggestions });
    } catch (err) {
      console.error("GET_SUGGESTIONS error:", err);
      sendResponse({ success: false, suggestions: [] });
    }

    return true;
  }

  // Apply a suggestion: content script will fetch the last selected highlight and replace text
  if (request.type === "APPLY_SUGGESTION") {
    // This message originates from popup/bubble -> background -> forward to content script
    // We forward the payload directly to the active tab
    if (tabId) {
      chrome.tabs.sendMessage(tabId, {
        type: "APPLY_SUGGESTION",
        payload: request.payload
      }).catch(() => {});
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: "No active tab" });
    }
    return true;
  }
});

// main analysis (calls LT; later add Harper)
async function analyzeText(text) {
  const ltResult = await checkWithLanguageTool(text);

  const harperResult = {
    tone: [],
    terminology: []
  };

  return {
    grammar: ltResult,
    harper: harperResult
  };
}

// Call LanguageTool
async function checkWithLanguageTool(text) {
  try {
    const response = await fetch("http://localhost:8081/v2/check", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ text, language: "en-US" })
    });
    const data = await response.json();
    return data.matches || [];
  } catch (err) {
    console.error("LanguageTool API error:", err);
    return [];
  }
}
