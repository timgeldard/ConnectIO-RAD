/**
 * Sankey overview of a lineage payload.
 *
 * Renders an ECharts sankey diagram where edge widths are scaled by the
 * backend ``flow_qty`` (per-edge material flow) when available, falling
 * back to per-node ``qty`` when an older payload omits ``flow_qty``.
 *
 * Why a separate view rather than another React Flow view mode?
 * -------------------------------------------------------------
 * Sankey diagrams are about *aggregate flow magnitude*, not graph
 * topology.  They're ideal when an investigator wants to answer "where
 * does the bulk of material go?" without caring about individual batches.
 * ECharts already ships a mature, accessible Sankey renderer and is
 * already in `shared-reporting`'s dependency graph (used by SPC,
 * KpiCard, etc.).  Reusing it costs almost nothing while giving us
 * a fundamentally different visual.
 *
 * Aggregation rules
 * -----------------
 * - Nodes: focal plus every distinct (material_id, batch_id, plant)
 *   tuple seen in the upstream / downstream payload, after applying
 *   the same direction + depth + link filters the advanced graph uses.
 * - Edges: one per (source, target, link) tuple with the qty summed
 *   across all rows.  Backend's ``flow_qty`` is already aggregated per
 *   edge, but we re-aggregate frontend-side so depth-cap drops yield
 *   correct totals.
 * - Self-transfers (rows whose id equals the focal) are dropped — they
 *   carry no flow into or out of the focal in Sankey semantics.
 */
import { useMemo } from 'react'
import type { EChartsOption } from 'echarts'

import { EChart } from '../charts/EChart'
import { ensureReportingEChartsTheme } from '../charts/echartsCore'
import { buildLineageGraph, type GroupByMode } from './graphTransformers'
import { colourForLink } from './nodes'
import {
  FOCAL_NODE_ID,
  type AdvancedLineageData,
  type AdvancedLinkType,
  type LineageDirection,
} from './types'

export interface SankeyFlowViewProps {
  /** The focal + upstream + downstream payload. */
  data: AdvancedLineageData
  /** Direction filter (must match what the rest of the page uses). */
  direction?: LineageDirection
  /** Upstream depth cap. */
  maxUpstreamLevel?: number
  /** Downstream depth cap. */
  maxDownstreamLevel?: number
  /** Link-type filter. */
  enabledLinks?: ReadonlySet<AdvancedLinkType>
  /** Group-by — if not 'none', the Sankey nodes are the group buckets. */
  groupBy?: GroupByMode
  /** Fixed height for the rendered chart. */
  height?: number | string
  /** Optional node-click handler; receives the React Flow node id. */
  onNodeClick?: (id: string) => void
}

/**
 * Render a Sankey diagram of the lineage flow.
 *
 * @param props See {@link SankeyFlowViewProps}.
 * @returns An `EChart` instance configured for the lineage Sankey, or
 *   a placeholder when no edges remain after filtering.
 */
export function SankeyFlowView({
  data,
  direction = 'both',
  maxUpstreamLevel,
  maxDownstreamLevel,
  enabledLinks,
  groupBy = 'none',
  height = 600,
  onNodeClick,
}: SankeyFlowViewProps) {
  ensureReportingEChartsTheme()

  const option = useMemo<EChartsOption>(() => {
    // We piggyback on buildLineageGraph so the Sankey honours every
    // filter the advanced graph honours.  The nodes/edges it produces
    // already have the right ids and aggregated weights.
    const { nodes, edges } = buildLineageGraph(data, {
      direction,
      maxUpstreamLevel,
      maxDownstreamLevel,
      enabledLinks,
      groupBy,
    })

    // ECharts requires non-zero values for every link or the chart
    // throws.  Default to 1 for "topological only" edges so they still
    // render visibly.
    const links = edges.map((e) => ({
      source: e.source,
      target: e.target,
      value: e.data?.qty != null && e.data.qty > 0 ? e.data.qty : 1,
      lineStyle: {
        color: colourForLink(e.data?.link ?? ''),
        opacity: 0.55,
      },
    }))

    const sankeyNodes = nodes.map((n) => {
      // The focal gets a distinctive label; everyone else uses material + batch.
      let name = n.id
      let displayName = n.id
      if (n.id === FOCAL_NODE_ID) {
        displayName = `★ ${data.focal.material} (${data.focal.batch_id})`
      } else if (n.type === 'lineageBatch') {
        const node = (n.data as { node: { material: string; batch: string } }).node
        displayName = `${node.material}\n${node.batch}`
      } else if (n.type === 'lineageGroup') {
        const g = n.data as { label: string }
        displayName = g.label
      }
      return {
        name,
        label: { show: true, formatter: () => displayName, fontSize: 11 },
      }
    })

    return {
      tooltip: {
        trigger: 'item',
        // ECharts' formatter callback type is unions across chart types; we
        // narrow defensively because Sankey emits dataType 'edge' for links
        // and 'node' for nodes.
        formatter: (raw: unknown) => {
          const p = raw as { dataType?: string; data?: Record<string, unknown> }
          const d = p.data ?? {}
          if (p.dataType === 'edge') {
            const value = (d.value as number) ?? 0
            return `<b>${d.source}</b> → <b>${d.target}</b><br/>flow_qty: ${value.toLocaleString()}`
          }
          return `<b>${(d.name as string) ?? ''}</b>`
        },
      },
      series: [
        {
          type: 'sankey',
          data: sankeyNodes,
          links,
          // Tighter inter-layer spacing keeps deep graphs readable.
          nodeWidth: 14,
          nodeGap: 12,
          emphasis: { focus: 'adjacency' },
          lineStyle: { curveness: 0.5 },
          label: { position: 'right', fontSize: 11 },
        },
      ],
    }
  }, [data, direction, maxUpstreamLevel, maxDownstreamLevel, enabledLinks, groupBy])

  // ECharts will render nothing useful when there are no links; surface a
  // friendly placeholder so the panel does not collapse silently.
  const hasContent =
    Array.isArray((option.series as { links?: unknown[] }[])?.[0]?.links) &&
    ((option.series as { links?: unknown[] }[])[0].links ?? []).length > 0

  return (
    <div style={{ height, width: '100%' }} data-testid="sankey-flow-view">
      {hasContent ? (
        <EChart
          option={option}
          style={{ height: '100%', width: '100%' }}
          ariaLabel="Lineage Sankey flow diagram"
          testId="sankey-flow-chart"
          onEvents={
            onNodeClick
              ? {
                  click: (p: { dataType?: string; data: Record<string, unknown> }) => {
                    if (p.dataType !== 'edge' && typeof p.data.name === 'string') {
                      onNodeClick(p.data.name as string)
                    }
                  },
                }
              : undefined
          }
        />
      ) : (
        <div
          style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--ink-3, #6b7280)',
            fontFamily: 'var(--font-sans, system-ui)',
            fontSize: 13,
            background: 'var(--bg-surface, #f8fafc)',
            border: '1px dashed var(--line, #e3e7ec)',
            borderRadius: 6,
          }}
        >
          No lineage flow to display — adjust direction / depth / link filters.
        </div>
      )}
    </div>
  )
}
