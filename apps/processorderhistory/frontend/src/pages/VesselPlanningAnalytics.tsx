import { useEffect, useMemo, useState } from 'react'
import { TopBar, Icon, KPI, Button } from '@connectio/shared-ui'
import { useT } from '../i18n/context'
import {
  AnalyticsFilterBar,
  useAnalyticsFilters,
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

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function VesselStateBadge({ state, reason }: { state: VesselState; reason?: string | null }) {
  const colorMap: Record<VesselState, string> = {
    IN_USE: 'var(--status-ok)',
    DIRTY: 'var(--status-warn)',
    AVAILABLE: 'var(--brand)',
    UNKNOWN: 'var(--line-1)',
  }
  return (
    <span style={{ 
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
      background: 'var(--surface-sunken)', borderLeft: `4px solid ${colorMap[state]}`, color: 'var(--text-1)'
    }} title={reason ?? undefined}>
      {STATE_LABELS[state]}
    </span>
  )
}

function ConstraintBadge({ type }: { type: string | null }) {
  if (!type) return (
    <span style={{ 
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
      background: 'var(--status-ok-surface)', color: 'var(--status-ok)', textTransform: 'uppercase'
    }}>Feasible</span>
  )
  return (
    <span style={{ 
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
      background: 'var(--status-risk-surface)', color: 'var(--status-risk)', textTransform: 'uppercase'
    }}>{CONSTRAINT_LABELS[type] ?? type}</span>
  )
}

// ---------------------------------------------------------------------------
// Page root
// ---------------------------------------------------------------------------

export function VesselPlanningAnalyticsPage() {
  const { t } = useT()
  const { filters, setFilters } = useAnalyticsFilters()
  const [data, setData] = useState<VesselPlanningData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchVesselPlanningAnalytics({ plantId: filters.plantId === 'ALL' ? undefined : filters.plantId })
      .then(d => { if (!cancelled) { setData(d); setLoading(false) } })
      .catch(e => { if (!cancelled) { setError(String(e)); setLoading(false) } })
    return () => { cancelled = true }
  }, [filters.plantId])

  const feasibleCount = useMemo(() => 
    data?.released_orders.filter(o => !o.constraint_type).length ?? 0,
  [data])

  const dirtyCount = useMemo(() => 
    data?.vessels.filter(v => v.state === 'DIRTY').length ?? 0,
  [data])

  if (loading) {
    return (
      <div className="app-shell-full">
        <TopBar breadcrumbs={[{ label: t.operations }, { label: 'Insights' }, { label: 'Vessel planning' }]} />
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)' }}>Loading vessel planning data…</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="app-shell-full">
        <TopBar breadcrumbs={[{ label: t.operations }, { label: 'Insights' }, { label: 'Vessel planning' }]} />
        <div style={{ padding: 48, textAlign: 'center', color: 'var(--status-risk)' }}>{error || 'No data available.'}</div>
      </div>
    )
  }

  return (
    <div className="app-shell-full">
      <TopBar breadcrumbs={[{ label: t.operations }, { label: 'Insights' }, { label: 'Vessel planning' }]} />

      <div className="page-head" style={{ padding: '24px 32px', background: 'var(--surface-0)', borderBottom: '1px solid var(--line-1)' }}>
        <div>
          <div className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Icon name="target" size={14} />
            <span>Insights</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 4px', color: 'var(--text-1)' }}>Vessel planning</h1>
          <p style={{ fontSize: 13, color: 'var(--text-3)' }}>
            Match released process orders to available vessels. Identify cleaning constraints
            and affinity gaps before they hit the floor.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 32 }}>
          <KPI label="Released orders" value={data.released_orders.length} icon="layers" />
          <KPI label="Feasible" value={feasibleCount} unit={`${Math.round(feasibleCount / (data.released_orders.length || 1) * 100)}%`} icon="check" tone="ok" />
          <KPI label="Total vessels" value={data.vessels.length} icon="database" />
          <KPI label="Dirty vessels" value={dirtyCount} icon="alert-triangle" tone={dirtyCount > 0 ? 'warn' : 'ok'} />
        </div>
      </div>

      <AnalyticsFilterBar filters={filters} onChange={setFilters} showMaterial={false} />

      <div style={{ padding: '32px 32px 48px', display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 32 }}>
        {/* Released Orders List */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <Icon name="package" size={18} />
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Released orders</h2>
            <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Awaiting vessel assignment</span>
          </div>
          <div style={{ background: 'var(--surface-1)', border: '1px solid var(--line-1)', borderRadius: 8, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: 'var(--surface-sunken)', borderBottom: '1px solid var(--line-1)' }}>
                <tr>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Process Order</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Material</th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Constraint</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Planned Start</th>
                </tr>
              </thead>
              <tbody>
                {data.released_orders.map(o => (
                  <tr key={o.po_id} style={{ borderBottom: '1px solid var(--line-1)' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <button 
                        className="btn btn-link" 
                        style={{ padding: 0, height: 'auto', fontFamily: 'var(--font-mono)', fontWeight: 600 }}
                        onClick={() => (window as any).__navigateToOrder?.(o.po_id, { label: o.material_name, _from: 'vessel-planning' })}
                      >{o.po_id}</button>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{o.material_name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{o.material_id}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <ConstraintBadge type={o.constraint_type} />
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                      {o.scheduled_start_ms ? (
                        <>
                          {new Date(o.scheduled_start_ms).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}<br/>
                          {new Date(o.scheduled_start_ms).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Vessels List */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <Icon name="database" size={18} />
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Vessel status</h2>
            <span style={{ fontSize: 13, color: 'var(--text-3)' }}>Real-time inventory</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {data.vessels.map(v => (
              <div key={v.instrument_id} style={{ background: 'var(--surface-1)', border: '1px solid var(--line-1)', borderRadius: 8, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-1)' }}>{v.instrument_id}</div>
                    <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>{v.equipment_type || '—'}</div>
                  </div>
                  <VesselStateBadge state={v.state as VesselState} reason={v.state_reason} />
                </div>
                {v.current_material_name && (
                  <div style={{ fontSize: 12, color: 'var(--text-2)', padding: '8px 12px', background: 'var(--surface-sunken)', borderRadius: 6 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', marginBottom: 4 }}>Contains / Last Material</div>
                    <div style={{ fontWeight: 600 }}>{v.current_material_name}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', opacity: 0.7 }}>{v.current_material_id}</div>
                  </div>
                )}
                <div style={{ marginTop: 12, display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-3)' }}>
                  <span>State since: <strong>{v.state_since_ms ? new Date(v.state_since_ms).toLocaleTimeString() : '—'}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
