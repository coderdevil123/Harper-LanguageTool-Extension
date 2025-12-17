const fs = require('fs');
const path = require('path');

console.log('📦 Copying Harper WASM files...');

// Source from node_modules
const nodeModulesPath = path.join(__dirname, 'node_modules', 'harper.js');

// Destination in dist/assets
const destDir = path.join(__dirname, 'dist', 'assets');

// Create destination directory if it doesn't exist
if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
    console.log('✅ Created dist/assets directory');
}

// Try different possible locations for Harper files
const possiblePaths = [
    path.join(nodeModulesPath, 'dist'),
    path.join(nodeModulesPath, 'build'),
    nodeModulesPath
];

let foundPath = null;

for (const tryPath of possiblePaths) {
    if (fs.existsSync(tryPath)) {
        const files = fs.readdirSync(tryPath);
        console.log(`📁 Checking ${tryPath}`);
        console.log('   Files found:', files.join(', '));
        
        if (files.some(f => f.endsWith('.wasm') || f === 'harper.js')) {
            foundPath = tryPath;
            break;
        }
    }
}

if (!foundPath) {
    console.error('❌ Could not find Harper WASM files in node_modules');
    console.log('💡 Make sure harper.js is installed: npm install harper.js');
    process.exit(1);
}

console.log(`✅ Found Harper files in: ${foundPath}`);

// Copy all relevant files
const files = fs.readdirSync(foundPath);
let copiedFiles = [];

files.forEach(file => {
    if (file.endsWith('.wasm') || file.endsWith('.js') && file.includes('harper')) {
        const src = path.join(foundPath, file);
        const dest = path.join(destDir, file);
        
        fs.copyFileSync(src, dest);
        copiedFiles.push(file);
        console.log(`✅ Copied: ${file}`);
    }
});

if (copiedFiles.length === 0) {
    console.error('❌ No Harper files were copied!');
    process.exit(1);
}

console.log(`\n🎉 Successfully copied ${copiedFiles.length} Harper files to dist/assets/`);
console.log('📝 Files:', copiedFiles.join(', '));
