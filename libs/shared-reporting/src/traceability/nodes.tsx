/**
 * Custom React Flow node renderers for the advanced lineage view.
 *
 * Styling matches the classic SVG component
 * (`apps/trace2/frontend/src/components/LineageGraph.tsx`) so the two
 * views are visually consistent: yellow accent on the focal node, plant
 * + qty subtext, link-type colour on the left edge for lineage nodes.
 *
 * A `LineageThemeContext` lets the host component flip the whole palette
 * to high-contrast for plant-floor tablets in bright environments.  We
 * use a context (rather than threading a `theme` prop through React Flow)
 * because React Flow passes only its own typed `NodeProps` to custom
 * renderers and won't forward arbitrary props.
 */
import { createContext, useContext } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'

import type { FocalNodeData, GroupNodeData, LineageNodeData } from './graphTransformers'
import type { AdvancedLinkType } from './types'

/** Logical theme name.  Renderers read this via context. */
export type LineageTheme = 'default' | 'high-contrast'

/** Resolved palette derived from a {@link LineageTheme}. */
export interface LineagePalette {
  /** Focal-node background. */
  focalBg: string
  /** Focal-node text. */
  focalFg: string
  /** Focal-node yellow accent bar. */
  focalAccent: string
  /** Upstream lineage node background. */
  upstreamBg: string
  /** Downstream lineage node background. */
  downstreamBg: string
  /** Lineage node text. */
  lineageFg: string
  /** Selection outline (for both focal and lineage). */
  selectionOutline: string
  /** Group-node dashed border. */
  groupBorder: string
  /** Group-node text. */
  groupFg: string
  /** Group-node background fill (rgba ok). */
  groupBg: string
  /** Link-type stroke palette.  Falls back to ink-3 for unknown links. */
  linkColors: Record<string, string>
}

/**
 * Default palette — matches the classic SVG `LineageGraph` colours.
 *
 * **Style policy note (CodeRabbit / Gemini review):** the link-type
 * colours (`#289BA2` etc.) and focal accent (`#DFFF11`) are *domain*
 * colours, not part of the Kerry design-system tokens.  They originate
 * in the classic SVG component and must stay in sync with it pixel for
 * pixel — otherwise side-by-side comparisons across views become
 * misleading.  Promoting them to CSS variables would require every
 * consumer app to declare matching tokens, and the consumer apps
 * themselves don't otherwise reference these colours.  The right place
 * for them is this palette object, which **is** the design-token system
 * for the lineage domain; high-contrast theming flips through it via
 * `paletteFor()`.  Generic UI surfaces (menu backgrounds, borders) do
 * use Kerry CSS variables — only the lineage-specific colours are
 * hardcoded.
 */
const DEFAULT_PALETTE: LineagePalette = {
  focalBg: '#003C52',
  focalFg: '#F2F6F8',
  focalAccent: '#DFFF11',
  upstreamBg: '#E3EEF3',
  downstreamBg: '#F1F1E5',
  lineageFg: 'var(--ink-1, #16202a)',
  selectionOutline: '#F24A00',
  groupBorder: 'var(--ink-3, #94a3b8)',
  groupFg: 'var(--ink-3, #6b7280)',
  groupBg: 'rgba(248, 250, 252, 0.85)',
  linkColors: {
    RECEIPT: '#289BA2',
    CONSUMPTION: '#F9C20A',
    INTERNAL: '#8A9E6A',
    SALES_ORDER: '#005776',
  },
}

/**
 * High-contrast palette tuned for bright plant-floor tablet screens.
 *
 * Background slabs are near-black; foreground is white; link colours
 * shift toward primaries with WCAG-AAA contrast against the dark
 * background.  Focal yellow accent is retained as the brand "you are
 * here" cue but pushed brighter.
 */
const HIGH_CONTRAST_PALETTE: LineagePalette = {
  focalBg: '#000000',
  focalFg: '#FFFFFF',
  focalAccent: '#FFFF00',
  upstreamBg: '#1f2937',
  downstreamBg: '#374151',
  lineageFg: '#FFFFFF',
  selectionOutline: '#FF8000',
  groupBorder: '#FFFFFF',
  groupFg: '#FFFFFF',
  groupBg: 'rgba(15, 23, 42, 0.7)',
  linkColors: {
    RECEIPT: '#00E5FF',
    CONSUMPTION: '#FFEE00',
    INTERNAL: '#7CFF6B',
    SALES_ORDER: '#FF66CC',
  },
}

/** Resolve a theme name to a palette.  Exported for tests + Sankey/Table reuse. */
export function paletteFor(theme: LineageTheme): LineagePalette {
  return theme === 'high-contrast' ? HIGH_CONTRAST_PALETTE : DEFAULT_PALETTE
}

/**
 * Theme context consumed by node renderers.  Defaults to the standard
 * palette so renderers stay safe when used outside a provider (e.g.
 * unit tests that mount one node in isolation).
 */
export const LineageThemeContext = createContext<LineagePalette>(DEFAULT_PALETTE)

/** Helper used by the custom edge renderer; exported for reuse. */
export function colourForLink(
  link: AdvancedLinkType,
  palette: LineagePalette = DEFAULT_PALETTE,
): string {
  return palette.linkColors[link] ?? 'var(--ink-3, #6b7280)'
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
 * Focal-node card renderer for React Flow.
 *
 * Dark teal background mirrors the classic component's focal styling.
 * Yellow left accent is the brand "you are here" cue.  Colours are
 * sourced from the `LineageThemeContext` palette so high-contrast mode
 * flips the whole card without re-rendering.
 *
 * @param props React Flow `NodeProps` whose `data` is a {@link FocalNodeData}.
 * @returns The focal card JSX.
 */
export function FocalNodeView({ data, selected }: NodeProps) {
  const focal = (data as FocalNodeData).focal
  const palette = useContext(LineageThemeContext)
  return (
    <div
      style={{
        width: 280,
        minHeight: 112,
        background: palette.focalBg,
        color: palette.focalFg,
        borderRadius: 6,
        padding: '12px 14px',
        boxShadow: selected
          ? `0 0 0 2px ${palette.selectionOutline}, 0 6px 14px rgba(0,0,0,0.16)`
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
          background: palette.focalAccent,
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
 * Generic lineage node card (upstream or downstream) renderer for React Flow.
 *
 * Background follows the classic convention: upstream is light blue,
 * downstream is light beige.  Left accent is the link-type colour from
 * the active palette.  Colours flip cleanly under high-contrast mode.
 *
 * @param props React Flow `NodeProps` whose `data` is a {@link LineageNodeData}.
 * @returns The lineage card JSX.
 */
export function LineageNodeView({ data, selected }: NodeProps) {
  const { node, direction } = data as LineageNodeData
  const palette = useContext(LineageThemeContext)
  const bg = direction === 'upstream' ? palette.upstreamBg : palette.downstreamBg
  const accent = colourForLink(node.link, palette)
  return (
    <div
      style={{
        width: 240,
        minHeight: 96,
        background: bg,
        color: palette.lineageFg,
        borderRadius: 6,
        padding: '10px 12px',
        boxShadow: selected
          ? `0 0 0 2px ${palette.selectionOutline}, 0 4px 10px rgba(0,0,0,0.10)`
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

/**
 * Compound (group) node card renderer — shown when group-by is active.
 *
 * Rendered as a dashed-border container that visually wraps its children.
 * React Flow positions children inside via the `parentNode`+`extent: 'parent'`
 * relationship; we just give the container a header strip with the
 * group label, child count, and roll-up qty.  Children render at their own
 * z-index above this card.
 *
 * @param props React Flow `NodeProps` whose `data` is a {@link GroupNodeData}.
 * @returns The group container JSX.
 */
export function GroupNodeView({ data, selected }: NodeProps) {
  const { label, childCount, totalQty } = data as GroupNodeData
  const palette = useContext(LineageThemeContext)
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: palette.groupBg,
        border: `1px dashed ${selected ? palette.selectionOutline : palette.groupBorder}`,
        borderRadius: 8,
        padding: 8,
        boxSizing: 'border-box',
        fontFamily: 'var(--font-sans, system-ui)',
      }}
    >
      <div
        style={{
          fontSize: 10.5,
          letterSpacing: '0.05em',
          color: palette.groupFg,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 11, color: palette.groupFg, marginTop: 2 }}>
        {childCount} batch{childCount === 1 ? '' : 'es'}
        {totalQty != null ? ` · Σ ${totalQty.toLocaleString()}` : ''}
      </div>
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  )
}
