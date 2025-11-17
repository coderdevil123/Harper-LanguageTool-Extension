// ------------------------------------------
// inject-ui.js
// Floating bubble for suggestions
// ------------------------------------------

console.log("Inject UI loaded 💬");

let bubble = null;

// EXPORT showBubble
export function showBubble(text, suggestions, x, y) {
    removeBubble(); // remove old one

    bubble = document.createElement("div");
    bubble.className = "hlt-bubble";

    bubble.style.cssText = `
        position: fixed;
        top: ${y + 15}px;
        left: ${x}px;
        background: #ffffff;
        border: 1px solid #ccc;
        padding: 10px 14px;
        box-shadow: 0 2px 14px rgba(0,0,0,0.15);
        border-radius: 10px;
        z-index: 999999;
        max-width: 300px;
        font-size: 14px;
    `;

    let html = `<strong>${text}</strong><hr/>`;

    if (suggestions.length === 0) {
        html += `<div>No suggestions</div>`;
    } else {
        html += suggestions
            .map((s, i) => {
                const val = s?.value || s;
                return `<div class="hlt-suggestion" data-index="${i}"
                        style="padding:6px;cursor:pointer;">
                        ${val}
                        </div>`;
            })
            .join("");
    }

    bubble.innerHTML = html;

    document.body.appendChild(bubble);
}

// EXPORT removeBubble
export function removeBubble() {
    if (bubble) {
        bubble.remove();
        bubble = null;
    }
}

// CLICK HANDLER: request suggestions based on clicked highlight
document.addEventListener("click", (e) => {
    if (e.target.classList.contains("hlt-highlight")) {
        const raw = e.target.getAttribute("data-hlt-payload");
        window.__hlt_last_clicked_span = e.target;

        chrome.runtime.sendMessage(
            { type: "GET_SUGGESTIONS", payload: { raw } },
            (res) => {
                const rect = e.target.getBoundingClientRect();
                showBubble(
                    e.target.innerText,
                    res?.suggestions || [],
                    rect.left,
                    rect.top
                );
            }
        );
    } else {
        removeBubble();
    }
});
