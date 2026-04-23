import type { ReactNode } from 'react'

interface GlobalFilterBarProps {
  children?: ReactNode
}

export function GlobalFilterBar({ children }: GlobalFilterBarProps) {
  if (!children) return null
  return (
    <div
      style={{
        borderBottom: '1px solid var(--line-1)',
        background: 'var(--surface-1)',
        flexShrink: 0,
      }}
    >
      {children}
    </div>
  )
}
