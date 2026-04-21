import type { Batch, MIC } from "../types";
import { fetchCoa } from "../data/api";
import { useBatchData } from "../data/useBatchData";
import { LoadFrame, EmptyBlock } from "../components/LoadFrame";
import { Button, DataTable, SectionHeader, StatusPill } from "../ui";
import type { ReactNode } from "react";

function CoaField({ label, value, mono = true }: { label: ReactNode; value: ReactNode; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 10, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
        {label}
      </div>
      <div
        style={{
          fontFamily: mono ? "'JetBrains Mono', monospace" : "'Inter', sans-serif",
          fontSize: 13,
          color: "var(--ink)",
          marginTop: 3,
        }}
      >
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
      eyebrow="09 — CERTIFICATE OF ANALYSIS"
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
        eyebrow="09 — CERTIFICATE OF ANALYSIS"
        title="Release documentation"
        subtitle="Formal CoA for this batch: inspection results, usage decision, and release signature."
        action={<Button variant="primary" icon={<span>⎙</span>}>Generate PDF</Button>}
      />

      <div
        style={{
          background: "var(--card)",
          border: "1px solid var(--line)",
          padding: 44,
          maxWidth: 960,
          margin: "0 auto",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            borderBottom: "2px solid var(--ink)",
            paddingBottom: 18,
            marginBottom: 20,
          }}
        >
          <div>
            <div style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: 24, letterSpacing: "-0.02em", color: "var(--ink)" }}>
              Certificate of Analysis
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>
              Document {batch.process_order || "—"} / CoA-{batch.batch_id}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: 20, color: "var(--ink)" }}>
              {batch.plant_name || "Plant"}
            </div>
            <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: "var(--ink-3)" }}>
              {batch.plant_id}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, marginBottom: 20 }}>
          <CoaField label="Material ID" value={batch.material_id} />
          <CoaField label="Batch ID" value={batch.batch_id} />
          <CoaField label="Status" value={<StatusPill status={batch.batch_status} size="sm" />} />
          <CoaField label="Material name" value={batch.material_name} mono={false} />
          <CoaField label="Process order" value={batch.process_order || "—"} />
          <CoaField label="Plant" value={batch.plant_id + " " + batch.plant_name} mono={false} />
          <CoaField label="Date of manufacture" value={batch.manufacture_date} />
          <CoaField label="Expiry date" value={batch.expiry_date} />
          <CoaField label="UOM" value={batch.uom} />
        </div>

        <div style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: 16, color: "var(--ink)", marginBottom: 8, marginTop: 24 }}>
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
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 500 }}>
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

        <div
          style={{
            marginTop: 30,
            padding: 16,
            background: "oklch(96% 0.015 155)",
            borderLeft: "3px solid oklch(38% 0.06 155)",
          }}
        >
          <div
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 10.5,
              color: "var(--ink-3)",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: 6,
            }}
          >
            Usage Decision
          </div>
          <div style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: 16, color: "var(--ink)" }}>
            {batch.batch_status === "BLOCKED"
              ? "Blocked — not released"
              : batch.batch_status === "QUALITY_INSPECTION"
              ? "In quality inspection — not yet released"
              : batch.batch_status === "RESTRICTED"
              ? "Restricted use"
              : "Accepted — released for unrestricted use"}
          </div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: "var(--ink-2)", marginTop: 6 }}>
            {mics.length} characteristic{mics.length === 1 ? "" : "s"} recorded.
            {" "}
            {mics.filter((m) => m.result === "REJECTED").length === 0
              ? "No rejected results."
              : `${mics.filter((m) => m.result === "REJECTED").length} rejected result(s).`}
          </div>
        </div>
      </div>
    </div>
  );
}
