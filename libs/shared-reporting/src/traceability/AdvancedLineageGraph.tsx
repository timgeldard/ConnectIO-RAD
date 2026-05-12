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
  type LineageReactFlowEdge,
  type LineageReactFlowNode,
} from './graphTransformers'
import { applyLayout, type LayoutDirection } from './layoutEngines'
import { colourForLink, FocalNodeView, LineageNodeView } from './nodes'
import {
  FOCAL_NODE_ID,
  FOCAL_NODE_TYPE,
  LINEAGE_NODE_TYPE,
  type AdvancedLineageData,
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
      }),
    [data, direction, maxUpstreamLevel, maxDownstreamLevel],
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
  const styledEdges = useMemo<LineageReactFlowEdge[]>(() => {
    if (!positioned) return []
    return positioned.edges.map((e) => {
      const link = e.data?.link ?? ''
      const dashed = link === 'CONSUMPTION' || link === 'INTERNAL'
      return {
        ...e,
        animated: false,
        style: {
          stroke: colourForLink(link),
          strokeWidth: 1.5,
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
