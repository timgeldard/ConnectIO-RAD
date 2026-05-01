import { type ReactNode } from 'react'
import { Icon } from './Icon'

export interface Breadcrumb {
  label: string
  icon?: string
  onClick?: () => void
}

export interface TopBarProps {
  breadcrumbs?: Breadcrumb[]
  search?: {
    value: string
    onChange: (val: string) => void
    placeholder?: string
    hint?: string
  }
  actions?: ReactNode
  className?: string
  style?: React.CSSProperties
}

export function TopBar({
  breadcrumbs,
  search,
  actions,
  className,
  style
}: TopBarProps) {
  return (
    <header
      aria-label="Top navigation"
      className={className}
      style={{
        height: 'var(--header-h, 56px)',
        borderBottom: '1px solid var(--line-1)',
        background: 'var(--surface-1)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 20px',
        gap: 14,
        flexShrink: 0,
        position: 'relative',
        ...style
      }}
    >
      {/* Breadcrumbs */}
      {breadcrumbs && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-3)', flexShrink: 0 }}>
          {breadcrumbs.map((bc, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {idx > 0 && <Icon name="chevron-right" size={11} />}
              <button
                onClick={bc.onClick}
                disabled={!bc.onClick}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  color: 'inherit',
                  fontSize: 'inherit',
                  cursor: bc.onClick ? 'pointer' : 'default',
                  fontWeight: idx === breadcrumbs.length - 1 ? 600 : 400,
                }}
              >
                {bc.icon && <Icon name={bc.icon as any} size={13} />}
                {bc.label}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      {search && (
        <div style={{ marginLeft: 16, flex: '0 1 400px', position: 'relative' }}>
          <Icon
            name="search"
            size={14}
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', pointerEvents: 'none' }}
          />
          <input
            type="search"
            value={search.value}
            onChange={e => search.onChange(e.target.value)}
            placeholder={search.placeholder || 'Search...'}
            style={{
              width: '100%',
              height: 34,
              paddingLeft: 32,
              paddingRight: 48,
              border: '1px solid var(--line-2)',
              borderRadius: 8,
              background: 'var(--surface-0)',
              color: 'var(--text-1)',
              fontSize: 13,
              fontFamily: 'var(--font-sans)',
              outline: 'none',
              transition: 'border-color 140ms',
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--valentia-slate)' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--line-2)' }}
          />
          {search.hint && (
            <span style={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: 10.5,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-3)',
              padding: '2px 6px',
              border: '1px solid var(--line-2)',
              borderRadius: 4,
              pointerEvents: 'none',
            }}>{search.hint}</span>
          )}
        </div>
      )}

      {/* Actions */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
        {actions}
      </div>
    </header>
  )
}
