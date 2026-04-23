import type { Batch, ProductionEntry } from "../types";
import { fetchProductionHistory } from "../data/api";
import { useBatchData } from "../data/useBatchData";
import { LoadFrame, EmptyBlock } from "../components/LoadFrame";
import { Card, KPI, SectionHeader, fmtN } from "../ui";

function BatchHistoryChart({ data, highlightId }: { data: ProductionEntry[]; highlightId: string }) {
  if (data.length === 0) return null;
  const width = 1100;
  const height = 280;
  const pad = { l: 60, r: 20, t: 20, b: 60 };
  const max = Math.max(1, ...data.map((d) => d.qty)) * 1.1;
  const barW = (width - pad.l - pad.r) / data.length - 6;
  const yScale = (height - pad.t - pad.b) / max;
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto" }}>
      {[0, 0.5, 1].map((f) => {
        const y = height - pad.b - max * f * yScale;
        return (
          <g key={f}>
            <line x1={pad.l} x2={width - pad.r} y1={y} y2={y} stroke="var(--line)" />
            <text x={pad.l - 8} y={y} textAnchor="end" dy="0.35em" style={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: "var(--ink-3)" }}>
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
            ? "var(--sunset)"
            : d.status === "Q_INSP"
            ? "var(--sunrise)"
            : isHl
            ? "var(--brand-deep)"
            : "var(--jade)";
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
                stroke="var(--brand-deep)"
                strokeWidth={1}
              />
            )}
            <text
              x={x + barW / 2}
              y={height - pad.b + 14}
              textAnchor="middle"
              transform={`rotate(-35 ${x + barW / 2} ${height - pad.b + 14})`}
              style={{ fontFamily: "var(--font-mono)", fontSize: 9, fill: "var(--ink-3)" }}
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
  if (data.length < 2) return null;
  const width = 1100;
  const height = 240;
  const pad = { l: 60, r: 20, t: 20, b: 40 };
  const max = Math.max(1, ...data.map((d) => d.qty)) * 1.05;
  const xStep = (width - pad.l - pad.r) / (data.length - 1);
  const yScale = (height - pad.t - pad.b) / max;
  const pts = data.map((d, i) => [pad.l + i * xStep, height - pad.b - d.qty * yScale] as [number, number]);
  const pathD = "M " + pts.map((p) => p.join(" ")).join(" L ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto" }}>
      <path d={pathD} fill="none" stroke="var(--valentia-slate)" strokeWidth={1.5} />
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={3} fill="var(--valentia-slate)" />
      ))}
      {data.map((d, i) =>
        i % Math.max(1, Math.floor(data.length / 8)) === 0 ? (
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

export function PageProductionHistory({ batch: headerBatch }: { batch: Batch }) {
  const state = useBatchData(fetchProductionHistory, headerBatch.material_id, headerBatch.batch_id);
  return (
    <LoadFrame
      state={state}
      eyebrow="07 — PRODUCTION HISTORY"
      loadingTitle="Loading production history…"
      loadingSubtitle={`Material ${headerBatch.material_id}`}
    >
      {({ batch, batches }) => {
        const trendOrder = [...batches].reverse();
        const totalQty = batches.reduce((s, b) => s + b.qty, 0);
        const avg = batches.length ? totalQty / batches.length : 0;
        const released = batches.filter((b) => b.status === "RELEASED").length;
        const flagged = batches.filter((b) => ["BLOCKED", "Q_INSP", "IN_PROC"].includes(b.status)).length;
        return (
          <div>
            <SectionHeader
              eyebrow="07 — PRODUCTION HISTORY"
              title="All batches of this material"
              subtitle={`Production history for material ${batch.material_id} (${batch.material_name}). Batch ID filter does not apply to this page.`}
            />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
              <KPI label="Total batches" value={batches.length} />
              <KPI label="Avg batch size" value={fmtN(avg, 0)} unit="KG" sub="size vs avg is computed against this" />
              <KPI label="Released" value={released} tone="good" />
              <KPI label="Blocked / QI" value={flagged} tone={flagged > 0 ? "warn" : "muted"} />
            </div>
            {batches.length === 0 ? (
              <Card title="Production volume">
                <EmptyBlock message="No production history recorded for this material." />
              </Card>
            ) : (
              <>
                <Card title="Batch size by process order" subtitle="Highlighted bar is the currently selected batch" style={{ marginBottom: 20 }}>
                  <BatchHistoryChart data={trendOrder} highlightId={batch.batch_id} />
                </Card>
                <Card title="Production volume trend" subtitle="Chronological (oldest → newest)">
                  <BatchTrendChart data={trendOrder} />
                </Card>
              </>
            )}
          </div>
        );
      }}
    </LoadFrame>
  );
}
