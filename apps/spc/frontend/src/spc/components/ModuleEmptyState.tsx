import type { ReactNode } from 'react'

interface ModuleEmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export default function ModuleEmptyState({ icon, title, description, action }: ModuleEmptyStateProps) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      minHeight: '11.25rem',
      padding: '1rem 2rem',
      textAlign: 'center',
      background: 'var(--surface-1)',
      border: '1px solid var(--line-1)',
      borderRadius: 10,
    }}>
      {icon && (
        <div style={{ marginBottom: '0.25rem', fontSize: '2.5rem', opacity: 0.5 }}>{icon}</div>
      )}
      <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-1)' }}>{title}</p>
      {description && (
        <p style={{ margin: 0, maxWidth: '25rem', fontSize: '0.8125rem', lineHeight: 1.5, color: 'var(--text-3)' }}>
          {description}
        </p>
      )}
      {action && <div style={{ marginTop: '0.25rem' }}>{action}</div>}
    </div>
  )
}
