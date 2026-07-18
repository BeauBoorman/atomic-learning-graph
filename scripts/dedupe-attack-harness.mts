// Adversarial attack harness for src/atomization/dedupe.ts.
// Usage: pnpm exec tsx scripts/dedupe-attack-harness.mts <attack-file.json>
// Attack file: { cases: [{ name, sources: [{id,text}], candidates: [{id,title,summary,sourceId,
//   quotedText,tags}], judge: "none" | { ideaByTitle: Record<title, ideaKey> },
//   expect: { mustKeepSeparate?: [title,title][], mustMerge?: [title,title][] } }] }
// The oracle judge groups candidates whose titles map to the same ideaKey — i.e. a judge that
// answers PERFECTLY. Attacks that fail even under a perfect judge are real design defects.
import { readFileSync } from "node:fs";
import type { AtomizedConcept, Source } from "../src/types";
import type { ResponsesClient } from "../src/atomization/client";
import { dedupeCandidates } from "../src/atomization/dedupe";
import { quoteGrounded } from "../src/graph/invariants";

interface AttackCase {
  name: string;
  sources: Array<{ id: string; text: string }>;
  candidates: Array<{
    id: string; title: string; summary: string; sourceId: string; quotedText: string; tags: string[];
  }>;
  judge: "none" | { ideaByTitle: Record<string, string> };
  expect: { mustKeepSeparate?: [string, string][]; mustMerge?: [string, string][] };
}

// A PERFECT model: the sweep call gets every same-idea pair flagged; the partition call gets the
// exact ground-truth grouping. Attacks that succeed under this oracle are hard design defects.
function oracle(ideaByTitle: Record<string, string>): ResponsesClient {
  return {
    request: async (_instructions: string, input: string, _schema: unknown, schemaName: string) => {
      const payload = JSON.parse(input.slice(input.indexOf("\n") + 1)) as Array<{
        index: number; title: string;
      }>;
      const groups = new Map<string, number[]>();
      for (const item of payload) {
        const idea = ideaByTitle[item.title] ?? `solo-${item.index}`;
        groups.set(idea, [...(groups.get(idea) ?? []), item.index]);
      }
      if (schemaName === "dedupe_pair_sweep") {
        const pairs: Array<{ a: number; b: number }> = [];
        for (const indices of groups.values()) {
          for (let i = 1; i < indices.length; i += 1) pairs.push({ a: indices[0], b: indices[i] });
        }
        return { pairs };
      }
      return { groups: [...groups.values()].map((indices) => ({ indices, reason: "oracle" })) };
    },
  } as unknown as ResponsesClient;
}

const file = process.argv[2];
if (!file) throw new Error("usage: tsx scripts/dedupe-attack-harness.mts <attack-file.json>");
const { cases } = JSON.parse(readFileSync(file, "utf8")) as { cases: AttackCase[] };

let failures = 0;
for (const attack of cases) {
  const sources: Source[] = attack.sources.map((source) => ({
    ...source, title: source.id, license: "CC0-1.0", author: "attacker",
  }));
  const candidates: AtomizedConcept[] = attack.candidates.map((candidate) => ({
    ...candidate, provenance: { sourceId: candidate.sourceId, quotedText: candidate.quotedText },
    prerequisites: [], related: [],
  }));
  const fixtureErrors = candidates.filter(
    (candidate) => !quoteGrounded(sources, candidate.provenance.sourceId, candidate.provenance.quotedText),
  );
  if (fixtureErrors.length > 0) {
    console.log(`INVALID-FIXTURE ${attack.name}: ungrounded candidates ${fixtureErrors.map((c) => c.id).join(", ")}`);
    failures += 1;
    continue;
  }
  const warnings: string[] = [];
  const origWarn = console.warn; const origLog = console.log;
  console.warn = (msg: unknown) => { warnings.push(String(msg)); };
  console.log = () => undefined;
  let merged: AtomizedConcept[];
  try {
    merged = await dedupeCandidates(
      candidates, attack.judge === "none" ? undefined : oracle(attack.judge.ideaByTitle),
    );
  } catch (error) {
    console.warn = origWarn; console.log = origLog;
    console.log(`CRASH ${attack.name}: ${String(error)}`);
    failures += 1;
    continue;
  }
  console.warn = origWarn; console.log = origLog;

  const problems: string[] = [];
  const survivingTitle = (title: string): AtomizedConcept | undefined =>
    merged.find((concept) =>
      concept.title === title ||
      (concept.mergedEvidence ?? []).some((evidence) => evidence.title === title));
  const sameConcept = (a: string, b: string): boolean => {
    const conceptA = survivingTitle(a); const conceptB = survivingTitle(b);
    return conceptA !== undefined && conceptA === conceptB;
  };
  for (const [a, b] of attack.expect.mustKeepSeparate ?? []) {
    if (sameConcept(a, b)) problems.push(`WRONGLY MERGED: "${a}" + "${b}"`);
  }
  for (const [a, b] of attack.expect.mustMerge ?? []) {
    if (!sameConcept(a, b)) problems.push(`LEFT AS DUPLICATES: "${a}" / "${b}"`);
  }
  for (const concept of merged) {
    if (!quoteGrounded(sources, concept.provenance.sourceId, concept.provenance.quotedText)) {
      problems.push(`UNGROUNDED OUTPUT: ${concept.id}`);
    }
    if (concept.prerequisites.length > 0 || concept.related.length > 0) {
      problems.push(`NON-EMPTY RELATIONS: ${concept.id}`);
    }
  }
  const ids = merged.map((concept) => concept.id);
  if (new Set(ids).size !== ids.length) problems.push("DUPLICATE OUTPUT IDS");

  if (problems.length > 0) {
    failures += 1;
    console.log(`ATTACK-SUCCEEDED ${attack.name}\n  ${problems.join("\n  ")}`);
  } else {
    console.log(`defended ${attack.name} (${candidates.length} -> ${merged.length}${warnings.length > 0 ? `, ${warnings.length} warnings` : ""})`);
  }
}
console.log(failures === 0 ? "ALL ATTACKS DEFENDED" : `${failures} ATTACK(S) SUCCEEDED`);
process.exit(failures === 0 ? 0 : 1);
