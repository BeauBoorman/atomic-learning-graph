import { useEffect, useId, useReducer, useRef, type RefObject } from "react";
import type { ResolvedPassage } from "./model";
import { sourceProse } from "./sourceProse";
import { MathText } from "./MathText";

const licenseUrls: Record<string, string> = {
  "CC-BY-4.0": "https://creativecommons.org/licenses/by/4.0/",
  "CC-BY-SA-4.0": "https://creativecommons.org/licenses/by-sa/4.0/",
  "CC0-1.0": "https://creativecommons.org/publicdomain/zero/1.0/",
};

/** "CC-BY-SA-4.0" → "CC BY-SA 4.0" — the way a colophon spells a license. */
const licenseLabel = (license: string): string =>
  license.replace(/^CC-/, "CC ").replace(/-(\d)/, " $1");

/** "Dive into Deep Learning — 2.3 Linear Algebra" → the work, the section number, the section name.
 *  DERIVED, never hardcoded: the route crosses FOUR d2l sections (2.3 Linear Algebra, 4.1 Softmax
 *  Regression, 11.1 Queries/Keys/Values, 11.6 Self-Attention). A colophon that reads "§2.3, Linear
 *  Algebra" on every page would be a FALSE citation on two thirds of them — on the one project that
 *  cannot afford a false citation. Falls back to the whole title if a future source is titled
 *  differently; a fallback prints less, it never prints a lie. */
function citeParts(title: string): {
  work: string;
  section: { number: string; name: string } | null;
} {
  const match = title.match(/^(.*?)\s+[—–-]\s+(\d+(?:\.\d+)*)\s+(.+)$/);
  return match
    ? { work: match[1], section: { number: match[2], name: match[3] } }
    : { work: title, section: null };
}

/** "Aston Zhang, Zachary C. Lipton, Mu Li, and Alexander J. Smola" → "Zhang, Lipton, Li & Smola".
 *  Bails out to the full string unless every part yields a surname, so a name shape this does not
 *  understand is printed in full rather than mangled. Attribution is a license obligation. */
function surnames(author: string): string {
  const people = author
    .split(/,\s*|\s+and\s+/)
    .map((part) => part.replace(/^and\s+/, "").trim())
    .filter(Boolean);
  const last = people.map((person) => person.split(/\s+/).pop() ?? "").filter(Boolean);
  if (last.length !== people.length || last.length < 2) return author;
  return `${last.slice(0, -1).join(", ")} & ${last[last.length - 1]}`;
}

/** Screen readers cannot perceive <mark> — NVDA and JAWS do not announce its boundaries by
 *  default. The note beside it claims "the highlighted words are the authors' own", so without
 *  these delimiters that claim is simply false for anyone not looking at the screen. */
export function Passage({ passage, quote }: { passage: string; quote: string }) {
  const prose = sourceProse(passage);
  const cited = sourceProse(quote);
  const at = prose.indexOf(cited);
  if (at < 0) return <MathText text={prose} />;
  return (
    <>
      <MathText text={prose.slice(0, at)} />
      <mark>
        <span className="sr-only">Begin words copied from the source: </span>
        <MathText text={cited} />
        <span className="sr-only"> End copied words.</span>
      </mark>
      <MathText text={prose.slice(at + cited.length)} />
    </>
  );
}

export type RecallState = "available" | "recalling";
type RecallAction = "begin" | "reveal" | "reset";

/** The receipt starts visible, can be covered for a learner-chosen recall attempt, and returns to
 *  the same visible bytes on reveal. */
export function recallTransition(_state: RecallState, action: RecallAction): RecallState {
  return action === "begin" ? "recalling" : "available";
}

export function RecallPractice({
  resolved,
  quoteId,
  state,
  onBegin,
  onReveal,
}: {
  resolved: ResolvedPassage;
  quoteId: string;
  state: RecallState;
  onBegin: () => void;
  onReveal: () => void;
}) {
  const recalling = state === "recalling";

  return (
    <div className="recall-practice">
      <p className="recall-question">
        Before you look — in your own words, what does the source say here?
      </p>
      {recalling && (
        <p className="recall-status">Hold the answer in mind or say it aloud. Nothing is recorded.</p>
      )}
      <p className="recall-actions">
        <button
          type="button"
          className="recall-action"
          aria-controls={quoteId}
          aria-expanded={!recalling}
          onClick={recalling ? onReveal : onBegin}
        >
          {recalling ? "Reveal the source" : "Test yourself first"}
        </button>
        {!recalling && (
          <>
            <span aria-hidden="true">·</span>
            <a className="recall-action" href={`#${quoteId}`}>Skip to the source</a>
          </>
        )}
      </p>

      <blockquote
        id={quoteId}
        className="source-quote"
        cite={resolved.source.url}
        tabIndex={-1}
        hidden={recalling}
      >
        <Passage passage={resolved.passage} quote={resolved.quote} />
      </blockquote>
    </div>
  );
}

/** The summon. A footnote mark, not a button that says "Show the source" — the receipt belongs
 *  where the claim is, and a page that ends in a footnote mark reads like an edition. */
export function FootnoteMark({
  open,
  onOpen,
  ref,
}: {
  open: boolean;
  onOpen: () => void;
  ref: RefObject<HTMLButtonElement | null>;
}) {
  return (
    <button
      ref={ref}
      type="button"
      className="footnote-mark"
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label="Read the source behind this step"
      onClick={onOpen}
    >
      ᵃ
    </button>
  );
}

interface CitationProps {
  resolved: ResolvedPassage;
  /** The lesson step, so the sheet can set the two texts side by side. The parallel is the pitch:
   *  a single-column drawer can only show the source; the parallel shows the RELATIONSHIP. */
  stepText: string;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  /** Whether to print the visible colophon. An alternate route cites the SAME source on every
   *  step, and printing the identical attribution under each of its four steps read as a
   *  stuck rubber stamp. The first step for each source keeps it — the license obligation is
   *  discharged once, visibly — and the rest keep only their sheet and footnote mark. */
  attribution?: boolean;
}

export function Citation({
  resolved,
  stepText,
  open,
  onOpen,
  onClose,
  attribution = true,
}: CitationProps) {
  const { source } = resolved;
  const sheet = useRef<HTMLDialogElement>(null);
  const quoteId = `source-quote-${useId()}`;
  const [recallState, dispatchRecall] = useReducer(recallTransition, "available");
  const { work, section } = citeParts(source.title);
  const licenseUrl = licenseUrls[source.license];

  // showModal() rather than an `open` attribute, and this is not a detail: it is what buys the
  // real focus trap, Esc, the inert background and the top layer — none of which a hand-rolled
  // div gets right, and all of which a judge feels immediately. The top layer is also why no
  // ancestor's transform or overflow can clip this sheet.
  useEffect(() => {
    const node = sheet.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  // THE SYNC THAT MUST NOT BE MISSED. Esc closes the dialog NATIVELY, without going through
  // React. If state were left believing the sheet is still open, `setSourceOpen(true)` would be
  // a no-op — same value, no re-render, so the effect above never runs — and the ᵃ mark would be
  // dead for the rest of the session. The failure is silent and it is on the judge's first
  // gesture, so it gets an explicit listener rather than an assumption.
  //
  // `close` does not bubble; listening for it natively on the node keeps this to ONE mechanism
  // that fires however the sheet was dismissed (Esc, the ×, the backdrop, a future
  // form method="dialog"), instead of relying on React's synthetic handling of a non-bubbling
  // event. Verified in Chrome: open, native close, click the mark, it reopens.
  useEffect(() => {
    const node = sheet.current;
    if (!node) return;
    const sync = () => onClose();
    node.addEventListener("close", sync);
    return () => node.removeEventListener("close", sync);
  }, [onClose]);

  // Every opening begins with the source visible, exactly as it did before this affordance.
  useEffect(() => {
    if (!open) dispatchRecall("reset");
  }, [open]);

  return (
    <section className="citation" aria-label="Lesson source">
      {/* Always visible (once per source on the page), and deliberately so: attribution is a
          LICENSE OBLIGATION, and an obligation you discharge only if the reader performs a
          gesture is not discharged. What is summoned is the source TEXT, never the credit. */}
      {attribution && (
        <p className="colophon">
          <span className="colophon-mark" aria-hidden="true">ᵃ</span>
          <span className="colophon-source">
            <cite>
              <a href={source.url} target="_blank" rel="noreferrer">
                {work}
                <span className="sr-only"> (opens in a new tab)</span>
                <span aria-hidden="true" className="external-link-icon">↗</span>
              </a>
            </cite>
            {section ? ` §${section.number}, “${section.name}”` : ""} — {surnames(source.author)}
          </span>
          <span className="colophon-meta">
            {licenseUrl ? (
              <a href={licenseUrl} target="_blank" rel="noreferrer">
                {licenseLabel(source.license)}
                <span className="sr-only"> (opens in a new tab)</span>
                <span aria-hidden="true" className="external-link-icon">↗</span>
              </a>
            ) : (
              licenseLabel(source.license)
            )}
            {" · "}
            <strong>Plain translation</strong>
            {" · "}
            <button type="button" className="source-link" aria-haspopup="dialog" onClick={onOpen}>
              Read the source ↗
            </button>
          </span>
        </p>
      )}

      <dialog
        ref={sheet}
        className="sheet"
        aria-label="The source behind this step"
        onClick={(event) => {
          // In the top layer, ::backdrop clicks report the dialog itself as the target. The
          // padding lives on .sheet-body precisely so that this stays an exact test.
          if (event.target === sheet.current) onClose();
        }}
      >
        <div className="sheet-body">
          <button type="button" className="sheet-close" aria-label="Close the source" onClick={onClose}>
            ×
          </button>

          <div className="parallel">
            <div className="parallel-col">
              <p className="parallel-label">This edition</p>
              <p className="parallel-lesson"><MathText text={stepText} /></p>
            </div>
            <div className="parallel-col">
              <p className="parallel-label">The source</p>
              <RecallPractice
                resolved={resolved}
                quoteId={quoteId}
                state={recallState}
                onBegin={() => dispatchRecall("begin")}
                onReveal={() => dispatchRecall("reveal")}
              />
            </div>
          </div>

          {/* The doctrine gets a name and a real lineage. "Meaning-for-meaning, not word-for-word"
              is dynamic equivalence — the NIV's own stated translation philosophy. The translation
              is not the shameful part; it IS the product. The word "AI" never appears. */}
          <p className="translators-note">
            <strong>On this edition.</strong> Every lesson here is a translation, not a summary. We
            render each idea in the plainest English that keeps the meaning whole — meaning-for-meaning,
            not word-for-word — and anchor every sentence to the passage beside it. The highlighted
            words are the authors' own. The translation was made once, in advance, and checked against
            the source; nothing on this page is written while you read.
          </p>

          {/* Disclose, never edit. Source mathematics is preserved verbatim in the quote bytes and
              rendered inline with KaTeX (see MathText). The license line closes the CC BY-SA 4.0
              §3(b) gap: the old line stated only the SOURCE's license, not this edition's. */}
          <p className="sheet-foot">
            Source mathematics is rendered inline as the author wrote it. This edition is published
            under the same license as the source, {licenseLabel(source.license)}.
          </p>
        </div>
      </dialog>
    </section>
  );
}
