import type { ReactNode } from 'react'

import type { SPCComputationResult } from '../types'
import { StatusChip, SummaryMetric } from './ChartSummaryBar'

export interface StratumSection {
  label: string
  pointCount: number
  spc: SPCComputationResult | null
}

function getCapabilityHeadline(spc: SPCComputationResult | null): { label: 'Cpk' | 'Ppk'; value: number } | null {
  const cpk = spc?.capability?.cpk
  if (cpk != null) return { label: 'Cpk', value: cpk }
  const ppk = spc?.capability?.ppk
  if (ppk != null) return { label: 'Ppk', value: ppk }
  return null
}

interface StratificationPanelProps {
  micLabel: string
  stratifyBy: string
  sections: StratumSection[]
  renderChart: (spc: SPCComputationResult) => ReactNode
  renderSignals: (spc: SPCComputationResult) => ReactNode
  renderCapability: (spc: SPCComputationResult) => ReactNode
}

export default function StratificationPanel({
  micLabel,
  stratifyBy,
  sections,
  renderChart,
  renderSignals,
  renderCapability,
}: StratificationPanelProps) {
  if (sections.length <= 1) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {sections.map(section => {
        const stratumSignalCount = (section.spc?.signals?.length ?? 0) + (section.spc?.mrSignals?.length ?? 0)
        const stratumCapabilityHeadline = getCapabilityHeadline(section.spc)

        return (
          <div
            key={section.label}
            role="region"
            aria-label={`Stratum analysis for ${section.label}`}
            style={{
              background: 'var(--surface-1)',
              border: '1px solid var(--line-1)',
              borderRadius: 10,
              padding: '1.25rem',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap', paddingBottom: '0.75rem', borderBottom: '1px solid var(--line-1)' }}>
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-1)' }}>
                    {micLabel} · {section.label}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
                    Stratified by {stratifyBy.replace(/_/g, ' ')} · {section.pointCount} point{section.pointCount !== 1 ? 's' : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <StatusChip tone={stratumSignalCount > 0 ? 'amber' : 'green'}>
                    {stratumSignalCount > 0 ? `${stratumSignalCount} signal${stratumSignalCount === 1 ? '' : 's'}` : 'No active signals'}
                  </StatusChip>
                  {stratumCapabilityHeadline != null && (
                    <StatusChip tone={stratumCapabilityHeadline.value >= 1.33 ? 'green' : stratumCapabilityHeadline.value >= 1.0 ? 'amber' : 'slate'}>
                      Headline {stratumCapabilityHeadline.label} {stratumCapabilityHeadline.value.toFixed(2)}
                    </StatusChip>
                  )}
                </div>
              </div>

              <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <SummaryMetric
                  label="Points"
                  value={String(section.pointCount)}
                  meta="Data included after the current exclusion and outlier rules"
                  tone="slate"
                />
                <SummaryMetric
                  label="Signals"
                  value={String(stratumSignalCount)}
                  meta={stratumSignalCount > 0 ? 'Assignable-cause review still required' : 'No active rule breaches'}
                  tone={stratumSignalCount > 0 ? 'amber' : 'green'}
                />
                <SummaryMetric
                  label="Capability"
                  value={stratumCapabilityHeadline != null ? stratumCapabilityHeadline.value.toFixed(2) : '—'}
                  meta={section.spc?.capability?.capabilityMethod === 'non_parametric' ? 'Empirical percentile method active' : 'Short-term and long-term evidence available'}
                  tone={stratumCapabilityHeadline == null ? 'slate' : stratumCapabilityHeadline.value >= 1.33 ? 'green' : stratumCapabilityHeadline.value >= 1.0 ? 'amber' : 'red'}
                />
              </div>

              {section.spc && (
                <>
                  <div style={{ border: '1px solid var(--line-1)', background: 'var(--surface-1)', borderRadius: 8, padding: '1rem' }}>{renderChart(section.spc)}</div>
                  <div style={{ marginTop: '1.25rem', display: 'grid', gap: '1rem' }}>
                    {renderSignals(section.spc)}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>{renderCapability(section.spc)}</div>
                  </div>
                </>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
