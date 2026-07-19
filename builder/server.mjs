import { spawn } from "node:child_process";
import { createReadStream, existsSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createAtomizer, redactSecret } from "./atomizer.mjs";
import { createCourseBuilder } from "./build-course.mjs";
import { createCoursePackager } from "./package-course.mjs";
import { estimateAtomizationCosts } from "../src/cost/estimator.ts";

const builderDirectory = fileURLToPath(new URL(".", import.meta.url));
const publicDirectory = resolve(builderDirectory, "public");
const MAXIMUM_REQUEST_BYTES = 400_000;

function jsonLine(response, value) {
  response.write(`${JSON.stringify(value)}\n`);
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAXIMUM_REQUEST_BYTES) throw new Error("The pasted text is too large for the local builder.");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("The builder received malformed input.");
  }
}

function safeName(title) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "").slice(0, 60);
  return `${slug || "my-course"}.html`;
}

function secureHeaders(response, contentType) {
  response.setHeader("Content-Type", contentType);
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
}

export function sanitizeBuildFailure(error, requestKey) {
  return redactSecret(error instanceof Error ? error.message : String(error), requestKey);
}

export function createBuilderServer({
  courseBuilder = createCourseBuilder({ atomizerFactory: createAtomizer, packager: createCoursePackager() }),
  logger = console,
} = {}) {
  const courses = new Map();
  let activeBuild = false;
  let cleanupPromise;

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");

    if (request.method === "GET" && url.pathname === "/") {
      secureHeaders(response, "text/html; charset=utf-8");
      response.setHeader(
        "Content-Security-Policy",
        "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; form-action 'self'; base-uri 'none'",
      );
      response.end(await readFile(resolve(publicDirectory, "index.html")));
      return;
    }

    const courseMatch = url.pathname.match(/^\/(course|download)\/([0-9a-f-]+)$/u);
    if (request.method === "GET" && courseMatch) {
      const course = courses.get(courseMatch[2]);
      if (!course || !existsSync(course.htmlPath)) {
        response.writeHead(404).end("Course not found. Keep the builder running and build again.");
        return;
      }
      response.statusCode = 200;
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.setHeader("Cache-Control", "no-store");
      if (courseMatch[1] === "download") {
        response.setHeader("Content-Disposition", `attachment; filename="${safeName(course.title)}"`);
      }
      createReadStream(course.htmlPath).pipe(response);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/estimate") {
      let input;
      try {
        input = await readJson(request);
        if (typeof input?.text !== "string") throw new Error("The cost estimate requires pasted text.");
      } catch (error) {
        response.statusCode = 400;
        secureHeaders(response, "application/json; charset=utf-8");
        response.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
        return;
      }

      response.statusCode = 200;
      secureHeaders(response, "application/json; charset=utf-8");
      response.end(JSON.stringify({ estimates: estimateAtomizationCosts(input.text) }));
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/build") {
      if (activeBuild) {
        response.writeHead(409, { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" });
        jsonLine(response, { type: "error", message: "One course is already building. Let it finish before starting another." });
        response.end();
        return;
      }

      let input;
      try {
        input = await readJson(request);
      } catch (error) {
        response.writeHead(400, { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" });
        jsonLine(response, { type: "error", message: error instanceof Error ? error.message : String(error) });
        response.end();
        return;
      }

      const requestKey = typeof input.apiKey === "string" ? input.apiKey : "";
      activeBuild = true;
      response.writeHead(200, {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-store",
        Connection: "keep-alive",
        "X-Content-Type-Options": "nosniff",
      });
      jsonLine(response, { type: "stage", stage: "accepted", message: "Build accepted. Your API key is in memory only for this run." });

      try {
        const course = await courseBuilder(input, (event) => jsonLine(response, event));
        courses.set(course.id, course);
        jsonLine(response, {
          type: "done",
          message: `Your ${course.conceptCount}-atom offline course is ready.`,
          courseUrl: `/course/${course.id}`,
          downloadUrl: `/download/${course.id}`,
        });
      } catch (error) {
        const message = sanitizeBuildFailure(error, requestKey);
        logger.error("Course build failed:", message);
        jsonLine(response, { type: "error", message });
      } finally {
        activeBuild = false;
        response.end();
        if (input && typeof input === "object") input.apiKey = "";
      }
      return;
    }

    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
  });

  server.cleanupCourses = () => {
    if (!cleanupPromise) {
      const directories = [...courses.values()].map((course) => course.workDir);
      courses.clear();
      cleanupPromise = Promise.all(
        directories.map((directory) => rm(directory, { recursive: true, force: true })),
      ).then(() => undefined);
    }
    return cleanupPromise;
  };
  server.on("close", () => { void server.cleanupCourses(); });
  return server;
}

function openBrowser(url) {
  if (process.argv.includes("--no-open")) return;
  const command = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  const child = spawn(command, args, { detached: true, stdio: "ignore" });
  child.unref();
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const host = "127.0.0.1";
  const port = Number(process.env.BUILDER_PORT ?? 4179);
  const server = createBuilderServer();
  server.listen(port, host, () => {
    const address = server.address();
    const url = `http://${host}:${typeof address === "object" && address ? address.port : port}`;
    console.log(`Local course builder: ${url}`);
    console.log("Your source and API key go only from this local server to your chosen provider and are not stored; stop with Control-C.");
    openBrowser(url);
  });
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    server.close(async () => {
      await server.cleanupCourses();
      process.exit(0);
    });
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}
