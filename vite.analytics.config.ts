import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "assets/analytics",
    emptyOutDir: true,
    sourcemap: false,
    minify: true,
    lib: {
      entry: resolve(import.meta.dirname, "src/analytics/global.ts"),
      name: "AmurAtlasAnalyticsCore",
      formats: ["iife"],
      fileName: () => "atlas-analytics-core.js"
    }
  }
});
