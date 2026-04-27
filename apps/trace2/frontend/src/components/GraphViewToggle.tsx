import type { CSSProperties } from "react";

export type GraphViewMode = "lineage" | "tree" | "network";

interface Props {
  value: GraphViewMode;
  onChange: (next: GraphViewMode) => void;
  /** Optional override for translated labels (defaults to English). */
  labels?: Record<GraphViewMode, string>;
}

const DEFAULT_LABELS: Record<GraphViewMode, string> = {
  lineage: "Lineage",
  tree: "Tree",
  network: "Network",
};

/**
 * 3-way segmented control matching the underlined-tab pattern used elsewhere
 * in trace2 (see `CustomersDeliveries` Customers/Deliveries tabs). Drives the
 * choice between the existing SVG `LineageGraph` and the two new
 * `CytoscapeGraph` modes.
 */
export function GraphViewToggle({ value, onChange, labels = DEFAULT_LABELS }: Props) {
  const order: GraphViewMode[] = ["lineage", "tree", "network"];
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
      {order.map((id) => {
        const active = value === id;
        return (
          <button
            key={id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(id)}
            style={tabStyle(active)}
          >
            {labels[id]}
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
