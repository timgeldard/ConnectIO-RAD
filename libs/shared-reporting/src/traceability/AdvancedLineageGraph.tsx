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
 * Features (all live; see `docs/trace2-advanced-visualisation.md` for history)
 * --------------------------------------------------------------------------
 * - Smart node grouping by Plant or Material via the `groupBy` prop;
 *   intra-group edges collapse, cross-group edges aggregate qty.
 * - Path-quantity overlay: stroke thickness derived from per-edge
 *   `flow_qty` (falling back to per-node `qty` when the backend has not
 *   shipped flow_qty yet).
 * - Sankey-style overview ships separately (`SankeyFlowView`).
 * - Genie "Explain this transfer" right-click menu via the
 *   `onExplainNode` prop; hidden when the host does not wire it.
 * - PNG / SVG export via the floating Export menu (`html-to-image`).
 * - High-contrast theme via `theme="high-contrast"`.
 * - Viewport culling via React Flow's `onlyRenderVisibleElements`
 *   beyond `virtualiseAbove` (default 150 nodes).
 */
import { useEffect, useMemo, useRef, useState } from 'react'

import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type NodeMouseHandler,
} from '@xyflow/react'

import {
  buildExportFilename,
  downloadBlob,
  svgStringToBlob,
} from './exportHelpers'
import {
  buildLineageGraph,
  type GroupByMode,
  type LineageReactFlowEdge,
  type LineageReactFlowNode,
} from './graphTransformers'
import { applyLayout, type LayoutDirection } from './layoutEngines'
import { LineageExportMenu } from './LineageExportMenu'
import {
  colourForLink,
  FocalNodeView,
  GroupNodeView,
  LineageNodeView,
  LineageThemeContext,
  paletteFor,
} from './nodes'
import {
  FOCAL_NODE_ID,
  FOCAL_NODE_TYPE,
  GROUP_NODE_TYPE,
  LINEAGE_NODE_TYPE,
  type AdvancedLineageData,
  type AdvancedLineageNode,
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
  /**
   * Node-count threshold at which React Flow switches to its built-in
   * viewport culling (``onlyRenderVisibleElements``).  Defaults to 150 —
   * tuned against typical recall-trace graphs where 200+ batches stall
   * the renderer otherwise.  Set to `Infinity` to disable culling.
   */
  virtualiseAbove?: number
  /**
   * Visual theme.  ``'default'`` matches the classic component's palette;
   * ``'high-contrast'`` shifts to a higher contrast set sized for plant-floor
   * tablets in bright environments.  Theme is applied at the React Flow
   * level (background grid + control glyphs) and is forwarded to each
   * custom node renderer through the `data.theme` field.
   */
  theme?: 'default' | 'high-contrast'
  /** Whether to render the floating Export ▾ menu.  Default `true`. */
  showExportMenu?: boolean
  /**
   * Optional Genie ("Explain this transfer") dispatch handler.
   *
   * When provided, right-clicking any non-focal node opens a small context
   * menu with an *Explain this transfer* item.  The handler receives a
   * structured context object describing the clicked node and its place
   * in the lineage; the consumer is responsible for prompting Genie (or
   * any other AI assistant) and rendering the response.
   *
   * When omitted, the right-click menu is suppressed entirely — the lib
   * remains agnostic to whichever assistant a host app wires up.
   */
  onExplainNode?: (context: LineageNodeContext) => void
}

/**
 * The structured payload passed to ``onExplainNode``.  Stable shape across
 * versions of the lib so host apps can build Genie prompts once and not
 * have to chase field renames.
 */
export interface LineageNodeContext {
  /** Backend node id (matches the `id` field on `AdvancedLineageNode`). */
  id: string
  side: 'upstream' | 'downstream'
  material_id: string
  material: string
  batch_id: string
  plant: string
  link: string
  /** Per-edge material flow when the backend supplied it. */
  flow_qty?: number
  /** Per-node cumulative qty. */
  qty: number
  uom: string
  /** The focal batch, included so host apps don't have to thread it. */
  focal: {
    id: string
    material_id: string
    material: string
    batch_id: string
    plant: string
  }
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
  onExplainNode,
  height = 600,
  virtualiseAbove = 150,
  theme = 'default',
  showExportMenu = true,
}: AdvancedLineageGraphProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null)
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

  // Step 2: ELK is async.  Keep the previous positioned graph on screen
  // while we re-lay-out so the canvas does not flash empty on data
  // changes, and surface a small "Re-laying out…" badge so users know
  // why the view briefly does not respond to control changes.
  const [positioned, setPositioned] = useState<{
    nodes: LineageReactFlowNode[]
    edges: LineageReactFlowEdge[]
  } | null>(null)
  const [relayouting, setRelayouting] = useState(false)

  useEffect(() => {
    let cancelled = false
    setRelayouting(true)
    void (async () => {
      const laidNodes = await applyLayout(unlaid.nodes, unlaid.edges, {
        direction: orientation,
      })
      if (cancelled) return
      setPositioned({ nodes: laidNodes, edges: unlaid.edges })
      setRelayouting(false)
    })()
    return () => {
      cancelled = true
    }
  }, [unlaid, orientation])

  // Right-click context-menu state: anchored to the clicked node so it
  // appears next to the cursor and dismisses cleanly when the user
  // clicks elsewhere or presses Escape.
  const [menu, setMenu] = useState<
    | { x: number; y: number; nodeId: string }
    | null
  >(null)
  useEffect(() => {
    if (!menu) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenu(null)
    }
    const dismiss = () => setMenu(null)
    document.addEventListener('keydown', handler)
    document.addEventListener('click', dismiss)
    return () => {
      document.removeEventListener('keydown', handler)
      document.removeEventListener('click', dismiss)
    }
  }, [menu])

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

  const palette = useMemo(() => paletteFor(theme), [theme])

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
        labelStyle: {
          fontSize: 10,
          fill: theme === 'high-contrast' ? '#FFFFFF' : 'var(--ink-3, #6b7280)',
        },
        labelBgStyle: {
          fill: theme === 'high-contrast' ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.85)',
        },
        labelBgPadding: [3, 1] as [number, number],
        style: {
          stroke: colourForLink(link, palette),
          // 0.75 base + weight in pixels — 1.75..6.75 — gives strong visual
          // contrast without making heavy edges overlap node text.
          strokeWidth: 0.75 + weight,
          strokeDasharray: dashed ? '4 3' : undefined,
        },
      }
    })
  }, [positioned, palette, theme])

  // Translate React Flow's node-event signature into the simpler `(id) => …`
  // surface our consumers want.  The focal id is normalised back to the
  // consumer's own focal id so they can treat selection uniformly.
  const handleNodeClick: NodeMouseHandler = (_event, node) => {
    if (!onNodeClick) return
    const id = node.id === FOCAL_NODE_ID ? data.focal.id : node.id
    onNodeClick(id)
  }

  // Right-click → open the Genie / explain context menu, anchored to the
  // event position.  Suppress on the focal because "Explain this transfer"
  // does not apply to it; consumers can extend the menu later.
  const handleNodeContextMenu: NodeMouseHandler = (event, node) => {
    if (!onExplainNode) return
    if (node.id === FOCAL_NODE_ID) return
    event.preventDefault()
    setMenu({ x: event.clientX, y: event.clientY, nodeId: node.id })
  }

  const dispatchExplain = () => {
    if (!menu || !onExplainNode) return
    const nodeRow = positioned?.nodes.find((n) => n.id === menu.nodeId)
    if (!nodeRow || nodeRow.type !== LINEAGE_NODE_TYPE) {
      setMenu(null)
      return
    }
    const payload = nodeRow.data as {
      node: AdvancedLineageNode
      direction: 'upstream' | 'downstream'
    }
    const ctx: LineageNodeContext = {
      id: payload.node.id,
      side: payload.direction,
      material_id: payload.node.material_id,
      material: payload.node.material,
      batch_id: payload.node.batch,
      plant: payload.node.plant,
      link: String(payload.node.link),
      flow_qty: payload.node.flow_qty,
      qty: payload.node.qty,
      uom: payload.node.uom,
      focal: {
        id: data.focal.id,
        material_id: data.focal.material_id,
        material: data.focal.material,
        batch_id: data.focal.batch_id,
        plant: data.focal.plant,
      },
    }
    setMenu(null)
    onExplainNode(ctx)
  }

  const totalNodes = decoratedNodes.length
  const useVirtualisation = totalNodes > virtualiseAbove
  const themeIsHC = theme === 'high-contrast'

  // Capture the React Flow viewport node for image export.  React Flow
  // renders the actual graph SVG/Canvas inside a `.react-flow__viewport`
  // descendant of our wrapper — we target the wrapper so MiniMap +
  // Controls are included in the export.
  const captureViewport = async (format: 'png' | 'svg'): Promise<void> => {
    if (!wrapperRef.current) throw new Error('viewport not mounted')
    const { toPng, toSvg } = await import('html-to-image')
    const opts = {
      // Skip the export menu itself so it doesn't appear in screenshots.
      filter: (n: HTMLElement) =>
        !n.getAttribute?.('data-testid')?.startsWith('lineage-export-menu') &&
        !n.getAttribute?.('data-testid')?.startsWith('advanced-lineage-context-menu'),
      backgroundColor: themeIsHC ? '#0f172a' : '#ffffff',
      cacheBust: true,
    }
    let blob: Blob
    if (format === 'png') {
      const dataUrl = await toPng(wrapperRef.current, opts)
      const res = await fetch(dataUrl)
      blob = await res.blob()
    } else {
      const svgString = await toSvg(wrapperRef.current, opts)
      blob = svgStringToBlob(svgString)
    }
    downloadBlob(blob, buildExportFilename(data.focal, 'advanced', format))
  }

  return (
    <LineageThemeContext.Provider value={palette}>
    <div
      ref={wrapperRef}
      style={{
        height,
        width: '100%',
        position: 'relative',
        background: themeIsHC ? '#0f172a' : 'transparent',
      }}
      data-testid="advanced-lineage-graph"
      data-theme={theme}
      data-virtualised={useVirtualisation ? 'on' : 'off'}
    >
      <ReactFlow
        nodes={decoratedNodes}
        edges={styledEdges}
        nodeTypes={NODE_TYPES}
        onNodeClick={handleNodeClick}
        onNodeContextMenu={handleNodeContextMenu}
        fitView
        fitViewOptions={{ padding: 0.18 }}
        nodesDraggable={false}
        nodesConnectable={false}
        onlyRenderVisibleElements={useVirtualisation}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          gap={20}
          size={1}
          color={themeIsHC ? '#cbd5e1' : 'var(--line, #e3e7ec)'}
        />
        <MiniMap
          pannable
          zoomable
          style={{ width: 140, height: 90 }}
          nodeColor={(n) =>
            n.type === FOCAL_NODE_TYPE
              ? themeIsHC ? '#000000' : '#003C52'
              : themeIsHC ? '#475569' : '#94a3b8'
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
      {positioned && relayouting && (
        <div
          aria-live="polite"
          data-testid="advanced-lineage-relayouting"
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            padding: '4px 10px',
            background: 'rgba(0, 60, 82, 0.85)',
            color: '#fff',
            fontFamily: 'var(--font-sans, system-ui)',
            fontSize: 11,
            borderRadius: 4,
            pointerEvents: 'none',
            letterSpacing: '0.02em',
          }}
        >
          Re-laying out…
        </div>
      )}
      {useVirtualisation && (
        <div
          data-testid="advanced-lineage-virtualised-badge"
          style={{
            position: 'absolute',
            bottom: 8,
            right: 8,
            padding: '2px 8px',
            background: 'rgba(15, 23, 42, 0.72)',
            color: '#fff',
            fontFamily: 'var(--font-sans, system-ui)',
            fontSize: 10.5,
            borderRadius: 4,
            pointerEvents: 'none',
          }}
        >
          virtualised · {totalNodes} nodes
        </div>
      )}
      {menu && onExplainNode && (
        <div
          role="menu"
          data-testid="advanced-lineage-context-menu"
          // Stop propagation so the document-level dismiss listener does not
          // fire before the user's click on the menu item is recorded.
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: menu.y,
            left: menu.x,
            zIndex: 1000,
            background: 'var(--bg-surface, #ffffff)',
            border: '1px solid var(--line, #e3e7ec)',
            borderRadius: 6,
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            padding: '4px 0',
            minWidth: 220,
            fontFamily: 'var(--font-sans, system-ui)',
            fontSize: 13,
          }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={dispatchExplain}
            style={{
              display: 'block',
              width: '100%',
              padding: '6px 12px',
              background: 'transparent',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
              color: 'var(--ink-1, #16202a)',
            }}
          >
            ✦ Explain this transfer
          </button>
        </div>
      )}
      {showExportMenu && positioned && (
        <LineageExportMenu
          onPng={() => captureViewport('png')}
          onSvg={() => captureViewport('svg')}
        />
      )}
    </div>
    </LineageThemeContext.Provider>
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
