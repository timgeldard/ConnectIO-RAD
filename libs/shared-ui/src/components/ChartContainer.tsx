import type { ReactNode, CSSProperties } from 'react'

/**
 * Props for the ChartContainer component.
 */
export interface ChartContainerProps {
  /** Optional section heading displayed above the chart. */
  title?: string
  /** Optional subtitle or description shown below the title in muted text. */
  description?: string
  /** Minimum height in pixels. Defaults to 280. */
  height?: number
  /** The chart or other visualisation content. */
  children: ReactNode
  /** Optional inline styles on the container section. */
  style?: CSSProperties
}

/**
 * Shared chart container providing a Card-like surface with consistent border,
 * padding, and optional header. Use as a layout primitive around any chart
 * component (ECharts, SVG, etc.).
 *
 * A higher-level version with widget registry support lives in `shared-reporting`.
 *
 * @returns The rendered chart container section element.
 */
export function ChartContainer({ title, description, height = 280, children, style }: ChartContainerProps) {
  return (
    <section
      style={{
        background: 'var(--surface-0)',
        border: '1px solid var(--line-1)',
        borderRadius: 8,
        padding: 16,
        minHeight: height,
        display: 'grid',
        gap: 12,
        ...style,
      }}
    >
      {(title || description) && (
        <header>
          {title && (
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: 'var(--text-1)' }}>
              {title}
            </h2>
          )}
          {description && (
            <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-3)' }}>
              {description}
            </p>
          )}
        </header>
      )}
      {children}
    </section>
  )
}
