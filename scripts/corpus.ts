import { createHash } from "node:crypto";

export const D2L_REPO = "https://github.com/d2l-ai/d2l-en";
export const D2L_TAG = "v1.0.3";
export const D2L_COMMIT = "b2e2ae30898a9d0126a9699ae7e441de3e272715";
export const D2L_AUTHOR = "Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola";
export const D2L_LICENSE_STATEMENT =
  "Creative Commons Attribution-ShareAlike 4.0 International Public License";
export const CC_BY_SA_4_DEED = "https://creativecommons.org/licenses/by-sa/4.0/";

export interface D2LSourceSpec {
  id: string;
  title: string;
  sourceFile: string;
  textPath: string;
}

export const D2L_SOURCES: readonly D2LSourceSpec[] = [
  {
    id: "d2l-linear-algebra",
    title: "Dive into Deep Learning — 2.3 Linear Algebra",
    sourceFile: "chapter_preliminaries/linear-algebra.md",
    textPath: "d2l-linear-algebra.txt",
  },
  {
    id: "d2l-softmax-regression",
    title: "Dive into Deep Learning — 4.1 Softmax Regression",
    sourceFile: "chapter_linear-classification/softmax-regression.md",
    textPath: "d2l-softmax-regression.txt",
  },
  {
    id: "d2l-queries-keys-values",
    title: "Dive into Deep Learning — 11.1 Queries, Keys, and Values",
    sourceFile: "chapter_attention-mechanisms-and-transformers/queries-keys-values.md",
    textPath: "d2l-queries-keys-values.txt",
  },
  {
    id: "d2l-self-attention",
    title: "Dive into Deep Learning — 11.6 Self-Attention and Positional Encoding",
    sourceFile:
      "chapter_attention-mechanisms-and-transformers/self-attention-and-positional-encoding.md",
    textPath: "d2l-self-attention.txt",
  },
];

export interface GoldenAnchor {
  conceptId: "vectors" | "dot-product" | "softmax" | "qkv" | "self-attention";
  sourceId: string;
  text: string;
}

export const GOLDEN_ANCHORS: readonly GoldenAnchor[] = [
  {
    conceptId: "vectors",
    sourceId: "d2l-linear-algebra",
    text: "you can think of a vector as a fixed-length array of scalars.",
  },
  {
    conceptId: "dot-product",
    sourceId: "d2l-linear-algebra",
    text: "is a sum over the products of the elements at the same position",
  },
  {
    conceptId: "softmax",
    sourceId: "d2l-softmax-regression",
    text: "We can then transform these values so that they add up to 1 by dividing each by their sum.",
  },
  {
    conceptId: "qkv",
    sourceId: "d2l-queries-keys-values",
    text:
      'What is quite remarkable is that the actual "code" for executing on the set of keys and values, namely the query, can be quite concise, even though the space to operate on is significant.',
  },
  {
    conceptId: "self-attention",
    sourceId: "d2l-self-attention",
    text:
      "Because every token is attending to each other token (unlike the case where decoder steps attend to encoder steps), such architectures are typically described as self-attention models",
  },
];

export interface LicenseEvidence {
  url: string;
  statement: string;
  licenseName: string;
}

export interface SourceRevision {
  repo: string;
  tag: string;
  commit: string;
  sourceFile: string;
}

export interface AuditedSourceEntry {
  id: string;
  title: string;
  url: string;
  license: string;
  textPath: string;
  sha256: string;
  sourceSha256: string;
  author: string;
  revision: SourceRevision;
  licenseEvidence: LicenseEvidence;
  modifications: string;
  licenseDeed: string;
}

export function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function rawD2LUrl(sourceFile: string): string {
  return `https://raw.githubusercontent.com/d2l-ai/d2l-en/${D2L_COMMIT}/${sourceFile}`;
}

export function d2lBlobUrl(sourceFile: string): string {
  return `${D2L_REPO}/blob/${D2L_COMMIT}/${sourceFile}`;
}

export function localMarkdownPath(textPath: string): string {
  return textPath.replace(/\.txt$/u, ".md");
}

export function normalizeRepoLicense(licenseText: string): string {
  return licenseText.replace(/[\t ]+(?=\n)/gu, "");
}

function removeDirectiveBlocks(markdown: string): string {
  const lines = markdown.replace(/\r\n?/gu, "\n").split("\n");
  const kept: string[] = [];
  let inFence = false;
  let directiveIndent: number | undefined;

  for (const line of lines) {
    if (/^\s*```/u.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const directive = /^(\s*)\.\.\s+(?:figure|code)::/u.exec(line);
    if (directive) {
      directiveIndent = directive[1]?.length ?? 0;
      continue;
    }
    if (directiveIndent !== undefined) {
      if (line.trim().length === 0) continue;
      const indentation = /^\s*/u.exec(line)?.[0].length ?? 0;
      if (indentation > directiveIndent) continue;
      directiveIndent = undefined;
    }
    kept.push(line);
  }

  return kept.join("\n");
}

/** The exact §5.1 Markdown-to-ground-truth extraction transform. */
export function extractD2LText(markdown: string): string {
  let text = removeDirectiveBlocks(markdown);

  text = text.replace(/\$\$[\s\S]*?\$\$/gu, " ");
  text = text.replace(/\$([^$]*?)\$/gu, (_match, inner: string) => {
    const trimmed = inner.trim();
    // A lone prose token such as `$1$` is preserved while its math markup is removed.
    return /^[\p{L}\p{N}]+$/u.test(trimmed) ? trimmed : " ";
  });
  text = text.replace(
    /:(?:cite|citet|label|eqlabel|eqref|width|numref):(?:`[^`]*`|[^\s]*)/gu,
    " "
  );
  text = text.replace(/!?\[([^\]]*)\]\([^)]*\)/gu, "$1");
  text = text.replace(/\[([^\]]*)\]/gu, "$1");
  text = text.replace(/\*\*|\*|`|~~/gu, "");

  return `${text.replace(/\s+/gu, " ").trim()}\n`;
}

async function checkedFetch(url: string): Promise<Response> {
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "atomic-learning-graph corpus verifier/0.2 (https://github.com/; educational build)",
    },
  });
  if (!response.ok) {
    throw new Error(`corpus fetch failed: ${response.status} ${response.statusText} for ${url}`);
  }
  return response;
}

export async function fetchPinnedText(url: string): Promise<string> {
  const parsed = new URL(url);
  if (parsed.hostname !== "raw.githubusercontent.com") {
    throw new Error(`unsupported corpus URL: ${url}`);
  }
  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length < 4 || !/^[0-9a-f]{40}$/iu.test(segments[2] ?? "")) {
    throw new Error(`raw GitHub source is not pinned to a 40-hex commit: ${url}`);
  }
  return (await checkedFetch(url)).text();
}

export async function verifyLicenseEvidence(entry: AuditedSourceEntry): Promise<void> {
  const page = await fetchPinnedText(entry.licenseEvidence.url);
  if (!page.includes(entry.licenseEvidence.licenseName)) {
    throw new Error(
      `licence evidence no longer contains ${JSON.stringify(entry.licenseEvidence.licenseName)}: ` +
        entry.licenseEvidence.url
    );
  }
}

export function renderAttributions(entries: readonly AuditedSourceEntry[]): string {
  const sections = entries.map(
    (entry) => `## ${entry.title}

- Source: [pinned ${entry.revision.tag} revision](${entry.url})
- Author: ${entry.author}
- Licence: \`${entry.license}\` ([licence deed](${entry.licenseDeed}))
- Licence evidence: [licence text at the pinned commit](${entry.licenseEvidence.url})
- Upstream Markdown SHA-256: \`${entry.sourceSha256}\`
- Extracted text SHA-256: \`${entry.sha256}\`
- Modifications made: ${entry.modifications}
`
  );

  return `# Attributions

The source texts under \`data/oer/\` and the AI-translated lesson adaptations are distributed under
CC-BY-SA-4.0. See \`LICENSE\`, \`NOTICE\`, and \`DATA-LICENSE\`.

${sections.join("\n")}`;
}

export function renderDataLicense(entries: readonly AuditedSourceEntry[]): string {
  return `DATA LICENCE
============

The source documents in data/oer/ are excerpts from Dive into Deep Learning by
${D2L_AUTHOR}. They are redistributed under the Creative Commons
Attribution-ShareAlike 4.0 International licence (CC-BY-SA-4.0).

Pinned source revision: ${D2L_REPO} tag ${D2L_TAG}, commit ${D2L_COMMIT}.
The files were transformed as described in ATTRIBUTIONS.md; their extracted SHA-256 values are
recorded in data/oer/sources.json. The ${entries.length} included source documents retain the same
licence. AI-translated lesson adaptations produced from them are also CC-BY-SA-4.0.

Licence deed: ${CC_BY_SA_4_DEED}
Full licence: LICENSE
`;
}

export function renderNotice(entries: readonly AuditedSourceEntry[]): string {
  return `Atomic Learning Graph
=====================

Source code (src/, scripts/, build config) is licensed under MIT; see LICENSE-CODE.
Learning content (data/oer/, data/graph.json) is licensed under CC-BY-SA-4.0; see LICENSE.
ShareAlike is viral on adaptations: the lessons cannot be relicensed.

The ${entries.length} source documents in data/oer/ are adapted from Dive into Deep Learning by
${D2L_AUTHOR}, pinned to ${D2L_TAG} at commit ${D2L_COMMIT}. They are used under
CC-BY-SA-4.0. To produce the plain-text corpus: fenced code blocks, display and inline math,
tables, emphasis delimiters, and inline role directives were removed; links and reference
anchors were resolved to plain text; whitespace was collapsed. Section headings and tab
directives (:begin_tab: / :end_tab:) are retained inline.

Lessons generated from these sources are modified, AI-translated adaptations. They are not
endorsed by the Dive into Deep Learning authors. Per-source titles, links, hashes, and
modifications are recorded in ATTRIBUTIONS.md and data/oer/sources.json.
`;
}
