/* eslint-disable jsdoc/require-jsdoc */
import { useState } from "react";
import type { Batch, LineageNode, PageId } from "../types";
import { fetchBottomUp, focalFromBatch } from "../data/api";
import { useBatchData } from "../data/useBatchData";
import { LoadFrame, EmptyBlock } from "../components/LoadFrame";
import { LineageGraph, NodeDetailPanel } from "../components/LineageGraph";
import { CytoscapeGraph, type CytoscapeMode } from "../components/CytoscapeGraph";
import { GraphViewToggle, type GraphViewMode } from "../components/GraphViewToggle";
import {
  AdvancedLineageGraph,
  LineageTableView,
  SankeyFlowView,
  TraceFilterControls,
  buildExplainTransferPrompt,
  toFilterValue,
  useTraceViewState,
} from "@connectio/shared-reporting";
import "@xyflow/react/dist/style.css";
import type { GeniePageContext } from "../genie/api";
import { fromLineageNodeContext } from "../genie/pageContext";
import { usePersistentMode } from "../hooks/usePersistentMode";

const BOTTOM_UP_VIEWS: GraphViewMode[] = [
  "lineage",
  "tree",
  "network",
  "advanced",
  "sankey",
  "table",
];
import { Card, DataTable, DepthControl, KPI, SectionHeader, StatusPill, fmtN } from "../ui";
import { useI18n } from "@connectio/shared-frontend-i18n";
import { plural, template, traceCopy } from "../i18n/pageCopy";

/**
 * Bottom-up traceability page — renders upstream lineage for the
 * supplied focal batch (KPIs, advanced/sankey/table views, inbound flow
 * summary, flat lineage table).  Loads its own batch payload via
 * `useBatchData(fetchBottomUp, ...)`.
 *
 * @returns The rendered bottom-up lineage view.
 */
export function PageBottomUp({
  batch: headerBatch,
  sim = false,
  maxLevels = 3,
  setMaxLevels,
  maxInputDepth = 3,
  setMaxInputDepth,
  openGenie,
}: {
  /** Header batch from the App-level live-batch lookup. */
  batch: Batch;
  /** Cross-page navigation handler (unused on this page but part of `PageProps`). */
  navigate: (id: PageId) => void;
  /** Simulation banner toggle. */
  sim?: boolean;
  /** Cap on lineage depth rendered in the classic graph. */
  maxLevels?: number;
  /** Setter for the trace-depth slider. */
  setMaxLevels?: (v: number) => void;
  /** Cap on input-depth rendered in the classic graph. */
  maxInputDepth?: number;
  /** Setter for the input-depth slider. */
  setMaxInputDepth?: (v: number) => void;
  /** Callback to open the shell-level Genie drawer with a pre-filled
   * prompt and page context — used by the advanced graph's
   * right-click "Explain this transfer" menu. */
  openGenie?: (opts: { prompt: string; pageContext: GeniePageContext }) => void;
}) {
  const { language } = useI18n();
  const copy = traceCopy(language);
  const state = useBatchData(fetchBottomUp, headerBatch.material_id, headerBatch.batch_id);
  return (
    <LoadFrame
      state={state}
      eyebrow={copy.bottom.eyebrow}
      loadingTitle={copy.bottom.loading}
      loadingSubtitle={template(copy.common.loadingSubtitle, { material: headerBatch.material_id, batch: headerBatch.batch_id })}
    >
      {({ batch, lineage }) => (
        <BottomUpBody
          batch={batch}
          lineage={lineage}
          sim={sim}
          maxLevels={maxLevels}
          setMaxLevels={setMaxLevels}
          maxInputDepth={maxInputDepth}
          setMaxInputDepth={setMaxInputDepth}
          openGenie={openGenie}
        />
      )}
    </LoadFrame>
  );
}

function BottomUpBody({
  batch, lineage, sim, maxLevels, setMaxLevels, maxInputDepth, setMaxInputDepth, openGenie,
}: {
  batch: Batch;
  lineage: LineageNode[];
  sim: boolean;
  maxLevels: number;
  setMaxLevels?: (v: number) => void;
  maxInputDepth: number;
  setMaxInputDepth?: (v: number) => void;
  openGenie?: (opts: { prompt: string; pageContext: GeniePageContext }) => void;
}) {
  const [selected, setSelected] = useState<LineageNode | null>(null);
  const [graphView, setGraphView] = usePersistentMode<GraphViewMode>(
    "trace2:graphView:bottomUp",
    "lineage",
    BOTTOM_UP_VIEWS,
  );
  // BottomUp is by definition upstream-only — the filter bar surfaces depth
  // + group + link toggles only; the direction segment is hidden via `show`.
  // State is URL-synced via the shared TraceViewState so investigators can
  // share a link that reopens the same filtered view.
  const [traceView, updateTraceView] = useTraceViewState({ direction: "upstream" });
  const { language } = useI18n();
  const copy = traceCopy(language);
  const focal = focalFromBatch(batch);
  const level1 = lineage.filter((n) => n.level === 1);
  const distinctSuppliers = new Set(
    lineage.map((n) => n.supplier).filter((s): s is string => !!s),
  ).size;
  const totalInbound = level1.reduce((s, n) => s + n.qty, 0);
  const maxLevel = lineage.reduce((m, n) => Math.max(m, n.level), 0);

  return (
    <div>
      <SectionHeader
        eyebrow={copy.bottom.eyebrow}
        title={copy.bottom.title}
        subtitle={template(copy.bottom.subtitle, { levels: plural(copy.common.oneLevel, copy.common.manyLevels, Math.max(maxLevel, 1)) })}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 20 }}>
        <KPI label={copy.bottom.daysToExpiry} value={batch.days_to_expiry} unit={copy.common.days} tone="neutral" />
        <KPI label={copy.bottom.shelfLife} value={<StatusPill status={batch.shelf_life_status} />} />
        <KPI label={copy.bottom.batchStatus} value={<StatusPill status={batch.batch_status} />} />
        <KPI label={copy.bottom.directInputs} value={level1.length} subtext={copy.bottom.levelOneMaterials} tone="neutral" />
        <KPI label={copy.bottom.distinctSuppliers} value={distinctSuppliers} />
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

      <Card title={copy.line.materialLineageInputs} subtitle={copy.line.graphHelp} noPad style={{ marginBottom: 20 }}>
        <div style={{ padding: "10px 14px 0" }}>
          <GraphViewToggle value={graphView} onChange={setGraphView} modes={BOTTOM_UP_VIEWS} />
        </div>
        {graphView === "lineage" ? (
          <LineageGraph
            focal={focal}
            upstream={lineage}
            downstream={[]}
            highlightMode="upstream"
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
        ) : graphView === "advanced" || graphView === "sankey" || graphView === "table" ? (
          <div>
            <TraceFilterControls
              value={toFilterValue(traceView)}
              onChange={updateTraceView}
              show={{ direction: false }}
              maxDepth={Math.max(8, maxLevel)}
            />
            <div style={{ padding: "0 14px 14px" }}>
              {graphView === "advanced" && (
                <AdvancedLineageGraph
                  data={{ focal, upstream: lineage, downstream: [] }}
                  direction="upstream"
                  orientation="RL"
                  maxUpstreamLevel={traceView.depthUpstream}
                  enabledLinks={traceView.enabledLinks}
                  groupBy={traceView.groupBy}
                  selectedId={selected?.id ?? null}
                  onNodeClick={(id) => {
                    if (id === focal.id) {
                      setSelected(null);
                      return;
                    }
                    const next = lineage.find((n) => n.id === id) ?? null;
                    setSelected(next);
                  }}
                  onExplainNode={
                    openGenie
                      ? (ctx) =>
                          openGenie({
                            prompt: buildExplainTransferPrompt(ctx),
                            pageContext: fromLineageNodeContext(ctx, "bottom-up"),
                          })
                      : undefined
                  }
                />
              )}
              {graphView === "sankey" && (
                <SankeyFlowView
                  data={{ focal, upstream: lineage, downstream: [] }}
                  direction="upstream"
                  maxUpstreamLevel={traceView.depthUpstream}
                  enabledLinks={traceView.enabledLinks}
                  groupBy={traceView.groupBy}
                  onNodeClick={(id) => {
                    if (id === focal.id) {
                      setSelected(null);
                      return;
                    }
                    const next = lineage.find((n) => n.id === id) ?? null;
                    setSelected(next);
                  }}
                />
              )}
              {graphView === "table" && (
                <LineageTableView
                  data={{ focal, upstream: lineage, downstream: [] }}
                  direction="upstream"
                  maxUpstreamLevel={traceView.depthUpstream}
                  enabledLinks={traceView.enabledLinks}
                  groupBy={traceView.groupBy}
                  onRowClick={(id) => {
                    if (id === focal.id) {
                      setSelected(null);
                      return;
                    }
                    const next = lineage.find((n) => n.id === id) ?? null;
                    setSelected(next);
                  }}
                />
              )}
            </div>
          </div>
        ) : (
          <div style={{ padding: "0 14px 14px" }}>
            <CytoscapeGraph
              focal={focal}
              upstream={lineage}
              downstream={[]}
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

      {level1.length > 0 && (
        <Card title={copy.bottom.inboundTitle} subtitle={template(copy.bottom.inboundSubtitle, { qty: fmtN(totalInbound, 0), uom: batch.uom })} style={{ marginBottom: 20 }}>
          <FlowSummary nodes={level1} />
        </Card>
      )}

      <Card title={copy.bottom.flatTitle} subtitle={template(copy.bottom.flatSubtitle, { count: lineage.length })} noPad>
        {lineage.length === 0 ? (
          <EmptyBlock message={copy.bottom.empty} />
        ) : (
          <DataTable<LineageNode>
            columns={[
              { header: copy.common.level, render: (r) => "L" + r.level, mono: true, align: "center" },
              { header: copy.common.direction, render: () => copy.bottom.direction },
              { header: copy.common.materialId, key: "material_id", mono: true },
              { header: copy.common.material, key: "material" },
              { header: copy.common.batch, key: "batch", mono: true },
              { header: copy.common.plantLocation, key: "plant", muted: true },
              { header: copy.common.supplier, render: (r) => r.supplier ?? "—" },
              { header: copy.common.qty, render: (r) => fmtN(r.qty, 1) + " " + r.uom, align: "right", mono: true, num: true },
              {
                header: copy.common.linkType,
                render: (r) => (
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--ink-3)", letterSpacing: "0.08em" }}>
                    {r.link}
                  </span>
                ),
              },
            ]}
            rows={lineage}
            emphasize={(r) => r.id === selected?.id}
          />
        )}
      </Card>
    </div>
  );
}

function FlowSummary({ nodes }: { nodes: LineageNode[] }) {
  const total = Math.max(1, nodes.reduce((s, n) => s + n.qty, 0));
  const palette = [
    "var(--valentia-slate)",
    "var(--sage)",
    "var(--jade)",
    "var(--sunrise)",
    "var(--brand-deep)",
    "var(--sunset)",
  ];
  return (
    <div>
      <div style={{ display: "flex", height: 44, borderRadius: 4, overflow: "hidden", marginBottom: 14 }}>
        {nodes.map((n, i) => (
          <div
            key={n.id}
            style={{
              flex: n.qty,
              background: palette[i % palette.length],
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {((n.qty / total) * 100).toFixed(1)}%
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(nodes.length, 4)}, 1fr)`, gap: 12 }}>
        {nodes.map((n, i) => (
          <div key={n.id}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, background: palette[i % palette.length] }} />
              <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--ink)" }}>
                {n.material}
              </span>
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
              {fmtN(n.qty, 0)} {n.uom}
            </div>
            <div style={{ fontFamily: "var(--font-sans)", fontSize: 10.5, color: "var(--ink-3)" }}>
              {n.supplier || n.plant || "—"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
