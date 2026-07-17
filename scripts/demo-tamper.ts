import { invalidLessonCitations, invalidRenderingCitations } from "../src/graph/invariants";
import {
  loadGraph,
  loadRenderingsForVerification,
  requireRenderingsForVerification,
} from "../src/graph/load";
import { validateManifest } from "../src/atomization/manifest";

function fail(message: string): never {
  console.error(`\nCAGE FAILURE: ${message}`);
  process.exit(1);
}
const show = (label: string, value: unknown): void =>
  console.log(`  ${label}: ${typeof value === "string" ? value : JSON.stringify(value)}`);

const graph = loadGraph();
const renderings = loadRenderingsForVerification();
const concept = graph.concepts.find(({ lesson }) => lesson && lesson.steps.length > 0);
if (!concept) fail("real graph has no lesson citation to test");
const lesson = concept.lesson;
if (!lesson) fail("real graph has no lesson citation to test");
const original = lesson.steps[0].citation.quotedText;

console.log("TAMPER DEMO — the production gates inspect in-memory clones\n");

console.log("1/5 FABRICATED QUOTE");
if (invalidLessonCitations(graph).length > 0) fail("committed lesson citations are already invalid");
show("before PASS", original);
const fabricated = structuredClone(graph);
fabricated.concepts.find(({ id }) => id === concept.id)!.lesson!.steps[0].citation.quotedText =
  original.replace(/[\p{L}\p{N}]+/u, "FABRICATED");
const fabricatedIssue = invalidLessonCitations(fabricated).find(
  ({ conceptId, stepIndex }) => conceptId === concept.id && stepIndex === 0,
);
if (fabricatedIssue?.reason !== "quote-not-found") fail("fabricated quote was NOT caught");
show("after REJECTED", fabricatedIssue);

console.log("\n2/5 STOPWORD QUOTE");
show("before PASS", original);
const stopword = structuredClone(graph);
stopword.concepts.find(({ id }) => id === concept.id)!.lesson!.steps[0].citation.quotedText = "the";
const stopwordIssue = invalidLessonCitations(stopword).find(
  ({ conceptId, stepIndex }) => conceptId === concept.id && stepIndex === 0,
);
if (stopwordIssue?.reason !== "quote-too-weak") fail("stopword quote was NOT caught by the strength floor");
show("after REJECTED", stopwordIssue);

console.log("\n3/5 UNRESOLVED RENDERING SOURCE");
if (invalidRenderingCitations(graph, renderings).length > 0) fail("committed rendering citations are already invalid");
const rendering = renderings.renderings[0];
show("before PASS", rendering.steps[0].citation.sourceId);
const unresolved = structuredClone(renderings);
unresolved.renderings[0].steps[0].citation.sourceId = "fabricated-source";
const renderingIssue = invalidRenderingCitations(graph, unresolved)[0];
if (renderingIssue?.reason !== "unresolved-source") fail("unresolved rendering source was NOT caught");
show("after REJECTED", renderingIssue);

console.log("\n4/5 EMPTY RENDERINGS ARTIFACT");
show("before PASS", `${renderings.renderings.length} committed renderings`);
const empty = structuredClone(renderings);
empty.renderings = [];
try {
  requireRenderingsForVerification(empty, "<in-memory clone>");
  fail("empty renderings artifact was NOT rejected");
} catch (error) {
  show("after REJECTED", error instanceof Error ? error.message : error);
}

console.log("\n5/5 NONCOMMERCIAL LICENCE");
const mitOcwSource = {
  id: "mit-ocw-example",
  title: "MIT OpenCourseWare",
  author: "Massachusetts Institute of Technology",
  license: "CC-BY-4.0",
  textPath: "mit-ocw-example.txt",
  url: "https://ocw.mit.edu/pages/privacy-and-terms-of-use/",
};
const accepted = validateManifest({ sources: [mitOcwSource] }, "<in-memory corpus>");
show("CC-BY-4.0 ACCEPTED", accepted[0]?.license);
try {
  validateManifest(
    { sources: [{ ...mitOcwSource, license: "CC-BY-NC-SA-4.0" }] },
    "<in-memory corpus>",
  );
  fail("MIT OpenCourseWare's -NC licence was NOT rejected");
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (!message.includes("license is not allowlisted") || !message.includes("CC-BY-NC-SA-4.0")) {
    fail(`MIT OpenCourseWare was rejected for the wrong reason: ${message}`);
  }
  show("CC-BY-NC-SA-4.0 REFUSED ON LICENCE", message);
}

console.log("\nCAGE CLOSED: 5/5 tamper scenarios rejected.");
