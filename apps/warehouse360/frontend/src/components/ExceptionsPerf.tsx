/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { useI18n } from '@connectio/shared-frontend-i18n'
import { useApi } from '../hooks/useApi'
import { Icon, Pill, Hbar } from './Primitives'
import { FilterBar, Card, KPI } from './Shared'

/* Exceptions Command Centre + Performance Analytics */

/** Props for the Exceptions command centre page. */
interface ExceptionsProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onOpenOrder?: (order: any) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onOpenDelivery?: (delivery: any) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onOpenReceipt?: (receipt: any) => void
}

const Exceptions = ({ onOpenOrder, onOpenDelivery: _onOpenDelivery, onOpenReceipt: _onOpenReceipt }: ExceptionsProps) => {
  const { t } = useI18n();
  const [severity, setSeverity] = React.useState('all');
  const [domain, setDomain] = React.useState('all');
  const [acknowledged, setAcknowledged] = React.useState('open');
  const { data: kpiResp, loading, error } = useApi<any>('/api/kpis')

  const liveRows = React.useMemo(() => {
    const kpis = kpiResp?.kpis ?? {}
    const rows: any[] = []
    if ((kpis.orders_red ?? 0) > 0) {
      rows.push({
        id: 'orders-red',
        type: { severity: 'critical', domain: 'Production', title: 'Production orders at risk' },
        detail: `${kpis.orders_red} live production orders need staging attention.`,
        ageMin: null,
        acknowledged: false,
      })
    }
    if ((kpis.deliveries_at_risk ?? 0) > 0) {
      rows.push({
        id: 'deliveries-risk',
        type: { severity: 'high', domain: 'Outbound', title: 'Deliveries at risk' },
        detail: `${kpis.deliveries_at_risk} live deliveries are at cut-off risk.`,
        ageMin: null,
        acknowledged: false,
      })
    }
    if ((kpis.bins_blocked ?? 0) > 0) {
      rows.push({
        id: 'bins-blocked',
        type: { severity: 'medium', domain: 'Inventory', title: 'Blocked inventory bins' },
        detail: `${kpis.bins_blocked} bins are blocked or restricted in the selected plant.`,
        ageMin: null,
        acknowledged: false,
      })
    }
    return rows
  }, [kpiResp])

  const rows = React.useMemo(() => {
    let r = liveRows;
    if (severity !== 'all') r = r.filter((e: any) => e.type.severity === severity);
    if (domain !== 'all') r = r.filter((e: any) => e.type.domain === domain);
    if (acknowledged === 'open') r = r.filter((e: any) => !e.acknowledged);
    if (acknowledged === 'ack') r = r.filter((e: any) => e.acknowledged);
    return [...r].sort((a: any, b: any) => {
      const sev = { critical: 0, high: 1, medium: 2 };
      if (sev[a.type.severity] !== sev[b.type.severity]) return sev[a.type.severity] - sev[b.type.severity];
      return b.ageMin - a.ageMin;
    });
  }, [liveRows, severity, domain, acknowledged]);

  const counts = {
    critical: liveRows.filter((e: any) => e.type.severity === 'critical' && !e.acknowledged).length,
    high: liveRows.filter((e: any) => e.type.severity === 'high' && !e.acknowledged).length,
    medium: liveRows.filter((e: any) => e.type.severity === 'medium' && !e.acknowledged).length,
    total: liveRows.length,
  };

  const domains = ['all', ...new Set(liveRows.map((e: any) => e.type.domain))];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Risk · Priority exceptions</div>
          <h1 className="page-title">{t('warehouse.title.exceptions')}</h1>
          <div className="page-desc">Operational risk modelled from SAP events — staging delays, missed cut-offs, batch mismatches, aged tasks. Sorted by severity then age.</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary"><Icon name="download" size={14}/> {t('warehouse.exceptions.btn.incidentLog')}</button>
          <button className="btn btn-primary"><Icon name="check" size={14}/> {t('warehouse.exceptions.btn.bulkAck')}</button>
        </div>
      </div>

      <div className="kpi-grid">
        <KPI label={t('warehouse.exceptions.kpi.criticalOpen')} value={counts.critical} tone="critical"/>
        <KPI label={t('warehouse.exceptions.kpi.highOpen')} value={counts.high} tone="warn"/>
        <KPI label={t('warehouse.exceptions.kpi.mediumOpen')} value={counts.medium} tone="ok"/>
        <KPI label={t('warehouse.exceptions.kpi.acknowledged')} value="—" tone="ok"/>
        <KPI label={t('warehouse.exceptions.kpi.mtta')} value="—" unit=" min" tone="ok"/>
        <KPI label={t('warehouse.exceptions.kpi.oldestOpen')} value="—" unit=" min" tone="warn"/>
      </div>

      <div className="grid-asym" style={{ marginBottom: 16 }}>
        <Card title={t('warehouse.exceptions.card.severityBreakdown')} subtitle="By domain · last 8 hours" eyebrow="Breakdown">
          <div className="stack-8">
            {domains.filter((d: any) => d !== 'all').map((d: any) => {
              const byDomain = liveRows.filter((e: any) => e.type.domain === d);
              const c = byDomain.filter((e: any) => e.type.severity === 'critical').length;
              const h = byDomain.filter((e: any) => e.type.severity === 'high').length;
              const m = byDomain.filter((e: any) => e.type.severity === 'medium').length;
              return (
                <div key={d}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, marginBottom: 3 }}>
                    <span>{d}</span><span className="mono small muted">{byDomain.length}</span>
                  </div>
                  <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--stone)' }}>
                    <div style={{ width: (c / byDomain.length * 100) + '%', background: 'var(--sunset)' }}/>
                    <div style={{ width: (h / byDomain.length * 100) + '%', background: 'var(--sunrise)' }}/>
                    <div style={{ width: (m / byDomain.length * 100) + '%', background: 'var(--sage)' }}/>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title={t('warehouse.exceptions.card.ruleLibrary')} subtitle="13 active exception rules" eyebrow="Rules">
          <div className="stack-8" style={{ maxHeight: 300, overflowY: 'auto' }}>
            {[
              ['staging-late', 'Production starts < 2h · staging incomplete', 'critical'],
              ['disp-not-started', 'Dispensary task not started · < 1h to use', 'critical'],
              ['delivery-pick-incomplete', 'Outbound cut-off < 2h · pick incomplete', 'critical'],
              ['batch-mismatch', 'Batch picked ≠ reservation', 'critical'],
              ['bulk-drop-uncleared', 'Bulk drop delivered · not consumed/returned', 'high'],
              ['sscc-missing', 'SSCC missing on staged pallet', 'high'],
              ['inbound-overdue', 'Inbound overdue · needed today', 'high'],
              ['pick-not-delivered', 'Pick confirmed · not delivered to line', 'high'],
              ['lineside-below-min', 'Line-side below minimum', 'high'],
              ['stock-no-bin', 'SAP stock but no bin qty', 'high'],
              ['to-ageing', 'TO open > 4h', 'medium'],
              ['putaway-backlog', 'GR posted · putaway > 2h', 'medium'],
              ['qa-hold', 'QA hold on needed material', 'medium'],
            ].map(([id, title, sev]) => (
              <div key={id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '6px 0' }}>
                <span className={`risk-dot ${sev === 'critical' ? 'red' : sev === 'high' ? 'amber' : 'slate'}`}/>
                <div style={{ flex: 1, fontSize: 12 }}>{title}</div>
                <span className="tag">{sev.toUpperCase()}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="tabs">
        {[
          ['all', t('warehouse.exceptions.tab.all')],
          ['open', t('warehouse.exceptions.tab.open')],
          ['ack', t('warehouse.exceptions.tab.acknowledged')],
        ].map(([id, label]) => (
          <button key={id} className={`tab ${acknowledged === id ? 'is-active' : ''}`} onClick={() => setAcknowledged(id)}>{label}</button>
        ))}
      </div>

      <FilterBar
        filters={[
          { key: 'severity', label: t('warehouse.exceptions.filter.severity'), chips: [
            { value: 'all',      label: t('warehouse.common.all') },
            { value: 'critical', label: t('warehouse.common.risk.critical'), dot: 'red' },
            { value: 'high',     label: t('warehouse.exceptions.filter.high'), dot: 'amber' },
            { value: 'medium',   label: t('warehouse.exceptions.filter.medium'), dot: 'slate' },
          ] },
          { key: 'domain', label: 'Domain', options: domains.map((d: any) => ({ value: d, label: d === 'all' ? t('warehouse.common.filter.allDomains') : d })) },
        ]}
        values={{ severity, domain }}
        onChange={(k, v) => k === 'severity' ? setSeverity(v) : setDomain(v)}
      />

      <Card title={`${rows.length} exceptions`} tight>
        <table className="tbl">
          <thead><tr><th></th><th>{t('warehouse.exceptions.col.severity')}</th><th>{t('warehouse.exceptions.col.exception')}</th><th>{t('warehouse.exceptions.col.related')}</th><th>{t('warehouse.exceptions.col.detail')}</th><th className="num">{t('warehouse.common.col.age')}</th><th>{t('warehouse.exceptions.col.owner')}</th><th>{t('warehouse.exceptions.col.action')}</th></tr></thead>
          <tbody>
            {rows.map((e: any) => (
              <tr key={e.id} onClick={() => e.po && onOpenOrder?.(e.po)}>
                <td><span className={`risk-dot ${e.type.severity === 'critical' ? 'red' : e.type.severity === 'high' ? 'amber' : 'slate'}`}/></td>
                <td><Pill tone={e.type.severity === 'critical' ? 'red' : e.type.severity === 'high' ? 'amber' : 'slate'}>{e.type.severity.toUpperCase()}</Pill></td>
                <td><div style={{ fontSize: 12, fontWeight: 600 }}>{e.type.title}</div><div className="muted" style={{ fontSize: 11 }}>{e.type.domain}</div></td>
                <td>
                  {e.po && <div className="code small">{e.po.id}</div>}
                  {e.del && <div className="code small">{e.del.id}</div>}
                  {e.line && <div className="muted small">{e.line.name}</div>}
                </td>
                <td style={{ fontSize: 12 }}>{e.detail}</td>
                <td className="num"><span className={e.ageMin > 120 ? 'red bold' : ''}>{e.ageMin == null ? '—' : e.ageMin + 'm'}</span></td>
                <td className="small">{e.owner || <span className="muted">{t('warehouse.common.unassigned')}</span>}</td>
                <td>
                  {e.acknowledged ? <Pill tone="green" noDot>{t('warehouse.exceptions.tab.acknowledged')}</Pill> : <button className="btn btn-xs btn-primary">{t('warehouse.common.btn.acknowledge')}</button>}
                </td>
              </tr>
            ))}
            {loading && <tr><td colSpan={8} className="muted small">Loading live exceptions…</td></tr>}
            {!loading && rows.length === 0 && !error && (
              <tr><td colSpan={8} className="muted small">No live exception signals for this plant.</td></tr>
            )}
            {error && <tr><td colSpan={8} className="red small">Unable to load live exception signals: {error}</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
};

const Performance = () => {
  const { t } = useI18n();
  const { data: kpiResp, loading, error } = useApi<any>('/api/kpis')
  const kpis = kpiResp?.kpis ?? {}

  const kpiLabels = {
    stagingSLA: t('warehouse.perf.kpi.stagingSLA'),
    prodOnTime: t('warehouse.perf.kpi.prodOnTime'),
    inboundAdherence: t('warehouse.perf.kpi.inboundAdherence'),
    putawayCycle: t('warehouse.perf.kpi.putawayCycle'),
    outboundReady: t('warehouse.perf.kpi.outboundReady'),
    pickProd: t('warehouse.perf.kpi.pickProd'),
    toAgeing: t('warehouse.perf.kpi.toAgeing'),
    binUtil: t('warehouse.perf.kpi.binUtil'),
    inventoryAccuracy: t('warehouse.perf.kpi.inventoryAccuracy'),
    dispensaryReady: t('warehouse.perf.kpi.dispensaryReady'),
    ssccCompliance: t('warehouse.perf.kpi.ssccCompliance'),
    leftoverReturn: t('warehouse.perf.kpi.leftoverReturn'),
    stockoutRate: t('warehouse.perf.kpi.stockoutRate'),
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Analytics · Shift & 14-day</div>
          <h1 className="page-title">{t('warehouse.title.performance')}</h1>
          <div className="page-desc">KPIs defined for the Warehouse Manager. Thirteen metrics spanning staging, receipt, dispatch, cycle time, accuracy and compliance.</div>
        </div>
        <div className="page-actions">
          <select className="filter-select">
            <option>{t('warehouse.perf.select.14d')}</option>
            <option>{t('warehouse.perf.select.30d')}</option>
            <option>{t('warehouse.perf.select.quarter')}</option>
          </select>
          <button className="btn btn-secondary"><Icon name="download" size={14}/> {t('warehouse.common.btn.export')}</button>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 16 }}>
        <Card title={t('warehouse.perf.card.stagingSLA')} subtitle="Orders staged on time" eyebrow="Target 95%">
          <div style={{ fontFamily: 'var(--font-impact)', fontWeight: 800, fontSize: 44, color: 'var(--forest)', lineHeight: 1 }}>{loading ? '…' : (kpis.staging_sla_pct ?? '—')}<span style={{ fontSize: 16, color: 'var(--fg-muted)', fontFamily: 'var(--font-sans)' }}>%</span></div>
          <div className="small muted" style={{ marginTop: 6 }}>Live trend endpoint not available yet.</div>
        </Card>
        <Card title={t('warehouse.perf.card.inboundAdherence')} subtitle="Receipts on scheduled day" eyebrow="Target 90%">
          <div style={{ fontFamily: 'var(--font-impact)', fontWeight: 800, fontSize: 44, color: 'var(--forest)', lineHeight: 1 }}>{loading ? '…' : (kpis.inbound_adherence_pct ?? '—')}<span style={{ fontSize: 16, color: 'var(--fg-muted)', fontFamily: 'var(--font-sans)' }}>%</span></div>
          <div className="small muted" style={{ marginTop: 6 }}>Live trend endpoint not available yet.</div>
        </Card>
        <Card title={t('warehouse.perf.card.outboundReady')} subtitle="Deliveries ready by cut-off" eyebrow="Target 98%">
          <div style={{ fontFamily: 'var(--font-impact)', fontWeight: 800, fontSize: 44, color: 'var(--forest)', lineHeight: 1 }}>{loading ? '…' : (kpis.outbound_ready_pct ?? '—')}<span style={{ fontSize: 16, color: 'var(--fg-muted)', fontFamily: 'var(--font-sans)' }}>%</span></div>
          <div className="small muted" style={{ marginTop: 6 }}>Live trend endpoint not available yet.</div>
        </Card>
        <Card title={t('warehouse.perf.card.pickProd')} subtitle="Lines per picker-hour" eyebrow="Target 130">
          <div style={{ fontFamily: 'var(--font-impact)', fontWeight: 800, fontSize: 44, color: 'var(--forest)', lineHeight: 1 }}>{loading ? '…' : (kpis.pick_productivity ?? '—')}</div>
          <div className="small muted" style={{ marginTop: 6 }}>Live trend endpoint not available yet.</div>
        </Card>
      </div>

      <div className="grid-2" style={{ marginBottom: 16 }}>
        <Card title={t('warehouse.perf.card.kpiCatalogue')} subtitle="Thirteen measures covering the manager's span of control" eyebrow="KPIs">
          <table className="tbl">
            <thead><tr><th>{t('warehouse.perf.col.kpi')}</th><th className="num">{t('warehouse.perf.col.value')}</th><th className="num">{t('warehouse.perf.col.target')}</th><th>Δ</th></tr></thead>
            <tbody>
              {Object.entries(kpis).map(([k, value]) => {
                return (
                  <tr key={k}>
                    <td style={{ fontSize: 12 }}>{kpiLabels[k] ?? k}</td>
                    <td className="num bold">{String(value)}</td>
                    <td className="num muted">—</td>
                    <td><Pill tone="grey" noDot>live</Pill></td>
                  </tr>
                );
              })}
              {!loading && Object.keys(kpis).length === 0 && !error && (
                <tr><td colSpan={4} className="muted small">No live performance KPIs are available for this plant.</td></tr>
              )}
              {error && <tr><td colSpan={4} className="red small">Unable to load live performance KPIs: {error}</td></tr>}
            </tbody>
          </table>
        </Card>

        <Card title={t('warehouse.perf.card.workloadHeatmap')} subtitle="Task-completion density by hour" eyebrow="Rhythm">
          <div className="muted small">No live workload heatmap endpoint is available for this plant.</div>
        </Card>
      </div>

      <Card title={t('warehouse.perf.card.leftovers')} subtitle="Bulk drops and consolidated staging remain the biggest sources of waste" eyebrow="Loss">
        <div className="stack-8">
          <Hbar label="Live leftover loss" value={0} max={1}/>
          <div className="muted small">No live leftover-loss endpoint is available for this plant.</div>
        </div>
      </Card>
    </div>
  );
};


export { Exceptions, Performance };
