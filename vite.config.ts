import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { loadGraph } from "./src/graph/load";

// The graph is loaded once, while the static app is built. The browser receives
// the validated artifact as data; it never fetches it and never calls a model.
const graph = loadGraph();

export default defineConfig({
  plugins: [react()],
  build: {
    // This single-chunk app has nothing to module-preload. Omitting Vite's
    // compatibility polyfill also keeps `fetch` out of the browser bundle.
    modulePreload: { polyfill: false },
  },
  define: {
    __LEARNING_GRAPH__: JSON.stringify(graph),
  },
});
