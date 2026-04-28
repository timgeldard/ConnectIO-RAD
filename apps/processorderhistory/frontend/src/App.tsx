// @ts-nocheck
import { useEffect, useState } from 'react'
import { LangProvider } from './i18n/context'
import { Sidebar } from './ui'
import { OrderList } from './pages/OrderList'
import { OrderDetail } from './pages/OrderDetail'
import { PlanningBoard } from './pages/PlanningBoard'
import { PourAnalyticsPage } from './pages/PourAnalytics'
import { fetchCurrentUser, type CurrentUser } from './api/me'
import { ORDERS } from './data/mock'

type View =
  | { name: 'list' }
  | { name: 'detail'; order: any }
  | { name: 'planning' }
  | { name: 'pours' }

const HOUR = 3600 * 1000

export default function App() {
  const [view, setView] = useState<View>({ name: 'list' })
  const [lineFilter, setLineFilter] = useState('ALL')
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)

  useEffect(() => {
    fetchCurrentUser().then(u => setCurrentUser(u)).catch(() => {})
  }, [])

  const sidebarActive =
    view.name === 'planning' ? 'planning' :
    view.name === 'pours' ? 'pours' :
    'orders'

  const onNavigate = (key: string) => {
    if (key === 'planning') setView({ name: 'planning' })
    else if (key === 'orders') setView({ name: 'list' })
    else if (key === 'pours') setView({ name: 'pours' })
    window.scrollTo(0, 0)
  }

  // Cross-view jump used by KPI strip and planning-board drill-throughs.
  useEffect(() => {
    ;(window as any).__navigateToPourAnalytics = () => {
      setView({ name: 'pours' })
      window.scrollTo(0, 0)
    }
    ;(window as any).__navigateToOrder = (poId: string | number, ctx: any) => {
      const list = ORDERS as any[]
      let order = list.find(o => o.processOrderId === String(poId))
      if (!order) {
        const c = ctx || {}
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
      setView({ name: 'detail', order })
      window.scrollTo(0, 0)
    }
    return () => {
      ;(window as any).__navigateToPourAnalytics = undefined
      ;(window as any).__navigateToOrder = undefined
    }
  }, [])

  return (
    <LangProvider>
      <div className="app">
        <Sidebar active={sidebarActive} onNavigate={onNavigate} user={currentUser} />
        <main className="main">
          {view.name === 'list' && (
            <OrderList
              onOpen={(order) => { setView({ name: 'detail', order }); window.scrollTo(0, 0) }}
              lineFilter={lineFilter}
              setLineFilter={setLineFilter}
            />
          )}
          {view.name === 'detail' && (
            <OrderDetail
              order={view.order}
              onBack={() => { setView({ name: 'list' }); window.scrollTo(0, 0) }}
            />
          )}
          {view.name === 'planning' && <PlanningBoard />}
          {view.name === 'pours' && <PourAnalyticsPage />}
        </main>
      </div>
    </LangProvider>
  )
}
