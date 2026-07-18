import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { katexWoff2Only, inlineFontAssets } from "./scripts/vite-plugin-katex-woff2";
import { loadGraph } from "./src/graph/load";
import { loadRenderings } from "./src/graph/load";
import { loadCourseReceipt } from "./src/graph/load";

// The graph, optional renderings, and build receipt are loaded once, while the static app is built.
// The browser receives the validated artifacts as data; it never fetches them and never calls a model.
const graph = loadGraph();
const renderings = loadRenderings();
const receipt = loadCourseReceipt();

export default defineConfig({
  // Load-bearing for the public demo. A GitHub Pages PROJECT page serves this app from
  // /atomic-learning-graph/, not from the domain root. With `base` unset, Vite emits
  // absolute `/assets/index-*.js` paths, every asset 404s, and the page renders blank
  // white. If this app is ever moved to a user page or a custom domain (i.e. served from
  // the root), set this back to "/".
  base: "/atomic-learning-graph/",
  plugins: [react(), katexWoff2Only()],
  build: {
    // This single-chunk app has nothing to module-preload. Omitting Vite's
    // compatibility polyfill also keeps `fetch` out of the browser bundle.
    modulePreload: { polyfill: false },
    assetsInlineLimit: inlineFontAssets,
  },
  define: {
    __LEARNING_GRAPH__: JSON.stringify(graph),
    __RENDERINGS__: JSON.stringify(renderings),
    __COURSE_RECEIPT__: JSON.stringify(receipt),
  },
});
