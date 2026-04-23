import type { Batch, MIC } from "../types";
import { fetchCoa } from "../data/api";
import { useBatchData } from "../data/useBatchData";
import { LoadFrame, EmptyBlock } from "../components/LoadFrame";
import { Button, DataTable, HexMark, SectionHeader, StatusPill } from "../ui";
import type { ReactNode } from "react";

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
  const state = useBatchData(fetchCoa, headerBatch.material_id, headerBatch.batch_id);
  return (
    <LoadFrame
      state={state}
      eyebrow="11 — CERTIFICATE OF ANALYSIS"
      loadingTitle="Loading CoA…"
      loadingSubtitle={`Material ${headerBatch.material_id} · Batch ${headerBatch.batch_id}`}
    >
      {({ batch, mics }) => <CoaBody batch={batch} mics={mics} />}
    </LoadFrame>
  );
}

function CoaBody({ batch, mics }: { batch: Batch; mics: MIC[] }) {
  return (
    <div>
      <SectionHeader
        eyebrow="11 — CERTIFICATE OF ANALYSIS"
        title="Release documentation"
        subtitle="Formal CoA for this batch: inspection results, usage decision, and release signature."
        action={<Button variant="primary" icon={<span>⎙</span>}>Generate PDF</Button>}
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
              Certificate of Analysis
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(255,255,255,0.6)", marginTop: 4 }}>
              Document {batch.process_order || "—"} / CoA-{batch.batch_id}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 16, fontWeight: 600, color: "#fff" }}>
              {batch.plant_name || "Plant"}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "rgba(255,255,255,0.6)", marginTop: 3 }}>
              {batch.plant_id}
            </div>
          </div>
        </div>

        <div style={{ padding: "28px 32px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, marginBottom: 24 }}>
            <CoaField label="Material ID" value={batch.material_id} />
            <CoaField label="Batch ID" value={batch.batch_id} />
            <CoaField label="Status" value={<StatusPill status={batch.batch_status} size="sm" />} />
            <CoaField label="Material name" value={batch.material_name} mono={false} />
            <CoaField label="Process order" value={batch.process_order || "—"} />
            <CoaField label="Plant" value={`${batch.plant_id} ${batch.plant_name}`} mono={false} />
            <CoaField label="Date of manufacture" value={batch.manufacture_date} />
            <CoaField label="Expiry date" value={batch.expiry_date} />
            <CoaField label="UOM" value={batch.uom} />
          </div>

          <div style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600, color: "var(--forest)", marginBottom: 10, marginTop: 8 }}>
            Inspection results
          </div>
          {mics.length === 0 ? (
            <EmptyBlock message="No CoA results recorded for this batch." />
          ) : (
            <DataTable<MIC>
              dense
              columns={[
                { header: "MIC", key: "id", mono: true },
                { header: "Characteristic", key: "name" },
                { header: "Target", render: (r) => r.target + (r.tol ? " " + r.tol : ""), mono: true, muted: true },
                { header: "UOM", key: "uom", mono: true, muted: true },
                {
                  header: "Result",
                  render: (r) => (
                    <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}>
                      {r.value || r.qual || "—"}
                    </span>
                  ),
                  align: "right",
                },
                { header: "Decision", render: (r) => <StatusPill status={r.result} size="sm" /> },
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
              Usage Decision
            </div>
            <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 15, color: "var(--ink)" }}>
              {batch.batch_status === "BLOCKED"
                ? "Blocked — not released"
                : batch.batch_status === "QUALITY_INSPECTION"
                ? "In quality inspection — not yet released"
                : batch.batch_status === "RESTRICTED"
                ? "Restricted use"
                : "Accepted — released for unrestricted use"}
            </div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--ink-2)", marginTop: 6 }}>
              {mics.length} characteristic{mics.length === 1 ? "" : "s"} recorded.{" "}
              {mics.filter((m) => m.result === "REJECTED").length === 0
                ? "No rejected results."
                : `${mics.filter((m) => m.result === "REJECTED").length} rejected result(s).`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
