import { copyFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
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

const repoRoot = import.meta.dirname;
const llmsArtifacts = ["llms.txt", "llms-full.txt"] as const;

/**
 * The course's plain-text companion files are generated and verified at the repository root, but
 * Vite only publishes files that it emits itself. Copy the canonical, already-gated bytes into
 * `dist/` so their documented GitHub Pages URLs do not 404.
 */
function publishLlmsArtifacts(): Plugin {
  return {
    name: "publish-llms-artifacts",
    writeBundle(options) {
      const outputDirectory = resolve(repoRoot, options.dir ?? "dist");
      for (const filename of llmsArtifacts) {
        const source = resolve(repoRoot, filename);
        if (!existsSync(source)) throw new Error(`cannot publish missing ${filename}`);
        copyFileSync(source, resolve(outputDirectory, filename));
      }
    },
  };
}

export default defineConfig({
  // Load-bearing for the public demo. A GitHub Pages PROJECT page serves this app from
  // /atomic-learning-graph/, not from the domain root. With `base` unset, Vite emits
  // absolute `/assets/index-*.js` paths, every asset 404s, and the page renders blank
  // white. If this app is ever moved to a user page or a custom domain (i.e. served from
  // the root), set this back to "/".
  base: "/atomic-learning-graph/",
  plugins: [react(), katexWoff2Only(), publishLlmsArtifacts()],
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
