import { useState } from "react";
import type { Batch, LineageNode, PageId } from "../types";
import { fetchTopDown, focalFromBatch } from "../data/api";
import { useBatchData } from "../data/useBatchData";
import { LoadFrame, EmptyBlock } from "../components/LoadFrame";
import { LineageGraph, NodeDetailPanel } from "../components/LineageGraph";
import { Card, DataTable, DepthControl, KPI, SectionHeader, fmtN, fmtInt } from "../ui";

export function PageTopDown({
  batch: headerBatch,
  sim,
  maxLevels = 3,
  setMaxLevels,
  maxInputDepth = 3,
  setMaxInputDepth,
}: {
  batch: Batch;
  navigate: (id: PageId) => void;
  sim?: boolean;
  maxLevels?: number;
  setMaxLevels?: (v: number) => void;
  maxInputDepth?: number;
  setMaxInputDepth?: (v: number) => void;
}) {
  const state = useBatchData(fetchTopDown, headerBatch.material_id, headerBatch.batch_id);
  return (
    <LoadFrame
      state={state}
      eyebrow="04 — TOP-DOWN TRACEABILITY"
      loadingTitle="Loading downstream trace…"
      loadingSubtitle={`Material ${headerBatch.material_id} · Batch ${headerBatch.batch_id}`}
    >
      {({ batch, lineage }) => (
        <TopDownBody
          batch={batch}
          lineage={lineage}
          sim={sim ?? false}
          maxLevels={maxLevels}
          setMaxLevels={setMaxLevels}
          maxInputDepth={maxInputDepth}
          setMaxInputDepth={setMaxInputDepth}
        />
      )}
    </LoadFrame>
  );
}

function TopDownBody({
  batch, lineage, sim, maxLevels, setMaxLevels, maxInputDepth, setMaxInputDepth,
}: {
  batch: Batch;
  lineage: LineageNode[];
  sim: boolean;
  maxLevels: number;
  setMaxLevels?: (v: number) => void;
  maxInputDepth: number;
  setMaxInputDepth?: (v: number) => void;
}) {
  const [selected, setSelected] = useState<LineageNode | null>(null);
  const focal = focalFromBatch(batch);
  const maxLevel = lineage.reduce((m, n) => Math.max(m, n.level), 0);

  return (
    <div>
      <SectionHeader
        eyebrow="04 — TOP-DOWN TRACEABILITY"
        title="Where did this batch go?"
        subtitle={`From this batch forward: consumed by internal process orders, transferred across plants, and delivered to customer. Graph walks up to ${Math.max(maxLevel, 1)} level${maxLevel === 1 ? "" : "s"} downstream.`}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 20 }}>
        <KPI label="Distinct customers" value={fmtInt(batch.customers_affected)} tone={sim ? "bad" : "default"} />
        <KPI label="Distinct countries" value={fmtInt(batch.countries_affected)} tone={sim ? "bad" : "default"} />
        <KPI label="Total shipped" value={fmtN(batch.total_shipped_kg, 1)} unit={batch.uom} />
        <KPI label="Deliveries" value={fmtInt(batch.total_deliveries)} />
        <KPI label="Output tiers" value={maxLevel} sub={`${lineage.length} downstream nodes`} tone="brand" />
      </div>

      {/* Depth toolbar */}
      {(setMaxLevels || setMaxInputDepth) && (
        <div style={{ display: "flex", gap: 20, marginBottom: 12, alignItems: "flex-end" }}>
          {setMaxInputDepth && (
            <DepthControl label="Input depth ↑" value={maxInputDepth} onChange={setMaxInputDepth} />
          )}
          {setMaxLevels && (
            <DepthControl label="Trace depth ↓" value={maxLevels} onChange={setMaxLevels} />
          )}
        </div>
      )}

      <Card title="Material lineage — outputs" subtitle="Drag to pan · scroll to zoom · click any node" noPad style={{ marginBottom: 20 }}>
        <LineageGraph
          focal={focal}
          upstream={[]}
          downstream={lineage}
          highlightMode="downstream"
          selectedId={selected?.id}
          sim={sim}
          onNodeClick={(n) => {
            if ("kind" in n && n.kind === "focal") {
              setSelected(null);
            } else {
              setSelected(n as LineageNode);
            }
          }}
        />
      </Card>

      <NodeDetailPanel node={selected} onClose={() => setSelected(null)} />

      <Card title="Distribution trace" subtitle={`${lineage.length} downstream links`} noPad>
        {lineage.length === 0 ? (
          <EmptyBlock message="No downstream consumption or transfers recorded." />
        ) : (
          <DataTable<LineageNode>
            columns={[
              { header: "Level", render: (r) => "L" + r.level, mono: true, align: "center" },
              { header: "Direction", render: () => "↓ Downstream" },
              { header: "Material ID", key: "material_id", mono: true },
              { header: "Material", key: "material" },
              { header: "Batch", key: "batch", mono: true },
              { header: "Plant", key: "plant", muted: true },
              { header: "Customer", render: (r) => r.customer ?? "—" },
              { header: "Qty", render: (r) => fmtN(r.qty, 1) + " " + r.uom, align: "right", mono: true, num: true },
              {
                header: "Link type",
                render: (r) => (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--ink-3)" }}>
                    {r.link}
                  </span>
                ),
              },
            ]}
            rows={lineage}
            emphasize={(r) => sim && r.id === selected?.id}
          />
        )}
      </Card>
    </div>
  );
}
