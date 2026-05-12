/**
 * Custom React Flow node renderers for the advanced lineage view.
 *
 * Styling matches the classic SVG component
 * (`apps/trace2/frontend/src/components/LineageGraph.tsx`) so the two
 * views are visually consistent: yellow accent on the focal node, plant
 * + qty subtext, link-type colour on the left edge for lineage nodes.
 */
import { Handle, Position, type NodeProps } from '@xyflow/react'

import type { FocalNodeData, LineageNodeData } from './graphTransformers'
import type { AdvancedLinkType } from './types'

/** Stroke colours indexed by link type — matches LINK_STYLE in LineageGraph.tsx. */
const LINK_COLOR: Record<string, string> = {
  RECEIPT: '#289BA2',
  CONSUMPTION: '#F9C20A',
  INTERNAL: '#8A9E6A',
  SALES_ORDER: '#005776',
}

/** Helper used by the custom edge renderer; exported for reuse. */
export function colourForLink(link: AdvancedLinkType): string {
  return LINK_COLOR[link] ?? 'var(--ink-3, #6b7280)'
}

/** Format quantity with thousands separators, fixed precision when needed. */
function fmtQty(qty: number, uom: string): string {
  const abs = Math.abs(qty)
  const decimals = abs > 0 && abs < 10 ? 2 : 0
  return `${qty.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })} ${uom}`
}

/**
 * Focal-node card.
 *
 * Dark teal background mirrors the classic component's focal styling.
 * Yellow left accent (`#DFFF11`) is the brand "you are here" cue.
 */
export function FocalNodeView({ data, selected }: NodeProps) {
  const focal = (data as FocalNodeData).focal
  return (
    <div
      style={{
        width: 280,
        minHeight: 112,
        background: '#003C52',
        color: '#F2F6F8',
        borderRadius: 6,
        padding: '12px 14px',
        boxShadow: selected
          ? '0 0 0 2px #F24A00, 0 6px 14px rgba(0,0,0,0.16)'
          : '0 4px 10px rgba(0,0,0,0.14)',
        position: 'relative',
        fontFamily: 'var(--font-sans, system-ui)',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          top: 8,
          bottom: 8,
          width: 4,
          background: '#DFFF11',
          borderRadius: 2,
        }}
      />
      <div style={{ fontSize: 11, opacity: 0.7, letterSpacing: '0.04em' }}>FOCAL BATCH</div>
      <div style={{ fontSize: 14, fontWeight: 600, marginTop: 2 }}>{focal.material}</div>
      <div style={{ fontSize: 12, opacity: 0.85, marginTop: 4 }}>
        Batch <strong>{focal.batch_id}</strong> · {focal.plant}
      </div>
      <div style={{ fontSize: 12, opacity: 0.85, marginTop: 2 }}>{fmtQty(focal.qty, focal.uom)}</div>
      {/* Handles in both directions so React Flow can connect upstream + downstream edges. */}
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Right} id="t-right" style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Left} id="s-left" style={{ opacity: 0 }} />
    </div>
  )
}

/**
 * Generic lineage node card (upstream or downstream).
 *
 * Background follows the classic convention: upstream is light blue,
 * downstream is light beige.  Left accent is the link-type colour.
 */
export function LineageNodeView({ data, selected }: NodeProps) {
  const { node, direction } = data as LineageNodeData
  const bg = direction === 'upstream' ? '#E3EEF3' : '#F1F1E5'
  const accent = colourForLink(node.link)
  return (
    <div
      style={{
        width: 240,
        minHeight: 96,
        background: bg,
        color: 'var(--ink-1, #16202a)',
        borderRadius: 6,
        padding: '10px 12px',
        boxShadow: selected
          ? '0 0 0 2px #F24A00, 0 4px 10px rgba(0,0,0,0.10)'
          : '0 2px 6px rgba(0,0,0,0.08)',
        position: 'relative',
        fontFamily: 'var(--font-sans, system-ui)',
        borderLeft: `4px solid ${accent}`,
      }}
    >
      <div style={{ fontSize: 11, opacity: 0.55, letterSpacing: '0.04em' }}>
        {direction === 'upstream' ? 'UPSTREAM' : 'DOWNSTREAM'} · L{node.level} · {node.link}
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 2 }}>{node.material}</div>
      <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4 }}>
        Batch <strong>{node.batch}</strong> · {node.plant}
      </div>
      <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>{fmtQty(node.qty, node.uom)}</div>
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  )
}
