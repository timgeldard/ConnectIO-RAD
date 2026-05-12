/* eslint-disable jsdoc/require-jsdoc */
import type { ReactNode } from 'react'

interface PageHeadProps {
  eyebrow?: string
  title: string
  desc?: string
  actions?: ReactNode
}

/** Page-level header: eyebrow label, impact-font title, serif description, and action buttons. */
export function PageHead({ eyebrow, title, desc, actions }: PageHeadProps) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
      <div>
        {eyebrow && (
          <div style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: 10.5,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--text-3)',
            marginBottom: 6,
          }}>
            {eyebrow}
          </div>
        )}
        <h1 style={{
          fontFamily: 'var(--font-impact)',
          fontSize: 32,
          fontWeight: 800,
          letterSpacing: '-0.02em',
          color: 'var(--text-1)',
          margin: '0 0 4px 0',
          lineHeight: 1.1,
        }}>
          {title}
        </h1>
        {desc && (
          <div style={{
            fontFamily: 'var(--font-serif)',
            fontSize: 15,
            color: 'var(--text-2)',
            marginTop: 6,
          }}>
            {desc}
          </div>
        )}
      </div>
      {actions && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {actions}
        </div>
      )}
    </div>
  )
}
