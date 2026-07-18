import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { loadGraph, loadRenderings } from "./src/graph/load";

// Additive, file://-safe build target. The public Pages build remains owned exclusively by
// vite.config.ts, including its load-bearing /atomic-learning-graph/ base.
const graph = loadGraph();
const renderings = loadRenderings();

export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    outDir: "dist-single",
    emptyOutDir: true,
    modulePreload: { polyfill: false },
  },
  define: {
    __LEARNING_GRAPH__: JSON.stringify(graph),
    __RENDERINGS__: JSON.stringify(renderings),
  },
});
