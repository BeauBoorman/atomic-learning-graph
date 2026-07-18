import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

function option(name) {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`${name} requires a path`);
  return resolve(process.argv[index + 1]);
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
  if (/<\s*(?:base|link|script|img|iframe|audio|video|source|track|embed|input|object)\b[^>]*\b(?:href|src|srcset|poster|data)\s*=/iu.test(html)) {
    problems.push("contains a resource-loading HTML reference");
  }
  if (/@import\s|\burl\s*\(/iu.test(html)) problems.push("contains a CSS resource reference");
  for (const parts of [["fet", "ch("], ["XML", "HttpRequest"], ["Web", "Socket"], ["Event", "Source"], ["send", "Beacon"], ["open", "ai"]]) {
    if (html.toLowerCase().includes(parts.join("").toLowerCase())) problems.push(`contains ${parts.join("")} network client`);
  }
  if (problems.length) throw new Error(`offline course verification failed:\n${problems.join("\n")}`);
  return { path, bytes: statSync(path).size };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = verifyCourse(option("--out-dir"));
  console.log(`Verified one self-contained offline course (${result.bytes.toLocaleString("en-US")} bytes).`);
}
