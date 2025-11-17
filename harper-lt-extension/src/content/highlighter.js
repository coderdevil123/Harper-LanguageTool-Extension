export function highlightIssues(results) {
    const grammar = results.grammar || [];
    const tone = results.harper?.tone || [];
    const terminology = results.harper?.terminology || [];

    removeOldHighlights();

    [...grammar, ...tone, ...terminology].forEach((issue, i) => {
        highlight(issue, i);
    });
}

function removeOldHighlights() {
    document.querySelectorAll(".hlt-highlight").forEach(span => {
        span.replaceWith(span.innerText);
    });
}

function highlight(issue, id) {
    const target = issue.context?.text || issue.text;
    if (!target) return;

    issue.id = id; // Save unique ID

    const textNodes = getAllTextNodes(document.body);

    textNodes.forEach(node => {
        if (!node.nodeValue.includes(target)) return;

        const parts = node.nodeValue.split(target);
        if (parts.length <= 1) return;

        const frag = document.createDocumentFragment();

        parts.forEach((part, i) => {
            frag.appendChild(document.createTextNode(part));
            if (i < parts.length - 1) {
                const span = document.createElement("span");

                span.className = "hlt-highlight";
                span.dataset.hltPayload = encodeURIComponent(JSON.stringify(issue));
                span.dataset.hltId = id;

                span.style.borderBottom = "2px solid red";
                span.style.cursor = "pointer";
                span.textContent = target;

                frag.appendChild(span);
            }
        });

        node.replaceWith(frag);
    });
}

function getAllTextNodes(root) {
    let nodes = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) nodes.push(n);
    return nodes;
}
