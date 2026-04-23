import type { Batch, Supplier } from "../types";
import { fetchSupplierRisk } from "../data/api";
import { useBatchData } from "../data/useBatchData";
import { LoadFrame, EmptyBlock } from "../components/LoadFrame";
import { BarChart, Card, DataTable, KPI, SectionHeader, StatusPill, flag, fmtN } from "../ui";

export function PageSupplierRisk({ batch: headerBatch }: { batch: Batch }) {
  const state = useBatchData(fetchSupplierRisk, headerBatch.material_id, headerBatch.batch_id);
  return (
    <LoadFrame
      state={state}
      eyebrow="09 — SUPPLIER RISK"
      loadingTitle="Loading supplier network…"
      loadingSubtitle={`Material ${headerBatch.material_id} · Batch ${headerBatch.batch_id}`}
    >
      {({ suppliers }) => {
        const totalReceived = suppliers.reduce((s, v) => s + v.received, 0);
        const highRisk = suppliers.filter((v) => v.risk === "HIGH" || v.risk === "CRITICAL").length;
        const medium = suppliers.filter((v) => v.risk === "MEDIUM").length;
        const withFailures = suppliers.filter((v) => v.failure_rate > 0);
        return (
          <div>
            <SectionHeader
              eyebrow="09 — SUPPLIER RISK"
              title="Who supplies inputs that feed this material?"
              subtitle="All suppliers recorded in material lineage. Volume, batch counts, and failure rates aggregated from upstream quality results across the lineage graph."
            />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
              <KPI label="Supplier count" value={suppliers.length} />
              <KPI label="Total received" value={fmtN(totalReceived, 0)} unit="KG" />
              <KPI label="High-risk suppliers" value={highRisk} tone={highRisk > 0 ? "bad" : "muted"} />
              <KPI label="Medium-risk" value={medium} tone={medium > 0 ? "warn" : "muted"} />
            </div>
            {suppliers.length === 0 ? (
              <Card title="Supplier network">
                <EmptyBlock message="No suppliers appear in the lineage graph for this material." />
              </Card>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                  <Card
                    title="Received volume by supplier"
                    subtitle={suppliers.length > 15 ? `Top 15 of ${suppliers.length}` : undefined}
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
                    title="Quality failure rate"
                    subtitle={
                      withFailures.length === 0
                        ? "No rejected results recorded for any supplier"
                        : `${withFailures.length} supplier${withFailures.length === 1 ? "" : "s"} with rejected results`
                    }
                  >
                    {withFailures.length === 0 ? (
                      <EmptyBlock message="All suppliers feeding this material have a 0% rejection rate." />
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
                <Card title="Supplier details" noPad>
                  <DataTable<Supplier>
                    columns={[
                      { header: "Vendor ID", key: "id", mono: true },
                      { header: "Supplier", key: "name" },
                      { header: "Country", render: (r) => <span>{r.country ? `${flag(r.country)} ${r.country}` : "—"}</span>, mono: true },
                      { header: "Material supplied", key: "material", muted: true },
                      { header: "Received (KG)", render: (r) => fmtN(r.received, 0), align: "right", mono: true, num: true },
                      { header: "Batches", key: "batches", align: "right", mono: true, num: true },
                      { header: "First receipt", key: "first", mono: true, muted: true },
                      { header: "Last receipt", key: "last", mono: true, muted: true },
                      {
                        header: "Failure rate",
                        render: (r) => (r.failure_rate * 100).toFixed(1) + "%",
                        align: "right",
                        mono: true,
                        num: true,
                      },
                      { header: "Risk", render: (r) => <StatusPill status={r.risk} size="sm" /> },
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
