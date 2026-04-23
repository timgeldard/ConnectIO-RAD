import { Icon } from '../../components/ui/Icon'

interface NodeTooltipProps {
  label: string
  plantName?: string | null
  rejectionRate?: number | null
  cpk?: number | null
  totalBatches?: number | null
  rejectedBatches?: number | null
  lastOoc?: string | null
  hasSignal?: boolean | null
  visible?: boolean
}

export default function NodeTooltip({
  label,
  plantName,
  rejectionRate,
  cpk,
  totalBatches,
  rejectedBatches,
  lastOoc,
  hasSignal,
  visible = false,
}: NodeTooltipProps) {
  if (!visible) return null

  return (
    <div style={{
      pointerEvents: 'none',
      position: 'absolute',
      bottom: '100%',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 30,
      marginBottom: 12,
      width: 256,
      borderRadius: 12,
      border: '1px solid var(--line-1)',
      background: 'var(--surface-1)',
      padding: 14,
      textAlign: 'left',
      boxShadow: 'var(--shadow-pop)',
    }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{label}</div>
      {plantName && (
        <div style={{
          marginTop: 4,
          display: 'inline-flex', alignItems: 'center', gap: 4,
          borderRadius: 999, background: 'var(--surface-2)',
          padding: '2px 8px', fontSize: 12, fontWeight: 500, color: 'var(--text-3)',
        }}>
          {plantName}
        </div>
      )}

      <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {[
          { label: 'Rejection', value: rejectionRate != null ? `${rejectionRate.toFixed(1)}%` : 'Unavailable' },
          { label: 'Cpk',       value: cpk != null ? cpk.toFixed(2) : 'Unavailable' },
          { label: 'Batches',   value: String(totalBatches ?? 0) },
          { label: 'Rejected',  value: String(rejectedBatches ?? 0) },
        ].map(({ label: l, value }) => (
          <div key={l}>
            <div style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 11, color: 'var(--text-3)' }}>{l}</div>
            <div style={{ marginTop: 3, fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>{value}</div>
          </div>
        ))}
      </div>

      {(hasSignal || lastOoc) && (
        <div style={{
          marginTop: 10,
          display: 'inline-flex', alignItems: 'center', gap: 4,
          borderRadius: 999, padding: '2px 8px', fontSize: 12, fontWeight: 600,
          background: 'var(--status-risk-bg)', color: 'var(--status-risk)',
        }}>
          <Icon name={lastOoc ? 'alert-triangle' : 'activity'} size={13} />
          {lastOoc ? `Latest OOC ${lastOoc}` : 'OOC attention signal inferred'}
        </div>
      )}
    </div>
  )
}
