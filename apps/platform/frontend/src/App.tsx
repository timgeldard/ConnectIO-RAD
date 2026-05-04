import { PlatformShell } from '@connectio/shared-ui/shell'
import { COMPOSITION } from './shell/composition'
import { MODULES } from './shell/modules'
import { useShellState } from './shell/useShellState'
import { usePinnedModules } from './shell/usePinnedModules'
import { useBadgeCounts } from './shell/useBadgeCounts'
import { ModuleContentPanel } from './shell/ModuleContentPanel'
import { CrossAppContextBar } from './shell/CrossAppContextBar'

export function App() {
  const [state, handlers] = useShellState()
  const [pinnedModules, onModulePinToggle] = usePinnedModules()
  const badgeMap = useBadgeCounts()

  const activeTabId = state.tabState[state.activeModuleId]

  const contextBar = state.ctxState ? (
    <CrossAppContextBar ctx={state.ctxState} onClear={handlers.onClearContext} />
  ) : undefined

  return (
    <PlatformShell
      composition={COMPOSITION}
      modules={MODULES}
      activeModule={state.activeModuleId}
      tabState={state.tabState}
      onModuleChange={handlers.onModuleChange}
      onTabChange={handlers.onTabChange}
      contextBar={contextBar}
      badgeMap={badgeMap}
      pinnedModules={pinnedModules}
      onModulePinToggle={onModulePinToggle}
    >
      <ModuleContentPanel
        moduleId={state.activeModuleId}
        modules={MODULES}
        activeTabId={activeTabId}
      />
    </PlatformShell>
  )
}
