import { useState } from "react";
import type { Batch, LineageNode } from "../types";
import { fetchBottomUp, focalFromBatch } from "../data/api";
import { useBatchData } from "../data/useBatchData";
import { LoadFrame, EmptyBlock } from "../components/LoadFrame";
import { LineageGraph } from "../components/LineageGraph";
import { Card, DataTable, KPI, SectionHeader, StatusPill, fmtN } from "../ui";

export function PageBottomUp({ batch: headerBatch }: { batch: Batch }) {
  const state = useBatchData(fetchBottomUp, headerBatch.material_id, headerBatch.batch_id);
  return (
    <LoadFrame
      state={state}
      eyebrow="02 — BOTTOM-UP TRACEABILITY"
      loadingTitle="Loading upstream lineage…"
      loadingSubtitle={`Material ${headerBatch.material_id} · Batch ${headerBatch.batch_id}`}
    >
      {({ batch, lineage }) => <BottomUpBody batch={batch} lineage={lineage} />}
    </LoadFrame>
  );
}

function BottomUpBody({ batch, lineage }: { batch: Batch; lineage: LineageNode[] }) {
  const [selected, setSelected] = useState<LineageNode | null>(null);
  const focal = focalFromBatch(batch);
  const level1 = lineage.filter((n) => n.level === 1);
  const distinctSuppliers = new Set(
    lineage.map((n) => n.supplier).filter((s): s is string => !!s),
  ).size;
  const totalInbound = level1.reduce((s, n) => s + n.qty, 0);
  const maxLevel = lineage.reduce((m, n) => Math.max(m, n.level), 0);
  return (
    <div>
      <SectionHeader
        eyebrow="02 — BOTTOM-UP TRACEABILITY"
        title="What went into this batch?"
        subtitle={`Upstream materials and supplier lots for this batch. Walks the lineage graph up to ${Math.max(maxLevel, 1)} level${maxLevel === 1 ? "" : "s"}.`}
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 20 }}>
        <KPI label="Days to expiry" value={batch.days_to_expiry} unit="days" />
        <KPI label="Shelf-life status" value={<StatusPill status={batch.shelf_life_status} />} />
        <KPI label="Batch status" value={<StatusPill status={batch.batch_status} />} />
        <KPI label="Direct inputs" value={level1.length} sub="Level 1 materials" />
        <KPI label="Distinct suppliers" value={distinctSuppliers} />
      </div>

      <Card title="Material lineage — inputs" subtitle="Drag to pan · scroll to zoom · click any node" noPad style={{ marginBottom: 20 }}>
        <LineageGraph
          focal={focal}
          upstream={lineage}
          downstream={[]}
          highlightMode="upstream"
          selectedId={selected?.id}
          onNodeClick={(n) => {
            if ("kind" in n && n.kind === "focal") {
              setSelected(null);
            } else {
              setSelected(n as LineageNode);
            }
          }}
        />
      </Card>

      {level1.length > 0 && (
        <Card title="Inbound volume by direct input" subtitle={`Total received ${fmtN(totalInbound, 0)} KG across level-1 materials`} style={{ marginBottom: 20 }}>
          <FlowSummary nodes={level1} />
        </Card>
      )}

      <Card title="Traceability tree — flat view" subtitle={`${lineage.length} upstream nodes · sortable`} noPad>
        {lineage.length === 0 ? (
          <EmptyBlock message="No upstream inputs recorded in the lineage graph." />
        ) : (
          <DataTable<LineageNode>
            columns={[
              { header: "Level", render: (r) => "L" + r.level, mono: true, align: "center" },
              { header: "Direction", render: () => "↑ Upstream" },
              { header: "Material ID", key: "material_id", mono: true },
              { header: "Material", key: "material" },
              { header: "Batch", key: "batch", mono: true },
              { header: "Plant / Location", key: "plant", muted: true },
              { header: "Supplier", render: (r) => r.supplier ?? "—" },
              { header: "Qty", render: (r) => fmtN(r.qty, 1) + " " + r.uom, align: "right", mono: true, num: true },
              {
                header: "Link type",
                render: (r) => (
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.08em" }}>
                    {r.link}
                  </span>
                ),
              },
            ]}
            rows={lineage}
            emphasize={(r) => r.id === selected?.id}
          />
        )}
      </Card>
    </div>
  );
}

function FlowSummary({ nodes }: { nodes: LineageNode[] }) {
  const total = Math.max(1, nodes.reduce((s, n) => s + n.qty, 0));
  const palette = [
    "oklch(48% 0.09 155)",
    "oklch(55% 0.08 250)",
    "oklch(65% 0.1 45)",
    "oklch(55% 0.05 180)",
    "oklch(38% 0.06 155)",
    "oklch(55% 0.13 40)",
  ];
  return (
    <div>
      <div style={{ display: "flex", height: 44, borderRadius: 2, overflow: "hidden", marginBottom: 14 }}>
        {nodes.map((n, i) => (
          <div
            key={n.id}
            style={{
              flex: n.qty,
              background: palette[i % palette.length],
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--paper)",
              fontFamily: "'Newsreader', Georgia, serif",
              fontSize: 14,
            }}
          >
            {((n.qty / total) * 100).toFixed(1)}%
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(nodes.length, 4)}, 1fr)`, gap: 12 }}>
        {nodes.map((n, i) => (
          <div key={n.id}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={{ width: 10, height: 10, background: palette[i % palette.length] }} />
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: "var(--ink)" }}>
                {n.material}
              </span>
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
              {fmtN(n.qty, 0)} {n.uom}
            </div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 10.5, color: "var(--ink-3)" }}>
              {n.supplier || n.plant || "—"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
