import type { Batch, BatchCompareEntry } from "../types";
import { fetchBatchCompare } from "../data/api";
import { useBatchData } from "../data/useBatchData";
import { LoadFrame, EmptyBlock } from "../components/LoadFrame";
import { BarChart, Card, DataTable, KPI, SectionHeader, StatusPill, fmtN } from "../ui";

export function PageBatchCompare({ batch: headerBatch }: { batch: Batch }) {
  const state = useBatchData(fetchBatchCompare, headerBatch.material_id, headerBatch.batch_id);
  return (
    <LoadFrame
      state={state}
      eyebrow="07 — BATCH COMPARISON"
      loadingTitle="Loading batch comparison…"
      loadingSubtitle={`Material ${headerBatch.material_id}`}
    >
      {({ batch, batches }) => {
        const avgYield = batches.length ? batches.reduce((s, b) => s + b.yield_pct, 0) / batches.length : 0;
        const passCount = batches.filter((b) => b.failed_mics === 0).length;
        const failingCount = batches.filter((b) => b.failed_mics > 0).length;
        return (
          <div>
            <SectionHeader
              eyebrow="07 — BATCH COMPARISON"
              title="How does this batch compare to its siblings?"
              subtitle="Batch size relative to material average, pass/fail ratios, and quality metrics across all batches of this material."
            />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
              <KPI label="Batch count" value={batches.length} />
              <KPI label="Avg size vs mean" value={fmtN(avgYield, 1)} unit="%" />
              <KPI label="Pass count" value={passCount} tone="good" />
              <KPI
                label="Failing batches"
                value={failingCount}
                tone={failingCount > 0 ? "bad" : "muted"}
              />
            </div>
            {batches.length === 0 ? (
              <Card title="Batch comparison">
                <EmptyBlock message="No historical batches found for this material." />
              </Card>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                  <Card title="Size vs material average" subtitle="Batch qty as % of mean across shown batches">
                    <BarChart
                      data={batches}
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
                      data={batches}
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
                      { header: "Size vs avg", render: (r) => r.yield_pct.toFixed(1) + "%", align: "right", mono: true, num: true },
                      { header: "Lots", key: "lot_count", mono: true, align: "right", num: true },
                      { header: "Accepted", render: (r) => r.accepted, align: "right", mono: true, num: true },
                      { header: "Rejected", render: (r) => r.rejected, align: "right", mono: true, num: true },
                      { header: "Failed MICs", render: (r) => r.failed_mics, align: "right", mono: true, num: true },
                      { header: "Status", render: (r) => <StatusPill status={r.status} size="sm" /> },
                    ]}
                    rows={batches}
                    emphasize={(r) => r.batch === batch.batch_id}
                  />
                </Card>
              </>
            )}
          </div>
        );
      }}
    </LoadFrame>
  );
}
