/* eslint-disable jsdoc/require-jsdoc */
import type { CSSProperties } from "react";

/**
 * Available graph view modes surfaced by the trace2 traceability pages.
 *
 * The two original SVG/Cytoscape views (`lineage`, `tree`, `network`,
 * `radial`) live in trace2 itself; the advanced React Flow + ELK view,
 * the ECharts Sankey, and the tabular view are all rendered by
 * components from `@connectio/shared-reporting`.
 */
export type GraphViewMode =
  | "lineage"
  | "tree"
  | "network"
  | "radial"
  | "advanced"
  | "sankey"
  | "table";

interface Props {
  value: GraphViewMode;
  onChange: (next: GraphViewMode) => void;
  /**
   * Modes to surface.  Order is preserved in the UI.  When omitted, all
   * seven canonical modes are shown — pages that don't want a particular
   * one (e.g. BottomUp doesn't show the recall blast-radius radial view,
   * because that view only makes sense top-down from a focal batch) can
   * pass a filtered list to hide it.
   */
  modes?: GraphViewMode[];
  /** Optional override for translated labels (defaults to English). */
  labels?: Partial<Record<GraphViewMode, string>>;
}

const DEFAULT_LABELS: Record<GraphViewMode, string> = {
  lineage: "Lineage",
  tree: "Tree",
  network: "Network",
  radial: "Blast radius",
  advanced: "Advanced",
  sankey: "Sankey",
  table: "Table",
};

const DEFAULT_MODES: GraphViewMode[] = [
  "lineage",
  "tree",
  "network",
  "radial",
  "advanced",
  "sankey",
  "table",
];

/**
 * Segmented control matching the underlined-tab pattern used elsewhere in
 * trace2 (see `CustomersDeliveries` Customers/Deliveries tabs). Drives the
 * choice between the existing SVG `LineageGraph` and the `CytoscapeGraph`
 * modes (tree, network, radial).
 */
export function GraphViewToggle({ value, onChange, modes = DEFAULT_MODES, labels }: Props) {
  const merged: Record<GraphViewMode, string> = { ...DEFAULT_LABELS, ...labels };
  return (
    <div
      role="tablist"
      aria-label="Graph view"
      style={{
        display: "inline-flex",
        borderBottom: "1px solid var(--line)",
        marginBottom: 12,
      }}
    >
      {modes.map((id) => {
        const active = value === id;
        return (
          <button
            key={id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(id)}
            style={tabStyle(active)}
          >
            {merged[id]}
          </button>
        );
      })}
    </div>
  );
}

function tabStyle(active: boolean): CSSProperties {
  return {
    padding: "8px 16px",
    fontFamily: "var(--font-sans)",
    fontSize: 12.5,
    fontWeight: active ? 600 : 400,
    color: active ? "var(--brand)" : "var(--ink-3)",
    background: "transparent",
    border: "none",
    borderBottom: `2px solid ${active ? "var(--brand)" : "transparent"}`,
    marginBottom: -1,
    cursor: "pointer",
    letterSpacing: "0.02em",
  };
}
