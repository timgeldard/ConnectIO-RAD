import type { Batch, MassBalanceEvent } from "../types";
import { fetchMassBalance } from "../data/api";
import { useBatchData } from "../data/useBatchData";
import { LoadFrame, EmptyBlock } from "../components/LoadFrame";
import { Card, KPI, SectionHeader, fmtN } from "../ui";
import { useI18n } from "@connectio/shared-frontend-i18n";
import { template, traceCopy } from "../i18n/pageCopy";

function MBChart({ data }: { data: MassBalanceEvent[] }) {
  const width = 1100;
  const height = 280;
  const pad = { l: 60, r: 20, t: 20, b: 40 };
  const maxAbs = Math.max(1, ...data.map((d) => Math.abs(d.delta)));
  const barW = (width - pad.l - pad.r) / Math.max(data.length, 1) - 4;
  const midY = pad.t + (height - pad.t - pad.b) / 2;
  const scale = (height - pad.t - pad.b) / 2 / maxAbs;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto" }}>
      <line x1={pad.l} x2={width - pad.r} y1={midY} y2={midY} stroke="var(--ink-3)" strokeWidth={0.5} />
      {data.map((d, i) => {
        const x = pad.l + i * ((width - pad.l - pad.r) / data.length) + 2;
        const h = Math.abs(d.delta) * scale;
        const positive = d.delta >= 0;
        return (
          <g key={i}>
            <rect
              x={x}
              y={positive ? midY - h : midY}
              width={barW}
              height={Math.max(h, 1)}
              fill={positive ? "var(--jade)" : "color-mix(in srgb, var(--sunset) 80%, transparent)"}
            />
            {i % Math.max(1, Math.floor(data.length / 15)) === 0 && (
              <text
                x={x + barW / 2}
                y={height - pad.b + 14}
                textAnchor="middle"
                style={{ fontFamily: "var(--font-mono)", fontSize: 9, fill: "var(--ink-3)" }}
              >
                {d.date.slice(0, 6)}
              </text>
            )}
          </g>
        );
      })}
      <text x={pad.l - 8} y={midY} textAnchor="end" dy="0.35em" style={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: "var(--ink-3)" }}>0</text>
      <text x={pad.l - 8} y={pad.t + 6} textAnchor="end" style={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: "var(--ink-3)" }}>+{fmtN(maxAbs, 0)}</text>
      <text x={pad.l - 8} y={height - pad.b} textAnchor="end" style={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: "var(--ink-3)" }}>−{fmtN(maxAbs, 0)}</text>
    </svg>
  );
}

function InventoryChart({ data }: { data: MassBalanceEvent[] }) {
  if (data.length < 2) return null;
  const width = 1100;
  const height = 260;
  const pad = { l: 60, r: 20, t: 20, b: 40 };
  const max = Math.max(1, ...data.map((d) => d.cum)) * 1.05;
  const xStep = (width - pad.l - pad.r) / (data.length - 1);
  const yScale = (height - pad.t - pad.b) / max;
  const points = data.map((d, i) => [pad.l + i * xStep, height - pad.b - Math.max(0, d.cum) * yScale] as [number, number]);
  const pathD = "M " + points.map((p) => p.join(" ")).join(" L ");
  const last = points[points.length - 1];
  const areaD = pathD + ` L ${last[0]} ${height - pad.b} L ${pad.l} ${height - pad.b} Z`;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto" }}>
      {[0, 0.25, 0.5, 0.75, 1].map((f) => {
        const y = height - pad.b - max * f * yScale;
        return (
          <g key={f}>
            <line x1={pad.l} x2={width - pad.r} y1={y} y2={y} stroke="var(--line)" strokeWidth={0.5} />
            <text x={pad.l - 8} y={y} textAnchor="end" dy="0.35em" style={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: "var(--ink-3)" }}>
              {fmtN(max * f, 0)}
            </text>
          </g>
        );
      })}
      <path d={areaD} fill="color-mix(in srgb, var(--valentia-slate) 12%, transparent)" />
      <path d={pathD} fill="none" stroke="var(--valentia-slate)" strokeWidth={1.5} />
      {points.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={2.5} fill="var(--valentia-slate)" />
      ))}
      {data.map((d, i) =>
        i % Math.max(1, Math.floor(data.length / 10)) === 0 ? (
          <text
            key={i}
            x={pad.l + i * xStep}
            y={height - pad.b + 14}
            textAnchor="middle"
            style={{ fontFamily: "var(--font-mono)", fontSize: 9, fill: "var(--ink-3)" }}
          >
            {d.date.slice(0, 6)}
          </text>
        ) : null,
      )}
    </svg>
  );
}

export function PageMassBalance({ batch: headerBatch }: { batch: Batch }) {
  const { language } = useI18n();
  const copy = traceCopy(language);
  const state = useBatchData(fetchMassBalance, headerBatch.material_id, headerBatch.batch_id);
  return (
    <LoadFrame
      state={state}
      eyebrow={copy.mass.eyebrow}
      loadingTitle={copy.mass.loading}
      loadingSubtitle={template(copy.common.loadingSubtitle, { material: headerBatch.material_id, batch: headerBatch.batch_id })}
    >
      {({ batch, events }) => {
        const variance = batch.qty_produced - batch.qty_shipped - batch.qty_consumed + batch.qty_adjusted - batch.current_stock;
        return (
          <div>
            <SectionHeader
              eyebrow={copy.mass.eyebrow}
              title={copy.mass.title}
              subtitle={copy.mass.subtitle}
            />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 12 }}>
              <KPI label={copy.mass.qtyProduced} value={fmtN(batch.qty_produced, 1)} unit={copy.common.kg} tone="good" />
              <KPI label={copy.mass.qtyConsumed} value={fmtN(batch.qty_consumed, 1)} unit={copy.common.kg} />
              <KPI label={copy.mass.qtyShipped} value={fmtN(batch.qty_shipped, 1)} unit={copy.common.kg} />
              <KPI label={copy.mass.qtyAdjusted} value={fmtN(batch.qty_adjusted, 1)} unit={copy.common.kg} tone={batch.qty_adjusted !== 0 ? "warn" : "muted"} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
              <KPI label={copy.mass.balance} value={fmtN(batch.qty_produced, 1)} unit={copy.common.kg} large />
              <KPI label={copy.mass.currentStock} value={fmtN(batch.current_stock, 1)} unit={copy.common.kg} large tone="good" />
              <KPI
                label={copy.mass.variance}
                value={fmtN(variance, 2)}
                unit={copy.common.kg}
                large
                tone={Math.abs(variance) < 0.01 ? "good" : "bad"}
                sub={Math.abs(variance) < 0.01 ? copy.mass.reconciled : copy.mass.investigate}
              />
            </div>
            {events.length === 0 ? (
              <Card title={copy.mass.timeline}>
                <EmptyBlock message={copy.mass.noPostings} />
              </Card>
            ) : (
              <>
                <Card title={copy.mass.timeline} subtitle={copy.mass.deltaSubtitle} style={{ marginBottom: 20 }}>
                  <MBChart data={events} />
                </Card>
                <Card title={copy.mass.inventoryTitle} subtitle={copy.mass.inventorySubtitle}>
                  <InventoryChart data={events} />
                </Card>
              </>
            )}
          </div>
        );
      }}
    </LoadFrame>
  );
}
