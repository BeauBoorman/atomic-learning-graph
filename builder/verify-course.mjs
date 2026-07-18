import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

function option(name) {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`${name} requires a path`);
  return resolve(process.argv[index + 1]);
}

/* The finished course legitimately embeds the teacher's FULL source text: Vite substitutes
 * __LEARNING_GRAPH__ (builder/vite.course.config.ts) into the bundle, and the minifier re-prints
 * it as one JS object literal (unquoted keys, template-literal strings — NOT the original JSON
 * bytes). A teacher's article may say "openai" or show "fetch(" in a quoted passage; that is
 * CONTENT, not code. The claim this verifier protects is "no network CODE in the shipped course",
 * so the negative scans run with that one payload excised. Excision is fail-closed twice over:
 * a region is exempted only when it is provably inert data — no parenthesis, no template
 * interpolation, and no tagged template outside string values, so no call expression can hide in
 * it — and when no such region is found, nothing is excised and every byte is scanned. */

// `start` points at "{". Returns the index one past the balanced "}" ONLY if the whole region is
// executable-code-free data; -1 otherwise (unbalanced, interpolated, called, or tagged).
function dataLiteralEnd(text, start) {
  let depth = 0;
  let quote = "";
  for (let i = start; i < text.length; i += 1) {
    const character = text[i];
    if (quote) {
      if (character === "\\") i += 1;
      else if (character === quote) quote = "";
      else if (quote === "`" && character === "$" && text[i + 1] === "{") return -1;
      continue;
    }
    if (character === "`" && /[\w$)\]]/u.test(text[i - 1] ?? "")) return -1;
    if (character === '"' || character === "'" || character === "`") quote = character;
    else if (character === "(") return -1;
    else if (character === "{") depth += 1;
    else if (character === "}") {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

// Anchor: the reader mounts <App graph={__LEARNING_GRAPH__}/> (src/ui/main.tsx), so the payload
// lands as a `graph:` property; property names survive minification.
export function withoutEmbeddedGraphPayload(html) {
  const anchor = /["'`]?\bgraph["'`]?\s*:\s*\{/gu;
  let scanned = "";
  let cursor = 0;
  for (let match = anchor.exec(html); match; match = anchor.exec(html)) {
    if (match.index < cursor) continue;
    const start = match.index + match[0].length - 1;
    const end = dataLiteralEnd(html, start);
    if (end < 0) continue;
    scanned += html.slice(cursor, start);
    cursor = end;
    anchor.lastIndex = end;
  }
  return scanned + html.slice(cursor);
}

export function verifyCourse(directory) {
  const entries = readdirSync(directory, { withFileTypes: true });
  if (entries.length !== 1 || entries[0].name !== "index.html" || !entries[0].isFile()) {
    throw new Error("offline course must contain exactly one index.html file");
  }
  const path = resolve(directory, "index.html");
  const html = readFileSync(path, "utf8");
  const problems = [];
  if (!/^\s*<!doctype html>/iu.test(html)) problems.push("missing doctype");
  if (!/<style\b[^>]*>[\s\S]*<\/style>/iu.test(html)) problems.push("missing inline CSS");
  if (!/<script\b(?![^>]*\bsrc\s*=)[^>]*>[\s\S]*<\/script>/iu.test(html)) problems.push("missing inline JavaScript");
  const scanned = withoutEmbeddedGraphPayload(html);
  if (/<\s*(?:base|link|script|img|iframe|audio|video|source|track|embed|input|object)\b[^>]*\b(?:href|src|srcset|poster|data)\s*=/iu.test(scanned)) {
    problems.push("contains a resource-loading HTML reference");
  }
  // data: URIs are inline bytes (KaTeX fonts), not a resource reference; all other url() forms
  // and every @import remain violations.
  if (/@import\s|\burl\s*\(\s*["'`]?\s*(?!data:)/iu.test(scanned)) problems.push("contains a CSS resource reference");
  for (const parts of [["fet", "ch("], ["XML", "HttpRequest"], ["Web", "Socket"], ["Event", "Source"], ["send", "Beacon"], ["open", "ai"]]) {
    if (scanned.toLowerCase().includes(parts.join("").toLowerCase())) problems.push(`contains ${parts.join("")} network client`);
  }
  if (problems.length) throw new Error(`offline course verification failed:\n${problems.join("\n")}`);
  return { path, bytes: statSync(path).size };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = verifyCourse(option("--out-dir"));
  console.log(`Verified one self-contained offline course (${result.bytes.toLocaleString("en-US")} bytes).`);
}
