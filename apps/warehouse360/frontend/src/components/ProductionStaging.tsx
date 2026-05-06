/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { useI18n } from '@connectio/shared-frontend-i18n'
import { useApi } from '../hooks/useApi'
import { Icon, Pill, Progress, RiskDot } from './Primitives'
import { FilterBar, Card, KPI } from './Shared'
import { fmtTime, minutesFromNow, now } from '~/utils/time'

/* Production Staging — primary screen.
   Tabs per staging method. Filters. Dense table. Detail drawer drill-down.
*/

const STAGING_TABS = [
  { id: 'all',  label: 'warehouse.staging.tab.all' },
  { id: 'std',  label: 'warehouse.staging.tab.std' },
  { id: 'cons', label: 'warehouse.staging.tab.cons' },
  { id: 'bulk', label: 'warehouse.staging.tab.bulk' },
  { id: 'camp', label: 'warehouse.staging.tab.camp' },
  { id: 'fast', label: 'warehouse.staging.tab.fast' },
  { id: 'sscc', label: 'warehouse.staging.tab.sscc' },
  { id: 'disp', label: 'warehouse.staging.tab.disp' },
];

const STAGING_METHODS = [
  { id: 'std', label: 'Standard staging' },
  { id: 'cons', label: 'Consolidated staging' },
  { id: 'bulk', label: 'Bulk drop' },
  { id: 'camp', label: 'Campaign' },
  { id: 'fast', label: 'Fast-mover replen' },
  { id: 'sscc', label: 'SSCC pallet' },
  { id: 'disp', label: 'Dispensary' },
];

const StagingMethodChip = ({ id }) => {
  const m = STAGING_METHODS.find((m: any) => m.id === id);
  if (!m) return null;
  return <span className="tag tag-slate">{m.label}</span>;
};

const normalizeOrder = (o) => {
  if (!o.order_id) return o;
  const startDate = o.sched_start ? new Date(o.sched_start) : null;
  const endDate = o.sched_finish
    ? new Date(o.sched_finish)
    : startDate ? new Date(startDate.getTime() + 8 * 3600000) : null;
  return {
    _source: 'api',
    id: o.order_id,
    sapOrder: o.sap_order ?? o.order_id,
    product: o.material_name ?? o.material_id ?? '—',
    material: { id: o.material_id ?? '—', name: o.material_name ?? '—' },
    line: { id: '—', name: '—', area: '—' },
    method: { id: 'all', label: '—' },
    start: startDate,
    end: endDate,
    stagingPct: Math.round(o.staging_pct ?? 0),
    risk: o.risk ?? 'grey',
    pallets: 0,
    palletsStaged: 0,
    bomCount: o.to_items_total ?? 0,
    bomPicked: o.to_items_done ?? 0,
    status: o.risk === 'red' || o.risk === 'amber' ? 'Staging' : o.risk === 'green' ? 'Staged' : 'Open',
    dispensaryRequired: false,
    batchCritical: false,
    duration: null,
    shift: { id: null, label: '—', hours: '—' },
    notes: null,
  };
};

/** Props for the ProductionStaging page. */
interface ProductionStagingProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onOpenOrder?: (order: any) => void
}

const ProductionStaging = ({ onOpenOrder }: ProductionStagingProps) => {
  const { t } = useI18n();
  const [tab, setTab] = React.useState('all');
  const [filters, setFilters] = React.useState({ risk: 'all', shift: 'all', line: 'all', window: 'today' });
  const [sort, setSort] = React.useState({ key: 'start', dir: 'asc' });

  const { data: ordersResp, loading: ordersLoading, error: ordersError } = useApi<any>('/api/wh-cockpit');
  const { data: linesideResp } = useApi<any>('/api/inventory/lineside');
  const { data: tasksResp } = useApi<any>('/api/dispensary');
  const allOrders = React.useMemo(() => {
    const api = ordersResp?.orders ?? [];
    return api.map(normalizeOrder);
  }, [ordersResp]);
  const liveLineOptions = React.useMemo(() => Array.from(
    new Map(
      allOrders
        .filter((o: any) => o.line?.id && o.line.id !== '—')
        .map((o: any) => [o.line.id, { value: o.line.id, label: o.line.name || o.line.id }])
    ).values()
  ), [allOrders]);
  const liveLineside = linesideResp?.lineside ?? [];
  const liveTasks = tasksResp?.tasks ?? [];
  const avgStagingPct = allOrders.length > 0
    ? Math.round(allOrders.reduce((sum: any, order: any) => sum + (order.stagingPct || 0), 0) / allOrders.length)
    : 0;
  const weighedTasks = liveTasks.filter((task: any) => task.status === 'Weighed' || task.weighed_qty > 0).length;

  const rows = React.useMemo(() => {
    let r = allOrders;
    if (tab !== 'all') r = r.filter((o: any) => o.method.id === tab);
    if (filters.risk !== 'all') r = r.filter((o: any) => o.risk === filters.risk);
    if (filters.shift !== 'all') r = r.filter((o: any) => o.shift.id === filters.shift);
    if (filters.line !== 'all') r = r.filter((o: any) => o.line.id === filters.line);
    if (filters.window === 'today') r = r.filter((o: any) => {
      if (!o.start) return false;
      const today = now(); today.setHours(0, 0, 0, 0);
      const end = new Date(today); end.setDate(end.getDate() + 1);
      return o.start >= today && o.start < end;
    });
    if (filters.window === '8h') r = r.filter((o: any) => o.start && minutesFromNow(o.start) >= -60 && minutesFromNow(o.start) <= 8 * 60);
    r = [...r].sort((a: any, b: any) => {
      const mul = sort.dir === 'asc' ? 1 : -1;
      if (sort.key === 'start') {
        if (!a.start && !b.start) return 0;
        if (!a.start) return 1;
        if (!b.start) return -1;
        return (a.start - b.start) * mul;
      }
      if (sort.key === 'risk') {
        const rm = { red: 0, amber: 1, green: 2 };
        return (rm[a.risk] - rm[b.risk]) * mul;
      }
      if (sort.key === 'staging') return (a.stagingPct - b.stagingPct) * mul;
      return 0;
    });
    return r;
  }, [allOrders, tab, filters, sort]);

  const counts = React.useMemo(() => {
    const c = { all: allOrders.length };
    for (const m of STAGING_METHODS) {
      c[m.id] = allOrders.filter((o: any) => o.method.id === m.id).length;
    }
    return c;
  }, [allOrders]);

  const riskCounts = React.useMemo(() => ({
    red: allOrders.filter((o: any) => o.risk === 'red').length,
    amber: allOrders.filter((o: any) => o.risk === 'amber').length,
    green: allOrders.filter((o: any) => o.risk === 'green').length,
  }), [allOrders]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Operations · Today · Shift B</div>
          <h1 className="page-title">{t('warehouse.title.staging')}</h1>
          <div className="page-desc">Live process orders for the selected plant, highlighting orders whose raw materials are late, short or uncleared.</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary"><Icon name="download" size={14}/> {t('warehouse.common.btn.export')}</button>
          <button className="btn btn-secondary"><Icon name="flag" size={14}/> {t('warehouse.staging.btn.prioritise')}</button>
          <button className="btn btn-primary"><Icon name="plus" size={14}/> {t('warehouse.staging.btn.newRun')}</button>
        </div>
      </div>

      {/* KPI strip for this screen */}
      <div className="kpi-grid">
        <KPI label={t('warehouse.staging.kpi.ordersAtRisk')} value={ordersLoading ? '...' : riskCounts.red + riskCounts.amber} tone={riskCounts.red > 0 ? 'critical' : riskCounts.amber > 0 ? 'warn' : 'ok'}/>
        <KPI label={t('warehouse.staging.kpi.stagingSLA')} value={ordersLoading ? '...' : avgStagingPct} unit="%" tone={avgStagingPct < 70 ? 'critical' : avgStagingPct < 95 ? 'warn' : 'ok'} barPct={avgStagingPct} barTone={avgStagingPct < 70 ? 'red' : avgStagingPct < 95 ? 'amber' : ''} target="95%"/>
        <KPI label={t('warehouse.staging.kpi.palletsStaged')} value="—" unit="" tone="ok"/>
        <KPI label={t('warehouse.staging.kpi.linesideBelowMin')} value={liveLineside.filter((l: any) => l.status === 'Below min').length} tone="warn"/>
        <KPI label={t('warehouse.staging.kpi.bulkDropsUncleared')} value="—" tone="ok"/>
        <KPI label={t('warehouse.staging.kpi.dispensaryReady')} value={weighedTasks} unit={'/ ' + liveTasks.length} tone="ok" barPct={liveTasks.length > 0 ? weighedTasks / liveTasks.length * 100 : 0} barTone="slate"/>
      </div>

      {/* Timeline */}
      <Card title={t('warehouse.staging.card.runSheet')} subtitle="Rolling 24h window across lines · red = staging incomplete at required time" eyebrow="Schedule"
        actions={<div className="flex items-center gap-6">
          <span className="tag">6:00 – 06:00 next day</span>
          <button className="btn btn-sm btn-ghost">Zoom</button>
        </div>}
        style={{ marginBottom: 16 }} tight>
        <StagingTimeline orders={allOrders} onOpen={onOpenOrder}/>
      </Card>

      {/* Method tabs */}
      <div className="tabs">
        {STAGING_TABS.map((tabDef: any) => (
          <button key={tabDef.id} className={`tab ${tab === tabDef.id ? 'is-active' : ''}`} onClick={() => setTab(tabDef.id)}>
            {t(tabDef.label)}
            <span className="tab-count">{counts[tabDef.id] || 0}</span>
          </button>
        ))}
      </div>

      <FilterBar
        filters={[
          { key: 'risk', label: t('warehouse.common.filter.risk'), chips: [
            { value: 'all', label: t('warehouse.common.all') },
            { value: 'red', label: t('warehouse.common.risk.critical'), dot: 'red', count: riskCounts.red },
            { value: 'amber', label: t('warehouse.common.risk.atRisk'), dot: 'amber', count: riskCounts.amber },
            { value: 'green', label: t('warehouse.common.risk.onTrack'), dot: '', count: riskCounts.green },
          ] },
          { key: 'shift', label: t('warehouse.staging.filter.shift'), chips: [
            { value: 'all', label: t('warehouse.common.all') },
            { value: 'A', label: 'A' }, { value: 'B', label: 'B' }, { value: 'C', label: 'C' },
          ] },
          { key: 'line', label: t('warehouse.staging.filter.line'), options: [
            { value: 'all', label: t('warehouse.staging.filter.allLines') },
            ...liveLineOptions,
          ] },
          { key: 'window', label: t('warehouse.staging.filter.window'), chips: [
            { value: '8h', label: t('warehouse.staging.filter.next8h') },
            { value: 'today', label: t('warehouse.staging.filter.today') },
            { value: 'all', label: t('warehouse.common.all') },
          ] },
        ]}
        values={filters}
        onChange={(k, v) => setFilters({ ...filters, [k]: v })}
      />

      <Card title={`${rows.length} production orders`}
        subtitle="Sorted by start time · click a row for staging detail"
        actions={<div className="flex gap-6 items-center">
          <button className={`btn btn-xs ${sort.key === 'start' ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setSort({ key: 'start', dir: sort.dir === 'asc' ? 'desc' : 'asc' })}>{t('warehouse.staging.sort.start')} {sort.key === 'start' ? (sort.dir === 'asc' ? '↑' : '↓') : ''}</button>
          <button className={`btn btn-xs ${sort.key === 'risk' ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setSort({ key: 'risk', dir: 'asc' })}>{t('warehouse.staging.sort.risk')}</button>
          <button className={`btn btn-xs ${sort.key === 'staging' ? 'btn-secondary' : 'btn-ghost'}`} onClick={() => setSort({ key: 'staging', dir: 'asc' })}>{t('warehouse.staging.sort.stagingPct')}</button>
        </div>}
        tight>
        <div className="scroll-x">
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 36 }}></th>
                <th>{t('warehouse.staging.col.processOrder')}</th>
                <th>{t('warehouse.staging.col.product')}</th>
                <th>{t('warehouse.staging.col.lineMethod')}</th>
                <th>{t('warehouse.common.col.start')}</th>
                <th className="num">{t('warehouse.common.col.staging')}</th>
                <th className="num">{t('warehouse.staging.col.pallets')}</th>
                <th className="num">{t('warehouse.staging.col.bom')}</th>
                <th>{t('warehouse.common.col.status')}</th>
                <th>{t('warehouse.staging.col.exceptions')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 60).map((o: any) => (
                <StagingRow key={o.id} o={o} onClick={() => onOpenOrder?.(o)}/>
              ))}
              {!ordersLoading && rows.length === 0 && (
                <tr><td colSpan={10} className="muted small">No live production orders match this plant and filter set.</td></tr>
              )}
              {ordersError && (
                <tr><td colSpan={10} className="red small">Unable to load live production orders: {ordersError}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

const StagingRow = ({ o, onClick }) => {
  const minsToStart = o.start ? minutesFromNow(o.start) : null;
  return (
    <tr className={`is-risk-${o.risk}`} onClick={onClick}>
      <td><RiskDot risk={o.risk}/></td>
      <td>
        <div className="code">{o.id}</div>
        <div className="muted" style={{ fontSize: 11 }}>SAP {o.sapOrder}</div>
      </td>
      <td>
        <div className="primary">{o.product}</div>
        <div className="muted" style={{ fontSize: 11 }}>{o.material.id}</div>
      </td>
      <td>
        <div>{o.line.name}</div>
        <div className="muted" style={{ fontSize: 11 }}>
          <StagingMethodChip id={o.method.id}/>
          {o.dispensaryRequired && <span className="tag tag-forest" style={{ marginLeft: 4 }}>DSP</span>}
        </div>
      </td>
      <td>
        <div className="mono bold" style={{ fontSize: 12 }}>{o.start ? fmtTime(o.start) : '—'}</div>
        <div className="muted" style={{ fontSize: 11 }}>{minsToStart === null ? '—' : minsToStart < 0 ? Math.abs(minsToStart) + 'm ago' : minsToStart < 60 ? 'in ' + minsToStart + 'm' : 'in ' + (minsToStart / 60).toFixed(1) + 'h'}</div>
      </td>
      <td className="num" style={{ minWidth: 140 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
          <span className="mono">{o.stagingPct}%</span>
          <div style={{ width: 60 }}><Progress pct={o.stagingPct} tone={o.stagingPct < 70 ? 'red' : o.stagingPct < 95 ? 'amber' : ''}/></div>
        </div>
      </td>
      <td className="num">{o.palletsStaged}/{o.pallets}</td>
      <td className="num">{o.bomPicked}/{o.bomCount}</td>
      <td><Pill tone={o.status === 'Completed' || o.status === 'Staged' ? 'green' : o.status === 'In Production' ? 'slate' : o.status === 'Staging' ? 'amber' : 'grey'}>{o.status}</Pill></td>
      <td>
        {o.risk === 'red' ? <Pill tone="red" noDot>Critical</Pill> : null}
        {o.risk === 'amber' ? <Pill tone="amber" noDot>At risk</Pill> : null}
        {o.notes && <div className="muted" style={{ fontSize: 10, marginTop: 2 }}>{o.notes}</div>}
      </td>
    </tr>
  );
};

// Timeline component
const StagingTimeline = ({ orders = [] as any[], onOpen }: { orders?: any[]; onOpen?: (o: any) => void }) => {
  const hours = 24;
  const startHour = 6; // starts at 06:00 today
  const dayStart = (() => { const d = now(); d.setHours(startHour, 0, 0, 0); return d; })();
  const dayEnd = new Date(dayStart.getTime() + hours * 3600000);

  const timelineOrders = orders.filter((o: any) => o.start && o.end && o.start < dayEnd && o.end > dayStart);
  const lineRows = Array.from(
    new Map(
      timelineOrders
        .filter((o: any) => o.line?.id && o.line.id !== '—')
        .map((o: any) => [o.line.id, o.line])
    ).values()
  ).slice(0, 6);

  const xFromTime = (d) => {
    const pct = (d.getTime() - dayStart.getTime()) / (hours * 3600000);
    return Math.max(0, Math.min(100, pct * 100));
  };
  const widthFromTimes = (a, b) => {
    const pct = (b.getTime() - a.getTime()) / (hours * 3600000);
    return pct * 100;
  };

  const nowX = xFromTime(now());

  return (
    <div style={{ minWidth: 900 }}>
      {lineRows.length === 0 && (
        <div className="muted small" style={{ padding: 12 }}>No live schedule rows available for this plant.</div>
      )}
      {/* hour ruler */}
      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr' }}>
        <div style={{ padding: '8px 12px', background: 'var(--stone)', borderBottom: '1px solid var(--stroke-soft)', fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--fg-muted)' }}>Line</div>
        <div className="timeline-hours">
          {Array.from({ length: hours + 1 }).map((_: any, i: number) => {
            const h = (startHour + i) % 24;
            return <div key={i} className="timeline-hour" data-label={String(h).padStart(2, '0') + ':00'} style={{ left: (i / hours) * 100 + '%' }}/>;
          })}
        </div>
      </div>
      {lineRows.map((line: any) => {
        const lineOrders = timelineOrders.filter((o: any) => o.line.id === line.id);
        return (
          <div className="timeline-row" key={line.id}>
            <div className="timeline-row-label">
              <div className="risk-dot slate"/>{line.id} · {line.name}
            </div>
            <div className="timeline-track">
              <div className="timeline-now" style={{ left: nowX + '%' }}/>
              {lineOrders.map((o: any) => {
                const left = Math.max(0, xFromTime(o.start));
                const width = Math.max(2, widthFromTimes(
                  o.start < dayStart ? dayStart : o.start,
                  o.end > dayEnd ? dayEnd : o.end
                ));
                return (
                  <button key={o.id} className={`timeline-event risk-${o.risk}`}
                    style={{ left: left + '%', width: width + '%', border: 'none', textAlign: 'left', cursor: 'pointer' }}
                    onClick={() => onOpen?.(o)}
                    title={`${o.id} · ${o.product}`}>
                    <div className="timeline-event-title">{o.product.split(' · ')[0]}</div>
                    <div className="timeline-event-meta">{fmtTime(o.start)}–{fmtTime(o.end)} · {o.stagingPct}%</div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};


export { ProductionStaging, StagingTimeline, normalizeOrder };
