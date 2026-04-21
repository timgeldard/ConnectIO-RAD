import { useState } from "react";
import type { Batch, Delivery, LineageNode } from "../types";
import { COUNTRIES, CUSTOMERS, DELIVERIES, LINEAGE } from "../data/mock";
import { BarChart, Card, DataTable, Donut, KPI, SectionHeader, StatusPill, flag, fmtN } from "../ui";
import { LineageGraph } from "../components/LineageGraph";

export function PageTopDown({ batch }: { batch: Batch }) {
  const [selected, setSelected] = useState<LineageNode | null>(null);
  return (
    <div>
      <SectionHeader
        eyebrow="03 — TOP-DOWN TRACEABILITY"
        title="Where did this batch go?"
        subtitle="From this batch forward: consumed by internal process orders, sold as semi-finished product, and finally delivered to customer."
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 20 }}>
        <KPI label="Distinct customers" value={batch.customers_affected} />
        <KPI label="Distinct countries" value={batch.countries_affected} />
        <KPI label="Total shipped" value={fmtN(batch.total_shipped_kg, 1)} unit="KG" />
        <KPI label="Deliveries" value={batch.total_deliveries} />
        <KPI label="Output tiers" value="2" sub="blends + finished goods" />
      </div>

      <Card title="Material lineage — outputs" subtitle="Consumption, sales orders, internal transfers" noPad style={{ marginBottom: 20 }}>
        <LineageGraph highlightMode="downstream" selectedId={selected?.id} onNodeClick={(n) => setSelected(n as LineageNode)} />
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <Card title="Despatched by customer">
          <Donut
            data={CUSTOMERS.slice(0, 8)}
            valueKey="qty"
            labelKey="name"
            size={220}
            centerValue={fmtN(batch.total_shipped_kg, 0)}
            centerLabel="KG DESPATCHED"
          />
        </Card>
        <Card title="Shipments by country">
          <BarChart
            data={COUNTRIES.slice(0, 7)}
            valueKey="qty"
            labelKey="name"
            height={260}
            color="oklch(55% 0.08 250)"
            format={(v) => fmtN(v, 0) + " KG"}
          />
        </Card>
      </div>

      <Card title="Distribution trace" subtitle="Every outbound link, sortable" noPad style={{ marginBottom: 20 }}>
        <DataTable<LineageNode>
          columns={[
            { header: "Level", render: (r) => "L" + r.level, mono: true, align: "center" },
            { header: "Direction", render: () => "↓ Downstream" },
            { header: "Material ID", key: "material_id", mono: true },
            { header: "Material", key: "material" },
            { header: "Batch", key: "batch", mono: true },
            { header: "Plant", key: "plant", muted: true },
            { header: "Customer", render: (r) => r.customer ?? "" },
            { header: "Qty", render: (r) => fmtN(r.qty, 1) + " " + r.uom, align: "right", mono: true, num: true },
            {
              header: "Link type",
              render: (r) => (
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: "var(--ink-3)" }}>
                  {r.link}
                </span>
              ),
            },
          ]}
          rows={LINEAGE.downstream}
        />
      </Card>

      <Card title="Delivery details" subtitle={`${DELIVERIES.length} deliveries — full shipping record`} noPad>
        <DataTable<Delivery>
          columns={[
            { header: "Delivery", key: "delivery", mono: true },
            { header: "Customer", key: "customer" },
            { header: "Destination", key: "destination", muted: true },
            { header: "Country", render: (r) => <span>{flag(r.country)} {r.country}</span>, mono: true },
            { header: "Date", key: "date", mono: true, muted: true },
            { header: "Qty", render: (r) => fmtN(r.qty, 1) + " KG", align: "right", mono: true, num: true },
            { header: "Status", render: (r) => <StatusPill status={r.status} size="sm" /> },
          ]}
          rows={DELIVERIES}
        />
      </Card>
    </div>
  );
}
