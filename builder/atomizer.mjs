import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const builderDirectory = fileURLToPath(new URL(".", import.meta.url));
export const repoRoot = resolve(builderDirectory, "..");

export function redactSecret(value, secret) {
  if (typeof value !== "string" || !secret) return value;
  return value.split(secret).join("[redacted]");
}

function friendlyProgress(line) {
  if (/^Using /u.test(line)) return "Connected to the pinned OpenAI model.";
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
export function createOpenAIAtomizer({ spawnImpl = spawn, cwd = repoRoot } = {}) {
  return {
    provider: "openai",
    async run({ apiKey, manifestPath, outDir, onProgress = () => undefined }) {
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
      const childEnvironment = { ...process.env, OPENAI_API_KEY: apiKey };
      const child = spawnImpl("pnpm", args, {
        cwd,
        env: childEnvironment,
        stdio: ["ignore", "pipe", "pipe"],
      });
      delete childEnvironment.OPENAI_API_KEY;

      let diagnostic = "";
      const consume = (line) => {
        diagnostic = `${diagnostic}\n${redactSecret(line, apiKey)}`.slice(-12_000);
        const message = friendlyProgress(line);
        if (message) onProgress({ type: "engine", message: redactSecret(message, apiKey) });
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
        throw new Error(redactSecret(error instanceof Error ? error.message : String(error), apiKey));
      });
    },
  };
}
