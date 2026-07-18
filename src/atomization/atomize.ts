import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { AtomizedConcept, Concept, Edge, LearningGraph, Source } from "../types";
import {
  reportAtomicityWarnings,
  reportAtomicityWarningsWithScorer,
} from "../graph/atomicity-report";
import { llmJudgeAtomicityScorer } from "../graph/atomicity-scorer-llm";
import { invalidLessonCitations, invalidProvenance } from "../graph/invariants";
import { checkLessonReadability } from "../graph/readability";
import { MANIFEST_PATH, OER_DIR, loadManifest, validateManifest } from "./manifest";
import {
  FULL_GRAPH_SPINE,
  GoldenGraphHalt,
  convergeGraph,
  type ExpectedSource,
  type FullGraphSpine,
} from "./repair";
import {
  writeGraphArtifact,
  writeJsonArtifact,
  type ArtifactWriteOptions,
} from "./artifacts";
import { ANALOGY_PROMPT_VERSION, generateAnalogies } from "./analogy";
import { ResponsesClient, isObject } from "./client";
import { dedupeCandidates } from "./dedupe";
import { groundedQuote } from "./grounding";
import { buildRunCostReceipt } from "./run-receipt";
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

const pinnedInventorySchema: JsonObject = {
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

const relationshipSchema: JsonObject = pinnedInventorySchema;

const inventorySchema: JsonObject = {
  type: "object",
  properties: {
    concepts: {
      type: "array",
      minItems: 0,
      maxItems: 6,
      items: atomizedConceptSchema,
    },
  },
  required: ["concepts"],
  additionalProperties: false,
};

const edgeListSchema: JsonObject = {
  type: "object",
  properties: {
    edges: {
      type: "array",
      maxItems: 400,
      items: {
        type: "object",
        properties: {
          from: { type: "string" },
          to: { type: "string" },
        },
        required: ["from", "to"],
        additionalProperties: false,
      },
    },
  },
  required: ["edges"],
  additionalProperties: false,
};

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
    const idKey = JSON.stringify([concept.provenance.sourceId, id]);
    const titleKey = JSON.stringify([concept.provenance.sourceId, title]);
    if (seenIds.has(idKey) || seenTitles.has(titleKey)) continue;
    seenIds.add(idKey);
    seenTitles.add(titleKey);
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

type ProtectedChunkKind = "fence" | "math" | "table" | "scripture";

interface ChunkRange {
  start: number;
  end: number;
  barrierBefore: boolean;
  barrierAfter: boolean;
}

interface ProtectedChunkRange extends ChunkRange {
  kind: ProtectedChunkKind;
}

interface SourceLineRange {
  start: number;
  contentEnd: number;
  end: number;
  content: string;
}

const CHUNK_OVERSIZE_MULTIPLE = 4;
const CHUNK_BOUNDARY_EPSILON = 1;

function sourceLineRanges(text: string): SourceLineRange[] {
  const lines: SourceLineRange[] = [];
  let start = 0;
  while (start < text.length) {
    const newline = text.indexOf("\n", start);
    const contentEnd = newline === -1 ? text.length : newline;
    const end = newline === -1 ? text.length : newline + 1;
    lines.push({ start, contentEnd, end, content: text.slice(start, contentEnd) });
    start = end;
  }
  return lines;
}

function hardBoundaryIndexes(
  text: string,
  lines: SourceLineRange[],
  fencedRanges: ProtectedChunkRange[],
): number[] {
  const boundaries: number[] = [];
  for (const line of lines) {
    if (rangeContaining(fencedRanges, line.start)) continue;
    if (/^(?:#\s+\S|(?:book|chapter)(?:\s+|:))/i.test(line.content.trimStart())) {
      boundaries.push(line.start);
    }
  }
  if (boundaries[0] !== 0) boundaries.unshift(0);
  if (boundaries[boundaries.length - 1] !== text.length) boundaries.push(text.length);
  return boundaries;
}

function nextBoundaryAfter(boundaries: number[], index: number, fallback: number): number {
  for (const boundary of boundaries) {
    if (boundary > index) return boundary;
  }
  return fallback;
}

function boundedProduct(value: number, multiplier: number): number {
  return value > Math.floor(Number.MAX_SAFE_INTEGER / multiplier)
    ? Number.MAX_SAFE_INTEGER
    : value * multiplier;
}

function rangeContaining(ranges: ProtectedChunkRange[], index: number): ProtectedChunkRange | undefined {
  let low = 0;
  let high = ranges.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (ranges[middle].start <= index) low = middle + 1;
    else high = middle;
  }
  const candidate = ranges[low - 1];
  return candidate && index < candidate.end ? candidate : undefined;
}

function firstRangeEndingAfter(ranges: ProtectedChunkRange[], index: number): number {
  let low = 0;
  let high = ranges.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (ranges[middle].end <= index) low = middle + 1;
    else high = middle;
  }
  return low;
}

function isEscaped(text: string, index: number): boolean {
  let slashes = 0;
  for (let cursor = index - 1; cursor >= 0 && text[cursor] === "\\"; cursor -= 1) slashes += 1;
  return slashes % 2 === 1;
}

function findLiteralCloser(
  text: string,
  token: string,
  start: number,
  limit: number,
): number | undefined {
  let cursor = text.indexOf(token, start);
  while (cursor !== -1 && cursor + token.length <= limit) {
    if (!isEscaped(text, cursor)) return cursor + token.length;
    cursor = text.indexOf(token, cursor + token.length);
  }
  return undefined;
}

function mapFencedCodeRanges(
  text: string,
  lines: SourceLineRange[],
  maxMaskSpan: number,
): ProtectedChunkRange[] {
  const ranges: ProtectedChunkRange[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const opener = line.content.match(/^ {0,3}(`{3,}|~{3,})/);
    if (!opener) continue;
    const marker = opener[1];
    const scanLimit = Math.min(text.length, line.start + maxMaskSpan);
    let closerIndex: number | undefined;
    for (let candidate = index + 1; candidate < lines.length; candidate += 1) {
      const closer = lines[candidate];
      if (closer.start >= scanLimit || closer.contentEnd > scanLimit) break;
      const trimmed = closer.content.trimStart();
      const closingRun = trimmed.match(/^(`+|~+)/)?.[1];
      if (
        closingRun &&
        closingRun[0] === marker[0] &&
        closingRun.length >= marker.length &&
        trimmed.slice(closingRun.length).trim().length === 0
      ) {
        closerIndex = candidate;
        break;
      }
    }
    // SAFE / DISARMED: an unterminated opener owns no bytes and cannot mask to EOF.
    if (closerIndex === undefined) continue;
    const closer = lines[closerIndex];
    ranges.push({
      start: line.start,
      end: closer.contentEnd,
      kind: "fence",
      barrierBefore: true,
      barrierAfter: true,
    });
    index = closerIndex;
  }
  return ranges;
}

function mapPipeTableCandidates(lines: SourceLineRange[]): ProtectedChunkRange[] {
  const ranges: ProtectedChunkRange[] = [];
  let index = 0;
  while (index < lines.length) {
    if (!lines[index].content.includes("|")) {
      index += 1;
      continue;
    }
    const start = index;
    let hasSeparator = false;
    while (index < lines.length && lines[index].content.includes("|")) {
      if (/^\s*\|?[\s:|-]+\|[\s:|-]*\|?\s*$/.test(lines[index].content)) hasSeparator = true;
      index += 1;
    }
    if (hasSeparator && index - start >= 2) {
      ranges.push({
        start: lines[start].start,
        end: lines[index - 1].contentEnd,
        kind: "table",
        barrierBefore: true,
        barrierAfter: true,
      });
    }
  }
  return ranges;
}

function mapScriptureCandidates(lines: SourceLineRange[]): ProtectedChunkRange[] {
  const ranges: ProtectedChunkRange[] = [];
  let index = 0;
  while (index < lines.length) {
    if (!/^\s*\d+:\d+(?:[-–]\d+)?\s+\S/.test(lines[index].content)) {
      index += 1;
      continue;
    }
    const start = index;
    while (index < lines.length && /^\s*\d+:\d+(?:[-–]\d+)?\s+\S/.test(lines[index].content)) {
      index += 1;
    }
    if (index - start >= 2) {
      ranges.push({
        start: lines[start].start,
        end: lines[index - 1].contentEnd,
        kind: "scripture",
        barrierBefore: true,
        barrierAfter: true,
      });
    }
  }
  return ranges;
}

function mathRangeAt(text: string, index: number, limit: number): ProtectedChunkRange | undefined {
  let openerLength = 0;
  let closer = "";
  let inline = false;
  if (text.startsWith("$$", index) && !isEscaped(text, index)) {
    openerLength = 2;
    closer = "$$";
  } else if (text[index] === "$" && !isEscaped(text, index)) {
    openerLength = 1;
    closer = "$";
    inline = true;
  } else if (text.startsWith("\\[", index)) {
    openerLength = 2;
    closer = "\\]";
  } else if (text.startsWith("\\(", index)) {
    openerLength = 2;
    closer = "\\)";
    inline = true;
  } else {
    if (!text.startsWith("\\begin{", index)) return undefined;
    const begin = text.slice(index, Math.min(limit, index + 64)).match(/^\\begin\{([A-Za-z*]+)\}/);
    if (!begin) return undefined;
    openerLength = begin[0].length;
    closer = `\\end{${begin[1]}}`;
  }

  const end = findLiteralCloser(text, closer, index + openerLength, limit);
  // SAFE / DISARMED: no closer before the HARD/cap limit means literal prose, not a mask.
  if (end === undefined) return undefined;
  if (closer === "$" && text.slice(index + openerLength, end - 1).includes("\n\n")) return undefined;
  return {
    start: index,
    end,
    kind: "math",
    barrierBefore: !inline,
    barrierAfter: !inline,
  };
}

function mapProtectedChunkRanges(
  text: string,
  lines: SourceLineRange[],
  hardBoundaries: number[],
  fencedRanges: ProtectedChunkRange[],
  maxMaskSpan: number,
): ProtectedChunkRange[] {
  // SAFE: fenced code is mapped first. Its interior is skipped by every later detector.
  const admitted: ProtectedChunkRange[] = [];
  const tableByStart = new Map(mapPipeTableCandidates(lines).map((range) => [range.start, range]));
  const scriptureByStart = new Map(mapScriptureCandidates(lines).map((range) => [range.start, range]));

  // SAFE: one deterministic left-to-right pass; first admitted opener owns its entire range.
  let index = 0;
  let fenceIndex = 0;
  while (index < text.length) {
    while (fenceIndex < fencedRanges.length && fencedRanges[fenceIndex].end <= index) {
      fenceIndex += 1;
    }
    const occupied = fencedRanges[fenceIndex];
    if (occupied && occupied.start <= index) {
      index = occupied.end;
      continue;
    }
    const nextExisting = occupied?.start ?? text.length;
    const hardLimit = nextBoundaryAfter(hardBoundaries, index, text.length);
    const limit = Math.min(hardLimit, nextExisting, index + maxMaskSpan);
    const math = mathRangeAt(text, index, limit);
    const structural = tableByStart.get(index) ?? scriptureByStart.get(index);
    const candidate = math ?? (structural && structural.end <= limit ? structural : undefined);
    if (!candidate) {
      index += 1;
      continue;
    }
    admitted.push(candidate);
    index = candidate.end;
  }
  return [...fencedRanges, ...admitted].sort((left, right) => left.start - right.start);
}

function trimChunkRange(text: string, range: ChunkRange): ChunkRange | undefined {
  let start = range.start;
  let end = range.end;
  while (start < end && /\s/u.test(text[start])) start += 1;
  while (end > start && /\s/u.test(text[end - 1])) end -= 1;
  if (start >= end) return undefined;
  return { ...range, start, end };
}

function cutFallsInsideMask(cut: number, masks: ProtectedChunkRange[]): boolean {
  let low = 0;
  let high = masks.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (masks[middle].start < cut) low = middle + 1;
    else high = middle;
  }
  const candidate = masks[low - 1];
  return candidate !== undefined && cut < candidate.end;
}

/**
 * Monotone prefix bracket balance for cuts measured from one fixed `start`, with masked spans
 * skipped. One instance sweeps its range at most once, so checking every candidate cut in a range
 * is O(range length) total; the previous per-cut rescan made dense single-blob text quadratic
 * (a ~1.5MB blob took minutes). `balancedAt` requires non-decreasing cuts per instance — both
 * call sites iterate cuts in ascending order. Counting semantics are identical: characters are
 * classified only at positions outside every mask, and skip order cannot change that set.
 */
class ChunkBalanceScanner {
  private cursor: number;
  private maskIndex = 0;
  private readonly masks: ProtectedChunkRange[];
  private curly = 0;
  private square = 0;
  private round = 0;

  constructor(private readonly text: string, start: number, masks: ProtectedChunkRange[]) {
    this.cursor = start;
    this.masks = masks;
    this.maskIndex = firstRangeEndingAfter(masks, start);
  }

  balancedAt(cut: number): boolean {
    while (this.cursor < cut) {
      while (this.maskIndex < this.masks.length && this.masks[this.maskIndex].end <= this.cursor) {
        this.maskIndex += 1;
      }
      const mask = this.masks[this.maskIndex];
      if (mask && mask.start <= this.cursor) {
        this.cursor = Math.min(mask.end, cut);
        continue;
      }
      const character = this.text[this.cursor];
      if (character === "{") this.curly += 1;
      else if (character === "}") this.curly -= 1;
      else if (character === "[") this.square += 1;
      else if (character === "]") this.square -= 1;
      else if (character === "(") this.round += 1;
      else if (character === ")") this.round -= 1;
      this.cursor += 1;
    }
    return this.curly === 0 && this.square === 0 && this.round === 0;
  }
}

function protectedBoundaries(start: number, end: number, masks: ProtectedChunkRange[]): number[] {
  return masks.flatMap((mask) => [mask.start, mask.end]).filter((cut) => start < cut && cut < end);
}

function headingBoundaries(text: string, start: number, end: number): number[] {
  const cuts: number[] = [];
  const pattern = /^#{2,6}\s+\S/gmu;
  pattern.lastIndex = start;
  let match = pattern.exec(text);
  while (match && match.index < end) {
    cuts.push(match.index);
    match = pattern.exec(text);
  }
  return cuts;
}

function paragraphBoundaries(text: string, start: number, end: number): number[] {
  const cuts: number[] = [];
  const pattern = /\n[\t \r]*\n[\s]*/gu;
  pattern.lastIndex = start;
  let match = pattern.exec(text);
  while (match && match.index < end) {
    cuts.push(match.index + match[0].length);
    match = pattern.exec(text);
  }
  return cuts;
}

function listBoundaries(text: string, start: number, end: number, size: number): number[] {
  const cuts: number[] = [];
  const pattern = /^\s*(?:[-+*]|\d+[.)])\s+\S/gmu;
  pattern.lastIndex = start;
  let match = pattern.exec(text);
  while (match && match.index < end) {
    const cut = match.index + (match[0].match(/^\s*/u)?.[0].length ?? 0);
    const stem = text.slice(start, cut).trimEnd();
    if (!(cuts.length === 0 && stem.endsWith(":") && end - start <= size)) cuts.push(cut);
    match = pattern.exec(text);
  }
  return cuts;
}

function sentenceBoundarySuppressed(text: string, punctuationIndex: number): boolean {
  const prefix = text.slice(Math.max(0, punctuationIndex - 32), punctuationIndex + 1);
  if (
    /\b(?:Fig|Eq|Eqs|Sec|Ch|Dr|Mr|Mrs|Ms|Prof|Sr|Jr|St|No|Nos|Vol|pp?|vs|mg|mcg|mL|hr|min)\.$/i
      .test(prefix)
  ) return true;
  if (
    /(?:\be\.g|\bi\.e|\bet al|\bq\.d|\bb\.i\.d|\bt\.i\.d|\bq\.i\.d)\.$/i.test(prefix)
  ) return true;
  if (/(?:^|\s)[A-Z]\.$/.test(prefix)) return true;
  // Decimal and diagnostic-code dots never become candidates because their lookahead is not
  // whitespace; this guard therefore need not rewrite or parse those tokens.
  return false;
}

function sentenceBoundaries(text: string, start: number, end: number): number[] {
  const cuts: number[] = [];
  for (let index = start; index < end - 1; index += 1) {
    if (!".!?".includes(text[index]) || sentenceBoundarySuppressed(text, index)) continue;
    let lookahead = index + 1;
    while (lookahead < end && /["'”’»)\]}]/u.test(text[lookahead])) lookahead += 1;
    const whitespaceStart = lookahead;
    while (lookahead < end && /\s/u.test(text[lookahead])) lookahead += 1;
    if (lookahead === whitespaceStart || lookahead >= end) continue;
    if (!/[\p{L}\p{N}\p{S}(#]/u.test(text[lookahead])) continue;
    cuts.push(lookahead);
  }
  return cuts;
}

function codePointSafeCut(text: string, start: number, cut: number, limit: number): number {
  const before = text.charCodeAt(cut - 1);
  const after = text.charCodeAt(cut);
  const splitsSurrogatePair =
    before >= 0xD800 && before <= 0xDBFF && after >= 0xDC00 && after <= 0xDFFF;
  if (!splitsSurrogatePair) return cut;
  if (cut - 1 > start + CHUNK_BOUNDARY_EPSILON) return cut - 1;
  return cut + 1 <= limit ? cut + 1 : cut;
}

function acceptedChunkBoundaries(
  text: string,
  start: number,
  end: number,
  candidates: number[],
  masks: ProtectedChunkRange[],
): number[] {
  const unique = [...new Set(candidates)].sort((left, right) => left - right);
  const balance = new ChunkBalanceScanner(text, start, masks);
  // SAFE: suppression and the balance guard only remove candidate cut indexes; content is inert.
  // Candidates are ascending, so the scanner's monotone-cut requirement holds.
  return unique.filter((cut) =>
    cut > start + CHUNK_BOUNDARY_EPSILON &&
    cut < end - CHUNK_BOUNDARY_EPSILON &&
    !cutFallsInsideMask(cut, masks) &&
    balance.balancedAt(cut),
  );
}

function forceSliceRange(
  text: string,
  range: ChunkRange,
  target: number,
  ceiling: number,
  masks: ProtectedChunkRange[],
): ChunkRange[] {
  const pieces: ChunkRange[] = [];
  let start = range.start;
  while (range.end - start > ceiling) {
    const outwardLimit = Math.min(range.end, start + ceiling);
    let cut = Math.min(outwardLimit, start + target);
    const mask = rangeContaining(masks, cut);
    if (mask && mask.end <= outwardLimit) cut = mask.end;
    const balance = new ChunkBalanceScanner(text, start, masks);
    while (cut < outwardLimit && (!balance.balancedAt(cut) || cutFallsInsideMask(cut, masks))) {
      cut += 1;
    }
    cut = codePointSafeCut(text, start, cut, outwardLimit);
    if (cut <= start + CHUNK_BOUNDARY_EPSILON || cut >= range.end) cut = outwardLimit;
    cut = codePointSafeCut(text, start, cut, outwardLimit);
    pieces.push({ start, end: cut, barrierBefore: false, barrierAfter: false });
    start = cut;
  }
  while (range.end - start > target) {
    const outwardLimit = Math.min(range.end, start + ceiling);
    let cut = Math.min(outwardLimit, start + target);
    const mask = rangeContaining(masks, cut);
    if (mask && mask.end <= outwardLimit) cut = mask.end;
    const balance = new ChunkBalanceScanner(text, start, masks);
    while (cut < outwardLimit && (!balance.balancedAt(cut) || cutFallsInsideMask(cut, masks))) {
      cut += 1;
    }
    cut = codePointSafeCut(text, start, cut, outwardLimit);
    if (cut <= start + CHUNK_BOUNDARY_EPSILON || cut >= range.end) break;
    pieces.push({ start, end: cut, barrierBefore: false, barrierAfter: false });
    start = cut;
  }
  pieces.push({ ...range, start });
  return pieces.map((piece) => trimChunkRange(text, piece)).filter((piece): piece is ChunkRange => piece !== undefined);
}

function recursivelySplitChunkRange(
  text: string,
  rawRange: ChunkRange,
  size: number,
  ceiling: number,
  masks: ProtectedChunkRange[],
  level = 0,
): ChunkRange[] {
  const range = trimChunkRange(text, rawRange);
  if (!range) return [];
  const candidateMask = rangeContaining(masks, range.start);
  const containingMask = candidateMask && range.end <= candidateMask.end ? candidateMask : undefined;
  if (containingMask) {
    const protectedRange = {
      ...range,
      barrierBefore: containingMask.barrierBefore,
      barrierAfter: containingMask.barrierAfter,
    };
    if (range.end - range.start <= ceiling) return [protectedRange];
    // SAFE: atomicity yields only at the absolute ceiling; every degraded child is still a slice.
    return forceSliceRange(text, protectedRange, ceiling, ceiling, []);
  }
  if (range.end - range.start <= size) return [range];

  const boundaryFinders = [
    (): number[] => protectedBoundaries(range.start, range.end, masks),
    (): number[] => headingBoundaries(text, range.start, range.end),
    (): number[] => paragraphBoundaries(text, range.start, range.end),
    (): number[] => listBoundaries(text, range.start, range.end, size),
    (): number[] => sentenceBoundaries(text, range.start, range.end),
  ];
  for (let currentLevel = level; currentLevel < boundaryFinders.length; currentLevel += 1) {
    const cuts = acceptedChunkBoundaries(
      text,
      range.start,
      range.end,
      boundaryFinders[currentLevel](),
      masks,
    );
    if (cuts.length === 0) continue;
    const edges = [range.start, ...cuts, range.end];
    return edges.flatMap((edge, index) => {
      if (index === edges.length - 1) return [];
      return recursivelySplitChunkRange(
        text,
        { start: edge, end: edges[index + 1], barrierBefore: false, barrierAfter: false },
        size,
        ceiling,
        masks,
        currentLevel + 1,
      );
    });
  }

  // Preserve one indivisible top-level prose passage only up to the absolute ceiling. Larger input,
  // descendants created by the hierarchy, and multi-passage input reach the progressing fallback.
  if (
    level === 0 &&
    range.end - range.start <= ceiling &&
    sourcePassages(text.slice(range.start, range.end)).length === 1
  ) return [range];

  // SAFE: terminal fallback advances strictly and only locates slice boundaries.
  return forceSliceRange(text, range, size, ceiling, masks);
}

function packChunkRanges(text: string, ranges: ChunkRange[], size: number): ChunkRange[] {
  const packed: ChunkRange[] = [];
  // SAFE: cohesion is an offset extension only. The target wins for ordinary prose/list units;
  // protected ranges and one indivisible top-level passage may remain oversize only to the ceiling.
  for (const range of ranges) {
    const previous = packed[packed.length - 1];
    if (
      previous &&
      !previous.barrierAfter &&
      !range.barrierBefore &&
      range.end - previous.start <= size
    ) {
      previous.end = range.end;
      previous.barrierAfter = range.barrierAfter;
    } else {
      packed.push({ ...range });
    }
  }
  return packed.map((range) => trimChunkRange(text, range)).filter((range): range is ChunkRange => range !== undefined);
}

function structuredChunkSourceText(text: string, size: number): string[] {
  const lines = sourceLineRanges(text);
  const maxMaskSpan = Math.max(65536, boundedProduct(size, CHUNK_OVERSIZE_MULTIPLE * 4));
  const fencedRanges = mapFencedCodeRanges(text, lines, maxMaskSpan);
  const hardBoundaries = hardBoundaryIndexes(text, lines, fencedRanges);
  const masks = mapProtectedChunkRanges(text, lines, hardBoundaries, fencedRanges, maxMaskSpan);
  const ceiling = boundedProduct(size, CHUNK_OVERSIZE_MULTIPLE);
  const chunks: string[] = [];

  // SAFE: HARD boundaries partition first and are never re-packed across.
  for (let index = 0; index < hardBoundaries.length - 1; index += 1) {
    const ranges = recursivelySplitChunkRange(
      text,
      {
        start: hardBoundaries[index],
        end: hardBoundaries[index + 1],
        barrierBefore: false,
        barrierAfter: false,
      },
      size,
      ceiling,
      masks,
    );
    for (const range of packChunkRanges(text, ranges, size)) {
      // SAFE: the only emitted bytes are a leading/trailing-whitespace-trimmed source slice.
      chunks.push(text.slice(range.start, range.end));
    }
  }
  return chunks.length > 0 ? chunks : [text];
}

function legacyChunkSourceText(text: string, size: number): string[] {
  const passages = sourcePassages(text);
  if (passages.length === 0) return [text];

  const chunks: string[] = [];
  let current: string[] = [];
  let currentLength = 0;
  const flush = (): void => {
    if (current.length === 0) return;
    chunks.push(current.join("\n\n"));
    current = [];
    currentLength = 0;
  };

  for (const passage of passages) {
    const separatorLength = current.length > 0 ? 2 : 0;
    if (current.length > 0 && currentLength + separatorLength + passage.length > size) flush();
    if (passage.length > size) {
      flush();
      chunks.push(passage);
      continue;
    }
    current.push(passage);
    currentLength += (current.length > 1 ? 2 : 0) + passage.length;
  }
  flush();
  return chunks;
}

export function chunkSourceText(text: string, size = 12000): string[] {
  if (!Number.isSafeInteger(size) || size <= 0) {
    throw new Error("chunk size must be a positive safe integer");
  }
  // A string[] has no diagnostics/tag channel. Context hints, polarity flags, and delimiter or
  // oversize labels therefore remain extractor-layer work; boundaries are the only signal here.
  return structuredChunkSourceText(text, size);
}

export interface PlannedSourceChunk {
  sourceId: string;
  title: string;
  index: number;
  total: number;
  text: string;
}

export function planChunks(sources: Source[]): PlannedSourceChunk[] {
  return sources.flatMap((source) => {
    const chunks = chunkSourceText(source.text);
    return chunks.map((text, index) => ({
      sourceId: source.id,
      title: source.title,
      index,
      total: chunks.length,
      text,
    }));
  });
}

function selectExcerpt(source: Source): string {
  const keywordsBySource: Record<string, RegExp> = {
    "d2l-linear-algebra": /vector|fixed-length array|dot product|scalar|same position|norm|matrix/i,
    "d2l-softmax-regression": /softmax|add up to 1|dividing each by their sum|probabilit|ordering/i,
    "d2l-queries-keys-values": /query|keys and values|attention pooling|database|weighted average/i,
    "d2l-self-attention": /self-attention|each token|query, keys, and values|attending|position/i,
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
    "vector-norm": /norm of a vector tells us how big it is/i,
    "dot-product": /is a sum over the products of the elements at the same position/i,
    "matrix-vector-product": /matrix--vector product|multiplication with a matrix as a transformation/i,
    softmax: /transform these values so that they add up to 1 by dividing each by their sum/i,
    "softmax-ordering": /softmax operation preserves the ordering among its arguments/i,
    qkv: /actual "code" for executing on the set of keys and values, namely the query/i,
    "attention-pooling": /attention can operate on arbitrarily large databases|attention pooling operation/i,
    "self-attention": /because every token is attending to each other token/i,
    "positional-encoding": /preserving information about the order of tokens|positional encoding/i,
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
  for (const concept of concepts) {
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
  const deduped = dedupeConcepts(grounded);
  const missing = requiredIds.filter((id) => !deduped.some((concept) => concept.id === id));
  if (missing.length > 0) throw new Error(`inventory omitted required IDs: ${missing.join(", ")}`);
  return deduped;
}

export async function discoverInventory(
  client: ResponsesClient,
  sources: Source[],
): Promise<AtomizedConcept[]> {
  const instructions =
    "Discover the one-concept lesson nodes genuinely present in one openly licensed source passage. " +
    "Return up to 6 concepts; emit fewer when the passage holds fewer real ideas and never pad. " +
    "Every quotedText must be copied verbatim from the passage. Use the supplied source ID, choose stable kebab-case IDs, " +
    "and leave prerequisites and related as empty arrays.";
  const candidates: AtomizedConcept[] = [];

  for (const chunk of planChunks(sources)) {
    const input = `SOURCE_ID=${chunk.sourceId}\nTITLE=${chunk.title}\nCHUNK=${chunk.index + 1}/${chunk.total}\n<<<\n${chunk.text}\n>>>`;
    try {
      const raw = await client.request(
        instructions,
        input,
        inventorySchema,
        "concept_inventory",
      );
      const discovered = parseConcepts(raw).map((concept) => ({
        ...concept,
        provenance: { ...concept.provenance, sourceId: chunk.sourceId },
        prerequisites: [],
        related: [],
      }));
      candidates.push(...discovered);
    } catch (error) {
      console.warn(
        `Inventory chunk ${chunk.index + 1}/${chunk.total} for ${chunk.sourceId} failed; skipping: ${String(error)}`,
      );
    }
  }

  const grounded = groundInventory(candidates, sources, []);
  return await dedupeCandidates(grounded, client);
}

function wouldCreatePrerequisiteCycle(
  adjacency: Map<string, Set<string>>,
  from: string,
  to: string,
): boolean {
  const seen = new Set<string>();
  const pending = [to];
  while (pending.length > 0) {
    const id = pending.pop() as string;
    if (id === from) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    pending.push(...(adjacency.get(id) ?? []));
  }
  return false;
}

export async function discoverRelationships(
  client: ResponsesClient,
  inventory: AtomizedConcept[],
): Promise<AtomizedConcept[]> {
  const concepts = inventory.map((concept) => ({
    ...concept,
    prerequisites: [...concept.prerequisites],
    related: [...concept.related],
  }));
  const compactInventory = concepts.map(({ id, title, summary }) => ({ id, title, summary }));
  const instructions =
    "Infer a prerequisite DAG over the complete frozen concept inventory. Return only directed edges " +
    "where from must be learned before to. Use only listed IDs, never emit self-loops, and never mint an ID.";

  let raw: JsonObject;
  try {
    raw = await client.request(
      instructions,
      `Frozen concept inventory:\n${JSON.stringify(compactInventory)}`,
      edgeListSchema,
      "concept_relationship_edges",
    );
  } catch (error) {
    console.warn(`Relationship discovery failed; continuing without discovered edges: ${String(error)}`);
    return concepts;
  }

  if (!Array.isArray(raw.edges)) {
    console.warn("Relationship discovery returned no edge array; continuing without discovered edges.");
    return concepts;
  }

  const byId = new Map(concepts.map((concept) => [concept.id, concept]));
  const adjacency = new Map<string, Set<string>>();
  for (const concept of concepts) {
    for (const prerequisite of concept.prerequisites) {
      if (!byId.has(prerequisite) || prerequisite === concept.id) continue;
      const next = adjacency.get(prerequisite) ?? new Set<string>();
      next.add(concept.id);
      adjacency.set(prerequisite, next);
    }
  }

  for (const [index, edge] of raw.edges.entries()) {
    if (!isObject(edge) || typeof edge.from !== "string" || typeof edge.to !== "string") {
      console.warn(`Relationship edge ${index + 1} was malformed; dropping it.`);
      continue;
    }
    const from = edge.from;
    const to = edge.to;
    if (!byId.has(from) || !byId.has(to)) {
      console.warn(`Relationship edge ${from} -> ${to} names an unknown concept; dropping it.`);
      continue;
    }
    if (from === to) {
      console.warn(`Relationship edge ${from} -> ${to} is a self-loop; dropping it.`);
      continue;
    }
    if (wouldCreatePrerequisiteCycle(adjacency, from, to)) {
      console.warn(`Relationship edge ${from} -> ${to} would create a cycle; dropping it.`);
      continue;
    }

    const target = byId.get(to)!;
    if (!target.prerequisites.includes(from)) target.prerequisites.push(from);
    const next = adjacency.get(from) ?? new Set<string>();
    next.add(to);
    adjacency.set(from, next);
  }
  return concepts;
}

/** Deterministically retain the full product inventory and force every pinned source assignment. */
export function pinInventoryToSpine(
  concepts: AtomizedConcept[],
  sources: Source[],
  spine: FullGraphSpine,
): AtomizedConcept[] {
  const proposedById = new Map(dedupeConcepts(concepts).map((concept) => [concept.id, concept]));
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const missing = spine.concepts.filter(({ id }) => !proposedById.has(id)).map(({ id }) => id);
  if (missing.length > 0) throw new Error(`inventory omitted required IDs: ${missing.join(", ")}`);

  return spine.concepts.map(({ id, sourceId }) => {
    const concept = proposedById.get(id)!;
    const source = sourceById.get(sourceId);
    const quote = source && groundedQuote(source.text, concept.provenance.quotedText);
    if (!source || !quote) {
      throw new GoldenGraphHalt(
        `model emitted ungrounded required node ${id} for pinned source ${sourceId}; ` +
          `offending span ${JSON.stringify(concept.provenance.quotedText)}`,
      );
    }
    return {
      ...concept,
      provenance: { sourceId, quotedText: quote },
      prerequisites: [],
      related: [],
    };
  });
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

/** Project model relationship output onto the exact product edge set; no discovered edge survives. */
export function pinRelationshipsToSpine(
  inventory: AtomizedConcept[],
  relations: AtomizedConcept[],
  spine: FullGraphSpine,
): AtomizedConcept[] {
  const merged = mergeRelationships(inventory, relations);
  const prerequisitesById = new Map<string, string[]>();
  for (const edge of spine.prereqEdges) {
    const prerequisites = prerequisitesById.get(edge.to) ?? [];
    prerequisites.push(edge.from);
    prerequisitesById.set(edge.to, prerequisites);
  }
  return merged.map((concept) => ({
    ...concept,
    prerequisites: prerequisitesById.get(concept.id) ?? [],
    related: [],
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
  structure?: FullGraphSpine,
): Promise<AtomizedConcept[]> {
  const sourceIds = sources.map((source) => source.id);
  const instructions =
    "You atomize openly licensed educational source excerpts into one-concept lesson nodes. " +
    "Every quotedText must be copied verbatim from exactly one provided SOURCE block. Never invent, paraphrase, or normalize a quote. " +
    "Emit AtomizedConcept objects. This is inventory phase: prerequisites and related MUST be empty arrays. " +
    "Use only listed sourceId values. Summaries should describe exactly one self-contained concept.";
  const requiredIdInstruction = requiredIds.length > 0
    ? `Required stable IDs: ${requiredIds.join(", ")}. Emit every listed ID exactly once and emit no other IDs.`
    : toy
      ? "Choose exactly three stable kebab-case IDs grounded in the supplied source."
      : "Choose 8 to 10 stable kebab-case IDs grounded in the supplied source.";
  const demoGroundingMap = toy || requiredIds.length === 0 || !structure
    ? ""
    : `For the full demo run, these source assignments are mandatory:\n${structure.concepts
        .map(({ id, sourceId }) => `${id} -> ${sourceId}`)
        .join("\n")}\n`;
  const requestedCount = structure
    ? `Produce exactly ${structure.concepts.length}`
    : toy
      ? "Produce exactly 3"
      : "Produce 8 to 10";
  const input = `${requestedCount} distinct concepts. ${requiredIdInstruction}
Required source IDs are restricted to: ${sourceIds.join(", ")}.
${demoGroundingMap}
Copy a substantial prose sentence for each quotedText. Do not rely on formula-only passages.

${sourcePrompt(sources)}`;

  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const raw = await client.request(instructions, input, pinnedInventorySchema, "concept_inventory");
      const proposed = parseConcepts(raw);
      for (const requiredId of requiredIds) {
        const concept = proposed.find((candidate) => candidate.id.trim().toLowerCase() === requiredId);
        const pinnedSourceId = structure?.concepts.find(({ id }) => id === requiredId)?.sourceId;
        const source = concept && sources.find(
          (candidate) => candidate.id === (pinnedSourceId ?? concept.provenance.sourceId),
        );
        if (concept && pinnedSourceId) concept.provenance.sourceId = pinnedSourceId;
        if (!concept || !source || groundedQuote(source.text, concept.provenance.quotedText)) continue;
        const repaired = await client.request(
          "Repair one required node's provenance. Return one substantial prose sentence copied verbatim from the supplied STORED source passage. Never paraphrase, normalize punctuation, or use formula-adjacent prose whose symbols are omitted.",
          `Required node: ${requiredId}\nSource ID: ${source.id}\nSTORED source passage:\n<<<\n${targetedQuoteExcerpt(source, requiredId)}\n>>>`,
          quoteRepairSchema,
          "required_quote_repair",
        );
        if (typeof repaired.quotedText === "string") concept.provenance.quotedText = repaired.quotedText;
      }
      const grounded = structure
        ? pinInventoryToSpine(proposed, sources, structure)
        : groundInventory(proposed, sources, requiredIds);
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
  structure?: FullGraphSpine,
): Promise<AtomizedConcept[]> {
  const ids = inventory.map((concept) => concept.id);
  const instructions =
    "Infer learning relations only among a frozen concept inventory. Return AtomizedConcept objects, copying id, title, summary, provenance, and tags exactly. " +
    "Fill prerequisites and related only with IDs from the frozen set. A prerequisite p in node n means edge p -> n. Never mint an ID.";
  const requiredPathInstruction = requiredPath.length > 0
    ? `Required direct prerequisite chain: ${requiredPath.join(" -> ")}. Every consecutive pair MUST be encoded in the later node's prerequisites array.\n`
    : "";
  const fullStructureInstruction = structure
    ? `Return exactly these prerequisite edges and no others: ${structure.prereqEdges
        .map(({ from, to }) => `${from} -> ${to}`)
        .join(", ")}. Every related array MUST be empty.\n`
    : "";
  const input = `Frozen IDs: ${ids.join(", ")}.
${requiredPathInstruction}${fullStructureInstruction}Make every non-root concept participate in the prerequisite graph; avoid cycles. Related links do not count as prerequisites.

Frozen inventory JSON:
${JSON.stringify({ concepts: inventory }, null, 2)}`;

  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const raw = await client.request(instructions, input, relationshipSchema, "concept_relationships");
      const parsed = parseConcepts(raw);
      const merged = structure
        ? pinRelationshipsToSpine(inventory, parsed, structure)
        : mergeRelationships(inventory, parsed);
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
  atomicityJudge: boolean;
  omitResponseIds: boolean;
}

export function parseAtomizeArgs(args: readonly string[]): AtomizeOptions {
  let manifestPath = process.env.OER_MANIFEST_PATH
    ? resolve(process.env.OER_MANIFEST_PATH)
    : MANIFEST_PATH;
  let outDir: string | undefined;
  let overwriteExisting = false;
  let toyOnly = false;
  let noSpine = false;
  let atomicityJudge = false;
  let omitResponseIds = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--toy") toyOnly = true;
    else if (arg === "--no-spine") noSpine = true;
    else if (arg === "--atomicity-judge") atomicityJudge = true;
    else if (arg === "--no-response-ids") omitResponseIds = true;
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
  return {
    manifestPath,
    outDir,
    overwriteExisting,
    toyOnly,
    noSpine,
    atomicityJudge,
    omitResponseIds,
  };
}

export function writeAtomizationRunLog(
  path: string,
  metadata: Record<string, unknown>,
  responseIds: readonly string[],
  omitResponseIds: boolean,
  options: ArtifactWriteOptions = {},
): Buffer {
  return writeJsonArtifact(
    path,
    {
      ...metadata,
      ...(omitResponseIds ? {} : { responseIds }),
    },
    options,
  );
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

  const structure = options.noSpine ? undefined : FULL_GRAPH_SPINE;
  const spine = structure?.path ?? [];
  const requiredIds = structure?.concepts.map(({ id }) => id) ?? [];
  const inventory = structure
    ? await inventoryPhase(client, sources, requiredIds, false, structure)
    : await discoverInventory(client, sources);
  const atomized = structure
    ? await relationshipPhase(client, inventory, spine, structure)
    : await discoverRelationships(client, inventory);
  const goalId = options.noSpine ? selectUnpinnedGoal(atomized) : FULL_GRAPH_SPINE.goalId;
  const initialGraph = buildGraph(atomized, sources, goalId, options.noSpine);
  const expectedSources: ExpectedSource[] = sources.map((source) => ({ ...source }));
  const attemptLog: Array<{ attempt: number; issues: unknown[] }> = [];

  const baseConverged = await convergeGraph(initialGraph, {
    expectedSources,
    spine,
    structure,
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
  const syntacticWarnings = reportAtomicityWarnings(converged);
  const judgeWarnings = options.atomicityJudge
    ? await reportAtomicityWarningsWithScorer(
        converged,
        llmJudgeAtomicityScorer(client),
      )
    : [];
  const warnings = [...syntacticWarnings, ...judgeWarnings, ...readabilityWarnings];
  let enriched = converged;
  try {
    enriched = await generateAnalogies(converged, client);
  } catch (error) {
    // Optional illustrations never gate graph emission, even if the enrichment layer itself fails.
    console.warn(`Analogy layer failed; continuing without analogies: ${String(error)}`);
  }

  // The sole graph write is guarded again at the artifact boundary, after lesson-only convergence
  // and the hard readability floor have both passed.
  const costReceipt = buildRunCostReceipt(
    client.model,
    client.usageTokens,
    enriched.concepts.length,
  );
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
    ...costReceipt,
    convergence: attemptLog,
    ...(options.noSpine ? { unpinned: true, artifactNote: UNPINNED_ARTIFACT_NOTE } : {}),
  };

  writeAtomizationRunLog(
    runLogPath as string,
    runLog,
    client.responseIds,
    options.omitResponseIds,
    writeOptions,
  );
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
