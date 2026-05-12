import { useEffect } from 'react'
import type { ConnectIOModule } from '@connectio/shared-ui/shell'
import { moduleHref } from './LandingCard'
import { HomePanel } from './HomePanel'
import { DashboardsPanel } from './DashboardsPanel'

interface ModuleContentPanelProps {
  /** The ID of the module currently selected in the shell. */
  moduleId: string
  /** The list of all available modules in the platform. */
  modules: ConnectIOModule[]
  /** The tab currently active in the shell SubNav for this module. */
  activeTabId?: string
  /** Friendly user name from the platform session. */
  sessionName?: string
  /** Whether HomePanel should fetch its own session when rendered standalone. */
  fetchSessionFallback?: boolean
}

/** Renders the content panel for the active module. */
export function ModuleContentPanel({
  moduleId,
  modules,
  activeTabId,
  sessionName,
  fetchSessionFallback,
}: ModuleContentPanelProps) {
  const mod = modules.find((m) => m.moduleId === moduleId)

  const isInShell = moduleId === 'home' || moduleId === 'dashboards'

  // Selecting any non-home, non-in-shell module navigates into the sub-app.
  useEffect(() => {
    if (!isInShell && mod) {
      window.location.href = moduleHref(mod, activeTabId)
    }
  }, [isInShell, mod, activeTabId])

  if (moduleId === 'home' || !mod) {
    return (
      <HomePanel
        modules={modules}
        sessionName={sessionName}
        fetchSessionFallback={fetchSessionFallback}
      />
    )
  }

  if (moduleId === 'dashboards') {
    return <DashboardsPanel />
  }

  // Render nothing while the navigation fires.
  return null
}
