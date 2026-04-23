import type {
  Batch,
  CountryRow,
  CustomerRow,
  Delivery,
  PageId,
  RecallEvent,
} from "../types";
import { fetchOverview } from "../data/api";
import { useBatchData } from "../data/useBatchData";
import { LoadFrame } from "../components/LoadFrame";
import {
  BarChart, Button, Card, DataTable, KPI,
  SectionHeader, StatusPill, fmtN, fmtInt, flag,
} from "../ui";

export function PageOverview({
  batch: headerBatch,
  sim,
  onSim,
}: {
  batch: Batch;
  navigate: (id: PageId) => void;
  sim?: boolean;
  onSim?: (v: boolean) => void;
}) {
  const state = useBatchData(fetchOverview, headerBatch.material_id, headerBatch.batch_id);
  return (
    <LoadFrame
      state={state}
      eyebrow="01 — OVERVIEW"
      loadingTitle="Loading batch overview…"
      loadingSubtitle={`Material ${headerBatch.material_id} · Batch ${headerBatch.batch_id}`}
    >
      {({ batch, countries, customers, deliveries, events }) => (
        <OverviewBody
          batch={batch}
          countries={countries}
          customers={customers}
          deliveries={deliveries}
          events={events}
          sim={sim ?? false}
          onSim={onSim ?? (() => {})}
        />
      )}
    </LoadFrame>
  );
}

function MiniMassBalanceChart({ events, height = 160 }: { events: RecallEvent[]; height?: number }) {
  if (!events.length) return null;

  // Build time-series: production = +qty, others = -qty
  const points = events.map((e) => ({
    delta: e.category === "PRODUCTION" ? e.qty : -e.qty,
  }));

  let running = 0;
  const cumValues = points.map((p) => {
    running += p.delta;
    return running;
  });

  const minV = Math.min(0, ...cumValues);
  const maxV = Math.max(...cumValues, 1);
  const range = maxV - minV || 1;
  const w = 560;
  const h = height;
  const pad = { top: 12, bottom: 12, left: 4, right: 4 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  function xPct(i: number) {
    return pad.left + (i / Math.max(cumValues.length - 1, 1)) * plotW;
  }
  function yPct(v: number) {
    return pad.top + plotH - ((v - minV) / range) * plotH;
  }

  const pathD = cumValues
    .map((v, i) => `${i === 0 ? "M" : "L"} ${xPct(i).toFixed(1)} ${yPct(v).toFixed(1)}`)
    .join(" ");

  const areaD = `${pathD} L ${xPct(cumValues.length - 1).toFixed(1)} ${(pad.top + plotH).toFixed(1)} L ${pad.left} ${(pad.top + plotH).toFixed(1)} Z`;

  const gradId = "mbg-ov";
  const zeroY = yPct(0);

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--valentia-slate)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--valentia-slate)" stopOpacity="0.03" />
        </linearGradient>
      </defs>
      {/* zero line */}
      {zeroY > pad.top && zeroY < pad.top + plotH && (
        <line x1={pad.left} y1={zeroY} x2={pad.left + plotW} y2={zeroY}
          stroke="var(--line-2)" strokeWidth={1} strokeDasharray="3,3" />
      )}
      <path d={areaD} fill={`url(#${gradId})`} />
      <path d={pathD} fill="none" stroke="var(--valentia-slate)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function OverviewBody({
  batch, countries, customers, deliveries, events, sim, onSim,
}: {
  batch: Batch;
  countries: CountryRow[];
  customers: CustomerRow[];
  deliveries: Delivery[];
  events: RecallEvent[];
  sim: boolean;
  onSim: (v: boolean) => void;
}) {
  const recentDeliveries = [...deliveries]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 8);

  const topCustomers = [...customers]
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 8);

  return (
    <div>
      <SectionHeader
        eyebrow="Batch 360°"
        title="One batch. Every movement, mass-balance and downstream exposure."
        subtitle={`Batch ${batch.batch_id} · ${batch.material_desc40} · ${batch.plant_name || batch.plant_id} · Manufactured ${batch.manufacture_date}`}
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="ghost" size="md">Print 360° brief</Button>
            <Button
              variant="danger"
              size="md"
              active={sim}
              onClick={() => onSim(!sim)}
            >
              {sim ? "Exit simulation" : "Simulate recall"}
            </Button>
          </div>
        }
      />

      {/* 6-KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginBottom: 28 }}>
        <KPI
          label="Qty produced"
          value={fmtInt(batch.qty_produced)}
          unit={batch.uom}
          tone="brand"
        />
        <KPI
          label="Unrestricted"
          value={fmtInt(batch.unrestricted)}
          unit={batch.uom}
          tone="good"
        />
        <KPI
          label="Qty shipped"
          value={fmtInt(batch.qty_shipped)}
          unit={batch.uom}
          tone="default"
        />
        <KPI
          label="Qty consumed"
          value={fmtInt(batch.qty_consumed)}
          unit={batch.uom}
          tone="default"
        />
        <KPI
          label="Customers exposed"
          value={fmtInt(batch.customers_affected)}
          tone={sim ? "bad" : "warn"}
          sub={`${batch.countries_affected} countr${batch.countries_affected === 1 ? "y" : "ies"}`}
        />
        <KPI
          label="Days to expiry"
          value={batch.days_to_expiry >= 0 ? fmtInt(batch.days_to_expiry) : "Expired"}
          tone={batch.days_to_expiry < 0 ? "bad" : batch.days_to_expiry < 30 ? "warn" : "good"}
          sub={batch.expiry_date}
        />
      </div>

      {/* Mass balance chart + Batch identity card */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, marginBottom: 20 }}>
        <Card title="Mass balance timeline" subtitle="Cumulative stock movement across production, shipments and consumption">
          <div style={{ padding: "12px 16px 16px" }}>
            <MiniMassBalanceChart events={events} height={170} />
          </div>
        </Card>

        <Card title="Batch identity">
          <div style={{ padding: "4px 0" }}>
            {[
              { k: "Material ID", v: batch.material_id, mono: true },
              { k: "Material", v: batch.material_name || batch.material_id, mono: false },
              { k: "Batch", v: batch.batch_id, mono: true },
              { k: "Process order", v: batch.process_order || "—", mono: true },
              { k: "Plant", v: `${batch.plant_id} · ${batch.plant_name}`, mono: false },
              { k: "Manufactured", v: batch.manufacture_date, mono: true },
              { k: "Expiry", v: batch.expiry_date, mono: true },
              { k: "Status", v: <StatusPill status={batch.batch_status} size="sm" />, mono: false },
            ].map(({ k, v, mono }) => (
              <div key={k} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "8px 18px",
                borderBottom: "1px solid var(--line)",
              }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{k}</span>
                <span style={{ fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)", fontSize: 12, color: "var(--ink)", fontWeight: 500 }}>{v as any}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Country + customer bar charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        <Card title="Countries reached" subtitle={`${countries.length} countr${countries.length === 1 ? "y" : "ies"} across ${batch.total_deliveries} deliveries`}>
          <div style={{ padding: "12px 18px" }}>
            <BarChart
              data={countries}
              valueKey="qty"
              labelKey="name"
              subKey="code"
              color={sim ? "var(--sunset)" : "var(--valentia-slate)"}
              format={(v) => `${fmtN(v)} ${batch.uom}`}
              height={Math.min(countries.length * 32, 280)}
            />
          </div>
        </Card>

        <Card title="Top customers" subtitle={`${customers.length} customer${customers.length === 1 ? "" : "s"} · ${fmtN(batch.total_shipped_kg)} ${batch.uom} total`}>
          <div style={{ padding: "12px 18px" }}>
            <BarChart
              data={topCustomers}
              valueKey="qty"
              labelKey="name"
              subKey="country"
              color={sim ? "var(--sunset)" : "var(--sage)"}
              format={(v) => `${fmtN(v)} ${batch.uom}`}
              height={Math.min(topCustomers.length * 32, 280)}
            />
          </div>
        </Card>
      </div>

      {/* Recent deliveries */}
      <Card title="Recent deliveries" subtitle="Last 8 deliveries by date">
        <DataTable
          columns={[
            { header: "Delivery", key: "delivery", mono: true, width: 120 },
            { header: "Customer", key: "customer" },
            { header: "Destination", key: "destination" },
            { header: "Country", render: (r) => <span>{flag(r.country)} {r.country}</span>, width: 80 },
            { header: "Date", key: "date", mono: true },
            { header: "Qty", key: "qty", align: "right", num: true, render: (r) => `${fmtN(r.qty)} ${batch.uom}` },
            { header: "Status", render: (r) => <StatusPill status={r.status} size="sm" />, width: 130 },
          ]}
          rows={recentDeliveries}
          rowKey={(r) => r.delivery}
        />
      </Card>
    </div>
  );
}
