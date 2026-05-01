import { useState, type ReactNode } from 'react'

export interface ButtonProps {
  children?: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'ghost' | 'danger' | 'secondary'
  size?: 'sm' | 'md' | 'lg'
  icon?: ReactNode
  active?: boolean
  disabled?: boolean
  loading?: boolean
  className?: string
  style?: React.CSSProperties
}

export function Button({
  children,
  onClick,
  variant = 'ghost',
  size = 'md',
  icon,
  active,
  disabled,
  loading,
  className,
  style
}: ButtonProps) {
  const [hover, setHover] = useState(false)

  const getBg = () => {
    if (disabled || loading) return 'var(--surface-sunken)'
    if (variant === 'primary') return 'var(--brand)'
    if (variant === 'danger') {
      if (active) return '#A63300'
      return hover ? '#CF3F00' : 'var(--sunset)'
    }
    if (variant === 'secondary') return 'var(--surface-2)'
    if (hover || active) return 'var(--slate-surface)'
    return 'var(--paper)'
  }

  const getFg = () => {
    if (disabled || loading) return 'var(--text-disabled)'
    if (variant === 'primary' || variant === 'danger') return '#fff'
    if (hover || active) return 'var(--brand)'
    return 'var(--ink)'
  }

  const getBorder = () => {
    if (disabled || loading) return 'var(--line-1)'
    if (variant === 'primary') return 'var(--brand)'
    if (variant === 'danger') return active ? '#A63300' : 'var(--sunset)'
    if (hover || active) return 'var(--brand)'
    return 'var(--line-2)'
  }

  const getPadding = () => {
    if (size === 'sm') return '4px 10px'
    if (size === 'lg') return '10px 20px'
    return '7px 14px'
  }

  const getFontSize = () => {
    if (size === 'sm') return 11.5
    if (size === 'lg') return 14
    return 12.5
  }

  return (
    <button
      onClick={disabled || loading ? undefined : onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      disabled={disabled || loading}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        padding: getPadding(),
        fontSize: getFontSize(),
        fontWeight: 500,
        fontFamily: 'var(--font-sans)',
        background: getBg(),
        color: getFg(),
        border: `1px solid ${getBorder()}`,
        borderRadius: 4,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        letterSpacing: '0.01em',
        transition: 'all 180ms ease',
        opacity: loading ? 0.8 : 1,
        ...style
      }}
    >
      {loading ? (
        <span className="spinner" style={{
          width: 14,
          height: 14,
          border: '2px solid currentColor',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'pa-spin 0.8s linear infinite'
        }} />
      ) : icon}
      {children}
    </button>
  )
}
