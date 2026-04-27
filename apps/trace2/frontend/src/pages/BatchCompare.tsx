import type { Batch, BatchCompareEntry } from "../types";
import { fetchBatchCompare } from "../data/api";
import { useBatchData } from "../data/useBatchData";
import { LoadFrame, EmptyBlock } from "../components/LoadFrame";
import { BarChart, Card, DataTable, KPI, SectionHeader, StatusPill, fmtN } from "../ui";
import { useI18n } from "@connectio/shared-frontend-i18n";
import { template, traceCopy } from "../i18n/pageCopy";

export function PageBatchCompare({ batch: headerBatch }: { batch: Batch }) {
  const { language } = useI18n();
  const copy = traceCopy(language);
  const state = useBatchData(fetchBatchCompare, headerBatch.material_id, headerBatch.batch_id);
  return (
    <LoadFrame
      state={state}
      eyebrow={copy.compare.eyebrow}
      loadingTitle={copy.compare.loading}
      loadingSubtitle={template(copy.common.loadingMaterial, { material: headerBatch.material_id })}
    >
      {({ batch, batches }) => {
        const avgYield = batches.length ? batches.reduce((s, b) => s + b.yield_pct, 0) / batches.length : 0;
        const passCount = batches.filter((b) => b.failed_mics === 0).length;
        const failingCount = batches.filter((b) => b.failed_mics > 0).length;
        return (
          <div>
            <SectionHeader
              eyebrow={copy.compare.eyebrow}
              title={copy.compare.title}
              subtitle={copy.compare.subtitle}
            />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
              <KPI label={copy.compare.batchCount} value={batches.length} />
              <KPI label={copy.compare.avgSize} value={fmtN(avgYield, 1)} unit="%" />
              <KPI label={copy.compare.passCount} value={passCount} tone="good" />
              <KPI
                label={copy.compare.failingBatches}
                value={failingCount}
                tone={failingCount > 0 ? "bad" : "muted"}
              />
            </div>
            {batches.length === 0 ? (
              <Card title={copy.compare.cardTitle}>
                <EmptyBlock message={copy.compare.empty} />
              </Card>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                  <Card title={copy.compare.sizeVsAvg} subtitle={copy.compare.sizeVsAvgSub}>
                    <BarChart
                      data={batches}
                      valueKey="yield_pct"
                      labelKey="batch"
                      height={340}
                      color="var(--valentia-slate)"
                      format={(v) => v.toFixed(1) + "%"}
                      sort={false}
                    />
                  </Card>
                  <Card title={copy.compare.failedByBatch}>
                    <BarChart
                      data={batches}
                      valueKey="failed_mics"
                      labelKey="batch"
                      height={340}
                      color="var(--sunset)"
                      format={(v) => String(v)}
                      sort={false}
                    />
                  </Card>
                </div>
                <Card title={copy.compare.details} noPad>
                  <DataTable<BatchCompareEntry>
                    columns={[
                      { header: copy.common.batch, key: "batch", mono: true },
                      { header: copy.common.processOrder, key: "po", mono: true, muted: true },
                      { header: copy.common.plant, key: "plant", mono: true, muted: true },
                      { header: copy.common.date, key: "date", mono: true, muted: true },
                      { header: `${copy.common.qty} (${copy.common.kg})`, render: (r) => fmtN(r.qty, 0), align: "right", mono: true, num: true },
                      { header: copy.compare.sizeVsAvgCol, render: (r) => r.yield_pct.toFixed(1) + "%", align: "right", mono: true, num: true },
                      { header: copy.common.lots, key: "lot_count", mono: true, align: "right", num: true },
                      { header: copy.common.accepted, render: (r) => r.accepted, align: "right", mono: true, num: true },
                      { header: copy.common.rejected, render: (r) => r.rejected, align: "right", mono: true, num: true },
                      { header: copy.common.failedMics, render: (r) => r.failed_mics, align: "right", mono: true, num: true },
                      { header: copy.common.status, render: (r) => <StatusPill status={r.status} size="sm" /> },
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
