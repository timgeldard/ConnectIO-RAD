import type { ConnectIOModule } from '@connectio/shared-ui/shell'
import manifest from './module-manifest.json'

export type ModuleHealthStatus = 'available' | 'degraded' | 'missing' | 'unknown'

export interface PlatformModuleRoute {
  kind: 'local' | 'remote' | 'external'
  path: string
  remoteEntry?: string
  exposedModule?: string
}

export interface PlatformModuleHealth {
  endpoint?: string
  status?: ModuleHealthStatus
  badge?: string
}

export type PlatformModuleRegistration = ConnectIOModule & {
  category?: string
  description?: string
  permissions?: string[]
  featureFlags?: Record<string, boolean>
  searchKeywords?: string[]
  route?: PlatformModuleRoute
  health?: PlatformModuleHealth
}

export interface PlatformManifest {
  version?: number
  modules?: PlatformModuleRegistration[]
  featureFlags?: Record<string, boolean>
}

interface PlatformModuleOptions {
  manifest?: PlatformManifest
  userPermissions?: string[]
}

const localManifest = manifest as PlatformManifest

/** Return the generated local manifest bundled with the platform frontend. */
export function getLocalPlatformManifest(): PlatformManifest {
  return localManifest
}

/** Build the text blob used by global module search. */
export function moduleSearchText(module: PlatformModuleRegistration): string {
  return [
    module.moduleId,
    module.displayName,
    module.shortName,
    module.tagline,
    module.description,
    module.category,
    module.sidebarGroup,
    module.i18nNamespace,
    ...(module.searchKeywords ?? []),
    module.landingCard?.tag,
    module.landingCard?.desc,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

/** Evaluate manifest and app-composition feature flags for a module. */
export function isModuleEnabled(
  module: PlatformModuleRegistration,
  featureFlags: Record<string, boolean> = {},
): boolean {
  const moduleFlags = module.featureFlags ?? {}
  return Object.entries(moduleFlags).every(([flag, defaultValue]) => {
    if (featureFlags[flag] === undefined) return defaultValue
    return featureFlags[flag]
  })
}

/** Return true when the current user has at least one permission required by a module. */
export function canViewModule(
  module: PlatformModuleRegistration,
  userPermissions: string[] = [],
): boolean {
  const required = module.permissions ?? []
  if (required.length === 0 || required.includes('*')) return true
  const granted = new Set(userPermissions)
  return required.some((permission) => granted.has(permission))
}

export function filterModulesByPermissions(
  modules: PlatformModuleRegistration[],
  userPermissions: string[] = [],
): PlatformModuleRegistration[] {
  return modules.filter((module) => canViewModule(module, userPermissions))
}

export function groupModulesByCategory(
  modules: PlatformModuleRegistration[],
): Map<string, PlatformModuleRegistration[]> {
  const groups = new Map<string, PlatformModuleRegistration[]>()
  for (const module of modules) {
    const category = module.category ?? module.sidebarGroup ?? module.domain
    groups.set(category, [...(groups.get(category) ?? []), module])
  }
  return groups
}

function sortModules(modules: PlatformModuleRegistration[]): PlatformModuleRegistration[] {
  return [...modules].sort((left, right) => {
    const leftGroup = left.sidebarGroup ?? ''
    const rightGroup = right.sidebarGroup ?? ''
    if (leftGroup !== rightGroup) return leftGroup.localeCompare(rightGroup)
    const orderDelta = (left.sidebarOrder ?? 999) - (right.sidebarOrder ?? 999)
    if (orderDelta !== 0) return orderDelta
    return left.displayName.localeCompare(right.displayName)
  })
}

/**
 * Merge generated/demo module registrations into the static platform module list.
 *
 * The static list remains the source of truth for mature apps. The manifest is
 * intentionally small and append-only so new bounded contexts can show up in
 * the shell immediately, then graduate into richer hand-authored composition
 * later when cross-app routing and live data contracts are ready.
 */
export function getPlatformModules(
  staticModules: ConnectIOModule[],
  options: PlatformModuleOptions = {},
): PlatformModuleRegistration[] {
  const activeManifest = options.manifest ?? localManifest
  const featureFlags = {
    ...(localManifest.featureFlags ?? {}),
    ...(activeManifest.featureFlags ?? {}),
  }
  const dynamicModules = activeManifest.modules ?? []
  const existingIds = new Set(staticModules.map((module) => module.moduleId))
  const merged = [
    ...(staticModules as PlatformModuleRegistration[]),
    ...dynamicModules.filter((module) => !existingIds.has(module.moduleId)),
  ].filter((module) => isModuleEnabled(module, featureFlags))
  return sortModules(filterModulesByPermissions(merged, options.userPermissions))
}
