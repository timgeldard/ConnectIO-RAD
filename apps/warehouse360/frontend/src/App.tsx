import { useState } from 'react'
import { I18nProvider } from '@connectio/shared-frontend-i18n'
import { PlatformShell } from '@connectio/shared-ui'
import { W360_MODULES, W360_COMPOSITION } from '~/manifest'
import { PlantProvider } from '~/context/PlantContext'
import { PlantContextBar } from '~/components/PlantContextBar'
import { Pill } from '~/components/Primitives'
import { Drawer } from '~/components/Shared'
import { ControlTower } from '~/components/ControlTower'
import { ProductionStaging } from '~/components/ProductionStaging'
import { OrderStagingDetail } from '~/components/OrderDetail'
import { Inbound, ReceiptDetail } from '~/components/Inbound'
import { Outbound, DeliveryDetail } from '~/components/Outbound'
import { Inventory } from '~/components/Inventory'
import { Dispensary } from '~/components/Dispensary'
import { Exceptions, Performance } from '~/components/ExceptionsPerf'
import { DocsPage } from '~/components/Docs'
import resources from '~/i18n/resources.json'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import WM from '~/data/mockData'

/** Discriminated union for the slide-in drawer state. */
type DrawerState =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { type: 'order';    entity: any }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { type: 'delivery'; entity: any }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { type: 'receipt';  entity: any }

/**
 * Maps a PlatformShell moduleId to the internal route string used by the
 * legacy page-switch logic (kept for backwards compatibility with page
 * components that call onNav() with route strings).
 */
function moduleToRoute(moduleId: string): string {
  const map: Record<string, string> = {
    home: 'today',
    'process-orders': 'staging',
    deliveries: 'outbound',
    inbound: 'inbound',
    inventory: 'inventory',
    dispensary: 'dispensary',
    exceptions: 'exceptions',
    performance: 'performance',
  }
  return map[moduleId] ?? moduleId
}

/**
 * Maps the internal route string back to a PlatformShell moduleId so the shell
 * stays in sync when page components call onNav() with a route string.
 */
function routeToModule(route: string): string {
  const map: Record<string, string> = {
    today: 'home',
    staging: 'process-orders',
    outbound: 'deliveries',
    inbound: 'inbound',
    inventory: 'inventory',
    dispensary: 'dispensary',
    exceptions: 'exceptions',
    performance: 'performance',
    docs: 'home', // docs is internal-only; fallback to home module in the rail
  }
  return map[route] ?? 'home'
}

/** Inner app — rendered inside I18nProvider and PlantProvider. */
function WarehouseApp() {
  const [route, setRoute] = useState(() => {
    const m = new URLSearchParams(window.location.search).get('module')
    return m ? moduleToRoute(m) : 'today'
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [drawer, setDrawer] = useState<DrawerState | null>(null)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const openOrder    = (o: any) => setDrawer({ type: 'order',    entity: o })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const openDelivery = (d: any) => setDrawer({ type: 'delivery', entity: d })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const openReceipt  = (r: any) => setDrawer({ type: 'receipt',  entity: r })
  const closeDrawer  = () => setDrawer(null)

  const activeModule = routeToModule(route)

  /** Navigate from the PlatformShell left rail. */
  const handleModuleChange = (moduleId: string) => {
    setRoute(moduleToRoute(moduleId))
  }

  /** Navigate from within page components that call onNav with a route string. */
  const handleNav = (nextRoute: string) => {
    setRoute(nextRoute)
  }

  let page: React.ReactNode = null
  if (route === 'today')          page = <ControlTower onNav={handleNav} onOpenOrder={openOrder} onOpenDelivery={openDelivery} onOpenReceipt={openReceipt}/>
  else if (route === 'staging')   page = <ProductionStaging onOpenOrder={openOrder}/>
  else if (route === 'inbound')   page = <Inbound onOpen={openReceipt}/>
  else if (route === 'outbound')  page = <Outbound onOpen={openDelivery}/>
  else if (route === 'inventory') page = <Inventory/>
  else if (route === 'dispensary')  page = <Dispensary/>
  else if (route === 'exceptions')  page = <Exceptions onOpenOrder={openOrder} onOpenDelivery={openDelivery} onOpenReceipt={openReceipt}/>
  else if (route === 'performance') page = <Performance/>
  else if (route === 'docs')        page = <DocsPage/>

  let drawerContent: React.ReactNode = null
  let drawerTitle = ''
  let drawerSubtitle = ''
  let drawerActions: React.ReactNode = null

  if (drawer?.type === 'order') {
    const o = drawer.entity
    drawerContent = <OrderStagingDetail order={o}/>
    drawerTitle = o.id + ' · ' + o.product.split(' · ')[0]
    drawerSubtitle = (o.line?.name ?? '—') + ' · ' + (o.method?.label ?? '—') + ' · starts ' + (o.start ? WM.fmtTime(o.start) : '—')
    drawerActions = (
      <Pill tone={o.risk === 'red' ? 'red' : o.risk === 'amber' ? 'amber' : 'green'}>
        {o.risk === 'red' ? 'Critical' : o.risk === 'amber' ? 'At risk' : 'On track'}
      </Pill>
    )
  } else if (drawer?.type === 'delivery') {
    const d = drawer.entity
    drawerContent = <DeliveryDetail delivery={d}/>
    drawerTitle = (d.delivery_id ?? d.id) + ' · ' + (d.customer_name ?? d.customer?.name ?? '')
    drawerSubtitle = d.delivery_id
      ? 'GI date ' + (d.planned_gi_date ?? '—') + ' · ' + (d.carrier ?? '—')
      : 'Cut-off ' + WM.fmtTime(d.cutoff) + ' · Dock ' + d.dock.id + ' · ' + d.carrier
  } else if (drawer?.type === 'receipt') {
    const r = drawer.entity
    drawerContent = <ReceiptDetail receipt={r}/>
    drawerTitle = (r.po_id ?? r.id) + ' · ' + (r.vendor_name ?? r.vendor?.name ?? '')
    drawerSubtitle = r.po_id
      ? 'PO · Due ' + (r.delivery_date ?? '—')
      : r.type + ' · ETA ' + WM.fmtTime(r.eta) + ' · Dock ' + r.dock.id
  }

  return (
    <div style={{ position: 'relative' }}>
      <PlatformShell
        composition={W360_COMPOSITION}
        modules={W360_MODULES}
        activeModule={activeModule}
        tabState={{}}
        onModuleChange={handleModuleChange}
        onTabChange={() => {}}
        contextBar={<PlantContextBar />}
        userInitials="NM"
        userName="Niamh Murphy"
        userRole="Warehouse Manager"
      >
        {page}
      </PlatformShell>
      <Drawer open={!!drawer} onClose={closeDrawer} title={drawerTitle} subtitle={drawerSubtitle} actions={drawerActions}>
        {drawerContent}
      </Drawer>
    </div>
  )
}

/** Root component — provides i18n and plant context to the entire app. */
export default function App() {
  return (
    <I18nProvider appName="warehouse360" resources={resources}>
      <PlantProvider>
        <WarehouseApp />
      </PlantProvider>
    </I18nProvider>
  )
}
