import type { ConnectIOModule } from '@connectio/shared-ui/shell'
import { LandingCard } from './LandingCard'

interface ModuleContentPanelProps {
  moduleId: string
  modules: ConnectIOModule[]
}

/** Renders the content panel for the active module. Phase 1: landing card only. */
export function ModuleContentPanel({ moduleId, modules }: ModuleContentPanelProps) {
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
      <LandingCard mod={mod} />
    </div>
  )
}
