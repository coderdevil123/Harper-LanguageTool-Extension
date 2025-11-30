// Harper WASM Worker
console.log('Harper Worker initialized');

let harperInstance = null;

// Initialize Harper (placeholder - will be replaced with actual WASM)
async function initHarper() {
    try {
        // TODO: Replace with actual Harper WASM initialization
        // For now, we'll simulate Harper with basic checks
        console.log('Harper initialized (simulation mode)');
        harperInstance = true;
        return true;
    } catch (error) {
        console.error('Failed to initialize Harper:', error);
        return false;
    }
}

// Analyze text with Harper
function analyzeWithHarper(text) {
    if (!harperInstance) {
        return { tone: [], terminology: [] };
    }
    
    // Simulate Harper analysis
    const tone = [];
    const terminology = [];
    
    // Basic tone detection (placeholder)
    if (text.match(/\b(very|really|extremely)\b/gi)) {
        const matches = text.matchAll(/\b(very|really|extremely)\b/gi);
        for (const match of matches) {
            tone.push({
                message: "Consider using a more precise word instead of intensifiers",
                offset: match.index,
                length: match[0].length,
                text: match[0],
                suggestions: ["considerably", "significantly"],
                type: 'tone'
            });
        }
    }
    
    // Basic terminology check (placeholder)
    const informalWords = {
        'gonna': 'going to',
        'wanna': 'want to',
        'gotta': 'have to',
        'kinda': 'kind of',
        'sorta': 'sort of'
    };
    
    for (const [informal, formal] of Object.entries(informalWords)) {
        const regex = new RegExp(`\\b${informal}\\b`, 'gi');
        const matches = text.matchAll(regex);
        for (const match of matches) {
            terminology.push({
                message: `Consider using "${formal}" instead of informal "${informal}"`,
                offset: match.index,
                length: match[0].length,
                text: match[0],
                suggestions: [formal],
                type: 'terminology'
            });
        }
    }
    
    return { tone, terminology };
}

// Listen for messages
self.onmessage = async function(e) {
    const { type, text } = e.data;
    
    if (type === 'INIT') {
        const success = await initHarper();
        self.postMessage({ type: 'INIT_COMPLETE', success });
    } else if (type === 'ANALYZE') {
        const results = analyzeWithHarper(text);
        self.postMessage({ type: 'ANALYSIS_COMPLETE', results });
    }
};
