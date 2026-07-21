import type { CourseReceipt } from "../types";

/**
 * The build receipt, rendered. This is the in-app half of the compiler's signature artifact: every
 * value is read from the committed data/course.receipt.json inlined at build time, so the card is
 * exact and needs no request. It answers "how was this course made, and what is proven?" in place,
 * and names the provenance TIER each fact belongs to — the boundary is a product feature, not a
 * README caveat.
 */
export function ReceiptCard({ receipt }: { receipt: CourseReceipt }) {
  const { sourceCorpus, structure, generation, verification, cost } = receipt;
  const warnings = verification.semanticReview.warnings;

  const rows: Array<{ tier: string; label: string; value: string }> = [
    {
      tier: "Human-specified",
      label: "Structure",
      value: `${structure.concepts} concepts, ${structure.prerequisiteEdges} prerequisite edges, ${structure.citedLessonSteps} cited steps`,
    },
    {
      tier: "Model-generated",
      label: "Lesson prose",
      value: `${generation.lessonProse} · prompt ${generation.promptVersion}`,
    },
    {
      tier: "Deterministically verified",
      label: "Source quotes",
      value: `grounded in ${sourceCorpus.work}, ${sourceCorpus.sections} sections`,
    },
    {
      tier: "Advisory-reviewed",
      label: "Readability & atomicity",
      value: `${warnings} advisory warning${warnings === 1 ? "" : "s"}, never a gate`,
    },
    {
      tier: "Not proven",
      label: "Meaning preservation",
      value: "reviewable, not guaranteed",
    },
  ];

  return (
    <aside className="receipt-card" aria-labelledby="receipt-heading">
      <h2 id="receipt-heading" className="receipt-title">The build receipt</h2>
      <p className="receipt-lede">
        A human set the structure, a model wrote the prose, and deterministic checks prove the citations.
        Each row says which of those it is.
      </p>
      <dl className="receipt-rows">
        {rows.map((row) => (
          <div className="receipt-row" key={row.label}>
            <dt>
              <span className="receipt-tier" data-tier={row.tier}>{row.tier}</span>
              <span className="receipt-label">{row.label}</span>
            </dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      <ul className="receipt-facts">
        <li>
          <span className="receipt-fact-key">Source</span>
          <span>{sourceCorpus.work} · {sourceCorpus.license} · pinned <code>{sourceCorpus.commit.slice(0, 7)}</code></span>
        </li>
        <li>
          <span className="receipt-fact-key">Cost to compile</span>
          <span>${cost.usd.toFixed(2)} · ~${cost.perConcept.toFixed(3)}/concept · {cost.tokens.toLocaleString("en-US")} tokens</span>
        </li>
        <li>
          <span className="receipt-fact-key">Graph hash</span>
          <span><code>{verification.graphHash.slice(0, 8)}…</code></span>
        </li>
        <li className="receipt-headline">
          <span className="receipt-fact-key">Runtime model calls</span>
          <strong>{generation.runtimeModelCalls}</strong>
        </li>
      </ul>
    </aside>
  );
}
