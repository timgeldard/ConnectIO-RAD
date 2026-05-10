import type { ReactNode } from 'react'

export interface ReportPageShellProps {
  title: string
  description?: string
  filters?: ReactNode
  actions?: ReactNode
  state?: 'ready' | 'loading' | 'empty' | 'error' | 'permission'
  stateMessage?: string
  children: ReactNode
}

const DEFAULT_MESSAGES: Record<NonNullable<ReportPageShellProps['state']>, string> = {
  ready: '',
  loading: 'Loading report...',
  empty: 'No report data available.',
  error: 'Unable to load this report.',
  permission: 'You do not have permission to view this report.',
}

export function ReportPageShell({
  title,
  description,
  filters,
  actions,
  state = 'ready',
  stateMessage,
  children,
}: ReportPageShellProps) {
  const message = stateMessage ?? DEFAULT_MESSAGES[state]

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <header style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, color: 'var(--text-1)' }}>{title}</h1>
            {description && <p style={{ margin: '6px 0 0', color: 'var(--text-3)' }}>{description}</p>}
          </div>
          {actions && <div>{actions}</div>}
        </div>
        {filters && <div>{filters}</div>}
      </header>
      {state === 'ready' ? (
        children
      ) : (
        <div role={state === 'error' ? 'alert' : 'status'} style={{ padding: 24, color: 'var(--text-3)' }}>
          {message}
        </div>
      )}
    </div>
  )
}
