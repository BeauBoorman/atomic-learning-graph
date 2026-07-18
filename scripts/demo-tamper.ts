import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  duplicateSourceIds,
  invalidProvenance,
} from "../src/graph/invariants";
import { GRAPH_PATH, loadGraph } from "../src/graph/load";
import { getPath } from "../src/graph/path";
import {
  FULL_GRAPH_SPINE,
  GOLDEN_PATH,
  convergenceIssues,
  type ConvergenceIssueKind,
} from "../src/atomization/repair";

function fail(message: string): never {
  console.error(`\nCAGE FAILURE: ${message}`);
  process.exit(1);
}
const show = (label: string, value: unknown): void =>
  console.log(`  ${label}: ${typeof value === "string" ? value : JSON.stringify(value)}`);
const sha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

const graph = loadGraph();
const baselineIssues = convergenceIssues(graph, {
  minConcepts: FULL_GRAPH_SPINE.concepts.length,
  structure: FULL_GRAPH_SPINE,
});
if (baselineIssues.length > 0) fail(`committed graph is already invalid: ${JSON.stringify(baselineIssues)}`);
if (invalidProvenance(graph).length > 0) fail("committed concept provenance is already invalid");

const graphBytes = readFileSync(GRAPH_PATH);
const graphRun = JSON.parse(
  readFileSync(new URL("../data/graph.run.json", import.meta.url), "utf8"),
) as { graphSha256?: string };
if (!graphRun.graphSha256 || sha256(graphBytes) !== graphRun.graphSha256) {
  fail("committed graph bytes already disagree with graph.run.json");
}

const concept = graph.concepts.find(({ provenance }) => {
  const source = graph.sources.find(({ id }) => id === provenance.sourceId);
  return source?.text.includes(provenance.quotedText);
});
if (!concept) fail("real graph has no exact concept provenance to test");
const source = graph.sources.find(({ id }) => id === concept.provenance.sourceId);
if (!source) fail("real graph has no source for the selected concept");

console.log("TAMPER DEMO — the production gates inspect only in-memory clones and bytes\n");

console.log("1/5 EMPTY-GRAPH STUB");
show("before PASS", `${graph.concepts.length} committed concepts`);
const emptyGraph = structuredClone(graph);
emptyGraph.concepts = [];
emptyGraph.edges = [];
emptyGraph.sources = [];
const emptyIssueKinds = [
  ...new Set(
    convergenceIssues(emptyGraph, {
      minConcepts: FULL_GRAPH_SPINE.concepts.length,
      structure: FULL_GRAPH_SPINE,
    }).map(({ kind }) => kind),
  ),
];
const requiredEmptyGraphIssues: readonly ConvergenceIssueKind[] = [
  "golden-node",
  "golden-edge",
  "path",
  "concept-floor",
  "source",
];
for (const required of requiredEmptyGraphIssues) {
  if (!emptyIssueKinds.includes(required)) fail(`empty graph was not rejected for ${required}`);
}
show("after REJECTED", emptyIssueKinds);

console.log("\n2/5 HARD-CODED GOLDEN PATH");
const hardCodedCandidate = [...GOLDEN_PATH];
show("cheating candidate", hardCodedCandidate);
const alternateGoalGraph = structuredClone(graph);
alternateGoalGraph.goalId = "softmax";
const derivedPath = getPath(alternateGoalGraph, alternateGoalGraph.goalId);
if (JSON.stringify(derivedPath) === JSON.stringify(hardCodedCandidate)) {
  fail("alternate goal returned the hard-coded golden path");
}
if (JSON.stringify(derivedPath) !== JSON.stringify(["vectors", "dot-product", "softmax"])) {
  fail(`alternate goal produced the wrong derived path: ${derivedPath.join(" -> ")}`);
}
show("after REJECTED; derived path", derivedPath);

console.log("\n3/5 SUBSTRING-FAKED CITATION");
show("naive source.includes(empty quote)", source.text.includes(""));
const substringFake = structuredClone(graph);
substringFake.concepts.find(({ id }) => id === concept.id)!.provenance.quotedText = "";
const substringInvalid = invalidProvenance(substringFake);
if (!substringInvalid.includes(concept.id)) fail("empty substring citation was NOT rejected");
show("after REJECTED", { conceptId: concept.id, invalidProvenance: true });

console.log("\n4/5 FIRST-MATCH SOURCE LOOKUP");
const ambiguousSourceGraph = structuredClone(graph);
ambiguousSourceGraph.sources.push({
  ...structuredClone(source),
  title: `${source.title} — decoy duplicate ID`,
  text: "This unrelated decoy makes the shared source ID ambiguous.",
});
const naiveFirstMatch = ambiguousSourceGraph.sources.find(({ id }) => id === source.id);
show("naive first match would PASS", naiveFirstMatch?.text.includes(concept.provenance.quotedText));
const duplicateIds = duplicateSourceIds(ambiguousSourceGraph);
const ambiguousInvalid = invalidProvenance(ambiguousSourceGraph);
if (!duplicateIds.includes(source.id) || !ambiguousInvalid.includes(concept.id)) {
  fail("duplicate source ID was NOT rejected as ambiguous provenance");
}
show("after REJECTED", { duplicateSourceIds: duplicateIds, invalidConceptIds: ambiguousInvalid });

console.log("\n5/5 HAND-EDITED GRAPH.JSON");
show("before PASS", graphRun.graphSha256);
// Appending JSON whitespace is a valid but byte-different hand edit; no file is changed on disk.
const editedGraphBytes = Buffer.concat([graphBytes, Buffer.from(" ", "utf8")]);
const editedHash = sha256(editedGraphBytes);
if (editedHash === graphRun.graphSha256) fail("hand-edited graph bytes still matched the run-log hash");
show("after REJECTED", { expected: graphRun.graphSha256, actual: editedHash });

console.log("\nCAGE CLOSED: 5/5 canonical tamper scenarios rejected.");
