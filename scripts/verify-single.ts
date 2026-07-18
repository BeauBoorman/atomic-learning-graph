// THE STANDALONE-FILE GATE.
//
// This verifier owns the stronger packaging boundary for dist-single/index.html: not merely no
// remote network loads, but no second file and no resource-loading HTML/CSS reference of any kind.
// The source-link anchors embedded in the reader remain ordinary optional hyperlinks; they are not
// fetched to start or use the app. As in verify-bundle.ts, poison strings are assembled so this
// verifier does not trip over its own source if the scan boundary ever widens.

import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { relative, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");
const defaultArtifactDirectory = resolve(repoRoot, "dist-single");

const forbiddenSignatures = [
  { label: "request client", parts: ["fet", "ch("] },
  { label: "XHR client", parts: ["XML", "HttpRequest"] },
  { label: "socket client", parts: ["Web", "Socket"] },
  { label: "event-stream client", parts: ["Event", "Source"] },
  { label: "beacon client", parts: ["send", "Beacon"] },
  { label: "model vendor", parts: ["open", "ai"] },
] as const;

const resourceAttribute = new RegExp(
  `<\\s*(?:base|link|script|img|iframe|audio|video|source|track|embed|input|object)\\b` +
    `[^>]*\\b(?:href|src|srcset|poster|data)\\s*=`,
  "iu",
);
const javascriptResourceElement = new RegExp(
  `["'\\u0060](?:base|link|script|img|iframe|audio|video|source|track|embed|input|object)` +
    `["'\\u0060]\\s*,\\s*\\{[^}]{0,1000}\\b(?:href|src|srcset|poster|data)\\s*:`,
  "iu",
);
const cssImport = new RegExp(["@im", "port\\s"].join(""), "iu");
const cssUrl = new RegExp(["\\bur", "l\\s*\\("].join(""), "iu");

function artifactEntries(directory: string, parent = ""): string[] {
  return readdirSync(resolve(directory, parent), { withFileTypes: true }).flatMap((entry) => {
    const path = parent.length === 0 ? entry.name : `${parent}/${entry.name}`;
    return entry.isDirectory() ? artifactEntries(directory, path) : [path];
  });
}

export function verifySingleArtifact(artifactDirectory: string = defaultArtifactDirectory): void {
  const files = artifactEntries(artifactDirectory);
  if (files.length !== 1 || files[0] !== "index.html") {
    throw new Error(
      `single-file verification expected exactly one file named index.html; found ${JSON.stringify(files.sort())}`,
    );
  }

  const htmlPath = resolve(artifactDirectory, "index.html");
  const html = readFileSync(htmlPath, "utf8");
  const violations: string[] = [];

  if (!/^\s*<!doctype html>/iu.test(html)) violations.push("missing HTML doctype");
  if (!/<style\b[^>]*>[\s\S]*<\/style>/iu.test(html)) violations.push("missing inline CSS");
  if (!/<script\b(?![^>]*\bsrc\s*=)[^>]*>[\s\S]*<\/script>/iu.test(html)) {
    violations.push("missing inline JavaScript");
  }
  if (resourceAttribute.test(html)) violations.push("external resource reference");
  if (javascriptResourceElement.test(html)) {
    violations.push("external resource reference created by JavaScript");
  }
  if (cssImport.test(html)) violations.push("external resource reference: CSS import");
  if (cssUrl.test(html)) violations.push("external resource reference: CSS URL");

  const lowerHtml = html.toLowerCase();
  for (const { label, parts } of forbiddenSignatures) {
    const signature = parts.join("");
    if (lowerHtml.includes(signature.toLowerCase())) {
      violations.push(`network client or model signature: ${label} ${JSON.stringify(signature)}`);
    }
  }

  if (violations.length > 0) {
    throw new Error(`standalone HTML is not self-contained:\n${violations.join("\n")}`);
  }

  const size = statSync(htmlPath).size;
  console.log(
    `Verified ${relative(repoRoot, htmlPath)} (${size.toLocaleString("en-US")} bytes): one HTML ` +
      `file, inline CSS/JavaScript, no resource references, network clients, or model vendor.`,
  );
}

function main(): void {
  const artifactOnly = process.argv.slice(2).includes("--artifact-only");
  if (!artifactOnly) {
    execFileSync("pnpm", ["build:single"], { cwd: repoRoot, stdio: "inherit" });
  }
  verifySingleArtifact();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main();
