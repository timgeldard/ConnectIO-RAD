import { useCallback, useEffect, useState } from 'react'
import { PlatformShell, ContextBar, type CtxState } from '@connectio/shared-ui'
import { CQ_MODULES, CQ_COMPOSITION } from '~/manifest'
import { fetchPreferences, savePreferences } from '~/api/preferences'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000, // 1 minute
      gcTime: 300_000, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
})

// Pages
import { Home } from '~/pages/Home'
import { LabBoard } from '~/pages/lab/LabBoard'
import { Alarms } from '~/pages/Alarms'
import { Admin } from '~/pages/Admin'
import { GenericOverview } from '~/components/GenericOverview'

function readContext(): CtxState | null {
  const params = new URLSearchParams(window.location.search)
  const plant = params.get('plant') ?? params.get('plant_id')
  const material = params.get('material') ?? params.get('material_id')
  const batch = params.get('batch') ?? params.get('batch_id')
  return plant && material && batch ? { plant, material, batch } : null
}

/** Resolves the correct page component for the active module and tab. */
function ActivePage({
  mod,
}: {
  mod: string
}) {
  if (mod === 'home')   return <Home />
  if (mod === 'lab')    return <LabBoard />
  if (mod === 'alarms') return <Alarms />
  if (mod === 'admin')  return <Admin />

  return <GenericOverview title="Coming Soon" eyebrow="" desc="" kpis={[]} panels={[]} />
}

/** Root application — drives the platform shell from the CQ manifest. */
export function App() {
  const [activeModule, setActiveModule] = useState(() => {
    const m = new URLSearchParams(window.location.search).get('module')
    return m && CQ_MODULES.some(x => x.moduleId === m) ? m : CQ_COMPOSITION.defaultModule
  })
  const [tabState, setTabState] = useState<Record<string, string>>({})
  const [pinnedModules, setPinnedModules] = useState<string[] | null>(null)
  const [ctxState] = useState<CtxState | null>(() => readContext())

  useEffect(() => {
    fetchPreferences(CQ_COMPOSITION.appId)
      .then(prefs => setPinnedModules(prefs.pinnedModules))
      .catch(() => {})
  }, [])

  const handleModulePinToggle = useCallback((moduleId: string, pin: boolean) => {
    const allSelectable = CQ_MODULES
      .filter(m => m.isUserSelectable && CQ_COMPOSITION.enabledModules.includes(m.moduleId))
      .map(m => m.moduleId)
    setPinnedModules(prev => {
      const base = prev ?? allSelectable
      const next = pin
        ? [...new Set([...base, moduleId])]
        : base.filter(id => id !== moduleId)
      savePreferences(CQ_COMPOSITION.appId, next).catch(() => {})
      return next
    })
  }, [])

  const handleTabChange = (moduleId: string, tabId: string) => {
    setTabState((prev) => ({ ...prev, [moduleId]: tabId }))
  }

  const activeModDef = CQ_MODULES.find((m) => m.moduleId === activeModule)
  const contextBar = activeModDef?.contextBarSlot && ctxState ? <ContextBar ctx={ctxState} /> : undefined

  return (
    <QueryClientProvider client={queryClient}>
      <PlatformShell
        composition={CQ_COMPOSITION}
        modules={CQ_MODULES}
        activeModule={activeModule}
        tabState={tabState}
        onModuleChange={setActiveModule}
        onTabChange={handleTabChange}
        contextBar={contextBar}
        pinnedModules={pinnedModules}
        onModulePinToggle={handleModulePinToggle}
      >
        <ActivePage mod={activeModule} />
      </PlatformShell>
    </QueryClientProvider>
  )
}
