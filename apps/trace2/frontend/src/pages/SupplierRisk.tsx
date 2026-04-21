import type { Supplier } from "../types";
import { SUPPLIERS } from "../data/mock";
import { BarChart, Card, DataTable, KPI, SectionHeader, StatusPill, flag, fmtN } from "../ui";

export function PageSupplierRisk() {
  return (
    <div>
      <SectionHeader
        eyebrow="08 — SUPPLIER RISK"
        title="Who supplies inputs to this material?"
        subtitle="Quality failure rates, volume contribution, and risk tiers across all suppliers."
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        <KPI label="Supplier count" value={SUPPLIERS.length} />
        <KPI label="Total received" value={fmtN(SUPPLIERS.reduce((s, v) => s + v.received, 0), 0)} unit="KG" />
        <KPI label="High-risk suppliers" value={SUPPLIERS.filter((v) => v.risk === "HIGH").length} tone="bad" />
        <KPI label="Medium-risk" value={SUPPLIERS.filter((v) => v.risk === "MEDIUM").length} tone="warn" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <Card title="Received volume by supplier">
          <BarChart
            data={SUPPLIERS}
            valueKey="received"
            labelKey="name"
            height={320}
            color="oklch(48% 0.09 155)"
            format={(v) => fmtN(v, 0) + " KG"}
          />
        </Card>
        <Card title="Quality failure rate by supplier">
          <BarChart
            data={SUPPLIERS}
            valueKey="failure_rate"
            labelKey="name"
            height={320}
            color="oklch(55% 0.13 40)"
            format={(v) => (v * 100).toFixed(1) + "%"}
            max={0.5}
          />
        </Card>
      </div>
      <Card title="Supplier details" noPad>
        <DataTable<Supplier>
          columns={[
            { header: "Vendor ID", key: "id", mono: true },
            { header: "Supplier", key: "name" },
            { header: "Country", render: (r) => <span>{flag(r.country)} {r.country}</span>, mono: true },
            { header: "Material supplied", key: "material", muted: true },
            { header: "Received (KG)", render: (r) => fmtN(r.received, 0), align: "right", mono: true, num: true },
            { header: "Batches", key: "batches", align: "right", mono: true, num: true },
            { header: "First receipt", key: "first", mono: true, muted: true },
            { header: "Last receipt", key: "last", mono: true, muted: true },
            { header: "Failure rate", render: (r) => (r.failure_rate * 100).toFixed(1) + "%", align: "right", mono: true, num: true },
            { header: "Risk", render: (r) => <StatusPill status={r.risk} size="sm" /> },
          ]}
          rows={SUPPLIERS}
        />
      </Card>
    </div>
  );
}
