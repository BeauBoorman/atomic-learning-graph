#!/usr/bin/env node
// Run all 6 emitters against the builder's graph.json (BUILDER_GRAPH_PATH env var).
// Falls back to the committed data/graph.json if no builder graph is present.
// This is what makes "import → export" a real path.

import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const __dirname = resolve(fileURLToPath(import.meta.url), "..");
const repoRoot = resolve(__dirname, "..");

const GRAPH_PATH = process.env.BUILDER_GRAPH_PATH || resolve(repoRoot, "data", "graph.json");
const OUT_DIR = process.env.BUILDER_COURSE_OUT_DIR || resolve(repoRoot, "exports", "builder");
const EMITS = [
  ["emit:llms", "llms.txt", "llms-full.txt"],
  ["emit:orgroam", "atomic-learning-graph.org"],
  ["emit:obsidian", "exports/obsidian/"],
  ["emit:anki", "atomic-learning-graph-anki.tsv"],
  ["emit:exam", "atomic-learning-graph-exam.md"],
  ["emit:tinderbox", "atomic-learning-graph.opml"],
];

if (!existsSync(GRAPH_PATH)) {
  console.error(`No graph at ${GRAPH_PATH}. Run atomize or build a course first.`);
  process.exit(1);
}

console.log(`Emitting exports from: ${GRAPH_PATH}`);
console.log(`Output directory:    ${OUT_DIR}\n`);

const pnpm = ["npx", "pnpm"];
const failures = [];

for (const [script, ..._outputs] of EMITS) {
  const name = script.replace("emit:", "");
  console.log(`→ ${name}...`);
  await new Promise((resolve, reject) => {
    const child = spawn("pnpm", ["run", script, "--", "--graph", GRAPH_PATH, "--out-dir", OUT_DIR], {
      stdio: "pipe",
      cwd: repoRoot,
    });
    let stdout = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stdout += chunk; });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) {
        console.log(`  ✓ ${name}`);
        resolve();
      } else {
        console.error(`  ✗ ${name} (exit ${code})\n${stdout.slice(-2000)}`);
        failures.push(name);
        resolve(); // continue even if one fails
      }
    });
  });
}

if (failures.length > 0) {
  console.error(`\nFailed: ${failures.join(", ")}`);
  process.exit(1);
}
console.log("\nAll exports emitted.");
