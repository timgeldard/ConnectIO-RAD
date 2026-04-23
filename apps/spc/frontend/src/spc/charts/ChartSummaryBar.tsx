import type { ReactNode } from 'react'
import type { NormalityResult } from '../types'

type StatusTone = 'slate' | 'amber' | 'green' | 'blue'
type SummaryTone = 'slate' | 'green' | 'amber' | 'red'

interface SummaryMetricProps {
  label: string
  value: string
  meta: string
  tone?: SummaryTone
}

export function StatusChip({ children, tone = 'slate' }: { children: ReactNode; tone?: StatusTone }) {
  const cls = tone === 'green' ? 'chip chip-ok'
    : tone === 'amber' ? 'chip chip-warn'
    : tone === 'blue'  ? 'chip chip-slate'
    : 'chip'
  return <span className={cls} style={{ fontSize: 11 }}>{children}</span>
}

export function SummaryMetric({ label, value, meta, tone = 'slate' }: SummaryMetricProps) {
  const style = tone === 'green'
    ? { border: '1px solid var(--status-ok)',   background: 'var(--status-ok-bg)'   }
    : tone === 'amber'
    ? { border: '1px solid var(--status-warn)', background: 'var(--status-warn-bg)' }
    : tone === 'red'
    ? { border: '1px solid var(--status-risk)', background: 'var(--status-risk-bg)' }
    : { border: '1px solid var(--line-1)',      background: 'var(--surface-2)'      }

  return (
    <div style={{ ...style, padding: '10px 14px', borderRadius: 8 }}>
      <div className="eyebrow" style={{ marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-1)', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4, lineHeight: 1.4 }}>{meta}</div>
    </div>
  )
}

interface ChartSummaryBarProps {
  title: string
  materialName: string
  inspectionMethod?: string | null
  chartFamilyLabel: string
  totalSignals: number
  exclusionCount: number
  capabilityHeadline: number | null
  capabilityHeadlineLabel?: 'Cpk' | 'Ppk' | 'Capability' | null
  stratifyLabel?: string | null
  quantNormality?: NormalityResult | null
  ruleSet: 'weco' | 'nelson'
  actionRail?: ReactNode
  lockedLimits?: { locked_at?: string | null; locked_by?: string | null } | null
  limitsMode?: 'live' | 'locked'
  limitsSourceLabel?: string | null
  onExclusionClick?: () => void
}

export default function ChartSummaryBar({
  title, materialName, inspectionMethod, chartFamilyLabel,
  totalSignals, exclusionCount,
  capabilityHeadline, capabilityHeadlineLabel,
  stratifyLabel, quantNormality,
  ruleSet, actionRail,
  lockedLimits, limitsMode, limitsSourceLabel,
  onExclusionClick,
}: ChartSummaryBarProps) {
  return (
    <div className="card" style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-1)' }}>{title}</span>
            <span style={{ fontSize: 13, color: 'var(--text-3)' }}>· {materialName}</span>
          </div>
          {inspectionMethod && (
            <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 4 }}>
              Method: {inspectionMethod}
            </div>
          )}
          <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <StatusChip tone="blue">{chartFamilyLabel}</StatusChip>
            <StatusChip tone={totalSignals > 0 ? 'amber' : 'green'}>
              {totalSignals > 0 ? `${totalSignals} active signal${totalSignals === 1 ? '' : 's'}` : 'No active signals'}
            </StatusChip>
            {capabilityHeadline != null && (
              <StatusChip tone={capabilityHeadline >= 1.33 ? 'green' : capabilityHeadline >= 1.0 ? 'amber' : 'slate'}>
                Headline {capabilityHeadlineLabel ?? 'Capability'} {capabilityHeadline.toFixed(2)}
              </StatusChip>
            )}
            {stratifyLabel && <StatusChip tone="blue">Stratified by {stratifyLabel}</StatusChip>}
            {exclusionCount > 0 && (
              onExclusionClick
                ? (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={onExclusionClick}
                    title="Click to view excluded points"
                  >
                    {exclusionCount} audited exclusion{exclusionCount === 1 ? '' : 's'}
                  </button>
                )
                : <StatusChip tone="amber">{exclusionCount} audited exclusion{exclusionCount === 1 ? '' : 's'}</StatusChip>
            )}
            {limitsMode === 'locked' && lockedLimits && (
              <StatusChip tone="blue">
                Limits locked{lockedLimits.locked_at ? ` · ${lockedLimits.locked_at.substring(0, 10)}` : ''}
              </StatusChip>
            )}
            {limitsSourceLabel && !(limitsMode === 'locked' && limitsSourceLabel === 'Locked') && (
              <StatusChip tone={limitsSourceLabel === 'Governed' ? 'green' : limitsSourceLabel === 'Locked' ? 'blue' : 'amber'}>
                Limits: {limitsSourceLabel}
              </StatusChip>
            )}
            {quantNormality?.is_normal === false && (
              <StatusChip tone="amber">Non-normal capability override</StatusChip>
            )}
          </div>
        </div>
        {actionRail && (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {actionRail}
          </div>
        )}
      </div>

      {/* Summary metrics strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
        <SummaryMetric
          label="Signals"
          value={String(totalSignals)}
          meta={totalSignals > 0 ? 'Investigate assignable causes before interpreting capability' : 'No current signal breaches'}
          tone={totalSignals > 0 ? 'amber' : 'green'}
        />
        <SummaryMetric
          label="Excluded points"
          value={String(exclusionCount)}
          meta={exclusionCount > 0 ? 'Persisted with justification and limits snapshot' : 'No active exclusions'}
          tone={exclusionCount > 0 ? 'amber' : 'slate'}
        />
        <SummaryMetric
          label="Rule set"
          value={ruleSet === 'nelson' ? 'Nelson 8' : 'WECO'}
          meta="Signal interpretation stays separate from capability evidence"
        />
        <SummaryMetric
          label="Capability mode"
          value={quantNormality?.is_normal === false ? 'Empirical' : 'Parametric'}
          meta={quantNormality?.is_normal === false ? 'Non-normal percentiles are active' : 'Standard sigma-based capability'}
          tone={quantNormality?.is_normal === false ? 'amber' : 'green'}
        />
      </div>

    </div>
  )
}
