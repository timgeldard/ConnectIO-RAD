import type { CSSProperties } from 'react'

/**
 * Props for the shared loading spinner.
 */
export interface SpinnerProps {
  /** Spinner diameter in pixels. */
  size?: number
  /** Border thickness in pixels. */
  thickness?: number
  /** Active arc color. */
  color?: string
  /** Inactive track color. */
  trackColor?: string
  /** Optional CSS class name for the spinner element. */
  className?: string
  /** Optional inline style overrides. */
  style?: CSSProperties
}

/**
 * Renders a compact circular loading spinner using shared design tokens.
 *
 * @param props - Spinner sizing and styling overrides.
 * @returns A decorative spinner element for inline loading states.
 */
export function Spinner({
  size = 14,
  thickness = 2,
  color = 'var(--brand)',
  trackColor = 'var(--line-1)',
  className,
  style,
}: SpinnerProps) {
  return (
    <span
      className={className}
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        border: `${thickness}px solid ${trackColor}`,
        borderTopColor: color,
        borderRadius: '50%',
        animation: 'spc-spin 0.8s linear infinite',
        boxSizing: 'border-box',
        flexShrink: 0,
        ...style,
      }}
    />
  )
}
