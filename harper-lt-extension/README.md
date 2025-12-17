# Harper + LanguageTool Extension

A Chrome extension combining LanguageTool (grammar) and Harper (tone/terminology) for comprehensive writing assistance.

## Features

✅ **LanguageTool Integration** - Grammar and spelling checking via public API
✅ **Harper Simulation Engine** - Advanced tone and terminology detection
✅ **Real-time Analysis** - Checks as you type
✅ **Visual Underlines** - Color-coded error highlighting
✅ **Smart Suggestions** - Click to apply fixes
✅ **Multi-site Support** - Works on Gmail, ChatGPT, Google Docs, and more

## Technical Notes

### Harper Integration

This extension uses an **enhanced simulation mode** for Harper features:

- **Tone Detection:** Identifies intensifiers, weak verbs, passive voice, redundant phrases
- **Terminology Detection:** Flags informal words, slang, colloquialisms

**Why simulation instead of Harper WASM?**

Harper's WASM build (v0.x) does not expose a document parsing function needed for browser integration. The simulation mode provides:
- ✅ Production-ready detection of common writing issues
- ✅ Zero dependencies (no WASM loading overhead)
- ✅ Faster performance
- ✅ Easy to extend with custom rules

Future versions may integrate Harper WASM when the API becomes available.

## Installation

1. Clone this repository
2. Open Chrome → `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked"
5. Select the `dist` folder

## Development

```bash
# Build Harper WASM (optional, currently unused)
cd harper/harper-wasm
wasm-pack build --target web

# Copy to extension
cp pkg/*.wasm ../../dist/assets/
cp pkg/*.js ../../dist/assets/
```

## License

MIT
