import type { ReactNode } from 'react'

export type StatusPillStatus =
  | 'ok' | 'good' | 'pass' | 'healthy' | 'in-control'
  | 'warn' | 'warning'
  | 'bad' | 'fail' | 'critical' | 'risk' | 'out-of-control' | 'out-of-control-high'
  | 'info' | 'neutral' | 'unknown'
  | string

interface StatusPillProps {
  status: StatusPillStatus
  label?: ReactNode
  compact?: boolean
  className?: string
}

function getToneClass(status: string) {
  const s = status.toLowerCase()
  if (['ok', 'good', 'pass', 'healthy', 'in-control', 'accepted', 'released', 'delivered', 'within_shelf_life'].includes(s)) return 'chip-ok'
  if (['warn', 'warning', 'restricted', 'q_insp', 'quality_inspection'].includes(s)) return 'chip-warn'
  if (['bad', 'fail', 'critical', 'risk', 'out-of-control', 'out-of-control-high', 'rejected', 'blocked', 'high'].includes(s)) return 'chip-risk'
  if (['info', 'in_transit', 'in_proc'].includes(s)) return 'chip-info'
  return 'chip-neutral'
}

/** 
 * Universal StatusPill component that replaces app-specific pills.
 * Derives a standard Kerry token colour based on common semantic status strings.
 */
export function StatusPill({ status, label, compact = false, className = '' }: StatusPillProps) {
  const toneClass = getToneClass(status)
  const displayLabel = label ?? status.replace(/_/g, ' ').toUpperCase()

  if (compact) {
    return (
      <span className={`chip ${toneClass} ${className}`} title={typeof displayLabel === 'string' ? displayLabel : undefined} style={{ padding: '2px 6px', fontSize: 10 }}>
        {displayLabel}
      </span>
    )
  }

  return (
    <span className={`chip ${toneClass} ${className}`}>
      <span className="dot" style={{ 
        display: 'inline-block', width: 6, height: 6, borderRadius: '50%', marginRight: 6,
        background: toneClass === 'chip-ok' ? 'var(--status-ok)' : toneClass === 'chip-warn' ? 'var(--status-warn)' : toneClass === 'chip-risk' ? 'var(--status-risk)' : toneClass === 'chip-info' ? 'var(--brand)' : 'var(--text-3)'
      }} />
      {displayLabel}
    </span>
  )
}
