import { CSSProperties, useState } from "react";
import type { Batch, InspectionLot, MIC } from "../types";
import { INSPECTION_LOTS, MICS } from "../data/mock";
import { BarChart, Card, DataTable, KPI, SectionHeader, StatusPill } from "../ui";

const selectStyle: CSSProperties = {
  padding: "4px 8px",
  border: "1px solid var(--line-2)",
  background: "var(--card)",
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 11,
  color: "var(--ink)",
  borderRadius: 2,
};

export function PageQuality({ batch }: { batch: Batch }) {
  const [selectedLot, setSelectedLot] = useState<string>(INSPECTION_LOTS[0].lot);
  const filtered = MICS;
  return (
    <div>
      <SectionHeader
        eyebrow="05 — QUALITY"
        title="Inspection lots and characteristic results"
        subtitle="All quality checkpoints for this batch. Failed MICs block release automatically; critical failures escalate to QA."
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginBottom: 20 }}>
        <KPI label="Batch status" value={<StatusPill status={batch.batch_status} />} />
        <KPI label="Inspection lots" value={INSPECTION_LOTS.length} />
        <KPI label="Accepted results" value="45" tone="good" />
        <KPI label="Rejected results" value="0" tone="muted" />
        <KPI label="Failed MICs" value="0" tone="good" />
        <KPI label="Latest inspection" value="15-Mar" unit="2026" />
      </div>

      <Card title="Inspection lot details" subtitle="Click a lot to filter results below" noPad style={{ marginBottom: 20 }}>
        <DataTable<InspectionLot>
          columns={[
            { header: "Lot", key: "lot", mono: true },
            { header: "Type", key: "type" },
            { header: "Start", key: "start", mono: true, muted: true },
            { header: "End", key: "end", mono: true, muted: true },
            { header: "Qty", render: (r) => `${r.qty.toFixed(1)} ${r.uom}`, align: "right", mono: true, num: true },
            { header: "Inspector", key: "insp_by" },
            { header: "Decision", render: (r) => <StatusPill status={r.decision} size="sm" /> },
          ]}
          rows={INSPECTION_LOTS}
        />
      </Card>

      <Card
        title="Inspection results"
        subtitle={`Lot ${selectedLot} · ${MICS.length} characteristics`}
        noPad
        style={{ marginBottom: 20 }}
        action={
          <select value={selectedLot} onChange={(e) => setSelectedLot(e.target.value)} style={selectStyle}>
            {INSPECTION_LOTS.map((l) => (
              <option key={l.lot} value={l.lot}>
                {l.lot} · {l.type}
              </option>
            ))}
          </select>
        }
      >
        <DataTable<MIC>
          dense
          columns={[
            { header: "MIC", key: "id", mono: true },
            { header: "Characteristic", key: "name" },
            { header: "Target", key: "target", mono: true, muted: true },
            { header: "Tolerance", key: "tol", mono: true, muted: true },
            { header: "UOM", key: "uom", mono: true, muted: true },
            {
              header: "Result",
              render: (r) => (
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: "tabular-nums", color: "var(--ink)", fontWeight: 500 }}>
                  {r.value || r.qual}
                </span>
              ),
              align: "right",
            },
            {
              header: "Critical",
              render: (r) => (r.critical ? <span style={{ color: "oklch(45% 0.13 35)", fontSize: 12 }}>●</span> : null),
              align: "center",
            },
            { header: "Decision", render: (r) => <StatusPill status={r.result} size="sm" /> },
          ]}
          rows={filtered}
        />
      </Card>

      <Card title="MIC pass / fail by characteristic" subtitle="All inspection lots for this batch">
        <BarChart
          data={MICS.slice(0, 10).map((m) => ({ name: m.name, pass: 3, fail: 0 }))}
          valueKey="pass"
          labelKey="name"
          height={300}
          color="oklch(48% 0.09 155)"
          format={(v) => v + " pass"}
        />
      </Card>
    </div>
  );
}
