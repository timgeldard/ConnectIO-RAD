import type {
  Batch,
  CountryRow,
  CustomerRow,
  Delivery,
  MassBalanceEvent,
  PageId,
} from "../types";
import { useI18n } from "@connectio/shared-frontend-i18n";
import { fetchOverview, fetchMassBalance } from "../data/api";
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
  const { t } = useI18n();
  const state = useBatchData(fetchOverview, headerBatch.material_id, headerBatch.batch_id);
  const mbState = useBatchData(fetchMassBalance, headerBatch.material_id, headerBatch.batch_id);
  return (
    <LoadFrame
      state={state}
      eyebrow={t("trace.overview.eyebrow")}
      loadingTitle={t("trace.overview.loadingTitle")}
      loadingSubtitle={t("trace.overview.loadingSubtitle", {
        material: headerBatch.material_id,
        batch: headerBatch.batch_id,
      })}
    >
      {({ batch, countries, customers, deliveries }) => (
        <OverviewBody
          batch={batch}
          countries={countries}
          customers={customers}
          deliveries={deliveries}
          mbEvents={mbState.kind === "ready" ? mbState.data.events : []}
          sim={sim ?? false}
          onSim={onSim ?? (() => {})}
        />
      )}
    </LoadFrame>
  );
}

function MiniInventoryChart({ data, height = 170 }: { data: MassBalanceEvent[]; height?: number }) {
  if (data.length < 2) return null;
  const width = 560;
  const pad = { l: 4, r: 4, t: 12, b: 12 };
  const plotH = height - pad.t - pad.b;
  const max = Math.max(1, ...data.map((d) => d.cum)) * 1.05;
  const min = Math.min(0, ...data.map((d) => d.cum));
  const range = max - min || 1;
  const xStep = (width - pad.l - pad.r) / (data.length - 1);
  const points = data.map((d, i) => [
    pad.l + i * xStep,
    pad.t + plotH - ((d.cum - min) / range) * plotH,
  ] as [number, number]);
  const pathD = "M " + points.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" L ");
  const last = points[points.length - 1];
  const areaD = `${pathD} L ${last[0].toFixed(1)} ${(pad.t + plotH).toFixed(1)} L ${pad.l} ${(pad.t + plotH).toFixed(1)} Z`;

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id="mbg-ov" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--valentia-slate)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--valentia-slate)" stopOpacity="0.03" />
        </linearGradient>
      </defs>
      <path d={areaD} fill="url(#mbg-ov)" />
      <path d={pathD} fill="none" stroke="var(--valentia-slate)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function OverviewBody({
  batch, countries, customers, deliveries, mbEvents, sim, onSim,
}: {
  batch: Batch;
  countries: CountryRow[];
  customers: CustomerRow[];
  deliveries: Delivery[];
  mbEvents: MassBalanceEvent[];
  sim: boolean;
  onSim: (v: boolean) => void;
}) {
  const { t } = useI18n();
  const recentDeliveries = [...deliveries]
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, 8);

  const topCustomers = [...customers]
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 8);

  return (
    <div>
      <SectionHeader
        eyebrow={t("trace.overview.header.eyebrow")}
        title={t("trace.overview.header.title")}
        subtitle={t("trace.overview.header.subtitle", {
          batch: batch.batch_id,
          material: batch.material_desc40,
          plant: batch.plant_name || batch.plant_id,
          date: batch.manufacture_date,
        })}
        action={
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="ghost" size="md">{t("trace.overview.action.print")}</Button>
            <Button
              variant="danger"
              size="md"
              active={sim}
              onClick={() => onSim(!sim)}
            >
              {sim ? t("trace.overview.action.exitSimulation") : t("trace.overview.action.simulateRecall")}
            </Button>
          </div>
        }
      />

      {/* 6-KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginBottom: 28 }}>
        <KPI
          label={t("trace.metric.qtyProduced")}
          value={fmtInt(batch.qty_produced)}
          unit={batch.uom}
          tone="brand"
        />
        <KPI
          label={t("trace.metric.unrestricted")}
          value={fmtInt(batch.unrestricted)}
          unit={batch.uom}
          tone="good"
        />
        <KPI
          label={t("trace.metric.qtyShipped")}
          value={fmtInt(batch.qty_shipped)}
          unit={batch.uom}
          tone="default"
        />
        <KPI
          label={t("trace.metric.qtyConsumed")}
          value={fmtInt(batch.qty_consumed)}
          unit={batch.uom}
          tone="default"
        />
        <KPI
          label={t("trace.metric.customersExposed")}
          value={fmtInt(batch.customers_affected)}
          tone={sim ? "bad" : "warn"}
          sub={t(batch.countries_affected === 1 ? "trace.metric.country.one" : "trace.metric.country.other", { count: batch.countries_affected })}
        />
        <KPI
          label={t("trace.metric.daysToExpiry")}
          value={batch.days_to_expiry >= 0 ? fmtInt(batch.days_to_expiry) : t("trace.metric.expired")}
          tone={batch.days_to_expiry < 0 ? "bad" : batch.days_to_expiry < 30 ? "warn" : "good"}
          sub={batch.expiry_date}
        />
      </div>

      {/* Mass balance chart + Batch identity card */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, marginBottom: 20 }}>
        <Card title={t("trace.overview.massBalance.title")} subtitle={t("trace.overview.massBalance.subtitle")}>
          <div style={{ padding: "12px 16px 16px" }}>
            {mbEvents.length < 2 ? (
              <div style={{ height: 170, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-3)" }}>
                {t("trace.overview.massBalance.noData")}
              </div>
            ) : (
              <MiniInventoryChart data={mbEvents} height={170} />
            )}
          </div>
        </Card>

        <Card title={t("trace.overview.identity.title")}>
          <div style={{ padding: "4px 0" }}>
            {[
              { k: t("trace.field.materialId"), v: batch.material_id, mono: true },
              { k: t("trace.field.material"), v: batch.material_name || batch.material_id, mono: false },
              { k: t("trace.field.batch"), v: batch.batch_id, mono: true },
              { k: t("trace.field.processOrder"), v: batch.process_order || "—", mono: true },
              { k: t("trace.field.plant"), v: `${batch.plant_id} · ${batch.plant_name}`, mono: false },
              { k: t("trace.field.manufactured"), v: batch.manufacture_date, mono: true },
              { k: t("trace.field.expiry"), v: batch.expiry_date, mono: true },
              { k: t("trace.field.status"), v: <StatusPill status={batch.batch_status} size="sm" />, mono: false },
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
        <Card title={t("trace.overview.countries.title")} subtitle={t(countries.length === 1 ? "trace.overview.countries.subtitle.one" : "trace.overview.countries.subtitle.other", { countries: countries.length, deliveries: batch.total_deliveries })}>
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

        <Card title={t("trace.overview.customers.title")} subtitle={t(customers.length === 1 ? "trace.overview.customers.subtitle.one" : "trace.overview.customers.subtitle.other", { customers: customers.length, quantity: fmtN(batch.total_shipped_kg), uom: batch.uom })}>
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
      <Card title={t("trace.overview.deliveries.title")} subtitle={t("trace.overview.deliveries.subtitle")}>
        <DataTable
          columns={[
            { header: t("trace.field.delivery"), key: "delivery", mono: true, width: 120 },
            { header: t("trace.field.customer"), key: "customer" },
            { header: t("trace.field.destination"), key: "destination" },
            { header: t("trace.field.country"), render: (r) => <span>{flag(r.country)} {r.country}</span>, width: 80 },
            { header: t("trace.field.date"), key: "date", mono: true },
            { header: t("trace.field.qtyWithUom", { uom: batch.uom }), key: "qty", align: "right", num: true, render: (r) => `${fmtN(r.qty)} ${batch.uom}` },
            { header: t("trace.field.status"), render: (r) => <StatusPill status={r.status} size="sm" />, width: 130 },
          ]}
          rows={recentDeliveries}
          rowKey={(r) => r.delivery}
        />
      </Card>
    </div>
  );
}
