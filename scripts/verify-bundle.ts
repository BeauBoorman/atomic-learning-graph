// THE SHIPPED-BYTES GATE for the no-network browser claim.
//
// The fast source check in src/ui/gate9.test.ts gives developers a precise file-level failure,
// but a directory boundary is not a browser boundary: UI code imports runtime modules from other
// directories, and Vite may add or split code while building. This verifier runs AFTER the build
// and scans every emitted JavaScript chunk. Those are the bytes a learner actually downloads, so
// this is the evidence boundary for the claim that reading a lesson cannot start a network client
// or call the model vendor.
//
// SELF-TRIP DEFENCE. The forbidden signatures are assembled from fragments, so this verifier does
// not contain the signatures it looks for. More importantly, it reads only dist/**/*.js-like
// outputs; scripts/ is outside the Vite entry graph and the verifier never scans its own source.

import { globSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");
const chunks = globSync("dist/**/*.{js,mjs,cjs}", { cwd: repoRoot }).sort();

if (chunks.length === 0) {
  throw new Error("bundle verification found no emitted JavaScript; run the production build first");
}

const forbiddenSignatures = [
  { label: "request client", parts: ["fet", "ch("] },
  { label: "XHR client", parts: ["XML", "HttpRequest"] },
  { label: "socket client", parts: ["Web", "Socket"] },
  { label: "event-stream client", parts: ["Event", "Source"] },
  { label: "beacon client", parts: ["send", "Beacon"] },
  { label: "model vendor", parts: ["open", "ai"] },
] as const;

const violations: string[] = [];
for (const chunk of chunks) {
  const bundle = readFileSync(resolve(repoRoot, chunk), "utf8").toLowerCase();
  for (const { label, parts } of forbiddenSignatures) {
    const signature = parts.join("");
    if (bundle.includes(signature.toLowerCase())) {
      violations.push(`${chunk}: ${label} signature ${JSON.stringify(signature)}`);
    }
  }
}

if (violations.length > 0) {
  throw new Error(`shipped bundle can initiate or name a remote model call:\n${violations.join("\n")}`);
}

console.log(`Verified ${chunks.length} emitted JavaScript chunk(s): no network clients or model vendor.`);
