import type { ReactNode } from 'react'
import type { StatusPillStatus } from './StatusPill'
import StatusPill from './StatusPill'

interface KPI {
  label: string
  value: ReactNode
}

interface StickyInsightHeaderProps {
  contextLine?: string
  status?: StatusPillStatus
  statusReason?: string
  kpis?: KPI[]
  actions?: ReactNode
}

export default function StickyInsightHeader({
  contextLine,
  status,
  statusReason,
  kpis = [],
  actions,
}: StickyInsightHeaderProps) {
  return (
    <div style={{
      background: 'var(--surface-1)',
      border: '1px solid var(--line-1)',
      borderRadius: 10,
      padding: '1rem 1.25rem',
    }}>
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '0.75rem',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
          {contextLine && (
            <p style={{
              margin: 0,
              fontSize: '0.7rem',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--text-3)',
            }}>
              {contextLine}
            </p>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
            {status ? (
              <StatusPill status={status} />
            ) : (
              <span className="chip">No scope selected</span>
            )}
            {statusReason && (
              <span style={{ fontSize: '0.875rem', color: 'var(--text-3)' }}>{statusReason}</span>
            )}
          </div>
          {kpis.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
              {kpis.slice(0, 3).map((kpi) => (
                <div key={kpi.label} style={{ display: 'flex', alignItems: 'baseline', gap: '0.375rem' }}>
                  <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-1)' }}>{kpi.value}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{kpi.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {actions && (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}
