console.log("Background loaded 🚀");

// Store last analysis results for popup
let lastAnalysisResults = {
    grammar: [],
    harper: { tone: [], terminology: [] }
};

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    const tabId = sender?.tab?.id;

    // Handle popup messages (no sender.tab for popup)
    if (!sender.tab) {
        console.log('Popup message received:', req.type);
        
        switch (req.type) {
            case 'PING':
                sendResponse({ status: 'active' });
                return true;
                
            case 'GET_LAST_RESULTS':
                sendResponse({ success: true, data: lastAnalysisResults });
                return true;
                
            case 'REQUEST_REFRESH':
                // Return cached results
                sendResponse({ success: true, data: lastAnalysisResults });
                return true;
                
            case 'APPLY_SUGGESTION':
                // Forward to active tab
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs[0]) {
                        chrome.tabs.sendMessage(tabs[0].id, {
                            type: "APPLY_SUGGESTION",
                            payload: req.payload
                        });
                        sendResponse({ success: true });
                    } else {
                        sendResponse({ success: false, error: 'No active tab' });
                    }
                });
                return true; // Async response
                
            case 'TOGGLE_EXTENSION':
                sendResponse({ success: true });
                return true;
                
            default:
                console.warn('Unknown popup message type:', req.type);
                sendResponse({ success: false, error: 'Unknown message type' });
                return true;
        }
    }

    // USER TEXT → analyze with LT (and Harper later)
    if (req.type === "USER_TEXT") {
        analyzeText(req.payload.text).then(result => {
            // Store results for popup
            lastAnalysisResults = result;
            
            chrome.tabs.sendMessage(tabId, {
                type: "COMBINED_RESULTS",
                payload: result
            });
        });
        sendResponse(true);
        return true;
    }

    // Bubble requests suggestions
    if (req.type === "GET_SUGGESTIONS") {
        const issue = req.payload.issue;

        let suggestions = [];

        // LanguageTool
        if (issue.replacements) {
            suggestions = issue.replacements.map(r => r.value);
        }

        // Harper
        if (issue.suggestions) {
            suggestions = issue.suggestions;
        }

        chrome.tabs.sendMessage(tabId, {
            type: "SHOW_SUGGESTIONS",
            payload: {
                text: issue.text || issue.context?.text,
                suggestions,
                position: req.payload.position
            }
        });

        sendResponse(true);
        return true;
    }

    // User clicks a suggestion
    if (req.type === "APPLY_SUGGESTION") {
        chrome.tabs.sendMessage(tabId, {
            type: "APPLY_SUGGESTION",
            payload: { replacement: req.payload.replacement }
        });

        sendResponse(true);
        return true;
    }
});

// Run LT
async function analyzeText(text) {
    const lt = await checkWithLanguageTool(text);
    return { grammar: lt, harper: { tone: [], terminology: [] } };
}

async function checkWithLanguageTool(text) {
    try {
        // Updated to use your LanguageTool server IP
        const r = await fetch("http://10.10.10.36:8081/v2/check", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ text, language: "en-US" })
        });
        
        if (!r.ok) {
            throw new Error(`LT server responded with ${r.status}`);
        }
        
        const data = await r.json();
        return data.matches || [];
    } catch (e) {
        console.error("LanguageTool error:", e);
        console.warn("⚠️ LanguageTool server not available at http://10.10.10.36:8081");
        return [];
    }
}