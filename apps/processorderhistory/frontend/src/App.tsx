import { useCallback, useEffect, useState } from 'react'
import { LangProvider } from './i18n/context'
import { PlatformShell, parseCrossAppContext } from '@connectio/shared-ui'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { POH_MODULES, POH_COMPOSITION } from './manifest'
import { OrderList } from './pages/OrderList'
import { OrderDetail } from './pages/OrderDetail'
import { PlanningBoard } from './pages/PlanningBoard'
import { PourAnalyticsPage } from './pages/PourAnalytics'
import { DayView } from './pages/DayView'
import { LinesideMonitorPage } from './pages/LinesideMonitor'
import { YieldAnalyticsPage } from './pages/YieldAnalytics'
import { QualityAnalyticsPage } from './pages/QualityAnalytics'
import { VesselPlanningAnalyticsPage } from './pages/VesselPlanningAnalytics'
import { EquipmentInsightsPage } from './pages/EquipmentInsights'
import { EquipmentInsights2Page } from './pages/EquipmentInsights2'
import { fetchCurrentUser, type CurrentUser } from './api/me'
import { fetchPreferences, savePreferences } from './api/preferences'
import { PlantProvider } from '@connectio/shared-app-context'
import { GenieDrawer } from './genie/GenieDrawer'
import { buildGeniePageContext } from './genie/pageContext'

type View =
  | { name: 'list' }
  | { name: 'detail'; order: any; from: 'list' | 'planning' | 'day-view' | 'pours' | 'yield' | 'quality' | 'vessel-planning' }
  | { name: 'planning' }
  | { name: 'pours' }
  | { name: 'day-view' }
  | { name: 'lineside-monitor' }
  | { name: 'yield' }
  | { name: 'quality' }
  | { name: 'vessel-planning' }
  | { name: 'equipment-insights' }
  | { name: 'equipment-insights-2' }

function viewToModule(view: View): string {
  switch (view.name) {
    case 'list':
    case 'detail':            return 'poh-orders'
    case 'planning':          return 'planning-board'
    case 'quality':           return 'quality-analytics'
    default:                  return view.name
  }
}

function moduleToView(moduleId: string): View {
  switch (moduleId) {
    case 'home':
    case 'poh-orders':           return { name: 'list' }
    case 'planning-board':       return { name: 'planning' }
    case 'quality-analytics':    return { name: 'quality' }
    case 'pours':                return { name: 'pours' }
    case 'day-view':             return { name: 'day-view' }
    case 'lineside-monitor':     return { name: 'lineside-monitor' }
    case 'yield':                return { name: 'yield' }
    case 'vessel-planning':      return { name: 'vessel-planning' }
    case 'equipment-insights':   return { name: 'equipment-insights' }
    case 'equipment-insights-2': return { name: 'equipment-insights-2' }
    default:                     return { name: 'list' }
  }
}

function AppContent() {
  const [view, setView] = useState<View>(() => {
    const m = new URLSearchParams(window.location.search).get('module')
    return m ? moduleToView(m) : { name: 'list' }
  })
  const [lineFilter, setLineFilter] = useState('ALL')
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [genieOpen, setGenieOpen] = useState(false)
  const [pinnedModules, setPinnedModules] = useState<string[] | null>(null)

  useEffect(() => {
    fetchCurrentUser().then(u => setCurrentUser(u)).catch(() => {})
  }, [])

  useEffect(() => {
    fetchPreferences(POH_COMPOSITION.appId)
      .then(prefs => setPinnedModules(prefs.pinnedModules))
      .catch(() => {})
  }, [])

  const handleModulePinToggle = useCallback((moduleId: string, pin: boolean) => {
    const allSelectable = POH_MODULES
      .filter(m => m.isUserSelectable && POH_COMPOSITION.enabledModules.includes(m.moduleId))
      .map(m => m.moduleId)
    setPinnedModules(prev => {
      const base = prev ?? allSelectable
      const next = pin
        ? [...new Set([...base, moduleId])]
        : base.filter(id => id !== moduleId)
      savePreferences(POH_COMPOSITION.appId, next).catch(() => {})
      return next
    })
  }, [])

  const handleModuleChange = (moduleId: string) => {
    setView(moduleToView(moduleId))
    window.scrollTo(0, 0)
  }

  useEffect(() => {
    ;(window as any).__navigateToPourAnalytics = () => {
      setView({ name: 'pours' })
      window.scrollTo(0, 0)
    }
    ;(window as any).__navigateToOrder = (poId: string | number, ctx: any) => {
      const c = ctx || {}
      const order = {
        id: String(poId),
        processOrderId: String(poId),
        status: 'unknown',
      }
      const fromView =
        c._from === 'planning' ? 'planning' :
        c._from === 'day-view' ? 'day-view' :
        c._from === 'pours' ? 'pours' :
        c._from === 'yield' ? 'yield' :
        c._from === 'quality' ? 'quality' :
        c._from === 'vessel-planning' ? 'vessel-planning' : 'list'
      setView({ name: 'detail', order, from: fromView })
      window.scrollTo(0, 0)
    }
    return () => {
      ;(window as any).__navigateToPourAnalytics = undefined
      ;(window as any).__navigateToOrder = undefined
    }
  }, [])

  // Handle cross-app navigation context from platform deployment URL params.
  // e.g. /poh?entity=processOrder&processOrderId=1001234&from=cq.trace
  useEffect(() => {
    const ctx = parseCrossAppContext()
    if (!ctx) return
    if (ctx.entity === 'processOrder' && ctx.processOrderId) {
      const from = ctx.from?.includes('planning') ? 'planning' : 'list'
      ;(window as any).__navigateToOrder?.(ctx.processOrderId, { _from: from })
    } else if (ctx.entity === 'pourAnalytics') {
      ;(window as any).__navigateToPourAnalytics?.()
    }
  }, [])

  return (
    <PlatformShell
      composition={POH_COMPOSITION}
      modules={POH_MODULES}
      activeModule={viewToModule(view)}
      tabState={{}}
      onModuleChange={handleModuleChange}
      onTabChange={() => {}}
      userInitials={currentUser?.initials ?? '—'}
      userName={currentUser?.name ?? ''}
      pinnedModules={pinnedModules}
      onModulePinToggle={handleModulePinToggle}
    >
      {view.name === 'list' && (
        <OrderList
          onOpen={(order) => { setView({ name: 'detail', order, from: 'list' }); window.scrollTo(0, 0) }}
          lineFilter={lineFilter}
          setLineFilter={setLineFilter}
        />
      )}
      {view.name === 'detail' && (
        <OrderDetail
          order={view.order}
          from={view.from}
          onBack={() => {
            if (view.from === 'planning') setView({ name: 'planning' })
            else if (view.from === 'day-view') setView({ name: 'day-view' })
            else if (view.from === 'pours') setView({ name: 'pours' })
            else if (view.from === 'yield') setView({ name: 'yield' })
            else if (view.from === 'quality') setView({ name: 'quality' })
            else if (view.from === 'vessel-planning') setView({ name: 'vessel-planning' })
            else setView({ name: 'list' })
            window.scrollTo(0, 0)
          }}
        />
      )}
      {view.name === 'planning' && <PlanningBoard />}
      {view.name === 'pours' && <PourAnalyticsPage />}
      {view.name === 'day-view' && <DayView />}
      {view.name === 'lineside-monitor' && <LinesideMonitorPage />}
      {view.name === 'yield' && <YieldAnalyticsPage />}
      {view.name === 'quality' && <QualityAnalyticsPage />}
      {view.name === 'vessel-planning' && <VesselPlanningAnalyticsPage />}
      {view.name === 'equipment-insights' && <EquipmentInsightsPage />}
      {view.name === 'equipment-insights-2' && <EquipmentInsights2Page />}
      <GenieDrawer
        open={genieOpen}
        onOpen={() => setGenieOpen(true)}
        onClose={() => setGenieOpen(false)}
        pageContext={buildGeniePageContext(view, lineFilter)}
      />
    </PlatformShell>
  )
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    }
  }
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LangProvider>
        <PlantProvider appName="processorderhistory">
          <AppContent />
        </PlantProvider>
      </LangProvider>
    </QueryClientProvider>
  )
}
