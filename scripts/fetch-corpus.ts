import { readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CC_BY_SA_4_DEED,
  WIKIPEDIA_LICENSE_NAME,
  WIKIPEDIA_LICENSE_STATEMENT,
  fetchWikipediaExtract,
  renderAttributions,
  sha256,
  verifyLicenseEvidence,
  type AuditedSourceEntry,
} from "./corpus";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const oerDir = resolve(repoRoot, "data", "oer");

interface WikipediaSourceSpec {
  id: string;
  title: string;
  articleSlug: string;
  revision: string;
  textPath: string;
  requiredProse: RegExp[];
}

const specs: WikipediaSourceSpec[] = [
  {
    id: "wikipedia-euclidean-vector",
    title: "Euclidean vector",
    articleSlug: "Euclidean_vector",
    revision: "1362285945",
    textPath: "wikipedia-euclidean-vector.txt",
    requiredProse: [/a Euclidean vector or simply a vector/i, /has magnitude .* and direction/i],
  },
  {
    id: "wikipedia-dot-product",
    title: "Dot product",
    articleSlug: "Dot_product",
    revision: "1363226908",
    textPath: "wikipedia-dot-product.txt",
    requiredProse: [/the dot product is an algebraic operation/i, /returns a single number/i],
  },
  {
    id: "wikipedia-softmax-function",
    title: "Softmax function",
    articleSlug: "Softmax_function",
    revision: "1361846646",
    textPath: "wikipedia-softmax-function.txt",
    requiredProse: [/converts a tuple of K real numbers into a probability distribution/i],
  },
  {
    id: "wikipedia-attention",
    title: "Attention (machine learning)",
    articleSlug: "Attention_(machine_learning)",
    revision: "1361482961",
    textPath: "wikipedia-attention.txt",
    requiredProse: [
      /The major breakthrough came with self-attention/i,
      /query, key, and value vectors all come from the same model/i,
    ],
  },
];

const knownFiles = new Set(["README.md", "sources.json", ...specs.map((spec) => spec.textPath)]);
const unexpected = readdirSync(oerDir).filter((name) => !knownFiles.has(name));
if (unexpected.length > 0) {
  throw new Error(`refusing to fetch over unlisted data/oer files: ${unexpected.join(", ")}`);
}

const entries: AuditedSourceEntry[] = [];
for (const spec of specs) {
  const text = await fetchWikipediaExtract(spec.revision);
  for (const required of spec.requiredProse) {
    if (!required.test(text)) {
      throw new Error(
        `${spec.title} revision ${spec.revision} lacks required substantial prose: ${required}`
      );
    }
  }

  const url = `https://en.wikipedia.org/wiki/${spec.articleSlug}?oldid=${spec.revision}`;
  const entry: AuditedSourceEntry = {
    id: spec.id,
    title: spec.title,
    url,
    license: "CC-BY-SA-4.0",
    textPath: spec.textPath,
    sha256: sha256(text),
    author: "Wikipedia contributors",
    licenseEvidence: {
      url,
      statement: WIKIPEDIA_LICENSE_STATEMENT,
      licenseName: WIKIPEDIA_LICENSE_NAME,
    },
    modifications:
      "Text extracted to plain text with the MediaWiki `explaintext` API; article markup and formatting were removed. The extracted prose was otherwise stored verbatim.",
    licenseDeed: CC_BY_SA_4_DEED,
  };

  await verifyLicenseEvidence(entry);
  writeFileSync(resolve(oerDir, spec.textPath), text, "utf8");
  entries.push(entry);
}

writeFileSync(resolve(oerDir, "sources.json"), `${JSON.stringify({ sources: entries }, null, 2)}\n`);
writeFileSync(resolve(repoRoot, "ATTRIBUTIONS.md"), renderAttributions(entries));
console.log(`Fetched and pinned ${entries.length} openly licensed sources.`);
