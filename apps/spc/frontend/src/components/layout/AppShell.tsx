import type { ReactNode } from 'react'
import { GlobalFilterBar } from './GlobalFilterBar'
import { SPCHeader } from './SPCHeader'
import { Sidebar } from './Sidebar'

interface AppShellProps {
  children: ReactNode
  dark?: boolean
  onToggleDark?: () => void
  filterBar?: ReactNode
}

export function AppShell({ children, dark = false, onToggleDark, filterBar }: AppShellProps) {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--surface-0)' }}>
      <Sidebar dark={dark} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <SPCHeader dark={dark} onToggleDark={onToggleDark} />
        <GlobalFilterBar>{filterBar}</GlobalFilterBar>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
