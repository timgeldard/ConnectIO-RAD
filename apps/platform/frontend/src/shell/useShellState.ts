import { useState, useCallback } from 'react'
import { parseCrossAppContext } from '@connectio/shared-ui/shell'
import type { CrossAppContext } from '@connectio/shared-ui/shell'
import { COMPOSITION } from './composition'

export type ShellState = {
  activeModuleId: string
  tabState: Record<string, string>
  ctxState: CrossAppContext | null
}

type Handlers = {
  onModuleChange: (moduleId: string) => void
  onTabChange: (moduleId: string, tabId: string) => void
  onClearContext: () => void
}

function readUrlParams(): { moduleId: string; tabState: Record<string, string> } {
  const params = new URLSearchParams(window.location.search)
  const moduleId = params.get('module') ?? COMPOSITION.defaultModule
  const tab = params.get('tab')
  const tabState: Record<string, string> = tab ? { [moduleId]: tab } : {}
  return { moduleId, tabState }
}

function writeUrlParams(moduleId: string, tabState: Record<string, string>): void {
  const params = new URLSearchParams()
  params.set('module', moduleId)
  const tab = tabState[moduleId]
  if (tab) params.set('tab', tab)
  history.replaceState(null, '', `?${params.toString()}`)
}

/** URL-param-backed state machine for the platform shell. No routing library. */
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
