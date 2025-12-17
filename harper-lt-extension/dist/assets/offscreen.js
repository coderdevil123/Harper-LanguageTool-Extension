console.log('📄 Offscreen document loaded - Currently unused (Harper WASM not compatible)');

// NOTE: This offscreen document was created for Harper WASM integration,
// but Harper's current WASM build does not expose the required parsing functions.
// The extension uses an enhanced simulation mode instead.
// This file is kept for future integration when Harper WASM API is updated.

// Listen for messages (currently not used, but kept for future)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'LINT_TEXT') {
        sendResponse({
            success: false,
            error: 'Harper WASM not available - using simulation mode'
        });
    }
    return true;
});