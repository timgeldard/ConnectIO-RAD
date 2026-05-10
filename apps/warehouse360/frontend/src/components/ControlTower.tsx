/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { useI18n } from '@connectio/shared-frontend-i18n'
import { useApi } from '../hooks/useApi';
import { usePlantSelection } from '../context/PlantContext';
import { Icon, Pill, Progress, RiskDot, Hbar } from './Primitives';
import { Card } from './Shared';
import { KpiCardWidget } from '@connectio/shared-reporting'
import type { WidgetConfig } from '@connectio/shared-reporting'
import { StagingTimeline, normalizeOrder } from './ProductionStaging';
import { DataTable, type Column } from '@connectio/shared-ui'
import { fmtTime } from '~/utils/time'

/* Control Tower — warehouse manager's landing page */

/** Builds a minimal WidgetConfig for a standalone KpiCardWidget (no ReportingDashboard host). */
function makeKpiConfig(id: string, title: string): WidgetConfig {
  return { id, type: 'kpi', title, props: {}, interactions: [], layout: {} }
}

/** Props for the ControlTower control-tower landing page. */
interface ControlTowerProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onNav?: (route: string) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onOpenOrder?: (order: any) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onOpenDelivery?: (delivery: any) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onOpenReceipt?: (receipt: any) => void
}

const ControlTower = ({ onNav, onOpenOrder, onOpenDelivery, onOpenReceipt }: ControlTowerProps) => {
  const { t } = useI18n()
  const { selectedPlant } = usePlantSelection()
  const { data: kpiResp, loading: kpisLoading, error: kpisError } = useApi<any>('/api/kpis')
  const { data: ordersResp, loading: ordersLoading, error: ordersError } = useApi<any>('/api/wh-cockpit')
  const { data: inboundResp, loading: inboundLoading, error: inboundError } = useApi<any>('/api/inbound')
  const { data: outboundResp, loading: outboundLoading, error: outboundError } = useApi<any>('/api/deliveries')
  const { data: binsResp, error: binsError } = useApi<any>('/api/inventory/bins')
  const kpis = kpiResp?.kpis ?? null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const liveOrders = React.useMemo(() => ((ordersResp?.orders ?? []) as any[]).map(normalizeOrder), [ordersResp])
  const redOrders = liveOrders.filter((o: any) => o.risk === 'red').slice(0, 5);
  const amberOrders = liveOrders.filter((o: any) => o.risk === 'amber').slice(0, 4);
  const inboundToday = (inboundResp?.receipts ?? []).slice(0, 6);
  const outboundToday = (outboundResp?.deliveries ?? []).slice(0, 6);
  const bins = binsResp?.bins ?? [];
  const exceptionSignals = [
    { label: t('warehouse.ct.kpi.ordersAtRisk'), value: kpis?.orders_red ?? 0, tone: 'red', nav: 'staging' },
    { label: t('warehouse.ct.kpi.deliveriesAtRisk'), value: kpis?.deliveries_at_risk ?? 0, tone: 'amber', nav: 'outbound' },
    { label: t('warehouse.inventory.kpi.blockedQA'), value: kpis?.bins_blocked ?? 0, tone: 'slate', nav: 'inventory' },
  ].filter((signal: any) => signal.value > 0);
  const kpiUnavailable = !kpisLoading && Boolean(kpisError)
  const workload = [
    { area: 'Production orders', open: kpis?.orders_total ?? 0, exceptions: (kpis?.orders_red ?? 0) + (kpis?.orders_amber ?? 0), nav: 'staging' },
    { area: 'Transfer orders', open: kpis?.tos_open ?? 0, exceptions: 0, nav: 'inventory' },
    { area: 'Inbound lines', open: kpis?.inbound_open ?? 0, exceptions: 0, nav: 'inbound' },
    { area: 'Deliveries', open: kpis?.deliveries_today ?? 0, exceptions: kpis?.deliveries_at_risk ?? 0, nav: 'outbound' },
  ];
  const storageByType = // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Object.values(bins.reduce((acc: Record<string, any>, bin: any) => {
    const key = bin.lgtyp ?? '—';
    if (!acc[key]) acc[key] = { id: key, total: 0, occupied: 0, blocked: 0 };
    acc[key].total += 1;
    if (bin.bin_status === 'occupied') acc[key].occupied += 1;
    if (bin.bin_status === 'blocked' || bin.bin_status === 'restricted') acc[key].blocked += 1;
    return acc;
  }, {})).slice(0, 6);

  const atRiskColumns: Column<any>[] = [
    { header: '', width: 32, render: (o) => <RiskDot risk={o.risk}/> },
    { header: t('warehouse.common.col.order'), render: (o) => <><span className="code">{o.id}</span><div className="muted" style={{ fontSize: 11 }}>{o.product.split(' · ')[0]}</div></> },
    { header: t('warehouse.common.col.line'), key: 'line.id', style: { fontSize: 12 } },
    { header: t('warehouse.common.col.start'), mono: true, render: (o) => o.start ? fmtTime(o.start) : '—' },
    { header: t('warehouse.common.col.staging'), align: 'right', width: 120, render: (o) => (
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end' }}>
        <span className="mono" style={{ fontSize: 11 }}>{o.stagingPct}%</span>
        <div style={{ width: 44 }}><Progress pct={o.stagingPct} tone={o.risk === 'red' ? 'red' : 'amber'}/></div>
      </div>
    )},
    { header: '', align: 'right', render: () => <Icon name="chevronRight" size={12} color="var(--fg-muted)"/> }
  ];

  const inboundColumns: Column<any>[] = [
    { header: t('warehouse.common.col.type'), render: () => <Pill tone="slate" noDot>PO</Pill> },
    { header: 'Doc', key: 'po_id', className: 'code' },
    { header: t('warehouse.ct.col.vendorPlant'), render: (r) => <><div style={{ fontSize: 12 }}>{r.vendor_name || '—'}</div><div className="muted" style={{ fontSize: 11 }}>{r.vendor_id || '—'}</div></> },
    { header: t('warehouse.common.col.material'), render: (r) => <><div style={{ fontSize: 12 }}>{r.material_name || r.material_id || '—'}</div><div className="muted" style={{ fontSize: 11 }}>{r.ordered_qty ?? '—'} {r.uom ?? ''}</div></> },
    { header: t('warehouse.ct.col.eta'), key: 'delivery_date', mono: true },
    { header: t('warehouse.common.col.status'), render: (r) => <Pill tone={r.qa_status === 'inspection' ? 'amber' : r.risk === 'red' ? 'red' : 'green'}>{r.qa_status || r.risk || 'open'}</Pill> }
  ];

  const outboundColumns: Column<any>[] = [
    { header: t('warehouse.common.col.delivery'), key: 'delivery_id', className: 'code' },
    { header: t('warehouse.common.col.customer'), render: (d) => <div style={{ fontSize: 12 }}>{d.customer_name || d.customer_id || '—'}</div> },
    { header: t('warehouse.ct.col.cutOff'), key: 'planned_gi_date', mono: true },
    { header: t('warehouse.ct.col.pick'), align: 'right', width: 90, render: (d) => (
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end' }}>
        <span className="mono" style={{ fontSize: 11 }}>{Math.round(d.pick_pct ?? 0)}%</span>
        <div style={{ width: 36 }}><Progress pct={d.pick_pct ?? 0} tone={d.risk === 'red' ? 'red' : d.risk === 'amber' ? 'amber' : ''}/></div>
      </div>
    )},
    { header: t('warehouse.common.col.status'), render: (d) => <Pill tone={d.risk === 'red' ? 'red' : d.risk === 'amber' ? 'amber' : 'green'}>{d.risk || 'open'}</Pill> },
    { header: t('warehouse.ct.col.dock'), render: () => '—', mono: true }
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">
            {selectedPlant ? (selectedPlant.plant_name || selectedPlant.plant_id) : 'Select a plant'} · {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
          <h1 className="page-title">Warehouse control tower</h1>
          <div className="page-desc">Live plant workload, order risk, inbound receipts, outbound deliveries and storage constraints for the selected plant.</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary"><Icon name="download" size={14}/> {t('warehouse.ct.btn.shiftReport')}</button>
          <button className="btn btn-secondary"><Icon name="user" size={14}/> {t('warehouse.ct.btn.handOver')}</button>
          <button className="btn btn-primary"><Icon name="flag" size={14}/> {t('warehouse.ct.btn.escalate')}</button>
        </div>
      </div>

      {/* Top KPI strip */}
      {kpisError && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'var(--sunset)' }}>
          <div className="card-body">
            <div className="red" style={{ fontWeight: 700, marginBottom: 4 }}>{t('warehouse.ct.error.kpisUnavailableTitle')}</div>
            <div className="muted small">{t('warehouse.ct.error.kpisUnavailableBody')}</div>
          </div>
        </div>
      )}
      <div className="kpi-grid">
        <KpiCardWidget
          config={makeKpiConfig('orders-at-risk', t('warehouse.ct.kpi.ordersAtRisk'))}
          props={{ value: kpisError ? t('warehouse.ct.error.kpiValue') : kpis?.orders_red ?? '…', tone: kpisError ? 'warn' : kpis?.orders_red > 0 ? 'risk' : 'ok' }}
        />
        <KpiCardWidget
          config={makeKpiConfig('orders-amber', t('warehouse.ct.kpi.ordersAmber'))}
          props={{ value: kpisError ? t('warehouse.ct.error.kpiValue') : kpis?.orders_amber ?? '…', tone: kpisError ? 'warn' : kpis?.orders_amber > 0 ? 'warn' : 'ok' }}
        />
        <KpiCardWidget
          config={makeKpiConfig('open-tos', t('warehouse.ct.kpi.openTOs'))}
          props={{ value: kpisError ? t('warehouse.ct.error.kpiValue') : kpis?.tos_open ?? '…', unit: kpisError ? undefined : ' TOs', tone: kpisError ? 'warn' : 'ok' }}
        />
        <KpiCardWidget
          config={makeKpiConfig('deliveries-at-risk', t('warehouse.ct.kpi.deliveriesAtRisk'))}
          props={{ value: kpisError ? t('warehouse.ct.error.kpiValue') : kpis?.deliveries_at_risk ?? '…', tone: kpisError ? 'warn' : kpis?.deliveries_at_risk > 0 ? 'warn' : 'ok' }}
        />
        <KpiCardWidget
          config={makeKpiConfig('open-inbound', t('warehouse.ct.kpi.openInbound'))}
          props={{ value: kpisError ? t('warehouse.ct.error.kpiValue') : kpis?.inbound_open ?? '…', unit: kpisError ? undefined : ' lines', tone: kpisError ? 'warn' : 'ok' }}
        />
        <KpiCardWidget
          config={makeKpiConfig('bin-util', t('warehouse.ct.kpi.binUtil'))}
          props={{ value: kpisError ? t('warehouse.ct.error.kpiValue') : kpis?.bin_util_pct ?? '…', unit: kpisError ? undefined : '%', tone: kpisError ? 'warn' : kpis?.bin_util_pct > 92 ? 'risk' : kpis?.bin_util_pct > 80 ? 'warn' : 'ok', progressBar: kpisError ? undefined : kpis?.bin_util_pct ?? 0 }}
        />
      </div>

      {/* Today's run sheet + Critical exceptions */}
      <div className="grid-asym" style={{ marginBottom: 16 }}>
        <Card title={t('warehouse.ct.card.runSheet')} subtitle="6 lines · click a bar to drill in" eyebrow="Schedule" tight
          actions={<button className="btn btn-sm btn-ghost" onClick={() => onNav?.('staging')}>Open staging <Icon name="arrowRight" size={12}/></button>}>
          <StagingTimeline orders={liveOrders} onOpen={onOpenOrder}/>
        </Card>

        <Card title={t('warehouse.ct.card.criticalExceptions')} subtitle="Needs action now" eyebrow="Risk"
          actions={<button className="btn btn-sm btn-ghost" onClick={() => onNav?.('exceptions')}><Icon name="external" size={12}/></button>}>
          <div className="stack-8">
            {exceptionSignals.map((e: any, i: number) => (
              <button key={i} onClick={() => onNav?.(e.nav)} style={{ textAlign: 'left', padding: 10, background: 'color-mix(in srgb, var(--sunset) 6%, white)', border: '1px solid color-mix(in srgb, var(--sunset) 20%, transparent)', borderRadius: 6, width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ fontWeight: 600, fontSize: 12, color: 'var(--forest)' }}>{e.label}</div>
                  <span className="mono small muted">{e.value}</span>
                </div>
                <div className="muted" style={{ fontSize: 11, marginTop: 3 }}>Live KPI signal for the selected plant</div>
                <div style={{ marginTop: 6, display: 'flex', gap: 6 }}>
                  <Pill tone={e.tone} noDot>{e.nav}</Pill>
                </div>
              </button>
            ))}
            {kpiUnavailable && <div className="red small">{t('warehouse.ct.error.criticalKpis')}</div>}
            {!kpiUnavailable && exceptionSignals.length === 0 && <div className="muted small">{t('warehouse.ct.info.noCriticalKpis')}</div>}
          </div>
        </Card>
      </div>

      {/* Workload + Production at risk */}
      <div className="grid-2" style={{ marginBottom: 16 }}>
        <Card title={t('warehouse.ct.card.workload')} subtitle="Open · in progress · confirmed tasks this shift" eyebrow="Warehouse tasks">
          <div className="stack-8">
            {kpiUnavailable && <div className="red small">{t('warehouse.ct.error.workload')}</div>}
            {workload.map((w: any, i: number) => {
              const total = Math.max(1, w.open + w.exceptions);
              return (
                <button key={i} onClick={() => onNav?.(w.nav)} style={{ display: 'block', width: '100%', textAlign: 'left', background: 'transparent', border: 0, padding: 0, cursor: 'pointer' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--forest)' }}>{w.area}</span>
                    <span className="mono small muted">{w.open} open {w.exceptions > 0 && <span className="red"> · {w.exceptions} at risk</span>}</span>
                  </div>
                  <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--stone)' }}>
                    <div style={{ width: ((w.open - w.exceptions) / total * 100) + '%', background: 'var(--jade)' }}/>
                    <div style={{ width: (w.exceptions / total * 100) + '%', background: 'var(--sunset)' }}/>
                  </div>
                </button>
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
          actions={<button className="btn btn-sm btn-ghost" onClick={() => onNav?.('staging')}>All <Icon name="arrowRight" size={12}/></button>} noPad>
          <DataTable
            columns={atRiskColumns}
            rows={[...redOrders, ...amberOrders].slice(0, 8)}
            rowKey="id"
            onRowClick={onOpenOrder}
            dense
            loading={ordersLoading}
            emphasize={(o) => o.risk === 'red'}
          />
          {ordersError && <div style={{ padding: 16, color: 'var(--status-risk)' }}>{ordersError}</div>}
        </Card>
      </div>

      {/* Inbound + Outbound due today */}
      <div className="grid-2" style={{ marginBottom: 16 }}>
        <Card title={t('warehouse.ct.card.inboundToday')} subtitle={`${inboundToday.length} live receipts`}
          eyebrow="PO / STO"
          actions={<button className="btn btn-sm btn-ghost" onClick={() => onNav?.('inbound')}>All <Icon name="arrowRight" size={12}/></button>} noPad>
          <DataTable
            columns={inboundColumns}
            rows={inboundToday}
            rowKey={(r) => `${r.po_id}-${r.po_item}`}
            onRowClick={onOpenReceipt}
            dense
            loading={inboundLoading}
            emphasize={(r) => r.risk === 'red'}
          />
          {inboundError && <div style={{ padding: 16, color: 'var(--status-risk)' }}>{inboundError}</div>}
        </Card>

        <Card title={t('warehouse.ct.card.outboundToday')} subtitle={`${outboundToday.filter((d: any) => d.risk === 'red').length} cut-off risk`}
          eyebrow="LIKP / LIPS"
          actions={<button className="btn btn-sm btn-ghost" onClick={() => onNav?.('outbound')}>All <Icon name="arrowRight" size={12}/></button>} noPad>
          <DataTable
            columns={outboundColumns}
            rows={outboundToday}
            rowKey="delivery_id"
            onRowClick={onOpenDelivery}
            dense
            loading={outboundLoading}
            emphasize={(d) => d.risk === 'red'}
          />
          {outboundError && <div style={{ padding: 16, color: 'var(--status-risk)' }}>{outboundError}</div>}
        </Card>
      </div>

      {/* Ageing tasks + bin constraints */}
      <div className="grid-2">
        <Card title={t('warehouse.ct.card.ageingTOs')} subtitle="Open > 2h — redistribute or escalate" eyebrow="LTAK" noPad>
          <DataTable
            columns={[
              { header: t('warehouse.ct.col.to'), key: 'id' },
              { header: t('warehouse.common.col.type'), key: 'type' },
              { header: t('warehouse.common.col.material'), key: 'material' },
              { header: t('warehouse.ct.col.srcDst'), key: 'path' },
              { header: t('warehouse.common.col.age'), key: 'age', align: 'right' },
              { header: t('warehouse.common.col.operator'), key: 'user' }
            ]}
            rows={[]}
            dense
            noDataLabel="No live ageing transfer-order list endpoint is available yet."
          />
        </Card>

        <Card title={t('warehouse.ct.card.spaceConstraints')} subtitle="Utilisation by storage type · click to drill" eyebrow="Inventory"
          actions={<button className="btn btn-sm btn-ghost" onClick={() => onNav?.('inventory')}>All <Icon name="arrowRight" size={12}/></button>}>
          <div className="stack-8">
            {storageByType.map((s: any, i: number) => {
              const pct = s.total > 0 ? (s.occupied / s.total) * 100 : 0;
              const tone = pct > 92 ? 'red' : pct > 80 ? 'amber' : '';
              return (
                <Hbar key={i} label={`${s.id} · ${s.blocked} blocked`} value={Math.round(pct)} max={100} tone={tone}/>
              );
            })}
            {storageByType.length === 0 && (
              <div className={binsError ? 'red small' : 'muted small'}>
                {binsError ? t('warehouse.ct.error.storage') : t('warehouse.ct.info.noStorage')}
              </div>
            )}
          </div>
          <div style={{ marginTop: 12, padding: 10, background: 'var(--stone)', borderRadius: 6, fontSize: 12, color: 'var(--forest)' }}>
            <span className="bold">Live bin utilisation</span> is scoped to the selected plant where quant plant data is available.
          </div>
        </Card>
      </div>
    </div>
  );
};


export { ControlTower };
