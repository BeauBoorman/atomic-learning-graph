// THE SHIPPED-BYTES GATE for the no-network browser claim.
//
// The fast source check in src/ui/gate9.test.ts gives developers a precise file-level failure,
// but a source-directory boundary is not a browser boundary: index.html is the real Vite entry,
// UI code imports runtime modules from other directories, and Vite may add or split code and CSS
// while building. This verifier runs AFTER the build and scans emitted JavaScript, HTML and CSS.
// Those are the bytes a learner actually downloads, so this is the evidence boundary for the
// claim that reading a lesson cannot start a network client or load a remote asset.
//
// SELF-TRIP DEFENCE. Forbidden signatures and the remote prefix are assembled from fragments, so
// this verifier does not contain the literal strings it looks for. More importantly, it reads only
// dist outputs; scripts/ is outside the Vite entry graph and the verifier never scans its source.

import { existsSync, globSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");
const javascriptChunks = globSync("dist/**/*.{js,mjs,cjs}", { cwd: repoRoot }).sort();
const htmlFiles = globSync("dist/**/*.html", { cwd: repoRoot }).sort();
const cssFiles = globSync("dist/**/*.css", { cwd: repoRoot }).sort();

if (javascriptChunks.length === 0) {
  throw new Error("bundle verification found no emitted JavaScript; run the production build first");
}
if (htmlFiles.length === 0) {
  throw new Error("bundle verification found no emitted HTML; run the production build first");
}

// The README links to these plain-text course artifacts at the GitHub Pages root. They are
// generated and verified from the committed graph at the repository root, then Vite copies those
// exact bytes into dist for deployment. A successful app build without these files would otherwise
// leave judge-visible 404s outside the JavaScript bundle scan.
for (const filename of ["llms.txt", "llms-full.txt"] as const) {
  const sourcePath = resolve(repoRoot, filename);
  const deployedPath = resolve(repoRoot, "dist", filename);
  if (!existsSync(deployedPath)) {
    throw new Error(`bundle verification is missing deployed ${filename}`);
  }
  if (readFileSync(deployedPath, "utf8") !== readFileSync(sourcePath, "utf8")) {
    throw new Error(`bundle verification found deployed ${filename} differs from its gated source`);
  }
}

const forbiddenSignatures = [
  { label: "request client", parts: ["fet", "ch("] },
  { label: "XHR client", parts: ["XML", "HttpRequest"] },
  { label: "socket client", parts: ["Web", "Socket"] },
  { label: "event-stream client", parts: ["Event", "Source"] },
  { label: "beacon client", parts: ["send", "Beacon"] },
  { label: "model vendor", parts: ["open", "ai"] },
] as const;

// Matches both explicit web schemes and protocol-relative references. Local paths and data: URIs
// deliberately do not match. Fragment assembly keeps the scanner's source from containing its own
// poison string even if scripts/ were accidentally added to the browser entry graph later.
const remotePrefix = `(?:${["ht", "tps?"].join("")}:)?${["[/]", "[/]"].join("")}`;
const quote = `["'\u0060]`;
const htmlRemoteAsset = new RegExp(
  `<\\s*(?:link|script|img|iframe|audio|video|source|track|embed|input)\\b[^>]*` +
    `\\b(?:href|src|srcset|poster)\\s*=\\s*${quote}?\\s*${remotePrefix}`,
  "iu",
);
const javascriptRemoteSrc = new RegExp(
  `\\bsrc\\s*:\\s*${quote}\\s*${remotePrefix}`,
  "iu",
);
const javascriptRemoteLink = new RegExp(
  `${quote}link${quote}\\s*,\\s*\\{[^}]{0,500}\\bhref\\s*:\\s*${quote}\\s*${remotePrefix}`,
  "iu",
);
const remoteImport = new RegExp(
  `@import\\s+(?:url\\(\\s*)?${quote}?\\s*${remotePrefix}`,
  "iu",
);
const remoteCssUrl = new RegExp(
  `url\\(\\s*${quote}?\\s*${remotePrefix}`,
  "iu",
);
// Anchored to url() targets: a base64 data: payload legitimately contains "//" (the alphabet
// includes "/"), so scanning the whole src value false-positives on inlined fonts. A remote font
// must appear as a url() target, and that position is what this matches.
const remoteFontFaceSource = new RegExp(
  `@font-face\\b[^}]*\\bsrc\\s*:[^}]*\\burl\\(\\s*${quote}?\\s*${remotePrefix}`,
  "isu",
);

const violations: string[] = [];
for (const chunk of javascriptChunks) {
  const bundle = readFileSync(resolve(repoRoot, chunk), "utf8");
  const lowerBundle = bundle.toLowerCase();
  for (const { label, parts } of forbiddenSignatures) {
    const signature = parts.join("");
    if (lowerBundle.includes(signature.toLowerCase())) {
      violations.push(`${chunk}: ${label} signature ${JSON.stringify(signature)}`);
    }
  }
  if (javascriptRemoteSrc.test(bundle)) violations.push(`${chunk}: remote src asset`);
  if (javascriptRemoteLink.test(bundle)) violations.push(`${chunk}: remote link asset`);
  if (remoteImport.test(bundle)) violations.push(`${chunk}: remote CSS import`);
  if (remoteCssUrl.test(bundle)) violations.push(`${chunk}: remote CSS URL`);
  if (remoteFontFaceSource.test(bundle)) violations.push(`${chunk}: remote font-face source`);
}

for (const path of htmlFiles) {
  const html = readFileSync(resolve(repoRoot, path), "utf8");
  if (htmlRemoteAsset.test(html)) violations.push(`${path}: remote HTML asset`);
  if (remoteImport.test(html)) violations.push(`${path}: remote CSS import`);
  if (remoteCssUrl.test(html)) violations.push(`${path}: remote CSS URL`);
  if (remoteFontFaceSource.test(html)) violations.push(`${path}: remote font-face source`);
}

for (const path of cssFiles) {
  const css = readFileSync(resolve(repoRoot, path), "utf8");
  if (remoteImport.test(css)) violations.push(`${path}: remote CSS import`);
  if (remoteCssUrl.test(css)) violations.push(`${path}: remote CSS URL`);
  if (remoteFontFaceSource.test(css)) violations.push(`${path}: remote font-face source`);
}

if (violations.length > 0) {
  throw new Error(
    `shipped bundle can initiate a remote call or load a remote asset:\n${violations.join("\n")}`,
  );
}

console.log(
  `Verified ${javascriptChunks.length} JavaScript, ${htmlFiles.length} HTML, and ` +
    `${cssFiles.length} CSS file(s): no network clients, model vendor, or remote assets.`,
);
