import { useState, type ReactNode } from 'react'
import type { CSSProperties } from 'react'

/**
 * Props for the Button component.
 */
export interface ButtonProps {
  /** The content of the button. */
  children?: ReactNode
  /** Function to call when the button is clicked. */
  onClick?: () => void
  /** The visual variant of the button. Defaults to 'ghost'. */
  variant?: 'primary' | 'ghost' | 'danger' | 'secondary'
  /** The size of the button. Defaults to 'md'. */
  size?: 'sm' | 'md' | 'lg'
  /** An optional icon element to display before the text. */
  icon?: ReactNode
  /** If true, styles the button as active/pressed. */
  active?: boolean
  /** If true, disables the button and applies disabled styling. */
  disabled?: boolean
  /** If true, shows a loading spinner instead of the icon and disables the button. */
  loading?: boolean
  /** Optional CSS class name. */
  className?: string
  /** Optional inline styles. */
  style?: CSSProperties
}

/**
 * A shared Button component used across ConnectIO-RAD applications.
 * Supports multiple variants, sizes, icons, and loading states.
 */
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
      return hover ? '#CF3F00' : 'var(--status-risk)'
    }
    if (variant === 'secondary') return 'var(--surface-2)'
    if (hover || active) return 'var(--surface-sunken)'
    return 'var(--surface-0)'
  }

  const getFg = () => {
    if (disabled || loading) return 'var(--text-3)'
    if (variant === 'primary' || variant === 'danger') return '#fff'
    if (hover || active) return 'var(--brand)'
    return 'var(--text-1)'
  }

  const getBorder = () => {
    if (disabled || loading) return 'var(--line-1)'
    if (variant === 'primary') return 'var(--brand)'
    if (variant === 'danger') return active ? '#A63300' : 'var(--status-risk)'
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
          animation: 'spc-spin 0.8s linear infinite'
        }} />
      ) : icon}
      {children}
    </button>
  )
}
