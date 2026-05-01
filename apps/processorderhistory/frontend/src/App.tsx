// @ts-nocheck
import { useEffect, useState, useMemo } from 'react'
import { LangProvider } from './i18n/context'
import { useT } from './i18n/context'
import { AppShell, Sidebar, type NavGroup } from '@connectio/shared-ui'
import { OrderList } from './pages/OrderList'
import { OrderDetail } from './pages/OrderDetail'
import { PlanningBoard } from './pages/PlanningBoard'
import { PourAnalyticsPage } from './pages/PourAnalytics'
import { DayView } from './pages/DayView'
import { YieldAnalyticsPage } from './pages/YieldAnalytics'
import { QualityAnalyticsPage } from './pages/QualityAnalytics'
import { VesselPlanningAnalyticsPage } from './pages/VesselPlanningAnalytics'
import { EquipmentInsightsPage } from './pages/EquipmentInsights'
import { fetchCurrentUser, type CurrentUser } from './api/me'
import { ORDERS } from './data/mock'
import { GenieDrawer } from './genie/GenieDrawer'
import { buildGeniePageContext } from './genie/pageContext'

type View =
  | { name: 'list' }
  | { name: 'detail'; order: any; from: 'list' | 'planning' | 'day-view' | 'pours' | 'yield' | 'quality' | 'vessel-planning' }
  | { name: 'planning' }
  | { name: 'pours' }
  | { name: 'day-view' }
  | { name: 'yield' }
  | { name: 'quality' }
  | { name: 'vessel-planning' }
  | { name: 'equipment-insights' }

const HOUR = 3600 * 1000

function AppContent() {
  const { t } = useT()
  const [view, setView] = useState<View>({ name: 'list' })
  const [lineFilter, setLineFilter] = useState('ALL')
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [genieOpen, setGenieOpen] = useState(false)

  useEffect(() => {
    fetchCurrentUser().then(u => setCurrentUser(u)).catch(() => {})
  }, [])

  const activeId =
    view.name === 'planning' ? 'planning' :
    view.name === 'pours' ? 'pours' :
    view.name === 'day-view' ? 'day-view' :
    view.name === 'yield' ? 'yield' :
    view.name === 'quality' ? 'quality' :
    view.name === 'vessel-planning' ? 'vessel-planning' :
    view.name === 'equipment-insights' ? 'equipment-insights' :
    'orders'

  const onNavigate = (key: string) => {
    if (key === 'planning') setView({ name: 'planning' })
    else if (key === 'orders') setView({ name: 'list' })
    else if (key === 'pours') setView({ name: 'pours' })
    else if (key === 'day-view') setView({ name: 'day-view' })
    else if (key === 'yield') setView({ name: 'yield' })
    else if (key === 'quality') setView({ name: 'quality' })
    else if (key === 'vessel-planning') setView({ name: 'vessel-planning' })
    else if (key === 'equipment-insights') setView({ name: 'equipment-insights' })
    window.scrollTo(0, 0)
  }

  const navGroups: NavGroup[] = useMemo(() => [
    {
      label: t.sectionOperate,
      items: [
        { id: 'planning', label: t.navPlanning, icon: 'layers' },
        { id: 'orders',   label: t.navOrders,   icon: 'history' },
        { id: 'vessel-planning', label: t.navVesselPlanning || 'Vessel planning', icon: 'cpu' },
      ]
    },
    {
      label: t.sectionInsights,
      items: [
        { id: 'day-view', label: t.navDayView || 'Day view', icon: 'clock' },
        { id: 'pours',    label: t.navPours || 'Pour analytics', icon: 'package' },
        { id: 'yield',    label: t.navYield,    icon: 'trending-up' },
        { id: 'quality',  label: t.navQuality || 'Quality analytics', icon: 'shield' },
        { id: 'equipment-insights', label: t.navEquipmentInsights || 'Equipment insights', icon: 'beaker' },
      ]
    }
  ], [t])

  // Cross-view jump used by KPI strip and planning-board drill-throughs.
  useEffect(() => {
    ;(window as any).__navigateToPourAnalytics = () => {
      setView({ name: 'pours' })
      window.scrollTo(0, 0)
    }
    ;(window as any).__navigateToOrder = (poId: string | number, ctx: any) => {
      const list = ORDERS as any[]
      let order = list.find(o => o.processOrderId === String(poId))
      const c = ctx || {}
      if (!order) {
        const start = c.start || (Date.now() - 4 * HOUR)
        const end = c.end || null
        order = {
          processOrderId: String(poId),
          id: String(poId),
          materialId: c.materialId || 'MAT-000000',
          materialDescription: c.label || 'Process order',
          plantId: c.plantId || 'LND1',
          batchId: '8' + String(poId).slice(-9).padStart(9, '0'),
          supplierBatchId: '—',
          manufactureDate: start,
          expiryDate: start + 540 * 24 * HOUR,
          allergens: ['—'],
          orderStatus: c.kind === 'running' ? 'In progress' : c.kind === 'material-short' ? 'On hold' : 'Released',
          lot: 'BATCH-' + String(poId).slice(-6),
          product: { sku: c.materialId || 'MAT-000000', name: c.label || 'Process order', category: c.category || '—', fullName: c.label || 'Process order' },
          plant: { code: c.plantId || 'LND1', name: 'Listowel' },
          operator: c.operator || '—',
          status: c.kind === 'running' ? 'running' : c.kind === 'material-short' ? 'onhold' : 'released',
          targetQty: c.qty || 1000,
          actualQty: c.kind === 'running' ? Math.round((c.qty || 1000) * 0.4) : 0,
          yieldPct: null,
          start,
          end,
          durationH: c.end && c.start ? Math.round((c.end - c.start) / HOUR * 10) / 10 : null,
          shift: c.shift || 'A',
          line: c.lineId || 'Line 1',
          __planningMaterials: c.materials || null,
          __planningKind: c.kind || null,
          __planningShortageETA: c.shortageETA || null,
        }
      }
      const fromView = c._from === 'planning' ? 'planning' : c._from === 'day-view' ? 'day-view' : c._from === 'pours' ? 'pours' : c._from === 'yield' ? 'yield' : c._from === 'quality' ? 'quality' : c._from === 'vessel-planning' ? 'vessel-planning' : 'list'
      setView({ name: 'detail', order, from: fromView })
      window.scrollTo(0, 0)
    }
    return () => {
      ;(window as any).__navigateToPourAnalytics = undefined
      ;(window as any).__navigateToOrder = undefined
    }
  }, [])

  return (
    <AppShell
      sidebar={
        <Sidebar
          appTag="Operations"
          groups={navGroups}
          activeId={activeId}
          onNavigate={onNavigate}
          footer={
            <>
              <div style={{
                width: 28, height: 28, borderRadius: 999,
                background: 'var(--sage)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 11, flexShrink: 0,
              }}>
                {currentUser?.initials ?? '—'}
              </div>
              <div style={{ fontSize: 11.5, lineHeight: 1.3, minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 600, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {currentUser?.name ?? '…'}
                </div>
              </div>
            </>
          }
        />
      }
    >
      <main className="main">
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
        {view.name === 'yield' && <YieldAnalyticsPage />}
        {view.name === 'quality' && <QualityAnalyticsPage />}
        {view.name === 'vessel-planning' && <VesselPlanningAnalyticsPage />}
        {view.name === 'equipment-insights' && <EquipmentInsightsPage />}
      </main>
      <GenieDrawer
        open={genieOpen}
        onOpen={() => setGenieOpen(true)}
        onClose={() => setGenieOpen(false)}
        pageContext={buildGeniePageContext(view, lineFilter)}
      />
    </AppShell>
  )
}

export default function App() {
  return (
    <LangProvider>
      <AppContent />
    </LangProvider>
  )
}
