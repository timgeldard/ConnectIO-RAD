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
import { useMemo, useRef } from 'react'
import type { EChartsOption } from 'echarts'

import { EChart } from '../charts/EChart'
import { ensureReportingEChartsTheme } from '../charts/echartsCore'
import {
  buildExportFilename,
  downloadBlob,
  pngDataUrlToBlob,
  svgStringToBlob,
} from './exportHelpers'
import { buildLineageGraph, type GroupByMode } from './graphTransformers'
import { LineageExportMenu } from './LineageExportMenu'
import { colourForLink } from './nodes'
import {
  FOCAL_NODE_ID,
  type AdvancedLineageData,
  type AdvancedLinkType,
  type LineageDirection,
} from './types'

/**
 * Minimal structural type for the ECharts instance, declared locally
 * because pulling in the full `ECharts` type from `echarts/core`
 * drags transitive types we do not otherwise need.  Covers the two
 * methods this view actually calls.
 */
interface EChartsLikeInstance {
  getDataURL: (opts: { type: 'png' | 'svg'; backgroundColor?: string }) => string
  renderToSVGString?: () => string
}

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
  /** Whether to render the Export ▾ menu.  Default `true`. */
  showExportMenu?: boolean
  /** Visual theme — propagates to the export background colour. */
  theme?: 'default' | 'high-contrast'
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
  showExportMenu = true,
  theme = 'default',
}: SankeyFlowViewProps) {
  ensureReportingEChartsTheme()
  // Capture the ECharts instance via onChartReady so the Export menu
  // can call getDataURL (PNG) and renderToSVGString (when available).
  // We avoid the React ref approach because our `EChart` wrapper does
  // not forward refs — adding forwardRef there would cascade through
  // every consumer of the wrapper.
  const echartsInstanceRef = useRef<EChartsLikeInstance | null>(null)

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
          // Node ids and names can contain arbitrary characters (batch
          // ids occasionally include `<`, `&`, or quotes when systems
          // outside SAP feed them).  ECharts renders tooltip formatter
          // output as raw HTML, so any string from the payload must be
          // entity-escaped before interpolation.  Numeric values (qty)
          // are safe because they round-trip through toLocaleString().
          const source = escapeHtml(String(d.source ?? ''))
          const target = escapeHtml(String(d.target ?? ''))
          const name = escapeHtml(String(d.name ?? ''))
          if (p.dataType === 'edge') {
            const value = (d.value as number) ?? 0
            return `<b>${source}</b> → <b>${target}</b><br/>flow_qty: ${value.toLocaleString()}`
          }
          return `<b>${name}</b>`
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

  const bg = theme === 'high-contrast' ? '#0f172a' : '#ffffff'

  const exportPng = async (): Promise<void> => {
    const inst = echartsInstanceRef.current
    if (!inst) throw new Error('chart instance not ready')
    const dataUrl = inst.getDataURL({ type: 'png', backgroundColor: bg })
    downloadBlob(pngDataUrlToBlob(dataUrl), buildExportFilename(data.focal, 'sankey', 'png'))
  }

  const exportSvg = async (): Promise<void> => {
    const inst = echartsInstanceRef.current
    if (!inst) throw new Error('chart instance not ready')
    // Prefer ECharts' direct SVG string when the SVG renderer is on; fall
    // back to a data-URL bridge otherwise.  Either path produces a clean
    // vector that opens cleanly in Illustrator / Figma.
    let svgString: string
    if (typeof inst.renderToSVGString === 'function') {
      svgString = inst.renderToSVGString()
    } else {
      const dataUrl = inst.getDataURL({ type: 'svg', backgroundColor: bg })
      svgString = decodeURIComponent(dataUrl.replace(/^data:image\/svg\+xml(;[^,]*)?,/, ''))
    }
    downloadBlob(svgStringToBlob(svgString), buildExportFilename(data.focal, 'sankey', 'svg'))
  }

  return (
    <div
      style={{ height, width: '100%', position: 'relative' }}
      data-testid="sankey-flow-view"
      data-theme={theme}
    >
      {hasContent ? (
        <EChart
          option={option}
          style={{ height: '100%', width: '100%' }}
          ariaLabel="Lineage Sankey flow diagram"
          testId="sankey-flow-chart"
          onChartReady={(inst: EChartsLikeInstance) => {
            echartsInstanceRef.current = inst
          }}
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
      {showExportMenu && hasContent && (
        <LineageExportMenu onPng={exportPng} onSvg={exportSvg} />
      )}
    </div>
  )
}

/**
 * Entity-escape a string for safe interpolation into ECharts tooltip HTML.
 *
 * Kept inline (rather than pulling in a dependency) because the escape
 * set is tiny and the function is hot-path: it runs on every tooltip
 * hover.  Covers the only characters HTML would actually interpret.
 *
 * @param s Raw string from the lineage payload.
 * @returns HTML-safe version of the same string.
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
