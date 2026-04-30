import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { I } from '../ui'
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

interface CorrelationData {
  pours: PoursData
  yieldData: YieldData
  quality: QualityData
}

interface CorrelationSignal {
  tone: 'bad' | 'good' | 'ok' | 'neut'
  title: string
  value: string
  body: string
}

const QUERY_KEYS = {
  plantId: 'plant',
  lineId: 'line',
  material: 'material',
  dateFrom: 'from',
  dateTo: 'to',
  compare: 'compare',
}

function coerceCompareMode(value: string | null | undefined, fallback: CompareMode): CompareMode {
  return value === 'none' || value === 'prior7d' ? value : fallback
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

export function useAnalyticsFilters(defaults?: Partial<AnalyticsFilters>) {
  const fallbackToday = todayISO()
  const [filters, setFilters] = useState<AnalyticsFilters>(() => {
    const params = new URLSearchParams(window.location.search)
    return {
      plantId: params.get(QUERY_KEYS.plantId) || defaults?.plantId || 'ALL',
      lineId: params.get(QUERY_KEYS.lineId) || defaults?.lineId || 'ALL',
      material: params.get(QUERY_KEYS.material) || defaults?.material || 'ALL',
      dateFrom: params.get(QUERY_KEYS.dateFrom) || defaults?.dateFrom || fallbackToday,
      dateTo: params.get(QUERY_KEYS.dateTo) || defaults?.dateTo || fallbackToday,
      compare: coerceCompareMode(params.get(QUERY_KEYS.compare), defaults?.compare || 'prior7d'),
    }
  })

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    Object.entries(QUERY_KEYS).forEach(([key, queryKey]) => {
      const value = filters[key as keyof AnalyticsFilters]
      const defaultValue = key === 'dateFrom' || key === 'dateTo'
        ? fallbackToday
        : key === 'compare'
          ? 'prior7d'
          : 'ALL'
      if (!value || value === defaultValue) params.delete(queryKey)
      else params.set(queryKey, String(value))
    })
    const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}${window.location.hash}`
    window.history.replaceState(null, '', next)
  }, [filters, fallbackToday])

  const patchFilters = (patch: Partial<AnalyticsFilters>) => {
    setFilters(prev => ({ ...prev, ...patch }))
  }

  return { filters, setFilters: patchFilters }
}

export function AnalyticsFilterBar({
  filters,
  onChange,
  materials = [],
  sourceTypes = [],
  showMaterial = true,
  showSourceType = false,
  sourceType,
  onSourceTypeChange,
}: {
  filters: AnalyticsFilters
  onChange: (patch: Partial<AnalyticsFilters>) => void
  materials?: string[]
  sourceTypes?: string[]
  showMaterial?: boolean
  showSourceType?: boolean
  sourceType?: string
  onSourceTypeChange?: (value: string) => void
}) {
  const today = todayISO()
  return (
    <div className="analytics-filter-bar">
      <label className="afb-field">
        <span>{I.factory} Plant</span>
        <input
          value={filters.plantId === 'ALL' ? '' : filters.plantId}
          placeholder="All plants"
          onChange={e => onChange({ plantId: e.target.value.trim() || 'ALL' })}
        />
      </label>

      <label className="afb-field disabled">
        <span>{I.layers} Line</span>
        <select value={filters.lineId} onChange={e => onChange({ lineId: e.target.value })} disabled>
          <option value="ALL">All lines</option>
        </select>
      </label>

      {showMaterial && (
        <label className="afb-field">
          <span>{I.package} Material</span>
          <select value={filters.material} onChange={e => onChange({ material: e.target.value })}>
            <option value="ALL">All materials{materials.length ? ` · ${materials.length}` : ''}</option>
            {materials.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
      )}

      {showSourceType && (
        <label className="afb-field">
          <span>{I.archive} Source</span>
          <select value={sourceType ?? 'ALL'} onChange={e => onSourceTypeChange?.(e.target.value)}>
            <option value="ALL">All source types{sourceTypes.length ? ` · ${sourceTypes.length}` : ''}</option>
            {sourceTypes.map(st => <option key={st} value={st}>{st}</option>)}
          </select>
        </label>
      )}

      <label className="afb-field dates">
        <span>{I.calendar} Date range</span>
        <div className="afb-dates">
          <input
            type="date"
            value={filters.dateFrom}
            max={filters.dateTo || today}
            onChange={e => onChange({ dateFrom: e.target.value })}
          />
          <span>to</span>
          <input
            type="date"
            value={filters.dateTo}
            min={filters.dateFrom}
            max={today}
            onChange={e => onChange({ dateTo: e.target.value })}
          />
        </div>
      </label>

      <label className="afb-field">
        <span>{I.trending} Compare</span>
        <select value={filters.compare} onChange={e => onChange({ compare: e.target.value as CompareMode })}>
          <option value="prior7d">Prior 7 days</option>
          <option value="none">No comparison</option>
        </select>
      </label>
    </div>
  )
}

export function inBucket(ms: number | null | undefined, selection: BucketSelection | null): boolean {
  if (!selection || ms == null) return false
  return ms >= selection.startMs && ms < selection.endMs
}

export function percentDelta(current: number | null, prior: number | null): number | null {
  if (current == null || prior == null || prior === 0) return null
  return ((current - prior) / prior) * 100
}

export function DeltaPill({
  current,
  prior,
  invert = false,
  suffix = '%',
}: {
  current: number | null
  prior: number | null
  invert?: boolean
  suffix?: string
}) {
  const delta = percentDelta(current, prior)
  if (delta == null) return <span className="analytics-delta neut">no comparison</span>
  const good = invert ? delta <= 0 : delta >= 0
  const cls = Math.abs(delta) < 0.1 ? 'neut' : good ? 'pos' : 'neg'
  return (
    <span className={`analytics-delta ${cls}`}>
      {delta >= 0 ? '+' : ''}{delta.toFixed(1)}{suffix} vs prior 7d
    </span>
  )
}

export function ContributorsPanel({
  title,
  selection,
  count,
  children,
  onClear,
}: {
  title: string
  selection: BucketSelection | null
  count: number
  children: ReactNode
  onClear: () => void
}) {
  if (!selection) return null
  return (
    <div className="contributors-panel">
      <div className="cp-head">
        <div>
          <div className="cp-eyebrow">{selection.kind} selection</div>
          <h2>{title} · {selection.label}</h2>
        </div>
        <div className="cp-actions">
          <span className="cp-count mono">{count.toLocaleString()} rows</span>
          <button className="icon-btn" title="Clear selection" onClick={onClear}>{I.x}</button>
        </div>
      </div>
      <div className="cp-body">{children}</div>
    </div>
  )
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null
  return nums.reduce((a, n) => a + n, 0) / nums.length
}

function isNumber(value: number | null | undefined): value is number {
  return value != null
}

function topEntry(map: Map<string, number>): [string, number] | null {
  let best: [string, number] | null = null
  map.forEach((value, key) => {
    if (!best || value > best[1]) best = [key, value]
  })
  return best
}

export function AnalyticsCorrelationPanel({ filters }: { filters: AnalyticsFilters }) {
  const [state, setState] = useState<{ loading: boolean; error: string | null; data: CorrelationData | null }>({
    loading: true,
    error: null,
    data: null,
  })

  const plantId = filters.plantId === 'ALL' ? undefined : filters.plantId

  useEffect(() => {
    let cancelled = false
    setState({ loading: true, error: null, data: null })
    Promise.all([
      fetchPoursAnalytics({ plantId, dateFrom: filters.dateFrom, dateTo: filters.dateTo }),
      fetchYieldAnalytics({ plant_id: plantId, date_from: filters.dateFrom, date_to: filters.dateTo }),
      fetchQualityAnalytics({ plant_id: plantId, date_from: filters.dateFrom, date_to: filters.dateTo }),
    ])
      .then(([pours, yieldData, quality]) => {
        if (!cancelled) setState({ loading: false, error: null, data: { pours, yieldData, quality } })
      })
      .catch(e => {
        if (!cancelled) setState({ loading: false, error: String(e), data: null })
      })
    return () => { cancelled = true }
  }, [plantId, filters.dateFrom, filters.dateTo])

  const signals = useMemo(() => {
    if (!state.data) return []
    const { pours, yieldData, quality } = state.data
    const target = yieldData.target_yield_pct ?? 95
    const lowYield = yieldData.orders.filter(o => o.yield_pct != null && o.yield_pct < target)
    const rejected = quality.rows.filter(r => r.judgement === 'R')
    const rejectedOrders = new Set(rejected.map(r => String(r.process_order)))
    const overlap = lowYield.filter(o => rejectedOrders.has(String(o.process_order_id)))

    const materialScores = new Map<string, number>()
    lowYield.forEach(o => {
      const key = o.material_name || o.material_id || 'Unknown material'
      materialScores.set(key, (materialScores.get(key) ?? 0) + Math.max(o.loss_kg ?? 0, 0))
    })
    rejected.forEach(r => {
      const key = r.material_name || r.material_id || 'Unknown material'
      materialScores.set(key, (materialScores.get(key) ?? 0) + 10)
    })
    pours.events.forEach(e => {
      const key = e.material_name || 'Unknown material'
      materialScores.set(key, (materialScores.get(key) ?? 0) + Math.max(e.quantity ?? 0, 0) / 100)
    })
    const hotspot = topEntry(materialScores)

    const currentYield = avg(yieldData.orders.map(o => o.yield_pct).filter(isNumber))
    const priorYield = avg(yieldData.prior7d.map(o => o.yield_pct).filter(isNumber))
    const currentRejectPct = quality.rows.length
      ? (rejected.length / quality.rows.length) * 100
      : null
    const priorRejected = quality.prior7d.filter(r => r.judgement === 'R')
    const priorRejectPct = quality.prior7d.length
      ? (priorRejected.length / quality.prior7d.length) * 100
      : null
    const pourDelta = percentDelta(pours.events.length, pours.prior7d.length)

    const result: CorrelationSignal[] = []
    result.push({
      tone: overlap.length > 0 ? 'bad' : 'good',
      title: 'Yield and quality overlap',
      value: overlap.length.toLocaleString(),
      body: overlap.length > 0
        ? `${overlap.length} low-yield order${overlap.length === 1 ? '' : 's'} also have rejected inspection results.`
        : 'No low-yield orders currently overlap with rejected inspection results.',
    })

    result.push({
      tone: hotspot ? 'ok' : 'good',
      title: 'Material hotspot',
      value: hotspot ? hotspot[0] : 'None',
      body: hotspot
        ? 'Highest combined signal from yield loss, quality rejects, and pour activity.'
        : 'No material-level correlation signal in the selected period.',
    })

    result.push({
      tone: currentYield != null && priorYield != null && currentYield < priorYield ? 'bad' : 'good',
      title: 'Yield movement',
      value: currentYield != null ? `${currentYield.toFixed(1)}%` : '—',
      body: priorYield != null
        ? `${currentYield != null && currentYield >= priorYield ? 'Up' : 'Down'} ${(Math.abs((currentYield ?? priorYield) - priorYield)).toFixed(1)} pts vs prior 7d.`
        : 'No prior yield baseline available.',
    })

    result.push({
      tone: currentRejectPct != null && priorRejectPct != null && currentRejectPct > priorRejectPct ? 'bad' : 'good',
      title: 'Quality drag',
      value: currentRejectPct != null ? `${currentRejectPct.toFixed(1)}%` : '—',
      body: priorRejectPct != null
        ? `${rejected.length} rejected rows; prior reject rate was ${priorRejectPct.toFixed(1)}%.`
        : `${rejected.length} rejected rows; no prior quality baseline available.`,
    })

    result.push({
      tone: pourDelta != null && pourDelta > 20 && currentYield != null && priorYield != null && currentYield < priorYield ? 'bad' : 'neut',
      title: 'Pour volume pressure',
      value: pours.events.length.toLocaleString(),
      body: pourDelta != null
        ? `${pourDelta >= 0 ? '+' : ''}${pourDelta.toFixed(1)}% pour count vs prior 7d.`
        : 'No prior pour baseline available.',
    })

    return result
  }, [state.data])

  return (
    <div className="correlation-panel">
      <div className="corr-head">
        <div>
          <div className="cp-eyebrow">Cross-metric correlation</div>
          <h2>{I.trending}<span>Operational signals</span></h2>
        </div>
        <span className="corr-period mono">{filters.dateFrom} to {filters.dateTo}</span>
      </div>

      {state.loading && <div className="corr-state">Loading correlation signals…</div>}
      {state.error && <div className="corr-state bad">Correlation unavailable: {state.error}</div>}
      {!state.loading && !state.error && (
        <div className="corr-grid">
          {signals.map(signal => (
            <div key={signal.title} className={`corr-card ${signal.tone}`}>
              <div className="corr-card-title">{signal.title}</div>
              <div className="corr-card-value">{signal.value}</div>
              <div className="corr-card-body">{signal.body}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
