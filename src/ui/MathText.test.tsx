// Manual fixtures pin the display-only interpretation of the committed source bytes.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MathText } from "./MathText";

describe("MathText", () => {
  it("renders the Fahrenheit conversion fixture with KaTeX, inline and display", () => {
    const markup = renderToStaticMarkup(
      <p>
        <MathText text={"Convert with $c = \\frac{5}{9}(f-32)$ and display: $$c = \\frac{5}{9}(f-32)$$"} />
      </p>,
    );
    expect(markup.match(/class="katex"/gu)?.length).toBe(2);
    expect(markup.match(/class="katex-display"/gu)?.length).toBe(1);
    // KaTeX typesets the fraction structurally rather than echoing the TeX source.
    expect(markup).toContain("mfrac");
    // The surrounding prose stays literal text, outside any KaTeX node.
    expect(markup).toContain("Convert with ");
    expect(markup).toContain("and display: ");
  });

  it("leaves paired price strings literal instead of typesetting them", () => {
    const markup = renderToStaticMarkup(
      <p><MathText text="The demo graph cost $0.43 (~$0.043 per concept) to compile." /></p>,
    );
    expect(markup).not.toContain("katex");
    expect(markup).toContain("The demo graph cost $0.43 (~$0.043 per concept) to compile.");
  });

  it("renders bare variables and Greek commands as inline math", () => {
    const markup = renderToStaticMarkup(
      <p><MathText text={"Dimensions $x$ and $d$ use coefficient $\\alpha$."} /></p>,
    );
    expect(markup.match(/class="katex"/gu)?.length).toBe(3);
    expect(markup).not.toContain("$x$");
    expect(markup).not.toContain("$d$");
    expect(markup).not.toContain("$\\alpha$");
  });

  it("keeps standalone and paired prose currency literal", () => {
    const standalone = renderToStaticMarkup(<p><MathText text="It cost $0.43." /></p>);
    const paired = renderToStaticMarkup(<p><MathText text={'Tickets cost "$5 and $10".'} /></p>);

    expect(standalone).not.toContain("katex");
    expect(standalone).toContain("It cost $0.43.");
    expect(paired).not.toContain("katex");
    expect(paired).toContain('&quot;$5 and $10&quot;');
  });

  it("falls back to the literal committed text on malformed TeX", () => {
    const markup = renderToStaticMarkup(
      <p><MathText text={"A dangling $\\frac{5}{$ span stays exactly as committed."} /></p>,
    );
    expect(markup).not.toContain("katex");
    expect(markup).toContain("A dangling $\\frac{5}{$ span stays exactly as committed.");
  });

  it("renders plain prose untouched", () => {
    const markup = renderToStaticMarkup(
      <p><MathText text="Vectors are fixed-length arrays of numbers." /></p>,
    );
    expect(markup).toBe("<p>Vectors are fixed-length arrays of numbers.</p>");
  });
});
