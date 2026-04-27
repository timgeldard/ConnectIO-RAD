import { useEffect, useMemo, useRef } from "react";
import cytoscape, { type Core, type EdgeDefinition, type ElementDefinition, type NodeDefinition } from "cytoscape";
import coseBilkent from "cytoscape-cose-bilkent";
import type { FocalNode, LineageNode, LinkType } from "../types";
import { fmtN } from "../ui";

// Register cose-bilkent extension once at module load. React StrictMode
// double-mounts components; doing this inside an effect or in the constructor
// would emit "extension already registered" warnings.
let _coseBilkentRegistered = false;
if (!_coseBilkentRegistered) {
  cytoscape.use(coseBilkent as unknown as cytoscape.Ext);
  _coseBilkentRegistered = true;
}

export type CytoscapeMode = "tree" | "network";

interface Props {
  focal: FocalNode;
  upstream: LineageNode[];
  downstream: LineageNode[];
  mode: CytoscapeMode;
  selectedId?: string;
  /** Called with the full node when the user taps it; focal carries `kind`. */
  onNodeClick?: (node: FocalNode | LineageNode) => void;
  sim?: boolean;
}

const LINK_COLOR: Record<LinkType, string> = {
  RECEIPT: "#289BA2",
  CONSUMPTION: "#F9C20A",
  INTERNAL: "#8A9E6A",
  SALES_ORDER: "#005776",
};

const LINK_DASHED: Record<LinkType, boolean> = {
  RECEIPT: false,
  CONSUMPTION: true,
  INTERNAL: true,
  SALES_ORDER: false,
};

/** Bounded log scale so a 100,000 unit edge doesn't drown out a 100 unit edge. */
function edgeWidth(qty: number): number {
  return Math.max(1, Math.min(5, Math.log10(Math.max(qty, 0) + 1) * 1.4));
}

interface BuildResult {
  elements: ElementDefinition[];
  /** Map child id → parent lineage-node ids, used for tree collapse traversal. */
  childrenById: Record<string, string[]>;
}

function buildElements(
  focal: FocalNode,
  upstream: LineageNode[],
  downstream: LineageNode[],
  mode: CytoscapeMode,
  sim: boolean,
): BuildResult {
  const seen = new Set<string>([focal.id]);
  const upFiltered = upstream.filter((n) => n.id !== focal.id);
  const dnFiltered = downstream.filter((n) => n.id !== focal.id);

  const usePlantParents = mode === "network";
  const plants = new Set<string>();
  if (usePlantParents) {
    if (focal.plant) plants.add(focal.plant);
    for (const n of [...upFiltered, ...dnFiltered]) {
      if (n.plant) plants.add(n.plant);
    }
  }

  const plantParentNodes: NodeDefinition[] = usePlantParents
    ? Array.from(plants).map((p) => ({
        data: { id: `plant::${p}`, label: p, kind: "plant" },
        classes: "plant-cluster",
      }))
    : [];

  const focalNode: NodeDefinition = {
    data: {
      id: focal.id,
      label: focal.material,
      sub: `${focal.batch_id} · ${focal.material_id}`,
      qty: `${fmtN(focal.qty, 1)} ${focal.uom}`,
      plant: focal.plant,
      kind: "focal",
      ...(usePlantParents && focal.plant ? { parent: `plant::${focal.plant}` } : {}),
    },
    classes: "focal",
  };

  const lineageNodes: NodeDefinition[] = [];
  const edgeDefs: EdgeDefinition[] = [];
  const childrenById: Record<string, string[]> = {};

  const addLineageNode = (n: LineageNode, side: "up" | "down") => {
    if (seen.has(n.id)) return;
    seen.add(n.id);
    lineageNodes.push({
      data: {
        id: n.id,
        label: n.material,
        sub: `${n.batch} · ${n.material_id}`,
        qty: `${fmtN(n.qty, 1)} ${n.uom}`,
        plant: n.plant,
        link: n.link,
        level: n.level,
        side,
        kind: "lineage",
        ...(usePlantParents && n.plant ? { parent: `plant::${n.plant}` } : {}),
      },
      classes: `${side} ${sim ? "sim" : ""}`.trim(),
    });
  };

  const addEdge = (source: string, target: string, link: LinkType, qty: number) => {
    edgeDefs.push({
      data: {
        id: `${source}->${target}`,
        source,
        target,
        link,
        qty,
        width: edgeWidth(qty),
      },
      classes: link,
    });
    (childrenById[source] = childrenById[source] || []).push(target);
  };

  // Upstream edges flow child → parent (raw → product)
  for (const n of upFiltered) {
    addLineageNode(n, "up");
    addEdge(n.id, n.parent, n.link, n.qty);
  }
  // Downstream edges flow parent → child (product → customer)
  for (const n of dnFiltered) {
    addLineageNode(n, "down");
    addEdge(n.parent, n.id, n.link, n.qty);
  }

  return {
    elements: [...plantParentNodes, focalNode, ...lineageNodes, ...edgeDefs],
    childrenById,
  };
}

function styleSheet(): cytoscape.StylesheetCSS[] {
  return [
    {
      selector: "node[kind = 'focal']",
      css: {
        "background-color": "#003C52",
        "border-color": "#002A3A",
        "border-width": 2,
        color: "#FBF8F1",
        "text-outline-color": "#003C52",
        "text-outline-width": 2,
        label: "data(label)",
        "font-family": "var(--font-sans, system-ui)",
        "font-size": 11,
        "font-weight": 600,
        "text-valign": "center",
        "text-halign": "center",
        "text-wrap": "ellipsis",
        "text-max-width": "120px",
        width: 92,
        height: 56,
        shape: "round-rectangle",
      },
    },
    {
      selector: "node.up",
      css: {
        "background-color": "#E3EEF3",
        "border-color": "#A4CFD8",
        "border-width": 1,
        color: "#143700",
        label: "data(label)",
        "font-family": "var(--font-sans, system-ui)",
        "font-size": 10,
        "text-valign": "center",
        "text-halign": "center",
        "text-wrap": "ellipsis",
        "text-max-width": "100px",
        width: 78,
        height: 44,
        shape: "round-rectangle",
      },
    },
    {
      selector: "node.down",
      css: {
        "background-color": "#F1F1E5",
        "border-color": "#C8D8C0",
        "border-width": 1,
        color: "#143700",
        label: "data(label)",
        "font-family": "var(--font-sans, system-ui)",
        "font-size": 10,
        "text-valign": "center",
        "text-halign": "center",
        "text-wrap": "ellipsis",
        "text-max-width": "100px",
        width: 78,
        height: 44,
        shape: "round-rectangle",
      },
    },
    {
      selector: "node.down.sim",
      css: { "background-color": "#FDE5D9", "border-color": "#F24A00" },
    },
    {
      selector: "node[kind = 'plant']",
      css: {
        "background-color": "#FBF8F1",
        "background-opacity": 0.55,
        "border-color": "#C8D8C0",
        "border-width": 1,
        "border-style": "dashed",
        "padding-top": "12px",
        "padding-bottom": "12px",
        "padding-left": "12px",
        "padding-right": "12px",
        label: "data(label)",
        "font-family": "var(--font-mono, monospace)",
        "font-size": 9.5,
        color: "#5C6E45",
        "text-valign": "top",
        "text-halign": "center",
        "text-margin-y": -4,
        shape: "round-rectangle",
      },
    },
    {
      selector: "node.collapsed",
      css: { "border-style": "double", "border-width": 3, "border-color": "#005776" },
    },
    {
      selector: "node.selected",
      css: { "border-color": "#F24A00", "border-width": 3 },
    },
    {
      selector: "node.hidden",
      css: { display: "none" },
    },
    {
      selector: "edge",
      css: {
        "curve-style": "bezier",
        width: "data(width)",
        "line-color": "#C8D8C0",
        "target-arrow-color": "#C8D8C0",
        "target-arrow-shape": "triangle",
        "arrow-scale": 0.9,
        opacity: 0.85,
      },
    },
    ...((Object.keys(LINK_COLOR) as LinkType[]).map((lt) => ({
      selector: `edge.${lt}`,
      css: {
        "line-color": LINK_COLOR[lt],
        "target-arrow-color": LINK_COLOR[lt],
        ...(LINK_DASHED[lt] ? { "line-style": "dashed", "line-dash-pattern": [6, 3] } : {}),
      },
    })) as cytoscape.StylesheetCSS[]),
    {
      selector: "edge.dim",
      css: { opacity: 0.15 },
    },
    {
      selector: "edge.hidden",
      css: { display: "none" },
    },
  ];
}

/**
 * Cytoscape-driven view of a batch lineage. Holds a single `cy` instance for
 * the component's lifetime; mode changes only trigger a layout re-run (per the
 * advisor's note) — destroying and recreating cy on every mode switch caused
 * container-measuring flicker during prototyping.
 *
 * Tree mode uses `breadthfirst` rooted at the focal node and lets the user
 * tap any non-focal node to collapse/expand its subtree. Network mode uses
 * `cose-bilkent` with synthetic plant compound nodes so plants visually
 * cluster.
 *
 * Selection is controlled by the parent (`selectedId` in, `onNodeClick` out)
 * to keep the SVG `LineageGraph` and this view in sync from a single source
 * of truth in the page.
 */
export function CytoscapeGraph({
  focal,
  upstream,
  downstream,
  mode,
  selectedId,
  onNodeClick,
  sim = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const onNodeClickRef = useRef(onNodeClick);
  const collapsedIdsRef = useRef<Set<string>>(new Set());
  const onNodeClickHandlerRef = useRef<((evt: cytoscape.EventObject) => void) | null>(null);

  useEffect(() => {
    onNodeClickRef.current = onNodeClick;
  }, [onNodeClick]);

  // Build elements + child map fresh whenever the lineage / mode / sim flag
  // changes. Memoised so React can short-circuit equality on re-renders that
  // don't change the inputs (the parent passes new arrays only on data fetch).
  const { elements, childrenById } = useMemo(
    () => buildElements(focal, upstream, downstream, mode, sim),
    [focal, upstream, downstream, mode, sim],
  );

  // Pull a stable lookup of the original LineageNode/FocalNode objects so the
  // tap handler can pass the parent the full record (matches LineageGraph's
  // `onNodeClick` contract verbatim).
  const nodeIndex = useMemo(() => {
    const idx: Record<string, FocalNode | LineageNode> = { [focal.id]: focal };
    for (const n of upstream) idx[n.id] = n;
    for (const n of downstream) idx[n.id] = n;
    return idx;
  }, [focal, upstream, downstream]);

  // Mount once; we never rebuild cy across the component's lifetime
  useEffect(() => {
    if (!containerRef.current) return;
    const cy = cytoscape({
      container: containerRef.current,
      elements: [],
      style: styleSheet(),
      wheelSensitivity: 0.2,
      maxZoom: 3,
      minZoom: 0.2,
    });
    cyRef.current = cy;

    return () => {
      cy.removeAllListeners();
      cy.destroy();
      cyRef.current = null;
    };
  }, []);

  // Sync elements + layout whenever data/mode changes. Keeps cy alive but
  // swaps its element set, then runs the appropriate layout.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.elements().remove();
    cy.add(elements);
    collapsedIdsRef.current = new Set();
    runLayout(cy, mode, focal.id);
  }, [elements, mode, focal.id]);

  // Tap handler — register once, read latest callback through a ref so we
  // don't re-bind on every parent re-render
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    const handler = (evt: cytoscape.EventObject) => {
      const node = evt.target;
      const kind = node.data("kind");
      if (kind === "plant") return;
      const id = node.id();

      // In tree mode, non-focal taps toggle subtree visibility
      if (mode === "tree" && kind !== "focal") {
        const collapsed = collapsedIdsRef.current;
        if (collapsed.has(id)) {
          collapsed.delete(id);
        } else {
          collapsed.add(id);
        }
        applyCollapsedState(cy, childrenById, collapsed);
        runLayout(cy, "tree", focal.id);
      }

      const original = nodeIndex[id];
      if (original && onNodeClickRef.current) {
        onNodeClickRef.current(original);
      }
    };

    onNodeClickHandlerRef.current = handler;
    cy.on("tap", "node", handler);
    return () => {
      cy.off("tap", "node", handler);
    };
  }, [mode, focal.id, childrenById, nodeIndex]);

  // Keep selection class in lockstep with the parent's `selectedId`.
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.nodes().removeClass("selected");
    if (selectedId) {
      const target = cy.getElementById(selectedId);
      if (target.nonempty()) target.addClass("selected");
    }
  }, [selectedId, elements]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: 560,
        background: "var(--paper)",
        border: "1px solid var(--line)",
        borderRadius: 4,
        overflow: "hidden",
      }}
    />
  );
}

function runLayout(cy: Core, mode: CytoscapeMode, focalId: string): void {
  if (mode === "tree") {
    cy.layout({
      name: "breadthfirst",
      directed: true,
      roots: `#${escapeSelector(focalId)}`,
      padding: 24,
      spacingFactor: 1.2,
      animate: false,
    } as cytoscape.LayoutOptions).run();
  } else {
    cy.layout({
      name: "cose-bilkent",
      // Tuning chosen so plant clusters stay visually distinct without
      // losing the focal node in a wide swirl
      idealEdgeLength: 110,
      nodeRepulsion: 6500,
      edgeElasticity: 0.45,
      nestingFactor: 0.1,
      gravity: 0.3,
      gravityRangeCompound: 1.5,
      gravityCompound: 1.0,
      numIter: 2500,
      tile: true,
      animate: "end",
      animationDuration: 600,
      randomize: true,
      padding: 24,
    } as unknown as cytoscape.LayoutOptions).run();
  }
}

function applyCollapsedState(
  cy: Core,
  childrenById: Record<string, string[]>,
  collapsed: Set<string>,
): void {
  cy.elements().removeClass("hidden");
  if (collapsed.size === 0) return;
  const hidden = new Set<string>();
  for (const root of collapsed) {
    const stack = [...(childrenById[root] ?? [])];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (hidden.has(id)) continue;
      hidden.add(id);
      const next = childrenById[id];
      if (next) stack.push(...next);
    }
  }
  for (const id of hidden) {
    const ele = cy.getElementById(id);
    if (ele.nonempty()) ele.addClass("hidden");
  }
  // Hide edges touching hidden nodes
  cy.edges().forEach((e) => {
    if (hidden.has(e.source().id()) || hidden.has(e.target().id())) {
      e.addClass("hidden");
    }
  });
}

function escapeSelector(id: string): string {
  // Cytoscape selectors are CSS-like; escape special chars in node ids
  return id.replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, "\\$1");
}
