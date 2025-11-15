// highlighter.js
// Safe text-node walker highlighting (preserves DOM, events)

console.log("Highlighter loaded 🖍️");

const HIGHLIGHT_CLASS = "hlt-highlight";

export function highlightIssues(results) {
  const { grammar = [], harper = {} } = results || {};
  const tone = harper.tone || [];
  const terminology = harper.terminology || [];

  const all = [
    ...grammar.map(g => ({ ...g, type: "grammar" })),
    ...tone.map(t => ({ ...t, type: "tone" })),
    ...terminology.map(t => ({ ...t, type: "terminology" }))
  ];

  removeOldHighlights();
  if (!all.length) return;

  // For each issue, highlight first reasonable match in the document
  all.forEach(issue => {
    try {
      highlightFirstMatch(issue);
    } catch (err) {
      console.warn("Highlight error:", err);
    }
  });
}

function removeOldHighlights() {
  // Replace highlight spans with their text content
  document.querySelectorAll(`.${HIGHLIGHT_CLASS}`).forEach(span => {
    const textNode = document.createTextNode(span.textContent);
    span.parentNode.replaceChild(textNode, span);
    // normalize to merge adjacent text nodes
    span.parentNode.normalize();
  });
}

function highlightFirstMatch(issue) {
  const text = issue.context?.text || issue.message || issue.text;
  if (!text || text.trim().length === 0) return;

  const safe = escapeRegex(text.trim());
  const regex = new RegExp(safe, "i");

  // Walk text nodes and find first match
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        // ignore script/style/input text nodes
        if (!node.nodeValue || node.parentNode.matches && node.parentNode.matches("script, style, textarea, input")) {
          return NodeFilter.FILTER_REJECT;
        }
        if (regex.test(node.nodeValue)) return NodeFilter.FILTER_ACCEPT;
        return NodeFilter.FILTER_REJECT;
      }
    },
    false
  );

  const color = issue.type === "grammar" ? "#ff4d4d" : (issue.type === "tone" ? "#4d79ff" : "#b84dff");

  let node;
  while ((node = walker.nextNode())) {
    const match = node.nodeValue.match(regex);
    if (!match) continue;

    const start = match.index;
    const end = start + match[0].length;

    // Split text node into [before][match][after]
    const before = node.nodeValue.slice(0, start);
    const matched = node.nodeValue.slice(start, end);
    const after = node.nodeValue.slice(end);

    const parent = node.parentNode;

    if (before) parent.insertBefore(document.createTextNode(before), node);
    const span = document.createElement("span");
    span.className = HIGHLIGHT_CLASS;
    span.setAttribute("data-hlt-text", matched);
    span.setAttribute("data-hlt-type", issue.type);
    // store issue payload for future reference (stringified)
    span.setAttribute("data-hlt-payload", encodeURIComponent(JSON.stringify(issue)));
    span.style.backgroundColor = `${color}33`; // translucent bg
    span.style.borderBottom = `2px solid ${color}`;
    span.style.cursor = "pointer";
    span.style.padding = "1px";
    span.textContent = matched;
    parent.insertBefore(span, node);

    if (after) parent.insertBefore(document.createTextNode(after), node);
    parent.removeChild(node);

    // only highlight first occurrence per issue
    break;
  }
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
