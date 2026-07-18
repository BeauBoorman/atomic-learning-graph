import { useEffect, useMemo, useRef, useState } from "react";
import cytoscape from "cytoscape";
import dagre from "cytoscape-dagre";
import type { ConceptId, LearningGraph } from "../types";
import { titleFor } from "./titles";

cytoscape.use(dagre);

interface GraphMapProps {
  graph: LearningGraph;
  goalId: ConceptId;
  selectedId: ConceptId;
  currentId?: ConceptId;
  path: ConceptId[];
  initialPath: ConceptId[];
  covered: ConceptId[];
  theme: "light" | "dark";
  onSelect: (id: ConceptId) => void;
}

interface GraphMapKeyEvent {
  key: string;
  target: unknown;
  currentTarget: unknown;
}

type GraphMapKeyboardCommand =
  | { type: "select"; id: ConceptId }
  | { type: "zoom"; factor: number }
  | { type: "fit" }
  | { type: "stay"; id: ConceptId };

/**
 * Translate a key event owned by the map shell into a command. Key events from descendant
 * controls are deliberately ignored so their native Enter/Space activation is left intact.
 */
export function graphMapKeyboardCommand(
  event: GraphMapKeyEvent,
  keyboardOrder: ConceptId[],
  selectedId: ConceptId,
): GraphMapKeyboardCommand | null {
  if (event.target !== event.currentTarget) return null;

  const currentIndex = Math.max(0, keyboardOrder.indexOf(selectedId));
  if (event.key === "ArrowRight" || event.key === "ArrowDown") {
    return { type: "select", id: keyboardOrder[(currentIndex + 1) % keyboardOrder.length] };
  }
  if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    return {
      type: "select",
      id: keyboardOrder[(currentIndex - 1 + keyboardOrder.length) % keyboardOrder.length],
    };
  }
  if (event.key === "Home") return { type: "select", id: keyboardOrder[0] };
  if (event.key === "End") return { type: "select", id: keyboardOrder[keyboardOrder.length - 1] };
  if (event.key === "+" || event.key === "=") return { type: "zoom", factor: 1.18 };
  if (event.key === "-") return { type: "zoom", factor: 0.85 };
  if (event.key === "0") return { type: "fit" };
  if (event.key === "Enter" || event.key === " ") return { type: "stay", id: selectedId };
  return null;
}

/* Canvas cannot read a CSS custom property, so these are literals — and that is exactly why
   they drifted: styles.css was repainted to the paper+claret palette and this object was left
   on the old green/olive/orange, so the legend beside the map described colours the map did
   not draw. These MUST be kept in step with §4.1 by hand. The mapping is one-to-one with the
   legend swatches in styles.css, and it is the whole palette — three hues, no fourth:

     claret (--primary)      = you, your route, your action
     amber  (--mark)         = the goal, ringed in brass (--analogy-rule)
     warm grey (--line)      = everything else

   The old object had SEVEN hues, including `routeSoft` (olive) and `selected` (orange) as
   separate from `route` (green) — three colours for one idea. They collapse into `route`.
   Status is told apart by border WIDTH and the underlay, never by a new hue. */
const palette = {
  light: {
    surface: "#fffdf8",   // --surface
    text: "#22201b",      // --ink.        16.01 on --surface, 12.00 on goal amber
    border: "#8f8375",    // --line
    route: "#8c2f2a",     // --primary (claret)
    done: "#eae4d6",      // --surface-soft
    goal: "#f2dc9a",      // --mark (amber)
    goalBorder: "#c9a24a", // --analogy-rule (brass)
  },
  dark: {
    surface: "#1d1a15",
    text: "#f2ece1",      // 14.75 on --surface, 6.86 on goal amber
    border: "#7a7062",
    route: "#e79a86",     // terracotta — claret's dark-theme voice
    done: "#282419",
    goal: "#6a4a16",
    goalBorder: "#b08a3c",
  },
} as const;

const LABEL_FONT_SIZE = 15;
const MIN_RENDERED_LABEL_SIZE = 10;
/* A floor for AUTOMATIC fits only — never a cap on what the learner may do; they can still zoom
   out past it deliberately (see minZoom). It used to carry a second, quieter job: minZoom was
   pinned to it, which made `LABEL_FONT_SIZE * zoom >= 10` true BY CONSTRUCTION and the old probe
   unfalsifiable. That probe is gone, so this is just a floor again. It should also stop binding
   in practice now that the map is summoned into a viewport-sized plate and both views rank
   top-to-bottom: at 10 nodes a fit lands near 1.0 and never reaches down here. */
const LEGIBLE_ZOOM_FLOOR = 0.72;
const GUIDED_FIT_PADDING = 32;
const FULL_MAP_FIT_PADDING = 44;

/* The box is sized to the text (`width: "label"`), so a label can no longer overflow it by
   construction. This records that fact rather than asserting it: the difference between the
   node's bounding box WITH labels and WITHOUT is the number of pixels the label sticks out.
   > 0 means clipped.

   It replaces `renderedLabelSize = LABEL_FONT_SIZE * cy.zoom()`, which was a probe that COULD
   NOT FAIL: font-size times zoom is mathematically invariant to clipping, so it reported a
   healthy 15.7 for the symmetrically-clipped "xt . Vect" a human found on screen. Nothing read
   the value; it only ever reassured.

   VERIFIED CAVEAT — this is meaningful in a browser ONLY. Headless Cytoscape has no canvas, so
   `measureText` never runs, `rstyle.labelWidth` is never populated (cytoscape.cjs.js:12068 —
   `width: "label"` returns `_p.rstyle.labelWidth || 0`) and BOTH boxes come back identical.
   A headless test asserting `withLabel <= box` therefore reduces to `0 <= 0` and passes for a
   grossly overflowing label. Do not write one. That is the same trap, rebuilt. */
function recordLabelFit(cy: cytoscape.Core): void {
  const container = cy.container();
  if (!container) return;
  container.dataset.mapZoom = cy.zoom().toFixed(3);
  let overflow = 0;
  cy.nodes().forEach((node) => {
    const withLabel = node.boundingBox({ includeLabels: true }).w;
    const box = node.boundingBox({ includeLabels: false }).w;
    overflow = Math.max(overflow, withLabel - box);
  });
  container.dataset.labelOverflow = overflow.toFixed(1);
}

function fitAtLegibleZoom(cy: cytoscape.Core, padding: number): void {
  cy.fit(undefined, padding);
  if (cy.zoom() < LEGIBLE_ZOOM_FLOOR) cy.zoom(LEGIBLE_ZOOM_FLOOR);
  cy.center();
  recordLabelFit(cy);
}

/** The label wraps at this width; the node is then sized to the wrapped text plus NODE_PADDING
 *  on every side. One number decides how wide a node is — there is no second number to disagree
 *  with it. */
const LABEL_MAX_WIDTH = 200;
const NODE_PADDING = 14;

/** Exported for GraphMap.test.tsx, which feeds it to Cytoscape's real parser. Cytoscape rejects
 *  an illegal property value SILENTLY — it warns to the console and falls back to the default —
 *  so the only way to know a style took is to ask the parser what it kept. */
export function stylesFor(
  theme: "light" | "dark",
  reduceMotion = false,
  showFullMap = false,
): cytoscape.StylesheetJson {
  const color = palette[theme];
  return [
    {
      selector: "node",
      style: {
        /* THE CLIP FIX. The box is sized to the text; the text is never sized to the box.
           Verified in cytoscape@3.34.0: `width: "label"` resolves through
           `recalculateRenderedStyle()` to `rstyle.labelWidth` (cytoscape.cjs.js:12068), so the
           node is exactly as wide as its wrapped label, and `outerWidth()` adds the border and
           2 * padding around it. A label cannot overflow a box that is defined as its own size.

           This replaces a fixed 184/440px box with a `text-max-width` computed from it — which
           had SPLIT BRAINS: a string "400px" in the stylesheet and a bare number 400 written
           inline by the layout pass, and the inline one silently outranked the stylesheet
           forever. That pairing is what clipped "Next · Vectors" (14 chars) symmetrically into
           "xt · Vect" inside a box that was wide and mostly EMPTY — the giveaway that this was
           never a space problem.

           `width: "label"` logs a deprecation warning in 3.34.0 (cytoscape.cjs.js:18751) but is
           the only mechanism that reads labelWidth, has no replacement in this version, and
           works. Two warnings per stylesheet parse, not per node — the parse is cached. */
        width: "label",
        height: "label",
        // px strings, not bare numbers: cytoscape parses both to the same pfValue (verified by
        // execution), but its own TypeScript types accept only strings here. ONE constant feeds
        // each, so the string/number split-brain that let an inline `400` outrank a stylesheet
        // `"400px"` has nowhere to come back from.
        padding: `${NODE_PADDING}px`,
        "text-max-width": `${LABEL_MAX_WIDTH}px`,
        "text-wrap": "wrap",
        // Wrap on WHITESPACE (cytoscape's default), not "anywhere". "anywhere" breaks at any
        // character on every line, which rendered real titles as "Vectors as fixed-length list /
        // s" and "Multiply matching values, t / hen add" — mid-word breaks that read as broken.
        // The guard it replaced was defending against a word longer than text-max-width escaping
        // the node, which cannot happen here: `width: "label"` sizes the node TO its label, so an
        // over-long word widens the box instead of overflowing it. Longest word in the real
        // corpus is "probabilities" (~104px) against a 200px cap.
        "text-overflow-wrap": "whitespace",
        shape: "round-rectangle",
        "background-color": color.surface,
        "border-color": color.border,
        "border-width": 1.5,
        label: "data(displayLabel)",
        color: color.text,
        /* A LITERAL stack and a LEGAL weight, and both halves matter.

           `ctx.font` is a CSS-font-shorthand parse in the canvas: `ui-sans-serif` and the
           absent `Inter` are not names it can resolve, and a font string that fails to parse
           makes `measureText` lie — which `width: "label"` above would then inherit. The font
           string has to be fixed BEFORE the box can be sized from it.

           `font-weight: 650` was VERIFIED INVALID by execution, not by reading: cytoscape's
           fontWeight is enum-only (cytoscape.cjs.js:17414) and 650 is not a member, so it warns
           "The style property `font-weight: 650` is invalid" and falls back to the default
           `normal` (:18473) — for the MEASURING font and the DRAWING font alike. The change
           that raised 600 -> 650 to get bolder type shipped weight 400 instead.
           Note the enum's trap: the number 700 is a member, the string "700" is not. */
        "font-family": "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif",
        "font-size": LABEL_FONT_SIZE,
        "font-weight": 600,
        "min-zoomed-font-size": MIN_RENDERED_LABEL_SIZE,
        "text-valign": "center",
        "text-halign": "center",
        "overlay-opacity": 0,
        "transition-property": "background-color, border-color, border-width, opacity, underlay-opacity",
        "transition-duration": reduceMotion ? 0 : 180,
      },
    },
    {
      selector: "edge",
      style: {
        width: 1.5,
        "line-color": color.border,
        "target-arrow-color": color.border,
        "target-arrow-shape": "none",
        "curve-style": "bezier",
        opacity: 0.55,
        "overlay-opacity": 0,
        "transition-property": "line-color, target-arrow-color, width, opacity",
        "transition-duration": reduceMotion ? 0 : 180,
      },
    },
    {
      selector: "edge[type = 'prereq']",
      style: {
        "line-color": color.border,
        "target-arrow-color": color.border,
        "target-arrow-shape": "triangle",
        "arrow-scale": 0.8,
        /* Taxi edges follow the rank axis, so this tracks rankDir above. It said "rightward"
           because the full map used to run left-to-right; both views run TOP-TO-BOTTOM now, and
           a rightward taxi edge in a downward layout draws right-angle detours around the
           nodes it is supposed to connect. */
        "curve-style": showFullMap ? "taxi" : "straight",
        "taxi-direction": "downward",
        "taxi-turn": showFullMap ? 20 : 12,
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
    // Your route, ahead of you: claret at full strength. The legend's solid claret line is
    // this, and nothing else — which is why that key says "Your route" and not "Prerequisite".
    {
      selector: "edge.on-route",
      style: {
        "line-color": color.route,
        "target-arrow-color": color.route,
        width: 3.5,
        opacity: 1,
      },
    },
    {
      selector: "node.covered",
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
    // The one place amber appears on the map. Matches .legend-swatch.goal exactly
    // (border --analogy-rule, background --mark) — the key and the map are one palette.
    {
      selector: "node.goal",
      style: {
        "background-color": color.goal,
        "border-color": color.goalBorder,
        "border-width": 3,
      },
    },
    /* `current` and `selected` used to be a fourth and fifth hue (orange). They are the same
       claret as the route now, and they are told apart the way §4.6 requires — by border WIDTH
       and the underlay, never by inventing a colour. Status is carried by the drawing and the
       key; it is never spelled into the label. */
    {
      selector: "node.current",
      style: {
        "border-color": color.route,
        "border-width": 4,
        "underlay-color": color.route,
        "underlay-opacity": 0.2,
        "underlay-padding": 8,
      },
    },
    {
      selector: "node.selected",
      style: {
        "border-color": color.route,
        "border-width": 4,
        "underlay-color": color.route,
        "underlay-opacity": 0.14,
        "underlay-padding": 7,
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
  covered,
  theme,
  onSelect,
}: GraphMapProps) {
  /* THE ONE NAME FOR EACH THING. Every place this file names a concept goes through here — the
     node label, the group's aria-label, the sr-only route list — so the map can never say
     "Vectors" while the lesson two feet above it says "Vectors as Fixed-Length Lists". That
     split was live: `concept.title` is the textbook's Title Case, and it was rendered straight
     onto the nodes while the lesson rendered the plain-English title. titles.ts exists exactly
     for this and its own docstring names the map node label as a call site. */
  const nameOf = (id: ConceptId): string => {
    const concept = graph.concepts.find((candidate) => candidate.id === id);
    return concept ? titleFor(concept) : id;
  };

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
        // Sorted by the name the learner can actually SEE, not the textbook's.
        .filter((concept) => !routeIds.has(concept.id))
        .sort((a, b) => titleFor(a).localeCompare(titleFor(b)))
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
        data: { id: concept.id, displayLabel: titleFor(concept) },
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
      style: stylesFor(theme, reduceMotion, showFullMap),
      // Automatic fits stop at LEGIBLE_ZOOM_FLOOR (see fitAtLegibleZoom), but the learner may
      // still zoom OUT past it deliberately to take in the whole map. Pinning minZoom to the
      // legibility floor made that impossible and made the recorded label size true by
      // construction rather than measured.
      minZoom: 0.45,
      maxZoom: 2.25,
      wheelSensitivity: 0.18,
      boxSelectionEnabled: false,
    });

    cy.elements()
      .filter((element) => element.isNode() || element.data("type") === "prereq")
      .layout({
        name: "dagre",
        /* BOTH VIEWS FLOW TOP-TO-BOTTOM, and the full map's "LR" is not a taste call being
           overturned — it generated a shape that could not be fitted. Measured against the real
           data/graph.json, not assumed: the DAG is 6 ranks deep and never more than 2 nodes
           wide. Laid out LR that is a ~9:1 horizontal ribbon, so `fit` needed ~0.28 zoom and was
           clamped by the legibility floor to 0.72 — the route rendered as an unreadable smudge
           running off both sides. Turned TB, the same graph is ~2 nodes wide by 6 deep: bound on
           the axis the plate has most of, and readable at 1.0.

           It also means the two views no longer transpose the world when you toggle between
           them. Down is forward, in both. */
        rankDir: "TB",
        nodeSep: showFullMap ? 42 : 24,
        rankSep: showFullMap ? 64 : 34,
        edgeSep: 18,
        ranker: "tight-tree",
        // The nodes are sized BY their labels now, so the space a node takes up is the space its
        // text takes up. Without this dagre would rank them by outerWidth and disagree.
        nodeDimensionsIncludeLabels: true,
        fit: false,
        animate: false,
      } as unknown as cytoscape.LayoutOptions)
      .run();

    fitAtLegibleZoom(cy, showFullMap ? FULL_MAP_FIT_PADDING : GUIDED_FIT_PADDING);

    // Tap SELECTS and keeps the map open. In Cytoscape a tap fires on pointerup even when the
    // gesture was a pan, and this map is meant to be panned — fusing select and activate here
    // would mean a mouse user can never look at a node without committing to it. The keyboard
    // path is equally restrained: arrows select; Enter and Space keep that selection in place.
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
    // let the learner zoom deliberately. Re-fit ONLY: re-running dagre on every resize frame
    // would relayout the graph under the learner mid-drag.
    const resizeObserver = new ResizeObserver(() => {
      cy.resize();
      fitAtLegibleZoom(cy, showFullMap ? FULL_MAP_FIT_PADDING : GUIDED_FIT_PADDING);
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
    const cy = graphRef.current;
    if (!cy) return;
    cy.style(stylesFor(theme, reduceMotion, showFullMap));
    fitAtLegibleZoom(cy, showFullMap ? FULL_MAP_FIT_PADDING : GUIDED_FIT_PADDING);
  }, [showFullMap, theme]);

  useEffect(() => {
    const cy = graphRef.current;
    if (!cy) return;

    const remaining = new Set(path);
    const wholeRoute = new Set(initialPath);
    const coveredIds = new Set(covered);
    /* STATUS IS NEVER TEXT. There was a ternary here that prefixed "✓ ", "Next · " or "Goal · "
       onto the label and rewrote `displayLabel` on every progress change. That prefix is what
       manufactured the clip the owner saw: "Vectors" is 7 characters and fits; "Next · Vectors"
       is 14 and did not — which is why "Dot Product" looked fine on the same screen. The label
       grew for reasons that had nothing to do with the label.

       It was also saying the same thing three times: the node is already ringed claret with an
       underlay when it is current, filled amber when it is the goal, and filled soft when it is
       covered — and the key beside the map spells all three out. The status prefix was a
       fourth channel that only cost the label its room. The sr-only route list below still
       states every status in words, so nothing is lost for a screen reader. */
    cy.batch(() => {
      cy.nodes().forEach((node) => {
        const id = node.id();
        node.removeClass("on-route covered goal current selected");
        node.toggleClass("on-route", remaining.has(id));
        node.toggleClass("covered", coveredIds.has(id));
        node.toggleClass("goal", id === goalId);
        node.toggleClass("current", id === currentId);
        node.toggleClass("selected", id === selectedId);
      });
      cy.edges().forEach((edge) => {
        const from = edge.source().id();
        const to = edge.target().id();
        const prerequisite = edge.data("type") === "prereq";
        edge.removeClass("on-route completed");
        edge.toggleClass(
          "on-route",
          prerequisite && wholeRoute.has(from) && wholeRoute.has(to) && !coveredIds.has(to),
        );
        edge.toggleClass("completed", prerequisite && coveredIds.has(from) && coveredIds.has(to));
      });
    });

    // Every guided node already fits at a readable size. Keep the whole route centered instead
    // of panning it away when selection changes; selection-centering is useful only in the full DAG.
    if (!showFullMap) {
      fitAtLegibleZoom(cy, GUIDED_FIT_PADDING);
      return;
    }

    const selected = cy.getElementById(selectedId);
    if (selected.nonempty()) {
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduceMotion) cy.center(selected);
      else cy.animate({ center: { eles: selected }, duration: 280 });
    }
    /* `graph` IS LOAD-BEARING HERE AND IT DOES NOT LOOK IT — do not let a linter remove it.
       Deleting the status ternary took away this effect's last direct READ of `graph`, so it now
       reads nothing from it. It stays because it is the proxy for "the Cytoscape core was
       rebuilt": the mount effect above keys on [graph, initialPath, showFullMap] and throws the
       old core away. If a new graph arrived while path/covered/selectedId kept their identities,
       this effect would not re-run and the fresh nodes would carry NO classes at all — no route,
       no goal, no current. An unstyled map, from an "unused" dependency. */
  }, [covered, currentId, goalId, graph, initialPath, path, selectedId, showFullMap]);

  const zoomBy = (factor: number) => {
    const cy = graphRef.current;
    if (!cy) return;
    const nextZoom = Math.min(cy.maxZoom(), Math.max(cy.minZoom(), cy.zoom() * factor));
    cy.zoom({ level: nextZoom, renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 } });
    recordLabelFit(cy);
  };

  const fit = () => {
    const cy = graphRef.current;
    if (!cy) return;
    fitAtLegibleZoom(cy, showFullMap ? FULL_MAP_FIT_PADDING : GUIDED_FIT_PADDING);
  };

  const handleKeyboard = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const command = graphMapKeyboardCommand(event, keyboardOrder, selectedId);
    if (!command) return;

    if (command.type === "select") onSelect(command.id);
    else if (command.type === "zoom") zoomBy(command.factor);
    else if (command.type === "fit") fit();
    // "stay" deliberately changes neither the lesson nor the dialog state.
    event.preventDefault();
  };

  const selectedTitle = nameOf(selectedId);
  const visibleCount = showFullMap ? graph.concepts.length : initialPath.length;
  const textAlternativeIds = showFullMap ? keyboardOrder : initialPath;
  const coveredIds = new Set(covered);

  return (
    // `is-full-map` / `is-guided-route` are gone with the two hardcoded heights that were their
    // only consumers. They styled nothing, and `showFullMap` is already in hand for anything
    // that needs the distinction.
    <div className="graph-card">
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
      {/* THE KEY IS GATED ON THE DATA, NEVER ON THE VIEW. The dashed key was shown whenever the
          full map was open — but data/graph.json holds 9 edges and all 9 are `prereq`, so the
          map advertised a key for a line it is incapable of drawing, on a product whose entire
          claim is that nothing on screen is invented. Gate it on the edges that exist and it
          simply appears the day a side quest does.
          "Prerequisite" -> "Your route": the solid claret line is drawn for `.on-route` edges
          only. Off-route prerequisite links are warm grey, so a claret swatch labelled
          "Prerequisite" described a colour the full map does not use for that idea. */}
      <div className="map-legend">
        <strong className="map-key-label">Key</strong>
        <span><i className="legend-line prerequisite" aria-hidden="true" /> Your route</span>
        {graph.edges.some((edge) => edge.type === "related") && (
          <span><i className="legend-line related" aria-hidden="true" /> Side quest</span>
        )}
        <span><i className="legend-swatch covered" aria-hidden="true" /> Covered</span>
        <span><i className="legend-swatch next" aria-hidden="true" /> Next</span>
        <span><i className="legend-swatch goal" aria-hidden="true" /> Goal</span>
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
          Enter and Space keep the selected concept highlighted without leaving the map.
          Use the route list after the map for a complete text alternative.
        </p>
        <div className="graph-viewport" ref={viewportRef} aria-hidden="true" />
        <div className="graph-controls">
          <button type="button" onClick={() => zoomBy(1.18)} aria-label="Zoom in">+</button>
          <button type="button" onClick={() => zoomBy(0.85)} aria-label="Zoom out">−</button>
          <button type="button" onClick={fit} aria-label="Fit visible concepts in view">Fit</button>
        </div>
      </div>
      <ol className="sr-only" id="graph-text-alternative">
        {textAlternativeIds.map((id, index) => {
          const title = nameOf(id);
          const status = coveredIds.has(id)
            ? "covered"
            : id === currentId
              ? "next step"
              : id === goalId
                ? "goal"
                : "not started";
          return <li key={id}>Step {index + 1}: {title}, {status}.</li>;
        })}
      </ol>
    </div>
  );
}
