import type { Batch, MassBalanceEvent } from "../types";
import { fetchMassBalance } from "../data/api";
import { useBatchData } from "../data/useBatchData";
import { LoadFrame, EmptyBlock } from "../components/LoadFrame";
import { Card, KPI, SectionHeader, fmtN } from "../ui";

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
              fill={positive ? "oklch(48% 0.09 155)" : "oklch(55% 0.13 40 / 0.8)"}
            />
            {i % Math.max(1, Math.floor(data.length / 15)) === 0 && (
              <text
                x={x + barW / 2}
                y={height - pad.b + 14}
                textAnchor="middle"
                style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fill: "var(--ink-3)" }}
              >
                {d.date.slice(0, 6)}
              </text>
            )}
          </g>
        );
      })}
      <text x={pad.l - 8} y={midY} textAnchor="end" dy="0.35em" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fill: "var(--ink-3)" }}>0</text>
      <text x={pad.l - 8} y={pad.t + 6} textAnchor="end" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fill: "var(--ink-3)" }}>+{fmtN(maxAbs, 0)}</text>
      <text x={pad.l - 8} y={height - pad.b} textAnchor="end" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fill: "var(--ink-3)" }}>−{fmtN(maxAbs, 0)}</text>
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
            <text x={pad.l - 8} y={y} textAnchor="end" dy="0.35em" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fill: "var(--ink-3)" }}>
              {fmtN(max * f, 0)}
            </text>
          </g>
        );
      })}
      <path d={areaD} fill="oklch(48% 0.09 155 / 0.12)" />
      <path d={pathD} fill="none" stroke="oklch(38% 0.06 155)" strokeWidth={1.5} />
      {points.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={2.5} fill="oklch(38% 0.06 155)" />
      ))}
      {data.map((d, i) =>
        i % Math.max(1, Math.floor(data.length / 10)) === 0 ? (
          <text
            key={i}
            x={pad.l + i * xStep}
            y={height - pad.b + 14}
            textAnchor="middle"
            style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fill: "var(--ink-3)" }}
          >
            {d.date.slice(0, 6)}
          </text>
        ) : null,
      )}
    </svg>
  );
}

export function PageMassBalance({ batch: headerBatch }: { batch: Batch }) {
  const state = useBatchData(fetchMassBalance, headerBatch.material_id, headerBatch.batch_id);
  return (
    <LoadFrame
      state={state}
      eyebrow="04 — MASS BALANCE"
      loadingTitle="Loading mass balance…"
      loadingSubtitle={`Material ${headerBatch.material_id} · Batch ${headerBatch.batch_id}`}
    >
      {({ batch, events }) => {
        const variance = batch.qty_produced - batch.qty_shipped - batch.qty_consumed + batch.qty_adjusted - batch.current_stock;
        return (
          <div>
            <SectionHeader
              eyebrow="04 — MASS BALANCE"
              title="Does production reconcile with movements?"
              subtitle="Every kilogram accounted for: produced, consumed, shipped, adjusted. Variance should be zero."
            />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 12 }}>
              <KPI label="Qty produced" value={fmtN(batch.qty_produced, 1)} unit="KG" tone="good" />
              <KPI label="Qty consumed" value={fmtN(batch.qty_consumed, 1)} unit="KG" />
              <KPI label="Qty shipped" value={fmtN(batch.qty_shipped, 1)} unit="KG" />
              <KPI label="Qty adjusted" value={fmtN(batch.qty_adjusted, 1)} unit="KG" tone={batch.qty_adjusted !== 0 ? "warn" : "muted"} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
              <KPI label="Mass balance" value={fmtN(batch.qty_produced, 1)} unit="KG" large />
              <KPI label="Current stock" value={fmtN(batch.current_stock, 1)} unit="KG" large tone="good" />
              <KPI
                label="Variance"
                value={fmtN(variance, 2)}
                unit="KG"
                large
                tone={Math.abs(variance) < 0.01 ? "good" : "bad"}
                sub={Math.abs(variance) < 0.01 ? "Reconciled" : "Investigate"}
              />
            </div>
            {events.length === 0 ? (
              <Card title="Mass balance timeline">
                <EmptyBlock message="No postings recorded for this batch." />
              </Card>
            ) : (
              <>
                <Card title="Mass balance timeline" subtitle="Per-day delta applied to inventory" style={{ marginBottom: 20 }}>
                  <MBChart data={events} />
                </Card>
                <Card title="Inventory level over time" subtitle="Running balance, by posting date">
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
