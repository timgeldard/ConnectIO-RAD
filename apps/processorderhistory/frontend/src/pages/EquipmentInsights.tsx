// @ts-nocheck
import { useEffect, useState } from 'react'
import { I, TopBar, fmt } from '../ui'
import {
  fetchEquipmentInsights,
  type EquipmentInsightsData,
  type EquipmentTypeEntry,
} from '../api/equipment_insights'

// ---------------------------------------------------------------------------
// Loading / error helpers
// ---------------------------------------------------------------------------

function LoadingState() {
  return (
    <div style={{ padding: '48px 32px', textAlign: 'center', color: 'var(--muted)' }}>
      Loading equipment data…
    </div>
  )
}

function ErrorState({ message }: { message: string }) {
  return (
    <div style={{ padding: '48px 32px', textAlign: 'center', color: 'var(--danger)' }}>
      {message}
    </div>
  )
}

// ---------------------------------------------------------------------------
// KPI strip
// ---------------------------------------------------------------------------

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{typeof value === 'number' ? fmt.num(value) : value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Type distribution table
// ---------------------------------------------------------------------------

function TypeDistributionTable({ rows }: { rows: EquipmentTypeEntry[] }) {
  if (rows.length === 0) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>
        No instrument data available.
      </div>
    )
  }
  const max = rows[0].count
  return (
    <table className="data-table" style={{ width: '100%' }}>
      <thead>
        <tr>
          <th style={{ width: '40%' }}>Equipment type</th>
          <th style={{ width: '15%', textAlign: 'right' }}>Count</th>
          <th style={{ width: '10%', textAlign: 'right' }}>%</th>
          <th style={{ width: '35%' }}>Distribution</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.equipment_type}>
            <td>{row.equipment_type}</td>
            <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt.num(row.count)}</td>
            <td style={{ textAlign: 'right', color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{row.pct}%</td>
            <td>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div
                  style={{
                    height: 8,
                    borderRadius: 4,
                    background: 'var(--accent)',
                    opacity: 0.7,
                    width: `${Math.round((row.count / max) * 100)}%`,
                    minWidth: 2,
                    flex: 'none',
                  }}
                />
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ---------------------------------------------------------------------------
// Scale verification placeholder
// TODO: Replace this card with real data once a Unity Catalogue consumption
//       view exists for connected_plant_prod.tulip.scale_verification_results.
//       The table cannot be queried directly — UC permissions will crash the app.
//       Steps to enable:
//         1. Create a UC consumption view, e.g.:
//            connected_plant_prod.csm_equipment_history.vw_scale_verification
//         2. Add the view to entities.yaml (change tier from RESTRICTED to APPROVED)
//         3. Add instrument_tbl('vw_scale_verification') query to equipment_insights_dal.py
//         4. Remove this placeholder and render the real data below.
// ---------------------------------------------------------------------------

function ScaleVerificationPlaceholder() {
  return (
    <div
      className="analytics-card"
      style={{ borderStyle: 'dashed', opacity: 0.65 }}
    >
      <div className="card-head">
        <span className="card-title">Scale verification</span>
        <span
          style={{
            fontSize: 11,
            background: 'var(--amber-faint, #fef3c7)',
            color: 'var(--amber, #92400e)',
            borderRadius: 4,
            padding: '2px 6px',
            fontWeight: 600,
            letterSpacing: '0.02em',
          }}
        >
          PENDING DATA ACCESS
        </span>
      </div>
      <div style={{ padding: '24px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <span style={{ color: 'var(--amber, #92400e)', flexShrink: 0, marginTop: 1 }}>
          {I.warning}
        </span>
        <div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            Scale calibration data unavailable
          </div>
          <div style={{ color: 'var(--muted)', fontSize: 13, lineHeight: 1.5 }}>
            Scale verification results from Tulip require a Unity Catalogue consumption view
            before they can be queried. Once created, this card will show pass/fail status
            and verification history per scale.
          </div>
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
    setLoading(true)
    setError(null)
    fetchEquipmentInsights()
      .then(setData)
      .catch((err) => setError(err.message ?? 'Failed to load equipment data'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="page">
      <TopBar trail={['Insights', 'Equipment insights']} />

      <div className="page-head">
        <div className="page-eyebrow">Insights · Runcorn plant</div>
        <h1 className="page-title">Equipment insights</h1>
        <p className="page-sub">
          Instrument master distribution by equipment type. Excludes single-use vessels.
        </p>
      </div>

      {/* KPI strip */}
      <div className="kpi-strip">
        <KpiCard
          label="Total instruments"
          value={data ? data.total_instrument_count : '—'}
          sub="excl. single-use"
        />
        <KpiCard
          label="Equipment types"
          value={data ? data.type_distribution.length : '—'}
          sub="distinct categories"
        />
      </div>

      {loading && <LoadingState />}
      {!loading && error && <ErrorState message={error} />}

      {!loading && !error && data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Type distribution */}
          <div className="analytics-card">
            <div className="card-head">
              <span className="card-title">Instrument type distribution</span>
              <span style={{ color: 'var(--muted)', fontSize: 13 }}>
                {fmt.num(data.total_instrument_count)} instruments
              </span>
            </div>
            <TypeDistributionTable rows={data.type_distribution} />
          </div>

          {/* Scale verification placeholder */}
          <ScaleVerificationPlaceholder />
        </div>
      )}
    </div>
  )
}
