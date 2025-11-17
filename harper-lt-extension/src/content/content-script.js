import { highlightIssues } from "./highlighter.js";
import { showBubble, removeBubble } from "./inject-ui.js";

console.log("Harper-LT: content script loaded");

// Track last clicked highlight
let lastClickedIssue = null;

// Receive results from background → highlight them
chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "COMBINED_RESULTS") {
        highlightIssues(msg.payload);
    }

    // Receive suggestion list for clicked highlight
    if (msg.type === "SHOW_SUGGESTIONS") {
        const { text, suggestions, position } = msg.payload;
        showBubble(text, suggestions, position.x, position.y);
    }

    // Apply suggestion from background
    if (msg.type === "APPLY_SUGGESTION") {
        applySuggestion(msg.payload);
    }
});

// When user clicks a highlight
document.addEventListener("click", (event) => {
    const el = event.target;

    if (el.classList.contains("hlt-highlight")) {
        lastClickedIssue = JSON.parse(decodeURIComponent(el.dataset.hltPayload || "{}"));

        const rect = el.getBoundingClientRect();

        chrome.runtime.sendMessage({
            type: "GET_SUGGESTIONS",
            payload: { issue: lastClickedIssue, position: { x: rect.left, y: rect.top } }
        });

    } else {
        removeBubble();
    }
});

// Replace text after suggestion click
function applySuggestion({ replacement }) {
    if (!lastClickedIssue) return;

    const el = document.querySelector(`span[data-hlt-id="${lastClickedIssue.id}"]`);
    if (!el) return;

    el.outerText = replacement; // safe replacement
}
