/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { useI18n } from '@connectio/shared-frontend-i18n'
import WM from '../data/mockData'
import { Icon, Pill, SparkBars, Hbar } from './Primitives'
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

  const rows = React.useMemo(() => {
    let r = WM.EXCEPTIONS;
    if (severity !== 'all') r = r.filter((e: any) => e.type.severity === severity);
    if (domain !== 'all') r = r.filter((e: any) => e.type.domain === domain);
    if (acknowledged === 'open') r = r.filter((e: any) => !e.acknowledged);
    if (acknowledged === 'ack') r = r.filter((e: any) => e.acknowledged);
    return [...r].sort((a: any, b: any) => {
      const sev = { critical: 0, high: 1, medium: 2 };
      if (sev[a.type.severity] !== sev[b.type.severity]) return sev[a.type.severity] - sev[b.type.severity];
      return b.ageMin - a.ageMin;
    });
  }, [severity, domain, acknowledged]);

  const counts = {
    critical: WM.EXCEPTIONS.filter((e: any) => e.type.severity === 'critical' && !e.acknowledged).length,
    high: WM.EXCEPTIONS.filter((e: any) => e.type.severity === 'high' && !e.acknowledged).length,
    medium: WM.EXCEPTIONS.filter((e: any) => e.type.severity === 'medium' && !e.acknowledged).length,
    total: WM.EXCEPTIONS.length,
  };

  const domains = ['all', ...new Set(WM.EXCEPTIONS.map((e: any) => e.type.domain))];

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
        <KPI label={t('warehouse.exceptions.kpi.acknowledged')} value={WM.EXCEPTIONS.filter((e: any) => e.acknowledged).length} tone="ok"/>
        <KPI label={t('warehouse.exceptions.kpi.mtta')} value="11" unit=" min" tone="ok" trend={-3} trendLabel="m vs yest"/>
        <KPI label={t('warehouse.exceptions.kpi.oldestOpen')} value={Math.max(...WM.EXCEPTIONS.filter((e: any) => !e.acknowledged).map((e: any) => e.ageMin))} unit=" min" tone="warn"/>
      </div>

      <div className="grid-asym" style={{ marginBottom: 16 }}>
        <Card title={t('warehouse.exceptions.card.severityBreakdown')} subtitle="By domain · last 8 hours" eyebrow="Breakdown">
          <div className="stack-8">
            {domains.filter((d: any) => d !== 'all').map((d: any) => {
              const byDomain = WM.EXCEPTIONS.filter((e: any) => e.type.domain === d);
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
                <td className="num"><span className={e.ageMin > 120 ? 'red bold' : ''}>{e.ageMin}m</span></td>
                <td className="small">{e.owner || <span className="muted">{t('warehouse.common.unassigned')}</span>}</td>
                <td>
                  {e.acknowledged ? <Pill tone="green" noDot>{t('warehouse.exceptions.tab.acknowledged')}</Pill> : <button className="btn btn-xs btn-primary">{t('warehouse.common.btn.acknowledge')}</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
};

const Performance = () => {
  const { t } = useI18n();
  const bars = [
    // last 14 days, normalised
    72, 78, 85, 82, 88, 92, 91, 94, 89, 87, 92, 90, 93, 92,
  ];

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
          <div style={{ fontFamily: 'var(--font-impact)', fontWeight: 800, fontSize: 44, color: 'var(--forest)', lineHeight: 1 }}>{WM.KPIs.stagingSLA.value}<span style={{ fontSize: 16, color: 'var(--fg-muted)', fontFamily: 'var(--font-sans)' }}>%</span></div>
          <SparkBars data={bars} tone="slate"/>
          <div className="small muted" style={{ marginTop: 6 }}>14-day trend · <span className="red">−1.2pp</span> vs prior</div>
        </Card>
        <Card title={t('warehouse.perf.card.inboundAdherence')} subtitle="Receipts on scheduled day" eyebrow="Target 90%">
          <div style={{ fontFamily: 'var(--font-impact)', fontWeight: 800, fontSize: 44, color: 'var(--forest)', lineHeight: 1 }}>{WM.KPIs.inboundAdherence.value}<span style={{ fontSize: 16, color: 'var(--fg-muted)', fontFamily: 'var(--font-sans)' }}>%</span></div>
          <SparkBars data={[70, 72, 75, 78, 80, 84, 82, 86, 83, 85, 82, 84, 81, 84]} tone="sunset"/>
          <div className="small red" style={{ marginTop: 6 }}>Below target — vendor 0010142 slipping</div>
        </Card>
        <Card title={t('warehouse.perf.card.outboundReady')} subtitle="Deliveries ready by cut-off" eyebrow="Target 98%">
          <div style={{ fontFamily: 'var(--font-impact)', fontWeight: 800, fontSize: 44, color: 'var(--forest)', lineHeight: 1 }}>{WM.KPIs.outboundReady.value}<span style={{ fontSize: 16, color: 'var(--fg-muted)', fontFamily: 'var(--font-sans)' }}>%</span></div>
          <SparkBars data={[92, 93, 94, 94, 95, 95, 96, 96, 97, 96, 96, 97, 97, 96]} tone="jade"/>
          <div className="small green" style={{ marginTop: 6 }}>+0.8pp vs prior</div>
        </Card>
        <Card title={t('warehouse.perf.card.pickProd')} subtitle="Lines per picker-hour" eyebrow="Target 130">
          <div style={{ fontFamily: 'var(--font-impact)', fontWeight: 800, fontSize: 44, color: 'var(--forest)', lineHeight: 1 }}>{WM.KPIs.pickProd.value}</div>
          <SparkBars data={[120, 125, 128, 130, 132, 135, 138, 140, 139, 141, 140, 142, 141, 142]} tone="slate"/>
          <div className="small green" style={{ marginTop: 6 }}>+6 ln/h vs prior</div>
        </Card>
      </div>

      <div className="grid-2" style={{ marginBottom: 16 }}>
        <Card title={t('warehouse.perf.card.kpiCatalogue')} subtitle="Thirteen measures covering the manager's span of control" eyebrow="KPIs">
          <table className="tbl">
            <thead><tr><th>{t('warehouse.perf.col.kpi')}</th><th className="num">{t('warehouse.perf.col.value')}</th><th className="num">{t('warehouse.perf.col.target')}</th><th>Δ</th></tr></thead>
            <tbody>
              {Object.entries(WM.KPIs).map(([k, v]) => {
                const meetsTarget = typeof v.target === 'number' ? (k.includes('put') || k === 'toAgeing' || k === 'leftoverReturn' || k === 'stockoutRate' ? v.value <= v.target : v.value >= v.target) : true;
                return (
                  <tr key={k}>
                    <td style={{ fontSize: 12 }}>{kpiLabels[k] ?? k}</td>
                    <td className="num bold">{v.value}{v.unit}</td>
                    <td className="num muted">{v.target}{v.unit}</td>
                    <td><Pill tone={meetsTarget ? 'green' : 'red'} noDot>{v.trend > 0 ? '+' : ''}{v.trend}</Pill></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>

        <Card title={t('warehouse.perf.card.workloadHeatmap')} subtitle="Task-completion density by hour" eyebrow="Rhythm">
          <div className="heatgrid" style={{ gridTemplateColumns: 'repeat(24, 1fr)' }}>
            {Array.from({ length: 14 * 24 }).map((_: any, i: number) => {
              const hour = i % 24;
              const busyness = (Math.sin((hour - 4) * 0.26) + 1) / 2;
              const noise = ((i * 13) % 11) / 20;
              const val = Math.max(0, Math.min(1, busyness + noise));
              const cls = val < 0.15 ? 'h1' : val < 0.35 ? 'h2' : val < 0.55 ? 'h3' : val < 0.8 ? 'h4' : 'h5';
              return <div key={i} className={`heatcell ${cls}`}/>;
            })}
          </div>
          <div className="flex between muted small" style={{ marginTop: 8 }}><span>14 days ago</span><span>Today</span></div>
        </Card>
      </div>

      <Card title={t('warehouse.perf.card.leftovers')} subtitle="Bulk drops and consolidated staging remain the biggest sources of waste" eyebrow="Loss">
        <div className="stack-8">
          <Hbar label="Bulk drop" value={4.2} max={6} tone="red"/>
          <Hbar label="Consolidated" value={3.1} max={6} tone="amber"/>
          <Hbar label="Standard" value={1.8} max={6}/>
          <Hbar label="Dispensary" value={0.4} max={6} tone="jade"/>
          <Hbar label="Campaign" value={2.0} max={6} tone="amber"/>
          <Hbar label="SSCC pallet" value={0.6} max={6} tone="jade"/>
          <Hbar label="Fast-mover" value={1.2} max={6}/>
        </div>
      </Card>
    </div>
  );
};


export { Exceptions, Performance };
