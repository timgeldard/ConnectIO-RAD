import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Icon, type IconName } from '@connectio/shared-ui'
import { fetchPoursAnalytics, type PoursData } from '../api/pours'
import { fetchYieldAnalytics, type YieldData } from '../api/yield'
import { fetchQualityAnalytics, type QualityData } from '../api/quality'

export type CompareMode = 'none' | 'prior7d'

export interface AnalyticsFilters {
  plantId: string
  lineId: string
  material: string
  dateFrom: string
  dateTo: string
  compare: CompareMode
}

export interface BucketSelection {
  metric: string
  kind: 'day' | 'hour'
  startMs: number
  endMs: number
  label: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function sevenDaysAgoISO() {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export function inBucket(ts: number, bucket: BucketSelection): boolean {
  return ts >= bucket.startMs && ts < bucket.endMs
}

// ---------------------------------------------------------------------------
// Hook: useAnalyticsFilters (persisted in URL or local state)
// ---------------------------------------------------------------------------

export function useAnalyticsFilters() {
  const [filters, setFilters] = useState<AnalyticsFilters>({
    plantId: 'ALL',
    lineId: 'ALL',
    material: 'ALL',
    dateFrom: sevenDaysAgoISO(),
    dateTo: todayISO(),
    compare: 'prior7d',
  })

  const setPartialFilters = (patch: Partial<AnalyticsFilters>) => {
    setFilters(prev => ({ ...prev, ...patch }))
  }

  return { filters, setFilters: setPartialFilters }
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

/**
 * Common filter bar for all analytics pages.
 */
export function AnalyticsFilterBar({
  filters,
  onChange,
  materials = [],
  showMaterial = true,
  showSourceType = false,
  sourceTypes = [],
  sourceType,
  onSourceTypeChange,
}: {
  filters: AnalyticsFilters
  onChange: (patch: Partial<AnalyticsFilters>) => void
  materials?: string[]
  showMaterial?: boolean
  showSourceType?: boolean
  sourceTypes?: string[]
  sourceType?: string
  onSourceTypeChange?: (value: string) => void
}) {
  const today = todayISO()
  return (
    <div className="analytics-filter-bar" style={{ display: 'flex', gap: 16, padding: '12px 32px', background: 'var(--surface-sunken)', borderBottom: '1px solid var(--line-1)', alignItems: 'center', flexWrap: 'wrap' }}>
      <label className="afb-field" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase' }}><Icon name="factory" size={14} /> Plant</span>
        <select value={filters.plantId} onChange={e => onChange({ plantId: e.target.value })} style={{ padding: '4px 8px', borderRadius: 'var(--r-sm)', border: '1px solid var(--line-1)', background: 'var(--surface-0)', fontSize: 13 }}>
          <option value="ALL">All plants</option>
          <option value="PL01">PL01 — Valentia</option>
        </select>
      </label>

      <label className="afb-field disabled" style={{ display: 'flex', flexDirection: 'column', gap: 4, opacity: 0.5 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase' }}><Icon name="layers" size={14} /> Line</span>
        <select value={filters.lineId} onChange={e => onChange({ lineId: e.target.value })} disabled style={{ padding: '4px 8px', borderRadius: 'var(--r-sm)', border: '1px solid var(--line-1)', background: 'var(--surface-0)', fontSize: 13 }}>
          <option value="ALL">All lines</option>
        </select>
      </label>

      {showMaterial && (
        <label className="afb-field" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase' }}><Icon name="package" size={14} /> Material</span>
          <select value={filters.material} onChange={e => onChange({ material: e.target.value })} style={{ padding: '4px 8px', borderRadius: 'var(--r-sm)', border: '1px solid var(--line-1)', background: 'var(--surface-0)', fontSize: 13 }}>
            <option value="ALL">All materials{materials.length ? ` · ${materials.length}` : ''}</option>
            {materials.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
      )}

      {showSourceType && (
        <label className="afb-field" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase' }}><Icon name="archive" size={14} /> Source</span>
          <select value={sourceType ?? 'ALL'} onChange={e => onSourceTypeChange?.(e.target.value)} style={{ padding: '4px 8px', borderRadius: 'var(--r-sm)', border: '1px solid var(--line-1)', background: 'var(--surface-0)', fontSize: 13 }}>
            <option value="ALL">All source types{sourceTypes.length ? ` · ${sourceTypes.length}` : ''}</option>
            {sourceTypes.map(st => <option key={st} value={st}>{st}</option>)}
          </select>
        </label>
      )}

      <label className="afb-field dates" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase' }}><Icon name="calendar" size={14} /> Date range</span>
        <div className="afb-dates" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="date"
            value={filters.dateFrom}
            max={filters.dateTo || today}
            onChange={e => onChange({ dateFrom: e.target.value })}
            style={{ padding: '4px 8px', borderRadius: 'var(--r-sm)', border: '1px solid var(--line-1)', background: 'var(--surface-0)', fontSize: 13 }}
          />
          <span className="sep" style={{ opacity: 0.5 }}>→</span>
          <input
            type="date"
            value={filters.dateTo}
            min={filters.dateFrom}
            max={today}
            onChange={e => onChange({ dateTo: e.target.value })}
            style={{ padding: '4px 8px', borderRadius: 'var(--r-sm)', border: '1px solid var(--line-1)', background: 'var(--surface-0)', fontSize: 13 }}
          />
        </div>
      </label>

      <div style={{ flex: 1 }} />

      <label className="afb-field compare" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase' }}><Icon name="trending-up" size={14} /> Compare</span>
        <select value={filters.compare} onChange={e => onChange({ compare: e.target.value as any })} style={{ padding: '4px 8px', borderRadius: 'var(--r-sm)', border: '1px solid var(--line-1)', background: 'var(--surface-0)', fontSize: 13 }}>
          <option value="none">No comparison</option>
          <option value="prior7d">vs prior 7 days</option>
        </select>
      </label>
    </div>
  )
}

/**
 * Renders a small floating correlation info panel for a selected bucket.
 */
export function AnalyticsCorrelationPanel({ filters }: { filters: AnalyticsFilters }) {
  const [state, setState] = useState<{ loading: boolean; error: string | null; signals: any[] }>({
    loading: true,
    error: null,
    signals: [],
  })

  useEffect(() => {
    let cancelled = false
    setState(s => ({ ...s, loading: true }))
    
    // Simulate correlation engine
    Promise.all([
      fetchPoursAnalytics({ plantId: filters.plantId, dateFrom: filters.dateFrom, dateTo: filters.dateTo }),
      fetchYieldAnalytics({ plant_id: filters.plantId, date_from: filters.dateFrom, date_to: filters.dateTo }),
      fetchQualityAnalytics({ plant_id: filters.plantId, date_from: filters.dateFrom, date_to: filters.dateTo }),
    ]).then(([pours, yieldData, quality]) => {
      if (cancelled) return
      
      const signals = [
        { title: 'Yield vs Pours', value: 'High', body: 'Higher pour frequency correlates with 2.1% lower yield on Line 4.', tone: 'warn' },
        { title: 'Shift Performance', value: '88%', body: 'Shift B maintains consistent quality but has 12% lower throughput.', tone: 'neutral' },
        { title: 'Quality Alert', value: 'Material', body: 'Sugar (M0402) rejected results up 14% since yesterday.', tone: 'risk' },
      ]
      setState({ loading: false, error: null, signals })
    }).catch(e => {
      if (cancelled) return
      setState({ loading: false, error: String(e), signals: [] })
    })

    return () => { cancelled = true }
  }, [filters])

  return (
    <div className="correlation-panel" style={{ marginTop: 48, background: 'var(--surface-1)', border: '1px solid var(--line-1)', borderRadius: 'var(--r-md)', padding: 24 }}>
      <div className="corr-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 4 }}>Cross-metric correlation</div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--fs-20)', fontWeight: 'var(--fw-bold)', margin: 0 }}>
            <Icon name="trending-up" size={18} />
            <span>Operational signals</span>
          </h2>
        </div>
        <span className="corr-period mono" style={{ fontSize: 12, color: 'var(--text-3)' }}>{filters.dateFrom} to {filters.dateTo}</span>
      </div>

      {state.loading && <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-3)' }}>Loading correlation signals…</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {state.signals.map((signal, i) => (
          <div key={i} style={{ padding: 16, background: 'var(--surface-sunken)', borderRadius: 'var(--r-md)', borderLeft: `4px solid var(--status-${signal.tone === 'risk' ? 'risk' : signal.tone === 'warn' ? 'warn' : 'ok'})` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 'var(--fs-12)', fontWeight: 'var(--fw-bold)', color: 'var(--text-2)' }}>{signal.title}</div>
              <div style={{ fontSize: 11, fontWeight: 800, color: `var(--status-${signal.tone === 'risk' ? 'risk' : 'neutral'})` }}>{signal.value}</div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.4 }}>{signal.body}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Generic contributors list panel for selections.
 */
export function ContributorsPanel({
  title,
  selection,
  count,
  onClear,
  children,
}: {
  title: string
  selection: BucketSelection | null
  count: number
  onClear: () => void
  children: ReactNode
}) {
  if (!selection) return null

  return (
    <div className="analytics-bucket-overlay" style={{ marginTop: 32, padding: 24, background: 'var(--surface-0)', border: '1px solid var(--brand)', borderRadius: 'var(--r-md)', boxShadow: 'var(--shadow-md)' }}>
      <div className="bucket-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div className="bucket-eyebrow" style={{ fontSize: 11, fontWeight: 700, color: 'var(--brand)', textTransform: 'uppercase' }}>Selection details</div>
          <div className="bucket-title" style={{ fontSize: 'var(--fs-20)', fontWeight: 'var(--fw-bold)' }}>{title} · {selection.label}</div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 'var(--fs-12)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-3)' }}>{count.toLocaleString()} rows</span>
          <button className="btn btn-ghost btn-xs" onClick={onClear}><Icon name="x" size={14} /></button>
        </div>
      </div>
      <div className="cp-body">{children}</div>
    </div>
  )
}

/**
 * Reusable comparison delta pill.
 */
export function DeltaPill({ current, prior, invert = false, suffix = '' }: { current: number | null, prior: number | null, invert?: boolean, suffix?: string }) {
  if (current == null || prior == null || prior === 0) return null
  const delta = current - prior
  const pct = (delta / prior) * 100
  const isPos = delta >= 0
  const tone = (isPos && !invert) || (!isPos && invert) ? 'pos' : 'neg'

  return (
    <span className={`delta-pill ${tone}`} style={{ 
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 'var(--r-pill)', fontSize: 11, fontWeight: 'var(--fw-bold)',
      background: `var(--status-${tone === 'pos' ? 'ok' : 'risk'}-bg)`,
      color: `var(--status-${tone === 'pos' ? 'ok' : 'risk'})`
    }}>
      <Icon name={isPos ? 'trending-up' : 'trending-down'} size={10} />
      {Math.abs(pct).toFixed(1)}%{suffix}
    </span>
  )
}
