import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PassThrough, Readable } from "node:stream";
import test from "node:test";
import { createAtomizer } from "./atomizer.mjs";
import { createCourseBuilder, validateBuildInput, MINIMUM_TEXT_LENGTH } from "./build-course.mjs";
import { createCoursePackager } from "./package-course.mjs";
import { createProviderFetch } from "./provider-fetch.mjs";
import { createBuilderServer, sanitizeBuildFailure } from "./server.mjs";
import { verifyCourse, withoutEmbeddedGraphPayload } from "./verify-course.mjs";
import { estimateAtomizationCosts } from "../src/cost/estimator.ts";
import { ResponsesClient } from "../src/atomization/client.ts";
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

function decodeWindowsPnpmArgs(commandArgs) {
  const script = commandArgs.at(-1);
  const payload = script.match(/FromBase64String\('([^']+)'\)/u)?.[1];
  assert.ok(payload, "the Windows launcher must carry an encoded argv payload");
  return JSON.parse(Buffer.from(payload, "base64").toString("utf16le"));
}

async function requestServer(server, { method, path, body }) {
  const request = Readable.from([Buffer.from(JSON.stringify(body))]);
  request.method = method;
  request.url = path;
  return new Promise((resolveRequest) => {
    const chunks = [];
    const response = {
      statusCode: 200,
      headers: {},
      setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
      writeHead(statusCode, headers = {}) {
        this.statusCode = statusCode;
        for (const [name, value] of Object.entries(headers)) this.setHeader(name, value);
        return this;
      },
      write(chunk) { chunks.push(Buffer.from(chunk)); return true; },
      end(chunk) {
        if (chunk) chunks.push(Buffer.from(chunk));
        resolveRequest({
          status: this.statusCode,
          headers: this.headers,
          text: Buffer.concat(chunks).toString("utf8"),
        });
      },
    };
    server.emit("request", request, response);
  });
}

test("estimate endpoint returns cross-model costs without a key or model-backed build", async () => {
  let buildCalls = 0;
  const server = createBuilderServer({
    courseBuilder: async () => {
      buildCalls += 1;
      throw new Error("the estimate route must never enter the model-backed build path");
    },
  });

  const text = "A grounded sample lesson about vectors and attention. ".repeat(80);
  const response = await requestServer(server, {
    method: "POST",
    path: "/api/estimate",
    body: { text },
  });

  assert.equal(response.status, 200);
  const payload = JSON.parse(response.text);
  assert.deepEqual(payload.estimates, estimateAtomizationCosts(text));
  assert.equal(payload.estimates.length, 3);
  assert.ok(payload.estimates.every((estimate) => estimate.estimatedUsdTotal > 0));
  assert.ok(payload.estimates[0].estimatedUsdTotal > payload.estimates.at(-1).estimatedUsdTotal);
  assert.equal(buildCalls, 0, "estimating must not invoke the model-backed course builder");
});

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

  assert.equal(captured.command, process.platform === "win32" ? "powershell.exe" : "pnpm");
  assert.equal(captured.apiKeyAtSpawn, secret);
  assert.equal(captured.modelAtSpawn, "gpt-5.6-sol");
  assert.equal(captured.args.join(" ").includes(secret), false, "key must never enter argv");
  assert.equal(JSON.stringify(progress).includes(secret), false, "key must never enter progress output");
  assert.equal(captured.environment.OPENAI_API_KEY, undefined, "parent must clear its child-environment copy after spawn");
  atomizer.dispose();
});

test("Windows atomizer invokes pnpm through PowerShell without flattening paths into a command string", async () => {
  const manifestPath = String.raw`C:\Users\Beau Boorman\Atomic Course\sources.json`;
  const outDir = String.raw`C:\Users\Beau Boorman\Atomic Course\generated output`;
  const captured = {};
  const atomizer = createAtomizer({
    provider: "openai",
    apiKey: "sk-test-windows-command-form",
    model: "gpt-5.6-sol",
    platform: "win32",
    spawnImpl(command, args, options) {
      Object.assign(captured, { command, args: [...args], options });
      return mockChild();
    },
  });

  await atomizer.run({ manifestPath, outDir });

  assert.equal(captured.command, "powershell.exe");
  assert.deepEqual(captured.args.slice(0, -1), [
    "-NoLogo",
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
  ]);
  assert.deepEqual(decodeWindowsPnpmArgs(captured.args), [
    "exec",
    "tsx",
    "src/atomization/atomize.ts",
    "--manifest",
    manifestPath,
    "--out-dir",
    outDir,
    "--no-spine",
  ]);
  assert.equal(captured.args.at(-1).includes(manifestPath), false, "paths must not be interpolated into shell source");
  assert.equal(captured.options.shell, undefined, "the encoded argv must reach an explicit shell executable without shell re-parsing");
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
  assert.deepEqual(converted.usage, {
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0,
    estimated: true,
    estimate_reason: "provider-usage-unavailable",
  });

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
  assert.deepEqual(converted.usage, {
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0,
    estimated: true,
    estimate_reason: "provider-usage-unavailable",
  });

  const failed = await providerFetch("https://api.openai.com/v1/responses", { method: "POST", headers, body: JSON.stringify(request) });
  assert.equal(JSON.stringify(await failed.json()).includes(secret), false, "compatible-endpoint errors must redact the key");
});

for (const fixture of [
  {
    provider: "anthropic",
    model: "claude-opus-4-8",
    inputTokens: 17,
    outputTokens: 5,
    response: {
      id: "msg_usage_fixture",
      model: "claude-opus-4-8",
      content: [{ type: "text", text: "{\"ok\":true}" }],
      usage: { input_tokens: 17, output_tokens: 5 },
    },
  },
  {
    provider: "openai-compatible",
    model: "trusted-model",
    baseUrl: "http://127.0.0.1:11434/v1",
    inputTokens: 19,
    outputTokens: 7,
    response: {
      id: "chatcmpl_usage_fixture",
      model: "trusted-model",
      choices: [{ message: { role: "assistant", content: "{\"ok\":true}" } }],
      usage: { prompt_tokens: 19, completion_tokens: 7, total_tokens: 26 },
    },
  },
]) {
  test(`${fixture.provider} response completes through real usage accounting`, { concurrency: false }, async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = createProviderFetch({
        provider: fixture.provider,
        model: fixture.model,
        baseUrl: fixture.baseUrl,
        fetchImpl: async () => Response.json(fixture.response),
      });
      const client = new ResponsesClient("provider-test-key");
      client.model = fixture.model;

      const result = await client.request(
        "Return the object.",
        "Set ok true.",
        { type: "object" },
        "provider_usage_probe",
      );

      assert.deepEqual(result, { ok: true });
      assert.deepEqual(client.usageTokens, {
        input: fixture.inputTokens,
        output: fixture.outputTokens,
        total: fixture.inputTokens + fixture.outputTokens,
      });
      assert.ok(client.usageTokens.total > 0, "provider usage must survive the adapter as a real billed total");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
}

test("provider response without usage degrades through accounting with an explicit zero estimate", { concurrency: false }, async () => {
  const originalFetch = globalThis.fetch;
  const providerFetch = createProviderFetch({
    provider: "anthropic",
    model: "claude-opus-4-8",
    fetchImpl: async () => Response.json({
      id: "msg_missing_usage_fixture",
      model: "claude-opus-4-8",
      content: [{ type: "text", text: "{\"ok\":true}" }],
    }),
  });
  try {
    globalThis.fetch = async (...args) => {
      const response = await providerFetch(...args);
      const converted = await response.clone().json();
      assert.equal(converted.usage.estimated, true);
      assert.equal(converted.usage.estimate_reason, "provider-usage-unavailable");
      return response;
    };
    const client = new ResponsesClient("provider-test-key");
    client.model = "claude-opus-4-8";

    assert.deepEqual(
      await client.request("Return the object.", "Set ok true.", { type: "object" }, "missing_usage_probe"),
      { ok: true },
    );
    assert.deepEqual(client.usageTokens, { input: 0, output: 0, total: 0 });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("provider input validation fails closed on unknown providers and unsafe endpoint configuration", () => {
  const input = {
    title: "Course",
    author: "Teacher",
    text: SOURCE_TEXT.repeat(40),
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
  assert.equal(environments.length, 4);
  assert.ok(environments.every((environment) => environment.OPENAI_API_KEY === undefined));
});

test("Windows course packager uses the same argv-safe pnpm launcher", async () => {
  const calls = [];
  const graphPath = String.raw`C:\Users\Beau Boorman\Atomic Course\graph.json`;
  const outDir = String.raw`C:\Users\Beau Boorman\Atomic Course\offline reader`;
  const packager = createCoursePackager({
    platform: "win32",
    runImpl: async (command, args, options) => calls.push({ command, args, options }),
  });

  await packager.run({ graphPath, outDir });

  assert.equal(calls[0].command, "powershell.exe");
  assert.deepEqual(decodeWindowsPnpmArgs(calls[0].args), [
    "exec",
    "vite",
    "build",
    "--config",
    "builder/vite.course.config.ts",
  ]);
  assert.equal(calls[0].options.env.BUILDER_GRAPH_PATH, graphPath);
  assert.equal(calls[0].options.env.BUILDER_COURSE_OUT_DIR, outDir);
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
    text: SOURCE_TEXT.repeat(40),
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
      text: SOURCE_TEXT.repeat(40),
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

test("input floor matches the engine's six-grounded-concept refusal on both client and server", () => {
  const input = {
    title: "Course",
    author: "Teacher",
    apiKey: "valid-test-api-key",
    model: "high-quality-model",
    ownedContentAccepted: true,
  };
  assert.equal(MINIMUM_TEXT_LENGTH, 12_000);
  assert.throws(
    () => validateBuildInput({ ...input, text: "x".repeat(MINIMUM_TEXT_LENGTH - 1) }),
    /12,000 characters — about five pages[\s\S]*fewer than six grounded concepts[\s\S]*already been charged/u,
    "a judge-sized paste must be refused BEFORE any paid model call, with the reason",
  );
  assert.equal(validateBuildInput({ ...input, text: "x".repeat(MINIMUM_TEXT_LENGTH) }).text.length, MINIMUM_TEXT_LENGTH);
});

test("builder page pins the same input floor and explains it", async () => {
  const html = await readFile(resolve(repoRoot, "builder", "public", "index.html"), "utf8");
  assert.match(html, new RegExp(`minlength="${MINIMUM_TEXT_LENGTH}"`, "u"), "textarea minlength must match the server floor");
  assert.match(html, /about five pages/u);
  assert.match(html, /fewer than six grounded concepts/u);
  assert.match(html, /already been charged/u);
});

test("verifier exempts pasted-content mentions of network APIs but never network code", async () => {
  const directory = await temporaryDirectory();
  const path = resolve(directory, "index.html");
  // Mirrors the real bundle shape (verified empirically): the minifier re-prints the
  // __LEARNING_GRAPH__ define as an object literal with unquoted keys and template-literal strings.
  const payload = "graph:{concepts:[{id:`a`,provenance:{quotedText:`OpenAI docs say call fetch(url) or url(http://x) via XMLHttpRequest`}}]}";
  const page = (script) => `<!doctype html><html><head><style>body{color:#111}</style></head><body><script>${script}</script></body></html>`;

  await writeFile(path, page(`var mount={${payload}};render(mount)`));
  const verified = verifyCourse(directory);
  assert.ok(verified.bytes > 0, "content mentioning openai/fetch(/url( must pass — it is data, not code");

  // A graph-shaped region that CONTAINS code must not be exempted.
  await writeFile(path, page("var mount={graph:{concepts:fetch(`https://api.example`)}};render(mount)"));
  assert.throws(() => verifyCourse(directory), /fetch\(/u, "a call expression inside a graph-shaped region must still fail");

  // Real network code OUTSIDE the payload must still fail even when a payload is excised.
  await writeFile(path, page(`var mount={${payload}};fetch("https://api.example")`));
  assert.throws(() => verifyCourse(directory), /fetch\(/u);

  // Template interpolation is code — the region must not be exempted.
  assert.equal(
    withoutEmbeddedGraphPayload("graph:{a:`x${fetch(`u`)}`}").includes("fetch("),
    true,
    "an interpolated template inside the region must keep the region in the scanned bytes",
  );
});

test("verifier passes a REAL built course whose pasted text mentions openai and fetch(", { timeout: 180_000 }, async () => {
  const root = await temporaryDirectory();
  const trap = " Reviewers at OpenAI note that developers write fetch(url) and CSS url(images/x.png) daily.";
  const graph = structuredClone(fixtureGraph);
  graph.sources[0].text += trap;

  const graphPath = resolve(root, "graph.json");
  const outDir = resolve(root, "course");
  await writeFile(graphPath, `${JSON.stringify(graph)}\n`);
  // The packager's third step runs verify-course.mjs itself, so completing IS the pass assertion.
  await createCoursePackager().run({ graphPath, outDir });
  verifyCourse(outDir);

  // The same course with one real network call injected outside the payload must fail post-build.
  const htmlPath = resolve(outDir, "index.html");
  const html = await readFile(htmlPath, "utf8");
  await writeFile(htmlPath, html.replace("</body>", '<script>fetch("https://exfil.example")</script></body>'));
  assert.throws(() => verifyCourse(outDir), /fetch\(/u);
});

test("silent engine phases surface a truthful elapsed-time heartbeat, capped per repeat window", async () => {
  const progress = [];
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  const atomizer = createAtomizer({
    provider: "openai",
    apiKey: "sk-test-heartbeat-sentinel",
    model: "gpt-5.6-sol",
    heartbeatQuietMs: 40,
    heartbeatRepeatMs: 80,
    spawnImpl: () => child,
  });
  const run = atomizer.run({
    manifestPath: "/temporary/sources.json",
    outDir: "/temporary/out",
    onProgress: (event) => progress.push(event),
  });
  await new Promise((resolveWait) => setTimeout(resolveWait, 400));
  child.stdout.end();
  child.stderr.end();
  child.emit("close", 0, null);
  await run;

  const heartbeats = progress.filter((event) => /^Still working — \d+s since the last engine message\./u.test(event.message));
  assert.ok(heartbeats.length >= 2, `silence must surface repeated heartbeats (got ${heartbeats.length})`);
  assert.ok(heartbeats.length <= 6, `heartbeats must be capped to one per repeat window (got ${heartbeats.length})`);
  assert.equal(progress.length, heartbeats.length, "no fabricated progress beyond truthful elapsed-time rows");
  atomizer.dispose();
});

test("a steadily-reporting engine gets no heartbeat rows", async () => {
  const progress = [];
  const atomizer = createAtomizer({
    provider: "openai",
    apiKey: "sk-test-no-heartbeat",
    model: "gpt-5.6-sol",
    heartbeatQuietMs: 40,
    heartbeatRepeatMs: 80,
    spawnImpl: () => mockChild({ stdout: "Translating 1/2: vectors\nTranslating 2/2: softmax\n" }),
  });
  await atomizer.run({
    manifestPath: "/temporary/sources.json",
    outDir: "/temporary/out",
    onProgress: (event) => progress.push(event),
  });
  assert.equal(progress.filter((event) => /Still working/u.test(event.message)).length, 0);
  atomizer.dispose();
});

test("builder page exposes only the scoped plain-text GUI", async () => {
  const html = await readFile(resolve(repoRoot, "builder", "public", "index.html"), "utf8");
  assert.match(html, /Paste your source text/u);
  assert.match(html, /Choose your model provider/u);
  assert.match(html, /OpenAI-compatible/u);
  assert.match(html, /Recommended: a high-quality model/u);
  assert.match(html, /usually under a dollar/u);
  assert.match(html, /fetch\(["']\/api\/estimate["']/u);
  assert.match(html, /This text will cost about/u);
  assert.match(html, /BUILD MY OFFLINE COURSE/u);
  assert.doesNotMatch(html, /type=["']file["']/u);
  assert.match(html, /plain text only/u);
  assert.doesNotMatch(html, /fetch\(["']https?:\/\/(?:api\.openai\.com|api\.anthropic\.com)/u, "provider calls must never be made by browser code");
});
