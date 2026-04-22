import { useState } from "react";
import type { Batch, CountryRow, CustomerRow, Delivery, LineageNode } from "../types";
import { fetchTopDown, focalFromBatch } from "../data/api";
import { useBatchData } from "../data/useBatchData";
import { LoadFrame, EmptyBlock } from "../components/LoadFrame";
import { LineageGraph, NodeDetailPanel } from "../components/LineageGraph";
import { BarChart, Card, DataTable, Donut, KPI, SectionHeader, StatusPill, flag, fmtN } from "../ui";

export function PageTopDown({ batch: headerBatch }: { batch: Batch }) {
  const state = useBatchData(fetchTopDown, headerBatch.material_id, headerBatch.batch_id);
  return (
    <LoadFrame
      state={state}
      eyebrow="03 — TOP-DOWN TRACEABILITY"
      loadingTitle="Loading downstream trace…"
      loadingSubtitle={`Material ${headerBatch.material_id} · Batch ${headerBatch.batch_id}`}
    >
      {({ batch, lineage, countries, customers, deliveries }) => (
        <TopDownBody
          batch={batch}
          lineage={lineage}
          countries={countries}
          customers={customers}
          deliveries={deliveries}
        />
      )}
    </LoadFrame>
  );
}

function TopDownBody({
  batch,
  lineage,
  countries,
  customers,
  deliveries,
}: {
  batch: Batch;
  lineage: LineageNode[];
  countries: CountryRow[];
  customers: CustomerRow[];
  deliveries: Delivery[];
}) {
  const [selected, setSelected] = useState<LineageNode | null>(null);
  const focal = focalFromBatch(batch);
  const maxLevel = lineage.reduce((m, n) => Math.max(m, n.level), 0);
  return (
    <div>
      <SectionHeader
        eyebrow="03 — TOP-DOWN TRACEABILITY"
        title="Where did this batch go?"
        subtitle={`From this batch forward: consumed by internal process orders, transferred across plants, and delivered to customer. Graph walks up to ${Math.max(maxLevel, 1)} level${maxLevel === 1 ? "" : "s"} downstream.`}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 20 }}>
        <KPI label="Distinct customers" value={batch.customers_affected} />
        <KPI label="Distinct countries" value={batch.countries_affected} />
        <KPI label="Total shipped" value={fmtN(batch.total_shipped_kg, 1)} unit="KG" />
        <KPI label="Deliveries" value={batch.total_deliveries} />
        <KPI label="Output tiers" value={maxLevel} sub={`${lineage.length} downstream nodes`} />
      </div>

      <Card title="Material lineage — outputs" subtitle="Drag to pan · scroll to zoom · click any node" noPad style={{ marginBottom: 20 }}>
        <LineageGraph
          focal={focal}
          upstream={[]}
          downstream={lineage}
          highlightMode="downstream"
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

      <NodeDetailPanel node={selected} onClose={() => setSelected(null)} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        <Card title="Despatched by customer">
          {customers.length === 0 ? (
            <EmptyBlock message="No customer-level despatch data." />
          ) : (
            <Donut
              data={customers.slice(0, 8)}
              valueKey="qty"
              labelKey="name"
              size={220}
              centerValue={fmtN(batch.total_shipped_kg, 0)}
              centerLabel="KG DESPATCHED"
            />
          )}
        </Card>
        <Card title="Shipments by country">
          {countries.length === 0 ? (
            <EmptyBlock message="No shipments recorded for this batch." />
          ) : (
            <BarChart
              data={countries.slice(0, 8)}
              valueKey="qty"
              labelKey="name"
              height={260}
              color="oklch(55% 0.08 250)"
              format={(v) => fmtN(v, 0) + " KG"}
            />
          )}
        </Card>
      </div>

      <Card title="Distribution trace" subtitle={`${lineage.length} downstream links`} noPad style={{ marginBottom: 20 }}>
        {lineage.length === 0 ? (
          <EmptyBlock message="No downstream consumption or transfers recorded." />
        ) : (
          <DataTable<LineageNode>
            columns={[
              { header: "Level", render: (r) => "L" + r.level, mono: true, align: "center" },
              { header: "Direction", render: () => "↓ Downstream" },
              { header: "Material ID", key: "material_id", mono: true },
              { header: "Material", key: "material" },
              { header: "Batch", key: "batch", mono: true },
              { header: "Plant", key: "plant", muted: true },
              { header: "Customer", render: (r) => r.customer ?? "—" },
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
            rows={lineage}
            emphasize={(r) => r.id === selected?.id}
          />
        )}
      </Card>

      <Card title="Delivery details" subtitle={`${deliveries.length} deliveries — full shipping record`} noPad>
        {deliveries.length === 0 ? (
          <EmptyBlock message="No deliveries recorded for this batch." />
        ) : (
          <DataTable<Delivery>
            columns={[
              { header: "Delivery", key: "delivery", mono: true },
              { header: "Customer", key: "customer" },
              { header: "Destination", key: "destination", muted: true },
              { header: "Country", render: (r) => <span>{r.country ? `${flag(r.country)} ${r.country}` : "—"}</span>, mono: true },
              { header: "Date", key: "date", mono: true, muted: true },
              { header: "Qty", render: (r) => fmtN(r.qty, 1) + " KG", align: "right", mono: true, num: true },
              { header: "Status", render: (r) => <StatusPill status={r.status} size="sm" /> },
            ]}
            rows={deliveries}
          />
        )}
      </Card>
    </div>
  );
}
