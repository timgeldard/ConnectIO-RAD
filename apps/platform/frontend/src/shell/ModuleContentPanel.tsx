import type { ConnectIOModule } from '@connectio/shared-ui/shell'
import { LandingCard } from './LandingCard'
import { HomePanel } from './HomePanel'

interface ModuleContentPanelProps {
  /** The ID of the module currently selected in the shell. */
  moduleId: string
  /** The list of all available modules in the platform. */
  modules: ConnectIOModule[]
  /** The tab currently active in the shell SubNav for this module. */
  activeTabId?: string
  onModuleChange?: (moduleId: string) => void
}

/** Renders the content panel for the active module. */
export function ModuleContentPanel({ moduleId, modules, activeTabId, onModuleChange }: ModuleContentPanelProps) {
  if (moduleId === 'home') {
    return <HomePanel onModuleChange={onModuleChange ?? (() => {})} />
  }

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
