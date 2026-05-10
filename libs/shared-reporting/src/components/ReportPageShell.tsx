import type { ReactNode } from 'react'

/** Translated overrides for the built-in state messages. */
export interface ReportPageShellMessages {
  loading?: string
  empty?: string
  error?: string
  permission?: string
}

/**
 * Props for ReportPageShell.
 * @property title - Report heading.
 * @property description - Optional subtitle rendered beneath the heading.
 * @property filters - Filter summary bar rendered in the header.
 * @property actions - Action controls rendered top-right.
 * @property state - Current render state; defaults to 'ready'.
 * @property stateMessage - Explicit state message; overrides both messages and defaults.
 * @property messages - Translated overrides for built-in state strings.
 * @property children - Report body rendered when state is 'ready'.
 */
export interface ReportPageShellProps {
  title: string
  description?: string
  filters?: ReactNode
  actions?: ReactNode
  state?: 'ready' | 'loading' | 'empty' | 'error' | 'permission'
  stateMessage?: string
  messages?: ReportPageShellMessages
  children: ReactNode
}

const DEFAULT_MESSAGES: Record<NonNullable<ReportPageShellProps['state']>, string> = {
  ready: '',
  loading: 'Loading report...',
  empty: 'No report data available.',
  error: 'Unable to load this report.',
  permission: 'You do not have permission to view this report.',
}

/**
 * Shared page shell for report views: renders a header with title, description,
 * filters, and actions, then either the children (ready state) or a localised
 * status message for loading / empty / error / permission states.
 * @returns A grid-layout div with an accessible alert or status region for
 *          non-ready states.
 */
export function ReportPageShell({
  title,
  description,
  filters,
  actions,
  state = 'ready',
  stateMessage,
  messages,
  children,
}: ReportPageShellProps) {
  const message = stateMessage ?? messages?.[state as keyof ReportPageShellMessages] ?? DEFAULT_MESSAGES[state]

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
