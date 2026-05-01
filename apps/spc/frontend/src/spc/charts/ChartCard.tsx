import { type ReactNode } from 'react'
import { Icon } from '@connectio/shared-ui'

interface ChartCardProps {
  title: string
  subtitle?: string
  children: ReactNode
  cpk?: number | null
  note?: ReactNode
  onExcludePoint?: () => void
  onExport?: () => void
  onAnnotate?: () => void
  exportLabel?: string
}

function cpkChipClass(cpk: number): string {
  if (cpk >= 1.33) return 'chip chip-ok'
  if (cpk >= 1.0)  return 'chip chip-warn'
  return 'chip chip-risk'
}

export default function ChartCard({
  title,
  subtitle,
  children,
  cpk = null,
  note,
  onExcludePoint,
  onExport,
  onAnnotate,
  exportLabel = 'Export',
}: ChartCardProps) {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        gap: 12, padding: '14px 18px 12px', borderBottom: '1px solid var(--line-1)',
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{title}</div>
          {subtitle && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{subtitle}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {cpk != null && (
            <span className={cpkChipClass(cpk)} style={{ fontSize: 11 }}>
              Cpk {cpk.toFixed(2)}
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '12px 16px' }}>{children}</div>

      {/* Action note */}
      {note && (
        <div style={{ padding: '8px 18px', fontSize: 12, color: 'var(--text-3)', borderTop: '1px solid var(--line-1)' }}>
          {note}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', gap: 6, padding: '10px 14px', borderTop: '1px solid var(--line-1)' }}>
        {onExcludePoint && (
          <button className="btn btn-ghost btn-sm" onClick={onExcludePoint}>
            <Icon name="flag" size={12} /> Exclude Point
          </button>
        )}
        {onExport && (
          <button className="btn btn-ghost btn-sm" onClick={onExport}>
            <Icon name="download" size={12} /> {exportLabel}
          </button>
        )}
        {onAnnotate && (
          <button className="btn btn-ghost btn-sm" onClick={onAnnotate}>
            <Icon name="edit" size={12} /> Annotate
          </button>
        )}
      </div>
    </div>
  )
}
