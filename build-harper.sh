#!/bin/bash

echo "🔨 Building Harper WASM..."

# Navigate to Harper directory
cd /home/devil/Documents/Harper-LanguageTool/Harper-LanguageTool-Extension/harper

# Pull latest changes
git pull origin main

# Navigate to WASM directory
cd harper-wasm

# Build
echo "📦 Running wasm-pack build..."
wasm-pack build --target web --out-dir pkg

# Check if build succeeded
if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    
    # Copy files
    echo "📋 Copying files to extension..."
    cp pkg/harper_wasm.js ../harper-lt-extension/dist/assets/harper.js
    cp pkg/harper_wasm_bg.wasm ../harper-lt-extension/dist/assets/harper_bg.wasm
    
    echo "🎉 Harper WASM updated successfully!"
    echo "📁 Files copied to: harper-lt-extension/dist/assets/"
    
    # Show file sizes
    ls -lh ../harper-lt-extension/dist/assets/harper*
else
    echo "❌ Build failed!"
    exit 1
fi
