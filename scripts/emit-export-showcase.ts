// Deterministic, opt-in presentation showcase for the supported export formats. These files teach
// people how Atomic Learning works and give maintainers something small to inspect in each target
// application. They are deliberately separate from normal course exports.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { stripControlChars, assertNoControlChars } from "./emit-utils";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(import.meta.dirname, "..");
export const SHOWCASE_PATH = resolve(repoRoot, "exports", "showcase");
export const SHOWCASE_MARKER = "A five-step tour of Atomic Learning";

interface GuideStep {
  id: string;
  title: string;
  short: string;
  body: string;
  tryIt: string;
  evidence: string;
}

export interface ShowcaseFile {
  path: string;
  bytes: string;
}

const INTRO =
  "Atomic Learning Graph turns open educational text into a small, offline course. It breaks a " +
  "hard topic into one-concept lessons, puts prerequisites in a useful order, and keeps each " +
  "explanation beside the source passage that supports it.";

const STEPS: readonly GuideStep[] = [
  {
    id: "choose-a-goal",
    title: "Choose a goal",
    short: "Begin with something specific that you want to understand.",
    body:
      "A clear destination keeps the course focused. Atomic Learning works backward from that " +
      "goal to find the ideas you need first.",
    tryIt: "Name one topic that currently feels too large or tangled to learn all at once.",
    evidence: "README.md — The whole project, steps 1 and 2",
  },
  {
    id: "follow-the-path",
    title: "Follow the path",
    short: "Learn prerequisites before the ideas that depend on them.",
    body:
      "The graph turns relationships into an ordered route. You can see where you are going and " +
      "why an earlier idea belongs before a later one.",
    tryIt: "Start at the first item in the map, outline, note list, or deck supplied by your app.",
    evidence: "src/graph/path.ts — deterministic prerequisite walk",
  },
  {
    id: "learn-one-idea",
    title: "Learn one idea",
    short: "Each stop explains one concept in plain language.",
    body:
      "Small lessons reduce the amount you must hold in mind at once. If a lesson feels too hard, " +
      "step back to its prerequisite instead of pushing through a wall of text.",
    tryIt: "Read one lesson, then explain its single idea in your own words.",
    evidence: "README.md — Atomic steps and prerequisite scaffolding",
  },
  {
    id: "check-the-receipt",
    title: "Check the receipt",
    short: "Every explanation stays close to the source passage that supports it.",
    body:
      "You do not have to trust a smooth explanation just because it sounds confident. Open the " +
      "source receipt and compare the lesson with the original words.",
    tryIt: "Challenge one explanation by reading the exact quoted passage beside it.",
    evidence: "src/graph/invariants.ts — quote-primary provenance checks",
  },
  {
    id: "take-it-with-you",
    title: "Take it with you",
    short: "Use the learning tool you already like.",
    body:
      "The same course can become an Obsidian vault, org-roam file, Tinderbox map, Anki deck, " +
      "plain Markdown, or an LLM-readable guide. The graph stays the authority; each export is an " +
      "opinionated presentation for its destination.",
    tryIt: "Open this showcase in another supported app and compare how the same ideas travel.",
    evidence: "README.md — What ships beyond the reader",
  },
] as const;

function guideIntro(): string {
  return `${SHOWCASE_MARKER}\n\n${INTRO}`;
}

function markdownSteps(linkStyle: "markdown" | "obsidian" = "markdown"): string {
  return STEPS.map((step, index) => {
    const next = STEPS[index + 1];
    const nextLink = next
      ? linkStyle === "obsidian"
        ? `\n\n**Next:** [[${next.id}|${next.title}]]`
        : `\n\n**Next:** [${next.title}](#${next.id})`
      : "";
    return [
      `<a id="${step.id}"></a>`,
      `## ${index + 1}. ${step.title}`,
      `**${step.short}**`,
      step.body,
      `> [!tip] Try it\n> ${step.tryIt}`,
      `**Project evidence:** ${step.evidence}${nextLink}`,
    ].join("\n\n");
  }).join("\n\n---\n\n");
}

function renderReadme(): string {
  return `${[
    "# Learn Atomic Learning in your own app",
    guideIntro(),
    "## Pick your format",
    "- **Obsidian:** open `obsidian/` as a vault, then open `Start Here.md`. The included Canvas and CSS show the intended presentation.",
    "- **org-roam:** copy `org-roam/atomic-learning-graph-guide.org` into your org-roam directory, run `org-roam-db-sync`, and open the file.",
    "- **Tinderbox:** import `tinderbox/atomic-learning-graph-guide.opml`. The map, prototypes, colors, positions, and links apply during that import.",
    "- **Anki:** import `anki/atomic-learning-graph-guide.tsv`. The file creates its own named deck and applies the showcase tag.",
    "- **Markdown:** open `markdown/atomic-learning-graph-guide.md` anywhere Markdown is supported.",
    "- **LLM tools:** point the tool at `llms/llms.txt`; use `llms/llms-full.txt` for the complete tour.",
    "## Why this folder is separate",
    "This is an optional product tutorial and presentation fixture. Normal course exports stay clean, so people who generate many courses do not receive the same onboarding lesson every time.",
    "## For maintainers",
    "Run `pnpm emit:showcase` to rebuild these files and `pnpm verify:showcase` to check exact bytes. Inspect the showcase in each real application before changing that exporter: the files are deliberately small enough that broken hierarchy, links, metadata, or styling should be obvious.",
  ].join("\n\n")}\n`;
}

function renderMarkdown(): string {
  return `${[
    "# Atomic Learning Graph — a five-step quick tour",
    guideIntro(),
    "This guide uses the same rhythm as the product: one idea at a time, in an order that builds toward a goal.",
    markdownSteps(),
    "## You are ready",
    "You now know the whole loop: choose a goal, follow the path, learn one idea, check the receipt, and keep the course in the tool that works for you.",
  ].join("\n\n")}\n`;
}

function renderObsidianStart(): string {
  return `${[
    "---",
    'title: "Start Here — Atomic Learning Graph"',
    "cssclasses:",
    "  - alg-showcase",
    "tags:",
    "  - atomic-learning-graph-showcase",
    "---",
    "# Learn Atomic Learning in five small steps",
    guideIntro(),
    "> [!info] This is a showcase, not a generated course\n> It teaches the product and lets you inspect how an Atomic Learning export should look in Obsidian.",
    "## Start the tour",
    ...STEPS.map((step, index) => `${index + 1}. [[${step.id}|${step.title}]] — ${step.short}`),
    "## See the map",
    "[[Atomic Learning Graph.canvas|Open the visual learning path]]",
  ].join("\n\n")}\n`;
}

function renderObsidianStep(step: GuideStep, index: number): string {
  const previous = STEPS[index - 1];
  const next = STEPS[index + 1];
  return `${[
    "---",
    `id: ${JSON.stringify(step.id)}`,
    `title: ${JSON.stringify(step.title)}`,
    "cssclasses:",
    "  - alg-showcase",
    "tags:",
    "  - atomic-learning-graph-showcase",
    "---",
    `# ${index + 1}. ${step.title}`,
    `**${step.short}**`,
    step.body,
    `> [!tip] Try it\n> ${step.tryIt}`,
    `> [!quote] Project evidence\n> ${step.evidence}`,
    "## Keep moving",
    [
      previous ? `← [[${previous.id}|${previous.title}]]` : "← [[Start Here]]",
      next ? `[[${next.id}|${next.title}]] →` : "[[Start Here|Finish at Start Here]] →",
    ].join(" · "),
  ].join("\n\n")}\n`;
}

function renderObsidianCanvas(): string {
  const nodes = STEPS.map((step, index) => ({
    id: step.id,
    type: "file",
    file: `${step.id}.md`,
    x: index * 430,
    y: index % 2 === 0 ? 0 : 120,
    width: 340,
    height: 220,
    color: index === STEPS.length - 1 ? "1" : "4",
  }));
  const edges = STEPS.slice(0, -1).map((step, index) => ({
    id: `edge-${index + 1}`,
    fromNode: step.id,
    fromSide: "right",
    toNode: STEPS[index + 1].id,
    toSide: "left",
    label: "next",
  }));
  return `${JSON.stringify({ nodes, edges }, null, 2)}\n`;
}

function renderObsidianCss(): string {
  return `.alg-showcase {
  --h1-color: #e76f51;
  --h2-color: #264653;
  --link-color: #2a9d8f;
  --link-color-hover: #e76f51;
  --blockquote-border-color: #e9c46a;
}

.alg-showcase .callout[data-callout="tip"] {
  --callout-color: 42, 157, 143;
}

.alg-showcase.markdown-preview-view {
  max-width: 760px;
  line-height: 1.65;
}
`;
}

function renderOrgRoam(): string {
  const sections = STEPS.map((step, index) => {
    const previous = STEPS[index - 1];
    const next = STEPS[index + 1];
    return [
      [`* ${index + 1}. ${step.title}`, ":PROPERTIES:", `:ID: ${step.id}`, ":END:"].join("\n"),
      step.short,
      step.body,
      "** Try it",
      step.tryIt,
      "** Project evidence",
      step.evidence,
      "** Keep moving",
      [
        previous ? `[[id:${previous.id}][← ${previous.title}]]` : "[[id:alg-showcase][← Start Here]]",
        next ? `[[id:${next.id}][${next.title} →]]` : "[[id:alg-showcase][Finish →]]",
      ].join(" · "),
    ].join("\n\n");
  });
  return `${[
    [":PROPERTIES:", ":ID: alg-showcase", ":END:"].join("\n"),
    "#+title: Atomic Learning Graph — Quick Tour",
    "#+startup: overview",
    "#+options: toc:2",
    guideIntro(),
    "Put this file in your org-roam directory, run ~org-roam-db-sync~, then follow the numbered nodes.",
    "* Learning Path",
    ...STEPS.map((step, index) => `${index + 1}. [[id:${step.id}][${step.title}]] — ${step.short}`),
    ...sections,
  ].join("\n\n")}\n`;
}

function xml(value: string): string {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/"/gu, "&quot;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/\r\n|\r|\n/gu, "&#10;");
}

function attrs(values: Record<string, string>): string {
  return Object.entries(values).map(([key, value]) => ` ${key}="${xml(value)}"`).join("");
}

function tinderboxNote(value: string): string {
  return value.replaceAll("—", "--");
}

function renderTinderbox(): string {
  const rootName = "Atomic Learning Graph - Quick Tour";
  const countGuard = `$ChildCount(\"/${rootName}/Steps\")==${STEPS.length}`;
  const prototypes = [
    ["ALG Tour Step", "book", "#E9C46A"],
    ["ALG Tour Goal", "star", "#E76F51"],
    ["ALG Tour Guide", "info.circle", "#8E7DBE"],
  ].map(([text, badge, color]) =>
    `        <outline${attrs({ text, IsPrototype: "true", ALGKind: "prototype", Color: color, Shape: "rounded", Badge: badge, Width: "5", Height: "2.5" })}/>`
  );
  const guideRule = `if(${countGuard}){$Xpos=$ALGXpos;$Ypos=$ALGYpos;$Rule=\"\"}`;
  const guide = `      <outline${attrs({
    text: "Start Here",
    _note: `${guideIntro()}\n\nImport this OPML once, then open Steps in Map view and follow the next links from left to right. This small map is both the product tutorial and the presentation check for the Tinderbox exporter.`,
    ALGKind: "guide",
    Prototype: "ALG Tour Guide",
    Color: "#8E7DBE",
    Shape: "rounded",
    Badge: "info.circle",
    Width: "7",
    Height: "3",
    Xpos: "0",
    Ypos: "0",
    ALGXpos: "0",
    ALGYpos: "0",
    Rule: guideRule,
  })}/>`;
  const steps = STEPS.map((step, index) => {
    const next = STEPS[index + 1];
    const actions = next
      ? `linkTo(find($ALGGuideId==\"${next.id}\"),\"next\");`
      : "";
    const rule = `if(${countGuard}){$Xpos=$ALGXpos;$Ypos=$ALGYpos;${actions}$Rule=\"\"}`;
    const x = String(2 + index * 6.2);
    const y = String(index % 2 === 0 ? 5 : 8.5);
    const exactText = `${step.short}\n\n${step.body}\n\nTry it\n${step.tryIt}\n\nProject evidence\n${step.evidence}`;
    return `        <outline${attrs({
      text: `${index + 1}. ${step.title}`,
      _note: tinderboxNote(exactText),
      ALGExactText: exactText,
      ALGKind: "guide-step",
      ALGGuideId: step.id,
      ALGStep: String(index + 1),
      Prototype: next ? "ALG Tour Step" : "ALG Tour Goal",
      Color: next ? "#E9C46A" : "#E76F51",
      Shape: "rounded",
      Badge: next ? "book" : "star",
      Width: "5",
      Height: "2.5",
      Xpos: x,
      Ypos: y,
      ALGXpos: x,
      ALGYpos: y,
      Rule: rule,
      DisplayedAttributes: "ALGStep;ALGGuideId",
    })}/>`;
  });
  return `${[
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<opml version="2.0">',
    "  <head>",
    "    <title>Atomic Learning Graph - Quick Tour</title>",
    "  </head>",
    "  <body>",
    `    <outline${attrs({ text: rootName, _note: INTRO, ALGKind: "showcase", ALGPresentation: "styled-one-shot", Color: "#264653", Shape: "rounded", Badge: "point.3.connected.trianglepath.dotted", Width: "8", Height: "3" })}>`,
    `      <outline${attrs({ text: "Prototypes", ALGKind: "container", Color: "#264653", Shape: "rounded", Badge: "folder" })}>`,
    ...prototypes,
    "      </outline>",
    guide,
    `      <outline${attrs({ text: "Steps", ALGKind: "container", Color: "#264653", Shape: "rounded", Badge: "folder" })}>`,
    ...steps,
    "      </outline>",
    "    </outline>",
    "  </body>",
    "</opml>",
    "",
  ].join("\n")}`;
}

function anki(value: string): string {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/\t/gu, "&#9;")
    .replace(/\r\n|\r|\n/gu, "<br>");
}

function renderAnki(): string {
  const deck = "Atomic Learning Graph - Quick Tour";
  const rows = STEPS.map((step, index) => {
    const next = STEPS[index + 1];
    const front = `<div style="color:#264653;font-size:1.25em;font-weight:700">${index + 1}/5 · ${anki(step.title)}</div><div>${anki(step.short)}</div>`;
    const back = [
      `<div style="line-height:1.55">${anki(step.body)}</div>`,
      `<hr><div style="color:#2a9d8f"><strong>Try it</strong><br>${anki(step.tryIt)}</div>`,
      `<div style="margin-top:1em;color:#666"><strong>Project evidence</strong><br>${anki(step.evidence)}</div>`,
      next ? `<div style="margin-top:1em"><strong>Next:</strong> ${anki(next.title)}</div>` : "<div style=\"margin-top:1em\"><strong>You finished the tour.</strong></div>",
      `<div style="margin-top:1em;font-size:.85em;color:#777">${SHOWCASE_MARKER}</div>`,
    ].join("");
    return `${front}\t${back}\t${deck}`;
  });
  return `${[
    "#separator:Tab",
    "#html:true",
    "#notetype:Basic",
    "#tags:atomic-learning-graph-showcase",
    "#deck column:3",
    "#columns:Front\tBack\tDeck",
    ...rows,
  ].join("\n")}\n`;
}

function renderLlmsIndex(): string {
  return `${[
    "# Atomic Learning Graph — Quick Tour",
    `> ${INTRO}`,
    `${SHOWCASE_MARKER}. Follow the five ideas in order. This file is the compact index; llms-full.txt contains the complete tour.`,
    "## Guide",
    "- [Complete five-step tour](llms-full.txt): What the product is, how a learner uses it, and how its source receipts work.",
  ].join("\n\n")}\n`;
}

function renderLlmsFull(): string {
  return `${[
    "# Atomic Learning Graph — Quick Tour",
    `> ${INTRO}`,
    SHOWCASE_MARKER,
    ...STEPS.map((step, index) => [
      `## ${index + 1}. ${step.title}`,
      step.short,
      step.body,
      `Try it: ${step.tryIt}`,
      `Project evidence: ${step.evidence}`,
    ].join("\n\n")),
  ].join("\n\n")}\n`;
}

export function emitExportShowcase(): ShowcaseFile[] {
  const files: ShowcaseFile[] = [
    { path: "README.md", bytes: renderReadme() },
    { path: "markdown/atomic-learning-graph-guide.md", bytes: renderMarkdown() },
    { path: "obsidian/Start Here.md", bytes: renderObsidianStart() },
    { path: "obsidian/Atomic Learning Graph.canvas", bytes: renderObsidianCanvas() },
    { path: "obsidian/.obsidian/appearance.json", bytes: `${JSON.stringify({ enabledCssSnippets: ["atomic-learning"] }, null, 2)}\n` },
    { path: "obsidian/.obsidian/app.json", bytes: `${JSON.stringify({ readableLineLength: true, showLineNumber: false }, null, 2)}\n` },
    { path: "obsidian/.obsidian/snippets/atomic-learning.css", bytes: renderObsidianCss() },
    ...STEPS.map((step, index) => ({ path: `obsidian/${step.id}.md`, bytes: renderObsidianStep(step, index) })),
    { path: "org-roam/atomic-learning-graph-guide.org", bytes: renderOrgRoam() },
    { path: "tinderbox/atomic-learning-graph-guide.opml", bytes: renderTinderbox() },
    { path: "anki/atomic-learning-graph-guide.tsv", bytes: renderAnki() },
    { path: "llms/llms.txt", bytes: renderLlmsIndex() },
    { path: "llms/llms-full.txt", bytes: renderLlmsFull() },
  ];
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

function walkFiles(directory: string, base: string = directory): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory).flatMap((name) => {
    const path = resolve(directory, name);
    return statSync(path).isDirectory() ? walkFiles(path, base) : [relative(base, path)];
  }).sort();
}

export function writeExportShowcase(
  files: readonly ShowcaseFile[],
  directory: string = SHOWCASE_PATH,
): void {
  rmSync(directory, { recursive: true, force: true });
  for (const file of files) {
    const path = resolve(directory, file.path);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, stripControlChars(file.bytes), "utf8");
  }
}

export function verifyExportShowcase(
  expected: readonly ShowcaseFile[],
  directory: string = SHOWCASE_PATH,
): void {
  const expectedPaths = expected.map(({ path }) => path).sort();
  const actualPaths = walkFiles(directory);
  if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) {
    throw new Error("exports/showcase does not contain the exact expected file set; run pnpm emit:showcase");
  }
  for (const file of expected) {
    const path = resolve(directory, file.path);
    if (!existsSync(path) || readFileSync(path, "utf8") !== file.bytes) {
      throw new Error(`exports/showcase/${file.path} does not match generated bytes; run pnpm emit:showcase`);
    }
  }
}

function main(): void {
  const files = emitExportShowcase();
  if (process.argv.slice(2).includes("--verify")) {
    verifyExportShowcase(files);
    console.log(`Verified ${files.length} optional showcase files.`);
    return;
  }
  writeExportShowcase(files);
  console.log(`Emitted ${files.length} optional showcase files.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
