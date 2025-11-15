// inject-ui.js
// Floating bubble for suggestions (improved)

console.log("Inject UI loaded 💬");

let bubble;

export function showBubbleForElement(element, suggestions = []) {
  removeBubble();

  const rect = element.getBoundingClientRect();
  const x = Math.max(8, rect.left);
  const y = Math.max(8, rect.top);

  bubble = document.createElement("div");
  bubble.className = "hlt-bubble";
  bubble.style.cssText = `
    position: fixed;
    top: ${y + window.scrollY - 8}px;
    left: ${x + window.scrollX}px;
    background: #fff;
    border: 1px solid #ddd;
    padding: 8px;
    box-shadow: 0 6px 18px rgba(0,0,0,0.12);
    border-radius: 8px;
    z-index: 2147483647;
    font-family: system-ui, Arial, sans-serif;
    max-width: 320px;
  `;

  bubble.innerHTML = `
    <div style="font-weight:600; margin-bottom:6px;">Suggestions</div>
    <div class="hlt-suggestion-list">
      ${suggestions.length ? suggestions.map((s, idx) => `<div class="hlt-suggestion" data-idx="${idx}" style="padding:6px 8px; border-radius:6px; cursor:pointer; margin-bottom:6px;">${escapeHtml(s)}</div>`).join("") : `<div style="color:#666">No suggestions</div>`}
    </div>
    <div style="text-align:right; margin-top:6px;"><button class="hlt-close-btn" style="border:none;background:none;cursor:pointer;color:#888">close</button></div>
  `;

  document.body.appendChild(bubble);

  bubble.querySelectorAll(".hlt-suggestion").forEach(el => {
    el.addEventListener("click", (ev) => {
      const idx = el.getAttribute("data-idx");
      // inform background we want to apply this suggestion to the active highlighted element
      chrome.runtime.sendMessage({ type: "APPLY_SUGGESTION", payload: { suggestionIndex: Number(idx) }});
      removeBubble();
    });
  });

  bubble.querySelector(".hlt-close-btn")?.addEventListener("click", removeBubble);
}

export function removeBubble() {
  if (bubble) bubble.remove();
  bubble = null;
}

function escapeHtml(s) {
  if (!s) return "";
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// Global click handler: when user clicks highlight, request suggestions
document.addEventListener("click", (e) => {
  const target = e.target;
  if (target && target.classList && target.classList.contains("hlt-highlight")) {
    // ask background for suggestions for this highlight
    const payload = target.getAttribute("data-hlt-payload");
    chrome.runtime.sendMessage({ type: "GET_SUGGESTIONS", payload: { raw: payload }}, (response) => {
      const suggestions = (response && response.suggestions) || [];
      showBubbleForElement(target, suggestions);
    });
    e.stopPropagation();
  } else {
    // clicking anywhere else hides bubble
    removeBubble();
  }
});
