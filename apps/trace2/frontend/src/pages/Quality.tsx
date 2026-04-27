import { CSSProperties, useState } from "react";
import type { Batch, InspectionLot, MIC } from "../types";
import { fetchQuality, type QualityResult } from "../data/api";
import { useBatchData } from "../data/useBatchData";
import { LoadFrame, EmptyBlock } from "../components/LoadFrame";
import { Card, DataTable, KPI, SectionHeader, StatusPill, fmtN } from "../ui";
import { useI18n } from "@connectio/shared-frontend-i18n";
import { template, traceCopy } from "../i18n/pageCopy";

const selectStyle: CSSProperties = {
  padding: "4px 8px",
  border: "1px solid var(--line-2)",
  background: "var(--card)",
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  color: "var(--ink)",
  borderRadius: 2,
};

export function PageQuality({ batch: headerBatch }: { batch: Batch }) {
  const { language } = useI18n();
  const copy = traceCopy(language);
  const state = useBatchData(fetchQuality, headerBatch.material_id, headerBatch.batch_id);
  return (
    <LoadFrame
      state={state}
      eyebrow={copy.quality.eyebrow}
      loadingTitle={copy.quality.loading}
      loadingSubtitle={template(copy.common.loadingSubtitle, { material: headerBatch.material_id, batch: headerBatch.batch_id })}
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
  const { language } = useI18n();
  const copy = traceCopy(language);
  const [selectedLot, setSelectedLot] = useState<string>(firstLot);
  const activeLot = selectedLot || firstLot;
  const filtered = activeLot ? results.filter((r) => r.lot === activeLot) : results;
  return (
    <div>
      <SectionHeader
        eyebrow={copy.quality.eyebrow}
        title={copy.quality.title}
        subtitle={copy.quality.subtitle}
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12, marginBottom: 20 }}>
        <KPI label={copy.bottom.batchStatus} value={<StatusPill status={batch.batch_status} />} />
        <KPI label={copy.quality.inspectionLots} value={summary.lot_count || lots.length} />
        <KPI label={copy.quality.acceptedResults} value={summary.accepted_result_count} tone="good" />
        <KPI label={copy.quality.rejectedResults} value={summary.rejected_result_count} tone={summary.rejected_result_count > 0 ? "bad" : "muted"} />
        <KPI label={copy.common.failedMics} value={summary.failed_mic_count} tone={summary.failed_mic_count > 0 ? "bad" : "good"} />
        <KPI label={copy.quality.latestInspection} value={summary.latest_inspection_date} />
      </div>

      {lots.length === 0 ? (
        <Card title={copy.quality.lotDetails} noPad style={{ marginBottom: 20 }}>
          <EmptyBlock message={copy.quality.noLots} />
        </Card>
      ) : (
        <Card title={copy.quality.lotDetails} subtitle={copy.quality.lotSubtitle} noPad style={{ marginBottom: 20 }}>
          <DataTable<InspectionLot>
            columns={[
              { header: copy.common.lots, key: "lot", mono: true },
              { header: copy.common.type, key: "type" },
              { header: copy.common.start, key: "start", mono: true, muted: true },
              { header: copy.common.end, key: "end", mono: true, muted: true },
              { header: copy.common.origin, key: "origin", mono: true, muted: true },
              { header: copy.common.inspector, key: "insp_by" },
              { header: copy.common.decision, render: (r) => <StatusPill status={r.decision} size="sm" /> },
            ]}
            rows={lots}
            emphasize={(r) => r.lot === activeLot}
          />
        </Card>
      )}

      <Card
        title={copy.quality.resultsTitle}
        subtitle={template(copy.quality.resultsSubtitle, { lot: activeLot || "—", count: filtered.length })}
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
          <EmptyBlock message={copy.quality.noMicLot} />
        ) : (
          <DataTable<MIC>
            dense
            columns={[
              { header: copy.common.mic, key: "id", mono: true },
              { header: copy.common.characteristic, key: "name" },
              { header: copy.common.target, key: "target", mono: true, muted: true },
              { header: copy.common.tolerance, key: "tol", mono: true, muted: true },
              { header: copy.common.uom, key: "uom", mono: true, muted: true },
              {
                header: copy.common.result,
                render: (r) => (
                  <span style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", color: "var(--ink)", fontWeight: 500 }}>
                    {r.value || r.qual || "—"}
                  </span>
                ),
                align: "right",
              },
              { header: copy.common.decision, render: (r) => <StatusPill status={r.result} size="sm" /> },
            ]}
            rows={filtered}
          />
        )}
      </Card>

      {results.length > 0 && (
        <Card
          title={copy.quality.passFailTitle}
          subtitle={copy.quality.passFailSubtitle}
        >
          <MicPassFailChart results={results} />
        </Card>
      )}
    </div>
  );
}

function MicPassFailChart({ results }: { results: QualityResult[] }) {
  const { language } = useI18n();
  const copy = traceCopy(language);
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
    return <EmptyBlock message={copy.quality.noMicPlot} />;
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
              fontFamily: "var(--font-sans)",
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
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--ink-3)", marginRight: 8 }}>
                {r.id}
              </span>
              {r.name}
            </div>
            <div style={{ flex: 1, height: 10, background: "var(--line)", position: "relative", display: "flex" }}>
              <div style={{ width: `${passPct}%`, height: "100%", background: "var(--jade)" }} />
              <div style={{ width: `${failPct}%`, height: "100%", background: "var(--sunset)" }} />
            </div>
            <div
              style={{
                width: 120,
                textAlign: "right",
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--ink)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              <span style={{ color: "var(--jade)" }}>{fmtN(r.pass, 0)} {copy.common.pass}</span>
              {r.fail > 0 && (
                <span style={{ color: "var(--sunset)", marginLeft: 8 }}>
                  {fmtN(r.fail, 0)} {copy.common.fail}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
