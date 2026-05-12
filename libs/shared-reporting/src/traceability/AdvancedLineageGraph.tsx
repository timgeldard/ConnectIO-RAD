/**
 * Advanced batch-traceability visualisation.
 *
 * The classic SVG `LineageGraph` in `apps/trace2/frontend` does pixel-perfect
 * 2-D rendering with a hand-rolled column layout — fast, but caps out around
 * 50 nodes before becoming unreadable.  This advanced view uses React Flow
 * (`@xyflow/react`) for interaction and elkjs for layered auto-layout so a
 * 200-node cross-site supply chain remains explorable.
 *
 * Design choices
 * --------------
 * - Visual language matches the classic component (focal yellow accent,
 *   link-type stroke colours, upstream/downstream tinting) so a side-by-side
 *   comparison stays cognitively cheap.
 * - Layout is async (ELK); we render a placeholder skeleton while the first
 *   layout pass resolves, then re-render with positions in place.
 * - State for direction / depth / selection lives in the parent via the
 *   `TraceViewState` contract (`./viewState.ts`); this component is a pure
 *   view over `data` plus optional `selectedId` + `onNodeClick`.
 * - We deliberately do NOT bundle React Flow's stylesheet via JS import here
 *   — consumers must add `import '@xyflow/react/dist/style.css'` at their
 *   app entry point.  Vendoring CSS through a library is fragile in Vite
 *   monorepos.
 *
 * Not yet implemented (tracked in `docs/trace2-advanced-visualisation.md`)
 * ---------------------------------------------------------------------
 * - Smart node grouping (collapse by Plant / Material Family)
 * - Path-quantity overlays (stroke thickness scaled to qty)
 * - Sankey-style aggregated overview
 * - Genie integration (right-click → "Explain this transfer")
 * - PNG/SVG export
 */
import { useEffect, useMemo, useState } from 'react'

import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type NodeMouseHandler,
} from '@xyflow/react'

import {
  buildLineageGraph,
  type GroupByMode,
  type LineageReactFlowEdge,
  type LineageReactFlowNode,
} from './graphTransformers'
import { applyLayout, type LayoutDirection } from './layoutEngines'
import { colourForLink, FocalNodeView, GroupNodeView, LineageNodeView } from './nodes'
import {
  FOCAL_NODE_ID,
  FOCAL_NODE_TYPE,
  GROUP_NODE_TYPE,
  LINEAGE_NODE_TYPE,
  type AdvancedLineageData,
  type AdvancedLinkType,
  type LineageDirection,
} from './types'

/** Direction the visual graph flows.  Defaults to LR (upstream left, downstream right). */
type Orientation = LayoutDirection

export interface AdvancedLineageGraphProps {
  /** The focal + upstream + downstream payload from the lineage endpoint. */
  data: AdvancedLineageData
  /** Filter the visible side(s).  Default `'both'`. */
  direction?: LineageDirection
  /** Cap upstream depth.  Default unlimited. */
  maxUpstreamLevel?: number
  /** Cap downstream depth.  Default unlimited. */
  maxDownstreamLevel?: number
  /** Subset of link types to keep visible; empty/undefined means "all". */
  enabledLinks?: ReadonlySet<AdvancedLinkType>
  /** Compound-node grouping strategy.  Default `'none'`. */
  groupBy?: GroupByMode
  /** Visual orientation. `'LR'` (default) puts upstream on the left. */
  orientation?: Orientation
  /** Currently selected node id (used to highlight one node). */
  selectedId?: string | null
  /** Fired when the user clicks any node — receives the node id. */
  onNodeClick?: (id: string) => void
  /** Optional fixed height; defaults to 600 to match the classic component. */
  height?: number | string
}

/** Custom React Flow node-type registry. */
const NODE_TYPES = {
  [FOCAL_NODE_TYPE]: FocalNodeView,
  [LINEAGE_NODE_TYPE]: LineageNodeView,
  [GROUP_NODE_TYPE]: GroupNodeView,
}

/**
 * Inner component sitting inside the React Flow provider.  Split out so the
 * provider itself can be mounted by the public `AdvancedLineageGraph` and
 * still share context with whatever the consumer renders alongside.
 */
function AdvancedLineageGraphInner({
  data,
  direction = 'both',
  maxUpstreamLevel,
  maxDownstreamLevel,
  enabledLinks,
  groupBy = 'none',
  orientation = 'LR',
  selectedId,
  onNodeClick,
  height = 600,
}: AdvancedLineageGraphProps) {
  // Step 1: transform the backend payload into Flow-shape nodes/edges.
  // Memoised on the inputs that actually affect topology.
  const unlaid = useMemo(
    () =>
      buildLineageGraph(data, {
        direction,
        maxUpstreamLevel,
        maxDownstreamLevel,
        enabledLinks,
        groupBy,
      }),
    [data, direction, maxUpstreamLevel, maxDownstreamLevel, enabledLinks, groupBy],
  )

  // Step 2: ELK is async — keep the previous positioned graph on screen
  // while we re-lay-out so the canvas does not flash empty on data changes.
  const [positioned, setPositioned] = useState<{
    nodes: LineageReactFlowNode[]
    edges: LineageReactFlowEdge[]
  } | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const laidNodes = await applyLayout(unlaid.nodes, unlaid.edges, {
        direction: orientation,
      })
      if (!cancelled) setPositioned({ nodes: laidNodes, edges: unlaid.edges })
    })()
    return () => {
      cancelled = true
    }
  }, [unlaid, orientation])

  // Step 3: decorate nodes with `selected` flag.  React Flow uses this to
  // adjust z-order and pass `selected` into our custom renderers.
  const decoratedNodes = useMemo<LineageReactFlowNode[]>(() => {
    if (!positioned) return []
    if (!selectedId) return positioned.nodes
    return positioned.nodes.map((n) =>
      n.id === selectedId || (selectedId === data.focal.id && n.id === FOCAL_NODE_ID)
        ? { ...n, selected: true }
        : n,
    )
  }, [positioned, selectedId, data.focal.id])

  // Step 4: style edges by link type — matches the classic LINK_STYLE map.
  // Width is driven by the `weight` field set during transform (qty roll-up
  // in 1..6), so heavy material flows are visually obvious without a
  // dedicated "show flow" toggle.
  const styledEdges = useMemo<LineageReactFlowEdge[]>(() => {
    if (!positioned) return []
    return positioned.edges.map((e) => {
      const link = e.data?.link ?? ''
      const dashed = link === 'CONSUMPTION' || link === 'INTERNAL'
      const weight = e.data?.weight ?? 1
      const qty = e.data?.qty
      return {
        ...e,
        animated: false,
        // Surface the qty in the native edge tooltip via React Flow's `label`.
        // Keep it tiny so it does not interfere with the graph at scale.
        label: qty != null ? formatQtyShort(qty) : undefined,
        labelStyle: { fontSize: 10, fill: 'var(--ink-3, #6b7280)' },
        labelBgStyle: { fill: 'rgba(255,255,255,0.85)' },
        labelBgPadding: [3, 1] as [number, number],
        style: {
          stroke: colourForLink(link),
          // 0.75 base + weight in pixels — 1.75..6.75 — gives strong visual
          // contrast without making heavy edges overlap node text.
          strokeWidth: 0.75 + weight,
          strokeDasharray: dashed ? '4 3' : undefined,
        },
      }
    })
  }, [positioned])

  // Translate React Flow's node-event signature into the simpler `(id) => …`
  // surface our consumers want.  The focal id is normalised back to the
  // consumer's own focal id so they can treat selection uniformly.
  const handleNodeClick: NodeMouseHandler = (_event, node) => {
    if (!onNodeClick) return
    const id = node.id === FOCAL_NODE_ID ? data.focal.id : node.id
    onNodeClick(id)
  }

  return (
    <div style={{ height, width: '100%', position: 'relative' }} data-testid="advanced-lineage-graph">
      <ReactFlow
        nodes={decoratedNodes}
        edges={styledEdges}
        nodeTypes={NODE_TYPES}
        onNodeClick={handleNodeClick}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        nodesDraggable={false}
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} size={1} color="var(--line, #e3e7ec)" />
        <MiniMap
          pannable
          zoomable
          style={{ width: 140, height: 90 }}
          nodeColor={(n) =>
            n.type === FOCAL_NODE_TYPE ? '#003C52' : '#94a3b8'
          }
        />
        <Controls showInteractive={false} />
      </ReactFlow>
      {!positioned && (
        <div
          aria-live="polite"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--ink-3, #6b7280)',
            fontFamily: 'var(--font-sans, system-ui)',
            fontSize: 13,
            pointerEvents: 'none',
          }}
        >
          Laying out graph…
        </div>
      )}
    </div>
  )
}

/**
 * Public entry point.  Wraps the inner component in a React Flow provider
 * so this component can be dropped into any tree without the consumer
 * needing to remember the provider boilerplate.
 */
export function AdvancedLineageGraph(props: AdvancedLineageGraphProps) {
  return (
    <ReactFlowProvider>
      <AdvancedLineageGraphInner {...props} />
    </ReactFlowProvider>
  )
}

/**
 * Format a qty roll-up for inline edge labels.  Aggressive shortening
 * (kilos → ``k``, millions → ``M``) keeps the label visually compact even
 * at a fitted-view zoom level.
 */
function formatQtyShort(qty: number): string {
  const abs = Math.abs(qty)
  if (abs >= 1_000_000) return `${(qty / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${(qty / 1_000).toFixed(1)}k`
  if (abs >= 10) return qty.toFixed(0)
  return qty.toFixed(1)
}
