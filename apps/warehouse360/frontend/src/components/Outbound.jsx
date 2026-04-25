import React from 'react';
import WM from '../data/mockData.js';
import { Icon, Pill, Progress, RiskDot } from './Primitives.jsx';
import { FilterBar, Card, KPI } from './Shared.jsx';
import { DockSchedule } from './Inbound.jsx';

/* Outbound — deliveries, picking, staging, loading, dock view */

const Outbound = ({ onOpen }) => {
  const [tab, setTab] = React.useState('all');
  const [filters, setFilters] = React.useState({ risk: 'all', dock: 'all' });

  const rows = React.useMemo(() => {
    let r = WM.DELIVERIES;
    if (tab === 'picking') r = r.filter((d) => d.status === 'Picking' || d.status === 'Open');
    if (tab === 'staged') r = r.filter((d) => d.status === 'Staged');
    if (tab === 'loading') r = r.filter((d) => d.status === 'Loading' || d.status === 'Loaded');
    if (tab === 'shipped') r = r.filter((d) => d.status === 'Shipped');
    if (tab === 'risk') r = r.filter((d) => d.risk === 'red');
    if (filters.risk !== 'all') r = r.filter((d) => d.risk === filters.risk);
    if (filters.dock !== 'all') r = r.filter((d) => d.dock.id === filters.dock);
    return r;
  }, [tab, filters]);

  const counts = {
    all: WM.DELIVERIES.length,
    picking: WM.DELIVERIES.filter((d) => d.status === 'Picking' || d.status === 'Open').length,
    staged: WM.DELIVERIES.filter((d) => d.status === 'Staged').length,
    loading: WM.DELIVERIES.filter((d) => d.status === 'Loading' || d.status === 'Loaded').length,
    shipped: WM.DELIVERIES.filter((d) => d.status === 'Shipped').length,
    risk: WM.DELIVERIES.filter((d) => d.risk === 'red').length,
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Outbound · Customer deliveries</div>
          <h1 className="page-title">Outbound Deliveries</h1>
          <div className="page-desc">Pick · stage · load · ship. Red where cut-off is within 2 hours and pick isn't complete.</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary"><Icon name="download" size={14}/> Manifest</button>
          <button className="btn btn-primary"><Icon name="truckOut" size={14}/> Schedule load</button>
        </div>
      </div>

      <div className="kpi-grid">
        <KPI label="Deliveries today" value={WM.DELIVERIES.filter((d) => WM.minutesFromNow(d.cutoff) > -6 * 60 && WM.minutesFromNow(d.cutoff) < 12 * 60).length} tone="ok"/>
        <KPI label="At cut-off risk" value={counts.risk} tone="critical" trend={+1}/>
        <KPI label="Short picks" value={WM.DELIVERIES.reduce((a, d) => a + d.shortPicks, 0)} tone="warn"/>
        <KPI label="Pallets staged" value="142" unit=" / 178" tone="ok" barPct={80}/>
        <KPI label="Outbound docks busy" value="3" unit=" / 4" tone="warn"/>
        <KPI label="Shipped today" value={counts.shipped} tone="ok" trend={+4}/>
      </div>

      <Card title="Outbound dock schedule" subtitle="Cut-off times · red = missed or imminent"
        eyebrow="Docks" style={{ marginBottom: 16 }}>
        <DockSchedule type="Outbound" onOpen={onOpen}/>
      </Card>

      <div className="tabs">
        {[
          { id: 'all', label: 'All deliveries' },
          { id: 'picking', label: 'Picking' },
          { id: 'staged', label: 'Staged' },
          { id: 'loading', label: 'Loading' },
          { id: 'shipped', label: 'Shipped' },
          { id: 'risk', label: 'Cut-off risk' },
        ].map((t) => (
          <button key={t.id} className={`tab ${tab === t.id ? 'is-active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}<span className="tab-count">{counts[t.id]}</span>
          </button>
        ))}
      </div>

      <FilterBar
        filters={[
          { key: 'risk', label: 'Risk', chips: [
            { value: 'all', label: 'All' },
            { value: 'red', label: 'Critical', dot: 'red' },
            { value: 'amber', label: 'At risk', dot: 'amber' },
            { value: 'green', label: 'On track' },
          ] },
          { key: 'dock', label: 'Dock', options: [
            { value: 'all', label: 'All docks' },
            ...WM.DOCKS.filter((d) => d.type === 'Outbound').map((d) => ({ value: d.id, label: d.id })),
          ] },
        ]}
        values={filters}
        onChange={(k, v) => setFilters({ ...filters, [k]: v })}
      />

      <Card title={`${rows.length} outbound deliveries`} tight>
        <div className="scroll-x">
          <table className="tbl">
            <thead>
              <tr>
                <th></th><th>Delivery</th><th>Customer</th><th>Carrier</th><th>Cut-off</th>
                <th className="num">Pick</th><th className="num">Stage</th><th className="num">Load</th>
                <th className="num">Pal</th><th>Dock</th><th>Status</th><th>Flags</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => (
                <tr key={d.id} onClick={() => onOpen(d)} className={`is-risk-${d.risk}`}>
                  <td><RiskDot risk={d.risk}/></td>
                  <td><div className="code">{d.id}</div><div className="muted" style={{ fontSize: 11 }}>SO {d.so}</div></td>
                  <td><div style={{ fontSize: 12, fontWeight: 600 }}>{d.customer.name}</div><div className="muted" style={{ fontSize: 11 }}>{d.customer.id}</div></td>
                  <td style={{ fontSize: 12 }}>{d.carrier}</td>
                  <td className="mono small">{WM.fmtTime(d.cutoff)}</td>
                  <td className="num" style={{ width: 80 }}>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'flex-end' }}>
                      <span className="mono" style={{ fontSize: 11 }}>{d.pickPct}%</span>
                      <div style={{ width: 30 }}><Progress pct={d.pickPct} tone={d.pickPct < 70 ? 'red' : d.pickPct < 95 ? 'amber' : ''}/></div>
                    </div>
                  </td>
                  <td className="num"><span className="mono" style={{ fontSize: 11 }}>{d.stagePct}%</span></td>
                  <td className="num"><span className="mono" style={{ fontSize: 11 }}>{d.loadPct}%</span></td>
                  <td className="num">{d.pallets}</td>
                  <td className="mono small">{d.dock.id}</td>
                  <td><Pill tone={d.status === 'Shipped' ? 'green' : d.status === 'Loaded' ? 'green' : d.status === 'Loading' ? 'slate' : d.status === 'Staged' ? 'sage' : d.status === 'Picking' ? 'amber' : 'grey'}>{d.status}</Pill></td>
                  <td>
                    {d.shortPicks > 0 && <span className="tag" style={{ color: 'var(--sunset)', borderColor: 'var(--sunset)' }}>{d.shortPicks} SHORT</span>}
                    {d.hu && <span className="tag" style={{ marginLeft: 3 }}>HU</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

const DeliveryDetail = ({ delivery }) => {
  if (!delivery) return null;
  const lines = Array.from({ length: delivery.lines }, (_, i) => ({
    pos: String((i + 1) * 10).padStart(5, '0'),
    material: WM.MATERIALS[(i * 3) % WM.MATERIALS.length],
    qty: 40 + i * 17,
    uom: 'KG',
    picked: i < delivery.linesDone,
    short: i === 1 && delivery.shortPicks > 0,
  }));

  return (
    <div className="stack-16">
      <div className="grid-2">
        <div className="scale-card">
          <div className="t-eyebrow">Cut-off</div>
          <div style={{ fontFamily: 'var(--font-impact)', fontWeight: 800, fontSize: 28, color: 'var(--forest)', lineHeight: 1, marginTop: 4 }}>{WM.fmtTime(delivery.cutoff)}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{delivery.carrier} · Dock {delivery.dock.id}</div>
        </div>
        <div className="scale-card">
          <div className="t-eyebrow">Progress</div>
          <div className="stack-8" style={{ marginTop: 4 }}>
            <div><div className="progress-label"><span>Pick</span><span className="mono">{delivery.pickPct}%</span></div><Progress pct={delivery.pickPct} tone={delivery.pickPct < 70 ? 'red' : delivery.pickPct < 95 ? 'amber' : ''}/></div>
            <div><div className="progress-label"><span>Stage</span><span className="mono">{delivery.stagePct}%</span></div><Progress pct={delivery.stagePct} tone="slate"/></div>
            <div><div className="progress-label"><span>Load</span><span className="mono">{delivery.loadPct}%</span></div><Progress pct={delivery.loadPct} tone="slate"/></div>
          </div>
        </div>
      </div>

      <Card title="Delivery header" eyebrow="LIKP · LIPS" tight>
        <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
          {[
            ['Delivery', delivery.id],
            ['Sales order', delivery.so],
            ['Customer', delivery.customer.name],
            ['Carrier', delivery.carrier],
            ['Weight', delivery.weight.toLocaleString() + ' kg'],
            ['Pallets', delivery.pallets + ' pal · ' + (delivery.hu ? 'HU managed' : 'non-HU')],
          ].map(([k, v], i) => (
            <div key={i} style={{ padding: '12px 16px', borderBottom: i < 3 ? '1px solid var(--stroke-soft)' : 'none', borderRight: i % 3 !== 2 ? '1px solid var(--stroke-soft)' : 'none' }}>
              <div className="t-eyebrow" style={{ marginBottom: 3 }}>{k}</div>
              <div style={{ fontSize: 13, color: 'var(--forest)', fontWeight: 500 }}>{v}</div>
            </div>
          ))}
        </dl>
      </Card>

      <Card title="Delivery lines" subtitle={`${delivery.lines} items · ${delivery.linesDone} picked${delivery.shortPicks ? ' · ' + delivery.shortPicks + ' short' : ''}`} eyebrow="Lines" tight>
        <table className="tbl">
          <thead><tr><th>Pos</th><th>Material</th><th className="num">Qty</th><th>SSCC</th><th>Status</th></tr></thead>
          <tbody>
            {lines.slice(0, 12).map((l, i) => (
              <tr key={i}>
                <td className="mono">{l.pos}</td>
                <td><div style={{ fontSize: 12 }}>{l.material.name}</div><div className="muted" style={{ fontSize: 11 }}>{l.material.id}</div></td>
                <td className="num">{l.qty} {l.uom}</td>
                <td className="mono small">{delivery.hu ? '003401…' + String(i).padStart(4, '0') : '—'}</td>
                <td>{l.short ? <Pill tone="red">Short</Pill> : l.picked ? <Pill tone="green">Picked</Pill> : <Pill tone="grey">Open</Pill>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Pick, stage & load timeline" eyebrow="Flow" tight>
        <div style={{ padding: 16 }}>
          {[
            { label: 'Pick', pct: delivery.pickPct },
            { label: 'Stage', pct: delivery.stagePct },
            { label: 'Load', pct: delivery.loadPct },
            { label: 'Ship', pct: delivery.status === 'Shipped' ? 100 : 0 },
          ].map((s, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 60px', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600 }}>{s.label}</div>
              <Progress pct={s.pct} tone={s.pct < 50 && i === 0 && WM.minutesFromNow(delivery.cutoff) < 120 ? 'red' : s.pct < 90 ? 'amber' : ''}/>
              <div className="mono right" style={{ fontSize: 11 }}>{s.pct}%</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};


export { Outbound, DeliveryDetail };
