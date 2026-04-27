import type { CSSProperties } from "react";

export type GraphViewMode = "lineage" | "tree" | "network" | "radial";

interface Props {
  value: GraphViewMode;
  onChange: (next: GraphViewMode) => void;
  /**
   * Modes to surface. Order is preserved in the UI. Defaults to all four
   * — pages that don't want a particular mode (e.g. BottomUp doesn't show
   * the recall blast-radius radial view) can omit it from this list.
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
};

const DEFAULT_MODES: GraphViewMode[] = ["lineage", "tree", "network", "radial"];

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
