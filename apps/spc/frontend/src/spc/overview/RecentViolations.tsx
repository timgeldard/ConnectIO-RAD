import { Icon } from '../../components/ui/Icon'
import { useSPCDispatch } from '../SPCContext'
import type { RecentViolationItem } from '../types'

interface RecentViolationsProps {
  hasMaterial: boolean
  violations: RecentViolationItem[]
}

export default function RecentViolations({ hasMaterial, violations }: RecentViolationsProps) {
  const dispatch = useSPCDispatch()

  return (
    <div className="card" style={{ overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid var(--line-1)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 7,
          background: 'var(--status-risk-bg)', color: 'var(--status-risk)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="alert-triangle" size={15} />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-1)' }}>Priority signals</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>Sorted by severity × recency</div>
        </div>
        <button
          className="btn-link"
          style={{ marginLeft: 'auto', fontSize: 12 }}
          onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: 'charts' })}
        >
          View all →
        </button>
      </div>

      {/* Signal rows */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {hasMaterial && violations.length > 0 ? (
          violations.map((v, i) => (
            <button
              key={v.id}
              type="button"
              onClick={() => dispatch({ type: 'SET_ACTIVE_TAB', payload: 'charts' })}
              style={{
                display: 'grid',
                gridTemplateColumns: 'auto 1fr auto auto',
                gap: 14,
                alignItems: 'center',
                padding: '12px 18px',
                width: '100%',
                background: 'transparent',
                border: 'none',
                borderTop: i > 0 ? '1px solid var(--line-1)' : 'none',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'var(--font-sans)',
                transition: 'background 120ms',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
            >
              <div className="dot dot-risk" style={{ width: 10, height: 10, flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {v.chart}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>
                  <span className="chip" style={{ background: 'var(--surface-2)', border: 'none', fontSize: 10.5, marginRight: 6 }}>{v.rule}</span>
                  {v.value}
                </div>
              </div>
              <div style={{ textAlign: 'right', fontSize: 11.5, flexShrink: 0 }}>
                <div className="mono" style={{ color: 'var(--valentia-slate)' }}>{v.time}</div>
              </div>
              <Icon name="chevron-right" size={14} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
            </button>
          ))
        ) : (
          <div style={{ padding: '32px 20px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
            {hasMaterial
              ? 'No active signals for this scope.'
              : 'Select a material to see priority signals.'}
          </div>
        )}
      </div>
    </div>
  )
}
