interface EmptyStateProps {
  message?: string
}

export default function EmptyState({ message = 'No data available for selected filters' }: EmptyStateProps) {
  return (
    <div style={{
      background: 'var(--surface-1)',
      border: '1px solid var(--line-1)',
      borderRadius: 10,
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        minHeight: '16rem',
        textAlign: 'center',
        padding: '1rem 2rem',
      }}>
        <div style={{ fontSize: '3rem', color: 'var(--text-4)' }} aria-hidden="true">[chart]</div>
        <p style={{ margin: 0, maxWidth: '18rem', color: 'var(--text-3)', fontSize: '0.875rem' }}>{message}</p>
      </div>
    </div>
  )
}
