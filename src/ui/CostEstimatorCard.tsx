import { useState, type ReactElement } from "react";
import {
  PRICING_TABLE,
  estimateAtomizationCosts,
} from "../cost/estimator";

interface CostEstimatorCardViewProps {
  text: string;
  onTextChange: (text: string) => void;
}

const wholeNumber = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

/** Pure controlled boundary so the rendered estimate and edit path can be tested without a DOM. */
export function CostEstimatorCardView({
  text,
  onTextChange,
}: CostEstimatorCardViewProps): ReactElement {
  const estimates = estimateAtomizationCosts(text);
  const estimatesByModel = new Map(estimates.map((estimate) => [estimate.model, estimate]));
  const leadEstimate = estimatesByModel.get(PRICING_TABLE[0].model);
  if (!leadEstimate) throw new Error("cost estimator pricing table is empty");

  const hasText = text.length > 0;
  const summary = hasText
    ? `About ${usd.format(leadEstimate.estimatedUsdTotal)} to build once with ${leadEstimate.model}. Reading the finished course needs no key and no network — that part is free.`
    : "Paste source text to see its build estimate.";

  return (
    <section className="cost-estimator-card" aria-labelledby="cost-estimator-title">
      <p className="eyebrow">Compile your own course</p>
      <h2 id="cost-estimator-title">What would your source cost?</h2>
      <p className="cost-estimator-intro">
        Paste a chapter, article, or notes. The same build heuristic compares every model instantly.
      </p>

      <label className="field-label" htmlFor="cost-estimator-source">Source text</label>
      <textarea
        id="cost-estimator-source"
        className="cost-estimator-input"
        value={text}
        rows={7}
        placeholder="Paste any source text here…"
        onChange={(event) => onTextChange(event.currentTarget.value)}
      />

      <p className="cost-estimator-summary" aria-live="polite" aria-atomic="true">
        {summary}
      </p>
      {hasText && (
        <p className="cost-estimator-scope">
          {wholeNumber.format(text.length)} characters · ~{leadEstimate.estimatedConcepts.toFixed(1)} concepts
        </p>
      )}

      <div className="cost-estimator-table-wrap">
        <table className="cost-estimator-table">
          <thead>
            <tr>
              <th scope="col">Model</th>
              <th scope="col">Input tokens</th>
              <th scope="col">Output tokens</th>
              <th scope="col">Total USD</th>
              <th scope="col">USD / concept</th>
            </tr>
          </thead>
          <tbody>
            {PRICING_TABLE.map(({ model }) => {
              const estimate = estimatesByModel.get(model);
              if (!estimate) throw new Error(`missing cost estimate for ${model}`);
              return (
                <tr key={model}>
                  <th scope="row">{model}</th>
                  <td>{wholeNumber.format(estimate.estimatedInputTokens)}</td>
                  <td>{wholeNumber.format(estimate.estimatedOutputTokens)}</td>
                  <td>{usd.format(estimate.estimatedUsdTotal)}</td>
                  <td>{usd.format(estimate.estimatedUsdPerConcept)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="cost-estimator-offline">No key, no network, computed in your browser.</p>
    </section>
  );
}

export function CostEstimatorCard(): ReactElement {
  const [text, setText] = useState("");
  return <CostEstimatorCardView text={text} onTextChange={setText} />;
}
