// @ts-nocheck
import { useEffect } from 'react'
import { useState } from 'react'
import { I, TopBar } from '../ui'
import {
  fetchEquipmentInsights,
  type EquipmentInsightsData,
  type EquipmentTypeEntry,
} from '../api/equipment_insights'

// ---------------------------------------------------------------------------
// Type distribution breakdown
// ---------------------------------------------------------------------------

function TypeDistribution({ rows, total }: { rows: EquipmentTypeEntry[]; total: number }) {
  const max = Math.max(1, ...rows.map(r => r.count))
  return (
    <div className="pour-analytics">
      <div className="pa-head">
        <div className="pa-title">
          {I.cpu}
          <span>Instrument type distribution</span>
          <span className="pa-meta">{total.toLocaleString()} instruments</span>
        </div>
      </div>
      <div className="pa-bars">
        <div className="pa-bars-head">
          <div>Equipment type</div>
          <div className="right">Count</div>
          <div></div>
          <div className="right">Share</div>
        </div>
        {rows.map((row, i) => (
          <div key={row.equipment_type} className="pa-row">
            <div className="pa-row-name">
              <span className="pa-row-rank mono">#{i + 1}</span>
              <span>{row.equipment_type}</span>
            </div>
            <div className="pa-row-count mono">{row.count.toLocaleString()}</div>
            <div className="pa-row-bar">
              <div className="pa-row-fill" style={{ width: `${(row.count / max) * 100}%` }} />
            </div>
            <div className="pa-row-vs mono neut">{row.pct}%</div>
          </div>
        ))}
        {rows.length === 0 && <div className="pa-empty">No instrument data available.</div>}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Scale verification placeholder
// TODO: Replace with real data once a Unity Catalogue consumption view exists
//       for connected_plant_prod.tulip.scale_verification_results.
//       The table cannot be queried directly — UC permissions will crash the app.
//       Steps to enable:
//         1. Create a UC consumption view, e.g.:
//            connected_plant_prod.csm_equipment_history.vw_scale_verification
//         2. Add the view to entities.yaml (change tier from RESTRICTED to APPROVED)
//         3. Add instrument_tbl('vw_scale_verification') query to equipment_insights_dal.py
//         4. Remove this placeholder and render the real data.
// ---------------------------------------------------------------------------

function ScaleVerificationPlaceholder() {
  return (
    <div className="pour-analytics">
      <div className="pa-head">
        <div className="pa-title">
          {I.flask}
          <span>Scale verification</span>
          <span className="pa-meta" style={{ color: 'var(--amber, #92400e)', background: 'var(--amber-faint, #fef3c7)', borderRadius: 4, padding: '1px 6px', fontWeight: 600 }}>
            Pending data access
          </span>
        </div>
      </div>
      <div style={{ padding: '20px 16px', display: 'flex', gap: 10, alignItems: 'flex-start', color: 'var(--ink-400)' }}>
        <span style={{ flexShrink: 0, marginTop: 1 }}>{I.warning}</span>
        <div style={{ fontSize: 13, lineHeight: 1.55 }}>
          <div style={{ fontWeight: 600, color: 'var(--ink-700)', marginBottom: 3 }}>Scale calibration data unavailable</div>
          Scale verification results from Tulip require a Unity Catalogue consumption view
          before they can be queried. Once created, this card will show pass/fail status
          and verification history per scale.
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page root
// ---------------------------------------------------------------------------

export function EquipmentInsightsPage() {
  const [data, setData] = useState<EquipmentInsightsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchEquipmentInsights()
      .then(d => { if (!cancelled) { setData(d); setLoading(false) } })
      .catch(e => { if (!cancelled) { setError(String(e)); setLoading(false) } })
    return () => { cancelled = true }
  }, [])

  const uncategorised = data?.type_distribution.find(r => r.equipment_type === 'Uncategorised')

  return (
    <>
      <TopBar trail={['Insights', 'Equipment insights']} />

      <div className="page-head">
        <div>
          <div className="page-eyebrow">{I.cpu}<span>Insights</span></div>
          <h1 className="page-title">Equipment insights</h1>
          <p className="page-sub">
            Instrument master distribution by equipment type. Excludes scale verification
            data pending Unity Catalogue access.
          </p>
        </div>
      </div>

      {loading && (
        <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--ink-400)' }}>
          Loading equipment data…
        </div>
      )}

      {!loading && error && (
        <div className="page-error">Failed to load equipment insights: {error}</div>
      )}

      {!loading && !error && data && (
        <div className="pa-page-body">
          <div className="pour-grid">
            <div className="pour-kpi tone-actual">
              <div className="pk-l">{I.cpu}<span>Total instruments</span></div>
              <div className="pk-v mono">{data.total_instrument_count.toLocaleString()}</div>
              <div className="pk-sub">in instrument master</div>
            </div>
            <div className="pour-kpi tone-planned">
              <div className="pk-l">{I.layers}<span>Equipment types</span></div>
              <div className="pk-v mono">{data.type_distribution.filter(r => r.equipment_type !== 'Uncategorised').length}</div>
              <div className="pk-sub">distinct categories</div>
            </div>
            {uncategorised && (
              <div className="pour-kpi tone-target">
                <div className="pk-l">{I.warning}<span>Uncategorised</span></div>
                <div className="pk-v mono">{uncategorised.count.toLocaleString()}</div>
                <div className="pk-sub">type not yet in gold view</div>
              </div>
            )}
          </div>

          <TypeDistribution rows={data.type_distribution} total={data.total_instrument_count} />

          <ScaleVerificationPlaceholder />
        </div>
      )}
    </>
  )
}
