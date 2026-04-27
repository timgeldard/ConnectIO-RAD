import { useState } from "react";
import type { Batch, LineageNode, PageId } from "../types";
import { fetchTopDown, focalFromBatch } from "../data/api";
import { useBatchData } from "../data/useBatchData";
import { LoadFrame, EmptyBlock } from "../components/LoadFrame";
import { LineageGraph, NodeDetailPanel } from "../components/LineageGraph";
import { CytoscapeGraph, type CytoscapeMode } from "../components/CytoscapeGraph";
import { GraphViewToggle, type GraphViewMode } from "../components/GraphViewToggle";
import { usePersistentMode } from "../hooks/usePersistentMode";

// TopDown adds the "Blast radius" radial layout for recall impact analysis;
// BottomUp omits it (radial blast radius doesn't map to upstream auditing).
const TOP_DOWN_VIEWS: GraphViewMode[] = ["lineage", "tree", "network", "radial"];
import { Card, DataTable, DepthControl, KPI, SectionHeader, fmtN, fmtInt } from "../ui";
import { useI18n } from "@connectio/shared-frontend-i18n";
import { plural, template, traceCopy } from "../i18n/pageCopy";

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
  const { language } = useI18n();
  const copy = traceCopy(language);
  const state = useBatchData(fetchTopDown, headerBatch.material_id, headerBatch.batch_id);
  return (
    <LoadFrame
      state={state}
      eyebrow={copy.top.eyebrow}
      loadingTitle={copy.top.loading}
      loadingSubtitle={template(copy.common.loadingSubtitle, { material: headerBatch.material_id, batch: headerBatch.batch_id })}
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
  const [graphView, setGraphView] = usePersistentMode<GraphViewMode>(
    "trace2:graphView:topDown",
    "lineage",
    TOP_DOWN_VIEWS,
  );
  const { language } = useI18n();
  const copy = traceCopy(language);
  const focal = focalFromBatch(batch);
  const maxLevel = lineage.reduce((m, n) => Math.max(m, n.level), 0);

  return (
    <div>
      <SectionHeader
        eyebrow={copy.top.eyebrow}
        title={copy.top.title}
        subtitle={template(copy.top.subtitle, { levels: plural(copy.common.oneLevel, copy.common.manyLevels, Math.max(maxLevel, 1)) })}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 20 }}>
        <KPI label={copy.top.distinctCustomers} value={fmtInt(batch.customers_affected)} tone={sim ? "bad" : "default"} />
        <KPI label={copy.top.distinctCountries} value={fmtInt(batch.countries_affected)} tone={sim ? "bad" : "default"} />
        <KPI label={copy.top.totalShipped} value={fmtN(batch.total_shipped_kg, 1)} unit={batch.uom} />
        <KPI label={copy.common.deliveries} value={fmtInt(batch.total_deliveries)} />
        <KPI label={copy.top.outputTiers} value={maxLevel} sub={template(copy.top.outputSub, { count: lineage.length })} tone="brand" />
      </div>

      {/* Depth toolbar */}
      {(setMaxLevels || setMaxInputDepth) && (
        <div style={{ display: "flex", gap: 20, marginBottom: 12, alignItems: "flex-end" }}>
          {setMaxInputDepth && (
            <DepthControl label={copy.line.inputDepth} value={maxInputDepth} onChange={setMaxInputDepth} />
          )}
          {setMaxLevels && (
            <DepthControl label={copy.line.traceDepth} value={maxLevels} onChange={setMaxLevels} />
          )}
        </div>
      )}

      <Card title={copy.line.materialLineageOutputs} subtitle={copy.line.graphHelp} noPad style={{ marginBottom: 20 }}>
        <div style={{ padding: "10px 14px 0" }}>
          <GraphViewToggle value={graphView} onChange={setGraphView} modes={TOP_DOWN_VIEWS} />
        </div>
        {graphView === "lineage" ? (
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
        ) : (
          <div style={{ padding: "0 14px 14px" }}>
            <CytoscapeGraph
              focal={focal}
              upstream={[]}
              downstream={lineage}
              mode={graphView as CytoscapeMode}
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
          </div>
        )}
      </Card>

      <NodeDetailPanel node={selected} onClose={() => setSelected(null)} />

      <Card title={copy.top.distributionTitle} subtitle={template(copy.top.distributionSubtitle, { count: lineage.length })} noPad>
        {lineage.length === 0 ? (
          <EmptyBlock message={copy.top.empty} />
        ) : (
          <DataTable<LineageNode>
            columns={[
              { header: copy.common.level, render: (r) => "L" + r.level, mono: true, align: "center" },
              { header: copy.common.direction, render: () => copy.top.direction },
              { header: copy.common.materialId, key: "material_id", mono: true },
              { header: copy.common.material, key: "material" },
              { header: copy.common.batch, key: "batch", mono: true },
              { header: copy.common.plant, key: "plant", muted: true },
              { header: copy.common.customer, render: (r) => r.customer ?? "—" },
              { header: copy.common.qty, render: (r) => fmtN(r.qty, 1) + " " + r.uom, align: "right", mono: true, num: true },
              {
                header: copy.common.linkType,
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
