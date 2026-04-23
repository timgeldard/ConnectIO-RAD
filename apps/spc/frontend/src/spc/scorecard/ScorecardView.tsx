import { Suspense, lazy, useCallback, useEffect, useState } from 'react'
import '../charts/ensureEChartsTheme'
import { shallowEqual, useSPCDispatch, useSPCSelector } from '../SPCContext'
import { useSPCScorecard } from '../hooks/useSPCScorecard'
import KPICard from '../overview/KPICard'

const ScorecardTable = lazy(() => import('./ScorecardTable'))

function ScorecardSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          style={{
            height: 48,
            borderRadius: 6,
            background: 'var(--surface-2)',
            opacity: 1 - i * 0.08,
            animation: 'fadeIn 400ms ease both',
            animationDelay: `${i * 40}ms`,
          }}
        />
      ))}
    </div>
  )
}

export default function ScorecardView() {
  const dispatch = useSPCDispatch()
  const state = useSPCSelector(
    current => ({
      roleMode: current.roleMode,
      selectedMaterial: current.selectedMaterial,
      selectedPlant: current.selectedPlant,
      selectedMIC: current.selectedMIC,
      exclusionAudit: current.exclusionAudit,
      dateFrom: current.dateFrom,
      dateTo: current.dateTo,
    }),
    shallowEqual,
  )

  const { scorecard, loading, error } = useSPCScorecard(
    state.selectedMaterial?.material_id,
    state.dateFrom,
    state.dateTo,
    state.selectedPlant?.plant_id,
  )

  // ── Empty / loading / error guards ─────────────────────────────────────────

  if (!state.selectedMaterial) {
    return (
      <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>▦</div>
        <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-2)', marginBottom: 6 }}>No material selected</div>
        <div>Select a material above to view the SPC scorecard with Cpk for all characteristics.</div>
      </div>
    )
  }

  if (loading) {
    return (
      <div style={{ padding: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ height: 100, borderRadius: 10, background: 'var(--surface-2)' }} />
          ))}
        </div>
        <ScorecardSkeleton />
      </div>
    )
  }

  if (error) {
    return (
      <div style={{
        margin: 20, padding: '14px 18px', borderRadius: 10,
        background: 'var(--status-risk-bg)', border: '1px solid var(--status-risk)',
        color: 'var(--status-risk)', fontSize: 13,
      }}>
        <strong>Failed to load scorecard</strong> — {String(error)}
      </div>
    )
  }

  if (!scorecard.length) {
    return (
      <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
        <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text-2)', marginBottom: 6 }}>No scorecard data</div>
        <div>No data found for {state.selectedMaterial.material_name ?? state.selectedMaterial.material_id}. At least 3 batches with quantitative results are required.</div>
      </div>
    )
  }

  // ── KPI derivations ────────────────────────────────────────────────────────

  const capable   = scorecard.filter(r => (r.cpk ?? 0) >= 1.33).length
  const marginal  = scorecard.filter(r => { const c = r.cpk ?? 99; return c >= 1 && c < 1.33 }).length
  const withSignals = scorecard.filter(r => (r.ooc_rate ?? 0) > 0).length

  const materialLabel = state.selectedMaterial.material_name ?? state.selectedMaterial.material_id

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }} className="fade-in">
      {/* KPI row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        <KPICard
          label="Characteristics"
          value={scorecard.length}
          unit="monitored"
          tone="neutral"
          icon="beaker"
          delta="All active"
        />
        <KPICard
          label="Capable"
          value={capable}
          unit={`of ${scorecard.length}`}
          tone="ok"
          icon="check-circle"
          delta="Cpk ≥ 1.33"
        />
        <KPICard
          label="Marginal"
          value={marginal}
          tone="warn"
          icon="alert-triangle"
          delta="1.00 ≤ Cpk < 1.33"
        />
        <KPICard
          label="Signals open"
          value={withSignals}
          tone={withSignals > 0 ? 'risk' : 'ok'}
          icon="flag"
          delta={withSignals > 0 ? 'MICs with OOC' : 'All clear'}
        />
      </div>

      {/* Scorecard table */}
      <Suspense fallback={<ScorecardSkeleton />}>
        <ScorecardTable rows={scorecard} material={materialLabel} />
      </Suspense>
    </div>
  )
}
