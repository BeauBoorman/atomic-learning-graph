import { useEffect, useMemo, useState } from "react";
import type { ConceptId, LearningGraph } from "../types";
import { GraphMap } from "./GraphMap";

interface MapToggleProps {
  graph: LearningGraph;
  goalId: ConceptId;
  currentId: ConceptId;
  path: ConceptId[];
  initialPath: ConceptId[];
  known: ConceptId[];
  theme: "light" | "dark";
}

export function MapToggle({
  graph,
  goalId,
  currentId,
  path,
  initialPath,
  known,
  theme,
}: MapToggleProps) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<ConceptId>(currentId);
  const currentTitle = useMemo(
    () => graph.concepts.find((concept) => concept.id === currentId)?.title ?? currentId,
    [currentId, graph],
  );

  useEffect(() => setSelectedId(currentId), [currentId]);

  return (
    <section className="map-toggle" aria-label="Optional concept map">
      <button
        className="text-button"
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? "Hide the map" : "Show where I am"}
      </button>
      {open && (
        <div className="map-disclosure">
          <p>You are learning <strong>{currentTitle}</strong>. The map is optional.</p>
          <GraphMap
            graph={graph}
            goalId={goalId}
            selectedId={selectedId}
            currentId={currentId}
            path={path}
            initialPath={initialPath}
            known={known}
            theme={theme}
            onSelect={setSelectedId}
          />
        </div>
      )}
    </section>
  );
}
