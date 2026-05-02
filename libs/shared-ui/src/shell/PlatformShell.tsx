import { useMemo, type ReactNode } from 'react'
import { LeftRail } from './LeftRail'
import { ShellTopBar } from './ShellTopBar'
import { SubNav } from './SubNav'
import type { AppComposition, ConnectIOModule, SidebarBottomItem } from './types'

interface PlatformShellProps {
  composition: AppComposition
  modules: ConnectIOModule[]
  activeModule: string
  tabState: Record<string, string>
  onModuleChange: (moduleId: string) => void
  onTabChange: (moduleId: string, tabId: string) => void
  /** Rendered in the 40px context bar row. Omit to hide the row. */
  contextBar?: ReactNode
  children: ReactNode
  /** Runtime badge counts keyed by moduleId e.g. { alarms: 7 } */
  badgeMap?: Record<string, number>
  userInitials?: string
  userName?: string
  userRole?: string
  /**
   * Pinned module IDs from the user's saved preferences.
   * null = no preferences saved yet → show all enabled modules (factory default).
   * string[] = show mandatory modules + these IDs only.
   */
  pinnedModules?: string[] | null
  /** Called when the user pins or unpins a module from the rail. */
  onModulePinToggle?: (moduleId: string, pin: boolean) => void
}

/** Root platform shell — CSS Grid layout driven by the app manifest. */
export function PlatformShell({
  composition,
  modules,
  activeModule,
  tabState,
  onModuleChange,
  onTabChange,
  contextBar,
  children,
  badgeMap,
  userInitials,
  userName,
  userRole,
  pinnedModules,
  onModulePinToggle,
}: PlatformShellProps) {
  const enabledSet = useMemo(
    () => new Set(composition.enabledModules),
    [composition.enabledModules],
  )
  const mandatorySet = useMemo(
    () => new Set(composition.mandatoryModules),
    [composition.mandatoryModules],
  )

  const visibleModules = useMemo(() => {
    const enabled = modules.filter((m) => enabledSet.has(m.moduleId))
    if (pinnedModules == null) return enabled
    const pinnedSet = new Set(pinnedModules)
    return enabled.filter((m) => m.isMandatory || mandatorySet.has(m.moduleId) || pinnedSet.has(m.moduleId))
  }, [modules, pinnedModules, enabledSet, mandatorySet])

  const hiddenModules = useMemo(() => {
    if (pinnedModules == null) return []
    const pinnedSet = new Set(pinnedModules)
    return modules.filter(
      (m) =>
        enabledSet.has(m.moduleId) &&
        m.isUserSelectable &&
        !m.isMandatory &&
        !mandatorySet.has(m.moduleId) &&
        !pinnedSet.has(m.moduleId),
    )
  }, [modules, pinnedModules, enabledSet, mandatorySet])

  const activeModuleDef = modules.find((m) => m.moduleId === activeModule)
  const isFullscreen = activeModuleDef?.layoutMode === 'fullscreen'
  const hasCtx = !isFullscreen && !!contextBar

  const tabs = activeModuleDef?.tabs ?? []
  const activeTab = tabState[activeModule] ?? activeModuleDef?.defaultTab ?? ''

  const breadcrumb = (() => {
    if (!activeModuleDef) return []
    if (!tabs.length) return [activeModuleDef.displayName]
    const tabLabel = tabs.find((t) => t.id === activeTab)?.label ?? ''
    return tabLabel ? [activeModuleDef.displayName, tabLabel] : [activeModuleDef.displayName]
  })()

  const shellClass = [
    'connectio-shell',
    isFullscreen ? 'fullscreen' : '',
    !hasCtx && !isFullscreen ? 'no-ctx' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const handleBottomItem = (item: SidebarBottomItem) => {
    if (item.action === 'navigate') onModuleChange(item.target)
    else if (item.action === 'external') window.open(item.target, '_blank')
  }

  return (
    <div className={shellClass}>
      <LeftRail
        modules={visibleModules}
        activeModule={activeModule}
        onPick={onModuleChange}
        bottomItems={composition.sidebarBottomItems}
        badgeMap={badgeMap}
        onBottomItemClick={handleBottomItem}
        hiddenModules={hiddenModules}
        onModuleUnpin={onModulePinToggle ? (id) => onModulePinToggle(id, false) : undefined}
        onModulePin={onModulePinToggle ? (id) => onModulePinToggle(id, true) : undefined}
      />
      <ShellTopBar
        appName={composition.appDisplayName.toUpperCase()}
        tagline={composition.appTagline.toUpperCase()}
        breadcrumb={breadcrumb}
        onAlarms={() => onModuleChange('alarms')}
        userInitials={userInitials}
        userName={userName}
        userRole={userRole}
      />
      {hasCtx && contextBar}
      <div className="connectio-body">
        {tabs.length > 0 && (
          <SubNav
            tabs={tabs}
            active={activeTab}
            onPick={(tabId) => onTabChange(activeModule, tabId)}
          />
        )}
        <div className="connectio-page">{children}</div>
      </div>
    </div>
  )
}
