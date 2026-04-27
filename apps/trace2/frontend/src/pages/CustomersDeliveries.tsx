import { useMemo, useState } from "react";
import type { Batch, CustomerRow, Delivery, PageId } from "../types";
import { fetchTopDown } from "../data/api";
import { useBatchData } from "../data/useBatchData";
import { LoadFrame } from "../components/LoadFrame";
import { CustomerMap, type CustomerMapMarker } from "../components/CustomerMap";
import { useGeocode, type GeocodeQuery } from "../hooks/useGeocode";
import {
  BarChart, Card, DataTable, Donut, KPI,
  SectionHeader, StatusPill, fmtN, fmtInt, flag,
} from "../ui";
import { useI18n } from "@connectio/shared-frontend-i18n";
import { plural, template, traceCopy } from "../i18n/pageCopy";

export function PageCustomersDeliveries({
  batch: headerBatch,
  sim,
}: {
  batch: Batch;
  navigate: (id: PageId) => void;
  sim?: boolean;
}) {
  const { language } = useI18n();
  const copy = traceCopy(language);
  const state = useBatchData(fetchTopDown, headerBatch.material_id, headerBatch.batch_id);
  return (
    <LoadFrame
      state={state}
      eyebrow={copy.customers.eyebrow}
      loadingTitle={copy.customers.loading}
      loadingSubtitle={template(copy.common.loadingSubtitle, { material: headerBatch.material_id, batch: headerBatch.batch_id })}
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
  const { language } = useI18n();
  const copy = traceCopy(language);

  const totalQty = customers.reduce((s, c) => s + c.qty, 0);

  return (
    <div>
      <SectionHeader
        eyebrow={copy.customers.eyebrow}
        title={copy.customers.title}
        subtitle={template(copy.customers.subtitle, {
          customers: plural(copy.common.oneCustomer, copy.common.manyCustomers, batch.customers_affected),
          countries: plural(copy.common.oneCountry, copy.common.manyCountries, batch.countries_affected),
          qty: fmtN(batch.total_shipped_kg),
          uom: batch.uom,
          deliveries: plural(copy.common.oneDelivery, copy.common.manyDeliveries, batch.total_deliveries),
        })}
      />

      {/* 4-KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
        <KPI
          label={copy.customers.countriesReached}
          value={fmtInt(batch.countries_affected)}
          tone={sim ? "bad" : "brand"}
        />
        <KPI
          label={copy.common.customers}
          value={fmtInt(batch.customers_affected)}
          tone={sim ? "bad" : "default"}
        />
        <KPI
          label={copy.top.totalShipped}
          value={fmtN(batch.total_shipped_kg)}
          unit={batch.uom}
          tone="default"
        />
        <KPI
          label={copy.customers.totalDeliveries}
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
              {tab === "customers"
                ? template(copy.customers.customersTab, { count: customers.length })
                : template(copy.customers.deliveriesTab, { count: deliveries.length })}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "customers" && (
        <CustomersTab
          customers={customers}
          deliveries={deliveries}
          totalQty={totalQty}
          batch={batch}
          sim={sim}
        />
      )}
      {activeTab === "deliveries" && (
        <DeliveriesTab deliveries={deliveries} batch={batch} sim={sim} />
      )}
    </div>
  );
}

function CustomersTab({
  customers, deliveries, totalQty, batch, sim,
}: {
  customers: CustomerRow[];
  deliveries: Delivery[];
  totalQty: number;
  batch: Batch;
  sim: boolean;
}) {
  const donutData = customers.slice(0, 10);
  const { language } = useI18n();
  const copy = traceCopy(language);

  // Aggregate deliveries by destination + country so each map marker reflects
  // a real shipping location (a customer can have multiple sites; multiple
  // customers can share a city — both cases are handled here).
  const aggregations = useMemo(() => aggregateLocations(deliveries, batch.uom), [deliveries, batch.uom]);
  const queries: GeocodeQuery[] = useMemo(
    () => aggregations.map((a) => ({ key: a.key, destination: a.destination, country: a.country })),
    [aggregations],
  );
  const { locations, loading: geocoding } = useGeocode(queries);

  const markers: CustomerMapMarker[] = useMemo(
    () =>
      aggregations
        .map((a) => {
          const ll = locations.get(a.key);
          if (!ll) return null;
          return { ...a, lat: ll.lat, lon: ll.lon };
        })
        .filter((m): m is CustomerMapMarker => m !== null),
    [aggregations, locations],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Card
        title="Customer locations"
        subtitle={`${markers.length}/${aggregations.length} located${geocoding ? " (locating remaining…)" : ""}`}
        noPad
      >
        <div style={{ height: 420, borderRadius: "0 0 8px 8px", overflow: "hidden" }}>
          <CustomerMap
            markers={markers}
            geocoding={geocoding}
            geocodingMessage="Locating customer addresses…"
            emptyMessage={
              aggregations.length === 0
                ? "No deliveries on this batch."
                : "No customer locations could be resolved."
            }
          />
        </div>
      </Card>
      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 20 }}>
      <Card title={copy.customers.shareByCustomer}>
        <div style={{ padding: "12px 0", display: "flex", justifyContent: "center" }}>
          <Donut
            data={donutData}
            valueKey="qty"
            size={200}
            centerLabel={copy.customers.totalShippedCenter}
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

      <Card title={template(copy.customers.customerCountTitle, { count: customers.length })}>
        <DataTable
          columns={[
            { header: copy.common.customer, key: "name" },
            { header: copy.common.country, render: (r) => <span>{flag(r.country)} {r.country}</span> },
            { header: copy.common.qty, key: "qty", align: "right", num: true, render: (r) => `${fmtN(r.qty)} ${batch.uom}` },
            { header: copy.common.deliveries, key: "deliveries", align: "right", num: true, mono: true },
            {
              header: copy.common.sharePercent,
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
    </div>
  );
}

interface LocationAggregation extends Omit<CustomerMapMarker, "lat" | "lon"> {}

function aggregateLocations(deliveries: Delivery[], uom: string): LocationAggregation[] {
  const byKey = new Map<
    string,
    { destination: string; country: string; customers: Set<string>; qty: number; deliveryCount: number }
  >();

  for (const d of deliveries) {
    const destination = (d.destination ?? "").trim();
    const country = (d.country ?? "").trim();
    if (!destination && !country) continue;
    const key = `${destination}|${country}`;
    const entry = byKey.get(key);
    if (entry) {
      entry.qty += d.qty;
      entry.deliveryCount += 1;
      if (d.customer) entry.customers.add(d.customer);
    } else {
      byKey.set(key, {
        destination,
        country,
        customers: new Set(d.customer ? [d.customer] : []),
        qty: d.qty,
        deliveryCount: 1,
      });
    }
  }

  return Array.from(byKey.entries()).map(([key, v]) => ({
    key,
    destination: v.destination,
    country: v.country,
    customers: Array.from(v.customers).sort(),
    qty: v.qty,
    deliveryCount: v.deliveryCount,
    uom,
  }));
}

function DeliveriesTab({
  deliveries, batch, sim,
}: {
  deliveries: Delivery[];
  batch: Batch;
  sim: boolean;
}) {
  const sorted = [...deliveries].sort((a, b) => (a.date < b.date ? 1 : -1));
  const { language } = useI18n();
  const copy = traceCopy(language);

  return (
    <Card title={template(copy.customers.deliveryCountTitle, { count: deliveries.length })}>
      <DataTable
        columns={[
          { header: copy.common.delivery, key: "delivery", mono: true, width: 120 },
          { header: copy.common.customer, key: "customer" },
          { header: copy.common.destination, key: "destination" },
          { header: copy.common.country, render: (r) => <span>{flag(r.country)} {r.country}</span>, width: 90 },
          { header: copy.common.date, key: "date", mono: true },
          { header: copy.common.qty, align: "right", num: true, render: (r) => `${fmtN(r.qty)} ${batch.uom}` },
          { header: copy.common.status, render: (r) => <StatusPill status={r.status} size="sm" />, width: 130 },
          { header: copy.common.doc, key: "doc", mono: true, muted: true },
        ]}
        rows={sorted}
        rowKey={(r) => r.delivery}
        emphasize={(r) => sim && r.status === "IN_TRANSIT"}
      />
    </Card>
  );
}
