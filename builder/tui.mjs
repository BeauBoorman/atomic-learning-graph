#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, extname, join, resolve } from "node:path";
import { createInterface, emitKeypressEvents } from "node:readline";
import { fileURLToPath } from "node:url";
import { createAtomizer, redactSecret, repoRoot } from "./atomizer.mjs";
import { createCourseBuilder, MINIMUM_TEXT_LENGTH } from "./build-course.mjs";
import { createCoursePackager } from "./package-course.mjs";
import { pnpmSpawnInvocation } from "./pnpm-spawn.mjs";
import { estimateAtomizationCosts } from "../src/cost/estimator.ts";
import { loadGraph } from "../src/graph/load.ts";
import { getPath, topologicalConceptOrder } from "../src/graph/path.ts";

const PROVIDERS = [
  {
    id: "openai",
    label: "OpenAI",
    defaultModel: "gpt-5.6-sol",
    keyNames: ["OPENAI_API_KEY"],
  },
  {
    id: "anthropic",
    label: "Anthropic",
    defaultModel: "claude-opus-4-8",
    keyNames: ["ANTHROPIC_API_KEY"],
  },
  {
    id: "openai-compatible",
    label: "OpenAI-compatible endpoint",
    defaultModel: "",
    keyNames: ["OPENAI_COMPATIBLE_API_KEY", "OPENAI_API_KEY"],
  },
];

const EXPORT_FORMATS = [
  { label: "Obsidian vault", script: "emit:obsidian" },
  { label: "org-roam file", script: "emit:orgroam" },
  { label: "Tinderbox OPML", script: "emit:tinderbox" },
  { label: "Anki deck", script: "emit:anki" },
  { label: "practice exam", script: "emit:exam" },
  { label: "llms.txt files", script: "emit:llms" },
];

function writeLine(output, value = "") {
  output.write(`${value}\n`);
}

function cleanInline(value, fallback = "") {
  const cleaned = typeof value === "string" ? value.trim().replace(/\s+/gu, " ") : "";
  return cleaned || fallback;
}

function safeSlug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "")
    .slice(0, 60) || "my-course";
}

export function parseEnvFile(contents) {
  const values = {};
  for (const rawLine of String(contents).split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/u);
    if (!match) continue;
    let value = match[2].trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/u, "").trim();
    }
    values[match[1]] = value;
  }
  return values;
}

/** Resolve a provider key without writing it, logging it, or mutating process.env. */
export async function resolveApiKey({
  provider,
  environment = process.env,
  envPaths = [resolve(repoRoot, ".env"), resolve(repoRoot, "builder", ".env")],
  readFileImpl = readFile,
  promptSecret = (label) => promptMasked(label),
} = {}) {
  const configuration = PROVIDERS.find((candidate) => candidate.id === provider);
  if (!configuration) throw new Error(`unsupported provider: ${provider}`);

  for (const name of configuration.keyNames) {
    const value = environment[name];
    if (typeof value === "string" && value.trim()) {
      return { apiKey: value.trim(), source: `environment variable ${name}` };
    }
  }

  for (const path of envPaths) {
    let parsed;
    try {
      parsed = parseEnvFile(await readFileImpl(path, "utf8"));
    } catch (error) {
      if (error && typeof error === "object" && error.code === "ENOENT") continue;
      throw error;
    }
    for (const name of configuration.keyNames) {
      const value = parsed[name];
      if (typeof value === "string" && value.trim()) {
        return { apiKey: value.trim(), source: `.env variable ${name}` };
      }
    }
  }

  const apiKey = await promptSecret(`${configuration.label} API key (input hidden): `);
  if (typeof apiKey !== "string" || !apiKey.trim()) {
    throw new Error("No API key was provided; no paid run started.");
  }
  return { apiKey: apiKey.trim(), source: "masked session-only prompt" };
}

/** Read one secret from a real terminal while displaying masks only. */
export function promptMasked(label, { input = process.stdin, output = process.stdout } = {}) {
  if (!input.isTTY || typeof input.setRawMode !== "function") {
    throw new Error(
      "No API key is configured and a masked prompt requires an interactive terminal. " +
        "Set the provider key in the environment or a local .env file.",
    );
  }

  emitKeypressEvents(input);
  const wasRaw = Boolean(input.isRaw);
  input.setRawMode(true);
  input.resume();
  output.write(label);

  return new Promise((resolvePrompt, rejectPrompt) => {
    let secret = "";
    const cleanup = () => {
      input.removeListener("keypress", onKeypress);
      input.setRawMode(wasRaw);
      input.pause();
    };
    const finish = () => {
      output.write("\n");
      cleanup();
      resolvePrompt(secret);
    };
    const abort = () => {
      output.write("\n");
      cleanup();
      const error = new Error("API-key entry cancelled; no paid run started.");
      error.code = "ABORT_ERR";
      rejectPrompt(error);
    };
    function onKeypress(character, key = {}) {
      if (key.ctrl && key.name === "c") {
        abort();
        return;
      }
      if (key.name === "return" || key.name === "enter") {
        finish();
        return;
      }
      if (key.name === "backspace") {
        if (secret.length > 0) {
          secret = secret.slice(0, -1);
          output.write("\b \b");
        }
        return;
      }
      if (!key.ctrl && !key.meta && typeof character === "string" && character.length > 0) {
        secret += character;
        output.write("*".repeat([...character].length));
      }
    }
    input.on("keypress", onKeypress);
  });
}

export function askLine(question, { input = process.stdin, output = process.stdout } = {}) {
  return new Promise((resolveAnswer) => {
    const interface_ = createInterface({ input, output });
    interface_.question(question, (answer) => {
      interface_.close();
      resolveAnswer(answer);
    });
  });
}

function renderConcept(graph, concept, output) {
  const prerequisites = graph.edges
    .filter((edge) => edge.type === "prereq" && edge.to === concept.id)
    .map((edge) => edge.from)
    .sort();
  writeLine(output);
  writeLine(output, `=== ${concept.title} (${concept.id}) ===`);
  writeLine(output, concept.summary);
  writeLine(output, `Prerequisites: ${prerequisites.length ? prerequisites.join(", ") : "none"}`);
  if (concept.lesson) {
    writeLine(output, `Lesson: ${concept.lesson.plainTitle}`);
    concept.lesson.steps.forEach((step, index) => {
      writeLine(output, `  ${index + 1}. [${step.stepTier}] ${step.text}`);
      writeLine(output, `     Receipt (${step.citation.sourceId}): ${step.citation.quotedText}`);
    });
  }
  writeLine(output, `Concept receipt (${concept.provenance.sourceId}): ${concept.provenance.quotedText}`);
}

export async function browseCourse(
  graph,
  { ask = (question) => askLine(question), output = process.stdout } = {},
) {
  const conceptById = new Map(graph.concepts.map((concept) => [concept.id, concept]));
  const ordered = topologicalConceptOrder(graph)
    .map((id) => conceptById.get(id))
    .filter(Boolean);
  const goalPath = getPath(graph, graph.goalId);

  while (true) {
    writeLine(output);
    writeLine(output, "COURSE MAP");
    writeLine(output, `Goal: ${graph.goalId}`);
    writeLine(output, `Goal path: ${goalPath.join(" -> ")}`);
    ordered.forEach((concept, index) => writeLine(output, `${index + 1}. ${concept.id} — ${concept.title}`));
    const answer = cleanInline(await ask("Choose a concept number, or q to return: "));
    if (answer.toLowerCase() === "q") return;
    const selected = Number(answer) - 1;
    if (!Number.isInteger(selected) || selected < 0 || selected >= ordered.length) {
      writeLine(output, "Choose one of the displayed concept numbers.");
      continue;
    }

    let index = selected;
    while (true) {
      renderConcept(graph, ordered[index], output);
      const command = cleanInline(
        await ask("[n] next, [p] previous, [l] concept list, [q] main menu: "),
      ).toLowerCase();
      if (command === "q") return;
      if (command === "l") break;
      if (command === "n") index = Math.min(index + 1, ordered.length - 1);
      else if (command === "p") index = Math.max(index - 1, 0);
      else writeLine(output, "Choose n, p, l, or q.");
    }
  }
}

function safeExportEnvironment(environment = process.env) {
  const childEnvironment = { ...environment };
  delete childEnvironment.OPENAI_API_KEY;
  delete childEnvironment.ANTHROPIC_API_KEY;
  delete childEnvironment.OPENAI_COMPATIBLE_API_KEY;
  return childEnvironment;
}

export function runPnpmScript(
  script,
  { spawnImpl = spawn, cwd = repoRoot, platform = process.platform, environment = process.env } = {},
) {
  const invocation = pnpmSpawnInvocation(["run", script], { platform });
  return new Promise((resolveRun, rejectRun) => {
    const child = spawnImpl(invocation.command, invocation.args, {
      ...invocation.spawnOptions,
      cwd,
      env: safeExportEnvironment(environment),
      stdio: "inherit",
    });
    child.once("error", rejectRun);
    child.once("close", (code, signal) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`${script} failed (${signal ? `signal ${signal}` : `exit ${code}`})`));
    });
  });
}

function selectedExportFormats(answer) {
  if (answer.trim().toLowerCase() === "all") return [...EXPORT_FORMATS];
  const selected = new Set(
    answer
      .split(",")
      .map((value) => Number(value.trim()) - 1)
      .filter((index) => Number.isInteger(index) && index >= 0 && index < EXPORT_FORMATS.length),
  );
  return [...selected].sort((left, right) => left - right).map((index) => EXPORT_FORMATS[index]);
}

export async function runExportFlow({
  ask = (question) => askLine(question),
  output = process.stdout,
  runScript = (script) => runPnpmScript(script),
} = {}) {
  writeLine(output);
  writeLine(output, "EXPORT THE COMMITTED COURSE");
  EXPORT_FORMATS.forEach((format, index) => writeLine(output, `${index + 1}. ${format.label}`));
  const formats = selectedExportFormats(
    await ask("Choose comma-separated format numbers, all, or press Enter to cancel: "),
  );
  if (formats.length === 0) {
    writeLine(output, "No exports selected.");
    return [];
  }
  for (const format of formats) {
    writeLine(output, `Creating ${format.label}…`);
    await runScript(format.script);
  }
  writeLine(output, `Exports complete (${formats.map((format) => format.label).join(", ")}).`);
  return formats.map((format) => format.script);
}

function costSummary(text, provider, model) {
  const estimates = estimateAtomizationCosts(text);
  const exact = provider === "openai"
    ? estimates.find((estimate) => estimate.model === model)
    : undefined;
  if (exact) {
    return [
      `Estimated complete build cost: $${exact.estimatedUsdTotal.toFixed(4)}`,
      `Estimated concepts: ${exact.estimatedConcepts.toFixed(1)}`,
      `Estimated tokens: ${exact.estimatedInputTokens.toLocaleString("en-US")} input + ` +
        `${exact.estimatedOutputTokens.toLocaleString("en-US")} output`,
      "This is an estimate; actual provider charges can differ.",
    ];
  }

  const totals = estimates.map((estimate) => estimate.estimatedUsdTotal);
  return [
    `No committed USD price is available for ${model} on ${provider}.`,
    `For scale, the same text is estimated at $${Math.min(...totals).toFixed(4)}–` +
      `$${Math.max(...totals).toFixed(4)} across the committed OpenAI pricing table.`,
    "Your selected provider's actual charge can differ; check its pricing before continuing.",
  ];
}

export function resolveHtmlOutputPath(value, cwd = process.cwd()) {
  const path = resolve(cwd, value);
  if (extname(path).toLowerCase() !== ".html") {
    throw new Error("The course destination must end in .html.");
  }
  const protectedPaths = [
    resolve(repoRoot, "data", "graph.json"),
    resolve(repoRoot, "data", "renderings.json"),
  ];
  if (protectedPaths.includes(path)) throw new Error("Refusing to overwrite a protected graph artifact.");
  return path;
}

async function defaultBuildRunner({ input, onProgress, workDir }) {
  const build = createCourseBuilder({
    atomizerFactory: createAtomizer,
    packager: createCoursePackager(),
    makeTempDirectory: async () => workDir,
  });
  return build(input, onProgress);
}

export async function runPaidBuildFlow({
  ask = (question) => askLine(question),
  output = process.stdout,
  cwd = process.cwd(),
  environment = process.env,
  envPaths = [resolve(repoRoot, ".env"), resolve(repoRoot, "builder", ".env")],
  readFileImpl = readFile,
  keyLoader = resolveApiKey,
  promptSecret = (label) => promptMasked(label),
  makeTempDirectory = () => mkdtemp(join(tmpdir(), "atomic-course-tui-")),
  buildRunner = defaultBuildRunner,
  copyFileImpl = copyFile,
  mkdirImpl = mkdir,
  removeImpl = (path) => rm(path, { recursive: true, force: true }),
  existsImpl = existsSync,
} = {}) {
  writeLine(output);
  writeLine(output, "BUILD A NEW OFFLINE COURSE (PAID MODEL RUN)");
  const sourcePath = cleanInline(await ask("Source text file: "));
  if (!sourcePath) {
    writeLine(output, "No source selected; no paid run started.");
    return undefined;
  }

  let text;
  try {
    text = await readFileImpl(resolve(cwd, sourcePath), "utf8");
  } catch (error) {
    writeLine(output, `Could not read the source file: ${error instanceof Error ? error.message : error}`);
    return undefined;
  }
  if (text.trim().length < MINIMUM_TEXT_LENGTH) {
    writeLine(
      output,
      `The source needs at least ${MINIMUM_TEXT_LENGTH.toLocaleString("en-US")} characters; ` +
        "no paid run started.",
    );
    return undefined;
  }

  const titleDefault = basename(sourcePath, extname(sourcePath)) || "My course";
  const title = cleanInline(await ask(`Course title [${titleDefault}]: `), titleDefault);
  const author = cleanInline(await ask("Course author [Course creator]: "), "Course creator");
  PROVIDERS.forEach((provider, index) => writeLine(output, `${index + 1}. ${provider.label}`));
  const providerIndex = Number(cleanInline(await ask("Provider [1]: "), "1")) - 1;
  const provider = PROVIDERS[providerIndex] ?? PROVIDERS[0];
  const model = cleanInline(
    await ask(`Model${provider.defaultModel ? ` [${provider.defaultModel}]` : ""}: `),
    provider.defaultModel,
  );
  if (!model) {
    writeLine(output, "A model is required; no paid run started.");
    return undefined;
  }
  const baseUrl = provider.id === "openai-compatible"
    ? cleanInline(await ask("Compatible HTTP(S) base URL: "))
    : "";
  const ownsText = cleanInline(
    await ask("Do you own this text and have permission to embed it in the course? [yes/no]: "),
  ).toLowerCase();
  if (ownsText !== "yes") {
    writeLine(output, "Permission was not confirmed; no paid run started.");
    return undefined;
  }

  writeLine(output);
  for (const line of costSummary(text, provider.id, model)) writeLine(output, line);
  const confirmation = await ask("Type BUILD to confirm this estimate and start paid model calls: ");
  if (confirmation !== "BUILD") {
    writeLine(output, "Paid build cancelled before any model call.");
    return undefined;
  }

  const defaultOutput = `./${safeSlug(title)}.html`;
  const requestedOutput = cleanInline(await ask(`Save course as [${defaultOutput}]: `), defaultOutput);
  let outputPath;
  try {
    outputPath = resolveHtmlOutputPath(requestedOutput, cwd);
  } catch (error) {
    writeLine(output, error instanceof Error ? error.message : String(error));
    return undefined;
  }
  if (existsImpl(outputPath)) {
    const overwrite = await ask("That file exists. Type OVERWRITE to replace it: ");
    if (overwrite !== "OVERWRITE") {
      writeLine(output, "Existing file preserved; no paid run started.");
      return undefined;
    }
  }

  let apiKey = "";
  let workDir;
  try {
    const loaded = await keyLoader({
      provider: provider.id,
      environment,
      envPaths,
      promptSecret,
    });
    apiKey = loaded.apiKey;
    writeLine(output, `API key loaded from ${loaded.source}; it will not be displayed or saved.`);
    workDir = await makeTempDirectory();
    const result = await buildRunner({
      input: {
        text,
        apiKey,
        provider: provider.id,
        model,
        baseUrl,
        title,
        author,
        ownedContentAccepted: true,
      },
      workDir,
      onProgress(event) {
        if (event && typeof event.message === "string") {
          writeLine(output, redactSecret(event.message, apiKey));
        }
      },
    });
    if (dirname(outputPath) !== resolve(cwd)) {
      await mkdirImpl(dirname(outputPath), { recursive: true });
    }
    await copyFileImpl(result.htmlPath, outputPath);
    writeLine(output, `Course ready: ${outputPath}`);
    return { outputPath, conceptCount: result.conceptCount };
  } catch (error) {
    const message = redactSecret(error instanceof Error ? error.message : String(error), apiKey);
    writeLine(output, `Build failed: ${message}`);
    return undefined;
  } finally {
    apiKey = "";
    if (workDir) await removeImpl(workDir);
  }
}

export async function runTui({
  ask = (question) => askLine(question),
  output = process.stdout,
  graphLoader = loadGraph,
} = {}) {
  writeLine(output, "Atomic Learning Graph — terminal builder");
  writeLine(output, "Explore and export for free; paid builds always stop for a cost confirmation.");
  while (true) {
    writeLine(output);
    writeLine(output, "1. Explore the committed course");
    writeLine(output, "2. Export the committed course");
    writeLine(output, "3. Build a new offline course (paid)");
    writeLine(output, "q. Quit");
    const choice = cleanInline(await ask("Choose an action: ")).toLowerCase();
    if (choice === "q") return;
    try {
      if (choice === "1") await browseCourse(graphLoader(), { ask, output });
      else if (choice === "2") await runExportFlow({ ask, output });
      else if (choice === "3") await runPaidBuildFlow({ ask, output });
      else writeLine(output, "Choose 1, 2, 3, or q.");
    } catch (error) {
      writeLine(output, `Action failed: ${error instanceof Error ? error.message : error}`);
    }
  }
}

function invokedDirectly() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(resolve(process.argv[1])) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (invokedDirectly()) {
  runTui().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
