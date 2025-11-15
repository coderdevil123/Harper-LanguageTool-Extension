import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// Helper: resolve paths cleaner
const r = (p) => resolve(__dirname, p);

export default defineConfig({
  plugins: [
    react({
      include: ["src/popup/**/*", "src/popup/**"], // react only for popup
    }),
  ],

  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,

    rollupOptions: {
      input: {
        // Popup UI (React)
        popup: r("public/popup.html"),

        // Background (service worker)
        background: r("src/background/background.js"),

        // Content script
        content: r("src/content/content-script.js"),
      },

      output: {
        // Same directory structure chrome expects
        entryFileNames: "js/[name].js",
        chunkFileNames: "js/[name].js",
        assetFileNames: (assetInfo) => {
          // Keep images inside assets/icons or root
          if (assetInfo.name && assetInfo.name.includes("icon")) {
            return "icons/[name].[ext]";
          }
          return "assets/[name].[ext]";
        },
      },
    },
  },

  resolve: {
    alias: {
      "@": r("./src"),
    },
  },
});
