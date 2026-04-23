import type { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'dark'
  children: ReactNode
}

export function Card({ className, variant = 'default', children, style, ...props }: CardProps) {
  return (
    <div
      className={className}
      style={{
        overflow: 'hidden',
        transition: 'box-shadow 160ms ease',
        background: variant === 'dark' ? 'var(--surface-inverse)' : 'var(--surface-1)',
        border: `1px solid ${variant === 'dark' ? 'var(--line-2)' : 'var(--line-1)'}`,
        color: variant === 'dark' ? '#F4F4E8' : undefined,
        borderRadius: 10,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={className}
      style={{
        padding: '1.25rem 1.5rem',
        borderBottom: '1px solid var(--line-1)',
      }}
    >
      {children}
    </div>
  )
}

export function CardContent({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={className} style={{ padding: '1.5rem' }}>
      {children}
    </div>
  )
}

export function CardTitle({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <h3
      className={className}
      style={{
        margin: 0,
        color: 'var(--text-1)',
        fontSize: '1.25rem',
        fontWeight: 600,
        letterSpacing: '-0.01em',
      }}
    >
      {children}
    </h3>
  )
}
