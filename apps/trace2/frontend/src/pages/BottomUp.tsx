import { useState } from "react";
import type { Batch, LineageNode } from "../types";
import { LINEAGE } from "../data/mock";
import { Card, DataTable, KPI, SectionHeader, StatusPill, fmtN } from "../ui";
import { LineageGraph } from "../components/LineageGraph";

interface FlowRow {
  label: string;
  qty: number;
  color: string;
  suppliers: string;
}

const FLOW: FlowRow[] = [
  { label: "Vanilla bean (Madagascar)", qty: 1100, color: "oklch(48% 0.09 155)", suppliers: "Ambatondrazaka, Mananara" },
  { label: "Food-grade ethanol", qty: 1840, color: "oklch(55% 0.08 250)", suppliers: "Polaris Alcohols BV" },
  { label: "Refined sugar", qty: 1220, color: "oklch(65% 0.1 45)", suppliers: "Nordzucker Konsortium" },
  { label: "Purified water (internal)", qty: 660, color: "oklch(55% 0.05 180)", suppliers: "Bremen utility loop" },
];

function FlowSummary({ data }: { data: FlowRow[] }) {
  const total = data.reduce((s, d) => s + d.qty, 0);
  return (
    <div>
      <div style={{ display: "flex", height: 44, borderRadius: 2, overflow: "hidden", marginBottom: 14 }}>
        {data.map((d, i) => (
          <div
            key={i}
            style={{
              flex: d.qty,
              background: d.color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--paper)",
              fontFamily: "'Newsreader', Georgia, serif",
              fontSize: 14,
            }}
          >
            {((d.qty / total) * 100).toFixed(1)}%
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {data.map((d, i) => (
          <div key={i}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={{ width: 10, height: 10, background: d.color }} />
              <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: "var(--ink)" }}>{d.label}</span>
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
              {fmtN(d.qty, 0)} KG
            </div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 10.5, color: "var(--ink-3)" }}>{d.suppliers}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PageBottomUp({ batch }: { batch: Batch }) {
  const [selected, setSelected] = useState<LineageNode | null>(null);
  return (
    <div>
      <SectionHeader
        eyebrow="02 — BOTTOM-UP TRACEABILITY"
        title="What went into this batch?"
        subtitle="Trace every input ingredient, supplier lot, and farm-level raw material back to source. Click any node to pin it."
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 20 }}>
        <KPI label="Days to expiry" value={batch.days_to_expiry} unit="days" />
        <KPI label="Shelf-life status" value={<StatusPill status={batch.shelf_life_status} />} />
        <KPI label="Batch status" value={<StatusPill status={batch.batch_status} />} />
        <KPI label="Input tiers" value="2" sub="direct + farm-level" />
        <KPI label="Distinct suppliers" value="6" />
      </div>

      <Card title="Material lineage — inputs" subtitle="Drag to pan · scroll to zoom · click any node" noPad style={{ marginBottom: 20 }}>
        <LineageGraph highlightMode="upstream" selectedId={selected?.id} onNodeClick={(n) => setSelected(n as LineageNode)} />
      </Card>

      <Card title="Material flow by receipt type" subtitle="Where did inbound material come from?" style={{ marginBottom: 20 }}>
        <FlowSummary data={FLOW} />
      </Card>

      <Card title="Traceability tree — flat view" subtitle="Full recursive expansion, sortable" noPad>
        <DataTable<LineageNode>
          columns={[
            { header: "Level", render: (r) => "L" + r.level, mono: true, align: "center" },
            { header: "Direction", render: () => "↑ Upstream" },
            { header: "Material ID", key: "material_id", mono: true },
            { header: "Material", key: "material" },
            { header: "Batch", key: "batch", mono: true },
            { header: "Plant / Location", key: "plant", muted: true },
            { header: "Supplier", render: (r) => r.supplier ?? "" },
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
          rows={LINEAGE.upstream}
        />
      </Card>
    </div>
  );
}
