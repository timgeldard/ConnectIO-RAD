// @ts-nocheck
import { useEffect, useMemo, useState } from 'react'
import { I, TopBar, fmt } from '../ui'
import {
  AnalyticsFilterBar,
  useAnalyticsFilters,
  todayISO,
} from './analyticsShared'
import {
  fetchVesselPlanningAnalytics,
  type VesselPlanningData,
  type VesselInfo,
  type ReleasedOrder,
} from '../api/vessel_planning'

// ---------------------------------------------------------------------------
// Types & constants
// ---------------------------------------------------------------------------

type VesselState = 'IN_USE' | 'DIRTY' | 'AVAILABLE' | 'UNKNOWN'

const STATE_LABELS: Record<VesselState, string> = {
  IN_USE: 'In use',
  DIRTY: 'Dirty',
  AVAILABLE: 'Available',
  UNKNOWN: 'Unknown',
}

const CONSTRAINT_LABELS: Record<string, string> = {
  dirty_vessel: 'Dirty vessel',
  in_use_vessel: 'In use',
  no_vessel: 'No affinity data',
}

const CONFIDENCE_LABELS: Record<string, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function VesselStateBadge({ state }: { state: VesselState }) {
  return <span className={`vp-state-badge ${state.toLowerCase().replace('_', '-')}`}>{STATE_LABELS[state]}</span>
}

function ConstraintBadge({ type }: { type: string | null }) {
  if (!type) return <span className="vp-constraint-badge feasible">Feasible</span>
  return <span className={`vp-constraint-badge ${type.replace('_', '-')}`}>{CONSTRAINT_LABELS[type] ?? type}</span>
}

function ConfidenceDot({ level }: { level: string }) {
  return <span className={`vp-confidence ${level}`} title={`Heuristic confidence: ${CONFIDENCE_LABELS[level] ?? level}`}>{CONFIDENCE_LABELS[level] ?? level}</span>
}

// ---------------------------------------------------------------------------
// KPI strip
// ---------------------------------------------------------------------------

function VpKpiStrip({ kpis, loading }: { kpis: VesselPlanningData['kpis'] | null; loading: boolean }) {
  const dash = loading ? '…' : null

  const cards = [
    {
      tone: 'tone-planned',
      icon: I.hexagon,
      label: 'Released POs',
      value: dash ?? kpis?.released_po_count?.toLocaleString() ?? '—',
      sub: 'awaiting vessel',
    },
    {
      tone: kpis?.constrained_po_count ? 'tone-actual bad' : 'tone-actual good',
      icon: I.warning,
      label: 'Constrained POs',
      value: dash ?? kpis?.constrained_po_count?.toLocaleString() ?? '—',
      sub: 'no vessel available',
    },
    {
      tone: 'tone-actual good',
      icon: I.check,
      label: 'Available vessels',
      value: dash ?? kpis?.available_vessel_count?.toLocaleString() ?? '—',
      sub: 'ready to assign',
    },
    {
      tone: kpis?.dirty_vessel_count ? 'tone-actual ok' : 'tone-planned',
      icon: I.flask,
      label: 'Dirty vessels',
      value: dash ?? kpis?.dirty_vessel_count?.toLocaleString() ?? '—',
      sub: 'need CIP cleaning',
    },
    {
      tone: 'tone-target',
      icon: I.cpu,
      label: 'In-use vessels',
      value: dash ?? kpis?.in_use_vessel_count?.toLocaleString() ?? '—',
      sub: 'running orders',
    },
    {
      tone: kpis?.unblock_action_count ? 'tone-actual bad' : 'tone-planned',
      icon: I.flag,
      label: 'Unblock actions',
      value: dash ?? kpis?.unblock_action_count?.toLocaleString() ?? '—',
      sub: 'expedite or clean',
    },
  ]

  return (
    <div className="pour-grid vp-kpi-grid">
      {cards.map(c => (
        <div key={c.label} className={`pour-kpi ${c.tone}`}>
          <div className="pk-l">{c.icon}<span>{c.label}</span></div>
          <div className="pk-v">{c.value}</div>
          <div className="pk-sub">{c.sub}</div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Planning board (vessel table)
// ---------------------------------------------------------------------------

function PlanningBoard({
  vessels,
  stateFilter,
  searchQuery,
}: {
  vessels: VesselInfo[]
  stateFilter: string
  searchQuery: string
}) {
  const filtered = useMemo(() => {
    let list = vessels
    if (stateFilter !== 'ALL') list = list.filter(v => v.state === stateFilter)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      list = list.filter(v =>
        v.instrument_id.toLowerCase().includes(q) ||
        (v.current_material_name?.toLowerCase().includes(q)) ||
        (v.current_po_id?.toLowerCase().includes(q))
      )
    }
    return list
  }, [vessels, stateFilter, searchQuery])

  if (filtered.length === 0) {
    return <div className="vp-empty-state">No vessels match the current filter.</div>
  }

  return (
    <div className="vp-board-wrap">
      <table className="vp-table">
        <thead>
          <tr>
            <th>Vessel</th>
            <th>Type</th>
            <th>State</th>
            <th>Current PO</th>
            <th>Current material</th>
            <th>Since</th>
            <th>Blocked orders</th>
            <th>Recommended action</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(v => (
            <tr key={v.instrument_id} className={`vp-row state-${v.state.toLowerCase().replace('_', '-')}`}>
              <td className="vp-cell-id mono">{v.instrument_id}</td>
              <td className="vp-cell-type">{v.equipment_type ?? '—'}</td>
              <td><VesselStateBadge state={v.state} /></td>
              <td className="mono">{v.current_po_id ?? '—'}</td>
              <td>{v.current_material_name ?? '—'}</td>
              <td className="mono">
                {v.state_since_ms ? fmt.shortDate(v.state_since_ms) : '—'}
              </td>
              <td>
                {v.blocked_orders.length > 0
                  ? (
                    <span className="vp-blocked-count" title={v.blocked_orders.map(o => o.material_name).join(', ')}>
                      {v.blocked_orders.length} PO{v.blocked_orders.length !== 1 ? 's' : ''}
                    </span>
                  )
                  : <span className="vp-no-block">—</span>
                }
              </td>
              <td className="vp-cell-action">
                {v.recommended_action
                  ? <span className={`vp-action priority-${v.action_priority ?? 3}`}>{v.recommended_action}</span>
                  : <span className="vp-no-action">—</span>
                }
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Priority queue (released orders)
// ---------------------------------------------------------------------------

function PriorityQueue({
  orders,
  materialFilter,
}: {
  orders: ReleasedOrder[]
  materialFilter: string
}) {
  const filtered = useMemo(() => {
    if (materialFilter === 'ALL') return orders
    return orders.filter(o => o.material_id === materialFilter || o.material_name === materialFilter)
  }, [orders, materialFilter])

  if (filtered.length === 0) {
    return <div className="vp-empty-state">No released orders match the current filter.</div>
  }

  return (
    <div className="vp-board-wrap">
      <table className="vp-table">
        <thead>
          <tr>
            <th>#</th>
            <th>PO</th>
            <th>Material</th>
            <th>Scheduled start</th>
            <th>Feasibility</th>
            <th>Constraint</th>
            <th>Likely vessels</th>
            <th>Recommendation</th>
            <th>Confidence</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map(o => (
            <tr key={o.po_id} className={`vp-row ${o.feasible ? 'feasible' : 'constrained'}`}>
              <td className="mono vp-rank">{o.rank}</td>
              <td>
                <button
                  className="pa-po-link"
                  onClick={() => (window as any).__navigateToOrder?.(o.po_id, {
                    _from: 'vessel-planning',
                    materialId: o.material_id,
                    label: o.material_name,
                    plantId: o.plant_id,
                    start: o.scheduled_start_ms ?? (Date.now() - 4 * 3600 * 1000),
                  })}
                >
                  {o.po_id}
                </button>
              </td>
              <td>{o.material_name}</td>
              <td className="mono">
                {o.scheduled_start_ms ? fmt.date(o.scheduled_start_ms) : <span className="vp-unscheduled">Unscheduled</span>}
              </td>
              <td>
                <ConstraintBadge type={o.constraint_type} />
              </td>
              <td>{o.constraint_type ? CONSTRAINT_LABELS[o.constraint_type] ?? o.constraint_type : '—'}</td>
              <td className="mono vp-vessels-cell">
                {o.likely_vessels.length > 0
                  ? o.likely_vessels.slice(0, 3).join(', ')
                  : <span className="vp-no-affinity">None on record</span>
                }
              </td>
              <td className="vp-cell-action">
                {o.recommendation
                  ? <span className={o.feasible ? 'vp-rec-feasible' : 'vp-rec-constrained'}>{o.recommendation}</span>
                  : '—'
                }
              </td>
              <td><ConfidenceDot level={o.heuristic_confidence} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Activity trend chart (SVG bar chart)
// ---------------------------------------------------------------------------

function ActivityTrendChart({ data }: { data: VesselPlanningData['daily30d'] }) {
  if (!data.length) return null
  const max = Math.max(...data.map(d => d.event_count), 1)
  const W = 600
  const H = 80
  const barW = Math.max(1, (W / data.length) - 2)

  return (
    <div className="vp-trend-wrap">
      <div className="vp-section-eyebrow">Equipment activity · last 30 days</div>
      <svg className="vp-trend-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {data.map((d, i) => {
          const barH = Math.max(1, (d.event_count / max) * (H - 4))
          const x = i * (W / data.length)
          return (
            <rect
              key={d.day_ms}
              x={x}
              y={H - barH}
              width={barW}
              height={barH}
              className="vp-trend-bar"
              rx={1}
            >
              <title>{fmt.shortDate(d.day_ms)} — {d.event_count} events</title>
            </rect>
          )
        })}
      </svg>
      <div className="vp-trend-labels">
        <span className="mono">{data.length > 0 ? fmt.shortDate(data[0].day_ms) : ''}</span>
        <span className="mono">{data.length > 0 ? fmt.shortDate(data[data.length - 1].day_ms) : ''}</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Equipment event history table
// ---------------------------------------------------------------------------

function EquipmentHistory({
  events,
  vesselFilter,
}: {
  events: VesselPlanningData['equipment_events']
  vesselFilter: string
}) {
  const [expanded, setExpanded] = useState(false)
  const filtered = vesselFilter === 'ALL'
    ? events
    : events.filter(e => e.instrument_id === vesselFilter)
  const visible = expanded ? filtered : filtered.slice(0, 100)

  if (filtered.length === 0) {
    return <div className="vp-empty-state">No equipment events in the selected period.</div>
  }

  return (
    <div className="vp-board-wrap">
      <table className="vp-table vp-history-table">
        <thead>
          <tr>
            <th>Vessel</th>
            <th>Type</th>
            <th>Status from</th>
            <th>Status to</th>
            <th>Changed at</th>
            <th>PO</th>
            <th>Material</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((e, i) => (
            <tr key={`${e.instrument_id}-${e.change_at_ms}-${i}`}>
              <td className="mono">{e.instrument_id}</td>
              <td>{e.equipment_type ?? '—'}</td>
              <td className="vp-status-text">{e.status_from ?? '—'}</td>
              <td className="vp-status-text">{e.status_to ?? '—'}</td>
              <td className="mono">
                {e.change_at_ms ? `${fmt.shortDate(e.change_at_ms)} ${fmt.time(e.change_at_ms)}` : '—'}
              </td>
              <td className="mono">{e.process_order_id ?? '—'}</td>
              <td>{e.material_name ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!expanded && filtered.length > 100 && (
        <div className="vp-show-more">
          <button className="vp-show-more-btn" onClick={() => setExpanded(true)}>
            Show all {filtered.length.toLocaleString()} rows
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page root
// ---------------------------------------------------------------------------

export function VesselPlanningAnalyticsPage() {
  const { filters, setFilters } = useAnalyticsFilters({
    dateFrom: (() => {
      const d = new Date()
      d.setDate(d.getDate() - 29)
      return d.toISOString().slice(0, 10)
    })(),
    dateTo: todayISO(),
    compare: 'none',
  })

  const [state, setState] = useState<{
    loading: boolean
    error: string | null
    data: VesselPlanningData | null
  }>({ loading: true, error: null, data: null })

  const [stateFilter, setStateFilter] = useState<string>('ALL')
  const [vesselSearch, setVesselSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'board' | 'queue' | 'history'>('board')

  const plantId = filters.plantId === 'ALL' ? undefined : filters.plantId

  useEffect(() => {
    let cancelled = false
    setState(prev => ({ ...prev, loading: true, error: null }))
    fetchVesselPlanningAnalytics({
      plantId,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
    })
      .then(data => { if (!cancelled) setState({ loading: false, error: null, data }) })
      .catch(e => { if (!cancelled) setState({ loading: false, error: String(e), data: null }) })
    return () => { cancelled = true }
  }, [plantId, filters.dateFrom, filters.dateTo])

  const materials = useMemo(() => {
    if (!state.data) return []
    const seen = new Set<string>()
    state.data.released_orders.forEach(o => { if (o.material_id) seen.add(o.material_id) })
    return Array.from(seen).sort()
  }, [state.data])

  const vesselIds = useMemo(() => {
    if (!state.data) return []
    return state.data.vessels.map(v => v.instrument_id).sort()
  }, [state.data])

  return (
    <div className="vp-page">
      <TopBar trail={['Manufacturing', 'Vessel planning']} />

      <div className="page-head">
        <div>
          <div className="page-eyebrow">Manufacturing · Runcorn plant</div>
          <h1 className="page-title">{I.cpu}<span>Vessel Planning</span></h1>
          <p className="page-sub">
            Live vessel availability, material-vessel affinity, and constrained released order queue.
            Vessel states are derived from the latest equipment history event — no manual updates required.
          </p>
        </div>
      </div>

      <AnalyticsFilterBar
        filters={filters}
        onChange={setFilters}
        materials={materials}
        showMaterial={false}
      />

      <div className="pa-page-body">

        {/* KPI strip */}
        <VpKpiStrip kpis={state.data?.kpis ?? null} loading={state.loading} />

        {/* Error state */}
        {state.error && (
          <div className="vp-error-banner">
            {I.warning}<span>Could not load vessel planning data: {state.error}</span>
          </div>
        )}

        {/* Tab bar */}
        <div className="vp-tabs">
          <button
            className={`vp-tab ${activeTab === 'board' ? 'active' : ''}`}
            onClick={() => setActiveTab('board')}
          >
            {I.cpu}<span>Planning board</span>
            {state.data && <span className="vp-tab-count">{state.data.vessels.length}</span>}
          </button>
          <button
            className={`vp-tab ${activeTab === 'queue' ? 'active' : ''}`}
            onClick={() => setActiveTab('queue')}
          >
            {I.flag}<span>Priority queue</span>
            {state.data && (
              <span className={`vp-tab-count ${state.data.kpis.constrained_po_count > 0 ? 'warn' : ''}`}>
                {state.data.released_orders.length}
              </span>
            )}
          </button>
          <button
            className={`vp-tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            {I.history}<span>Event history</span>
            {state.data && <span className="vp-tab-count">{state.data.equipment_events.length.toLocaleString()}</span>}
          </button>
        </div>

        {/* Planning board */}
        {activeTab === 'board' && (
          <section className="vp-section">
            <div className="vp-section-controls">
              <div className="vp-section-head">
                <div className="cp-eyebrow">Vessel state board</div>
                <h2>Live vessel availability</h2>
              </div>
              <div className="vp-filters">
                <select
                  className="vp-select"
                  value={stateFilter}
                  onChange={e => setStateFilter(e.target.value)}
                >
                  <option value="ALL">All states</option>
                  <option value="IN_USE">In use</option>
                  <option value="DIRTY">Dirty</option>
                  <option value="AVAILABLE">Available</option>
                  <option value="UNKNOWN">Unknown</option>
                </select>
                <input
                  className="vp-search"
                  placeholder="Search vessel, PO or material…"
                  value={vesselSearch}
                  onChange={e => setVesselSearch(e.target.value)}
                />
              </div>
            </div>

            {state.loading
              ? <div className="vp-loading">Loading vessel states…</div>
              : <PlanningBoard
                  vessels={state.data?.vessels ?? []}
                  stateFilter={stateFilter}
                  searchQuery={vesselSearch}
                />
            }
          </section>
        )}

        {/* Priority queue */}
        {activeTab === 'queue' && (
          <section className="vp-section">
            <div className="vp-section-controls">
              <div className="vp-section-head">
                <div className="cp-eyebrow">Released order priority</div>
                <h2>Vessel assignment queue</h2>
              </div>
            </div>

            {state.loading
              ? <div className="vp-loading">Loading released orders…</div>
              : <PriorityQueue
                  orders={state.data?.released_orders ?? []}
                  materialFilter={filters.material}
                />
            }
          </section>
        )}

        {/* Event history */}
        {activeTab === 'history' && (
          <section className="vp-section">
            <div className="vp-section-controls">
              <div className="vp-section-head">
                <div className="cp-eyebrow">Equipment event log</div>
                <h2>Raw history — {filters.dateFrom} to {filters.dateTo}</h2>
              </div>
              <div className="vp-filters">
                <select
                  className="vp-select"
                  value={stateFilter === 'ALL' ? 'ALL' : stateFilter}
                  onChange={e => setStateFilter(e.target.value)}
                >
                  <option value="ALL">All vessels</option>
                  {vesselIds.map(id => <option key={id} value={id}>{id}</option>)}
                </select>
              </div>
            </div>

            {state.loading
              ? <div className="vp-loading">Loading equipment events…</div>
              : <EquipmentHistory
                  events={state.data?.equipment_events ?? []}
                  vesselFilter={stateFilter}
                />
            }
          </section>
        )}

        {/* Activity trend */}
        {state.data && !state.loading && (
          <section className="vp-section vp-trend-section">
            <ActivityTrendChart data={state.data.daily30d} />
          </section>
        )}

        {/* Heuristic disclaimer */}
        <div className="vp-disclaimer">
          {I.alert}
          <span>
            Vessel states are heuristic — derived from keyword matching on STATUS_TO values.
            Material-vessel affinity is inferred from historical co-occurrence, not from a vessel assignment master.
            Low-confidence recommendations should be verified before use.
          </span>
        </div>

      </div>
    </div>
  )
}
