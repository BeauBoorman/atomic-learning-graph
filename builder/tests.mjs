import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PassThrough } from "node:stream";
import test from "node:test";
import { createAtomizer } from "./atomizer.mjs";
import { createCourseBuilder, validateBuildInput } from "./build-course.mjs";
import { createCoursePackager } from "./package-course.mjs";
import { createProviderFetch } from "./provider-fetch.mjs";
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

function mockChild({ stdout = "", stderr = "", code = 0 } = {}) {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  queueMicrotask(() => {
    child.stdout.end(stdout);
    child.stderr.end(stderr);
    child.emit("close", code, null);
  });
  return child;
}

test("OpenAI provider seam passes the key only through child memory and redacts progress", async () => {
  const secret = "sk-test-never-serialize-this-sentinel";
  const captured = {};
  const progress = [];
  const spawnImpl = (command, args, options) => {
    captured.command = command;
    captured.args = [...args];
    captured.apiKeyAtSpawn = options.env.OPENAI_API_KEY;
    captured.modelAtSpawn = options.env.OPENAI_MODEL;
    captured.environment = options.env;
    return mockChild({ stdout: `Using gpt-5.6-sol ${secret}\n` });
  };

  const atomizer = createAtomizer({
    provider: "openai",
    apiKey: secret,
    model: "gpt-5.6-sol",
    spawnImpl,
  });
  await atomizer.run({
    manifestPath: "/temporary/sources.json",
    outDir: "/temporary/out",
    onProgress: (event) => progress.push(event),
  });

  assert.equal(captured.command, "pnpm");
  assert.equal(captured.apiKeyAtSpawn, secret);
  assert.equal(captured.modelAtSpawn, "gpt-5.6-sol");
  assert.equal(captured.args.join(" ").includes(secret), false, "key must never enter argv");
  assert.equal(JSON.stringify(progress).includes(secret), false, "key must never enter progress output");
  assert.equal(captured.environment.OPENAI_API_KEY, undefined, "parent must clear its child-environment copy after spawn");
  atomizer.dispose();
});

for (const configuration of [
  { provider: "anthropic", model: "claude-opus-4-8" },
  { provider: "openai-compatible", model: "trusted-local-model", baseUrl: "http://127.0.0.1:11434/v1" },
]) {
  test(`${configuration.provider} provider seam keeps the key out of argv, progress, and errors`, async () => {
    const secret = `test-${configuration.provider}-key-never-expose`;
    const captures = [];
    const progress = [];
    const atomizer = createAtomizer({
      ...configuration,
      apiKey: secret,
      spawnImpl(command, args, options) {
        captures.push({ command, args: [...args], apiKey: options.env.OPENAI_API_KEY, environment: options.env });
        return mockChild({
          stdout: `Using ${configuration.model} ${secret}\n`,
          stderr: `provider failure echoed ${secret}\n`,
          code: captures.length === 1 ? 0 : 1,
        });
      },
    });

    await atomizer.run({
      manifestPath: "/temporary/sources.json",
      outDir: "/temporary/out",
      onProgress: (event) => progress.push(event),
    });
    await assert.rejects(
      atomizer.run({ manifestPath: "/temporary/sources.json", outDir: "/temporary/out" }),
      (error) => error instanceof Error && !error.message.includes(secret) && error.message.includes("[redacted]"),
    );

    assert.ok(captures.every(({ apiKey }) => apiKey === secret), "key reaches only the spawned process environment");
    assert.ok(captures.every(({ args }) => !args.join(" ").includes(secret)), "key must never enter argv");
    assert.equal(JSON.stringify(progress).includes(secret), false, "key must never enter progress output");
    assert.ok(captures.every(({ environment }) => environment.OPENAI_API_KEY === undefined));
    atomizer.dispose();
  });
}

test("Anthropic Messages adapter sends structured output server-side and redacts provider errors", async () => {
  const secret = "anthropic-test-key-never-return";
  const requests = [];
  const providerFetch = createProviderFetch({
    provider: "anthropic",
    model: "claude-opus-4-8",
    fetchImpl: async (url, init) => {
      requests.push({ url: String(url), init, body: JSON.parse(String(init.body)) });
      if (requests.length === 2) {
        return Response.json({ error: { message: `bad credential ${secret}` } }, { status: 401 });
      }
      return Response.json({
        id: "msg_fixture",
        model: "claude-opus-4-8",
        content: [{ type: "text", text: "{\"ok\":true}" }],
      });
    },
  });
  const request = {
    model: "ignored-engine-model",
    instructions: "Return the object.",
    input: "Set ok true.",
    max_output_tokens: 500,
    text: { format: { type: "json_schema", name: "probe", strict: true, schema: { type: "object" } } },
  };
  const headers = { authorization: `Bearer ${secret}`, "content-type": "application/json" };

  const response = await providerFetch("https://api.openai.com/v1/responses", { method: "POST", headers, body: JSON.stringify(request) });
  const converted = await response.json();
  assert.equal(requests[0].url, "https://api.anthropic.com/v1/messages");
  assert.equal(requests[0].init.headers["x-api-key"], secret);
  assert.equal(requests[0].init.headers.authorization, undefined);
  assert.deepEqual(requests[0].body.output_config.format, { type: "json_schema", schema: { type: "object" } });
  assert.equal(converted.output[0].content[0].text, "{\"ok\":true}");

  const failed = await providerFetch("https://api.openai.com/v1/responses", { method: "POST", headers, body: JSON.stringify(request) });
  assert.equal(JSON.stringify(await failed.json()).includes(secret), false, "Anthropic errors must redact the key");
});

test("OpenAI-compatible adapter uses the chosen base URL and redacts provider errors", async () => {
  const secret = "compatible-test-key-never-return";
  const requests = [];
  const providerFetch = createProviderFetch({
    provider: "openai-compatible",
    model: "trusted-model",
    baseUrl: "http://127.0.0.1:11434/v1/",
    fetchImpl: async (url, init) => {
      requests.push({ url: String(url), init, body: JSON.parse(String(init.body)) });
      if (requests.length === 2) return Response.json({ error: { message: secret } }, { status: 500 });
      return Response.json({
        id: "chatcmpl_fixture",
        model: "trusted-model",
        choices: [{ message: { role: "assistant", content: "{\"ok\":true}" } }],
      });
    },
  });
  const request = {
    instructions: "Return the object.",
    input: "Set ok true.",
    max_output_tokens: 500,
    text: { format: { type: "json_schema", name: "probe", strict: true, schema: { type: "object" } } },
  };
  const headers = { authorization: `Bearer ${secret}`, "content-type": "application/json" };

  const response = await providerFetch("https://api.openai.com/v1/responses", { method: "POST", headers, body: JSON.stringify(request) });
  const converted = await response.json();
  assert.equal(requests[0].url, "http://127.0.0.1:11434/v1/chat/completions");
  assert.equal(requests[0].init.headers.authorization, `Bearer ${secret}`);
  assert.equal(requests[0].body.model, "trusted-model");
  assert.equal(requests[0].body.response_format.json_schema.name, "probe");
  assert.equal(converted.output[0].content[0].text, "{\"ok\":true}");

  const failed = await providerFetch("https://api.openai.com/v1/responses", { method: "POST", headers, body: JSON.stringify(request) });
  assert.equal(JSON.stringify(await failed.json()).includes(secret), false, "compatible-endpoint errors must redact the key");
});

test("provider input validation fails closed on unknown providers and unsafe endpoint configuration", () => {
  const input = {
    title: "Course",
    author: "Teacher",
    text: SOURCE_TEXT.repeat(2),
    apiKey: "valid-test-api-key",
    model: "high-quality-model",
    ownedContentAccepted: true,
  };
  assert.throws(() => validateBuildInput({ ...input, provider: "mystery" }), /supported model provider/u);
  assert.throws(
    () => validateBuildInput({ ...input, provider: "openai-compatible", baseUrl: "file:///tmp/provider" }),
    /HTTP\(S\) base URL/u,
  );
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

  const build = createCourseBuilder({
    atomizerFactory(configuration) {
      assert.equal(configuration.apiKey, secret, "the mock proves the one-build in-memory handoff");
      return {
        provider: "fixture",
        async run({ outDir, onProgress }) {
          onProgress({ type: "engine", message: `A hostile child mentioned ${configuration.apiKey}` });
          await mkdir(outDir, { recursive: true });
          await writeFile(resolve(outDir, "graph.json"), `${JSON.stringify(fixtureGraph)}\n`);
        },
      };
    },
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

for (const provider of ["anthropic", "openai-compatible"]) {
  test(`${provider} fixture build never logs or persists the provider key`, async () => {
    const secret = `${provider}-fixture-key-never-persist`;
    const root = await temporaryDirectory();
    const events = [];
    let disposed = false;
    const build = createCourseBuilder({
      atomizerFactory(configuration) {
        assert.equal(configuration.provider, provider);
        assert.equal(configuration.apiKey, secret);
        return {
          async run({ outDir, onProgress }) {
            onProgress({ type: "engine", message: `hostile provider output ${secret}` });
            await mkdir(outDir, { recursive: true });
            await writeFile(resolve(outDir, "graph.json"), `${JSON.stringify(fixtureGraph)}\n`);
          },
          dispose() { disposed = true; },
        };
      },
      packager: {
        async run({ outDir }) {
          await mkdir(outDir, { recursive: true });
          await writeFile(resolve(outDir, "index.html"), "<!doctype html><title>fixture</title>");
        },
      },
      makeTempDirectory: async () => root,
    });

    await build({
      provider,
      model: provider === "anthropic" ? "claude-opus-4-8" : "trusted-model",
      baseUrl: provider === "openai-compatible" ? "http://127.0.0.1:11434/v1" : "",
      title: "Fixture course",
      author: "Test teacher",
      text: SOURCE_TEXT.repeat(2),
      apiKey: secret,
      ownedContentAccepted: true,
    }, (event) => events.push(event));

    assert.equal(disposed, true, "provider closure must discard its credential after atomization");
    assert.equal(JSON.stringify(events).includes(secret), false, "provider key must never be logged or streamed");
    assert.equal((await fileContents(root)).some((contents) => contents.includes(secret)), false, "provider key must never be persisted");
  });
}

test("HTTP error boundary redacts a key even when a failing provider includes it", () => {
  const secret = "sk-test-http-redaction-sentinel";
  const output = sanitizeBuildFailure(new Error(`provider accidentally echoed ${secret}`), secret);
  assert.equal(output.includes(secret), false);
  assert.match(output, /\[redacted\]/u);
});

test("builder page exposes only the scoped plain-text GUI", async () => {
  const html = await readFile(resolve(repoRoot, "builder", "public", "index.html"), "utf8");
  assert.match(html, /Paste your source text/u);
  assert.match(html, /Choose your model provider/u);
  assert.match(html, /OpenAI-compatible/u);
  assert.match(html, /Recommended: a high-quality model/u);
  assert.match(html, /costs only cents/u);
  assert.match(html, /BUILD MY OFFLINE COURSE/u);
  assert.doesNotMatch(html, /type=["']file["']/u);
  assert.match(html, /plain text only/u);
  assert.doesNotMatch(html, /fetch\(["']https?:\/\/(?:api\.openai\.com|api\.anthropic\.com)/u, "provider calls must never be made by browser code");
});
