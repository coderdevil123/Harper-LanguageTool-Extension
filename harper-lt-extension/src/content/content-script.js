// applySuggestion: receives payload { suggestionIndex }
let lastSuggestions = [];

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "COMBINED_RESULTS") {
    // save latest suggestions for use by GET_SUGGESTIONS if needed
    lastSuggestions = msg.payload || [];
    // highlight step (call your highlighter)
    // highlightIssues(msg.payload);
  }

  if (msg.type === "APPLY_SUGGESTION") {
    applySuggestion(msg.payload);
  }
});

// applySuggestion replaces the highlighted element's text with chosen suggestion
function applySuggestion(payload) {
  // payload.suggestionIndex refers to index in suggestions provided earlier
  // But we don't have a direct mapping between highlight and suggestion index in background
  // Strategy: activeElement or last clicked highlight will be focused; use document.activeElement or store lastClickedSpan
  const span = window.__hlt_last_clicked_span;
  if (!span) return;

  // Get stored issue payload:
  const raw = span.getAttribute("data-hlt-payload");
  const issue = raw ? JSON.parse(decodeURIComponent(raw)) : null;
  const replacements = (issue && (issue.replacements || issue.suggestions)) || [];
  const idx = payload.suggestionIndex ?? 0;
  const replacement = replacements[idx] ? (replacements[idx].value ?? replacements[idx]) : null;

  if (replacement) {
    // Replace span text
    span.textContent = replacement;
    span.classList.remove("hlt-highlight");
    span.removeAttribute("data-hlt-payload");
    // Optionally, remove style to keep replaced text clean
    span.style.background = "transparent";
    span.style.borderBottom = "none";
  }
}

// Track last clicked highlight for the apply flow
document.addEventListener("click", (e) => {
  if (e.target && e.target.classList && e.target.classList.contains("hlt-highlight")) {
    window.__hlt_last_clicked_span = e.target;
  }
});
