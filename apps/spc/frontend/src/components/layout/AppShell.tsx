import type { ReactNode } from 'react'
import { GlobalFilterBar } from './GlobalFilterBar'
import { SPCHeader } from './SPCHeader'
import { Sidebar } from './Sidebar'

/**
 * Props for the main SPC Application Shell.
 */
interface AppShellProps {
  /** Main content to be rendered in the scrollable area. */
  children: ReactNode
  /** @deprecated Dark mode is no longer supported in the Kerry design system. */
  dark?: boolean
  /** @deprecated */
  onToggleDark?: () => void
  /** Optional sticky filter bar content. */
  filterBar?: ReactNode
}

/**
 * High-level layout component providing Sidebar, Header, and Global Filter bar consistency.
 */
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
