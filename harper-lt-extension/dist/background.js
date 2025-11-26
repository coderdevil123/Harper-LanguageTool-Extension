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
                break;
                
            case 'GET_LAST_RESULTS':
                sendResponse({ success: true, data: lastAnalysisResults });
                break;
                
            case 'REQUEST_REFRESH':
                sendResponse({ success: true, data: lastAnalysisResults });
                break;
                
            case 'APPLY_SUGGESTION':
                // Forward to active tab
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    if (tabs[0]) {
                        chrome.tabs.sendMessage(tabs[0].id, {
                            type: "APPLY_SUGGESTION",
                            payload: req.payload
                        }, () => {
                            if (chrome.runtime.lastError) {
                                sendResponse({ success: false, error: chrome.runtime.lastError.message });
                            } else {
                                sendResponse({ success: true });
                            }
                        });
                    } else {
                        sendResponse({ success: false, error: 'No active tab' });
                    }
                });
                return true; // Keep channel open for async response
                
            case 'TOGGLE_EXTENSION':
                sendResponse({ success: true });
                break;
                
            default:
                console.warn('Unknown popup message type:', req.type);
                sendResponse({ success: false, error: 'Unknown message type' });
        }
        return true; // Keep channel open
    }

    // USER TEXT → analyze with LT (and Harper later)
    if (req.type === "USER_TEXT") {
        analyzeText(req.payload.text).then(result => {
            // Store results for popup
            lastAnalysisResults = result;
            
            if (tabId) {
                chrome.tabs.sendMessage(tabId, {
                    type: "COMBINED_RESULTS",
                    payload: result
                }, () => {
                    // Ignore errors if content script isn't ready
                    if (chrome.runtime.lastError) {
                        console.warn('Could not send to tab:', chrome.runtime.lastError.message);
                    }
                });
            }
        }).catch(error => {
            console.error('Analysis error:', error);
        });
        sendResponse({ success: true });
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

        if (tabId) {
            chrome.tabs.sendMessage(tabId, {
                type: "SHOW_SUGGESTIONS",
                payload: {
                    text: issue.text || issue.context?.text,
                    suggestions,
                    position: req.payload.position
                }
            }, () => {
                if (chrome.runtime.lastError) {
                    console.warn('Could not show suggestions:', chrome.runtime.lastError.message);
                }
            });
        }

        sendResponse({ success: true });
        return true;
    }

    // User clicks a suggestion
    if (req.type === "APPLY_SUGGESTION") {
        if (tabId) {
            chrome.tabs.sendMessage(tabId, {
                type: "APPLY_SUGGESTION",
                payload: { replacement: req.payload.replacement }
            }, () => {
                if (chrome.runtime.lastError) {
                    console.warn('Could not apply suggestion:', chrome.runtime.lastError.message);
                }
            });
        }

        sendResponse({ success: true });
        return true;
    }
    
    // Default fallback
    sendResponse({ success: false, error: 'Unknown message type' });
    return true;
});

// Run LT
async function analyzeText(text) {
    const lt = await checkWithLanguageTool(text);
    return { grammar: lt, harper: { tone: [], terminology: [] } };
}

async function checkWithLanguageTool(text) {
    try {
        console.log('Checking text with LanguageTool...');
        const r = await fetch("http://10.10.10.36:8081/v2/check", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ text, language: "en-US" })
        });
        
        if (!r.ok) {
            throw new Error(`LT server responded with ${r.status}`);
        }
        
        const data = await r.json();
        console.log('LanguageTool found', data.matches?.length || 0, 'issues');
        return data.matches || [];
    } catch (e) {
        console.error("LanguageTool error:", e);
        console.warn("⚠️ LanguageTool server not available at http://10.10.10.36:8081");
        return [];
    }
}