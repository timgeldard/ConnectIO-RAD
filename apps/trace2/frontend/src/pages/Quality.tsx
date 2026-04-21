import { CSSProperties, useState } from "react";
import type { Batch, InspectionLot, MIC } from "../types";
import { fetchQuality, type QualityResult } from "../data/api";
import { useBatchData } from "../data/useBatchData";
import { LoadFrame, EmptyBlock } from "../components/LoadFrame";
import { Card, DataTable, KPI, SectionHeader, StatusPill, fmtN } from "../ui";

const selectStyle: CSSProperties = {
  padding: "4px 8px",
  border: "1px solid var(--line-2)",
  background: "var(--card)",
  fontFamily: "'JetBrains Mono', monospace",
  fontSize: 11,
  color: "var(--ink)",
  borderRadius: 2,
};

export function PageQuality({ batch: headerBatch }: { batch: Batch }) {
  const state = useBatchData(fetchQuality, headerBatch.material_id, headerBatch.batch_id);
  return (
    <LoadFrame
      state={state}
      eyebrow="05 — QUALITY"
      loadingTitle="Loading quality results…"
      loadingSubtitle={`Material ${headerBatch.material_id} · Batch ${headerBatch.batch_id}`}
    >
      {({ batch, lots, results, summary }) => (
        <QualityBody batch={batch} lots={lots} results={results} summary={summary} />
      )}
    </LoadFrame>
  );
}

function QualityBody({
  batch,
  lots,
  results,
  summary,
}: {
  batch: Batch;
  lots: InspectionLot[];
  results: QualityResult[];
  summary: {
    lot_count: number;
    accepted_result_count: number;
    rejected_result_count: number;
    failed_mic_count: number;
    latest_inspection_date: string;
  };
}) {
  const firstLot = lots[0]?.lot ?? "";
  const [selectedLot, setSelectedLot] = useState<string>(firstLot);
  const activeLot = selectedLot || firstLot;
  const filtered = activeLot ? results.filter((r) => r.lot === activeLot) : results;
  return (
    <div>
      <SectionHeader
        eyebrow="05 — QUALITY"
        title="Inspection lots and characteristic results"
        subtitle="All quality checkpoints for this batch. Failed MICs block release automatically; critical failures escalate to QA."
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginBottom: 20 }}>
        <KPI label="Batch status" value={<StatusPill status={batch.batch_status} />} />
        <KPI label="Inspection lots" value={summary.lot_count || lots.length} />
        <KPI label="Accepted results" value={summary.accepted_result_count} tone="good" />
        <KPI label="Rejected results" value={summary.rejected_result_count} tone={summary.rejected_result_count > 0 ? "bad" : "muted"} />
        <KPI label="Failed MICs" value={summary.failed_mic_count} tone={summary.failed_mic_count > 0 ? "bad" : "good"} />
        <KPI label="Latest inspection" value={summary.latest_inspection_date} />
      </div>

      {lots.length === 0 ? (
        <Card title="Inspection lot details" noPad style={{ marginBottom: 20 }}>
          <EmptyBlock message="No inspection lots recorded for this batch." />
        </Card>
      ) : (
        <Card title="Inspection lot details" subtitle="Click a lot to filter results below" noPad style={{ marginBottom: 20 }}>
          <DataTable<InspectionLot>
            columns={[
              { header: "Lot", key: "lot", mono: true },
              { header: "Type", key: "type" },
              { header: "Start", key: "start", mono: true, muted: true },
              { header: "End", key: "end", mono: true, muted: true },
              { header: "Origin", key: "origin", mono: true, muted: true },
              { header: "Inspector", key: "insp_by" },
              { header: "Decision", render: (r) => <StatusPill status={r.decision} size="sm" /> },
            ]}
            rows={lots}
            emphasize={(r) => r.lot === activeLot}
          />
        </Card>
      )}

      <Card
        title="Inspection results"
        subtitle={`Lot ${activeLot || "—"} · ${filtered.length} characteristics`}
        noPad
        style={{ marginBottom: 20 }}
        action={
          lots.length > 0 ? (
            <select value={activeLot} onChange={(e) => setSelectedLot(e.target.value)} style={selectStyle}>
              {lots.map((l) => (
                <option key={l.lot} value={l.lot}>
                  {l.lot} · {l.type}
                </option>
              ))}
            </select>
          ) : null
        }
      >
        {filtered.length === 0 ? (
          <EmptyBlock message="No MIC results for this lot." />
        ) : (
          <DataTable<MIC>
            dense
            columns={[
              { header: "MIC", key: "id", mono: true },
              { header: "Characteristic", key: "name" },
              { header: "Target", key: "target", mono: true, muted: true },
              { header: "Tolerance", key: "tol", mono: true, muted: true },
              { header: "UOM", key: "uom", mono: true, muted: true },
              {
                header: "Result",
                render: (r) => (
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontVariantNumeric: "tabular-nums", color: "var(--ink)", fontWeight: 500 }}>
                    {r.value || r.qual || "—"}
                  </span>
                ),
                align: "right",
              },
              { header: "Decision", render: (r) => <StatusPill status={r.result} size="sm" /> },
            ]}
            rows={filtered}
          />
        )}
      </Card>

      {results.length > 0 && (
        <Card
          title="MIC pass / fail by characteristic"
          subtitle="All inspection lots for this batch"
        >
          <MicPassFailChart results={results} />
        </Card>
      )}
    </div>
  );
}

function MicPassFailChart({ results }: { results: QualityResult[] }) {
  const byMic = new Map<string, { name: string; pass: number; fail: number }>();
  for (const r of results) {
    const key = r.id || r.name;
    if (!key) continue;
    const entry = byMic.get(key) ?? { name: r.name || r.id, pass: 0, fail: 0 };
    if (r.result === "REJECTED") entry.fail += 1;
    else entry.pass += 1;
    byMic.set(key, entry);
  }
  const rows = Array.from(byMic.entries())
    .map(([id, v]) => ({ id, ...v, total: v.pass + v.fail }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 20);
  if (rows.length === 0) {
    return <EmptyBlock message="No MIC results to plot." />;
  }
  const max = Math.max(...rows.map((r) => r.total));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {rows.map((r) => {
        const passPct = (r.pass / max) * 100;
        const failPct = (r.fail / max) * 100;
        return (
          <div
            key={r.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontFamily: "'Inter', sans-serif",
              fontSize: 12,
            }}
          >
            <div
              style={{
                width: 180,
                color: "var(--ink)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={r.name}
            >
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: "var(--ink-3)", marginRight: 8 }}>
                {r.id}
              </span>
              {r.name}
            </div>
            <div style={{ flex: 1, height: 10, background: "var(--line)", position: "relative", display: "flex" }}>
              <div style={{ width: `${passPct}%`, height: "100%", background: "oklch(48% 0.09 155)" }} />
              <div style={{ width: `${failPct}%`, height: "100%", background: "oklch(55% 0.13 40)" }} />
            </div>
            <div
              style={{
                width: 120,
                textAlign: "right",
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize: 11,
                color: "var(--ink)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              <span style={{ color: "oklch(38% 0.07 155)" }}>{fmtN(r.pass, 0)} pass</span>
              {r.fail > 0 && (
                <span style={{ color: "oklch(42% 0.14 35)", marginLeft: 8 }}>
                  {fmtN(r.fail, 0)} fail
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
