// Harper Web Worker - handles WASM processing

let harperWasm = null;
let harperInitialized = false;

// Initialize Harper WASM
async function initHarper() {
    try {
        console.log('🎨 Worker: Initializing Harper WASM...');
        
        // Import Harper module (Web Workers support import!)
        const harperModule = await import('./harper.js');
        
        // Initialize WASM
        await harperModule.default();
        
        // Store the module
        harperWasm = harperModule;
        harperInitialized = true;
        
        console.log('✅ Worker: Harper WASM loaded successfully!');
        return true;
    } catch (error) {
        console.error('❌ Worker: Failed to load Harper:', error);
        return false;
    }
}

// Initialize on worker start
initHarper();

// Listen for messages from main thread
self.onmessage = async function(e) {
    const { type, text, id } = e.data;
    
    if (type === 'LINT') {
        if (!harperInitialized) {
            // Wait for initialization
            await new Promise(resolve => {
                const checkInit = setInterval(() => {
                    if (harperInitialized) {
                        clearInterval(checkInit);
                        resolve();
                    }
                }, 100);
            });
        }
        
        try {
            // Use Harper to lint the text
            let lints = [];
            
            if (typeof harperWasm.lint === 'function') {
                lints = harperWasm.lint(text);
            } else if (typeof harperWasm.check === 'function') {
                lints = harperWasm.check(text);
            }
            
            console.log(`✅ Worker: Found ${lints?.length || 0} lints`);
            
            // Send results back
            self.postMessage({
                id: id,
                success: true,
                lints: lints || []
            });
            
        } catch (error) {
            console.error('❌ Worker: Lint error:', error);
            self.postMessage({
                id: id,
                success: false,
                error: error.message
            });
        }
    }
};
        self.postMessage({ type: 'INIT_COMPLETE', success });
    } else if (type === 'ANALYZE') {
        const results = analyzeWithHarper(text);
        self.postMessage({ type: 'ANALYSIS_COMPLETE', results });
    }
};
