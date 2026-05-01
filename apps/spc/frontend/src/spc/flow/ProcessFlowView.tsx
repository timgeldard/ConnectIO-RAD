import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '@connectio/shared-ui'
import { shallowEqual, useSPCDispatch, useSPCSelector } from '../SPCContext'
import { useSPCFlow } from '../hooks/useSPCFlow'
import { layoutFlowGraph } from './layoutFlowGraph'
import ProcessNode from './ProcessNode'
import ProcessFlowLegend from './ProcessFlowLegend'
import type { ProcessFlowEdgeData, ProcessFlowNodeData, ProcessFlowNodeRecord } from '../types'

// ── Constants ──────────────────────────────────────────────────────────────

const NODE_W      = 184   // ProcessNode visual width
const NODE_HEIGHT = 145   // ProcessNode visual height (generous for rejection rate row)
const EDGE_Y      = 68    // Approximate vertical center for edge attachment

// ── Types ──────────────────────────────────────────────────────────────────

type TraceDirection = 'upstream' | 'downstream' | null

interface ViewportState { x: number; y: number; scale: number }

interface SvgNode {
  id: string
  position: { x: number; y: number }
  data: ProcessFlowNodeData
}

interface SvgEdge {
  id: string
  source: string
  target: string
  isAnimated: boolean
  d: string
}

// ── Helpers ────────────────────────────────────────────────────────────────

function cubicEdge(
  srcPos: { x: number; y: number },
  tgtPos: { x: number; y: number },
): string {
  const sx = srcPos.x + NODE_W
  const sy = srcPos.y + EDGE_Y
  const tx = tgtPos.x
  const ty = tgtPos.y + EDGE_Y
  const mx = sx + (tx - sx) * 0.5
  return `M${sx},${sy} C${mx},${sy} ${mx},${ty} ${tx},${ty}`
}

function buildFlowElements(
  rawNodes?: ProcessFlowNodeRecord[] | null,
  rawEdges?: ProcessFlowEdgeData[] | null,
): { nodes: SvgNode[]; edges: SvgEdge[] } {
  if (!rawNodes?.length) return { nodes: [], edges: [] }

  const positioned = layoutFlowGraph(rawNodes, rawEdges ?? [])
  const posMap = new Map(positioned.map(n => [n.id, n.position]))

  const nodes: SvgNode[] = positioned.map(n => {
    const totalBatches    = n.total_batches ?? 0
    const rejectedBatches = n.rejected_batches ?? 0
    const rejectionRate   = totalBatches > 0 ? Number(((rejectedBatches / totalBatches) * 100).toFixed(1)) : null
    const inferredSignal  = Boolean(
      n.last_ooc || n.has_ooc_signal || n.status === 'red'
        || (typeof n.estimated_cpk === 'number' && n.estimated_cpk < 1),
    )
    return {
      id: n.id,
      position: n.position,
      data: {
        material_id:        n.material_id,
        material_name:      n.material_name,
        plant_name:         n.plant_name,
        total_batches:      totalBatches,
        rejected_batches:   rejectedBatches,
        rejection_rate_pct: rejectionRate,
        mic_count:          n.mic_count,
        mean_value:         n.mean_value,
        stddev_value:       n.stddev_value,
        estimated_cpk:      n.estimated_cpk,
        has_ooc_signal:     inferredSignal,
        last_ooc:           typeof n.last_ooc === 'string' ? n.last_ooc : null,
        status:             n.status,
        is_root:            n.is_root,
        sparkline_values:   n.sparkline_values ?? [],
      },
    }
  })

  const edges: SvgEdge[] = (rawEdges ?? []).map((e, i) => {
    const sp = posMap.get(e.source)
    const tp = posMap.get(e.target)
    if (!sp || !tp) return null
    const sourceNode = rawNodes.find(n => n.id === e.source)
    return {
      id: `e-${e.source}-${e.target}-${i}`,
      source: e.source,
      target: e.target,
      isAnimated: sourceNode?.status === 'red',
      d: cubicEdge(sp, tp),
    }
  }).filter((e): e is SvgEdge => e != null)

  return { nodes, edges }
}

function computeBounds(nodes: SvgNode[]) {
  const xs = nodes.map(n => n.position.x)
  const ys = nodes.map(n => n.position.y)
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs) + NODE_W,
    maxY: Math.max(...ys) + NODE_HEIGHT,
  }
}

function fitTransform(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  containerW: number,
  containerH: number,
  padding = 48,
): ViewportState {
  const contentW = bounds.maxX - bounds.minX
  const contentH = bounds.maxY - bounds.minY
  const scale = Math.min(1.4, Math.min(
    (containerW - padding * 2) / contentW,
    (containerH - padding * 2) / contentH,
  ))
  const x = (containerW - contentW * scale) / 2 - bounds.minX * scale
  const y = (containerH - contentH * scale) / 2 - bounds.minY * scale
  return { x, y, scale }
}

function collectLinkedNodeIds(
  startId: string,
  direction: 'upstream' | 'downstream',
  edges: SvgEdge[],
): Set<string> {
  const visited = new Set<string>([startId])
  const queue   = [startId]

  while (queue.length > 0) {
    const current = queue.shift()
    if (!current) continue
    edges.forEach(edge => {
      const nextId = direction === 'upstream'
        ? (edge.target === current ? edge.source : null)
        : (edge.source === current ? edge.target : null)
      if (nextId && !visited.has(nextId)) {
        visited.add(nextId)
        queue.push(nextId)
      }
    })
  }
  return visited
}

// ── Main view ──────────────────────────────────────────────────────────────

export default function ProcessFlowView() {
  const dispatch = useSPCDispatch()
  const state = useSPCSelector(
    current => ({
      selectedMaterial:            current.selectedMaterial,
      dateFrom:                    current.dateFrom,
      dateTo:                      current.dateTo,
      processFlowUpstreamDepth:    current.processFlowUpstreamDepth,
      processFlowDownstreamDepth:  current.processFlowDownstreamDepth,
    }),
    shallowEqual,
  )
  const { flowData, loading, error } = useSPCFlow(
    state.selectedMaterial?.material_id,
    state.dateFrom,
    state.dateTo,
    state.processFlowUpstreamDepth,
    state.processFlowDownstreamDepth,
  )

  const [svgNodes, setSvgNodes]         = useState<SvgNode[]>([])
  const [svgEdges, setSvgEdges]         = useState<SvgEdge[]>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [traceDirection, setTraceDirection] = useState<TraceDirection>(null)
  const [viewport, setViewport]         = useState<ViewportState>({ x: 40, y: 40, scale: 1 })

  const containerRef    = useRef<HTMLDivElement>(null)
  const isDragging      = useRef(false)
  const didDrag         = useRef(false)
  const mouseDownPos    = useRef({ x: 0, y: 0 })
  const lastMouse       = useRef({ x: 0, y: 0 })

  // Sync nodes/edges when flow data changes
  useEffect(() => {
    const { nodes: n, edges: e } = buildFlowElements(flowData?.nodes, flowData?.edges)
    setSvgNodes(n)
    setSvgEdges(e)
    setSelectedNodeId(cur => (cur && n.some(nd => nd.id === cur) ? cur : null))
    setTraceDirection(null)
  }, [flowData])

  // Fit view when node count changes (new material selection)
  useEffect(() => {
    if (!svgNodes.length) return
    const doFit = () => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect && rect.width > 0) {
        setViewport(fitTransform(computeBounds(svgNodes), rect.width, rect.height))
      }
    }
    doFit()
    // Retry next frame in case the container hasn't laid out yet
    const id = requestAnimationFrame(doFit)
    return () => cancelAnimationFrame(id)
  }, [svgNodes.length]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pan handlers ─────────────────────────────────────────────────────────

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target instanceof HTMLElement) return  // clicking HTML inside foreignObject
    isDragging.current   = true
    didDrag.current      = false
    mouseDownPos.current = { x: e.clientX, y: e.clientY }
    lastMouse.current    = { x: e.clientX, y: e.clientY }
    if (containerRef.current) containerRef.current.style.cursor = 'grabbing'
    e.preventDefault()
  }

  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging.current) return
    const dx = e.clientX - lastMouse.current.x
    const dy = e.clientY - lastMouse.current.y
    lastMouse.current = { x: e.clientX, y: e.clientY }
    if (Math.abs(e.clientX - mouseDownPos.current.x) > 3
     || Math.abs(e.clientY - mouseDownPos.current.y) > 3) {
      didDrag.current = true
    }
    setViewport(v => ({ ...v, x: v.x + dx, y: v.y + dy }))
  }

  const onMouseUp = () => {
    isDragging.current = false
    if (containerRef.current) containerRef.current.style.cursor = 'grab'
  }

  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.1 : 0.9
    const rect = e.currentTarget.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    setViewport(v => {
      const newScale = Math.min(2.5, Math.max(0.15, v.scale * factor))
      const sf = newScale / v.scale
      return { x: mx - (mx - v.x) * sf, y: my - (my - v.y) * sf, scale: newScale }
    })
  }

  const onCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target instanceof HTMLElement) return  // node click handled by node
    if (didDrag.current) return
    setSelectedNodeId(null)
    setTraceDirection(null)
  }

  const handleFitView = () => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect || !svgNodes.length) return
    setViewport(fitTransform(computeBounds(svgNodes), rect.width, rect.height))
  }

  const zoomIn  = () => setViewport(v => ({ ...v, scale: Math.min(2.5, v.scale * 1.2) }))
  const zoomOut = () => setViewport(v => ({ ...v, scale: Math.max(0.15, v.scale / 1.2) }))

  // ── Derived state ─────────────────────────────────────────────────────────

  const activateNode = useCallback((nodeData: ProcessFlowNodeData) => {
    dispatch({
      type: 'SELECT_MATERIAL_AND_CHARTS',
      payload: {
        material_id:   String(nodeData.material_id),
        material_name: typeof nodeData.material_name === 'string' ? nodeData.material_name : undefined,
      },
    })
  }, [dispatch])

  const selectedNode = useMemo(
    () => svgNodes.find(n => n.id === selectedNodeId) ?? null,
    [svgNodes, selectedNodeId],
  )

  const highlightedIds = useMemo(() => {
    if (!selectedNodeId) return new Set<string>()
    if (!traceDirection) return new Set<string>([selectedNodeId])
    return collectLinkedNodeIds(selectedNodeId, traceDirection, svgEdges)
  }, [svgEdges, selectedNodeId, traceDirection])

  const renderedNodes = useMemo(
    () => svgNodes.map(node => ({
      ...node,
      highlighted: highlightedIds.has(node.id),
    })),
    [svgNodes, highlightedIds],
  )

  const renderedEdges = useMemo(
    () => svgEdges.map(edge => {
      const hasSelection  = Boolean(selectedNodeId)
      const isHighlighted = highlightedIds.has(edge.source) && highlightedIds.has(edge.target)
      const isIncident    = edge.source === selectedNodeId || edge.target === selectedNodeId
      return {
        ...edge,
        isHighlighted,
        isIncident,
        opacity: hasSelection && !isHighlighted && !isIncident ? 0.18 : 1,
      }
    }),
    [svgEdges, highlightedIds, selectedNodeId],
  )

  // ── Guards ────────────────────────────────────────────────────────────────

  if (!state.selectedMaterial) {
    return (
      <div style={{ padding: '64px 20px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⬡</div>
        <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-2)', marginBottom: 6 }}>Select a material to view its process flow</div>
        <div>Each node shows batch rejection rate across the material network. Click a node to drill into control charts.</div>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ padding: 20 }}>
        <div style={{ height: 500, borderRadius: 10, background: 'var(--surface-2)', animation: 'fadeIn 400ms ease' }} />
      </div>
    )
  }

  if (error) {
    return (
      <div style={{
        margin: 20, padding: '14px 18px', borderRadius: 10,
        background: 'var(--status-risk-bg)', border: '1px solid var(--status-risk)',
        color: 'var(--status-risk)', fontSize: 13,
      }}>
        <strong>Failed to load process flow</strong> — {String(error)}
      </div>
    )
  }

  if (!svgNodes.length) {
    return (
      <div style={{ padding: '64px 20px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
        <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-2)', marginBottom: 6 }}>No process flow data found</div>
        <div>{state.selectedMaterial.material_name ?? state.selectedMaterial.material_id} may not have lineage data in the selected date range.</div>
      </div>
    )
  }

  // ── Main layout ───────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 20 }} className="fade-in">

      {/* Header */}
      <div className="card" style={{ padding: '14px 18px' }}>
        <div className="eyebrow">Material lineage review</div>
        <h3 style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 700, color: 'var(--text-1)' }}>Process Flow</h3>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-3)' }}>
          Review upstream and downstream lineage around {state.selectedMaterial.material_name}. Use this to trace where quality risk may propagate across the network.
        </p>
      </div>

      {/* Canvas + inspector */}
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(0, 1.5fr) 320px', alignItems: 'start' }}>

        {/* SVG canvas */}
        <div
          ref={containerRef}
          style={{
            position: 'relative',
            minHeight: 500,
            height: 'max(500px, calc(100vh - var(--header-h) - var(--filter-h) - 200px))',
            overflow: 'hidden',
            border: '1px solid var(--line-1)',
            background: 'var(--surface-0)',
            borderRadius: 10,
            cursor: 'grab',
            userSelect: 'none',
          }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onClick={onCanvasClick}
          onWheel={onWheel}
        >
          {/* Dot grid background */}
          <svg
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
            aria-hidden="true"
          >
            <defs>
              <pattern id="pfv-dot-grid" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="1" style={{ fill: 'var(--chart-grid)' }} />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#pfv-dot-grid)" />
          </svg>

          {/* Main interactive SVG */}
          <svg
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}
          >
            <g transform={`translate(${viewport.x},${viewport.y}) scale(${viewport.scale})`}>

              {/* Background click trap (deselect) */}
              <rect
                x="-100000" y="-100000"
                width="200000" height="200000"
                fill="transparent"
                style={{ cursor: 'grab' }}
              />

              {/* Edges */}
              {renderedEdges.map(edge => (
                <path
                  key={edge.id}
                  d={edge.d}
                  style={{
                    fill: 'none',
                    stroke: edge.isHighlighted
                      ? 'var(--sage)'
                      : edge.isIncident
                        ? 'var(--valentia-slate)'
                        : 'var(--line-2)',
                    strokeWidth: edge.isHighlighted ? 3 : edge.isIncident ? 2.4 : 1.5,
                    opacity: edge.opacity,
                  }}
                  className={edge.isAnimated ? 'flow-anim' : undefined}
                  strokeDasharray={edge.isAnimated ? '4 4' : undefined}
                />
              ))}

              {/* Nodes via foreignObject */}
              {renderedNodes.map(node => (
                <foreignObject
                  key={node.id}
                  x={node.position.x}
                  y={node.position.y}
                  width={NODE_W + 24}
                  height={NODE_HEIGHT + 24}
                  style={{ overflow: 'visible' }}
                >
                  <ProcessNode
                    data={node.data}
                    selected={node.id === selectedNodeId}
                    highlighted={node.highlighted}
                    hasSelection={Boolean(selectedNodeId)}
                    onClick={() => {
                      setSelectedNodeId(node.id)
                      setTraceDirection(null)
                    }}
                  />
                </foreignObject>
              ))}
            </g>
          </svg>

          {/* Hint bar */}
          <div style={{ position: 'absolute', top: 12, left: 12, zIndex: 10, display: 'flex', gap: 4, pointerEvents: 'none' }}>
            {['Drag to pan', 'Scroll to zoom', 'Click node to inspect'].map(hint => (
              <span key={hint} className="eyebrow" style={{
                background: 'var(--surface-1)', border: '1px solid var(--line-1)',
                padding: '3px 8px', borderRadius: 5, color: 'var(--text-3)',
              }}>
                {hint}
              </span>
            ))}
          </div>

          {/* Zoom controls */}
          <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <button className="icon-btn" title="Zoom in"  onClick={zoomIn}  style={{ background: 'var(--surface-1)', border: '1px solid var(--line-1)' }}>
              <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
            </button>
            <button className="icon-btn" title="Zoom out" onClick={zoomOut} style={{ background: 'var(--surface-1)', border: '1px solid var(--line-1)' }}>
              <span style={{ fontSize: 14, lineHeight: 1 }}>−</span>
            </button>
            <button className="icon-btn" title="Fit to view" onClick={handleFitView} style={{ background: 'var(--surface-1)', border: '1px solid var(--line-1)' }}>
              <Icon name="maximize" size={13} />
            </button>
          </div>

          <ProcessFlowLegend />
        </div>

        {/* Node inspector panel */}
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Panel header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
              <div>
                <div className="eyebrow">Node Inspector</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>
                  Select a node to inspect its quality posture, then trace the surrounding lineage.
                </div>
              </div>
              {selectedNode && (
                <button
                  className="icon-btn"
                  title="Clear node selection"
                  onClick={() => { setSelectedNodeId(null); setTraceDirection(null) }}
                >
                  <Icon name="x" size={14} />
                </button>
              )}
            </div>

            {/* Empty state */}
            {!selectedNode && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{
                  border: '1px dashed var(--line-2)', background: 'var(--surface-2)',
                  padding: '14px 16px', borderRadius: 8, fontSize: 13, color: 'var(--text-3)',
                }}>
                  Click any process node to inspect rejection rate, capability, and path tracing controls.
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <p style={{ margin: 0 }}><strong style={{ color: 'var(--status-ok)' }}>Green</strong> nodes are operationally healthy.</p>
                  <p style={{ margin: 0 }}><strong style={{ color: 'var(--status-warn)' }}>Amber</strong> nodes should be monitored for drift.</p>
                  <p style={{ margin: 0 }}><strong style={{ color: 'var(--status-risk)' }}>Red</strong> nodes are likely risk hotspots.</p>
                </div>
              </div>
            )}

            {/* Node details */}
            {selectedNode && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ border: '1px solid var(--line-1)', padding: '12px 14px', borderRadius: 8, background: 'var(--surface-2)' }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>
                    {selectedNode.data.material_name ?? selectedNode.data.material_id}
                  </div>
                  <div style={{ marginTop: 2, fontSize: 12, color: 'var(--text-3)' }}>
                    {selectedNode.data.plant_name ?? 'Plant not specified'}
                  </div>

                  <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13 }}>
                    {[
                      { label: 'Rejection',     value: selectedNode.data.rejection_rate_pct != null ? `${selectedNode.data.rejection_rate_pct.toFixed(1)}%` : 'Unavailable' },
                      { label: 'Estimated Cpk', value: selectedNode.data.estimated_cpk != null ? selectedNode.data.estimated_cpk.toFixed(2) : 'Unavailable' },
                      { label: 'Batches',       value: String(selectedNode.data.total_batches ?? 0) },
                      { label: 'Rejected',      value: String(selectedNode.data.rejected_batches ?? 0) },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <div className="eyebrow" style={{ marginBottom: 2 }}>{label}</div>
                        <div style={{ fontWeight: 500, color: 'var(--text-1)' }}>{value}</div>
                      </div>
                    ))}
                  </div>

                  {selectedNode.data.has_ooc_signal && (
                    <div style={{
                      marginTop: 10, padding: '6px 10px', fontSize: 12, fontWeight: 500, borderRadius: 6,
                      background: 'var(--status-risk-bg)', color: 'var(--status-risk)',
                      border: '1px solid var(--status-risk)',
                    }}>
                      {selectedNode.data.last_ooc
                        ? `Latest OOC signal ${selectedNode.data.last_ooc}`
                        : 'OOC attention inferred from current rejection or capability posture.'}
                    </div>
                  )}
                </div>

                {/* Trace buttons */}
                <div style={{ display: 'grid', gap: 6, gridTemplateColumns: '1fr 1fr' }}>
                  <button
                    className={`btn ${traceDirection === 'upstream' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setTraceDirection(c => c === 'upstream' ? null : 'upstream')}
                  >
                    <Icon name="git-branch" size={14} />
                    Upstream
                  </button>
                  <button
                    className={`btn ${traceDirection === 'downstream' ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setTraceDirection(c => c === 'downstream' ? null : 'downstream')}
                  >
                    <Icon name="route" size={14} />
                    Downstream
                  </button>
                </div>

                <button
                  className="btn btn-ghost"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => activateNode(selectedNode.data)}
                >
                  <Icon name="arrow-right" size={14} />
                  Open In Control Charts
                </button>

                {traceDirection && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px',
                    fontSize: 12, fontWeight: 500, color: 'var(--text-3)',
                    background: 'var(--surface-2)', borderRadius: 6,
                  }}>
                    <Icon name="maximize" size={12} />
                    {traceDirection === 'upstream' ? 'Upstream path highlighted' : 'Downstream path highlighted'}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
