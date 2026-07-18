import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { repoRoot } from "./atomizer.mjs";

function run(command, args, options) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, args, { ...options, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { output = `${output}${chunk}`.slice(-12_000); });
    child.stderr.on("data", (chunk) => { output = `${output}${chunk}`.slice(-12_000); });
    child.once("error", rejectPromise);
    child.once("close", (code, signal) => {
      if (code === 0) resolvePromise();
      else rejectPromise(new Error(`${command} failed (${signal ? `signal ${signal}` : `exit ${code}`}):\n${output}`));
    });
  });
}

export function createCoursePackager({ runImpl = run, cwd = repoRoot } = {}) {
  return {
    async run({ graphPath, outDir }) {
      const environment = { ...process.env };
      delete environment.OPENAI_API_KEY;
      environment.BUILDER_GRAPH_PATH = graphPath;
      environment.BUILDER_COURSE_OUT_DIR = outDir;

      await runImpl(
        "pnpm",
        ["exec", "vite", "build", "--config", "builder/vite.course.config.ts"],
        { cwd, env: environment },
      );
      await runImpl("node", ["builder/inline-course.mjs", "--out-dir", outDir], {
        cwd,
        env: environment,
      });
      await runImpl("node", ["builder/verify-course.mjs", "--out-dir", outDir], {
        cwd,
        env: environment,
      });
    },
  };
}
