import { useEffect, useMemo, useRef, useState } from "react";
import cytoscape from "cytoscape";
import dagre from "cytoscape-dagre";
import type { ConceptId, LearningGraph } from "../types";

cytoscape.use(dagre);

interface GraphMapProps {
  graph: LearningGraph;
  goalId: ConceptId;
  selectedId: ConceptId;
  currentId?: ConceptId;
  path: ConceptId[];
  initialPath: ConceptId[];
  known: ConceptId[];
  theme: "light" | "dark";
  onSelect: (id: ConceptId) => void;
}

const palette = {
  light: {
    surface: "#fffdf7",
    text: "#173127",
    muted: "#52625a",
    border: "#74827a",
    route: "#176044",
    routeSoft: "#718800",
    selected: "#b94722",
    goal: "#eef6bd",
    done: "#d8eadf",
    related: "#67756d",
  },
  dark: {
    surface: "#17271f",
    text: "#f4f6ed",
    muted: "#b7c4bc",
    border: "#84978c",
    route: "#a5d9bd",
    routeSoft: "#d7e878",
    selected: "#ff9c74",
    goal: "#354923",
    done: "#244b39",
    related: "#91a298",
  },
} as const;

function stylesFor(theme: "light" | "dark", reduceMotion = false): cytoscape.StylesheetJson {
  const color = palette[theme];
  return [
    {
      selector: "node",
      style: {
        width: 172,
        height: 58,
        shape: "round-rectangle",
        "background-color": color.surface,
        "border-color": color.border,
        "border-width": 1.5,
        label: "data(displayLabel)",
        color: color.text,
        "font-family": "Inter, ui-sans-serif, system-ui, sans-serif",
        "font-size": 12,
        "font-weight": 600,
        "text-wrap": "wrap",
        "text-max-width": "146px",
        "text-valign": "center",
        "text-halign": "center",
        "overlay-opacity": 0,
        "transition-property": "background-color, border-color, border-width, opacity",
        "transition-duration": reduceMotion ? 0 : 260,
      },
    },
    {
      selector: "edge",
      style: {
        width: 1.5,
        "line-color": color.related,
        "target-arrow-color": color.related,
        "target-arrow-shape": "none",
        "curve-style": "bezier",
        opacity: 0.55,
        "overlay-opacity": 0,
        "transition-property": "line-color, target-arrow-color, width, opacity",
        "transition-duration": reduceMotion ? 0 : 260,
      },
    },
    {
      selector: "edge[type = 'prereq']",
      style: {
        "line-color": color.border,
        "target-arrow-color": color.border,
        "target-arrow-shape": "triangle",
        "arrow-scale": 0.8,
        "curve-style": "taxi",
        "taxi-direction": "rightward",
        "taxi-turn": 20,
        opacity: 0.72,
      },
    },
    {
      selector: "edge[type = 'related']",
      style: {
        "line-style": "dashed",
        "line-dash-pattern": [5, 5],
        "curve-style": "bezier",
      },
    },
    {
      selector: "node.on-route",
      style: {
        "border-color": color.route,
        "border-width": 2,
        "background-color": color.surface,
      },
    },
    {
      selector: "edge.on-route",
      style: {
        "line-color": color.routeSoft,
        "target-arrow-color": color.routeSoft,
        width: 3.5,
        opacity: 1,
      },
    },
    {
      selector: "node.known",
      style: {
        "background-color": color.done,
        "border-color": color.route,
      },
    },
    {
      selector: "edge.completed",
      style: {
        "line-color": color.route,
        "target-arrow-color": color.route,
        width: 3,
        opacity: 0.9,
      },
    },
    {
      selector: "node.goal",
      style: {
        "background-color": color.goal,
        "border-color": color.routeSoft,
        "border-width": 3,
      },
    },
    {
      selector: "node.current",
      style: {
        "border-color": color.selected,
        "border-width": 3,
        "border-style": "double",
      },
    },
    {
      selector: "node.selected",
      style: {
        "border-color": color.selected,
        "border-width": 4,
      },
    },
    {
      selector: ".dimmed",
      style: { opacity: 0.16 },
    },
    {
      selector: ".highlighted",
      style: { opacity: 1 },
    },
  ];
}

export function GraphMap({
  graph,
  goalId,
  selectedId,
  currentId,
  path,
  initialPath,
  known,
  theme,
  onSelect,
}: GraphMapProps) {
  const [showFullMap, setShowFullMap] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<cytoscape.Core | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const keyboardOrder = useMemo(() => {
    if (!showFullMap) return initialPath;
    const routeIds = new Set(initialPath);
    return [
      ...initialPath,
      ...graph.concepts
        .filter((concept) => !routeIds.has(concept.id))
        .sort((a, b) => a.title.localeCompare(b.title))
        .map((concept) => concept.id),
    ];
  }, [graph, initialPath, showFullMap]);

  useEffect(() => {
    if (!viewportRef.current) return;

    const visibleIds = showFullMap
      ? new Set(graph.concepts.map((concept) => concept.id))
      : new Set(initialPath);
    const visibleEdges = graph.edges.filter((edge) =>
      visibleIds.has(edge.from)
      && visibleIds.has(edge.to)
      && (showFullMap || edge.type === "prereq")
    );
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const elements: cytoscape.ElementDefinition[] = [
      ...graph.concepts.filter((concept) => visibleIds.has(concept.id)).map((concept) => ({
        data: { id: concept.id, displayLabel: concept.title },
      })),
      ...visibleEdges.map((edge, index) => ({
        data: {
          id: `${edge.type}-${edge.from}-${edge.to}-${index}`,
          source: edge.from,
          target: edge.to,
          type: edge.type,
        },
      })),
    ];

    const cy = cytoscape({
      container: viewportRef.current,
      elements,
      style: stylesFor(theme, reduceMotion),
      minZoom: 0.45,
      maxZoom: 2.25,
      wheelSensitivity: 0.18,
      boxSelectionEnabled: false,
    });

    const layoutOptions = {
      name: "dagre",
      rankDir: "LR",
      nodeSep: showFullMap ? 42 : 26,
      rankSep: showFullMap ? 100 : 86,
      edgeSep: 18,
      ranker: "tight-tree",
      fit: true,
      padding: 52,
      animate: false,
    } as unknown as cytoscape.LayoutOptions;

    cy.elements()
      .filter((element) => element.isNode() || element.data("type") === "prereq")
      .layout(layoutOptions)
      .run();

    cy.on("tap", "node", (event) => {
      onSelectRef.current(event.target.id());
    });
    cy.on("mouseover", "node", (event) => {
      const node = event.target;
      cy.elements().addClass("dimmed");
      node.closedNeighborhood().removeClass("dimmed").addClass("highlighted");
    });
    cy.on("mouseout", "node", () => {
      cy.elements().removeClass("dimmed highlighted");
    });

    graphRef.current = cy;
    // resize() only re-measures the canvas; it does NOT re-fit the graph. The map lives
    // behind a toggle, so the container's real size arrives AFTER the layout ran — leaving
    // the zoom/pan computed against the wrong box and the route rendered as an unreadable
    // smudge off to one side. Re-fit whenever the box changes; the +/-/Fit controls still
    // let the learner zoom deliberately.
    const resizeObserver = new ResizeObserver(() => {
      cy.resize();
      cy.fit(undefined, 52);
    });
    resizeObserver.observe(viewportRef.current);

    return () => {
      resizeObserver.disconnect();
      cy.destroy();
      graphRef.current = null;
    };
  }, [graph, initialPath, showFullMap]);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    graphRef.current?.style(stylesFor(theme, reduceMotion));
  }, [theme]);

  useEffect(() => {
    const cy = graphRef.current;
    if (!cy) return;

    const remaining = new Set(path);
    const wholeRoute = new Set(initialPath);
    const knownIds = new Set(known);
    cy.batch(() => {
      cy.nodes().forEach((node) => {
        const id = node.id();
        const title = graph.concepts.find((concept) => concept.id === id)?.title ?? id;
        node.removeClass("on-route known goal current selected");
        node.toggleClass("on-route", remaining.has(id));
        node.toggleClass("known", knownIds.has(id));
        node.toggleClass("goal", id === goalId);
        node.toggleClass("current", id === currentId);
        node.toggleClass("selected", id === selectedId);
        const status = knownIds.has(id)
          ? "✓ "
          : id === currentId
            ? "Next · "
            : id === graph.goalId
              ? "Goal · "
              : "";
        node.data("displayLabel", `${status}${title}`);
      });
      cy.edges().forEach((edge) => {
        const from = edge.source().id();
        const to = edge.target().id();
        const prerequisite = edge.data("type") === "prereq";
        edge.removeClass("on-route completed");
        edge.toggleClass(
          "on-route",
          prerequisite && wholeRoute.has(from) && wholeRoute.has(to) && !knownIds.has(to),
        );
        edge.toggleClass("completed", prerequisite && knownIds.has(from) && knownIds.has(to));
      });
    });

    const selected = cy.getElementById(selectedId);
    if (selected.nonempty()) {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduceMotion) cy.center(selected);
      else cy.animate({ center: { eles: selected }, duration: 280 });
    }
  }, [currentId, goalId, graph, initialPath, known, path, selectedId, showFullMap]);

  const zoomBy = (factor: number) => {
    const cy = graphRef.current;
    if (!cy) return;
    const nextZoom = Math.min(cy.maxZoom(), Math.max(cy.minZoom(), cy.zoom() * factor));
    cy.zoom({ level: nextZoom, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
  };

  const fit = () => graphRef.current?.fit(undefined, 44);

  const handleKeyboard = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = Math.max(0, keyboardOrder.indexOf(selectedId));
    let nextIndex: number | undefined;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % keyboardOrder.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + keyboardOrder.length) % keyboardOrder.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = keyboardOrder.length - 1;
    } else if (event.key === "+" || event.key === "=") {
      zoomBy(1.18);
    } else if (event.key === "-") {
      zoomBy(0.85);
    } else if (event.key === "0") {
      fit();
    }
    if (nextIndex !== undefined) onSelect(keyboardOrder[nextIndex]);
    else if (!["+", "=", "-", "0"].includes(event.key)) return;
    event.preventDefault();
  };

  const selectedTitle = graph.concepts.find((concept) => concept.id === selectedId)?.title ?? selectedId;
  const visibleCount = showFullMap ? graph.concepts.length : initialPath.length;

  return (
    <div className={`graph-card ${showFullMap ? "is-full-map" : "is-guided-route"}`}>
      <div className="graph-toolbar">
        <div>
          <span className="graph-view-label">{showFullMap ? "FULL MAP · OPTIONAL VIEW" : "YOUR GUIDED ROUTE"}</span>
          <p>{showFullMap
            ? `All ${graph.concepts.length} concepts are visible. This view does not change your course.`
            : `These ${initialPath.length} concepts lead to your goal.`}</p>
        </div>
        <button
          className="view-toggle"
          type="button"
          onClick={() => setShowFullMap((current) => !current)}
          aria-pressed={showFullMap}
        >
          {showFullMap ? "Return to my route" : `Open full map (${graph.concepts.length})`}
        </button>
      </div>
      <div className="map-legend" aria-label="Graph legend">
        <span><i className="legend-line prerequisite" aria-hidden="true" /> Prerequisite</span>
        {showFullMap && <span><i className="legend-line related" aria-hidden="true" /> Related</span>}
        <span><i className="legend-node done" aria-hidden="true">✓</i> Understood</span>
        <span><i className="legend-node next" aria-hidden="true" /> Next</span>
        <span><i className="legend-node goal" aria-hidden="true" /> Goal</span>
      </div>
      <div
        className="graph-shell"
        role="group"
        aria-roledescription="interactive concept map"
        aria-label={`${showFullMap ? "Full concept map" : "Guided learning route"}, ${visibleCount} concepts. Selected: ${selectedTitle}.`}
        aria-describedby="graph-instructions graph-text-alternative"
        tabIndex={0}
        onKeyDown={handleKeyboard}
      >
        <p className="sr-only" id="graph-instructions">
          Use arrow keys to move between concepts. Press plus or minus to zoom and zero to fit the map.
          Use the route list after the map for a complete text alternative.
        </p>
        <div className="graph-viewport" ref={viewportRef} aria-hidden="true" />
        <div className="graph-controls" aria-label="Graph view controls">
          <button type="button" onClick={() => zoomBy(1.18)} aria-label="Zoom in">+</button>
          <button type="button" onClick={() => zoomBy(0.85)} aria-label="Zoom out">−</button>
          <button type="button" onClick={fit} aria-label="Fit visible concepts in view">Fit</button>
        </div>
      </div>
    </div>
  );
}
