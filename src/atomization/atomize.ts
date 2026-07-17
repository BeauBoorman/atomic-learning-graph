import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AtomizedConcept, Concept, Edge, LearningGraph, Source } from "../types";
import { reportAtomicityWarnings } from "../graph/atomicity-report";
import { invalidLessonCitations, invalidProvenance } from "../graph/invariants";
import { checkLessonReadability } from "../graph/readability";
import { MANIFEST_PATH, OER_DIR, loadManifest, validateManifest } from "./manifest";
import {
  GOLDEN_PATH,
  GoldenGraphHalt,
  convergeGraph,
  type ExpectedSource,
} from "./repair";
import { writeGraphArtifact, writeJsonArtifact } from "./artifacts";
import { ANALOGY_PROMPT_VERSION, generateAnalogies } from "./analogy";
import { ResponsesClient, isObject } from "./client";
import { groundedQuote } from "./grounding";
import {
  PROMPT_VERSION,
  translateAndConvergeLessons,
} from "./translate";

const repoRoot = resolve(OER_DIR, "..", "..");
const UNPINNED_ARTIFACT_NOTE =
  "UNPINNED EXPERIMENTAL RUN — not the product. No concept or prerequisite chain was pinned; " +
  "this artifact may not contain the product demo goal self-attention.";

type JsonObject = Record<string, unknown>;

const atomizedConceptSchema: JsonObject = {
  type: "object",
  properties: {
    id: { type: "string" },
    title: { type: "string" },
    summary: { type: "string" },
    provenance: {
      type: "object",
      properties: {
        sourceId: { type: "string" },
        quotedText: { type: "string" },
      },
      required: ["sourceId", "quotedText"],
      additionalProperties: false,
    },
    tags: { type: "array", items: { type: "string" } },
    prerequisites: { type: "array", items: { type: "string" } },
    related: { type: "array", items: { type: "string" } },
  },
  required: ["id", "title", "summary", "provenance", "tags", "prerequisites", "related"],
  additionalProperties: false,
};

const inventorySchema: JsonObject = {
  type: "object",
  properties: {
    concepts: {
      type: "array",
      minItems: 3,
      maxItems: 12,
      items: atomizedConceptSchema,
    },
  },
  required: ["concepts"],
  additionalProperties: false,
};

const relationshipSchema: JsonObject = inventorySchema;

const quoteRepairSchema: JsonObject = {
  type: "object",
  properties: { quotedText: { type: "string" } },
  required: ["quotedText"],
  additionalProperties: false,
};

const orphanRepairSchema: JsonObject = {
  type: "object",
  properties: {
    from: { type: "string" },
    to: { type: "string" },
  },
  required: ["from", "to"],
  additionalProperties: false,
};

function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function stringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${field} must be an array of strings`);
  }
  return value as string[];
}

function parseConcepts(raw: JsonObject): AtomizedConcept[] {
  if (!Array.isArray(raw.concepts)) throw new Error("model output concepts must be an array");
  return raw.concepts.map((value, index) => {
    if (!isObject(value) || !isObject(value.provenance)) throw new Error(`concepts[${index}] is malformed`);
    for (const field of ["id", "title", "summary"] as const) {
      if (typeof value[field] !== "string" || value[field].trim().length === 0) {
        throw new Error(`concepts[${index}].${field} must be a non-blank string`);
      }
    }
    if (
      typeof value.provenance.sourceId !== "string" ||
      typeof value.provenance.quotedText !== "string" ||
      value.provenance.quotedText.trim().length === 0
    ) {
      throw new Error(`concepts[${index}].provenance must contain sourceId and quotedText`);
    }
    return {
      id: value.id as string,
      title: value.title as string,
      summary: value.summary as string,
      provenance: {
        sourceId: value.provenance.sourceId,
        quotedText: value.provenance.quotedText,
      },
      tags: stringArray(value.tags, `concepts[${index}].tags`),
      prerequisites: stringArray(value.prerequisites, `concepts[${index}].prerequisites`),
      related: stringArray(value.related, `concepts[${index}].related`),
    };
  });
}

function dedupeConcepts(concepts: AtomizedConcept[]): AtomizedConcept[] {
  const seenIds = new Set<string>();
  const seenTitles = new Set<string>();
  const out: AtomizedConcept[] = [];
  for (const concept of concepts) {
    const id = concept.id.trim().toLowerCase();
    const title = concept.title.trim().toLowerCase().replace(/\s+/g, " ");
    if (seenIds.has(id) || seenTitles.has(title)) continue;
    seenIds.add(id);
    seenTitles.add(title);
    out.push({ ...concept, id });
  }
  return out;
}

function sourcePassages(sourceText: string): string[] {
  return sourceText
    .split(/(?<=[.!?])\s+(?=[#A-Z0-9])/u)
    .map((passage) => passage.trim())
    .filter(Boolean);
}

function selectExcerpt(source: Source): string {
  const keywordsBySource: Record<string, RegExp> = {
    "d2l-linear-algebra": /vector|fixed-length array|dot product|scalar|same position/i,
    "d2l-softmax-regression": /softmax|add up to 1|dividing each by their sum|probabilit/i,
    "d2l-queries-keys-values": /query|keys and values|attention pooling|database/i,
    "d2l-self-attention": /self-attention|each token|query, keys, and values|attending/i,
  };
  const paragraphs = sourcePassages(source.text);
  const selected: string[] = [];
  const seen = new Set<string>();
  const add = (paragraph: string): void => {
    if (seen.has(paragraph) || paragraph.length > 5000) return;
    seen.add(paragraph);
    selected.push(paragraph);
  };
  for (const paragraph of paragraphs.slice(0, 4)) add(paragraph);
  const pattern = keywordsBySource[source.id] ?? /./;
  for (const paragraph of paragraphs) {
    if (pattern.test(paragraph)) add(paragraph);
    if (selected.join("\n\n").length >= 16000) break;
  }
  return selected.join("\n\n").slice(0, 18000);
}

function targetedQuoteExcerpt(source: Source, conceptId: string): string {
  const patterns: Record<string, RegExp> = {
    vectors: /you can think of a vector as a fixed-length array of scalars/i,
    "dot-product": /is a sum over the products of the elements at the same position/i,
    softmax: /transform these values so that they add up to 1 by dividing each by their sum/i,
    qkv: /actual "code" for executing on the set of keys and values, namely the query/i,
    "self-attention": /because every token is attending to each other token/i,
  };
  const pattern = patterns[conceptId] ?? new RegExp(conceptId.replace(/-/g, "[ -]"), "i");
  const paragraphs = sourcePassages(source.text);
  const matches = paragraphs.filter((paragraph) => pattern.test(paragraph) && paragraph.length <= 5000);
  return (matches.length > 0 ? matches : paragraphs.slice(0, 4)).slice(0, 4).join("\n\n");
}

function sourcePrompt(sources: Source[]): string {
  return sources
    .map((source) => `SOURCE_ID=${source.id}\nTITLE=${source.title}\n<<<\n${selectExcerpt(source)}\n>>>`)
    .join("\n\n");
}

export function loadSources(
  manifestPath: string = MANIFEST_PATH,
): { sources: Source[]; manifestBytes: Buffer } {
  const corpusDir = dirname(manifestPath);
  const raw = loadManifest(manifestPath);
  const entries = validateManifest(raw, corpusDir);
  const sources = entries.map((entry): Source => ({
    id: entry.id,
    title: entry.title,
    url: entry.url,
    license: entry.license,
    author: entry.author,
    text: readFileSync(resolve(corpusDir, entry.textPath), "utf8"),
  }));
  return { sources, manifestBytes: readFileSync(manifestPath) };
}

function groundInventory(concepts: AtomizedConcept[], sources: Source[], requiredIds: readonly string[]): AtomizedConcept[] {
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const grounded: AtomizedConcept[] = [];
  for (const concept of dedupeConcepts(concepts)) {
    const source = sourceById.get(concept.provenance.sourceId);
    const quote = source && groundedQuote(source.text, concept.provenance.quotedText);
    if (!source || !quote) {
      if (requiredIds.includes(concept.id)) {
        throw new GoldenGraphHalt(
          `model emitted ungrounded required node ${concept.id}; offending span ${JSON.stringify(concept.provenance.quotedText)}`,
        );
      }
      continue;
    }
    grounded.push({
      ...concept,
      provenance: { sourceId: source.id, quotedText: quote },
      prerequisites: [],
      related: [],
    });
  }
  const missing = requiredIds.filter((id) => !grounded.some((concept) => concept.id === id));
  if (missing.length > 0) throw new Error(`inventory omitted required IDs: ${missing.join(", ")}`);
  return grounded;
}

function mergeRelationships(inventory: AtomizedConcept[], relations: AtomizedConcept[]): AtomizedConcept[] {
  const relationById = new Map(relations.map((concept) => [concept.id, concept]));
  if (relationById.size !== inventory.length || inventory.some((concept) => !relationById.has(concept.id))) {
    throw new Error("relationship phase changed or omitted frozen concept IDs");
  }
  return inventory.map((concept) => ({
    ...concept,
    prerequisites: [...new Set(relationById.get(concept.id)?.prerequisites ?? [])],
    related: [...new Set(relationById.get(concept.id)?.related ?? [])],
  }));
}

function buildGraph(
  concepts: AtomizedConcept[],
  sources: Source[],
  goalId: string,
  unpinned = false,
): LearningGraph {
  const nodes: Concept[] = concepts.map(({ prerequisites: _prerequisites, related: _related, ...concept }) => concept);
  const edges: Edge[] = [];
  for (const concept of concepts) {
    for (const prerequisite of concept.prerequisites) {
      edges.push({ from: prerequisite, to: concept.id, type: "prereq" });
    }
    for (const related of concept.related) edges.push({ from: concept.id, to: related, type: "related" });
  }
  const seen = new Set<string>();
  return {
    concepts: nodes,
    edges: edges.filter((edge) => {
      const key = `${edge.from}\0${edge.to}\0${edge.type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
    sources,
    goalId,
    ...(unpinned ? { unpinned: true as const, artifactNote: UNPINNED_ARTIFACT_NOTE } : {}),
  };
}

function selectUnpinnedGoal(concepts: AtomizedConcept[]): string {
  const ids = new Set(concepts.map((concept) => concept.id));
  const outgoing = new Set(
    concepts.flatMap((concept) => concept.prerequisites.filter((id) => ids.has(id))),
  );
  const sinks = concepts
    .filter((concept) => concept.prerequisites.some((id) => ids.has(id)) && !outgoing.has(concept.id))
    .map((concept) => concept.id)
    .sort();
  const fallback = concepts.map((concept) => concept.id).sort();
  const goalId = sinks.at(-1) ?? fallback.at(-1);
  if (!goalId) throw new Error("unpinned atomization produced no concept to use as its goal");
  return goalId;
}

function hasRequiredChain(concepts: AtomizedConcept[], path: readonly string[]): boolean {
  return path.slice(0, -1).every((from, index) => {
    const to = path[index + 1];
    return concepts.find((concept) => concept.id === to)?.prerequisites.includes(from);
  });
}

async function inventoryPhase(
  client: ResponsesClient,
  sources: Source[],
  requiredIds: readonly string[],
  toy: boolean,
): Promise<AtomizedConcept[]> {
  const sourceIds = sources.map((source) => source.id);
  const instructions =
    "You atomize openly licensed educational source excerpts into one-concept lesson nodes. " +
    "Every quotedText must be copied verbatim from exactly one provided SOURCE block. Never invent, paraphrase, or normalize a quote. " +
    "Emit AtomizedConcept objects. This is inventory phase: prerequisites and related MUST be empty arrays. " +
    "Use only listed sourceId values. Summaries should describe exactly one self-contained concept.";
  const requiredIdInstruction = requiredIds.length > 0
    ? `Required stable IDs: ${requiredIds.join(", ")}.`
    : toy
      ? "Choose exactly three stable kebab-case IDs grounded in the supplied source."
      : "Choose 8 to 10 stable kebab-case IDs grounded in the supplied source.";
  const demoGroundingMap = toy || requiredIds.length === 0
    ? ""
    : "For the full demo run, use this grounding map: vectors -> d2l-linear-algebra; dot-product -> d2l-linear-algebra; softmax -> d2l-softmax-regression; qkv -> d2l-queries-keys-values; self-attention -> d2l-self-attention.\n";
  const input = `${toy ? "Produce exactly 3" : "Produce 8 to 10"} distinct concepts. ${requiredIdInstruction}
Required source IDs are restricted to: ${sourceIds.join(", ")}.
${demoGroundingMap}
Copy a substantial prose sentence for each quotedText. Do not rely on formula-only passages.

${sourcePrompt(sources)}`;

  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const raw = await client.request(instructions, input, inventorySchema, "concept_inventory");
      const proposed = parseConcepts(raw);
      for (const requiredId of requiredIds) {
        const concept = proposed.find((candidate) => candidate.id.trim().toLowerCase() === requiredId);
        const source = concept && sources.find((candidate) => candidate.id === concept.provenance.sourceId);
        if (!concept || !source || groundedQuote(source.text, concept.provenance.quotedText)) continue;
        const repaired = await client.request(
          "Repair one required node's provenance. Return one substantial prose sentence copied verbatim from the supplied STORED source passage. Never paraphrase, normalize punctuation, or use formula-adjacent prose whose symbols are omitted.",
          `Required node: ${requiredId}\nSource ID: ${source.id}\nSTORED source passage:\n<<<\n${targetedQuoteExcerpt(source, requiredId)}\n>>>`,
          quoteRepairSchema,
          "required_quote_repair",
        );
        if (typeof repaired.quotedText === "string") concept.provenance.quotedText = repaired.quotedText;
      }
      const grounded = groundInventory(proposed, sources, requiredIds);
      if (!toy && grounded.length < 6) throw new Error(`only ${grounded.length} grounded concepts survived`);
      return grounded;
    } catch (error) {
      lastError = error;
      console.warn(`Inventory attempt ${attempt} failed: ${String(error)}`);
      if (error instanceof GoldenGraphHalt && attempt === 3) throw error;
    }
  }
  throw new Error(`inventory phase failed after 3 attempts: ${String(lastError)}`);
}

async function relationshipPhase(
  client: ResponsesClient,
  inventory: AtomizedConcept[],
  requiredPath: readonly string[],
): Promise<AtomizedConcept[]> {
  const ids = inventory.map((concept) => concept.id);
  const instructions =
    "Infer learning relations only among a frozen concept inventory. Return AtomizedConcept objects, copying id, title, summary, provenance, and tags exactly. " +
    "Fill prerequisites and related only with IDs from the frozen set. A prerequisite p in node n means edge p -> n. Never mint an ID.";
  const requiredPathInstruction = requiredPath.length > 0
    ? `Required direct prerequisite chain: ${requiredPath.join(" -> ")}. Every consecutive pair MUST be encoded in the later node's prerequisites array.\n`
    : "";
  const input = `Frozen IDs: ${ids.join(", ")}.
${requiredPathInstruction}Make every non-root concept participate in the prerequisite graph; avoid cycles. Related links do not count as prerequisites.

Frozen inventory JSON:
${JSON.stringify({ concepts: inventory }, null, 2)}`;

  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const raw = await client.request(instructions, input, relationshipSchema, "concept_relationships");
      const merged = mergeRelationships(inventory, parseConcepts(raw));
      if (!hasRequiredChain(merged, requiredPath)) throw new Error("relationship phase omitted the required direct chain");
      return merged;
    } catch (error) {
      lastError = error;
      console.warn(`Relationship attempt ${attempt} failed: ${String(error)}`);
    }
  }
  if (requiredPath.length > 0) {
    throw new GoldenGraphHalt(`required golden edges remain unrepairable: ${String(lastError)}`);
  }
  throw new Error(`relationship phase failed after 3 attempts: ${String(lastError)}`);
}

export function selectToySource(sources: Source[]): Source {
  const source = sources[0];
  if (!source) throw new Error("toy corpus requires one licensed source");
  return source;
}

async function runToy(client: ResponsesClient, sources: Source[]): Promise<void> {
  const toySource = selectToySource(sources);
  const toySources = [toySource];
  const inventory = await inventoryPhase(client, toySources, [], true);
  if (inventory.length !== 3) {
    throw new Error(`toy dry-run requires exactly 3 grounded concepts; received ${inventory.length}`);
  }
  const required = inventory.map(({ id }) => id);
  const related = await relationshipPhase(client, inventory, required);
  const graph = buildGraph(related, toySources, required.at(-1)!);
  if (graph.concepts.length < 3 || invalidProvenance(graph).length > 0) {
    throw new Error("toy dry-run failed grounding or concept-count checks");
  }
  const translated = await translateAndConvergeLessons(graph, client);
  const lessonIssues = invalidLessonCitations(translated);
  if (lessonIssues.length > 0) {
    throw new Error(`toy dry-run failed lesson citation checks: ${JSON.stringify(lessonIssues)}`);
  }
  checkLessonReadability(translated);
  const enriched = await generateAnalogies(translated, client);
  const analogyCount = enriched.concepts.reduce(
    (total, concept) =>
      total +
      (concept.lesson?.steps.reduce(
        (stepTotal, step) => stepTotal + Object.keys(step.analogies ?? {}).length,
        0,
      ) ?? 0),
    0,
  );
  console.log(
    `TOY DRY RUN PASS: ${enriched.concepts.length} grounded concepts with translated lessons and ${analogyCount} optional analogies; no artifact written.`,
  );
}

export interface AtomizeOptions {
  manifestPath: string;
  outDir?: string;
  overwriteExisting: boolean;
  toyOnly: boolean;
  noSpine: boolean;
}

export function parseAtomizeArgs(args: readonly string[]): AtomizeOptions {
  let manifestPath = process.env.OER_MANIFEST_PATH
    ? resolve(process.env.OER_MANIFEST_PATH)
    : MANIFEST_PATH;
  let outDir: string | undefined;
  let overwriteExisting = false;
  let toyOnly = false;
  let noSpine = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--toy") toyOnly = true;
    else if (arg === "--no-spine") noSpine = true;
    else if (arg === "--overwrite-existing") overwriteExisting = true;
    else if (arg === "--manifest" || arg === "--out-dir") {
      const value = args[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${arg} requires a path`);
      if (arg === "--manifest") manifestPath = resolve(repoRoot, value);
      else outDir = resolve(repoRoot, value);
      index += 1;
    } else {
      throw new Error(`unknown option: ${arg}`);
    }
  }
  if (!toyOnly && !outDir) {
    throw new Error("--out-dir is required; atomization never writes into data/ implicitly");
  }
  if (toyOnly && noSpine) throw new Error("--no-spine is only valid for a full artifact run");
  return { manifestPath, outDir, overwriteExisting, toyOnly, noSpine };
}

export async function main(args: readonly string[] = process.argv.slice(2)): Promise<void> {
  const options = parseAtomizeArgs(args);
  const outDir = options.outDir;
  const graphPath = outDir ? resolve(outDir, "graph.json") : undefined;
  const runLogPath = outDir ? resolve(outDir, "graph.run.json") : undefined;
  const atomicityReportPath = outDir ? resolve(outDir, "atomicity-report.json") : undefined;
  const outputPaths = [graphPath, runLogPath, atomicityReportPath].filter(
    (path): path is string => path !== undefined,
  );
  if (!options.overwriteExisting) {
    const existing = outputPaths.filter((path) => existsSync(path));
    if (existing.length > 0) {
      throw new Error(
        `refusing to overwrite existing atomization artifact(s): ${existing.join(", ")}; ` +
          "pass --overwrite-existing only for an intentional replacement",
      );
    }
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required for build-time atomization");
  const { sources, manifestBytes } = loadSources(options.manifestPath);
  const client = new ResponsesClient(apiKey);
  await client.initialize();
  console.log(`Using ${client.model}; strict Structured Outputs=${client.strictSchema}`);

  if (options.toyOnly) {
    await runToy(client, sources);
    return;
  }

  const spine = options.noSpine ? [] : GOLDEN_PATH;
  const inventory = await inventoryPhase(client, sources, spine, false);
  const atomized = await relationshipPhase(client, inventory, spine);
  const goalId = options.noSpine ? selectUnpinnedGoal(atomized) : GOLDEN_PATH.at(-1)!;
  const initialGraph = buildGraph(atomized, sources, goalId, options.noSpine);
  const expectedSources: ExpectedSource[] = sources.map((source) => ({ ...source }));
  const attemptLog: Array<{ attempt: number; issues: unknown[] }> = [];

  const baseConverged = await convergeGraph(initialGraph, {
    expectedSources,
    spine,
    onAttempt: (attempt, issues) => {
      attemptLog.push({ attempt, issues });
      console.log(`Convergence attempt ${attempt}: ${issues.length === 0 ? "PASS" : issues.map((issue) => issue.kind).join(", ")}`);
    },
    repairProvenance: async (graph, conceptId) => {
      const concept = graph.concepts.find((candidate) => candidate.id === conceptId);
      const source = concept && graph.sources.find((candidate) => candidate.id === concept.provenance.sourceId);
      if (!concept || !source) return graph;
      const raw = await client.request(
        "Return one verbatim prose quote copied from the supplied source excerpt. Never paraphrase.",
        `Concept: ${concept.title}\nSource:\n<<<\n${selectExcerpt(source)}\n>>>`,
        quoteRepairSchema,
        "quote_repair",
      );
      if (typeof raw.quotedText !== "string") return graph;
      const quote = groundedQuote(source.text, raw.quotedText);
      if (quote) concept.provenance.quotedText = quote;
      return graph;
    },
    repairOrphan: async (graph, conceptId, frozenIds) => {
      const orphanConstraint = spine.length > 0
        ? "Do not create a self-loop or an edge that reverses the required golden chain."
        : "Do not create a self-loop.";
      const raw = await client.request(
        "Connect one orphan concept to a prerequisite DAG using only frozen IDs. Return one prereq edge from -> to; from must be learned before to.",
        `Orphan: ${conceptId}\nFrozen IDs: ${frozenIds.join(", ")}\n${orphanConstraint}`,
        orphanRepairSchema,
        "orphan_repair",
      );
      if (typeof raw.from !== "string" || typeof raw.to !== "string") return graph;
      if (!frozenIds.includes(raw.from) || !frozenIds.includes(raw.to) || raw.from === raw.to) return graph;
      graph.edges.push({ from: raw.from, to: raw.to, type: "prereq" });
      return graph;
    },
  });

  const converged = await translateAndConvergeLessons(baseConverged, client);
  const readabilityWarnings = checkLessonReadability(converged);
  const warnings = [...reportAtomicityWarnings(converged), ...readabilityWarnings];
  let enriched = converged;
  try {
    enriched = await generateAnalogies(converged, client);
  } catch (error) {
    // Optional illustrations never gate graph emission, even if the enrichment layer itself fails.
    console.warn(`Analogy layer failed; continuing without analogies: ${String(error)}`);
  }

  // The sole graph write is guarded again at the artifact boundary, after lesson-only convergence
  // and the hard readability floor have both passed.
  mkdirSync(outDir as string, { recursive: true });
  const writeOptions = { overwriteExisting: options.overwriteExisting };
  const graphBytes = writeGraphArtifact(graphPath as string, enriched, writeOptions);
  const runLog = {
    model: client.modelSnapshot || client.model,
    requestedModel: client.model,
    promptVersion: PROMPT_VERSION,
    analogyPromptVersion: ANALOGY_PROMPT_VERSION,
    strictStructuredOutputs: client.strictSchema,
    manifestSha256: sha256(manifestBytes),
    graphSha256: sha256(graphBytes),
    responseIds: client.responseIds,
    convergence: attemptLog,
    ...(options.noSpine ? { unpinned: true, artifactNote: UNPINNED_ARTIFACT_NOTE } : {}),
  };

  writeJsonArtifact(runLogPath as string, runLog, writeOptions);
  writeJsonArtifact(
    atomicityReportPath as string,
    { advisoryOnly: true, warnings },
    writeOptions,
  );
  console.log(
    `ATOMIZATION PASS: wrote ${enriched.concepts.length} concepts, ${enriched.edges.length} edges, ` +
      `${enriched.sources.length} complete sources; ${warnings.length} advisory atomicity warnings.`,
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : error);
    process.exitCode = 1;
  });
}
