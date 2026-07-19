import assert from "node:assert/strict";
import { mkdtemp, readlink, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PassThrough } from "node:stream";
import { describe, it } from "vitest";
import { fixtureGraph, SOURCE_TEXT } from "../src/graph/fixture-graph.ts";
import { installTuiAliases } from "../scripts/install-tui-aliases.mjs";
import {
  browseCourse,
  parseEnvFile,
  promptMasked,
  resolveApiKey,
  resolveHtmlOutputPath,
  runExportFlow,
  runPaidBuildFlow,
} from "./tui.mjs";

function captureOutput() {
  let value = "";
  return {
    output: { write(chunk) { value += String(chunk); } },
    read: () => value,
  };
}

describe("builder terminal UI", () => {
  it("loads keys from the environment before .env and never needs the prompt", async () => {
    let fileReads = 0;
    let prompts = 0;
    const resolved = await resolveApiKey({
      provider: "openai",
      environment: { OPENAI_API_KEY: "sk-environment-secret" },
      envPaths: ["/repo/.env"],
      readFileImpl: async () => {
        fileReads += 1;
        return "OPENAI_API_KEY=sk-file-secret\n";
      },
      promptSecret: async () => {
        prompts += 1;
        return "sk-prompt-secret";
      },
    });

    assert.deepEqual(resolved, {
      apiKey: "sk-environment-secret",
      source: "environment variable OPENAI_API_KEY",
    });
    assert.equal(fileReads, 0);
    assert.equal(prompts, 0);
  });

  it("loads a quoted provider key from .env without mutating the environment", async () => {
    const environment = {};
    const resolved = await resolveApiKey({
      provider: "anthropic",
      environment,
      envPaths: ["/repo/.env"],
      readFileImpl: async () => [
        "# local secrets",
        "OPENAI_API_KEY=sk-unused",
        "ANTHROPIC_API_KEY='anthropic-file-secret'",
      ].join("\n"),
      promptSecret: async () => assert.fail("the masked prompt should not run"),
    });

    assert.deepEqual(resolved, {
      apiKey: "anthropic-file-secret",
      source: ".env variable ANTHROPIC_API_KEY",
    });
    assert.deepEqual(environment, {});
  });

  it("uses a masked, session-only prompt when no configured key exists", async () => {
    const resolved = await resolveApiKey({
      provider: "openai-compatible",
      environment: {},
      envPaths: ["/missing/.env"],
      readFileImpl: async () => {
        const error = new Error("missing");
        error.code = "ENOENT";
        throw error;
      },
      promptSecret: async () => "compatible-session-secret",
    });

    assert.deepEqual(resolved, {
      apiKey: "compatible-session-secret",
      source: "masked session-only prompt",
    });
  });

  it("masks terminal input instead of echoing the key", async () => {
    const input = new PassThrough();
    input.isTTY = true;
    input.isRaw = false;
    input.setRawMode = (value) => { input.isRaw = value; };
    const captured = captureOutput();
    const pending = promptMasked("API key: ", { input, output: captured.output });
    setImmediate(() => input.write("sk-never-echo-this\r"));

    assert.equal(await pending, "sk-never-echo-this");
    assert.equal(captured.read().includes("sk-never-echo-this"), false);
    assert.match(captured.read(), /^API key: \*+\n$/u);
    assert.equal(input.isRaw, false);
  });

  it("does not load a key or start a paid build before exact cost confirmation", async () => {
    let keyLoads = 0;
    let builds = 0;
    const captured = captureOutput();
    const answers = new Map([
      ["Source text file", "/course/source.txt"],
      ["Course title", "Cancelled course"],
      ["Course author", "Teacher"],
      ["Provider", "1"],
      ["Model", ""],
      ["Do you own", "yes"],
      ["Type BUILD", "no"],
    ]);

    const result = await runPaidBuildFlow({
      ask: async (question) => answers.get([...answers.keys()].find((key) => question.startsWith(key))) ?? "",
      output: captured.output,
      readFileImpl: async () => SOURCE_TEXT.repeat(40),
      keyLoader: async () => { keyLoads += 1; return { apiKey: "unused", source: "test" }; },
      buildRunner: async () => { builds += 1; },
    });

    assert.equal(result, undefined);
    assert.equal(keyLoads, 0);
    assert.equal(builds, 0);
    assert.match(captured.read(), /Paid build cancelled before any model call/u);
  });

  it("wraps the existing builder after confirmation and redacts the key from all output", async () => {
    const secret = "sk-hostile-progress-secret";
    const captured = captureOutput();
    const calls = [];
    const answers = new Map([
      ["Source text file", "/course/source.txt"],
      ["Course title", "My safe course"],
      ["Course author", "Teacher"],
      ["Provider", "1"],
      ["Model", ""],
      ["Do you own", "yes"],
      ["Type BUILD", "BUILD"],
      ["Save course as", "./my-safe-course.html"],
    ]);

    const result = await runPaidBuildFlow({
      ask: async (question) => answers.get([...answers.keys()].find((key) => question.startsWith(key))) ?? "",
      output: captured.output,
      cwd: "/repo",
      readFileImpl: async () => SOURCE_TEXT.repeat(40),
      keyLoader: async () => ({
        apiKey: secret,
        source: "environment variable OPENAI_API_KEY",
      }),
      makeTempDirectory: async () => "/temporary/build",
      buildRunner: async ({ input, onProgress, workDir }) => {
        calls.push({ input: { ...input }, workDir });
        onProgress({ type: "engine", message: `hostile provider echoed ${secret}` });
        return { htmlPath: "/temporary/build/course/index.html", conceptCount: 7 };
      },
      copyFileImpl: async (from, to) => calls.push({ from, to }),
      removeImpl: async (path) => calls.push({ removed: path }),
    });

    assert.equal(calls[0].input.apiKey, secret, "the key reaches the existing builder in memory");
    assert.equal(calls[0].workDir, "/temporary/build");
    assert.deepEqual(calls[1], {
      from: "/temporary/build/course/index.html",
      to: "/repo/my-safe-course.html",
    });
    assert.deepEqual(calls[2], { removed: "/temporary/build" });
    assert.deepEqual(result, { outputPath: "/repo/my-safe-course.html", conceptCount: 7 });
    assert.equal(captured.read().includes(secret), false);
    assert.match(captured.read(), /hostile provider echoed \[redacted\]/u);
  });

  it("selects multiple formats while delegating to the existing emit scripts", async () => {
    const captured = captureOutput();
    const scripts = [];
    await runExportFlow({
      ask: async () => "1,3,6",
      output: captured.output,
      runScript: async (script) => scripts.push(script),
    });

    assert.deepEqual(scripts, ["emit:obsidian", "emit:tinderbox", "emit:llms"]);
    assert.match(captured.read(), /Exports complete/u);
  });

  it("navigates the existing graph in prerequisite order", async () => {
    const captured = captureOutput();
    const answers = ["1", "n", "q"];
    await browseCourse(fixtureGraph, {
      ask: async () => answers.shift() ?? "q",
      output: captured.output,
    });

    const rendered = captured.read();
    assert.match(rendered, /Goal: self-attention/u);
    assert.ok(rendered.indexOf("1. vectors") < rendered.indexOf("2. dot-product"));
    assert.match(rendered, /A vector is an ordered list of numbers/u);
    assert.match(rendered, /The dot product multiplies two vectors elementwise/u);
  });

  it("will not use protected graph artifacts as an HTML destination", () => {
    assert.throws(
      () => resolveHtmlOutputPath("data/graph.json", "/repo"),
      /must end in .html/u,
    );
    assert.throws(
      () => resolveHtmlOutputPath("data/renderings.json", "/repo"),
      /must end in .html/u,
    );
    assert.equal(resolveHtmlOutputPath("course.html", "/repo"), "/repo/course.html");
  });

  it("parses only explicit .env assignments", () => {
    assert.deepEqual(
      parseEnvFile([
        "export OPENAI_API_KEY=sk-openai",
        "ANTHROPIC_API_KEY=anthropic-key # local only",
        "NOT AN ASSIGNMENT",
      ].join("\n")),
      {
        OPENAI_API_KEY: "sk-openai",
        ANTHROPIC_API_KEY: "anthropic-key",
      },
    );
  });

  it("automatically installs both safe command aliases and is idempotent", async () => {
    const directory = await mkdtemp(join(tmpdir(), "alg-tui-bin-"));
    const launcherPath = resolve("builder/tui.mjs");
    try {
      const first = await installTuiAliases({
        platform: "darwin",
        binDir: directory,
        launcherPath,
        pathValue: directory,
      });
      const second = await installTuiAliases({
        platform: "darwin",
        binDir: directory,
        launcherPath,
        pathValue: directory,
      });

      assert.equal(first.onPath, true);
      assert.deepEqual(first.results.map(({ status }) => status), ["installed", "installed"]);
      assert.deepEqual(second.results.map(({ status }) => status), ["installed", "installed"]);
      for (const alias of ["atomic-learning", "alg"]) {
        assert.equal(resolve(directory, await readlink(join(directory, alias))), launcherPath);
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("refuses to overwrite an unrelated command during automatic installation", async () => {
    const directory = await mkdtemp(join(tmpdir(), "alg-tui-conflict-"));
    try {
      await writeFile(join(directory, "alg"), "another program\n", "utf8");
      const result = await installTuiAliases({
        platform: "darwin",
        binDir: directory,
        launcherPath: resolve("builder/tui.mjs"),
        pathValue: directory,
      });
      assert.deepEqual(
        result.results.find(({ alias }) => alias === "alg"),
        { alias: "alg", status: "skipped", reason: "existing file" },
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
