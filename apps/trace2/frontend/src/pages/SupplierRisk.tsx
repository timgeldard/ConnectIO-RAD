import type { Batch, Supplier } from "../types";
import { fetchSupplierRisk } from "../data/api";
import { useBatchData } from "../data/useBatchData";
import { LoadFrame, EmptyBlock } from "../components/LoadFrame";
import { BarChart, Card, DataTable, KPI, SectionHeader, StatusPill, flag, fmtN } from "../ui";
import { useI18n } from "@connectio/shared-frontend-i18n";
import { template, traceCopy } from "../i18n/pageCopy";

export function PageSupplierRisk({ batch: headerBatch }: { batch: Batch }) {
  const { language } = useI18n();
  const copy = traceCopy(language);
  const state = useBatchData(fetchSupplierRisk, headerBatch.material_id, headerBatch.batch_id);
  return (
    <LoadFrame
      state={state}
      eyebrow={copy.supplier.eyebrow}
      loadingTitle={copy.supplier.loading}
      loadingSubtitle={template(copy.common.loadingSubtitle, { material: headerBatch.material_id, batch: headerBatch.batch_id })}
    >
      {({ suppliers }) => {
        const totalReceived = suppliers.reduce((s, v) => s + v.received, 0);
        const highRisk = suppliers.filter((v) => v.risk === "HIGH" || v.risk === "CRITICAL").length;
        const medium = suppliers.filter((v) => v.risk === "MEDIUM").length;
        const withFailures = suppliers.filter((v) => v.failure_rate > 0);
        return (
          <div>
            <SectionHeader
              eyebrow={copy.supplier.eyebrow}
              title={copy.supplier.title}
              subtitle={copy.supplier.subtitle}
            />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
              <KPI label={copy.supplier.count} value={suppliers.length} />
              <KPI label={copy.supplier.totalReceived} value={fmtN(totalReceived, 0)} unit={copy.common.kg} />
              <KPI label={copy.supplier.highRisk} value={highRisk} tone={highRisk > 0 ? "bad" : "muted"} />
              <KPI label={copy.supplier.mediumRisk} value={medium} tone={medium > 0 ? "warn" : "muted"} />
            </div>
            {suppliers.length === 0 ? (
              <Card title={copy.supplier.network}>
                <EmptyBlock message={copy.supplier.empty} />
              </Card>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                  <Card
                    title={copy.supplier.receivedBySupplier}
                    subtitle={suppliers.length > 15 ? template(copy.supplier.topOf, { count: suppliers.length }) : undefined}
                  >
                    <BarChart
                      data={suppliers.slice(0, 15)}
                      valueKey="received"
                      labelKey="name"
                      height={320}
                      color="var(--valentia-slate)"
                      format={(v) => fmtN(v, 0) + " KG"}
                    />
                  </Card>
                  <Card
                    title={copy.supplier.failureRate}
                    subtitle={
                      withFailures.length === 0
                        ? copy.supplier.noRejected
                        : template(copy.supplier.rejectedSuppliers, { count: withFailures.length })
                    }
                  >
                    {withFailures.length === 0 ? (
                      <EmptyBlock message={copy.supplier.noFailure} />
                    ) : (
                      <BarChart
                        data={[...withFailures].sort((a, b) => b.failure_rate - a.failure_rate).slice(0, 15)}
                        valueKey="failure_rate"
                        labelKey="name"
                        height={320}
                        color="var(--sunset)"
                        format={(v) => (v * 100).toFixed(1) + "%"}
                        max={Math.max(0.5, ...withFailures.map((s) => s.failure_rate))}
                      />
                    )}
                  </Card>
                </div>
                <Card title={copy.supplier.details} noPad>
                  <DataTable<Supplier>
                    columns={[
                      { header: copy.common.vendorId, key: "id", mono: true },
                      { header: copy.common.supplier, key: "name" },
                      { header: copy.common.country, render: (r) => <span>{r.country ? `${flag(r.country)} ${r.country}` : "—"}</span>, mono: true },
                      { header: copy.common.materialSupplied, key: "material", muted: true },
                      { header: `${copy.common.received} (${copy.common.kg})`, render: (r) => fmtN(r.received, 0), align: "right", mono: true, num: true },
                      { header: copy.common.batches, key: "batches", align: "right", mono: true, num: true },
                      { header: copy.common.firstReceipt, key: "first", mono: true, muted: true },
                      { header: copy.common.lastReceipt, key: "last", mono: true, muted: true },
                      {
                        header: copy.common.failureRate,
                        render: (r) => (r.failure_rate * 100).toFixed(1) + "%",
                        align: "right",
                        mono: true,
                        num: true,
                      },
                      { header: copy.common.risk, render: (r) => <StatusPill status={r.risk} size="sm" /> },
                    ]}
                    rows={suppliers}
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
