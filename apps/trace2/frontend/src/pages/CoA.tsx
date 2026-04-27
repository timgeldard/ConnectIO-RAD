import type { Batch, MIC } from "../types";
import { fetchCoa } from "../data/api";
import { useBatchData } from "../data/useBatchData";
import { LoadFrame, EmptyBlock } from "../components/LoadFrame";
import { Button, DataTable, HexMark, SectionHeader, StatusPill } from "../ui";
import type { ReactNode } from "react";
import { useI18n } from "@connectio/shared-frontend-i18n";
import { template, traceCopy } from "../i18n/pageCopy";

function CoaField({ label, value, mono = true }: { label: ReactNode; value: ReactNode; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 3 }}>
        {label}
      </div>
      <div style={{
        fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
        fontSize: 13, color: "var(--ink)",
      }}>
        {value}
      </div>
    </div>
  );
}

export function PageCoA({ batch: headerBatch }: { batch: Batch }) {
  const { language } = useI18n();
  const copy = traceCopy(language);
  const state = useBatchData(fetchCoa, headerBatch.material_id, headerBatch.batch_id);
  return (
    <LoadFrame
      state={state}
      eyebrow={copy.coa.eyebrow}
      loadingTitle={copy.coa.loading}
      loadingSubtitle={template(copy.common.loadingSubtitle, { material: headerBatch.material_id, batch: headerBatch.batch_id })}
    >
      {({ batch, mics }) => <CoaBody batch={batch} mics={mics} />}
    </LoadFrame>
  );
}

function CoaBody({ batch, mics }: { batch: Batch; mics: MIC[] }) {
  const { language } = useI18n();
  const copy = traceCopy(language);
  const rejectedCount = mics.filter((m) => m.result === "REJECTED").length;
  return (
    <div>
      <SectionHeader
        eyebrow={copy.coa.eyebrow}
        title={copy.coa.title}
        subtitle={copy.coa.subtitle}
        action={<Button variant="primary" icon={<span>⎙</span>}>{copy.coa.generate}</Button>}
      />

      <div style={{
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: 8,
        padding: 0,
        maxWidth: 960,
        margin: "0 auto",
        overflow: "hidden",
        boxShadow: "0 1px 4px rgba(20,55,0,0.06)",
      }}>
        {/* Kerry slate header */}
        <div style={{
          background: "var(--valentia-slate)",
          padding: "22px 32px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <HexMark size={22} />
              <span style={{ fontFamily: "var(--font-sans)", fontSize: 16, fontWeight: 600, color: "#fff" }}>Kerry</span>
            </div>
            <div style={{
              fontFamily: "var(--font-impact)",
              fontSize: 26, fontWeight: 800,
              color: "#fff",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              lineHeight: 1.1,
            }}>
              {copy.coa.certificate}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>
              {template(copy.coa.document, { document: batch.process_order || "—", batch: batch.batch_id })}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 16, fontWeight: 600, color: "#fff" }}>
              {batch.plant_name || copy.common.plant}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(255,255,255,0.6)", marginTop: 3 }}>
              {batch.plant_id}
            </div>
          </div>
        </div>

        <div style={{ padding: "28px 32px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, marginBottom: 24 }}>
            <CoaField label={copy.common.materialId} value={batch.material_id} />
            <CoaField label={copy.common.batchId} value={batch.batch_id} />
            <CoaField label={copy.common.status} value={<StatusPill status={batch.batch_status} size="sm" />} />
            <CoaField label={copy.coa.materialName} value={batch.material_name} mono={false} />
            <CoaField label={copy.common.processOrder} value={batch.process_order || "—"} />
            <CoaField label={copy.common.plant} value={`${batch.plant_id} ${batch.plant_name}`} mono={false} />
            <CoaField label={copy.coa.manufactureDate} value={batch.manufacture_date} />
            <CoaField label={copy.coa.expiryDate} value={batch.expiry_date} />
            <CoaField label={copy.common.uom} value={batch.uom} />
          </div>

          <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600, color: "var(--forest)", marginBottom: 10, marginTop: 8 }}>
            {copy.coa.inspectionResults}
          </div>
          {mics.length === 0 ? (
            <EmptyBlock message={copy.coa.empty} />
          ) : (
            <DataTable<MIC>
              dense
              columns={[
                { header: copy.common.mic, key: "id", mono: true },
                { header: copy.common.characteristic, key: "name" },
                { header: copy.common.target, render: (r) => r.target + (r.tol ? " " + r.tol : ""), mono: true, muted: true },
                { header: copy.common.uom, key: "uom", mono: true, muted: true },
                {
                  header: copy.common.result,
                  render: (r) => (
                    <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
                      {r.value || r.qual || "—"}
                    </span>
                  ),
                  align: "right",
                },
                { header: copy.common.decision, render: (r) => <StatusPill status={r.result} size="sm" /> },
              ]}
              rows={mics}
            />
          )}

          <div style={{
            marginTop: 28,
            padding: "16px 20px",
            background: "var(--forest-surface)",
            borderLeft: "4px solid var(--brand)",
            borderRadius: "0 4px 4px 0",
          }}>
            <div style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9.5, color: "var(--brand)",
              textTransform: "uppercase", letterSpacing: "0.14em",
              marginBottom: 6,
            }}>
              {copy.coa.usageDecision}
            </div>
            <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 15, color: "var(--ink)" }}>
              {batch.batch_status === "BLOCKED"
                ? copy.coa.decisionBlocked
                : batch.batch_status === "QUALITY_INSPECTION"
                ? copy.coa.decisionQi
                : batch.batch_status === "RESTRICTED"
                ? copy.coa.decisionRestricted
                : copy.coa.decisionAccepted}
            </div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--ink-2)", marginTop: 6 }}>
              {template(copy.coa.recorded, { count: mics.length })}{" "}
              {rejectedCount === 0 ? copy.coa.noRejected : template(copy.coa.rejectedCount, { count: rejectedCount })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
