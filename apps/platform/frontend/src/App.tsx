/* eslint-disable jsdoc/require-jsdoc */
import { useMemo, useState } from 'react'
import { I18nProvider } from '@connectio/shared-frontend-i18n'
import { PlantProvider } from '@connectio/shared-app-context'
import { PlatformShell } from '@connectio/shared-ui/shell'
import { COMPOSITION } from './shell/composition'
import { MODULES } from './shell/modules'
import { useShellState } from './shell/useShellState'
import { usePinnedModules } from './shell/usePinnedModules'
import { useBadgeCounts } from './shell/useBadgeCounts'
import { usePlatformRegistry } from './shell/usePlatformRegistry'
import { usePlatformSession } from './shell/usePlatformSession'
import { ModuleContentPanel } from './shell/ModuleContentPanel'
import { CrossAppContextBar } from './shell/CrossAppContextBar'
import { GenieDrawer } from './genie/GenieDrawer'
import resources from './i18n/resources.json'
import './genie/genie.css'

/** Platform shell root — wires shell state, module routing, and the Genie AI drawer. */
export function App() {
  const [state, handlers] = useShellState()
  const session = usePlatformSession()
  const { modules } = usePlatformRegistry(MODULES, session.groups)
  const composition = useMemo(
    () => ({
      ...COMPOSITION,
      enabledModules: modules.map((module) => module.moduleId),
    }),
    [modules],
  )
  const selectableModuleIds = useMemo(
    () => modules.filter((m) => m.isUserSelectable && !m.isMandatory).map((m) => m.moduleId),
    [modules],
  )
  const [pinned, onPinToggle] = usePinnedModules(selectableModuleIds)
  const badges = useBadgeCounts()
  const [genieOpen, setGenieOpen] = useState(false)

  return (
    <PlatformShell
      composition={composition}
      modules={modules}
      activeModule={state.activeModuleId}
      tabState={state.tabState}
      onModuleChange={handlers.onModuleChange}
      onTabChange={handlers.onTabChange}
      badgeMap={badges}
      pinnedModules={pinned}
      onModulePinToggle={onPinToggle}
      contextBar={
        state.ctxState
          ? <CrossAppContextBar ctx={state.ctxState} onClear={handlers.onClearContext} />
          : undefined
      }
    >
      <ModuleContentPanel
        moduleId={state.activeModuleId}
        modules={modules}
        activeTabId={state.tabState[state.activeModuleId]}
        sessionName={session.name}
        fetchSessionFallback={false}
      />
      <GenieDrawer
        open={genieOpen}
        onOpen={() => setGenieOpen(true)}
        onClose={() => setGenieOpen(false)}
        moduleId={state.activeModuleId}
        pageContext={{}}
      />
    </PlatformShell>
  )
}

/** Root provider — wraps App with i18n and PlantProvider context. */
export function Root() {
  return (
    <I18nProvider appName="platform" resources={resources}>
      <PlantProvider appName="platform">
        <App />
      </PlantProvider>
    </I18nProvider>
  )
}
