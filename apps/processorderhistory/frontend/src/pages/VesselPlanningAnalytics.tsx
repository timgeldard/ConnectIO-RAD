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

function VesselStateBadge({ state, reason }: { state: VesselState; reason?: string | null }) {
  return <span className={`vp-state-badge ${state.toLowerCase().replace('_', '-')}`} title={reason ?? undefined}>{STATE_LABELS[state]}</span>
}

function ConstraintBadge({ type }: { type: string | null }) {
  if (!type) return <span className="vp-constraint-badge feasible">Feasible</span>
  return <span className={`vp-constraint-badge ${type.replace('_', '-')}`}>{CONSTRAINT_LABELS[type] ?? type}</span>
}

function ConfidenceDot({ level }: { level: string }) {
  return <span className={`vp-confidence ${level}`} title={`Heuristic confidence: ${CONFIDENCE_LABELS[level] ?? level}`}>{CONFIDENCE_LABELS[level] ?? level}</span>
}

function EvidenceSummary({ order }: { order: import('../api/vessel_planning').ReleasedOrder }) {
  const { evidence_affinity_count, evidence_candidate_vessel_count, evidence_last_seen_at_ms, evidence_source, evidence_notes } = order
  const lastSeenLabel = evidence_last_seen_at_ms ? fmt.shortDate(evidence_last_seen_at_ms) : null
  const primary = evidence_source === 'no_affinity_data'
    ? 'no affinity data'
    : evidence_affinity_count > 0
      ? `${evidence_affinity_count} prior use${evidence_affinity_count !== 1 ? 's' : ''}`
      : `${evidence_candidate_vessel_count} candidate${evidence_candidate_vessel_count !== 1 ? 's' : ''}`
  const secondary = lastSeenLabel ? `last seen ${lastSeenLabel}` : null
  const capacityNote = evidence_notes.find(n => n.includes('capacity'))
  return (
    <div className="vp-evidence">
      <span className="vp-evidence-primary">{primary}{secondary ? ` · ${secondary}` : ''}</span>
      {capacityNote && <span className="vp-evidence-note">{capacityNote}</span>}
    </div>
  )
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
              <td><VesselStateBadge state={v.state} reason={v.state_reason} /></td>
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
                  ? (
                    <div>
                      <span className={`vp-action priority-${v.action_priority ?? 3}`}>{v.recommended_action}</span>
                      {v.action_reason && <div className="vp-action-reason">{v.action_reason}</div>}
                    </div>
                  )
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
            <th>Status</th>
            <th>Likely vessels</th>
            <th>Evidence</th>
            <th>Action</th>
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
                <div className="vp-status-cell">
                  <ConstraintBadge type={o.constraint_type} />
                  <ConfidenceDot level={o.heuristic_confidence} />
                </div>
              </td>
              <td className="mono vp-vessels-cell">
                {o.likely_vessels.length > 0
                  ? o.likely_vessels.slice(0, 3).join(', ')
                  : <span className="vp-no-affinity">None on record</span>
                }
              </td>
              <td><EvidenceSummary order={o} /></td>
              <td className="vp-cell-action">
                {o.recommendation
                  ? <span className={o.feasible ? 'vp-rec-feasible' : 'vp-rec-constrained'}>{o.recommendation}</span>
                  : '—'
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
  const [activeTab, setActiveTab] = useState<'board' | 'queue'>('board')

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

  return (
    <div className="vp-page">
      <TopBar trail={['Operate', 'Vessel planning']} />

      <div className="page-head">
        <div>
          <div className="page-eyebrow">Operate · Runcorn plant</div>
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
