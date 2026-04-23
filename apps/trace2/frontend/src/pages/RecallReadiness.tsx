import { useState } from "react";
import type {
  Batch,
  CountryRow,
  CustomerRow,
  Delivery,
  ExposureRow,
  PageId,
  RecallEvent,
} from "../types";
import { fetchRecallReadiness } from "../data/api";
import { useBatchData } from "../data/useBatchData";
import { LoadFrame, EmptyBlock } from "../components/LoadFrame";
import {
  BarChart, Button, Card, DataTable, Donut, KPI,
  SectionHeader, StatusPill, flag, fmtN,
} from "../ui";

export function PageRecallReadiness({
  batch: headerBatch,
  sim,
  onSim,
}: {
  batch: Batch;
  navigate: (id: PageId) => void;
  sim?: boolean;
  onSim?: (v: boolean) => void;
}) {
  const state = useBatchData(fetchRecallReadiness, headerBatch.material_id, headerBatch.batch_id);
  return (
    <LoadFrame
      state={state}
      eyebrow="10 — ISSUE READINESS"
      loadingTitle="Loading batch exposure…"
      loadingSubtitle={`Material ${headerBatch.material_id} · Batch ${headerBatch.batch_id}`}
    >
      {({ batch, countries, customers, deliveries, exposure, events }) => (
        <RecallReadinessBody
          batch={batch}
          countries={countries}
          customers={customers}
          deliveries={deliveries}
          exposure={exposure}
          events={events}
          sim={sim ?? false}
          onSim={onSim ?? (() => {})}
        />
      )}
    </LoadFrame>
  );
}

function RecallReadinessBody({
  batch,
  countries,
  customers,
  deliveries,
  exposure,
  events,
  sim,
  onSim,
}: {
  batch: Batch;
  countries: CountryRow[];
  customers: CustomerRow[];
  deliveries: Delivery[];
  exposure: ExposureRow[];
  events: RecallEvent[];
  sim: boolean;
  onSim: (v: boolean) => void;
}) {
  const [riskFilter, setRiskFilter] = useState<"ALL" | "CRITICAL" | "HIGH" | "MEDIUM">("ALL");

  const filteredExposure = riskFilter === "ALL" ? exposure : exposure.filter((e) => e.risk === riskFilter);
  const exposedBatches = exposure.length;
  const criticalBatches = exposure.filter((e) => e.risk === "CRITICAL").length;
  const highRiskShipped = exposure
    .filter((e) => e.risk === "CRITICAL" || e.risk === "HIGH")
    .reduce((s, e) => s + e.shipped, 0);
  const exposedStock = exposure.reduce((s, e) => s + e.stock, 0);
  const exposedCustomers = new Set(deliveries.map((d) => d.customer)).size;

  return (
    <div>
      <SectionHeader
        eyebrow="10 — ISSUE READINESS"
        title="If this batch were recalled today, where would it land?"
        subtitle="All downstream consumption, transfers and customer shipments that inherit material from this batch, with risk-tiered exposure and a reconstructable event timeline."
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="ghost" size="md" icon={<span>⎙</span>}>Export dossier</Button>
            <Button variant="danger" size="md" onClick={() => onSim(!sim)} active={sim}>
              {sim ? "Cancel simulation" : "Simulate recall"}
            </Button>
          </div>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginBottom: 12 }}>
        <KPI label="Batch status" value={<StatusPill status={batch.batch_status} />} />
        <KPI label="Days to expiry" value={batch.days_to_expiry} unit="days" sub={batch.manufacture_date + " → " + batch.expiry_date} />
        <KPI label="Unrestricted" value={fmtN(batch.unrestricted, 1)} unit="KG" tone="good" />
        <KPI label="Blocked" value={fmtN(batch.blocked, 0)} unit="KG" tone={batch.blocked > 0 ? "bad" : "muted"} />
        <KPI label="Quality inspection" value={fmtN(batch.qi, 0)} unit="KG" tone={batch.qi > 0 ? "warn" : "muted"} />
        <KPI label="Process order" value={<span style={{ fontFamily: "var(--font-mono)", fontSize: 15 }}>{batch.process_order || "—"}</span>} sub={batch.plant_name} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginBottom: 28 }}>
        <KPI label="Customers affected" value={batch.customers_affected} tone={sim ? "bad" : "default"} />
        <KPI label="Countries affected" value={batch.countries_affected} tone={sim ? "bad" : "default"} />
        <KPI label="Total shipped" value={fmtN(batch.total_shipped_kg, 1)} unit="KG" tone={sim ? "bad" : "default"} />
        <KPI label="Deliveries" value={batch.total_deliveries} />
        <KPI label="Consumed internally" value={fmtN(batch.total_consumed, 1)} unit="KG" />
        <KPI label="Consuming POs" value={batch.consuming_pos} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 28 }}>
        <Card title="Shipped volume by country" subtitle="Where material from this batch has landed">
          {countries.length === 0 ? (
            <EmptyBlock message="No customer shipments recorded for this batch." />
          ) : (
            <BarChart
              data={countries}
              valueKey="qty"
              labelKey="name"
              height={280}
              color={sim ? "var(--sunset)" : "var(--valentia-slate)"}
              format={(v) => fmtN(v, 0) + " KG"}
            />
          )}
        </Card>

        <Card title="Despatched by customer" subtitle="Share of total shipped quantity">
          {customers.length === 0 ? (
            <EmptyBlock message="No customer-level despatch data available." />
          ) : (
            <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
              <Donut
                data={customers.slice(0, 8)}
                valueKey="qty"
                labelKey="name"
                size={200}
                centerValue={fmtN(batch.total_shipped_kg, 0)}
                centerLabel="KG DESPATCHED"
              />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                {customers.slice(0, 8).map((c, i) => (
                  <div key={c.id || c.name || i} style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--font-sans)", fontSize: 11.5 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: ["#005776","#289BA2","#44CF93","#F9C20A","#F24A00","#003C52","#6A9C4D","#A4CFD8"][i] }} />
                    <span style={{ flex: 1, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--ink-2)", fontVariantNumeric: "tabular-nums" }}>{(c.share * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      </div>

      <Card title="Customer shipment events" subtitle={`${deliveries.length} deliveries · sorted by date`} noPad style={{ marginBottom: 28 }}>
        {deliveries.length === 0 ? (
          <EmptyBlock message="No deliveries have been posted for this batch." />
        ) : (
          <DataTable columns={[
            { header: "Delivery", key: "delivery", mono: true },
            { header: "Customer", key: "customer" },
            { header: "Destination", key: "destination", muted: true },
            { header: "Country", mono: true, render: (r) => <span>{r.country ? `${flag(r.country)} ${r.country}` : "—"}</span> },
            { header: "Date", key: "date", mono: true, muted: true },
            { header: `Qty (${batch.uom})`, align: "right", mono: true, num: true, render: (r) => fmtN(r.qty, 1) },
            { header: "Status", render: (r) => <StatusPill status={r.status} size="sm" /> },
            { header: "Doc", key: "doc", mono: true, muted: true },
          ]} rows={deliveries}
            emphasize={(r) => sim && r.status !== "PLANNED"}
          />
        )}
      </Card>

      <SectionHeader
        eyebrow="BLAST RADIUS"
        title="Cross-batch exposure"
        subtitle="All batches that consumed material from this one. Tier 1 are direct descendants; Tier 2 are finished goods already in market."
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 16 }}>
        <KPI label="Exposed batches" value={exposedBatches} tone={sim ? "bad" : "default"} />
        <KPI label="Critical tier" value={criticalBatches} tone={sim ? "bad" : "warn"} />
        <KPI label="High-risk shipped" value={fmtN(highRiskShipped, 0)} unit="KG" tone={sim ? "bad" : "warn"} />
        <KPI label="Exposed stock" value={fmtN(exposedStock, 0)} unit="KG" />
        <KPI label="Exposed customers" value={exposedCustomers} />
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Filter by risk:</span>
        {(["ALL", "CRITICAL", "HIGH", "MEDIUM"] as const).map((r) => (
          <Button key={r} variant="ghost" size="sm" active={riskFilter === r} onClick={() => setRiskFilter(r)}>{r}</Button>
        ))}
      </div>

      <Card noPad style={{ marginBottom: 28 }}>
        {filteredExposure.length === 0 ? (
          <EmptyBlock message={exposure.length === 0 ? "No downstream batches inherit material from this batch." : "No batches match the current risk filter."} />
        ) : (
          <DataTable columns={[
            { header: "Material", key: "material" },
            { header: "Batch", key: "batch", mono: true },
            { header: "Plant", key: "plant", mono: true, muted: true },
            { header: "Qty", align: "right", mono: true, num: true, render: (r) => fmtN(r.qty, 0) + " KG" },
            { header: "In stock", align: "right", mono: true, num: true, render: (r) => fmtN(r.stock, 0) },
            { header: "Shipped", align: "right", mono: true, num: true, render: (r) => fmtN(r.shipped, 0) },
            { header: "Depth", align: "center", mono: true, render: (r) => "L" + r.path_depth },
            { header: "Status", render: (r) => <StatusPill status={r.status} size="sm" /> },
            { header: "Risk", render: (r) => <StatusPill status={r.risk} size="sm" /> },
          ]} rows={filteredExposure}
            emphasize={(r) => sim && (r.risk === "CRITICAL" || r.risk === "HIGH")}
          />
        )}
      </Card>

      <Card title="Batch movement timeline" subtitle="Reconstructs every posting that moved material from this batch — ready for regulatory submission">
        {events.length === 0 ? (
          <EmptyBlock message="No postings recorded for this batch." />
        ) : (
          <MovementTimeline events={events} sim={sim} batch={batch} />
        )}
      </Card>
    </div>
  );
}

function MovementTimeline({ events, sim, batch }: { events: RecallEvent[]; sim: boolean; batch: Batch }) {
  const categoryColor: Record<string, string> = {
    PRODUCTION: "var(--jade)",
    CONSUMPTION: "var(--sage)",
    SALES_ISSUE: "var(--sunset)",
    ADJUSTMENT: "var(--sunrise)",
  };
  const maxMag = Math.max(1, ...events.map((e) => Math.abs(e.qty)));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {events.map((e, i) => {
        const pct = (Math.abs(e.qty) / maxMag) * 100;
        const positive = e.category === "PRODUCTION";
        const color = sim && e.category === "SALES_ISSUE" ? "var(--sunset)" : categoryColor[e.category];
        return (
          <div key={i} style={{
            display: "grid", gridTemplateColumns: "90px 160px 1fr 120px",
            gap: 14, alignItems: "center",
            padding: "10px 0", borderBottom: i === events.length - 1 ? "none" : "1px solid var(--line)",
          }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--ink-2)" }}>{e.date}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: color }} />
              <span style={{ fontFamily: "var(--font-sans)", fontSize: 11.5, color: "var(--ink)", textTransform: "capitalize" }}>
                {e.category.replace("_", " ").toLowerCase()}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--ink-3)" }}>{e.type}</span>
            </div>
            <div style={{ position: "relative", height: 18 }}>
              <div style={{
                position: "absolute", top: 6, height: 6,
                left: positive ? "50%" : `${50 - pct / 2}%`,
                width: `${pct / 2}%`,
                background: color,
                opacity: 0.75,
              }} />
              <div style={{ position: "absolute", top: 0, left: "50%", bottom: 0, width: 1, background: "var(--line-2)" }} />
              <div style={{
                position: "absolute", top: 0,
                left: positive ? `${50 + pct / 2 + 1}%` : "52%",
                fontFamily: "var(--font-sans)", fontSize: 11, color: "var(--ink-2)",
                whiteSpace: "nowrap",
              }}>
                {e.customer || e.plant}{e.country ? ` · ${e.country}` : ""}
              </div>
            </div>
            <div style={{
              fontFamily: "var(--font-mono)", fontSize: 11.5,
              fontVariantNumeric: "tabular-nums", textAlign: "right",
              color: positive ? "var(--jade)" : "var(--sunset)",
            }}>
              {positive ? "+" : ""}{fmtN(e.qty, 1)} {e.uom || batch.uom}
            </div>
          </div>
        );
      })}
    </div>
  );
}
