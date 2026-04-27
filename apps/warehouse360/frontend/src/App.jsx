import React from 'react';
import { I18nProvider, useI18n } from '@connectio/shared-frontend-i18n';
import WM from './data/mockData.js';
import { Pill } from './components/Primitives.jsx';
import { Sidebar, TopBar, MobileNav } from './components/Shell.jsx';
import { Drawer } from './components/Shared.jsx';
import { ControlTower } from './components/ControlTower.jsx';
import { ProductionStaging } from './components/ProductionStaging.jsx';
import { OrderStagingDetail } from './components/OrderDetail.jsx';
import { Inbound, ReceiptDetail } from './components/Inbound.jsx';
import { Outbound, DeliveryDetail } from './components/Outbound.jsx';
import { Inventory } from './components/Inventory.jsx';
import { Dispensary } from './components/Dispensary.jsx';
import { Exceptions, Performance } from './components/ExceptionsPerf.jsx';
import { DocsPage } from './components/Docs.jsx';
import { PlantProvider } from './context/PlantContext.jsx';
import resources from './i18n/resources.json';

const WarehouseApp = () => {
  const { t } = useI18n();
  const [route, setRoute] = React.useState('today');
  const [drawer, setDrawer] = React.useState(null);
  const shift = WM.SHIFTS[1];

  const openOrder    = (o) => setDrawer({ type: 'order',    entity: o });
  const openDelivery = (d) => setDrawer({ type: 'delivery', entity: d });
  const openReceipt  = (r) => setDrawer({ type: 'receipt',  entity: r });
  const closeDrawer  = () => setDrawer(null);

  const titles = {
    today:       [t('warehouse.title.today'),       t('warehouse.subtitle.today', { time: WM.fmtTime(WM.NOW) })],
    staging:     [t('warehouse.title.staging'),     t('warehouse.subtitle.staging')],
    inbound:     [t('warehouse.title.inbound'),     t('warehouse.subtitle.inbound')],
    outbound:    [t('warehouse.title.outbound'),    t('warehouse.subtitle.outbound')],
    inventory:   [t('warehouse.title.inventory'),   t('warehouse.subtitle.inventory')],
    dispensary:  [t('warehouse.title.dispensary'),  t('warehouse.subtitle.dispensary')],
    exceptions:  [t('warehouse.title.exceptions'),  t('warehouse.subtitle.exceptions')],
    performance: [t('warehouse.title.performance'), t('warehouse.subtitle.performance')],
    docs:        [t('warehouse.title.docs'),        t('warehouse.subtitle.docs')],
  };
  const [title, subtitle] = titles[route] || ['', ''];

  let page = null;
  if (route === 'today')       page = <ControlTower onNav={setRoute} onOpenOrder={openOrder} onOpenDelivery={openDelivery} onOpenReceipt={openReceipt}/>;
  else if (route === 'staging')    page = <ProductionStaging onOpenOrder={openOrder}/>;
  else if (route === 'inbound')    page = <Inbound onOpen={openReceipt}/>;
  else if (route === 'outbound')   page = <Outbound onOpen={openDelivery}/>;
  else if (route === 'inventory')  page = <Inventory/>;
  else if (route === 'dispensary') page = <Dispensary/>;
  else if (route === 'exceptions') page = <Exceptions onOpenOrder={openOrder} onOpenDelivery={openDelivery} onOpenReceipt={openReceipt}/>;
  else if (route === 'performance') page = <Performance/>;
  else if (route === 'docs')       page = <DocsPage/>;

  let drawerContent = null, drawerTitle = '', drawerSubtitle = '', drawerActions = null;
  if (drawer?.type === 'order') {
    drawerContent = <OrderStagingDetail order={drawer.entity}/>;
    drawerTitle = drawer.entity.id + ' · ' + drawer.entity.product.split(' · ')[0];
    drawerSubtitle = (drawer.entity.line?.name ?? '—') + ' · ' + (drawer.entity.method?.label ?? '—') + ' · starts ' + (drawer.entity.start ? WM.fmtTime(drawer.entity.start) : '—');
    drawerActions = <Pill tone={drawer.entity.risk === 'red' ? 'red' : drawer.entity.risk === 'amber' ? 'amber' : 'green'}>
      {drawer.entity.risk === 'red' ? 'Critical' : drawer.entity.risk === 'amber' ? 'At risk' : 'On track'}
    </Pill>;
  } else if (drawer?.type === 'delivery') {
    drawerContent = <DeliveryDetail delivery={drawer.entity}/>;
    const d = drawer.entity;
    drawerTitle = (d.delivery_id ?? d.id) + ' · ' + (d.customer_name ?? d.customer?.name ?? '');
    drawerSubtitle = d.delivery_id
      ? 'GI date ' + (d.planned_gi_date ?? '—') + ' · ' + (d.carrier ?? '—')
      : 'Cut-off ' + WM.fmtTime(d.cutoff) + ' · Dock ' + d.dock.id + ' · ' + d.carrier;
  } else if (drawer?.type === 'receipt') {
    drawerContent = <ReceiptDetail receipt={drawer.entity}/>;
    const r = drawer.entity;
    drawerTitle = (r.po_id ?? r.id) + ' · ' + (r.vendor_name ?? r.vendor?.name ?? '');
    drawerSubtitle = r.po_id
      ? 'PO · Due ' + (r.delivery_date ?? '—')
      : r.type + ' · ETA ' + WM.fmtTime(r.eta) + ' · Dock ' + r.dock.id;
  }

  return (
    <div className="app">
      <Sidebar current={route} onNav={setRoute} shift={shift}/>
      <div className="app-main">
        <TopBar title={title} subtitle={subtitle}/>
        {page}
        <MobileNav current={route} onNav={setRoute}/>
      </div>
      <Drawer open={!!drawer} onClose={closeDrawer} title={drawerTitle} subtitle={drawerSubtitle} actions={drawerActions}>
        {drawerContent}
      </Drawer>
    </div>
  );
};

const App = () => (
  <I18nProvider appName="warehouse360" resources={resources}>
    <PlantProvider>
      <WarehouseApp />
    </PlantProvider>
  </I18nProvider>
);

export default App;
