import React from 'react'

type Variant = 'error' | 'warn' | 'info' | 'neutral'

const VARIANT_STYLE: Record<Variant, { background: string; color: string; border: string }> = {
  error:   { background: 'var(--status-risk-bg)',  color: 'var(--status-risk)',  border: 'var(--status-risk)'  },
  warn:    { background: 'var(--status-warn-bg)',  color: 'var(--status-warn)',  border: 'var(--status-warn)'  },
  info:    { background: 'var(--status-info-bg)',  color: 'var(--status-info)',  border: 'var(--status-info)'  },
  neutral: { background: 'var(--status-neutral-bg)', color: 'var(--text-2)', border: 'var(--line-1)' },
}

interface InfoBannerProps {
  variant?: Variant
  children: React.ReactNode
}

export default function InfoBanner({ variant = 'neutral', children }: InfoBannerProps) {
  const s = VARIANT_STYLE[variant]
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      style={{
        padding: '8px 12px',
        borderRadius: 8,
        border: `1px solid ${s.border}`,
        background: s.background,
        color: s.color,
        fontSize: '0.8125rem',
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  )
}
