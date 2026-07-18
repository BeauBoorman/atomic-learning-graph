import { readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

function option(name) {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`${name} requires a path`);
  return resolve(process.argv[index + 1]);
}

const outputDirectory = option("--out-dir");
const htmlPath = resolve(outputDirectory, "index.html");

function assetPath(reference) {
  const clean = reference.split(/[?#]/u, 1)[0];
  if (!clean || isAbsolute(clean) || /^[a-z][a-z\d+.-]*:/iu.test(clean) || clean.startsWith("//")) {
    throw new Error(`course inliner refuses non-local asset ${JSON.stringify(reference)}`);
  }
  const path = resolve(outputDirectory, clean);
  const within = relative(outputDirectory, path);
  if (within === ".." || within.startsWith("../") || isAbsolute(within)) {
    throw new Error(`course inliner asset escapes output: ${JSON.stringify(reference)}`);
  }
  return path;
}

let html = readFileSync(htmlPath, "utf8");
const inlined = new Set();
let scripts = 0;
let stylesheets = 0;

html = html.replace(/<script\b([^>]*?)\bsrc\s*=\s*(["'])([^"']+)\2([^>]*)>\s*<\/script>/giu, (_tag, before, _quote, reference, after) => {
  scripts += 1;
  const path = assetPath(reference);
  inlined.add(path);
  return `<script${before}${after}>${readFileSync(path, "utf8").replace(/<\/script/giu, "<\\/script")}</script>`;
});

html = html.replace(/<link\b[^>]*>/giu, (tag) => {
  const rel = tag.match(/\brel\s*=\s*(["'])([^"']+)\1/iu)?.[2];
  const reference = tag.match(/\bhref\s*=\s*(["'])([^"']+)\1/iu)?.[2];
  if (rel?.toLowerCase() !== "stylesheet" || !reference) return tag;
  stylesheets += 1;
  const path = assetPath(reference);
  inlined.add(path);
  return `<style>${readFileSync(path, "utf8").replace(/<\/style/giu, "<\\/style")}</style>`;
});

if (scripts !== 1 || stylesheets !== 1) {
  throw new Error(`course inliner expected one script and one stylesheet; found ${scripts} and ${stylesheets}`);
}

function files(directory, parent = "") {
  return readdirSync(resolve(directory, parent), { withFileTypes: true }).flatMap((entry) => {
    const path = parent ? `${parent}/${entry.name}` : entry.name;
    return entry.isDirectory() ? files(directory, path) : [resolve(directory, path)];
  });
}

const expected = new Set([htmlPath, ...inlined]);
const unexpected = files(outputDirectory).filter((path) => !expected.has(path));
if (unexpected.length) throw new Error(`course inliner refuses unexpected assets: ${unexpected.join(", ")}`);

writeFileSync(htmlPath, html);
for (const entry of readdirSync(outputDirectory)) {
  if (entry !== "index.html") rmSync(resolve(outputDirectory, entry), { recursive: true, force: true });
}
