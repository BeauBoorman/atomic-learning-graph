import { useEffect, useRef, useState } from "react";
import type { ConceptId, LearningGraph } from "../types";
import { GraphMap } from "./GraphMap";

interface MapToggleProps {
  graph: LearningGraph;
  goalId: ConceptId;
  currentId: ConceptId;
  path: ConceptId[];
  initialPath: ConceptId[];
  covered: ConceptId[];
  theme: "light" | "dark";
}

/**
 * The map is SUMMONED, and it arrives as a full-bleed plate — a fold-out map bound into a book,
 * not a panel living permanently beside the lesson. That is the owner's law: the lesson is the
 * page, and the map is the thing you go and check when you want to know where you are.
 *
 * It shares the ONE sheet mechanism with the source view (`.sheet` + `<dialog>.showModal()`),
 * which is not a detail: showModal is what buys the real focus trap, Esc, the inert background
 * and the top layer. The top layer is also why no ancestor's overflow or transform can clip the
 * plate — this renders inside `main.course`, a 720px column, and covers the viewport anyway.
 *
 * Growing to "tons of nodes" later needs a bigger canvas, and this is where it comes from: the
 * plate is sized by the VIEWPORT, so the map is no longer squeezed into the reading column. No
 * rewrite is required to scale it — only dagre options.
 */
export function MapToggle({
  graph,
  goalId,
  currentId,
  path,
  initialPath,
  covered,
  theme,
}: MapToggleProps) {
  const [open, setOpen] = useState(false);
  // The map stays MOUNTED slightly past close: the plate animates out over 260ms (.sheet's
  // transition), and unmounting the GraphMap on the same frame as close() blanked the plate
  // mid-flight — the learner watched an empty sheet slide away. 320ms covers the transition
  // with margin; under reduced motion the close is instant and the extra mounted frames are
  // invisible behind display:none.
  const [mounted, setMounted] = useState(false);
  const [selectedId, setSelectedId] = useState<ConceptId>(currentId);
  const plate = useRef<HTMLDialogElement>(null);
  const summon = useRef<HTMLButtonElement>(null);

  useEffect(() => setSelectedId(currentId), [currentId]);

  useEffect(() => {
    if (open) {
      setMounted(true);
      return;
    }
    const timer = window.setTimeout(() => setMounted(false), 320);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    const node = plate.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    if (!open && node.open) node.close();
  }, [open]);

  // THE SYNC THAT MUST NOT BE MISSED — the same one Citation.tsx documents. Esc closes a dialog
  // NATIVELY, without telling React. If state still believed the plate was open, setOpen(true)
  // would be a no-op (same value, no re-render, the effect above never runs) and the button
  // would be DEAD for the rest of the session. `close` does not bubble, so it is listened for on
  // the node itself: one mechanism that fires however the plate was dismissed.
  useEffect(() => {
    const node = plate.current;
    if (!node) return;
    const sync = () => setOpen(false);
    node.addEventListener("close", sync);
    return () => node.removeEventListener("close", sync);
  }, []);

  // Focus returns to the button that summoned the plate, not to the top of the document.
  const dismiss = () => {
    setOpen(false);
    summon.current?.focus();
  };

  return (
    <section className="map-toggle" aria-label="Optional concept map">
      <button
        ref={summon}
        className="text-button"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        Show where I am
      </button>

      {/* The apology is gone. It read "You are learning X. The map is optional." — a caption that
          repeated the headline the learner was already looking at and then talked the map down
          before they had seen it. Nothing that apologises for itself looks engineered, and the
          button already says the map is a choice. */}
      <dialog
        ref={plate}
        className="sheet map-sheet"
        aria-label="The map of your route"
        onClick={(event) => {
          // In the top layer a ::backdrop click reports the dialog itself as the target. The
          // padding lives on the body so this stays an exact test.
          if (event.target === plate.current) dismiss();
        }}
      >
        <div className="sheet-body map-sheet-body">
          <button type="button" className="sheet-close" aria-label="Close the map" onClick={dismiss}>
            ×
          </button>
          {/* Mounted only while open (plus the close animation), and deliberately: Cytoscape
              measures its container at mount, and a display:none dialog measures 0. The
              GraphMap's ResizeObserver re-fits when the real box arrives a frame later, which
              is exactly the case it was written for. */}
          {mounted && (
            <GraphMap
              graph={graph}
              goalId={goalId}
              selectedId={selectedId}
              currentId={currentId}
              path={path}
              initialPath={initialPath}
              covered={covered}
              theme={theme}
              onSelect={setSelectedId}
            />
          )}
        </div>
      </dialog>
    </section>
  );
}
