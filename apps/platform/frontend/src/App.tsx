import { useCallback, useMemo, useState } from 'react'
import { PlatformShell } from '@connectio/shared-ui/shell'
import { COMPOSITION } from './shell/composition'
import { MODULES } from './shell/modules'
import { useShellState } from './shell/useShellState'
import { usePinnedModules } from './shell/usePinnedModules'
import { useBadgeCounts } from './shell/useBadgeCounts'
import { ModuleContentPanel } from './shell/ModuleContentPanel'
import { CrossAppContextBar } from './shell/CrossAppContextBar'
import { GenieDrawer } from './genie/GenieDrawer'
import type { PlatformGenieContext } from './genie/api'
import './genie/genie.css'

/**
 * The main entry point for the Platform Shell frontend application.
 *
 * This component manages the high-level application state including:
 * - Active module and tab navigation via `useShellState`.
 * - User-pinned modules via `usePinnedModules`.
 * - Real-time badge counts (e.g., alert/notification counts) via `useBadgeCounts`.
 * - Genie assistant drawer visibility via local state.
 *
 * It renders the `PlatformShell` layout component from the shared library,
 * injecting the necessary configuration and state handlers.
 */
export function App() {
  const [state, handlers] = useShellState()
  const [pinnedModules, onModulePinToggle] = usePinnedModules()
  const badgeMap = useBadgeCounts()
  const [genieOpen, setGenieOpen] = useState(false)

  const activeTabId = state.tabState[state.activeModuleId]

  const contextBar = state.ctxState ? (
    <CrossAppContextBar ctx={state.ctxState} onClear={handlers.onClearContext} />
  ) : undefined

  // Build the Genie page context from the current cross-app entity context.
  const genieContext = useMemo<PlatformGenieContext>(() => ({
    selected_process_order: state.ctxState?.processOrderId ?? null,
  }), [state.ctxState])

  const openGenie = useCallback(() => setGenieOpen(true), [])
  const closeGenie = useCallback(() => setGenieOpen(false), [])

  return (
    <>
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

      <GenieDrawer
        open={genieOpen}
        onOpen={openGenie}
        onClose={closeGenie}
        moduleId={state.activeModuleId}
        pageContext={genieContext}
      />
    </>
  )
}
