import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const builderDirectory = fileURLToPath(new URL(".", import.meta.url));
const providerFetchUrl = new URL("./provider-fetch.mjs", import.meta.url).href;
export const repoRoot = resolve(builderDirectory, "..");

export function redactSecret(value, secret) {
  if (typeof value !== "string" || !secret) return value;
  return value.split(secret).join("[redacted]");
}

function friendlyProgress(line, provider) {
  if (/^Using /u.test(line)) return `Connected to the selected ${provider} model.`;
  if (/^Inventory attempt /u.test(line)) return "Refining the concept inventory…";
  if (/^Relationship attempt /u.test(line)) return "Refining the prerequisite map…";
  if (/^Convergence attempt /u.test(line)) return `Proof check: ${line.replace(/^Convergence attempt /u, "round ")}`;
  if (/^ATOMIZATION PASS:/u.test(line)) return line.replace(/^ATOMIZATION PASS:\s*/u, "Graph proved: ");
  if (/^Analogy layer failed/u.test(line)) return "Optional analogy enrichment was skipped; the grounded course is still valid.";
  return undefined;
}

function pipeLines(stream, onLine) {
  let pending = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    pending += chunk;
    const lines = pending.split(/\r?\n/u);
    pending = lines.pop() ?? "";
    for (const line of lines) if (line.trim()) onLine(line.trim());
  });
  stream.on("end", () => {
    if (pending.trim()) onLine(pending.trim());
  });
}

/** The only builder seam that knows which model provider runs the existing engine. */
export function createAtomizer({
  provider = "openai",
  apiKey,
  model,
  baseUrl,
  spawnImpl = spawn,
  cwd = repoRoot,
} = {}) {
  if (!["openai", "anthropic", "openai-compatible"].includes(provider)) {
    throw new Error(`unsupported model provider: ${provider}`);
  }
  if (typeof apiKey !== "string" || !apiKey) throw new Error("atomizer requires an API key");
  if (typeof model !== "string" || !model.trim()) throw new Error("atomizer requires a model");
  const credentials = { apiKey };
  let disposed = false;

  return {
    provider,
    model,
    async run({ manifestPath, outDir, onProgress = () => undefined }) {
      if (disposed) throw new Error("atomizer credentials have been discarded");
      const args = [
        "exec",
        "tsx",
        "src/atomization/atomize.ts",
        "--manifest",
        manifestPath,
        "--out-dir",
        outDir,
        "--no-spine",
      ];
      const childEnvironment = {
        ...process.env,
        OPENAI_API_KEY: credentials.apiKey,
        OPENAI_MODEL: model.trim(),
        ...(provider === "openai" ? {} : {
          ALG_BUILDER_PROVIDER: provider,
          ALG_BUILDER_MODEL: model.trim(),
          ...(provider === "openai-compatible" ? { ALG_BUILDER_BASE_URL: baseUrl } : {}),
          NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ""} --import=${providerFetchUrl}`.trim(),
        }),
      };
      const child = spawnImpl("pnpm", args, {
        cwd,
        env: childEnvironment,
        stdio: ["ignore", "pipe", "pipe"],
      });
      delete childEnvironment.OPENAI_API_KEY;

      let diagnostic = "";
      const consume = (line) => {
        diagnostic = `${diagnostic}\n${redactSecret(line, credentials.apiKey)}`.slice(-12_000);
        const message = friendlyProgress(line, provider);
        if (message) onProgress({ type: "engine", message: redactSecret(message, credentials.apiKey) });
      };
      pipeLines(child.stdout, consume);
      pipeLines(child.stderr, consume);

      await new Promise((resolvePromise, rejectPromise) => {
        child.once("error", (error) => rejectPromise(error));
        child.once("close", (code, signal) => {
          if (code === 0) resolvePromise();
          else {
            const reason = signal ? `signal ${signal}` : `exit ${code}`;
            rejectPromise(new Error(`atomizer failed (${reason})${diagnostic}`));
          }
        });
      }).catch((error) => {
        throw new Error(redactSecret(error instanceof Error ? error.message : String(error), credentials.apiKey));
      });
    },
    dispose() {
      credentials.apiKey = "";
      disposed = true;
    },
  };
}
