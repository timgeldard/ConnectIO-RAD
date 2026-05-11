/* eslint-disable jsdoc/require-jsdoc */
import React from 'react'
import { useI18n } from '@connectio/shared-frontend-i18n'
import { useApi } from '../hooks/useApi'
import { Icon, KPI, Card, Hbar, Donut } from './Primitives'
import { DataTable, type Column } from './Shared'

interface ControlTowerProps {
  onNav?: (view: string) => void
  onOpenOrder?: (o: any) => void
  onOpenReceipt?: (r: any) => void
  onOpenDelivery?: (d: any) => void
}

export const ControlTower = ({ onNav, onOpenOrder, onOpenReceipt, onOpenDelivery }: ControlTowerProps) => {
  const { t } = useI18n()

  const { data: ordersResp, loading: ordersLoading, error: ordersError } = useApi<any>('/api/wh-cockpit')
  const { data: inboundResp, loading: inboundLoading, error: inboundError } = useApi<any>('/api/inbound')
  const { data: outboundResp, loading: outboundLoading, error: outboundError } = useApi<any>('/api/outbound')
  const { data: binsResp, error: binsError } = useApi<any>('/api/inventory/summary')

  const allOrders = ordersResp?.orders ?? []
  const redOrders = allOrders.filter((o: any) => o.risk === 'red')
  const amberOrders = allOrders.filter((o: any) => o.risk === 'amber')

  const inboundToday = inboundResp?.receipts ?? []
  const outboundToday = outboundResp?.deliveries ?? []
  const storageByType = binsResp?.by_type ?? []

  const atRiskColumns: Column<any>[] = [
    { header: t('warehouse.common.col.order'), key: 'order_id' },
    { header: t('warehouse.common.col.product'), key: 'material_name' },
    { header: t('warehouse.ct.col.staging'), align: 'right', render: (o) => `${Math.round(o.staging_pct ?? 0)}%` },
    { header: '', width: 32, render: () => <Icon name="chevronRight" size={14} style={{ opacity: 0.3 }} /> }
  ]

  const inboundColumns: Column<any>[] = [
    { header: t('warehouse.ct.col.vendor'), key: 'vendor_name' },
    { header: t('warehouse.common.col.material'), key: 'material_id' },
    { header: t('warehouse.ct.col.eta'), align: 'right', key: 'eta_time' },
    { header: '', width: 32, render: () => <Icon name="chevronRight" size={14} style={{ opacity: 0.3 }} /> }
  ]

  const outboundColumns: Column<any>[] = [
    { header: t('warehouse.ct.col.customer'), key: 'customer_name' },
    { header: t('warehouse.common.col.material'), key: 'material_id' },
    { header: t('warehouse.ct.col.cutoff'), align: 'right', key: 'cutoff_time' },
    { header: '', width: 32, render: () => <Icon name="chevronRight" size={14} style={{ opacity: 0.3 }} /> }
  ]

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Cockpit · Global view</div>
          <h1 className="page-title">{t('warehouse.title.cockpit')}</h1>
          <div className="page-desc">High-level operations monitoring for warehouse management, focusing on staging risk and throughput.</div>
        </div>
      </div>

      <div className="kpi-grid">
        <KPI label={t('warehouse.staging.kpi.ordersAtRisk')} value={redOrders.length + amberOrders.length} tone={redOrders.length > 0 ? 'risk' : 'warn'} icon="alert" />
        <KPI label={t('warehouse.inbound.kpi.liveReceipts')} value={inboundToday.length} tone="ok" icon="truckIn" />
        <KPI label={t('warehouse.outbound.kpi.cutoffRisk')} value={outboundToday.filter((d: any) => d.risk === 'red').length} tone="risk" icon="truckOut" />
        <KPI label={t('warehouse.common.kpi.throughput')} value="—" tone="ok" icon="zap" />
      </div>

      <div style={{ marginBottom: 16 }}>
        <Card title={t('warehouse.ct.card.activeStagingRisk')} subtitle={`${redOrders.length} critical and ${amberOrders.length} at-risk orders require attention`}
          eyebrow="Production Staging"
          actions={<button className="btn btn-sm btn-ghost" onClick={() => onNav?.('staging')}>All <Icon name="arrowRight" size={12}/></button>} noPad>
          <DataTable
            columns={atRiskColumns}
            rows={[...redOrders, ...amberOrders].slice(0, 8)}
            rowKey={(o) => o.order_id || o.id}
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
            rowKey={(d) => d.delivery_id || d.id}
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
        </Card>
      </div>
    </div>
  )
}

export default ControlTower
