import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PRICING_TABLE } from "../cost/estimator";
import { fixtureGraph } from "../graph/fixture-graph";
import { App } from "./App";
import { CostEstimatorCard, CostEstimatorCardView } from "./CostEstimatorCard";

function findElement(
  node: ReactElement,
  type: string,
): ReactElement<{
  onChange: (event: { currentTarget: { value: string } }) => void;
}> | undefined {
  if (node.type === type) {
    return node as ReactElement<{
      onChange: (event: { currentTarget: { value: string } }) => void;
    }>;
  }
  const { children } = node.props as { children?: ReactNode };
  for (const child of Children.toArray(children)) {
    if (!isValidElement(child)) continue;
    const found = findElement(child, type);
    if (found) return found;
  }
  return undefined;
}

describe("CostEstimatorCard", () => {
  it("renders live estimates for every shared pricing row", () => {
    const html = renderToStaticMarkup(
      <CostEstimatorCardView text={"x".repeat(2_000)} onTextChange={() => undefined} />,
    );

    for (const { model } of PRICING_TABLE) expect(html).toContain(model);
    expect(html).toContain("913");
    expect(html).toContain("567");
    expect(html).toContain("~0.5 concepts");
    expect(html).toContain("$0.0216");
    expect(html).toContain("$0.0442");
    expect(html).toContain("No key, no network, computed in your browser.");
  });

  it("passes each edit straight to the controlled text boundary", () => {
    const onTextChange = vi.fn();
    const view = CostEstimatorCardView({ text: "", onTextChange });
    const textarea = findElement(view, "textarea");

    expect(textarea).toBeDefined();
    textarea?.props.onChange({ currentTarget: { value: "A new source passage" } });
    expect(onTextChange).toHaveBeenCalledOnce();
    expect(onTextChange).toHaveBeenCalledWith("A new source passage");
  });

  it("is self-contained and prompts before text is entered", () => {
    const html = renderToStaticMarkup(<CostEstimatorCard />);

    expect(html).toContain("Paste source text to see its build estimate.");
    expect(html).toContain("<textarea");
  });

  it("is reachable from the reader landing screen", () => {
    const html = renderToStaticMarkup(<App graph={fixtureGraph} />);

    expect(html).toContain("What would your source cost?");
    expect(html).toContain('id="cost-estimator-source"');
  });
});
