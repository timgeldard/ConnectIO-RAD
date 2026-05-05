import { useState, useCallback } from 'react'
import { parseCrossAppContext } from '@connectio/shared-ui/shell'
import type { CrossAppContext } from '@connectio/shared-ui/shell'
import { COMPOSITION } from './composition'

/**
 * High-level state for the Platform Shell.
 */
export type ShellState = {
  /** The ID of the currently active module. */
  activeModuleId: string
  /** A map of moduleId to its last active tabId. */
  tabState: Record<string, string>
  /** Parsed cross-app context (e.g., entity, processOrderId) from the URL. */
  ctxState: CrossAppContext | null
}

/**
 * Handlers for updating the shell state and synchronized URL.
 */
type Handlers = {
  /** Switches the active module. */
  onModuleChange: (moduleId: string) => void
  /** Updates the active tab for a specific module. */
  onTabChange: (moduleId: string, tabId: string) => void
  /** Clears the cross-app context from state and URL. */
  onClearContext: () => void
}

/**
 * Reads shell state from URL query parameters.
 */
function readUrlParams(): { moduleId: string; tabState: Record<string, string> } {
  const params = new URLSearchParams(window.location.search)
  const moduleId = params.get('module') ?? COMPOSITION.defaultModule
  const tab = params.get('tab')
  const tabState: Record<string, string> = tab ? { [moduleId]: tab } : {}
  return { moduleId, tabState }
}

/**
 * Persists shell state to URL query parameters using history.replaceState.
 * Preserves existing non-shell parameters (like entity, from).
 */
function writeUrlParams(moduleId: string, tabState: Record<string, string>): void {
  const params = new URLSearchParams(window.location.search)
  params.set('module', moduleId)
  const tab = tabState[moduleId]
  if (tab) {
    params.set('tab', tab)
  } else {
    params.delete('tab')
  }
  const qs = params.toString()
  history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
}

/**
 * URL-param-backed state machine for the platform shell.
 *
 * This hook manages the active module and tab state, synchronizing it with
 * the browser URL without using a formal routing library. It also parses
 * cross-app context parameters.
 *
 * @returns A tuple containing the current shell state and update handlers.
 */
export function useShellState(): [ShellState, Handlers] {
  const [state, setState] = useState<ShellState>(() => {
    const { moduleId, tabState } = readUrlParams()
    return { activeModuleId: moduleId, tabState, ctxState: parseCrossAppContext() }
  })

  const onModuleChange = useCallback((moduleId: string) => {
    setState((prev) => {
      const next = { ...prev, activeModuleId: moduleId }
      writeUrlParams(moduleId, next.tabState)
      return next
    })
  }, [])

  const onTabChange = useCallback((moduleId: string, tabId: string) => {
    setState((prev) => {
      const tabState = { ...prev.tabState, [moduleId]: tabId }
      writeUrlParams(prev.activeModuleId, tabState)
      return { ...prev, tabState }
    })
  }, [])

  const onClearContext = useCallback(() => {
    const params = new URLSearchParams(window.location.search)
    params.delete('entity')
    params.delete('processOrderId')
    params.delete('from')
    const qs = params.toString()
    history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
    setState((prev) => ({ ...prev, ctxState: null }))
  }, [])

  return [state, { onModuleChange, onTabChange, onClearContext }]
}
