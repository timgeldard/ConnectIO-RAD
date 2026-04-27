import React from 'react';
import { useI18n } from '@connectio/shared-frontend-i18n';
import WM from '../data/mockData.js';
import { useApi } from '../hooks/useApi.js';
import { Icon, Pill, Progress, RiskDot, Hbar } from './Primitives.jsx';
import { KPI, Card } from './Shared.jsx';
import { StagingTimeline } from './ProductionStaging.jsx';

/* Control Tower — warehouse manager's landing page */

const ControlTower = ({ onNav, onOpenOrder, onOpenDelivery, onOpenReceipt }) => {
  const { t } = useI18n();
  const { data: kpiResp } = useApi('/api/kpis');
  const kpis = kpiResp?.kpis ?? null;

  const redOrders = WM.PROCESS_ORDERS.filter((o) => o.risk === 'red').slice(0, 5);
  const amberOrders = WM.PROCESS_ORDERS.filter((o) => o.risk === 'amber').slice(0, 4);
  const criticalEx = WM.EXCEPTIONS.filter((e) => e.type.severity === 'critical').slice(0, 5);
  const inboundToday = WM.INBOUND.filter((r) => WM.minutesFromNow(r.eta) < 8 * 60 && WM.minutesFromNow(r.eta) > -6 * 60).slice(0, 6);
  const outboundToday = WM.DELIVERIES.filter((d) => WM.minutesFromNow(d.cutoff) > -3 * 60 && WM.minutesFromNow(d.cutoff) < 10 * 60).slice(0, 6);
  const ageingTOs = WM.TOs.filter((to) => to.status !== 'Confirmed' && to.ageMin > 120).slice(0, 5);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Kerry Naas · {WM.fmtTime(WM.NOW)} · Shift B · Wed 24 Apr</div>
          <h1 className="page-title">Good morning, Niamh</h1>
          <div className="page-desc">Eight orders at risk, three critical. Dispensary is 2 weighings short for 11:30 campaign. Vendor Symrise slipped two hours on paprika.</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary"><Icon name="download" size={14}/> {t('warehouse.ct.btn.shiftReport')}</button>
          <button className="btn btn-secondary"><Icon name="user" size={14}/> {t('warehouse.ct.btn.handOver')}</button>
          <button className="btn btn-primary"><Icon name="flag" size={14}/> {t('warehouse.ct.btn.escalate')}</button>
        </div>
      </div>

      {/* Top KPI strip */}
      <div className="kpi-grid">
        <KPI label={t('warehouse.ct.kpi.ordersAtRisk')} value={kpis?.orders_red ?? '…'} tone={kpis?.orders_red > 0 ? 'critical' : 'ok'}/>
        <KPI label={t('warehouse.ct.kpi.ordersAmber')} value={kpis?.orders_amber ?? '…'} tone={kpis?.orders_amber > 0 ? 'warn' : 'ok'}/>
        <KPI label={t('warehouse.ct.kpi.openTOs')} value={kpis?.tos_open ?? '…'} unit=" TOs" tone="ok"/>
        <KPI label={t('warehouse.ct.kpi.deliveriesAtRisk')} value={kpis?.deliveries_at_risk ?? '…'} tone={kpis?.deliveries_at_risk > 0 ? 'warn' : 'ok'}/>
        <KPI label={t('warehouse.ct.kpi.openInbound')} value={kpis?.inbound_open ?? '…'} unit=" lines" tone="ok"/>
        <KPI label={t('warehouse.ct.kpi.binUtil')} value={kpis?.bin_util_pct ?? '…'} unit="%" tone={kpis?.bin_util_pct > 92 ? 'critical' : kpis?.bin_util_pct > 80 ? 'warn' : 'ok'} barPct={kpis?.bin_util_pct ?? 0} barTone={kpis?.bin_util_pct > 92 ? 'red' : kpis?.bin_util_pct > 80 ? 'amber' : ''}/>
      </div>

      {/* Today's run sheet + Critical exceptions */}
      <div className="grid-asym" style={{ marginBottom: 16 }}>
        <Card title={t('warehouse.ct.card.runSheet')} subtitle="6 lines · click a bar to drill in" eyebrow="Schedule" tight
          actions={<button className="btn btn-sm btn-ghost" onClick={() => onNav('staging')}>Open staging <Icon name="arrowRight" size={12}/></button>}>
          <StagingTimeline onOpen={onOpenOrder}/>
        </Card>

        <Card title={t('warehouse.ct.card.criticalExceptions')} subtitle="Needs action now" eyebrow="Risk"
          actions={<button className="btn btn-sm btn-ghost" onClick={() => onNav('exceptions')}><Icon name="external" size={12}/></button>}>
          <div className="stack-8">
            {criticalEx.map((e, i) => (
              <button key={i} onClick={() => onOpenOrder(e.po)} style={{ textAlign: 'left', padding: 10, background: 'color-mix(in srgb, var(--sunset) 6%, white)', border: '1px solid color-mix(in srgb, var(--sunset) 20%, transparent)', borderRadius: 6, width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--forest)' }}>{e.type.title}</div>
                  <span className="mono small muted">{e.ageMin}m</span>
                </div>
                <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>{e.detail}{e.po ? ' · ' + e.po.id : ''}</div>
                <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                  <Pill tone="red" noDot>{e.type.domain}</Pill>
                  {e.owner && <Pill tone="grey" noDot>{e.owner}</Pill>}
                </div>
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* Workload + Production at risk */}
      <div className="grid-2" style={{ marginBottom: 16 }}>
        <Card title={t('warehouse.ct.card.workload')} subtitle="Open · in progress · confirmed tasks this shift" eyebrow="Warehouse tasks">
          <div className="stack-8">
            {WM.WORKLOAD.map((w, i) => {
              const total = w.open + w.inProgress + w.confirmed;
              return (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--forest)' }}>{w.area}</span>
                    <span className="mono small muted">{w.confirmed}/{total} · {w.exceptions > 0 && <span className="red">{w.exceptions} exc</span>}</span>
                  </div>
                  <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--stone)' }}>
                    <div style={{ width: (w.confirmed / total * 100) + '%', background: 'var(--jade)' }}/>
                    <div style={{ width: (w.inProgress / total * 100) + '%', background: 'var(--valentia-slate)' }}/>
                    <div style={{ width: (w.open / total * 100) + '%', background: 'var(--stone-300)' }}/>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-12" style={{ marginTop: 12, fontSize: 11, color: 'var(--fg-muted)' }}>
            <span className="flex items-center gap-4"><span style={{ width: 8, height: 8, background: 'var(--jade)', borderRadius: 2 }}/>{t('warehouse.common.legend.confirmed')}</span>
            <span className="flex items-center gap-4"><span style={{ width: 8, height: 8, background: 'var(--valentia-slate)', borderRadius: 2 }}/>{t('warehouse.common.legend.inProgress')}</span>
            <span className="flex items-center gap-4"><span style={{ width: 8, height: 8, background: 'var(--stone-300)', borderRadius: 2 }}/>{t('warehouse.common.legend.open')}</span>
          </div>
        </Card>

        <Card title={t('warehouse.ct.card.productionAtRisk')} subtitle={`${redOrders.length} critical · ${amberOrders.length} at risk`} eyebrow="Production staging"
          actions={<button className="btn btn-sm btn-ghost" onClick={() => onNav('staging')}>All <Icon name="arrowRight" size={12}/></button>} tight>
          <table className="tbl">
            <thead><tr><th></th><th>{t('warehouse.common.col.order')}</th><th>{t('warehouse.common.col.line')}</th><th>{t('warehouse.common.col.start')}</th><th className="num">{t('warehouse.common.col.staging')}</th><th></th></tr></thead>
            <tbody>
              {[...redOrders, ...amberOrders].slice(0, 8).map((o) => (
                <tr key={o.id} className={`is-risk-${o.risk}`} onClick={() => onOpenOrder(o)}>
                  <td><RiskDot risk={o.risk}/></td>
                  <td><span className="code">{o.id}</span><div className="muted" style={{ fontSize: 11 }}>{o.product.split(' · ')[0]}</div></td>
                  <td style={{ fontSize: 12 }}>{o.line.id}</td>
                  <td className="mono small">{WM.fmtTime(o.start)}</td>
                  <td className="num" style={{ width: 120 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end' }}>
                      <span className="mono" style={{ fontSize: 11 }}>{o.stagingPct}%</span>
                      <div style={{ width: 44 }}><Progress pct={o.stagingPct} tone={o.risk === 'red' ? 'red' : 'amber'}/></div>
                    </div>
                  </td>
                  <td><Icon name="chevronRight" size={12} color="var(--fg-muted)"/></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {/* Inbound + Outbound due today */}
      <div className="grid-2" style={{ marginBottom: 16 }}>
        <Card title={t('warehouse.ct.card.inboundToday')} subtitle={`${inboundToday.filter((r) => r.status === 'Expected').length} expected · ${inboundToday.filter((r) => r.status === 'Overdue').length} overdue`}
          eyebrow="PO / STO"
          actions={<button className="btn btn-sm btn-ghost" onClick={() => onNav('inbound')}>All <Icon name="arrowRight" size={12}/></button>} tight>
          <table className="tbl">
            <thead><tr><th>{t('warehouse.common.col.type')}</th><th>Doc</th><th>{t('warehouse.ct.col.vendorPlant')}</th><th>{t('warehouse.common.col.material')}</th><th>{t('warehouse.ct.col.eta')}</th><th>{t('warehouse.common.col.status')}</th></tr></thead>
            <tbody>
              {inboundToday.map((r) => (
                <tr key={r.id} onClick={() => onOpenReceipt(r)} className={`is-risk-${r.risk}`}>
                  <td><Pill tone={r.type === 'PO' ? 'slate' : 'sage'} noDot>{r.type}</Pill></td>
                  <td className="code">{r.id}</td>
                  <td><div style={{ fontSize: 12 }}>{r.vendor.name}</div><div className="muted" style={{ fontSize: 11 }}>{r.vendor.id}</div></td>
                  <td><div style={{ fontSize: 12 }}>{r.material.name}</div><div className="muted" style={{ fontSize: 11 }}>{r.expectedQty} {r.uom}</div></td>
                  <td className="mono small">{WM.fmtTime(r.eta)}</td>
                  <td><Pill tone={r.status === 'Overdue' ? 'red' : r.status === 'Expected' ? 'grey' : r.status === 'Put away' ? 'green' : 'amber'}>{r.status}</Pill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title={t('warehouse.ct.card.outboundToday')} subtitle={`${outboundToday.filter((d) => d.risk === 'red').length} cut-off risk`}
          eyebrow="LIKP / LIPS"
          actions={<button className="btn btn-sm btn-ghost" onClick={() => onNav('outbound')}>All <Icon name="arrowRight" size={12}/></button>} tight>
          <table className="tbl">
            <thead><tr><th>{t('warehouse.common.col.delivery')}</th><th>{t('warehouse.common.col.customer')}</th><th>{t('warehouse.ct.col.cutOff')}</th><th className="num">{t('warehouse.ct.col.pick')}</th><th>{t('warehouse.common.col.status')}</th><th>{t('warehouse.ct.col.dock')}</th></tr></thead>
            <tbody>
              {outboundToday.map((d) => (
                <tr key={d.id} onClick={() => onOpenDelivery(d)} className={`is-risk-${d.risk}`}>
                  <td className="code">{d.id}</td>
                  <td><div style={{ fontSize: 12 }}>{d.customer.name}</div></td>
                  <td className="mono small">{WM.fmtTime(d.cutoff)}</td>
                  <td className="num" style={{ width: 90 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end' }}>
                      <span className="mono" style={{ fontSize: 11 }}>{d.pickPct}%</span>
                      <div style={{ width: 36 }}><Progress pct={d.pickPct} tone={d.risk === 'red' ? 'red' : d.risk === 'amber' ? 'amber' : ''}/></div>
                    </div>
                  </td>
                  <td><Pill tone={d.status === 'Shipped' ? 'green' : d.status === 'Loaded' ? 'green' : d.status === 'Loading' ? 'slate' : d.status === 'Staged' ? 'sage' : d.status === 'Picking' ? 'amber' : 'grey'}>{d.status}</Pill></td>
                  <td className="mono small">{d.dock.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {/* Ageing tasks + bin constraints */}
      <div className="grid-2">
        <Card title={t('warehouse.ct.card.ageingTOs')} subtitle="Open > 2h — redistribute or escalate" eyebrow="LTAK" tight>
          <table className="tbl">
            <thead><tr><th>{t('warehouse.ct.col.to')}</th><th>{t('warehouse.common.col.type')}</th><th>{t('warehouse.common.col.material')}</th><th>{t('warehouse.ct.col.srcDst')}</th><th className="num">{t('warehouse.common.col.age')}</th><th>{t('warehouse.common.col.operator')}</th></tr></thead>
            <tbody>
              {ageingTOs.map((to) => (
                <tr key={to.id}>
                  <td className="code">{to.id}</td>
                  <td><span className="tag">{to.type}</span></td>
                  <td><div style={{ fontSize: 12 }}>{to.material.name}</div></td>
                  <td className="mono small">{to.srcBin} → {to.dstBin}</td>
                  <td className="num amber bold">{Math.floor(to.ageMin / 60)}h {to.ageMin % 60}m</td>
                  <td className="small">{to.assignedTo || <span className="muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title={t('warehouse.ct.card.spaceConstraints')} subtitle="Utilisation by storage type · click to drill" eyebrow="Inventory"
          actions={<button className="btn btn-sm btn-ghost" onClick={() => onNav('inventory')}>All <Icon name="arrowRight" size={12}/></button>}>
          <div className="stack-8">
            {WM.STORAGE_TYPES.slice(0, 6).map((s, i) => {
              const bins = WM.STORAGE_BINS.filter((b) => b.storageType.id === s.id);
              const occ = bins.filter((b) => b.status === 'Occupied').length;
              const pct = (occ / bins.length) * 100;
              const tone = pct > 92 ? 'red' : pct > 80 ? 'amber' : '';
              return (
                <Hbar key={i} label={`${s.id} · ${s.name}`} value={Math.round(pct) + '%'} max={100} tone={tone}/>
              );
            })}
          </div>
          <div style={{ marginTop: 12, padding: 10, background: 'var(--stone)', borderRadius: 6, fontSize: 12, color: 'var(--forest)' }}>
            <span className="bold">Storage type 002 Bulk Bay</span> at 94% — block 3 incoming bulk drops from DHL tonight until return pallets cleared.
          </div>
        </Card>
      </div>
    </div>
  );
};


export { ControlTower };
