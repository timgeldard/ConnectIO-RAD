import type { Batch, BatchCompareEntry } from "../types";
import { BATCH_COMPARE } from "../data/mock";
import { BarChart, Card, DataTable, KPI, SectionHeader, StatusPill, fmtN } from "../ui";

export function PageBatchCompare({ batch }: { batch: Batch }) {
  return (
    <div>
      <SectionHeader
        eyebrow="07 — BATCH COMPARISON"
        title="How does this batch compare to its siblings?"
        subtitle="Yield, pass/fail ratios, and quality metrics across all batches of this material."
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        <KPI label="Batch count" value={BATCH_COMPARE.length} />
        <KPI
          label="Avg yield"
          value={fmtN(BATCH_COMPARE.reduce((s, b) => s + b.yield_pct, 0) / BATCH_COMPARE.length, 1)}
          unit="%"
        />
        <KPI label="Pass count" value={BATCH_COMPARE.filter((b) => b.failed_mics === 0).length} tone="good" />
        <KPI
          label="Failing batches"
          value={BATCH_COMPARE.filter((b) => b.failed_mics > 0).length}
          tone={BATCH_COMPARE.filter((b) => b.failed_mics > 0).length ? "bad" : "muted"}
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <Card title="Batch yield by batch">
          <BarChart
            data={BATCH_COMPARE}
            valueKey="yield_pct"
            labelKey="batch"
            height={340}
            color="oklch(48% 0.09 155)"
            format={(v) => v.toFixed(1) + "%"}
            sort={false}
          />
        </Card>
        <Card title="Failed MICs by batch">
          <BarChart
            data={BATCH_COMPARE.filter((b) => b.failed_mics >= 0)}
            valueKey="failed_mics"
            labelKey="batch"
            height={340}
            color="oklch(55% 0.13 40)"
            format={(v) => String(v)}
            sort={false}
          />
        </Card>
      </div>
      <Card title="Batch comparison details" noPad>
        <DataTable<BatchCompareEntry>
          columns={[
            { header: "Batch", key: "batch", mono: true },
            { header: "Process order", key: "po", mono: true, muted: true },
            { header: "Plant", key: "plant", mono: true, muted: true },
            { header: "Date", key: "date", mono: true, muted: true },
            { header: "Qty (KG)", render: (r) => fmtN(r.qty, 0), align: "right", mono: true, num: true },
            { header: "Yield", render: (r) => r.yield_pct.toFixed(1) + "%", align: "right", mono: true, num: true },
            { header: "Lots", key: "lot_count", mono: true, align: "right", num: true },
            { header: "Accepted", render: (r) => r.accepted, align: "right", mono: true, num: true },
            { header: "Rejected", render: (r) => r.rejected, align: "right", mono: true, num: true },
            { header: "Failed MICs", render: (r) => r.failed_mics, align: "right", mono: true, num: true },
            { header: "Status", render: (r) => <StatusPill status={r.status} size="sm" /> },
          ]}
          rows={BATCH_COMPARE}
          emphasize={(r) => r.batch === batch.batch_id}
        />
      </Card>
    </div>
  );
}
