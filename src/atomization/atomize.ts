import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { AtomizedConcept, Concept, Edge, LearningGraph, Source } from "../types";
import { reportAtomicityWarnings } from "../graph/atomicity-report";
import { invalidProvenance } from "../graph/invariants";
import { MANIFEST_PATH, OER_DIR, loadManifest, validateManifest } from "./manifest";
import {
  GOLDEN_PATH,
  GoldenGraphHalt,
  convergeGraph,
  type ExpectedSource,
} from "./repair";

const PROMPT_VERSION = "atomizer-v1-extractive-two-phase";
const GRAPH_PATH = resolve(OER_DIR, "..", "graph.json");
const RUN_LOG_PATH = resolve(OER_DIR, "..", "graph.run.json");
const ATOMICITY_REPORT_PATH = resolve(OER_DIR, "..", "atomicity-report.json");
const MODEL_CANDIDATES = [process.env.OPENAI_MODEL ?? "gpt-5.6-sol", "gpt-5.4"];

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

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function outputText(response: JsonObject): string {
  const output = response.output;
  if (!Array.isArray(output)) throw new Error("OpenAI response contains no output array");
  for (const item of output) {
    if (!isObject(item) || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (isObject(content) && content.type === "output_text" && typeof content.text === "string") {
        return content.text;
      }
    }
  }
  throw new Error("OpenAI response contains no output_text content");
}

class ResponsesClient {
  readonly responseIds: string[] = [];
  model = "";
  modelSnapshot = "";
  strictSchema = false;

  constructor(private readonly apiKey: string) {}

  private async api(path: string, init: RequestInit = {}): Promise<JsonObject> {
    const response = await fetch(`https://api.openai.com/v1${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        ...(init.body ? { "content-type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
    });
    const raw = (await response.json()) as JsonObject;
    if (!response.ok) {
      const error = isObject(raw.error) && typeof raw.error.message === "string" ? raw.error.message : JSON.stringify(raw);
      throw new Error(`OpenAI API ${response.status} ${path}: ${error}`);
    }
    return raw;
  }

  async initialize(): Promise<void> {
    const candidates = [...new Set(MODEL_CANDIDATES)];
    for (const model of candidates) {
      try {
        await this.api(`/models/${encodeURIComponent(model)}`);
        this.model = model;
        break;
      } catch (error) {
        console.warn(`Model ${model} unavailable: ${String(error)}`);
      }
    }
    if (!this.model) throw new Error(`none of the pinned GPT-5.x candidates are available: ${candidates.join(", ")}`);

    try {
      const probe = await this.request(
        "Return exactly the requested object.",
        "Set ok to true.",
        {
          type: "object",
          properties: { ok: { type: "boolean" } },
          required: ["ok"],
          additionalProperties: false,
        },
        "strict_probe",
        true,
      );
      if (probe.ok !== true) throw new Error("strict probe returned the wrong value");
      this.strictSchema = true;
    } catch (error) {
      this.strictSchema = false;
      console.warn(`Strict Structured Outputs probe failed; using parse-and-validate fallback: ${String(error)}`);
    }
  }

  async request(
    instructions: string,
    input: string,
    schema: JsonObject,
    schemaName: string,
    forceStrict = false,
  ): Promise<JsonObject> {
    const useStrict = forceStrict || this.strictSchema;
    const body: JsonObject = {
      model: this.model,
      instructions,
      input,
      reasoning: { effort: "low" },
      max_output_tokens: 10000,
    };
    if (useStrict) {
      body.text = {
        format: {
          type: "json_schema",
          name: schemaName,
          strict: true,
          schema,
        },
      };
    }
    const response = await this.api("/responses", { method: "POST", body: JSON.stringify(body) });
    if (typeof response.id === "string") this.responseIds.push(response.id);
    if (typeof response.model === "string") this.modelSnapshot = response.model;
    const text = outputText(response);
    try {
      const parsed = JSON.parse(text) as unknown;
      if (!isObject(parsed)) throw new Error("top-level JSON value is not an object");
      return parsed;
    } catch (error) {
      throw new Error(`model output is not valid JSON: ${String(error)}; output=${text.slice(0, 500)}`);
    }
  }
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

function groundedQuote(sourceText: string, proposedQuote: string): string | undefined {
  const tokens = proposedQuote.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return undefined;
  const escaped = tokens.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const match = sourceText.match(new RegExp(escaped.join("\\s+"), "u"));
  return match?.[0];
}

function selectExcerpt(source: Source): string {
  const keywordsBySource: Record<string, RegExp> = {
    "wikipedia-euclidean-vector": /vector|magnitude|direction|coordinate/i,
    "wikipedia-dot-product": /dot product|scalar product|coordinate vector|angle/i,
    "wikipedia-softmax-function": /softmax|probability distribution|normalize|exponential/i,
    "wikipedia-attention": /self-attention|query, key, and value|dot products|softmax|token embeddings|attention weight/i,
  };
  const paragraphs = source.text.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
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
    vectors: /Euclidean vector|magnitude .* direction/i,
    "dot-product": /dot product is an algebraic operation|Algebraically, the dot product/i,
    softmax: /softmax function.*probability distribution|softmax function takes as input/i,
    qkv: /Self-attention is essentially.*query, key, and value vectors/i,
    "self-attention": /major breakthrough came with self-attention|Self-attention is essentially/i,
  };
  const pattern = patterns[conceptId] ?? new RegExp(conceptId.replace(/-/g, "[ -]"), "i");
  const paragraphs = source.text.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const matches = paragraphs.filter((paragraph) => pattern.test(paragraph) && paragraph.length <= 5000);
  return (matches.length > 0 ? matches : paragraphs.slice(0, 4)).slice(0, 4).join("\n\n");
}

function sourcePrompt(sources: Source[]): string {
  return sources
    .map((source) => `SOURCE_ID=${source.id}\nTITLE=${source.title}\n<<<\n${selectExcerpt(source)}\n>>>`)
    .join("\n\n");
}

function loadSources(): { sources: Source[]; manifestBytes: Buffer } {
  const manifestPath = process.env.OER_MANIFEST_PATH ?? MANIFEST_PATH;
  const raw = loadManifest(manifestPath);
  const entries = validateManifest(raw);
  const sources = entries.map((entry): Source => ({
    id: entry.id,
    title: entry.title,
    url: entry.url,
    license: entry.license,
    author: entry.author,
    text: readFileSync(resolve(OER_DIR, entry.textPath), "utf8"),
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

function buildGraph(concepts: AtomizedConcept[], sources: Source[], goalId: string): LearningGraph {
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
  };
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
  const input = `${toy ? "Produce exactly 3" : "Produce 8 to 10"} distinct concepts. Required stable IDs: ${requiredIds.join(", ")}.
Required source IDs are restricted to: ${sourceIds.join(", ")}.
For the full run, use this grounding map: vectors -> wikipedia-euclidean-vector; dot-product -> wikipedia-dot-product; softmax -> wikipedia-softmax-function; qkv and self-attention -> wikipedia-attention.
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
  const input = `Frozen IDs: ${ids.join(", ")}.
Required direct prerequisite chain: ${requiredPath.join(" -> ")}. Every consecutive pair MUST be encoded in the later node's prerequisites array.
Make every non-root concept participate in the prerequisite graph; avoid cycles. Related links do not count as prerequisites.

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
  throw new GoldenGraphHalt(`required golden edges remain unrepairable: ${String(lastError)}`);
}

async function runToy(client: ResponsesClient, sources: Source[]): Promise<void> {
  const dotProduct = sources.filter((source) => source.id === "wikipedia-dot-product");
  if (dotProduct.length !== 1) throw new Error("toy corpus requires wikipedia-dot-product");
  const required = ["vectors", "dot-product", "scalar"] as const;
  const inventory = await inventoryPhase(client, dotProduct, required, true);
  const related = await relationshipPhase(client, inventory, required);
  const graph = buildGraph(related, dotProduct, "scalar");
  if (graph.concepts.length < 3 || invalidProvenance(graph).length > 0) {
    throw new Error("toy dry-run failed grounding or concept-count checks");
  }
  console.log(`TOY DRY RUN PASS: ${graph.concepts.length} grounded concepts; no artifact written.`);
}

async function main(): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is required for build-time atomization");
  const { sources, manifestBytes } = loadSources();
  const client = new ResponsesClient(apiKey);
  await client.initialize();
  console.log(`Using ${client.model}; strict Structured Outputs=${client.strictSchema}`);

  const toyOnly = process.argv.includes("--toy");
  if (toyOnly) {
    await runToy(client, sources);
    return;
  }

  const inventory = await inventoryPhase(client, sources, GOLDEN_PATH, false);
  const atomized = await relationshipPhase(client, inventory, GOLDEN_PATH);
  const initialGraph = buildGraph(atomized, sources, "self-attention");
  const expectedSources: ExpectedSource[] = sources.map((source) => ({ ...source }));
  const attemptLog: Array<{ attempt: number; issues: unknown[] }> = [];

  const converged = await convergeGraph(initialGraph, {
    expectedSources,
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
      const raw = await client.request(
        "Connect one orphan concept to a prerequisite DAG using only frozen IDs. Return one prereq edge from -> to; from must be learned before to.",
        `Orphan: ${conceptId}\nFrozen IDs: ${frozenIds.join(", ")}\nDo not create a self-loop or an edge that reverses the required golden chain.`,
        orphanRepairSchema,
        "orphan_repair",
      );
      if (typeof raw.from !== "string" || typeof raw.to !== "string") return graph;
      if (!frozenIds.includes(raw.from) || !frozenIds.includes(raw.to) || raw.from === raw.to) return graph;
      graph.edges.push({ from: raw.from, to: raw.to, type: "prereq" });
      return graph;
    },
  });

  const warnings = reportAtomicityWarnings(converged);
  const graphBytes = Buffer.from(`${JSON.stringify(converged, null, 2)}\n`, "utf8");
  const runLog = {
    model: client.modelSnapshot || client.model,
    requestedModel: client.model,
    promptVersion: PROMPT_VERSION,
    strictStructuredOutputs: client.strictSchema,
    manifestSha256: sha256(manifestBytes),
    graphSha256: sha256(graphBytes),
    responseIds: client.responseIds,
    convergence: attemptLog,
  };

  // The first write to graph.json occurs only after convergeGraph returns with zero hard issues.
  writeFileSync(GRAPH_PATH, graphBytes);
  writeFileSync(RUN_LOG_PATH, `${JSON.stringify(runLog, null, 2)}\n`);
  writeFileSync(ATOMICITY_REPORT_PATH, `${JSON.stringify({ advisoryOnly: true, warnings }, null, 2)}\n`);
  console.log(
    `ATOMIZATION PASS: wrote ${converged.concepts.length} concepts, ${converged.edges.length} edges, ` +
      `${converged.sources.length} complete sources; ${warnings.length} advisory atomicity warnings.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
