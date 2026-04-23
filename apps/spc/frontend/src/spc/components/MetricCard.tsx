import type { ReactNode } from 'react'

type Tone = 'error' | 'warning' | 'success' | 'neutral'

interface MetricCardProps {
  label: string
  value: ReactNode
  meta?: string
  tone?: Tone
}

const toneToken: Record<Tone, string> = {
  success: 'var(--status-ok)',
  warning: 'var(--status-warn)',
  error:   'var(--status-risk)',
  neutral: 'var(--line-1)',
}

export default function MetricCard({ label, value, meta, tone = 'neutral' }: MetricCardProps) {
  const accentColor = toneToken[tone]

  return (
    <div
      style={{
        borderLeft: `4px solid ${accentColor}`,
        padding: '1rem',
        height: '100%',
        background: 'var(--surface-1)',
        border: '1px solid var(--line-1)',
        borderRadius: 8,
      }}
    >
      <span
        style={{
          display: 'block',
          fontSize: '1.75rem',
          fontWeight: 700,
          lineHeight: 1,
          color: 'var(--text-1)',
          fontFamily: 'var(--font-mono, "IBM Plex Mono", monospace)',
        }}
      >
        {value}
      </span>
      <span
        style={{
          display: 'block',
          marginTop: '0.375rem',
          fontSize: '0.6875rem',
          fontWeight: 600,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: 'var(--text-3)',
        }}
      >
        {label}
      </span>
      {meta && (
        <span style={{ display: 'block', marginTop: '0.375rem', fontSize: '0.75rem', color: 'var(--text-3)' }}>
          {meta}
        </span>
      )}
    </div>
  )
}
