import { readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");
const outputDirectory = resolve(repoRoot, "dist-single");
const htmlPath = resolve(outputDirectory, "index.html");

function emittedAssetPath(reference: string): string {
  const withoutSuffix = reference.split(/[?#]/, 1)[0];
  if (
    withoutSuffix.length === 0 ||
    isAbsolute(withoutSuffix) ||
    /^[a-z][a-z\d+.-]*:/iu.test(withoutSuffix) ||
    withoutSuffix.startsWith("//")
  ) {
    throw new Error(`single-file inliner cannot inline non-local asset ${JSON.stringify(reference)}`);
  }

  const path = resolve(outputDirectory, withoutSuffix);
  const pathWithinOutput = relative(outputDirectory, path);
  if (pathWithinOutput === ".." || pathWithinOutput.startsWith("../") || isAbsolute(pathWithinOutput)) {
    throw new Error(`single-file inliner asset escapes dist-single: ${JSON.stringify(reference)}`);
  }
  return path;
}

let html = readFileSync(htmlPath, "utf8");
let scriptCount = 0;
let stylesheetCount = 0;
const inlinedAssets = new Set<string>();

html = html.replace(
  /<script\b([^>]*?)\bsrc\s*=\s*(["'])([^"']+)\2([^>]*)>\s*<\/script>/giu,
  (_tag, before: string, _quote: string, reference: string, after: string) => {
    scriptCount += 1;
    const assetPath = emittedAssetPath(reference);
    inlinedAssets.add(assetPath);
    const javascript = readFileSync(assetPath, "utf8").replace(
      /<\/script/giu,
      "<\\/script",
    );
    return `<script${before}${after}>${javascript}</script>`;
  },
);

html = html.replace(/<link\b[^>]*>/giu, (tag) => {
  const rel = tag.match(/\brel\s*=\s*(["'])([^"']+)\1/iu)?.[2];
  const reference = tag.match(/\bhref\s*=\s*(["'])([^"']+)\1/iu)?.[2];
  if (rel?.toLowerCase() !== "stylesheet" || reference === undefined) return tag;

  stylesheetCount += 1;
  const assetPath = emittedAssetPath(reference);
  inlinedAssets.add(assetPath);
  const css = readFileSync(assetPath, "utf8").replace(/<\/style/giu, "<\\/style");
  return `<style>${css}</style>`;
});

if (scriptCount !== 1 || stylesheetCount !== 1) {
  throw new Error(
    `single-file inliner expected one emitted script and stylesheet; found ${scriptCount} script(s) ` +
      `and ${stylesheetCount} stylesheet(s)`,
  );
}

function emittedFiles(directory: string, parent = ""): string[] {
  return readdirSync(resolve(directory, parent), { withFileTypes: true }).flatMap((entry) => {
    const path = parent.length === 0 ? entry.name : `${parent}/${entry.name}`;
    return entry.isDirectory() ? emittedFiles(directory, path) : [resolve(directory, path)];
  });
}

const expectedFiles = new Set([htmlPath, ...inlinedAssets]);
const unexpectedFiles = emittedFiles(outputDirectory).filter((path) => !expectedFiles.has(path));
if (unexpectedFiles.length > 0) {
  throw new Error(
    `single-file inliner refuses unexpected emitted asset(s): ${unexpectedFiles
      .map((path) => relative(repoRoot, path))
      .join(", ")}`,
  );
}

writeFileSync(htmlPath, html);
for (const entry of readdirSync(outputDirectory)) {
  if (entry !== "index.html") rmSync(resolve(outputDirectory, entry), { recursive: true, force: true });
}

console.log(`Inlined JavaScript and CSS into ${relative(repoRoot, htmlPath)}.`);
