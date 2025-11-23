import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import copy from "rollup-plugin-copy";

export default defineConfig({
  plugins: [
    react(),

    // Copy manifest + icons to dist/
    copy({
      targets: [
        { src: "manifest.json", dest: "dist" },
        { src: "public/icons/**/*", dest: "dist/icons" }
      ],
      hook: "writeBundle"
    })
  ],

  build: {
    outDir: "dist",
    emptyOutDir: true,

    rollupOptions: {
      input: {
        popup: resolve(__dirname, "public/popup.html"),
        background: resolve(__dirname, "src/background/background.js"),
        content: resolve(__dirname, "src/content/content-script.js")
      },
      output: {
        entryFileNames: (chunkInfo) => {
          return 'assets/[name].js';
        },
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.html')) {
            return '[name][extname]';
          }
          return 'assets/[name][extname]';
        }
      }
    }
  }
});
