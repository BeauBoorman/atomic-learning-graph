import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { katexWoff2Only, inlineFontAssets } from "./scripts/vite-plugin-katex-woff2";
import { loadGraph, loadRenderings, loadCourseReceipt } from "./src/graph/load";

// Additive, file://-safe build target. The public Pages build remains owned exclusively by
// vite.config.ts, including its load-bearing /atomic-learning-graph/ base.
const graph = loadGraph();
const renderings = loadRenderings();
const receipt = loadCourseReceipt();

export default defineConfig({
  base: "./",
  plugins: [react(), katexWoff2Only()],
  build: {
    outDir: "dist-single",
    emptyOutDir: true,
    modulePreload: { polyfill: false },
    assetsInlineLimit: inlineFontAssets,
  },
  define: {
    __LEARNING_GRAPH__: JSON.stringify(graph),
    __RENDERINGS__: JSON.stringify(renderings),
    __COURSE_RECEIPT__: JSON.stringify(receipt),
  },
});
