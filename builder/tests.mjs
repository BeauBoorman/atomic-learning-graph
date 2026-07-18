import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PassThrough } from "node:stream";
import test from "node:test";
import { createOpenAIAtomizer } from "./atomizer.mjs";
import { createCourseBuilder } from "./build-course.mjs";
import { createCoursePackager } from "./package-course.mjs";
import { sanitizeBuildFailure } from "./server.mjs";
import { verifyCourse } from "./verify-course.mjs";
import { fixtureGraph, SOURCE_TEXT } from "../src/graph/fixture-graph.ts";

const repoRoot = resolve(import.meta.dirname, "..");
const temporaryDirectories = [];

async function temporaryDirectory() {
  const directory = await mkdtemp(join(tmpdir(), "atomic-builder-test-"));
  temporaryDirectories.push(directory);
  return directory;
}

async function fileContents(directory) {
  const values = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) values.push(...await fileContents(path));
    else values.push(await readFile(path, "utf8"));
  }
  return values;
}

async function digest(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

test.afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

test("OpenAI provider seam passes the key only through child memory and redacts progress", async () => {
  const secret = "sk-test-never-serialize-this-sentinel";
  const captured = {};
  const progress = [];
  const spawnImpl = (command, args, options) => {
    captured.command = command;
    captured.args = [...args];
    captured.apiKeyAtSpawn = options.env.OPENAI_API_KEY;
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    queueMicrotask(() => {
      child.stdout.end(`Using gpt-5.6-sol ${secret}\n`);
      child.stderr.end();
      child.emit("close", 0, null);
    });
    return child;
  };

  await createOpenAIAtomizer({ spawnImpl }).run({
    apiKey: secret,
    manifestPath: "/temporary/sources.json",
    outDir: "/temporary/out",
    onProgress: (event) => progress.push(event),
  });

  assert.equal(captured.command, "pnpm");
  assert.equal(captured.apiKeyAtSpawn, secret);
  assert.equal(captured.args.join(" ").includes(secret), false, "key must never enter argv");
  assert.equal(JSON.stringify(progress).includes(secret), false, "key must never enter progress output");
});

test("reader packager explicitly strips any ambient API key", async () => {
  const previous = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = "sk-test-ambient-key-must-not-reach-vite";
  const environments = [];
  try {
    const packager = createCoursePackager({
      runImpl: async (_command, _args, options) => environments.push({ ...options.env }),
    });
    await packager.run({ graphPath: "/temporary/graph.json", outDir: "/temporary/course" });
  } finally {
    if (previous === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = previous;
  }
  assert.equal(environments.length, 3);
  assert.ok(environments.every((environment) => environment.OPENAI_API_KEY === undefined));
});

test("fixture-backed build makes the real one-file reader without logging or writing the key", { timeout: 120_000 }, async () => {
  const secret = "sk-test-never-write-or-log-this-sentinel";
  const root = await temporaryDirectory();
  const pinnedGraphPath = resolve(repoRoot, "data", "graph.json");
  const pinnedRunPath = resolve(repoRoot, "data", "graph.run.json");
  const before = [await digest(pinnedGraphPath), await digest(pinnedRunPath)];
  const events = [];

  const mockAtomizer = {
    provider: "fixture",
    async run({ apiKey, outDir, onProgress }) {
      assert.equal(apiKey, secret, "the mock proves the one-build in-memory handoff");
      onProgress({ type: "engine", message: `A hostile child mentioned ${apiKey}` });
      await mkdir(outDir, { recursive: true });
      await writeFile(resolve(outDir, "graph.json"), `${JSON.stringify(fixtureGraph)}\n`);
    },
  };
  const build = createCourseBuilder({
    atomizer: mockAtomizer,
    packager: createCoursePackager(),
    makeTempDirectory: async () => root,
  });
  const result = await build({
    title: "Fixture course",
    author: "Test teacher",
    text: SOURCE_TEXT.repeat(2),
    apiKey: secret,
    ownedContentAccepted: true,
  }, (event) => events.push(event));

  const verified = verifyCourse(resolve(result.workDir, "course"));
  assert.ok(verified.bytes > 100_000, "the real reader should be embedded, not a placeholder");
  assert.equal(result.conceptCount, fixtureGraph.concepts.length);
  assert.match(await readFile(result.htmlPath, "utf8"), /Self-attention|self-attention/u);
  assert.equal(JSON.stringify(events).includes(secret), false, "key must never be logged or streamed");
  assert.equal((await fileContents(root)).some((contents) => contents.includes(secret)), false, "key must never be written anywhere in the temporary build tree");
  assert.deepEqual([await digest(pinnedGraphPath), await digest(pinnedRunPath)], before, "pinned product artifacts must remain byte-identical");
});

test("HTTP error boundary redacts a key even when a failing provider includes it", () => {
  const secret = "sk-test-http-redaction-sentinel";
  const output = sanitizeBuildFailure(new Error(`provider accidentally echoed ${secret}`), secret);
  assert.equal(output.includes(secret), false);
  assert.match(output, /\[redacted\]/u);
});

test("builder page exposes only the scoped plain-text GUI", async () => {
  const html = await readFile(resolve(repoRoot, "builder", "public", "index.html"), "utf8");
  assert.match(html, /Paste your source text/u);
  assert.match(html, /OpenAI API key/u);
  assert.match(html, /BUILD MY OFFLINE COURSE/u);
  assert.doesNotMatch(html, /type=["']file["']/u);
  assert.match(html, /plain text only/u);
});
