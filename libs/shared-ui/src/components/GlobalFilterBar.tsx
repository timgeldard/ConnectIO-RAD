import type { ReactNode, CSSProperties } from 'react'

interface GlobalFilterBarProps {
  children?: ReactNode
  className?: string
  style?: CSSProperties
}

/**
 * Standard horizontal filter bar container for ConnectIO cockpits.
 * Placed typically between TopBar and Page content.
 */
export function GlobalFilterBar({ children, className = '', style }: GlobalFilterBarProps) {
  if (!children) return null
  
  return (
    <div
      data-testid="filter-bar"
      className={`connectio-filter-bar ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '10px 24px',
        background: 'var(--surface-1)',
        borderBottom: '1px solid var(--line-1)',
        flexWrap: 'wrap',
        flexShrink: 0,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

/** 
 * Vertical divider for use within GlobalFilterBar to separate logical groups.
 */
export function FilterDivider() {
  return (
    <div style={{ width: 1, height: 24, background: 'var(--line-1)', margin: '0 4px' }} />
  )
}

/**
 * Logical group within a FilterBar with an optional eyebrow label.
 */
export function FilterGroup({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && <div className="eyebrow" style={{ fontSize: 10, color: 'var(--text-3)' }}>{label}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {children}
      </div>
    </div>
  )
}
