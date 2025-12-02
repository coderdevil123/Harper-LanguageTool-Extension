console.log("Background loaded 🚀");

// Store last analysis results for popup
let lastAnalysisResults = {
    grammar: [],
    harper: { tone: [], terminology: [] }
};

// Keep service worker alive
let keepAliveInterval;
let harperInitialized = false;

function keepAlive() {
    keepAliveInterval = setInterval(() => {
        console.log('🔄 Keeping service worker alive...');
    }, 20000);
}

// Initialize Harper
async function initHarper() {
    try {
        // For now, using simulation mode
        // TODO: Replace with actual Harper WASM when ready
        console.log('🎨 Harper initialized (simulation mode)');
        harperInitialized = true;
        return true;
    } catch (error) {
        console.error('❌ Failed to initialize Harper:', error);
        return false;
    }
}

// Start keeping alive and init Harper
keepAlive();
initHarper();

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
    const tabId = sender?.tab?.id;
    
    console.log('🎯 Message received:', req.type, 'from tabId:', tabId);

    // Handle PING from content script (IMPORTANT!)
    if (req.type === "PING") {
        console.log('🏓 PING received, responding...');
        sendResponse({ status: 'active' });
        return true;
    }

    // Handle popup messages (no sender.tab for popup)
    if (!sender.tab) {
        console.log('Popup message received:', req.type);
        
        switch (req.type) {
            case 'GET_LAST_RESULTS':
                sendResponse({ success: true, data: lastAnalysisResults });
                break;
                
            case 'REQUEST_REFRESH':
                sendResponse({ success: true, data: lastAnalysisResults });
                break;
                
            case 'APPLY_SUGGESTION':
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
                return true;
                
            case 'TOGGLE_EXTENSION':
                sendResponse({ success: true });
                break;
                
            default:
                console.warn('Unknown popup message type:', req.type);
                sendResponse({ success: false, error: 'Unknown message type' });
        }
        return true;
    }

    // USER TEXT → analyze with LT and Harper
    if (req.type === "USER_TEXT") {
        console.log('📝 Received USER_TEXT from tab:', tabId);
        console.log('📝 Text preview:', req.payload.text?.substring(0, 100));
        console.log('📝 Text length:', req.payload.text?.length);
        
        analyzeText(req.payload.text).then(result => {
            console.log('✅ Analysis complete');
            console.log('📊 Grammar issues:', result.grammar?.length || 0);
            console.log('📊 Tone issues:', result.harper?.tone?.length || 0);
            console.log('📊 Terminology issues:', result.harper?.terminology?.length || 0);
            
            // Log actual issues found
            if (result.grammar?.length > 0) {
                console.log('Grammar issues:', result.grammar.map(i => i.message));
            }
            if (result.harper?.tone?.length > 0) {
                console.log('Tone issues:', result.harper.tone.map(i => i.message));
            }
            if (result.harper?.terminology?.length > 0) {
                console.log('Terminology issues:', result.harper.terminology.map(i => i.message));
            }
            
            lastAnalysisResults = result;
            
            if (tabId) {
                console.log('📤 Sending COMBINED_RESULTS to tab:', tabId);
                chrome.tabs.sendMessage(tabId, {
                    type: "COMBINED_RESULTS",
                    payload: result
                }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('❌ Failed to send results:', chrome.runtime.lastError.message);
                    } else {
                        console.log('✅ Results sent successfully, response:', response);
                    }
                });
            } else {
                console.error('❌ No tabId available');
            }
            
            sendResponse({ success: true, issues: (result.grammar?.length || 0) + (result.harper?.tone?.length || 0) + (result.harper?.terminology?.length || 0) });
        }).catch(error => {
            console.error('❌ Analysis error:', error);
            sendResponse({ success: false, error: error.message });
        });
        
        return true;
    }

    // Bubble requests suggestions
    if (req.type === "GET_SUGGESTIONS") {
        const issue = req.payload.issue;

        let suggestions = [];

        if (issue.replacements) {
            suggestions = issue.replacements.map(r => r.value);
        }

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

// Run both LT and Harper
async function analyzeText(text) {
    console.log('🔍 Starting analysis for text:', text.substring(0, 50) + '...');
    
    // Run both in parallel
    const [lt, harper] = await Promise.all([
        checkWithLanguageTool(text),
        checkWithHarper(text)
    ]);
    
    console.log('📊 LanguageTool returned:', lt.length, 'issues');
    console.log('📊 Harper returned:', harper.tone.length, 'tone,', harper.terminology.length, 'terminology');
    
    return { 
        grammar: lt, 
        harper: {
            tone: harper.tone,
            terminology: harper.terminology
        }
    };
}

async function checkWithLanguageTool(text) {
    try {
        console.log('🌐 Checking text with LanguageTool...');
        const r = await fetch("http://10.10.10.36:8081/v2/check", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ text, language: "en-US" })
        });
        
        if (!r.ok) {
            throw new Error(`LT server responded with ${r.status}`);
        }
        
        const data = await r.json();
        console.log('✅ LanguageTool found', data.matches?.length || 0, 'issues');
        return data.matches || [];
    } catch (e) {
        console.error("❌ LanguageTool error:", e);
        console.warn("⚠️ LanguageTool server not available at http://10.10.10.36:8081");
        return [];
    }
}

async function checkWithHarper(text) {
    if (!harperInitialized) {
        console.warn('⚠️ Harper not initialized');
        return { tone: [], terminology: [] };
    }
    
    console.log('🎨 Checking text with Harper...');
    
    const tone = [];
    const terminology = [];
    
    // Basic tone detection (intensifiers)
    const intensifierRegex = /\b(very|really|extremely|absolutely|totally|completely)\b/gi;
    let match;
    while ((match = intensifierRegex.exec(text)) !== null) {
        tone.push({
            message: "Consider using a more precise word instead of intensifiers",
            offset: match.index,
            length: match[0].length,
            text: match[0],
            context: {
                text: text.substring(Math.max(0, match.index - 20), Math.min(text.length, match.index + match[0].length + 20)),
                offset: Math.min(20, match.index),
                length: match[0].length
            },
            suggestions: ["considerably", "significantly", "remarkably"],
            type: 'tone'
        });
    }
    
    // Basic terminology check (informal words)
    const informalWords = {
        'gonna': 'going to',
        'wanna': 'want to',
        'gotta': 'have to',
        'kinda': 'kind of',
        'sorta': 'sort of',
        'dunno': "don't know",
        'lemme': 'let me',
        'gimme': 'give me'
    };
    
    for (const [informal, formal] of Object.entries(informalWords)) {
        const regex = new RegExp(`\\b${informal}\\b`, 'gi');
        while ((match = regex.exec(text)) !== null) {
            terminology.push({
                message: `Consider using "${formal}" instead of informal "${informal}"`,
                offset: match.index,
                length: match[0].length,
                text: match[0],
                context: {
                    text: text.substring(Math.max(0, match.index - 20), Math.min(text.length, match.index + match[0].length + 20)),
                    offset: Math.min(20, match.index),
                    length: match[0].length
                },
                suggestions: [formal],
                type: 'terminology'
            });
        }
    }
    
    console.log('✅ Harper found', tone.length, 'tone issues and', terminology.length, 'terminology issues');
    
    return { tone, terminology };
}