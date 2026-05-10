import type { ConnectIOModule } from '@connectio/shared-ui/shell'
import manifest from './module-manifest.json'

type ModuleManifest = {
  modules?: ConnectIOModule[]
}

/**
 * Merge generated/demo module registrations into the static platform module list.
 *
 * The static list remains the source of truth for mature apps. The manifest is
 * intentionally small and append-only so new bounded contexts can show up in
 * the shell immediately, then graduate into richer hand-authored composition
 * later when cross-app routing and live data contracts are ready.
 */
export function getPlatformModules(staticModules: ConnectIOModule[]): ConnectIOModule[] {
  const dynamicModules = (manifest as ModuleManifest).modules ?? []
  const existingIds = new Set(staticModules.map((module) => module.moduleId))
  return [
    ...staticModules,
    ...dynamicModules.filter((module) => !existingIds.has(module.moduleId)),
  ].sort((left, right) => {
    const leftGroup = left.sidebarGroup ?? ''
    const rightGroup = right.sidebarGroup ?? ''
    if (leftGroup !== rightGroup) return leftGroup.localeCompare(rightGroup)
    return (left.sidebarOrder ?? 999) - (right.sidebarOrder ?? 999)
  })
}
