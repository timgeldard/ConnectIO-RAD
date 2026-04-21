import type { Batch, ProductionEntry } from "../types";
import { PRODUCTION_HISTORY } from "../data/mock";
import { Card, KPI, SectionHeader, fmtN } from "../ui";

function BatchHistoryChart({ data, highlightId }: { data: ProductionEntry[]; highlightId: string }) {
  const width = 1100;
  const height = 280;
  const pad = { l: 60, r: 20, t: 20, b: 60 };
  const max = Math.max(...data.map((d) => d.qty)) * 1.1;
  const barW = (width - pad.l - pad.r) / data.length - 6;
  const yScale = (height - pad.t - pad.b) / max;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto" }}>
      {[0, 0.5, 1].map((f) => {
        const y = height - pad.b - max * f * yScale;
        return (
          <g key={f}>
            <line x1={pad.l} x2={width - pad.r} y1={y} y2={y} stroke="var(--line)" />
            <text x={pad.l - 8} y={y} textAnchor="end" dy="0.35em" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fill: "var(--ink-3)" }}>
              {fmtN(max * f, 0)}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const x = pad.l + i * ((width - pad.l - pad.r) / data.length) + 3;
        const h = d.qty * yScale;
        const isHl = d.batch === highlightId;
        const col =
          d.status === "BLOCKED"
            ? "oklch(55% 0.13 40)"
            : d.status === "Q_INSP"
            ? "oklch(70% 0.12 75)"
            : isHl
            ? "oklch(42% 0.14 35)"
            : "oklch(48% 0.09 155)";
        return (
          <g key={i}>
            <rect x={x} y={height - pad.b - h} width={barW} height={h} fill={col} opacity={isHl ? 1 : 0.75} />
            {isHl && (
              <rect
                x={x - 1}
                y={height - pad.b - h - 6}
                width={barW + 2}
                height={h + 6}
                fill="none"
                stroke="oklch(42% 0.14 35)"
                strokeWidth={1}
              />
            )}
            <text
              x={x + barW / 2}
              y={height - pad.b + 14}
              textAnchor="middle"
              transform={`rotate(-35 ${x + barW / 2} ${height - pad.b + 14})`}
              style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, fill: "var(--ink-3)" }}
            >
              {d.batch.slice(-6)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function BatchTrendChart({ data }: { data: ProductionEntry[] }) {
  const width = 1100;
  const height = 240;
  const pad = { l: 60, r: 20, t: 20, b: 40 };
  const max = Math.max(...data.map((d) => d.qty)) * 1.05;
  const xStep = (width - pad.l - pad.r) / (data.length - 1);
  const yScale = (height - pad.t - pad.b) / max;
  const pts = data.map((d, i) => [pad.l + i * xStep, height - pad.b - d.qty * yScale] as [number, number]);
  const pathD = "M " + pts.map((p) => p.join(" ")).join(" L ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto" }}>
      <path d={pathD} fill="none" stroke="oklch(38% 0.06 155)" strokeWidth={1.5} />
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={3} fill="oklch(38% 0.06 155)" />
      ))}
      {data.map((d, i) =>
        i % 2 === 0 ? (
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

export function PageProductionHistory({ batch }: { batch: Batch }) {
  return (
    <div>
      <SectionHeader
        eyebrow="06 — PRODUCTION HISTORY"
        title="All batches of this material"
        subtitle="Production trend for material 20582002 — all batches across the selected date range. Batch ID filter does not apply to this page."
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        <KPI label="Total batches" value={PRODUCTION_HISTORY.length} />
        <KPI
          label="Avg batch size"
          value={fmtN(PRODUCTION_HISTORY.reduce((s, b) => s + b.qty, 0) / PRODUCTION_HISTORY.length, 0)}
          unit="KG"
        />
        <KPI label="Released" value={PRODUCTION_HISTORY.filter((b) => b.status === "RELEASED").length} tone="good" />
        <KPI
          label="Blocked / QI"
          value={PRODUCTION_HISTORY.filter((b) => ["BLOCKED", "Q_INSP", "IN_PROC"].includes(b.status)).length}
          tone="warn"
        />
      </div>
      <Card title="Batch size by process order" subtitle="Highlighted bar is the currently selected batch" style={{ marginBottom: 20 }}>
        <BatchHistoryChart data={PRODUCTION_HISTORY} highlightId={batch.batch_id} />
      </Card>
      <Card title="Production volume trend" subtitle="Rolling 6-month view">
        <BatchTrendChart data={PRODUCTION_HISTORY} />
      </Card>
    </div>
  );
}
