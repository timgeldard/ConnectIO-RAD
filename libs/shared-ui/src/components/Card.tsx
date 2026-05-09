import type { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'dark'
  title?: string
  num?: string
  meta?: string
  subtitle?: string
  action?: ReactNode
  bodyClass?: string
  padding?: number
  noPad?: boolean
  children: ReactNode
}

export function Card({
  className,
  variant = 'default',
  title,
  num,
  meta,
  subtitle,
  action,
  bodyClass,
  padding,
  noPad,
  children,
  style,
  ...props
}: CardProps) {
  const hasHeader = title != null || action != null || num != null || meta != null || subtitle != null

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
        display: 'flex',
        flexDirection: 'column',
        ...style,
      }}
      {...props}
    >
      {hasHeader && (
        <CardHeader style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', flex: 1, flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              {num != null && <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: 'var(--text-3)' }}>{num}</span>}
              {title != null && <CardTitle>{title}</CardTitle>}
              {meta != null && <span style={{ fontSize: 11, color: 'var(--text-3)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{meta}</span>}
            </div>
            {subtitle && <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{subtitle}</div>}
          </div>
          {action}
        </CardHeader>
      )}
      <CardContent className={bodyClass} style={noPad ? { padding: 0 } : padding != null ? { padding } : undefined}>
        {children}
      </CardContent>
    </div>
  )
}

export function CardHeader({ className, children, style, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={className}
      style={{
        padding: '1.25rem 1.5rem',
        borderBottom: '1px solid var(--line-1)',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardContent({ className, children, style, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={className} style={{ padding: '1.5rem', flex: 1, ...style }} {...props}>
      {children}
    </div>
  )
}

export function CardTitle({ className, children, style, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={className}
      style={{
        margin: 0,
        color: 'var(--text-1)',
        fontSize: '1.25rem',
        fontWeight: 600,
        letterSpacing: '-0.01em',
        ...style,
      }}
      {...props}
    >
      {children}
    </h3>
  )
}
