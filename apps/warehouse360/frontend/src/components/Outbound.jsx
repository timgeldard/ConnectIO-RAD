import React from 'react';
import WM from '../data/mockData.js';
import { useApi } from '../hooks/useApi.js';
import { Icon, Pill, Progress, RiskDot } from './Primitives.jsx';
import { FilterBar, Card, KPI } from './Shared.jsx';
import { DockSchedule } from './Inbound.jsx';

/* Outbound — deliveries, picking, staging, loading, dock view */

const deliveryStatus = (d) => {
  if (d.shipped) return 'Shipped';
  if (d.wm_status === 'C') return 'Staged';
  if (d.wm_status === 'B') return 'Picking';
  return 'Open';
};

const Outbound = ({ onOpen }) => {
  const [tab, setTab] = React.useState('all');
  const [filters, setFilters] = React.useState({ risk: 'all' });
  const { data: resp, loading } = useApi('/api/deliveries');
  const allDeliveries = resp?.deliveries ?? [];

  const rows = React.useMemo(() => {
    let r = allDeliveries;
    const s = deliveryStatus;
    if (tab === 'picking') r = r.filter((d) => s(d) === 'Picking' || s(d) === 'Open');
    if (tab === 'staged')  r = r.filter((d) => s(d) === 'Staged');
    if (tab === 'shipped') r = r.filter((d) => s(d) === 'Shipped');
    if (tab === 'risk')    r = r.filter((d) => d.risk === 'red');
    if (filters.risk !== 'all') r = r.filter((d) => d.risk === filters.risk);
    return r;
  }, [tab, filters, allDeliveries]);

  const counts = React.useMemo(() => {
    const s = deliveryStatus;
    return {
      all:     allDeliveries.length,
      picking: allDeliveries.filter((d) => s(d) === 'Picking' || s(d) === 'Open').length,
      staged:  allDeliveries.filter((d) => s(d) === 'Staged').length,
      shipped: allDeliveries.filter((d) => s(d) === 'Shipped').length,
      risk:    allDeliveries.filter((d) => d.risk === 'red').length,
    };
  }, [allDeliveries]);

  const v = (n) => loading ? '...' : n;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Outbound · Customer deliveries</div>
          <h1 className="page-title">Outbound Deliveries</h1>
          <div className="page-desc">Pick · stage · load · ship. Red where cut-off is within 2 hours and pick is incomplete.</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary"><Icon name="download" size={14}/> Manifest</button>
          <button className="btn btn-primary"><Icon name="truckOut" size={14}/> Schedule load</button>
        </div>
      </div>

      <div className="kpi-grid">
        <KPI label="Deliveries" value={v(counts.all)} tone="ok"/>
        <KPI label="At cut-off risk" value={v(counts.risk)} tone={counts.risk > 0 ? 'critical' : 'ok'}/>
        <KPI label="Open / Picking" value={v(counts.picking)} tone="ok"/>
        <KPI label="Staged" value={v(counts.staged)} tone="ok"/>
        <KPI label="Shipped" value={v(counts.shipped)} tone="ok"/>
        <KPI label="Total packages" value={v(allDeliveries.reduce((a, d) => a + (d.packages || 0), 0))} unit=" pkg" tone="ok"/>
      </div>

      <Card title="Outbound dock schedule" subtitle="Cut-off times · red = missed or imminent"
        eyebrow="Docks" style={{ marginBottom: 16 }}>
        <DockSchedule type="Outbound" onOpen={onOpen}/>
      </Card>

      <div className="tabs">
        {[
          { id: 'all',     label: 'All deliveries' },
          { id: 'picking', label: 'Open / Picking' },
          { id: 'staged',  label: 'Staged' },
          { id: 'shipped', label: 'Shipped' },
          { id: 'risk',    label: 'Cut-off risk' },
        ].map((t) => (
          <button key={t.id} className={`tab ${tab === t.id ? 'is-active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}<span className="tab-count">{counts[t.id]}</span>
          </button>
        ))}
      </div>

      <FilterBar
        filters={[
          { key: 'risk', label: 'Risk', chips: [
            { value: 'all',   label: 'All' },
            { value: 'red',   label: 'Critical', dot: 'red' },
            { value: 'amber', label: 'At risk',  dot: 'amber' },
            { value: 'green', label: 'On track' },
          ] },
        ]}
        values={filters}
        onChange={(k, val) => setFilters({ ...filters, [k]: val })}
      />

      <Card title={`${rows.length} outbound deliveries`} tight>
        <div className="scroll-x">
          <table className="tbl">
            <thead>
              <tr>
                <th></th><th>Delivery</th><th>Customer</th><th>Carrier</th><th>GI date</th>
                <th className="num">Pick</th><th className="num">Pkg</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => {
                const status = deliveryStatus(d);
                const pick = Math.round(d.pick_pct || 0);
                return (
                  <tr key={d.delivery_id} onClick={() => onOpen(d)} className={`is-risk-${d.risk}`}>
                    <td><RiskDot risk={d.risk}/></td>
                    <td><div className="code">{d.delivery_id}</div></td>
                    <td>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{d.customer_name || '—'}</div>
                      <div className="muted" style={{ fontSize: 11 }}>{d.customer_id}</div>
                    </td>
                    <td style={{ fontSize: 12 }}>{d.carrier || '—'}</td>
                    <td className="mono small">{d.planned_gi_date || '—'}</td>
                    <td className="num" style={{ width: 80 }}>
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'flex-end' }}>
                        <span className="mono" style={{ fontSize: 11 }}>{pick}%</span>
                        <div style={{ width: 30 }}><Progress pct={pick} tone={pick < 70 ? 'red' : pick < 95 ? 'amber' : ''}/></div>
                      </div>
                    </td>
                    <td className="num">{d.packages ?? '—'}</td>
                    <td>
                      <Pill tone={status === 'Shipped' ? 'green' : status === 'Staged' ? 'sage' : status === 'Picking' ? 'amber' : 'grey'}>
                        {status}
                      </Pill>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

const DeliveryDetail = ({ delivery }) => {
  if (!delivery) return null;

  const id        = delivery.delivery_id   ?? delivery.id;
  const custName  = delivery.customer_name ?? delivery.customer?.name ?? '—';
  const carrier   = delivery.carrier       ?? '—';
  const giDate    = delivery.planned_gi_date ?? (delivery.cutoff ? WM.fmtTime(delivery.cutoff) : '—');
  const pickPct   = Math.round(delivery.pick_pct ?? delivery.pickPct ?? 0);
  const stagePct  = delivery.stagePct ?? null;
  const loadPct   = delivery.loadPct  ?? null;
  const weight    = delivery.gross_weight ?? delivery.weight;
  const weightUom = delivery.weight_uom   ?? 'kg';
  const packages  = delivery.packages ?? delivery.pallets;
  const lineCount = delivery.line_count ?? delivery.lines;
  const hu        = delivery.hu ?? false;
  const status    = delivery.delivery_id ? deliveryStatus(delivery) : delivery.status;

  const mockLines = delivery.lines
    ? Array.from({ length: delivery.lines }, (_, i) => ({
        pos: String((i + 1) * 10).padStart(5, '0'),
        material: WM.MATERIALS[(i * 3) % WM.MATERIALS.length],
        qty: 40 + i * 17,
        picked: i < delivery.linesDone,
        short: i === 1 && delivery.shortPicks > 0,
      }))
    : null;

  const timelineSteps = [
    { label: 'Pick',  pct: pickPct },
    ...(stagePct !== null ? [{ label: 'Stage', pct: stagePct }] : []),
    ...(loadPct  !== null ? [{ label: 'Load',  pct: loadPct  }] : []),
    ...(status === 'Shipped' ? [{ label: 'Ship', pct: 100 }]   : []),
  ];

  return (
    <div className="stack-16">
      <div className="grid-2">
        <div className="scale-card">
          <div className="t-eyebrow">GI Date</div>
          <div style={{ fontFamily: 'var(--font-impact)', fontWeight: 800, fontSize: 28, color: 'var(--forest)', lineHeight: 1, marginTop: 4 }}>
            {giDate}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{carrier}</div>
        </div>
        <div className="scale-card">
          <div className="t-eyebrow">Progress</div>
          <div className="stack-8" style={{ marginTop: 4 }}>
            <div>
              <div className="progress-label"><span>Pick</span><span className="mono">{pickPct}%</span></div>
              <Progress pct={pickPct} tone={pickPct < 70 ? 'red' : pickPct < 95 ? 'amber' : ''}/>
            </div>
            {stagePct !== null && (
              <div>
                <div className="progress-label"><span>Stage</span><span className="mono">{stagePct}%</span></div>
                <Progress pct={stagePct} tone="slate"/>
              </div>
            )}
            {loadPct !== null && (
              <div>
                <div className="progress-label"><span>Load</span><span className="mono">{loadPct}%</span></div>
                <Progress pct={loadPct} tone="slate"/>
              </div>
            )}
          </div>
        </div>
      </div>

      <Card title="Delivery header" eyebrow="LIKP · LIPS" tight>
        <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
          {[
            ['Delivery',    id],
            ['Sales order', delivery.so ?? '—'],
            ['Customer',    custName],
            ['Carrier',     carrier],
            ['Weight',      weight != null ? weight.toLocaleString() + ' ' + weightUom : '—'],
            ['Packages',    packages != null ? packages + (hu ? ' · HU' : '') : '—'],
          ].map(([k, val], i) => (
            <div key={i} style={{ padding: '12px 16px', borderBottom: i < 3 ? '1px solid var(--stroke-soft)' : 'none', borderRight: i % 3 !== 2 ? '1px solid var(--stroke-soft)' : 'none' }}>
              <div className="t-eyebrow" style={{ marginBottom: 3 }}>{k}</div>
              <div style={{ fontSize: 13, color: 'var(--forest)', fontWeight: 500 }}>{val}</div>
            </div>
          ))}
        </dl>
      </Card>

      <Card title="Delivery lines" subtitle={lineCount != null ? `${lineCount} items` : ''} eyebrow="Lines" tight>
        {mockLines ? (
          <table className="tbl">
            <thead><tr><th>Pos</th><th>Material</th><th className="num">Qty</th><th>SSCC</th><th>Status</th></tr></thead>
            <tbody>
              {mockLines.slice(0, 12).map((l, i) => (
                <tr key={i}>
                  <td className="mono">{l.pos}</td>
                  <td><div style={{ fontSize: 12 }}>{l.material.name}</div><div className="muted" style={{ fontSize: 11 }}>{l.material.id}</div></td>
                  <td className="num">{l.qty} KG</td>
                  <td className="mono small">{hu ? '003401...' + String(i).padStart(4, '0') : '—'}</td>
                  <td>{l.short ? <Pill tone="red">Short</Pill> : l.picked ? <Pill tone="green">Picked</Pill> : <Pill tone="grey">Open</Pill>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: '12px 16px', color: 'var(--fg-muted)', fontSize: 13 }}>
            Line detail available in Phase 2 (LIPS line items view).
          </div>
        )}
      </Card>

      {timelineSteps.length > 0 && (
        <Card title="Flow" eyebrow="Timeline" tight>
          <div style={{ padding: 16 }}>
            {timelineSteps.map((s, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 60px', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{s.label}</div>
                <Progress pct={s.pct} tone={s.pct < 50 && i === 0 ? 'red' : s.pct < 90 ? 'amber' : ''}/>
                <div className="mono right" style={{ fontSize: 11 }}>{s.pct}%</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};


export { Outbound, DeliveryDetail };
