import { useEffect, useState } from 'react'
import { useSPCDispatch } from '../SPCContext'
import type { IndexedChartPoint, SPCSignal } from '../types'

const PAGE_SIZES = [10, 25, 50]
const DEFAULT_PAGE_SIZE = 10

const WECO_RULES = {
  desc: {
    1: 'One point beyond the 3σ control limit',
    2: '2 of 3 consecutive points beyond the 2σ limit (same side)',
    3: '4 of 5 consecutive points beyond the 1σ limit (same side)',
    4: '8 consecutive points on the same side of the centre line',
  },
  severity: { 1: 'critical', 2: 'warning', 3: 'warning', 4: 'warning' },
} as const

const NELSON_RULES = {
  desc: {
    1: 'One point beyond the 3σ control limit',
    2: '9 consecutive points on the same side of the centre line',
    3: '6 consecutive points monotonically increasing or decreasing',
    4: '14 consecutive points alternating up/down',
    5: '2 of 3 consecutive points beyond the 2σ limit (same side)',
    6: '4 of 5 consecutive points beyond the 1σ limit (same side)',
    7: '15 consecutive points within Zone C (hugging centre line)',
    8: '8 consecutive points outside Zone C on both sides (mixture)',
  },
  severity: { 1: 'critical', 2: 'warning', 3: 'warning', 4: 'info', 5: 'warning', 6: 'warning', 7: 'info', 8: 'info' },
} as const

const SEVERITY_STYLE = {
  critical: { dot: 'var(--status-risk)', label: 'var(--status-risk)', bg: 'var(--status-risk-bg)', border: 'var(--status-risk)' },
  warning:  { dot: 'var(--status-warn)', label: 'var(--status-warn)', bg: 'var(--status-warn-bg)', border: 'var(--status-warn)' },
  info:     { dot: 'var(--status-info)', label: 'var(--status-info)', bg: 'var(--status-info-bg)', border: 'var(--status-info)' },
} as const

type SeverityKey = keyof typeof SEVERITY_STYLE

interface TimelineSignal extends SPCSignal {
  chart: 'X' | 'MR'
}

interface SignalsPanelProps {
  signals?: SPCSignal[]
  mrSignals?: SPCSignal[]
  indexedPoints?: IndexedChartPoint[]
  ruleSet?: 'weco' | 'nelson'
}

export default function SignalsPanel({
  signals = [],
  mrSignals = [],
  indexedPoints = [],
  ruleSet = 'weco',
}: SignalsPanelProps) {
  const dispatch = useSPCDispatch()
  const rules = ruleSet === 'nelson' ? NELSON_RULES : WECO_RULES
  const label = ruleSet === 'nelson' ? 'Nelson' : 'WECO'

  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  const allSignals: TimelineSignal[] = [
    ...signals.map(s => ({ ...s, chart: 'X' as const })),
    ...mrSignals.map(s => ({ ...s, chart: 'MR' as const })),
  ]

  useEffect(() => {
    setPage(1)
  }, [allSignals.length, ruleSet])

  const totalPages = Math.ceil(allSignals.length / pageSize)
  const pageSignals = allSignals.slice((page - 1) * pageSize, page * pageSize)

  if (allSignals.length === 0) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="card"
        style={{
          padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--status-ok-bg)', borderColor: 'var(--status-ok)',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--status-ok)' }}>
          No {label} rule violations detected
        </span>
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: '14px 16px' }} aria-label={`${label} signal queue`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Header */}
        <div>
          <div className="eyebrow">Signal queue</div>
          <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, color: 'var(--text-1)' }}>
            {label} Signals
            <span className="chip" style={{ fontSize: 11 }}>
              {allSignals.length} signal{allSignals.length !== 1 ? 's' : ''}
            </span>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-3)' }}>
            Signals are ordered evidence of instability. Resolve assignable causes before trusting capability.
          </p>
        </div>

        {/* Timeline */}
        <div style={{ position: 'relative', marginLeft: 8 }}>
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: 7, width: 1, background: 'var(--line-1)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pageSignals.map((signal, index) => {
              const absIndex = (page - 1) * pageSize + index
              const severity = (rules.severity[signal.rule as keyof typeof rules.severity] ?? 'info') as SeverityKey
              const style = SEVERITY_STYLE[severity] ?? SEVERITY_STYLE.info
              const batchIds = signal.indices
                .map(idx => indexedPoints[idx]?.batch_id)
                .filter((v): v is string => Boolean(v))
                .filter((v, i, all) => all.indexOf(v) === i)
                .slice(0, 3)

              return (
                <div key={`${signal.chart}-${signal.rule}-${absIndex}`} style={{ position: 'relative', paddingLeft: 24 }}>
                  <div
                    style={{
                      position: 'absolute', left: 0, top: 6,
                      height: 14, width: 14, borderRadius: '999px',
                      border: '2px solid var(--surface-1)',
                      background: style.dot,
                      boxShadow: `0 0 0 2px ${style.dot}40`,
                    }}
                  />
                  <div
                    style={{
                      borderRadius: 6, padding: '8px 12px', fontSize: 12,
                      background: style.bg, border: `1px solid ${style.border}`,
                    }}
                  >
                    <div style={{ marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: style.label }}>Rule {signal.rule}</span>
                      <span style={{ borderRadius: 4, padding: '1px 5px', fontSize: 11, fontWeight: 500, background: 'rgba(0,0,0,0.06)', color: style.label }}>
                        {signal.chart} chart
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: 11, lineHeight: 1.4, color: 'var(--text-2)' }}>
                      {rules.desc[signal.rule as keyof typeof rules.desc] ?? signal.description}
                    </p>
                    {batchIds.length > 0 && (
                      <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--text-3)' }}>
                        Batches: {batchIds.join(', ')}
                        {signal.indices.length > 3 ? ` +${signal.indices.length - 3} more` : ''}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button className="btn btn-ghost btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</button>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{page} / {totalPages}</span>
              <button className="btn btn-ghost btn-sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</button>
            </div>
            <select
              className="field"
              style={{ width: 'auto', height: 26, fontSize: 12, padding: '0 6px' }}
              value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value)); setPage(1) }}
            >
              {PAGE_SIZES.map(s => <option key={s} value={s}>{s} / page</option>)}
            </select>
          </div>
        )}

        {/* Investigate */}
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: 'correlation' })}
          title="Investigate whether correlated characteristics may share assignable causes"
        >
          Investigate Correlations
        </button>

      </div>
    </div>
  )
}
