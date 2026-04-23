import { useState } from "react";
import type { Batch, CustomerRow, Delivery, PageId } from "../types";
import { fetchTopDown } from "../data/api";
import { useBatchData } from "../data/useBatchData";
import { LoadFrame } from "../components/LoadFrame";
import {
  BarChart, Card, DataTable, Donut, KPI,
  SectionHeader, StatusPill, fmtN, fmtInt, flag,
} from "../ui";

export function PageCustomersDeliveries({
  batch: headerBatch,
  sim,
}: {
  batch: Batch;
  navigate: (id: PageId) => void;
  sim?: boolean;
}) {
  const state = useBatchData(fetchTopDown, headerBatch.material_id, headerBatch.batch_id);
  return (
    <LoadFrame
      state={state}
      eyebrow="05 — CUSTOMERS & DELIVERIES"
      loadingTitle="Loading customers and deliveries…"
      loadingSubtitle={`Material ${headerBatch.material_id} · Batch ${headerBatch.batch_id}`}
    >
      {({ batch, countries, customers, deliveries }) => (
        <CustomersDeliveriesBody
          batch={batch}
          customers={customers}
          deliveries={deliveries}
          sim={sim ?? false}
        />
      )}
    </LoadFrame>
  );
}

function CustomersDeliveriesBody({
  batch, customers, deliveries, sim,
}: {
  batch: Batch;
  customers: CustomerRow[];
  deliveries: Delivery[];
  sim: boolean;
}) {
  const [activeTab, setActiveTab] = useState<"customers" | "deliveries">("customers");

  const totalQty = customers.reduce((s, c) => s + c.qty, 0);

  return (
    <div>
      <SectionHeader
        eyebrow="Customers & Deliveries"
        title="Where did this batch go?"
        subtitle={`${batch.customers_affected} customer${batch.customers_affected === 1 ? "" : "s"} across ${batch.countries_affected} countr${batch.countries_affected === 1 ? "y" : "ies"} · ${fmtN(batch.total_shipped_kg)} ${batch.uom} shipped in ${batch.total_deliveries} deliveries`}
      />

      {/* 4-KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <KPI
          label="Countries reached"
          value={fmtInt(batch.countries_affected)}
          tone={sim ? "bad" : "brand"}
        />
        <KPI
          label="Customers"
          value={fmtInt(batch.customers_affected)}
          tone={sim ? "bad" : "default"}
        />
        <KPI
          label="Total shipped"
          value={fmtN(batch.total_shipped_kg)}
          unit={batch.uom}
          tone="default"
        />
        <KPI
          label="Total deliveries"
          value={fmtInt(batch.total_deliveries)}
          tone="default"
        />
      </div>

      {/* Tabs */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", borderBottom: "1px solid var(--line)", gap: 0 }}>
          {(["customers", "deliveries"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "10px 20px",
                fontFamily: "var(--font-sans)",
                fontSize: 13, fontWeight: activeTab === tab ? 600 : 400,
                color: activeTab === tab ? "var(--brand)" : "var(--ink-3)",
                background: "transparent",
                border: "none",
                borderBottom: `2px solid ${activeTab === tab ? "var(--brand)" : "transparent"}`,
                marginBottom: -1,
                cursor: "pointer",
                textTransform: "capitalize",
              }}
            >
              {tab === "customers" ? `Customers (${customers.length})` : `Deliveries (${deliveries.length})`}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "customers" && (
        <CustomersTab customers={customers} totalQty={totalQty} batch={batch} sim={sim} />
      )}
      {activeTab === "deliveries" && (
        <DeliveriesTab deliveries={deliveries} batch={batch} sim={sim} />
      )}
    </div>
  );
}

function CustomersTab({
  customers, totalQty, batch, sim,
}: {
  customers: CustomerRow[];
  totalQty: number;
  batch: Batch;
  sim: boolean;
}) {
  const donutData = customers.slice(0, 10);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 20 }}>
      <Card title="Share by customer">
        <div style={{ padding: "12px 0", display: "flex", justifyContent: "center" }}>
          <Donut
            data={donutData}
            valueKey="qty"
            size={200}
            centerLabel="total shipped"
            centerValue={`${fmtInt(customers.length)}`}
          />
        </div>
        <div style={{ padding: "0 16px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
          {donutData.slice(0, 5).map((c, i) => {
            const share = totalQty > 0 ? (c.qty / totalQty) * 100 : 0;
            const palette = ["#005776", "#289BA2", "#44CF93", "#F9C20A", "#F24A00"];
            return (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: palette[i], flexShrink: 0 }} />
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "var(--font-sans)", color: "var(--ink-2)" }}>{c.name}</span>
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--ink-3)", fontSize: 10 }}>{share.toFixed(1)}%</span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card title={`${customers.length} customer${customers.length === 1 ? "" : "s"}`}>
        <DataTable
          columns={[
            { header: "Customer", key: "name" },
            { header: "Country", render: (r) => <span>{flag(r.country)} {r.country}</span> },
            { header: "Qty", key: "qty", align: "right", num: true, render: (r) => `${fmtN(r.qty)} ${batch.uom}` },
            { header: "Deliveries", key: "deliveries", align: "right", num: true, mono: true },
            {
              header: "Share %",
              align: "right",
              num: true,
              render: (r) => (
                <span style={{ fontFamily: "var(--font-mono)", color: sim ? "var(--sunset)" : "var(--brand)", fontWeight: 500 }}>
                  {r.share.toFixed(1)}%
                </span>
              ),
            },
          ]}
          rows={customers}
          rowKey={(r) => r.id}
          emphasize={(r) => sim && r.share > 20}
        />
      </Card>
    </div>
  );
}

function DeliveriesTab({
  deliveries, batch, sim,
}: {
  deliveries: Delivery[];
  batch: Batch;
  sim: boolean;
}) {
  const sorted = [...deliveries].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <Card title={`${deliveries.length} deliveries`}>
      <DataTable
        columns={[
          { header: "Delivery", key: "delivery", mono: true, width: 120 },
          { header: "Customer", key: "customer" },
          { header: "Destination", key: "destination" },
          { header: "Country", render: (r) => <span>{flag(r.country)} {r.country}</span>, width: 90 },
          { header: "Date", key: "date", mono: true },
          { header: "Qty", align: "right", num: true, render: (r) => `${fmtN(r.qty)} ${batch.uom}` },
          { header: "Status", render: (r) => <StatusPill status={r.status} size="sm" />, width: 130 },
          { header: "Doc", key: "doc", mono: true, muted: true },
        ]}
        rows={sorted}
        rowKey={(r) => r.delivery}
        emphasize={(r) => sim && r.status === "IN_TRANSIT"}
      />
    </Card>
  );
}
