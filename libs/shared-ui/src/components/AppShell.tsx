import type { ReactNode } from 'react'

interface AppShellProps {
  sidebar?: ReactNode
  topbar?: ReactNode
  filterBar?: ReactNode
  children: ReactNode
  className?: string
  style?: React.CSSProperties
}

export function AppShell({
  sidebar,
  topbar,
  filterBar,
  children,
  className,
  style
}: AppShellProps) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        height: '100vh',
        overflow: 'hidden',
        background: 'var(--surface-0)',
        ...style
      }}
    >
      {sidebar}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        {topbar}
        {filterBar && (
          <div style={{
            height: 'var(--filter-h, 48px)',
            borderBottom: '1px solid var(--line-1)',
            background: 'var(--surface-1)',
            display: 'flex',
            alignItems: 'center',
            padding: '0 20px',
            flexShrink: 0,
          }}>
            {filterBar}
          </div>
        )}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
