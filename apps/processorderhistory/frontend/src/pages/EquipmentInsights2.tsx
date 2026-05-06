/**
 * Equipment Insights 2 — production equipment estate, cleaning, calibration, and anomaly tabs.
 *
 * This is the v2 replacement for EquipmentInsights.tsx.  It implements the full four-tab
 * design from the PlantView handoff (Overview, Cleaning, Calibration, Anomaly) plus an
 * Equipment Detail drilldown.
 *
 * All data sections render graceful empty states until the gold views listed in
 * equipment_insights2_dal.py are promoted to Unity Catalogue.
 *
 * Internal view routing (list → detail) is self-contained so App.tsx does not need
 * to know about individual equipment items.
 */
import { useEffect, useMemo, useState } from 'react'
import { TopBar, Icon, KPI } from '@connectio/shared-ui'
import { useT } from '../i18n/context'
import {
  fetchEquipmentInsights2,
  type EquipmentInsights2Summary,
  type EquipmentItem,
  type EquipmentStateAgg,
  type EquipmentTypeAgg,
} from '../api/equipment_insights2'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EqTab = 'overview' | 'cleaning' | 'calibration' | 'anomaly'
type SortKey = 'ttc_min' | 'utilisation_pct' | 'ftr_pct' | 'mtbc_h'
type SortDir = 'asc' | 'desc'

/** Internal page view — either the tabbed list or a single equipment drilldown. */
type PageView = { kind: 'list'; tab: EqTab } | { kind: 'detail'; item: EquipmentItem }

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATE_LABELS: Record<string, string> = {
  in_use:    'In use',
  dirty:     'Dirty / needs clean',
  available: 'Available / clean',
  unknown:   'Unknown',
}

const STATE_COLORS: Record<string, string> = {
  in_use:    'var(--status-ok)',
  dirty:     'var(--status-warn)',
  available: 'var(--brand)',
  unknown:   'var(--line-1)',
}

const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Formats a duration in minutes as "Xh Ym" (e.g. 90 → "1h 30m"). */
function fmtHm(minutes: number): string {
  if (!minutes || minutes < 1) return '0m'
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

/** Formats an epoch-ms timestamp as a relative time string (e.g. "2h ago", "3d ago"). */
function fmtRel(ms: number): string {
  const diff = Date.now() - ms
  const mins = Math.round(diff / 60000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.round(diff / 3600000)
  if (hrs < 24) return `${hrs}h`
  const days = Math.round(diff / 86400000)
  return `${days}d`
}

/** Formats a calibration due-days value as a display string. */
function fmtCalDue(days: number | null): string {
  if (days == null) return '—'
  if (days < 0) return `${Math.abs(days)}d overdue`
  if (days === 0) return 'Today'
  return `in ${days}d`
}

/** Returns the colour for a calibration due-days value. */
function calDueColor(days: number | null): string {
  if (days == null) return 'inherit'
  if (days < 0) return 'var(--status-risk)'
  if (days <= 14) return 'var(--status-warn)'
  return 'inherit'
}

/** Returns the colour for an FTR percentage. */
function ftrColor(pct: number): string {
  if (pct >= 95) return 'var(--status-ok)'
  if (pct >= 90) return 'var(--status-warn)'
  return 'var(--status-risk)'
}

// ---------------------------------------------------------------------------
// StateBar — proportional horizontal bar showing state distribution
// ---------------------------------------------------------------------------

/** Horizontal bar chart showing proportions of equipment in each state. */
function StateBar({ agg }: { agg: EquipmentStateAgg[] }) {
  const total = agg.reduce((s, x) => s + x.count, 0)

  if (agg.length === 0 || total === 0) {
    return (
      <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
        No state data available.
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden', marginBottom: 6, boxShadow: 'inset 0 0 0 1px var(--line-1)' }}>
        {agg.map(s => (
          <div key={s.state} style={{ flex: s.count, background: STATE_COLORS[s.state] ?? 'var(--line-1)' }}
            title={`${STATE_LABELS[s.state] ?? s.state}: ${s.count}`} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)', marginBottom: 14 }}>
        <span>0</span><span>{total} total</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {agg.map(s => (
          <div key={s.state} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px dashed var(--line-1)', fontSize: 12 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATE_COLORS[s.state] ?? 'var(--line-1)', flexShrink: 0 }} />
              <span style={{ textTransform: 'capitalize' }}>{STATE_LABELS[s.state] ?? s.state}</span>
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 'var(--fw-bold)' }}>{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// HeatmapChart — 7 days × 24 hours activity grid
// ---------------------------------------------------------------------------

/** 7d×24h equipment activity heatmap. Each cell = % of equipment in use that hour. */
function HeatmapChart({ data }: { data: number[][] }) {
  const empty = data.length === 0
  const rows = empty
    ? Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0))
    : data

  return (
    <div>
      {empty && (
        <div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 12, marginBottom: 12 }}>
          Activity data unavailable — gold view pending.
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr', gap: 6 }}>
        <div />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(24, 1fr)', gap: 2, fontSize: 9, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
          {Array.from({ length: 24 }, (_, i) => (
            <div key={i} style={{ textAlign: 'center', visibility: i % 3 === 0 ? 'visible' : 'hidden' }}>
              {String(i).padStart(2, '0')}
            </div>
          ))}
        </div>
        {rows.map((row, di) => (
          <div key={di} style={{ display: 'contents' }}>
            <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', alignSelf: 'center' }}>
              {WEEK_DAYS[di]}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(24, 1fr)', gap: 2 }}>
              {row.map((v, hi) => (
                <div key={hi}
                  title={`${WEEK_DAYS[di]} ${String(hi).padStart(2, '0')}:00 — ${v}%`}
                  style={{
                    height: 18,
                    background: v > 0
                      ? `color-mix(in oklab, var(--brand) ${v}%, var(--surface-sunken))`
                      : 'var(--surface-sunken)',
                    borderRadius: 2,
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 11, color: 'var(--text-3)' }}>
        <span>0%</span>
        <div style={{ display: 'flex', gap: 2 }}>
          {[15, 30, 50, 70, 90].map(v => (
            <div key={v} style={{ width: 18, height: 10, background: `color-mix(in oklab, var(--brand) ${v}%, var(--surface-sunken))`, borderRadius: 2 }} />
          ))}
        </div>
        <span>100%</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// TypeBreakdownTable — per equipment type aggregation
// ---------------------------------------------------------------------------

/** Equipment count, avg TTC, utilisation, and dirty count broken down by type. */
function TypeBreakdownTable({ rows }: { rows: EquipmentTypeAgg[] }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Icon name="layers" size={16} />
        <h2 style={{ fontSize: 'var(--fs-16)', fontWeight: 'var(--fw-bold)', margin: 0 }}>By equipment type</h2>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{rows.length} types · sorted by avg time to clean</span>
      </div>
      <div style={{ background: 'var(--surface-1)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: 'var(--surface-sunken)', borderBottom: '1px solid var(--line-1)' }}>
            <tr>
              <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase' }}>Type</th>
              <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase' }}>Count</th>
              <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase' }}>Avg TTC</th>
              <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase' }}>Utilisation</th>
              <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase' }}>Dirty now</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(t => (
              <tr key={t.type} style={{ borderBottom: '1px solid var(--line-1)' }}>
                <td style={{ padding: '10px 16px', fontWeight: 'var(--fw-semibold)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 24, height: 24, borderRadius: 5, background: 'var(--surface-sunken)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Icon name="cpu" size={12} />
                    </span>
                    {t.type}
                  </div>
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{t.count}</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{fmtHm(t.avg_ttc_min)}</td>
                <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{t.avg_util_pct}%</span>
                    <div style={{ width: 70, height: 4, background: 'var(--surface-sunken)', borderRadius: 2, overflow: 'hidden', flexShrink: 0 }}>
                      <div style={{ height: '100%', width: `${t.avg_util_pct}%`, background: 'var(--brand)' }} />
                    </div>
                  </div>
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                  {t.dirty > 0 ? <span style={{ color: 'var(--status-warn)', fontWeight: 'var(--fw-semibold)' }}>{t.dirty}</span> : <span style={{ color: 'var(--text-3)' }}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
            No equipment type data available.
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// EquipmentRegister — filterable, sortable equipment table
// ---------------------------------------------------------------------------

/** Full equipment register with state/type filter, search, and sort. */
function EquipmentRegister({
  equipment,
  onOpen,
}: {
  equipment: EquipmentItem[]
  onOpen: (item: EquipmentItem) => void
}) {
  const [stateFilter, setStateFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'ttc_min', dir: 'desc' })
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 12

  const types = useMemo(() => Array.from(new Set(equipment.map(e => e.type))).sort(), [equipment])

  const filtered = useMemo(() => {
    let rows = equipment
    if (stateFilter !== 'all') rows = rows.filter(e => e.state === stateFilter)
    if (typeFilter !== 'all') rows = rows.filter(e => e.type === typeFilter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      rows = rows.filter(e => e.name.toLowerCase().includes(q) || e.id.toLowerCase().includes(q))
    }
    const sign = sort.dir === 'desc' ? -1 : 1
    return [...rows].sort((a, b) => sign * ((a[sort.key] ?? 0) - (b[sort.key] ?? 0)))
  }, [equipment, stateFilter, typeFilter, search, sort])

  const stateCount = (s: string) => equipment.filter(e => e.state === s).length
  const pageSlice = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  const sortBtn = (key: SortKey, label: string) => (
    <button
      onClick={() => setSort(prev => ({ key, dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc' }))}
      style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'var(--fw-bold)', fontSize: 11, textTransform: 'uppercase', color: sort.key === key ? 'var(--brand)' : 'inherit', display: 'flex', alignItems: 'center', gap: 4 }}
    >
      {label}
      {sort.key === key && <Icon name={sort.dir === 'desc' ? 'chevron-down' : 'chevron-up'} size={10} />}
    </button>
  )

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="layers" size={16} />
          <h2 style={{ fontSize: 'var(--fs-16)', fontWeight: 'var(--fw-bold)', margin: 0 }}>Equipment register</h2>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 2, background: 'var(--surface-sunken)', borderRadius: 'var(--r-sm)', padding: 2 }}>
          {(['all', 'in_use', 'dirty', 'available'] as const).map(s => (
            <button key={s} onClick={() => { setStateFilter(s); setPage(0) }}
              className={`btn btn-sm ${stateFilter === s ? 'btn-primary' : 'btn-ghost'}`}
              style={{ fontSize: 11 }}>
              {s === 'all' ? 'All' : STATE_LABELS[s]}
              <span style={{ opacity: 0.6, marginLeft: 4, fontFamily: 'var(--font-mono)' }}>
                {s === 'all' ? equipment.length : stateCount(s)}
              </span>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--surface-sunken)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-sm)', padding: '4px 10px' }}>
          <Icon name="search" size={12} style={{ color: 'var(--text-3)' }} />
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(0) }}
            placeholder="Equipment ID…"
            style={{ border: 'none', background: 'transparent', fontSize: 12, width: 140, color: 'var(--text-1)' }} />
        </div>
        <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(0) }}
          style={{ height: 30, borderRadius: 'var(--r-sm)', border: '1px solid var(--line-1)', background: 'var(--surface-sunken)', fontSize: 12, padding: '0 8px', color: 'var(--text-1)' }}>
          <option value="all">All types</option>
          {types.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div style={{ background: 'var(--surface-1)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: 'var(--surface-sunken)', borderBottom: '1px solid var(--line-1)' }}>
            <tr>
              <th style={{ padding: '10px 16px', textAlign: 'left' }}>Equipment</th>
              <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase' }}>Type</th>
              <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase' }}>Line</th>
              <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase' }}>State</th>
              <th style={{ padding: '10px 16px', textAlign: 'right' }}>{sortBtn('ttc_min', 'TTC')}</th>
              <th style={{ padding: '10px 16px', textAlign: 'right' }}>{sortBtn('utilisation_pct', 'Util.')}</th>
              <th style={{ padding: '10px 16px', textAlign: 'right' }}>{sortBtn('ftr_pct', 'FTR')}</th>
              <th style={{ padding: '10px 16px', textAlign: 'right' }}>{sortBtn('mtbc_h', 'MTBC')}</th>
              <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase' }}>Last clean</th>
              <th style={{ width: 32, padding: '10px 8px' }} />
            </tr>
          </thead>
          <tbody>
            {pageSlice.map(e => (
              <tr key={e.id} onClick={() => onOpen(e)} style={{ borderBottom: '1px solid var(--line-1)', cursor: 'pointer' }}>
                <td style={{ padding: '10px 16px' }}>
                  <div style={{ fontWeight: 'var(--fw-semibold)', fontSize: 13 }}>{e.name}</div>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>{e.id}</div>
                </td>
                <td style={{ padding: '10px 16px', fontSize: 13 }}>{e.type}</td>
                <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{e.line}</td>
                <td style={{ padding: '10px 16px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 'var(--fw-semibold)', color: STATE_COLORS[e.state] }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: STATE_COLORS[e.state], flexShrink: 0 }} />
                    {STATE_LABELS[e.state] ?? e.state}
                  </span>
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{fmtHm(e.ttc_min)}</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{e.utilisation_pct}%</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, color: ftrColor(e.ftr_pct), fontWeight: 'var(--fw-semibold)' }}>{e.ftr_pct}%</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{e.mtbc_h}h</td>
                <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-3)' }}>{fmtRel(e.last_clean_ms)} ago</td>
                <td style={{ padding: '10px 8px', textAlign: 'right', color: 'var(--text-3)' }}>
                  <Icon name="chevron-right" size={14} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
            No equipment data available.
          </div>
        )}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: '1px solid var(--line-1)', fontSize: 12, color: 'var(--text-3)' }}>
            <span>Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button className="btn btn-sm btn-ghost" onClick={() => setPage(p => p - 1)} disabled={page === 0}>
                <Icon name="chevron-left" size={12} />
              </button>
              <button className="btn btn-sm btn-ghost" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages - 1}>
                <Icon name="chevron-right" size={12} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CleaningBacklogCard — dirty equipment sorted by age
// ---------------------------------------------------------------------------

/** Cleaning backlog showing the oldest dirty equipment first with estimated TTC. */
function CleaningBacklogCard({
  rows,
  onOpen,
}: {
  rows: EquipmentItem[]
  onOpen: (item: EquipmentItem) => void
}) {
  return (
    <div style={{ background: 'var(--surface-1)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--line-1)', background: 'var(--surface-sunken)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 'var(--fw-semibold)', fontSize: 13 }}>
          <Icon name="sparkles" size={14} /> Cleaning backlog
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{rows.length} dirty · oldest first</span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead style={{ background: 'var(--surface-sunken)', borderBottom: '1px solid var(--line-1)' }}>
          <tr>
            <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase' }}>Equipment</th>
            <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase' }}>Line</th>
            <th style={{ padding: '8px 16px', textAlign: 'right', fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase' }}>Age</th>
            <th style={{ padding: '8px 16px', textAlign: 'right', fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase' }}>Est. TTC</th>
            <th style={{ padding: '8px 16px' }} />
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 8).map(e => {
            const overdue = (e.dirty_age_min ?? 0) > 240
            return (
              <tr key={e.id} onClick={() => onOpen(e)} style={{ borderBottom: '1px solid var(--line-1)', cursor: 'pointer' }}>
                <td style={{ padding: '10px 16px' }}>
                  <div style={{ fontWeight: 'var(--fw-semibold)', fontSize: 13 }}>{e.name}</div>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>{e.id} · {e.type}</div>
                </td>
                <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{e.line}</td>
                <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, color: overdue ? 'var(--status-risk)' : 'inherit', fontWeight: overdue ? 'var(--fw-bold)' : 'normal' }}>
                  {fmtHm(e.dirty_age_min ?? 0)}
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                  {fmtHm(e.ttc_min)}
                </td>
                <td style={{ padding: '10px 16px' }}>
                  <button className="btn btn-sm btn-ghost" onClick={ev => ev.stopPropagation()} style={{ fontSize: 11 }}>
                    Schedule CIP
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {rows.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
          No dirty equipment.
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// AnomaliesCard — statistical drift detections
// ---------------------------------------------------------------------------

/** Panel listing equipment with detected TTC or cycle-time drift anomalies. */
function AnomaliesCard({
  rows,
  onOpen,
}: {
  rows: EquipmentItem[]
  onOpen: (item: EquipmentItem) => void
}) {
  return (
    <div style={{ background: 'var(--surface-1)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--line-1)', background: 'var(--surface-sunken)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 'var(--fw-semibold)', fontSize: 13 }}>
          <Icon name="alert-triangle" size={14} /> Anomalies
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{rows.length} flagged</span>
      </div>
      {rows.map(a => (
        <div key={a.id} onClick={() => onOpen(a)} style={{ padding: '12px 16px', borderBottom: '1px solid var(--line-1)', cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
            <span style={{ fontWeight: 'var(--fw-semibold)', fontSize: 13 }}>{a.name}</span>
            <span style={{ fontSize: 10, fontWeight: 'var(--fw-extrabold)', padding: '2px 7px', borderRadius: 'var(--r-sm)', background: 'var(--status-warn-bg)', color: 'var(--status-warn)', textTransform: 'uppercase' }}>drift</span>
          </div>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
            {a.id} · time-to-clean drift detected
          </div>
        </div>
      ))}
      {rows.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
          No anomalies detected.
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab content — Overview
// ---------------------------------------------------------------------------

/** Overview tab: KPI strip + state/heatmap + type table + cleaning backlog + anomalies + register. */
function OverviewContent({
  data,
  onOpen,
}: {
  data: EquipmentInsights2Summary
  onOpen: (item: EquipmentItem) => void
}) {
  const { kpis, ttc_trend, ftr_trend, state_agg, heatmap, type_agg, cleaning_backlog, anomalies, equipment } = data

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, padding: '24px 32px 0' }}>
        <KPI
          label="Avg time to clean"
          value={kpis.avg_ttc_min || '—'}
          unit={kpis.avg_ttc_min ? 'min' : undefined}
          tone={kpis.avg_ttc_min ? 'warn' : 'neutral'}
          icon="sparkles"
          sparkline={ttc_trend.length > 0 ? ttc_trend : undefined}
        />
        <KPI
          label="Right first time"
          value={kpis.avg_ftr_pct ? `${kpis.avg_ftr_pct.toFixed(1)}%` : '—'}
          tone={kpis.avg_ftr_pct >= 95 ? 'ok' : kpis.avg_ftr_pct > 0 ? 'warn' : 'neutral'}
          icon="check"
          sparkline={ftr_trend.length > 0 ? ftr_trend : undefined}
        />
        <KPI
          label="Utilisation"
          value={kpis.avg_utilisation_pct ? `${kpis.avg_utilisation_pct.toFixed(0)}%` : '—'}
          tone="neutral"
          icon="zap"
          subtext="rolling 7d"
        />
        <KPI
          label="Dirty backlog"
          value={kpis.dirty_count}
          tone={kpis.dirty_over_4h > 0 ? 'warn' : 'neutral'}
          icon="alert-triangle"
          subtext={`${kpis.dirty_over_4h} over 4h`}
        />
        <KPI
          label="Cal. overdue"
          value={kpis.cal_overdue}
          tone={kpis.cal_overdue > 0 ? 'risk' : 'neutral'}
          icon="alert-circle"
          subtext={`${kpis.cal_due_soon} due ≤ 30d`}
        />
      </div>

      <div style={{ padding: '16px 32px', display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16 }}>
        <div style={{ background: 'var(--surface-1)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)', padding: 16 }}>
          <div style={{ fontWeight: 'var(--fw-semibold)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Icon name="zap" size={14} /> State distribution <span style={{ color: 'var(--text-3)', fontWeight: 'normal', fontSize: 12 }}>live</span>
          </div>
          <StateBar agg={state_agg} />
        </div>
        <div style={{ background: 'var(--surface-1)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)', padding: 16 }}>
          <div style={{ fontWeight: 'var(--fw-semibold)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Icon name="clock" size={14} /> Activity heatmap
            <span style={{ color: 'var(--text-3)', fontWeight: 'normal', fontSize: 12 }}>% equipment in use · last 7 days × 24h</span>
          </div>
          <HeatmapChart data={heatmap} />
        </div>
      </div>

      <div style={{ padding: '0 32px' }}>
        <TypeBreakdownTable rows={type_agg} />
      </div>

      <div style={{ padding: '16px 32px', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <CleaningBacklogCard rows={cleaning_backlog} onOpen={onOpen} />
        <AnomaliesCard rows={anomalies} onOpen={onOpen} />
      </div>

      <div style={{ padding: '0 32px 48px' }}>
        <EquipmentRegister equipment={equipment} onOpen={onOpen} />
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Tab content — Cleaning
// ---------------------------------------------------------------------------

/** Cleaning tab: KPI strip + full cleaning queue table. */
function CleaningContent({
  data,
  onOpen,
}: {
  data: EquipmentInsights2Summary
  onOpen: (item: EquipmentItem) => void
}) {
  const { kpis, cleaning_backlog } = data
  const allDirty = data.equipment.filter(e => e.state === 'dirty').sort((a, b) => (b.dirty_age_min ?? 0) - (a.dirty_age_min ?? 0))
  const rows = allDirty.length > 0 ? allDirty : cleaning_backlog

  return (
    <div style={{ padding: '24px 32px 48px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <KPI label="Dirty equipment" value={kpis.dirty_count} tone={kpis.dirty_count > 0 ? 'warn' : 'neutral'} icon="alert-triangle" subtext="awaiting CIP" />
        <KPI label="Total dirty time" value={kpis.total_dirty_time_min ? fmtHm(kpis.total_dirty_time_min) : '—'} tone={kpis.total_dirty_time_min > 0 ? 'warn' : 'neutral'} icon="clock" subtext="cumulative wait" />
        <KPI label="Avg time to clean" value={kpis.avg_ttc_min || '—'} unit={kpis.avg_ttc_min ? 'min' : undefined} tone="ok" icon="trending-up" />
        <KPI label="Overdue (>4h)" value={kpis.dirty_over_4h} tone={kpis.dirty_over_4h > 0 ? 'risk' : 'neutral'} icon="alert-circle" />
      </div>

      <div style={{ background: 'var(--surface-1)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--line-1)', background: 'var(--surface-sunken)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 'var(--fw-semibold)', fontSize: 13 }}>
            <Icon name="sparkles" size={14} /> Cleaning queue
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{rows.length} dirty · sorted by age</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: 'var(--surface-sunken)', borderBottom: '1px solid var(--line-1)' }}>
            <tr>
              <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase' }}>Equipment</th>
              <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase' }}>Type</th>
              <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase' }}>Line</th>
              <th style={{ padding: '8px 16px', textAlign: 'right', fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase' }}>Dirty since</th>
              <th style={{ padding: '8px 16px', textAlign: 'right', fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase' }}>Age</th>
              <th style={{ padding: '8px 16px', textAlign: 'right', fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase' }}>Est. TTC</th>
              <th style={{ padding: '8px 16px' }} />
            </tr>
          </thead>
          <tbody>
            {rows.map(e => {
              const overdue = (e.dirty_age_min ?? 0) > 240
              return (
                <tr key={e.id} onClick={() => onOpen(e)} style={{ borderBottom: '1px solid var(--line-1)', cursor: 'pointer' }}>
                  <td style={{ padding: '10px 16px' }}>
                    <div style={{ fontWeight: 'var(--fw-semibold)', fontSize: 13 }}>{e.name}</div>
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>{e.id}</div>
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: 13 }}>{e.type}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: 12 }}>{e.line}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-3)' }}>
                    {new Date(e.last_clean_ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, color: overdue ? 'var(--status-risk)' : 'inherit', fontWeight: overdue ? 'var(--fw-bold)' : 'normal' }}>
                    {fmtHm(e.dirty_age_min ?? 0)}
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                    {fmtHm(e.ttc_min)}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <button className="btn btn-sm btn-primary" onClick={ev => ev.stopPropagation()} style={{ fontSize: 11 }}>
                      Schedule
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
            No dirty equipment.
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab content — Calibration
// ---------------------------------------------------------------------------

/** Calibration tab: KPI strip + calibration register sorted by due date. */
function CalibrationContent({
  data,
  onOpen,
}: {
  data: EquipmentInsights2Summary
  onOpen: (item: EquipmentItem) => void
}) {
  const { kpis, cal_register } = data

  return (
    <div style={{ padding: '24px 32px 48px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <KPI label="Overdue" value={kpis.cal_overdue} tone={kpis.cal_overdue > 0 ? 'risk' : 'neutral'} icon="alert-circle" subtext="action required" />
        <KPI label="Due within 14d" value={kpis.cal_due_soon} tone={kpis.cal_due_soon > 0 ? 'warn' : 'neutral'} icon="clock" />
        <KPI
          label="In tolerance"
          value={Math.max(0, (cal_register.length || 0) - kpis.cal_overdue - kpis.cal_due_soon)}
          tone="ok"
          icon="check"
        />
        <KPI label="Avg drift" value="—" tone="neutral" icon="sliders" subtext="% of full scale" />
      </div>

      <div style={{ background: 'var(--surface-1)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--line-1)', background: 'var(--surface-sunken)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 'var(--fw-semibold)', fontSize: 13 }}>
            <Icon name="sliders" size={14} /> Calibration register
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{cal_register.length} instruments</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: 'var(--surface-sunken)', borderBottom: '1px solid var(--line-1)' }}>
            <tr>
              <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase' }}>Instrument</th>
              <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase' }}>Type</th>
              <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase' }}>Last calibrated</th>
              <th style={{ padding: '8px 16px', textAlign: 'right', fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase' }}>Next due</th>
              <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase' }}>Status</th>
              <th style={{ padding: '8px 16px' }} />
            </tr>
          </thead>
          <tbody>
            {cal_register.map(e => {
              const od = (e.cal_due_days ?? 0) < 0
              const soon = !od && (e.cal_due_days ?? 99) <= 14
              return (
                <tr key={e.id} onClick={() => onOpen(e)} style={{ borderBottom: '1px solid var(--line-1)', cursor: 'pointer' }}>
                  <td style={{ padding: '10px 16px' }}>
                    <div style={{ fontWeight: 'var(--fw-semibold)', fontSize: 13 }}>{e.name}</div>
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>{e.id}</div>
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: 13 }}>{e.type}</td>
                  <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-3)' }}>
                    {new Date(e.last_clean_ms).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12, color: calDueColor(e.cal_due_days), fontWeight: od ? 'var(--fw-bold)' : 'normal' }}>
                    {fmtCalDue(e.cal_due_days)}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{ fontSize: 10, fontWeight: 'var(--fw-extrabold)', padding: '2px 7px', borderRadius: 'var(--r-sm)', textTransform: 'uppercase', background: od ? 'var(--status-risk-bg)' : soon ? 'var(--status-warn-bg)' : 'var(--status-ok-bg)', color: od ? 'var(--status-risk)' : soon ? 'var(--status-warn)' : 'var(--status-ok)' }}>
                      {od ? 'Overdue' : soon ? 'Due soon' : 'OK'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <button className="btn btn-sm btn-ghost" onClick={ev => ev.stopPropagation()} style={{ fontSize: 11 }}>
                      Plan
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {cal_register.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
            No calibration data available.
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab content — Anomaly
// ---------------------------------------------------------------------------

/** Anomaly tab: KPI strip + detected drift table. */
function AnomalyContent({
  data,
  onOpen,
}: {
  data: EquipmentInsights2Summary
  onOpen: (item: EquipmentItem) => void
}) {
  const { kpis, anomalies } = data

  return (
    <div style={{ padding: '24px 32px 48px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <KPI label="Active anomalies" value={kpis.anomaly_count} tone={kpis.anomaly_count > 0 ? 'warn' : 'neutral'} icon="alert-triangle" />
        <KPI label="MTTR" value="—" tone="neutral" icon="clock" subtext="mean time to resolve" />
        <KPI label="False positive" value="—" tone="neutral" icon="check" />
        <KPI label="Detected this week" value="—" tone="neutral" icon="trending-up" />
      </div>

      <div style={{ background: 'var(--surface-1)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--line-1)', background: 'var(--surface-sunken)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 'var(--fw-semibold)', fontSize: 13 }}>
            <Icon name="alert-triangle" size={14} /> Detected drifts
          </div>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>cleaning duration · pour error · cycle time</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: 'var(--surface-sunken)', borderBottom: '1px solid var(--line-1)' }}>
            <tr>
              <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase' }}>Equipment</th>
              <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase' }}>Signal</th>
              <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase' }}>Detected</th>
              <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase' }}>Direction</th>
              <th style={{ padding: '8px 16px', textAlign: 'right', fontSize: 11, fontWeight: 'var(--fw-bold)', textTransform: 'uppercase' }}>Confidence</th>
              <th style={{ width: 32 }} />
            </tr>
          </thead>
          <tbody>
            {anomalies.map(a => (
              <tr key={a.id} onClick={() => onOpen(a)} style={{ borderBottom: '1px solid var(--line-1)', cursor: 'pointer' }}>
                <td style={{ padding: '10px 16px' }}>
                  <div style={{ fontWeight: 'var(--fw-semibold)', fontSize: 13 }}>{a.name}</div>
                  <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>{a.id}</div>
                </td>
                <td style={{ padding: '10px 16px', fontSize: 13 }}>Time-to-clean</td>
                <td style={{ padding: '10px 16px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-3)' }}>
                  {new Date(a.last_clean_ms).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                </td>
                <td style={{ padding: '10px 16px' }}>
                  <span style={{ fontSize: 12, color: 'var(--status-warn)', fontWeight: 'var(--fw-semibold)' }}>↑ increasing</span>
                </td>
                <td style={{ padding: '10px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12 }}>—</td>
                <td style={{ padding: '10px 8px', textAlign: 'right', color: 'var(--text-3)' }}>
                  <Icon name="chevron-right" size={14} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {anomalies.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
            No anomalies detected.
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Equipment Detail View — drilldown page for a single equipment item
// ---------------------------------------------------------------------------

/** Equipment Detail drilldown — KPIs, 7-day activity, specs, and recent orders. */
function EquipmentDetailView({
  item,
  onBack,
}: {
  item: EquipmentItem
  onBack: () => void
}) {
  const { t } = useT()

  return (
    <div className="app-shell-full">
      <TopBar breadcrumbs={[
        { label: t.operations },
        { label: 'Insights' },
        { label: 'Equipment insights 2', onClick: onBack },
        { label: item.name },
      ]} />

      <div style={{ padding: '16px 32px 4px' }}>
        <button className="btn btn-sm btn-ghost" onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="arrow-left" size={13} /> Back to equipment
        </button>
      </div>

      <div style={{ padding: '16px 32px', background: 'var(--surface-0)', borderBottom: '1px solid var(--line-1)' }}>
        <div className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Icon name="cpu" size={13} />
          <span>Equipment · {item.id}</span>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 'var(--fw-bold)', margin: '0 0 6px', color: 'var(--text-1)' }}>{item.name}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 'var(--fw-semibold)', color: STATE_COLORS[item.state] }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: STATE_COLORS[item.state] }} />
            {STATE_LABELS[item.state] ?? item.state}
          </span>
          <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>{item.type} · {item.line} · Criticality {item.criticality}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, padding: '20px 32px 0' }}>
        <KPI label="Time to clean" value={item.ttc_min ? fmtHm(item.ttc_min) : '—'} tone={item.ttc_min > 60 ? 'warn' : 'ok'} icon="sparkles" />
        <KPI label="Utilisation" value={item.utilisation_pct ? `${item.utilisation_pct}%` : '—'} tone="neutral" icon="zap" subtext="rolling 7d" />
        <KPI label="Right first time" value={item.ftr_pct ? `${item.ftr_pct}%` : '—'} tone={item.ftr_pct >= 95 ? 'ok' : item.ftr_pct > 0 ? 'warn' : 'neutral'} icon="check" />
        <KPI label="Mean time between cleans" value={item.mtbc_h ? `${item.mtbc_h}h` : '—'} tone="neutral" icon="clock" />
        <KPI label="Faults (7d)" value={item.faults_7d} tone={item.faults_7d > 0 ? 'warn' : 'neutral'} icon="alert-triangle" />
      </div>

      <div style={{ padding: '16px 32px', display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
        <div style={{ background: 'var(--surface-1)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)', padding: 16 }}>
          <div style={{ fontWeight: 'var(--fw-semibold)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <Icon name="history" size={14} /> 7-day activity
            <span style={{ color: 'var(--text-3)', fontWeight: 'normal', fontSize: 12 }}>in use · dirty · cleaning · idle</span>
          </div>
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 13, background: 'var(--surface-sunken)', borderRadius: 'var(--r-sm)' }}>
            <Icon name="clock" size={20} style={{ display: 'block', margin: '0 auto 8px', opacity: 0.4 }} />
            Activity timeline unavailable — gold view pending.
          </div>
        </div>

        <div style={{ background: 'var(--surface-1)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line-1)', fontWeight: 'var(--fw-semibold)', fontSize: 13, background: 'var(--surface-sunken)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="layers" size={14} /> Specifications
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <tbody>
              {[
                ['ID', item.id],
                ['Type', item.type],
                ['Line', item.line],
                ['Criticality', item.criticality],
                ['State', STATE_LABELS[item.state] ?? item.state],
                ['Last clean', fmtRel(item.last_clean_ms) + ' ago'],
              ].map(([k, v]) => (
                <tr key={k} style={{ borderBottom: '1px solid var(--line-1)' }}>
                  <td style={{ padding: '9px 16px', color: 'var(--text-3)' }}>{k}</td>
                  <td style={{ padding: '9px 16px', fontFamily: 'var(--font-mono)', textAlign: 'right', fontWeight: 'var(--fw-semibold)' }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ padding: '0 32px 48px' }}>
        <div style={{ background: 'var(--surface-1)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line-1)', fontWeight: 'var(--fw-semibold)', fontSize: 13, background: 'var(--surface-sunken)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="history" size={14} /> Recent process orders
          </div>
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
            No recent orders available.
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page root
// ---------------------------------------------------------------------------

/** Equipment Insights 2 page — tabbed estate view with cleaning, calibration, and anomaly tabs. */
export function EquipmentInsights2Page() {
  const { t } = useT()
  const [pageView, setPageView] = useState<PageView>({ kind: 'list', tab: 'overview' })
  const [data, setData] = useState<EquipmentInsights2Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchEquipmentInsights2()
      .then(d => { if (!cancelled) { setData(d); setLoading(false) } })
      .catch(e => { if (!cancelled) { setError(String(e)); setLoading(false) } })
    return () => { cancelled = true }
  }, [])

  const openDetail = (item: EquipmentItem) => setPageView({ kind: 'detail', item })
  const backToList = () => setPageView(prev => ({ kind: 'list', tab: prev.kind === 'list' ? prev.tab : 'overview' }))

  if (pageView.kind === 'detail') {
    return <EquipmentDetailView item={pageView.item} onBack={backToList} />
  }

  const tab = pageView.tab
  const setTab = (t: EqTab) => setPageView({ kind: 'list', tab: t })

  if (loading) {
    return (
      <div className="app-shell-full">
        <TopBar breadcrumbs={[{ label: t.operations }, { label: 'Insights' }, { label: 'Equipment insights 2' }]} />
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)' }}>Loading equipment data…</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="app-shell-full">
        <TopBar breadcrumbs={[{ label: t.operations }, { label: 'Insights' }, { label: 'Equipment insights 2' }]} />
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--status-risk)' }}>{error || 'No data available.'}</div>
      </div>
    )
  }

  if (data.data_available === false) {
    return (
      <div className="app-shell-full">
        <TopBar breadcrumbs={[{ label: t.operations }, { label: 'Insights' }, { label: 'Equipment insights 2' }]} />
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)' }}>
          <Icon name="clock" size={24} style={{ display: 'block', margin: '0 auto 12px', opacity: 0.5 }} />
          <h2 style={{ fontSize: 16, fontWeight: 'var(--fw-semibold)', color: 'var(--text-1)', marginBottom: 8 }}>Equipment data unavailable</h2>
          <p>This view is waiting for the certified equipment source tables in Unity Catalogue.</p>
          {data.reason && <p style={{ fontSize: 12, opacity: 0.6, marginTop: 8 }}>Reason: {data.reason}</p>}
        </div>
      </div>
    )
  }

  const TABS: { id: EqTab; label: string }[] = [
    { id: 'overview',    label: 'Overview' },
    { id: 'cleaning',    label: 'Cleaning' },
    { id: 'calibration', label: 'Calibration' },
    { id: 'anomaly',     label: 'Anomaly' },
  ]

  return (
    <div className="app-shell-full">
      <TopBar breadcrumbs={[{ label: t.operations }, { label: 'Insights' }, { label: 'Equipment insights 2' }]} />

      <div style={{ padding: '24px 32px', background: 'var(--surface-0)', borderBottom: '1px solid var(--line-1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Icon name="cpu" size={13} />
              <span>Insights</span>
            </div>
            <h1 style={{ fontSize: 26, fontWeight: 'var(--fw-bold)', margin: '0 0 4px', color: 'var(--text-1)' }}>Equipment insights 2</h1>
            <p style={{ fontSize: 13, color: 'var(--text-3)', margin: 0 }}>
              {data.equipment.length} pieces of equipment. Time to clean, utilisation, calibration, and right-first-time — all in one place.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 3, background: 'var(--surface-sunken)', borderRadius: 'var(--r-sm)', padding: 3, alignSelf: 'flex-start' }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`btn btn-sm ${tab === t.id ? 'btn-primary' : 'btn-ghost'}`}
                style={{ fontSize: 12 }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {tab === 'overview'    && <OverviewContent    data={data} onOpen={openDetail} />}
      {tab === 'cleaning'    && <CleaningContent    data={data} onOpen={openDetail} />}
      {tab === 'calibration' && <CalibrationContent data={data} onOpen={openDetail} />}
      {tab === 'anomaly'     && <AnomalyContent     data={data} onOpen={openDetail} />}
    </div>
  )
}
