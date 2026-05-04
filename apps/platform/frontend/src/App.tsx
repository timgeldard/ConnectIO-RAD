import { PlatformShell } from '@connectio/shared-ui/shell'
import { COMPOSITION } from './shell/composition'
import { MODULES } from './shell/modules'
import { useShellState } from './shell/useShellState'
import { ModuleContentPanel } from './shell/ModuleContentPanel'

export function App() {
  const [state, handlers] = useShellState()

  return (
    <PlatformShell
      composition={COMPOSITION}
      modules={MODULES}
      activeModule={state.activeModuleId}
      tabState={state.tabState}
      onModuleChange={handlers.onModuleChange}
      onTabChange={handlers.onTabChange}
    >
      <ModuleContentPanel moduleId={state.activeModuleId} modules={MODULES} />
    </PlatformShell>
  )
}
