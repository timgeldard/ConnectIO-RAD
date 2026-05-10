import type { ReactNode } from 'react'

export interface ChartContainerProps {
  title?: string
  description?: string
  height?: number
  children: ReactNode
}

export function ChartContainer({ title, description, height = 280, children }: ChartContainerProps) {
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
      }}
    >
      {(title || description) && (
        <header>
          {title && <h2 style={{ margin: 0, fontSize: 16, color: 'var(--text-1)' }}>{title}</h2>}
          {description && <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-3)' }}>{description}</p>}
        </header>
      )}
      {children}
    </section>
  )
}
