/* eslint-disable jsdoc/require-jsdoc */
import type { ReactNode } from 'react'

interface SectionHeaderProps {
  eyebrow?: string
  title: string
  subtitle?: string
  actions?: ReactNode
}

export default function SectionHeader({ eyebrow, title, subtitle, actions }: SectionHeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '0.75rem',
      }}
    >
      <div>
        {eyebrow && (
          <div
            style={{
              fontSize: '0.7rem',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'var(--text-3)',
            }}
          >
            {eyebrow}
          </div>
        )}
        <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-1)' }}>{title}</h3>
        {subtitle && <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: 'var(--text-3)' }}>{subtitle}</p>}
      </div>
      {actions && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
          {actions}
        </div>
      )}
    </div>
  )
}
