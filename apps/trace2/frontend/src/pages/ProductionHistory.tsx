import type { Batch, ProductionEntry } from "../types";
import { fetchProductionHistory } from "../data/api";
import { useBatchData } from "../data/useBatchData";
import { LoadFrame, EmptyBlock } from "../components/LoadFrame";
import { Card, KPI, SectionHeader, fmtN } from "../ui";
import { useI18n } from "@connectio/shared-frontend-i18n";
import { template, traceCopy } from "../i18n/pageCopy";

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
  const { language } = useI18n();
  const copy = traceCopy(language);
  const state = useBatchData(fetchProductionHistory, headerBatch.material_id, headerBatch.batch_id);
  return (
    <LoadFrame
      state={state}
      eyebrow={copy.production.eyebrow}
      loadingTitle={copy.production.loading}
      loadingSubtitle={template(copy.common.loadingMaterial, { material: headerBatch.material_id })}
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
              eyebrow={copy.production.eyebrow}
              title={copy.production.title}
              subtitle={template(copy.production.subtitle, { material: batch.material_id, name: batch.material_name })}
            />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
              <KPI label={copy.production.totalBatches} value={batches.length} />
              <KPI label={copy.production.avgBatchSize} value={fmtN(avg, 0)} unit={copy.common.kg} sub={copy.production.avgBatchSub} />
              <KPI label={copy.production.released} value={released} tone="good" />
              <KPI label={copy.production.blockedQi} value={flagged} tone={flagged > 0 ? "warn" : "muted"} />
            </div>
            {batches.length === 0 ? (
              <Card title={copy.production.volume}>
                <EmptyBlock message={copy.production.empty} />
              </Card>
            ) : (
              <>
                <Card title={copy.production.sizeTitle} subtitle={copy.production.sizeSubtitle} style={{ marginBottom: 20 }}>
                  <BatchHistoryChart data={trendOrder} highlightId={batch.batch_id} />
                </Card>
                <Card title={copy.production.trendTitle} subtitle={copy.production.trendSubtitle}>
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
