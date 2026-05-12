/**
 * Tabular view of lineage rows + CSV export.
 *
 * Complements the graph + Sankey views.  When an investigator needs to
 * audit the raw numbers (e.g. for a recall report), a sortable table is
 * the right tool — graphs are exploratory; tables are evidentiary.
 *
 * The component is deliberately self-contained — no external table lib
 * dependency, no virtualisation.  Lineage payloads are typically <500
 * rows so a plain HTML table is fine.  If we later need 5k+ row support
 * we can swap the body to react-window without changing the surface.
 *
 * Honours the same filter inputs as the graph + Sankey so all three
 * views show the same dataset for a given URL state.
 */
import { useMemo, useState } from 'react'

import { downloadBlob } from './exportHelpers'
import { buildLineageGraph, type GroupByMode } from './graphTransformers'
import {
  FOCAL_NODE_ID,
  type AdvancedLineageData,
  type AdvancedLineageNode,
  type AdvancedLinkType,
  type LineageDirection,
} from './types'

export interface LineageTableViewProps {
  data: AdvancedLineageData
  direction?: LineageDirection
  maxUpstreamLevel?: number
  maxDownstreamLevel?: number
  enabledLinks?: ReadonlySet<AdvancedLinkType>
  /** When set, group rows are emitted alongside leaf rows (with childCount). */
  groupBy?: GroupByMode
  /** Fixed height (scrolls if rows exceed it).  Default 600. */
  height?: number | string
  /** Optional click handler — receives the lineage node id. */
  onRowClick?: (id: string) => void
  /** Visual theme.  ``'high-contrast'`` flips to dark-on-light for plant tablets. */
  theme?: 'default' | 'high-contrast'
}

type ColumnKey =
  | 'level'
  | 'side'
  | 'material'
  | 'batch'
  | 'plant'
  | 'link'
  | 'flow_qty'
  | 'qty'
  | 'uom'

type SortDir = 'asc' | 'desc'

interface ColumnDef {
  key: ColumnKey
  label: string
  align: 'left' | 'right'
  width?: number
}

const COLUMNS: ColumnDef[] = [
  { key: 'level', label: 'Level', align: 'right', width: 64 },
  { key: 'side', label: 'Side', align: 'left', width: 96 },
  { key: 'material', label: 'Material', align: 'left' },
  { key: 'batch', label: 'Batch', align: 'left' },
  { key: 'plant', label: 'Plant', align: 'left', width: 100 },
  { key: 'link', label: 'Link', align: 'left', width: 120 },
  { key: 'flow_qty', label: 'Flow qty', align: 'right', width: 110 },
  { key: 'qty', label: 'Node qty', align: 'right', width: 110 },
  { key: 'uom', label: 'UOM', align: 'left', width: 64 },
]

/**
 * Render lineage rows as a sortable HTML table with a CSV export action.
 *
 * @param props See {@link LineageTableViewProps}.
 * @returns A `<div>` with a header (export button), the table, and a
 *   placeholder when no rows remain after filtering.
 */
export function LineageTableView({
  data,
  direction = 'both',
  maxUpstreamLevel,
  maxDownstreamLevel,
  enabledLinks,
  groupBy = 'none',
  height = 600,
  onRowClick,
  theme = 'default',
}: LineageTableViewProps) {
  const isHC = theme === 'high-contrast'
  const bg = isHC ? '#0f172a' : 'var(--bg-surface, #ffffff)'
  const bg2 = isHC ? '#1e293b' : 'var(--bg-surface-2, #f1f5f9)'
  const fg = isHC ? '#f8fafc' : 'var(--ink-1, #16202a)'
  const fg2 = isHC ? '#cbd5e1' : 'var(--ink-2, #4b5563)'
  const line = isHC ? '#334155' : 'var(--line, #e3e7ec)'
  const accent = isHC ? '#FFFF00' : 'var(--brand, #003C52)'
  const focalRowBg = isHC ? 'rgba(255, 255, 0, 0.08)' : 'rgba(0, 60, 82, 0.05)'
  const [sortKey, setSortKey] = useState<ColumnKey>('level')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  // We reuse buildLineageGraph so depth / link / group filters are
  // applied consistently with the other two views.  We then re-flatten
  // into a row shape suitable for tabular display.
  const rows = useMemo(() => {
    const { nodes } = buildLineageGraph(data, {
      direction,
      maxUpstreamLevel,
      maxDownstreamLevel,
      enabledLinks,
      // The table view always renders flat (one row per node) regardless of
      // groupBy — grouping is for visual collapse, not for hiding rows
      // from an evidentiary listing.
      groupBy: 'none',
    })
    // Group-by mode still drives the row "Side" column tagging — derive
    // group memberships in a separate pass.
    let groupKeyFor: (n: AdvancedLineageNode) => string | null = () => null
    if (groupBy === 'plant') {
      groupKeyFor = (n) => n.plant || null
    } else if (groupBy === 'material') {
      groupKeyFor = (n) => n.material_id || null
    }
    const out: Array<{
      id: string
      level: number
      side: 'upstream' | 'downstream' | 'focal'
      material: string
      batch: string
      plant: string
      link: string
      flow_qty: number | null
      qty: number
      uom: string
      group: string | null
    }> = []
    for (const n of nodes) {
      if (n.id === FOCAL_NODE_ID) {
        out.push({
          id: data.focal.id,
          level: 0,
          side: 'focal',
          material: data.focal.material,
          batch: data.focal.batch_id,
          plant: data.focal.plant,
          link: '—',
          flow_qty: null,
          qty: data.focal.qty,
          uom: data.focal.uom,
          group: null,
        })
        continue
      }
      if (n.type !== 'lineageBatch') continue // skip group containers
      const inner = (n.data as { node: AdvancedLineageNode; direction: 'upstream' | 'downstream' })
      out.push({
        id: inner.node.id,
        level: inner.node.level,
        side: inner.direction,
        material: inner.node.material,
        batch: inner.node.batch,
        plant: inner.node.plant,
        link: inner.node.link,
        flow_qty: inner.node.flow_qty != null && Number.isFinite(inner.node.flow_qty)
          ? inner.node.flow_qty
          : null,
        qty: inner.node.qty,
        uom: inner.node.uom,
        group: groupKeyFor(inner.node),
      })
    }
    return out
  }, [data, direction, maxUpstreamLevel, maxDownstreamLevel, enabledLinks, groupBy])

  const sortedRows = useMemo(() => {
    const copy = [...rows]
    copy.sort((a, b) => {
      const va = a[sortKey]
      const vb = b[sortKey]
      // Handle null / undefined consistently — push to the end regardless
      // of direction; sort orientation only affects ordering of defined values.
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      if (typeof va === 'number' && typeof vb === 'number') {
        return sortDir === 'asc' ? va - vb : vb - va
      }
      const sa = String(va)
      const sb = String(vb)
      return sortDir === 'asc' ? sa.localeCompare(sb) : sb.localeCompare(sa)
    })
    return copy
  }, [rows, sortKey, sortDir])

  const handleSort = (key: ColumnKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const handleExport = () => {
    const header = COLUMNS.map((c) => c.label).join(',')
    const body = sortedRows
      .map((r) =>
        COLUMNS.map((c) => {
          const v = (r as Record<string, unknown>)[c.key]
          if (v == null) return ''
          const s = String(v)
          // Quote anything containing comma / quote / newline.
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
        }).join(','),
      )
      .join('\n')
    const csv = `${header}\n${body}\n`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    // Use the centralised helper for delayed URL.revokeObjectURL —
    // some browsers (Firefox / Safari) abort the download if the URL
    // is revoked synchronously after the anchor click fires.
    downloadBlob(blob, `lineage-${data.focal.material_id}-${data.focal.batch_id}.csv`)
  }

  return (
    <div
      style={{ height, display: 'flex', flexDirection: 'column', background: bg }}
      data-testid="lineage-table-view"
      data-theme={theme}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          padding: '6px 10px',
          background: bg2,
          borderBottom: `1px solid ${line}`,
        }}
      >
        <button
          type="button"
          onClick={handleExport}
          disabled={sortedRows.length === 0}
          style={{
            padding: '4px 12px',
            fontFamily: 'var(--font-sans, system-ui)',
            fontSize: 12,
            background: accent,
            color: isHC ? '#000000' : '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: sortedRows.length === 0 ? 'not-allowed' : 'pointer',
            opacity: sortedRows.length === 0 ? 0.5 : 1,
          }}
          data-testid="lineage-table-export"
        >
          Export CSV
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {sortedRows.length === 0 ? (
          <div
            style={{
              padding: 24,
              textAlign: 'center',
              color: fg2,
              fontFamily: 'var(--font-sans, system-ui)',
              fontSize: 13,
            }}
          >
            No rows after filtering.
          </div>
        ) : (
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontFamily: 'var(--font-sans, system-ui)',
              fontSize: 12.5,
            }}
          >
            <thead>
              <tr>
                {COLUMNS.map((c) => {
                  const isSorted = c.key === sortKey
                  return (
                    <th
                      key={c.key}
                      onClick={() => handleSort(c.key)}
                      style={{
                        textAlign: c.align,
                        padding: '8px 10px',
                        background: bg,
                        borderBottom: `1px solid ${line}`,
                        cursor: 'pointer',
                        userSelect: 'none',
                        position: 'sticky',
                        top: 0,
                        width: c.width,
                        color: isSorted ? accent : fg2,
                        fontWeight: 600,
                      }}
                      aria-sort={
                        isSorted
                          ? sortDir === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : 'none'
                      }
                    >
                      {c.label}
                      {isSorted ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r) => (
                <tr
                  key={`${r.id}-${r.level}-${r.side}`}
                  onClick={() => onRowClick?.(r.id)}
                  style={{
                    cursor: onRowClick ? 'pointer' : 'default',
                    background: r.side === 'focal' ? focalRowBg : 'transparent',
                  }}
                >
                  {COLUMNS.map((c) => {
                    const raw = (r as Record<string, unknown>)[c.key]
                    let display: string = ''
                    if (raw == null) {
                      display = '—'
                    } else if (typeof raw === 'number') {
                      display = raw.toLocaleString()
                    } else {
                      display = String(raw)
                    }
                    return (
                      <td
                        key={c.key}
                        style={{
                          textAlign: c.align,
                          padding: '6px 10px',
                          borderBottom: `1px solid ${line}`,
                          color: fg,
                          whiteSpace: 'nowrap',
                          maxWidth: 240,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {display}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
