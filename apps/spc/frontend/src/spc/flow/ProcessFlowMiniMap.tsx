import { useMemo } from 'react'
import { layoutFlowGraph } from './layoutFlowGraph'
import type { ProcessFlowResult } from '../types'

const STATUS_STYLE = {
  green: { fill: 'var(--status-ok-bg)',   stroke: 'var(--status-ok)',   dot: 'var(--status-ok)'   },
  amber: { fill: 'var(--status-warn-bg)', stroke: 'var(--status-warn)', dot: 'var(--status-warn)' },
  red:   { fill: 'var(--status-risk-bg)', stroke: 'var(--status-risk)', dot: 'var(--status-risk)' },
  grey:  { fill: 'var(--surface-2)',      stroke: 'var(--line-1)',      dot: 'var(--text-4)'      },
} as const

type StatusKey = keyof typeof STATUS_STYLE

const MINI_W = 60
const MINI_H = 20
const MINI_EDGE_Y = 10
const PAD = 10

function buildMiniLayout(flowData: ProcessFlowResult | null) {
  if (!flowData?.nodes?.length) return null

  const positioned = layoutFlowGraph(flowData.nodes, flowData.edges ?? [])
  const posMap = new Map(positioned.map(n => [n.id, n.position]))

  const xs = positioned.map(n => n.position.x)
  const ys = positioned.map(n => n.position.y)
  const minX = Math.min(...xs) - PAD
  const minY = Math.min(...ys) - PAD
  const maxX = Math.max(...xs) + MINI_W + PAD
  const maxY = Math.max(...ys) + MINI_H + PAD

  const nodes = positioned.map(n => {
    const status: StatusKey = (n.status ?? 'grey') in STATUS_STYLE
      ? (n.status as StatusKey)
      : 'grey'
    const s = STATUS_STYLE[status]
    const rawName = n.material_name || n.material_id || n.id
    const label = rawName.length > 10 ? rawName.substring(0, 9) + '…' : rawName
    return {
      id: n.id,
      x: n.position.x,
      y: n.position.y,
      label,
      fill: s.fill,
      stroke: s.stroke,
      dot: s.dot,
      hasSignal: Boolean(n.has_ooc_signal || n.last_ooc),
    }
  })

  const edges = (flowData.edges ?? []).map((e, i) => {
    const sp = posMap.get(e.source)
    const tp = posMap.get(e.target)
    if (!sp || !tp) return null
    const sx = sp.x + MINI_W
    const sy = sp.y + MINI_EDGE_Y
    const tx = tp.x
    const ty = tp.y + MINI_EDGE_Y
    const mx = sx + (tx - sx) * 0.5
    const isRed = flowData.nodes.find(n => n.id === e.source)?.status === 'red'
    return {
      id: `mini-${e.source}-${e.target}-${i}`,
      d:  `M${sx},${sy} C${mx},${sy} ${mx},${ty} ${tx},${ty}`,
      isRed,
    }
  }).filter((e): e is { id: string; d: string; isRed: boolean } => e != null)

  return { nodes, edges, viewBox: `${minX} ${minY} ${maxX - minX} ${maxY - minY}` }
}

interface ProcessFlowMiniMapProps {
  flowData: ProcessFlowResult | null
  loading: boolean
}

export default function ProcessFlowMiniMap({ flowData, loading }: ProcessFlowMiniMapProps) {
  const layout = useMemo(() => buildMiniLayout(flowData), [flowData])

  if (loading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Loading process flow…</span>
      </div>
    )
  }

  if (!layout) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text-4)' }}>No flow data for selected scope</span>
      </div>
    )
  }

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={layout.viewBox}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Edges */}
      {layout.edges.map(e => (
        <path
          key={e.id}
          d={e.d}
          style={{ fill: 'none', stroke: e.isRed ? 'var(--status-risk)' : 'var(--line-2)', strokeWidth: e.isRed ? 2 : 1.5 }}
        />
      ))}

      {/* Nodes */}
      {layout.nodes.map(n => (
        <g key={n.id}>
          <rect
            x={n.x} y={n.y}
            width={MINI_W} height={MINI_H}
            rx={3}
            style={{ fill: n.fill, stroke: n.stroke, strokeWidth: 1 }}
          />
          <circle cx={n.x + 7} cy={n.y + MINI_H / 2} r={3} style={{ fill: n.dot }} />
          {n.hasSignal && (
            <circle cx={n.x + MINI_W - 4} cy={n.y + 4} r={3} style={{ fill: 'var(--status-risk)' }} />
          )}
          <text
            x={n.x + 14} y={n.y + MINI_H / 2}
            style={{ fill: 'var(--text-1)', fontSize: 7, fontWeight: 600 }}
            dominantBaseline="middle"
          >
            {n.label}
          </text>
        </g>
      ))}
    </svg>
  )
}
