import React from 'react';
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

const App = () => {
  const [route, setRoute] = React.useState('today');
  const [drawer, setDrawer] = React.useState(null);
  const shift = WM.SHIFTS[1];

  const openOrder    = (o) => setDrawer({ type: 'order',    entity: o });
  const openDelivery = (d) => setDrawer({ type: 'delivery', entity: d });
  const openReceipt  = (r) => setDrawer({ type: 'receipt',  entity: r });
  const closeDrawer  = () => setDrawer(null);

  const titles = {
    today:       ['Control Tower',      'Live operations — ' + WM.fmtTime(WM.NOW)],
    staging:     ['Production Staging', 'Materials staged for process orders'],
    inbound:     ['Inbound',            'Purchase orders & stock transport receipts'],
    outbound:    ['Outbound',           'Customer deliveries — pick, stage, load'],
    inventory:   ['Inventory & Bins',   'Bin health, line-side stock, batch expiry'],
    dispensary:  ['Dispensary',         'Weighed micro ingredients'],
    exceptions:  ['Exceptions',         'Prioritised operational risk'],
    performance: ['Performance',        '14-day KPIs across staging, inbound, outbound'],
    docs:        ['Concept & Specs',    'Product concept · KPI catalogue · data model'],
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
    drawerSubtitle = drawer.entity.line.name + ' · ' + drawer.entity.method.label + ' · starts ' + WM.fmtTime(drawer.entity.start);
    drawerActions = <Pill tone={drawer.entity.risk === 'red' ? 'red' : drawer.entity.risk === 'amber' ? 'amber' : 'green'}>
      {drawer.entity.risk === 'red' ? 'Critical' : drawer.entity.risk === 'amber' ? 'At risk' : 'On track'}
    </Pill>;
  } else if (drawer?.type === 'delivery') {
    drawerContent = <DeliveryDetail delivery={drawer.entity}/>;
    drawerTitle = drawer.entity.id + ' · ' + drawer.entity.customer.name;
    drawerSubtitle = 'Cut-off ' + WM.fmtTime(drawer.entity.cutoff) + ' · Dock ' + drawer.entity.dock.id + ' · ' + drawer.entity.carrier;
  } else if (drawer?.type === 'receipt') {
    drawerContent = <ReceiptDetail receipt={drawer.entity}/>;
    drawerTitle = drawer.entity.id + ' · ' + drawer.entity.vendor.name;
    drawerSubtitle = drawer.entity.type + ' · ETA ' + WM.fmtTime(drawer.entity.eta) + ' · Dock ' + drawer.entity.dock.id;
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

export default App;
