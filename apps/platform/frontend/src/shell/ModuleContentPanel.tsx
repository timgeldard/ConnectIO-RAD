import type { ConnectIOModule } from '@connectio/shared-ui/shell'
import { LandingCard, moduleHref } from './LandingCard'

interface ModuleContentPanelProps {
  /** The ID of the module currently selected in the shell. */
  moduleId: string
  /** The list of all available modules in the platform. */
  modules: ConnectIOModule[]
  /** The tab currently active in the shell SubNav for this module. */
  activeTabId?: string
}

/** Renders the content panel for the active module using the module's real route when available. */
export function ModuleContentPanel({ moduleId, modules, activeTabId }: ModuleContentPanelProps) {
  const mod = modules.find((m) => m.moduleId === moduleId)
  if (!mod) {
    return (
      <div className="plat-empty">
        <p>Module not found: {moduleId}</p>
      </div>
    )
  }

  if (mod.routeBase) {
    const href = moduleHref(mod, activeTabId)
    return (
      <div className="plat-embedded-module">
        <div className="plat-embedded-toolbar">
          <span>{mod.displayName}</span>
          <a href={href}>Open full view</a>
        </div>
        <iframe
          title={`${mod.displayName} module`}
          src={href}
          className="plat-embedded-frame"
          loading="lazy"
        />
      </div>
    )
  }

  return (
    <div className="plat-panel">
      <LandingCard mod={mod} activeTabId={activeTabId} />
    </div>
  )
}
