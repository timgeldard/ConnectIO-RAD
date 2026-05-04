import type { ConnectIOModule } from '@connectio/shared-ui/shell'
import { LandingCard } from './LandingCard'

interface ModuleContentPanelProps {
  moduleId: string
  modules: ConnectIOModule[]
  /** The tab currently active in the shell SubNav for this module. */
  activeTabId?: string
}

/** Renders the content panel for the active module. Phase 2: landing card + tab-aware open link. */
export function ModuleContentPanel({ moduleId, modules, activeTabId }: ModuleContentPanelProps) {
  const mod = modules.find((m) => m.moduleId === moduleId)
  if (!mod) {
    return (
      <div className="plat-empty">
        <p>Module not found: {moduleId}</p>
      </div>
    )
  }
  return (
    <div className="plat-panel">
      <LandingCard mod={mod} activeTabId={activeTabId} />
    </div>
  )
}
