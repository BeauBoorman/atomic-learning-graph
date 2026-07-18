import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const MINIMUM_TEXT_LENGTH = 300;
const MAXIMUM_TEXT_LENGTH = 250_000;

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
  if (text.length < MINIMUM_TEXT_LENGTH) {
    throw new Error(`Paste at least ${MINIMUM_TEXT_LENGTH.toLocaleString("en-US")} characters so there is enough material for a course.`);
  }
  if (text.length > MAXIMUM_TEXT_LENGTH) {
    throw new Error(`Keep this MVP build under ${MAXIMUM_TEXT_LENGTH.toLocaleString("en-US")} characters.`);
  }
  if (apiKey.length < 12) throw new Error("Enter a valid OpenAI API key.");
  if (input?.ownedContentAccepted !== true) {
    throw new Error("Confirm that you own the text and may embed it in this CC0 course artifact.");
  }
  return {
    text,
    apiKey,
    title: cleanField(input.title, "My course"),
    author: cleanField(input.author, "Course creator"),
  };
}

export function createCourseBuilder({ atomizer, packager, makeTempDirectory = () => mkdtemp(join(tmpdir(), "atomic-course-builder-")) }) {
  if (!atomizer || !packager) throw new Error("course builder requires atomizer and packager seams");

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
        license: "CC0-1.0",
        author: validated.author,
        textPath: "source.txt",
      }],
    };
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });

    emit({ type: "stage", stage: "atomizing", message: "Finding one-concept lessons and their prerequisite order…" });
    try {
      await atomizer.run({
        apiKey: validated.apiKey,
        manifestPath,
        outDir: atomizedDir,
        onProgress: emit,
      });
    } catch (error) {
      throw new Error(redactValue(error instanceof Error ? error.message : String(error), validated.apiKey));
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
