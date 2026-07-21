import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Floor calibrated to the engine, not to UX comfort: src/atomization/atomize.ts refuses to ship
// fewer than 6 grounded concepts after 3 paid attempts, and the src/cost/estimator.ts calibration
// puts ~6 concepts near 25K chars. Below ~12K chars the build fails AFTER the key has been charged.
// Keep in sync with the textarea minlength + copy in builder/public/index.html (tests pin both).
export const MINIMUM_TEXT_LENGTH = 12_000;
// Retain a generous public-endpoint bound: full books are valid input, unbounded bodies are a DoS risk.
const MAXIMUM_TEXT_LENGTH = 2_000_000;
const SUPPORTED_PROVIDERS = new Set(["openai", "anthropic", "openai-compatible"]);
const DEFAULT_MODELS = {
  openai: "gpt-5.6-sol",
  anthropic: "claude-opus-4-8",
  "openai-compatible": "",
};

function cleanField(value, fallback, maximumLength = 120) {
  if (typeof value !== "string") return fallback;
  const cleaned = value.trim().replace(/\s+/gu, " ");
  return cleaned ? cleaned.slice(0, maximumLength) : fallback;
}

function redactValue(value, secret) {
  if (typeof value === "string") return value.split(secret).join("[redacted]");
  if (Array.isArray(value)) return value.map((item) => redactValue(item, secret));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactValue(item, secret)]));
  }
  return value;
}

export function validateBuildInput(input) {
  const text = typeof input?.text === "string" ? input.text.trim() : "";
  const apiKey = typeof input?.apiKey === "string" ? input.apiKey.trim() : "";
  const provider = typeof input?.provider === "string" ? input.provider : "openai";
  if (!SUPPORTED_PROVIDERS.has(provider)) throw new Error("Choose a supported model provider.");
  const model = cleanField(input?.model, DEFAULT_MODELS[provider], 200);
  const baseUrl = typeof input?.baseUrl === "string" ? input.baseUrl.trim() : "";
  if (text.length < MINIMUM_TEXT_LENGTH) {
    throw new Error(
      `Paste at least ${MINIMUM_TEXT_LENGTH.toLocaleString("en-US")} characters — about five pages. ` +
      "The engine refuses to ship a course with fewer than six grounded concepts, and shorter texts " +
      "fail after your API key has already been charged.",
    );
  }
  if (text.length > MAXIMUM_TEXT_LENGTH) {
    throw new Error(`Keep this build under ${MAXIMUM_TEXT_LENGTH.toLocaleString("en-US")} characters.`);
  }
  if (apiKey.length < 12) throw new Error("Enter a valid API key for the selected provider.");
  if (!model) throw new Error("Enter the high-quality model you want to trust with this course.");
  if (provider === "openai-compatible") {
    let endpoint;
    try {
      endpoint = new URL(baseUrl);
    } catch {
      throw new Error("Enter an absolute HTTP(S) base URL for the compatible endpoint.");
    }
    if (
      !["http:", "https:"].includes(endpoint.protocol) ||
      endpoint.username ||
      endpoint.password ||
      endpoint.search ||
      endpoint.hash
    ) {
      throw new Error("Enter an absolute HTTP(S) base URL without credentials, a query, or a fragment.");
    }
  }
  if (input?.ownedContentAccepted !== true) {
    throw new Error("Confirm that you own the text and may embed it in this course under the chosen license.");
  }
  return {
    text,
    apiKey,
    provider,
    model,
    baseUrl,
    title: cleanField(input.title, "My course"),
    author: cleanField(input.author, "Course creator"),
  };
}

export function createCourseBuilder({ atomizer, atomizerFactory, packager, makeTempDirectory = () => mkdtemp(join(tmpdir(), "atomic-course-builder-")) }) {
  if ((!atomizer && !atomizerFactory) || !packager) {
    throw new Error("course builder requires atomizer and packager seams");
  }

  return async function buildCourse(input, onProgress = () => undefined) {
    const validated = validateBuildInput(input);
    const emit = (event) => onProgress(redactValue(event, validated.apiKey));
    const workDir = await makeTempDirectory();
    const corpusDir = resolve(workDir, "corpus");
    const atomizedDir = resolve(workDir, "atomized");
    const courseDir = resolve(workDir, "course");
    const sourcePath = resolve(corpusDir, "source.txt");
    const manifestPath = resolve(corpusDir, "sources.json");
    const graphPath = resolve(atomizedDir, "graph.json");

    emit({ type: "stage", stage: "preparing", message: "Preparing your private, temporary source…" });
    await mkdir(corpusDir, { recursive: true });
    await writeFile(sourcePath, validated.text, { encoding: "utf8", mode: 0o600 });
    const manifest = {
      sources: [{
        id: `teacher-source-${randomUUID().slice(0, 8)}`,
        title: validated.title,
        license: cleanField(input.license, "CC0-1.0", 50),
        author: validated.author,
        textPath: "source.txt",
      }],
    };
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });

    emit({ type: "stage", stage: "atomizing", message: "Finding one-concept lessons and their prerequisite order…" });
    const activeAtomizer = atomizer ?? atomizerFactory({
      provider: validated.provider,
      apiKey: validated.apiKey,
      model: validated.model,
      baseUrl: validated.baseUrl,
    });
    try {
      await activeAtomizer.run({
        manifestPath,
        outDir: atomizedDir,
        onProgress: emit,
      });
    } catch (error) {
      throw new Error(redactValue(error instanceof Error ? error.message : String(error), validated.apiKey));
    } finally {
      activeAtomizer.dispose?.();
    }

    const graph = JSON.parse(await readFile(graphPath, "utf8"));
    if (!Array.isArray(graph.concepts) || !Array.isArray(graph.sources)) {
      throw new Error("The engine returned an invalid graph artifact.");
    }
    emit({ type: "stage", stage: "receipts", message: `${graph.concepts.length} grounded atoms passed. Revealing the receipts…` });
    for (const concept of graph.concepts) {
      emit({
        type: "concept",
        id: concept.id,
        title: concept.title,
        quotedText: concept.provenance?.quotedText ?? "",
      });
    }

    emit({ type: "stage", stage: "packaging", message: "Folding the graph, lessons, receipts, styles, and app into one offline file…" });
    await packager.run({ graphPath, outDir: courseDir });
    const htmlPath = resolve(courseDir, "index.html");
    await readFile(htmlPath);

    return {
      id: randomUUID(),
      title: validated.title,
      workDir,
      htmlPath,
      conceptCount: graph.concepts.length,
    };
  };
}
