import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fixtureGraph } from "../src/graph/fixture-graph";
import type { RenderingSet } from "../src/types";
import { emitAnkiArtifact } from "./emit-anki";
import { emitExamArtifact } from "./emit-exam";
import {
  emitExportShowcase,
  SHOWCASE_MARKER,
  SHOWCASE_PATH,
  verifyExportShowcase,
  writeExportShowcase,
} from "./emit-export-showcase";
import { emitLlmsArtifacts } from "./emit-llms";
import { emitObsidianVault } from "./emit-obsidian";
import { emitOrgRoamArtifact } from "./emit-orgroam";
import { emitTinderboxArtifact } from "./emit-tinderbox";

const noRenderings: RenderingSet = { renderings: [] };
const readme = "# Test Learning Graph\n\nEvery generated line has a grounded receipt.\n";

function byPath(path: string): string {
  const file = emitExportShowcase().find((candidate) => candidate.path === path);
  if (!file) throw new Error(`showcase dropped ${path}`);
  return file.bytes;
}

describe("optional export showcase", () => {
  it("ships a standalone product tutorial in every learner-facing export format", () => {
    const paths = emitExportShowcase().map(({ path }) => path);
    for (const path of [
      "markdown/atomic-learning-graph-guide.md",
      "obsidian/Start Here.md",
      "obsidian/Atomic Learning Graph.canvas",
      "org-roam/atomic-learning-graph-guide.org",
      "tinderbox/atomic-learning-graph-guide.opml",
      "anki/atomic-learning-graph-guide.tsv",
      "llms/llms.txt",
      "llms/llms-full.txt",
    ]) expect(paths).toContain(path);

    for (const path of [
      "README.md",
      "markdown/atomic-learning-graph-guide.md",
      "obsidian/Start Here.md",
      "org-roam/atomic-learning-graph-guide.org",
      "tinderbox/atomic-learning-graph-guide.opml",
      "anki/atomic-learning-graph-guide.tsv",
      "llms/llms.txt",
      "llms/llms-full.txt",
    ]) expect(byPath(path)).toContain(SHOWCASE_MARKER);
  });

  it("keeps the five one-idea steps in the same order in every presentation", () => {
    const titles = ["Choose a goal", "Follow the path", "Learn one idea", "Check the receipt", "Take it with you"];
    for (const path of [
      "markdown/atomic-learning-graph-guide.md",
      "obsidian/Start Here.md",
      "org-roam/atomic-learning-graph-guide.org",
      "tinderbox/atomic-learning-graph-guide.opml",
      "anki/atomic-learning-graph-guide.tsv",
      "llms/llms-full.txt",
    ]) {
      const bytes = byPath(path);
      const offsets = titles.map((title) => bytes.indexOf(title));
      expect(offsets.every((offset) => offset >= 0), path).toBe(true);
      expect(offsets, path).toEqual([...offsets].sort((left, right) => left - right));
    }
  });

  it("emits org-roam property drawers directly under their nodes", () => {
    const org = byPath("org-roam/atomic-learning-graph-guide.org");
    expect(org).toMatch(/^:PROPERTIES:\n:ID: alg-showcase\n:END:\n\n#\+title:/u);
    for (const [index, id] of [
      "choose-a-goal",
      "follow-the-path",
      "learn-one-idea",
      "check-the-receipt",
      "take-it-with-you",
    ].entries()) {
      expect(org).toContain(`* ${index + 1}. `);
      expect(org).toContain(`\n:PROPERTIES:\n:ID: ${id}\n:END:`);
    }
  });

  it("makes Obsidian a styled, linked vault with a native Canvas", () => {
    expect(byPath("obsidian/.obsidian/appearance.json")).toContain('"atomic-learning"');
    expect(byPath("obsidian/.obsidian/snippets/atomic-learning.css")).toContain(".alg-showcase");
    const canvas = JSON.parse(byPath("obsidian/Atomic Learning Graph.canvas")) as {
      nodes: unknown[];
      edges: unknown[];
    };
    expect(canvas.nodes).toHaveLength(5);
    expect(canvas.edges).toHaveLength(4);
    expect(byPath("obsidian/choose-a-goal.md")).toContain("[[follow-the-path|Follow the path]]");
  });

  it("makes Tinderbox a one-import styled map with positions and native next links", () => {
    const opml = byPath("tinderbox/atomic-learning-graph-guide.opml");
    expect(opml).toContain('ALGPresentation="styled-one-shot"');
    expect(opml.match(/ALGKind="guide-step"/gu)).toHaveLength(5);
    expect(opml.match(/linkTo\(/gu)).toHaveLength(4);
    expect(opml.match(/ALGXpos="/gu)?.length).toBeGreaterThanOrEqual(6);
    expect(opml).toContain('Prototype="ALG Tour Goal"');
    expect(opml).toContain('Project evidence&#10;README.md -- The whole project');
    expect(opml).toContain('ALGExactText="Begin with something specific');
  });

  it("makes Anki create a named, tagged deck with five styled cards", () => {
    const tsv = byPath("anki/atomic-learning-graph-guide.tsv");
    expect(tsv).toContain("#deck column:3");
    expect(tsv).toContain("#tags:atomic-learning-graph-showcase");
    const rows = tsv.split("\n").filter((line) => line.length > 0 && !line.startsWith("#"));
    expect(rows).toHaveLength(5);
    expect(rows.every((row) => row.split("\t").length === 3)).toBe(true);
    expect(rows.every((row) => row.endsWith("\tAtomic Learning Graph - Quick Tour"))).toBe(true);
    expect(rows[0]).toContain("style=");
  });

  it("never injects the showcase lesson into normal course exports", () => {
    const llms = emitLlmsArtifacts(fixtureGraph, noRenderings, readme);
    const normalArtifacts = [
      emitAnkiArtifact(fixtureGraph),
      emitExamArtifact(fixtureGraph),
      llms.index,
      llms.full,
      emitOrgRoamArtifact(fixtureGraph),
      emitTinderboxArtifact(fixtureGraph),
      ...emitObsidianVault(fixtureGraph).map(({ bytes }) => bytes),
    ];
    for (const artifact of normalArtifacts) expect(artifact).not.toContain(SHOWCASE_MARKER);
  });

  it("verifies exact file bytes and rejects drift", () => {
    const directory = mkdtempSync(join(tmpdir(), "alg-showcase-"));
    try {
      const expected = emitExportShowcase();
      writeExportShowcase(expected, directory);
      expect(() => verifyExportShowcase(expected, directory)).not.toThrow();
      const path = join(directory, expected[0].path);
      writeFileSync(path, `${readFileSync(path, "utf8")}x`, "utf8");
      expect(() => verifyExportShowcase(expected, directory)).toThrow("does not match generated bytes");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("matches the committed optional showcase exactly", () => {
    expect(() => verifyExportShowcase(emitExportShowcase(), SHOWCASE_PATH)).not.toThrow();
  });
});
