import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { katexWoff2Only, inlineFontAssets } from "../scripts/vite-plugin-katex-woff2";
import { loadGraph } from "../src/graph/load";

const repoRoot = resolve(import.meta.dirname, "..");
const graphPath = process.env.BUILDER_GRAPH_PATH;
const outDir = process.env.BUILDER_COURSE_OUT_DIR;
if (!graphPath) throw new Error("BUILDER_GRAPH_PATH is required");
if (!outDir) throw new Error("BUILDER_COURSE_OUT_DIR is required");

const graph = loadGraph(resolve(graphPath));
const courseTitle = graph.sources[0]?.title ?? "My offline course";

// This is an additive build target. It compiles the existing reader entry against a temporary
// graph; it neither reads nor writes data/graph.json and does not participate in the main Vite build.
export default defineConfig({
  root: repoRoot,
  base: "./",
  plugins: [
    react(),
    katexWoff2Only(),
    {
      name: "local-course-title",
      transformIndexHtml(html) {
        return html
          .replace("<title>Atomic Learning Graph</title>", `<title>${courseTitle.replace(/[<>&]/gu, "")}</title>`)
          .replace(
            "A deterministic learning path through a validated, provenance-grounded concept graph.",
            "A self-contained course built from your source text, with a receipt for every concept.",
          );
      },
    },
  ],
  build: {
    outDir: resolve(outDir),
    emptyOutDir: true,
    modulePreload: { polyfill: false },
    assetsInlineLimit: inlineFontAssets,
    rollupOptions: {
      input: resolve(repoRoot, "index.html"),
    },
  },
  define: {
    __LEARNING_GRAPH__: JSON.stringify(graph),
    __RENDERINGS__: JSON.stringify({ renderings: [] }),
  },
});
