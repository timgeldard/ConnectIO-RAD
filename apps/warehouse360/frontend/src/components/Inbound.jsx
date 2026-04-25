import React from 'react';
import WM from '../data/mockData.js';
import { Icon, Pill, Progress, RiskDot, Hbar } from './Primitives.jsx';
import { FilterBar, Card, KPI } from './Shared.jsx';

/* Inbound — PO + STO receipts, dock schedule, putaway backlog */

const Inbound = ({ onOpen }) => {
  const [tab, setTab] = React.useState('all');
  const [filters, setFilters] = React.useState({ risk: 'all', status: 'all', dock: 'all' });

  const rows = React.useMemo(() => {
    let r = WM.INBOUND;
    if (tab === 'po') r = r.filter((x) => x.type === 'PO');
    if (tab === 'sto') r = r.filter((x) => x.type === 'STO');
    if (tab === 'overdue') r = r.filter((x) => x.status === 'Overdue');
    if (tab === 'qa') r = r.filter((x) => x.qa === 'QA Hold' || x.qa === 'Inspection');
    if (tab === 'putaway') r = r.filter((x) => x.status === 'Awaiting Putaway');
    if (filters.risk !== 'all') r = r.filter((x) => x.risk === filters.risk);
    if (filters.dock !== 'all') r = r.filter((x) => x.dock.id === filters.dock);
    return r;
  }, [tab, filters]);

  const counts = {
    all: WM.INBOUND.length,
    po: WM.PO_RECEIPTS.length,
    sto: WM.STO_RECEIPTS.length,
    overdue: WM.INBOUND.filter((x) => x.status === 'Overdue').length,
    qa: WM.INBOUND.filter((x) => x.qa === 'QA Hold' || x.qa === 'Inspection').length,
    putaway: WM.INBOUND.filter((x) => x.status === 'Awaiting Putaway').length,
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Inbound · POs · STOs</div>
          <h1 className="page-title">Inbound</h1>
          <div className="page-desc">Receipts against Purchase Orders and Stock Transport Orders. Red flags where materials are needed for today's production.</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary"><Icon name="download" size={14}/> Receipt log</button>
          <button className="btn btn-primary"><Icon name="truckIn" size={14}/> Book dock slot</button>
        </div>
      </div>

      <div className="kpi-grid">
        <KPI label="Receipts due today" value={WM.INBOUND.filter((r) => WM.minutesFromNow(r.eta) > -8 * 60 && WM.minutesFromNow(r.eta) < 10 * 60).length} tone="ok"/>
        <KPI label="Overdue" value={counts.overdue} tone="critical"/>
        <KPI label="Awaiting putaway > 2h" value={counts.putaway} tone="warn"/>
        <KPI label="QA / Inspection hold" value={counts.qa} tone="warn"/>
        <KPI label="Short receipts" value={WM.INBOUND.filter((r) => r.receivedQty > 0 && r.receivedQty < r.expectedQty * 0.95).length} tone="warn"/>
        <KPI label="Needed for today" value={WM.INBOUND.filter((r) => r.neededForToday).length} tone="critical" trend={+1}/>
      </div>

      <div className="grid-2" style={{ marginBottom: 16 }}>
        <Card title="Dock schedule" subtitle="Inbound bays · next 10 hours" eyebrow="Docks">
          <DockSchedule type="Inbound" onOpen={onOpen}/>
        </Card>
        <Card title="Putaway backlog by storage type" subtitle="Pallets on interim storage 915 waiting to be put away" eyebrow="Backlog">
          <div className="stack-8">
            {WM.STORAGE_TYPES.slice(0, 5).map((s, i) => {
              const v = [12, 8, 5, 3, 2][i];
              const tone = v > 10 ? 'red' : v > 6 ? 'amber' : 'jade';
              return <Hbar key={i} label={`${s.id} · ${s.name}`} value={v} max={15} tone={tone}/>;
            })}
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--fg-muted)' }}>
            Target cycle time: <span className="mono forest bold">60m</span> · current <span className="mono amber bold">{WM.KPIs.putawayCycle.value}m</span>
          </div>
        </Card>
      </div>

      <div className="tabs">
        {[
          { id: 'all', label: 'All receipts' },
          { id: 'po', label: 'Purchase Orders' },
          { id: 'sto', label: 'Stock Transport' },
          { id: 'overdue', label: 'Overdue' },
          { id: 'qa', label: 'QA hold' },
          { id: 'putaway', label: 'Awaiting putaway' },
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
            ...WM.DOCKS.filter((d) => d.type === 'Inbound').map((d) => ({ value: d.id, label: d.id })),
          ] },
        ]}
        values={filters}
        onChange={(k, v) => setFilters({ ...filters, [k]: v })}
      />

      <Card title={`${rows.length} inbound receipts`} subtitle="Click a row for line detail and batch/SSCC capture"
        eyebrow="EKKO / EKPO · LIKP"
        tight>
        <div className="scroll-x">
          <table className="tbl">
            <thead>
              <tr>
                <th></th><th>Type</th><th>Doc</th><th>Vendor / Plant</th><th>Material</th>
                <th className="num">Expected</th><th className="num">Received</th><th className="num">Putaway</th>
                <th>ETA</th><th>Dock</th><th>QA</th><th>Status</th><th>Flags</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const shortPct = r.receivedQty === 0 ? 0 : Math.round(r.receivedQty / r.expectedQty * 100);
                return (
                  <tr key={r.id} onClick={() => onOpen(r)} className={`is-risk-${r.risk}`}>
                    <td><RiskDot risk={r.risk}/></td>
                    <td><Pill tone={r.type === 'PO' ? 'slate' : 'sage'} noDot>{r.type}</Pill></td>
                    <td className="code">{r.id}</td>
                    <td><div style={{ fontSize: 12, fontWeight: 600 }}>{r.vendor.name}</div><div className="muted" style={{ fontSize: 11 }}>{r.vendor.id}</div></td>
                    <td><div style={{ fontSize: 12 }}>{r.material.name}</div><div className="muted" style={{ fontSize: 11 }}>{r.material.id}</div></td>
                    <td className="num">{r.expectedQty.toLocaleString()} {r.uom}</td>
                    <td className="num">
                      <span className={shortPct < 95 && r.receivedQty > 0 ? 'amber bold' : ''}>{r.receivedQty.toLocaleString()}</span>
                    </td>
                    <td className="num">{r.puc}%</td>
                    <td className="mono small">{WM.fmtTime(r.eta)}</td>
                    <td className="mono small">{r.dock.id}</td>
                    <td><Pill tone={r.qa === 'QA Hold' ? 'red' : r.qa === 'Inspection' ? 'amber' : 'green'} noDot>{r.qa}</Pill></td>
                    <td><Pill tone={r.status === 'Overdue' ? 'red' : r.status === 'Put away' ? 'green' : r.status === 'Expected' ? 'grey' : 'amber'}>{r.status}</Pill></td>
                    <td>
                      {r.neededForToday && <span className="tag tag-slate" style={{ marginRight: 3 }}>TODAY</span>}
                      {r.sscc && <span className="tag">SSCC</span>}
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

const DockSchedule = ({ type, onOpen }) => {
  const docks = WM.DOCKS.filter((d) => d.type === type);
  const events = type === 'Inbound' ? WM.INBOUND : WM.DELIVERIES;
  const startH = 6;
  const hours = 14;
  const dayStart = (() => { const d = new Date(WM.NOW); d.setHours(startH, 0, 0, 0); return d; })();
  const xAt = (d) => ((d - dayStart) / (hours * 3600000)) * 100;
  const nowX = xAt(WM.NOW);
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', marginBottom: 4 }}>
        <div></div>
        <div style={{ position: 'relative', height: 18 }}>
          {Array.from({ length: hours + 1 }).map((_, i) => (
            <div key={i} style={{ position: 'absolute', left: (i / hours * 100) + '%', transform: 'translateX(-50%)', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--fg-muted)' }}>
              {String((startH + i) % 24).padStart(2, '0')}
            </div>
          ))}
        </div>
      </div>
      {docks.map((dock) => {
        const slots = events.filter((e) => e.dock.id === dock.id);
        return (
          <div key={dock.id} style={{ display: 'grid', gridTemplateColumns: '60px 1fr', alignItems: 'center', marginBottom: 4 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--forest)', fontWeight: 600 }}>{dock.id}</div>
            <div style={{ position: 'relative', height: 28, background: 'var(--stone)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ position: 'absolute', left: nowX + '%', top: 0, bottom: 0, width: 2, background: 'var(--sunset)', zIndex: 2 }}/>
              {slots.slice(0, 4).map((s) => {
                const t = type === 'Inbound' ? s.eta : s.cutoff;
                const left = Math.max(0, Math.min(100, xAt(t)));
                const width = 6;
                const colour = s.risk === 'red' ? 'var(--sunset)' : s.risk === 'amber' ? 'var(--sunrise)' : 'var(--valentia-slate)';
                return (
                  <button key={s.id} onClick={() => onOpen?.(s)} style={{
                    position: 'absolute', left: left + '%', top: 3, bottom: 3, width: width + '%', minWidth: 30,
                    background: colour, color: 'white', border: 'none', borderRadius: 3, fontSize: 9, fontFamily: 'var(--font-mono)', padding: '2px 4px',
                    cursor: 'pointer', overflow: 'hidden', textAlign: 'left',
                  }} title={s.id}>
                    {s.id.slice(-4)}
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

const ReceiptDetail = ({ receipt }) => {
  if (!receipt) return null;
  const lines = [
    { pos: '00010', material: receipt.material, expected: receipt.expectedQty, received: receipt.receivedQty, batch: 'B' + String(200000 + receipt.id.slice(-3) * 13).slice(0, 7) },
  ];
  return (
    <div className="stack-16">
      <div className="grid-2">
        <div className="scale-card">
          <div className="t-eyebrow">Expected · Received</div>
          <div style={{ fontFamily: 'var(--font-impact)', fontWeight: 800, fontSize: 28, color: 'var(--forest)', lineHeight: 1, marginTop: 4 }}>{receipt.receivedQty.toLocaleString()}<span style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--fg-muted)', fontWeight: 500 }}> / {receipt.expectedQty.toLocaleString()} {receipt.uom}</span></div>
          <Progress pct={receipt.receivedQty / receipt.expectedQty * 100} tone={receipt.receivedQty < receipt.expectedQty ? 'amber' : ''}/>
        </div>
        <div className="scale-card">
          <div className="t-eyebrow">ETA</div>
          <div style={{ fontFamily: 'var(--font-impact)', fontWeight: 800, fontSize: 28, color: 'var(--forest)', lineHeight: 1, marginTop: 4 }}>{WM.fmtTime(receipt.eta)}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Dock {receipt.dock.id} · {receipt.status}</div>
        </div>
      </div>

      <Card title="Document" eyebrow={receipt.type === 'PO' ? 'EKKO · EKPO' : 'STO · LIKP'} tight>
        <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
          {[
            ['Document', receipt.id],
            ['Type', receipt.type === 'PO' ? 'Purchase Order' : 'Stock Transport Order'],
            ['Vendor / Plant', receipt.vendor.name],
            ['Vendor ID', receipt.vendor.id],
            ['Material', receipt.material.name],
            ['Batches expected', receipt.batches],
          ].map(([k, v], i) => (
            <div key={i} style={{ padding: '12px 16px', borderBottom: i < 3 ? '1px solid var(--stroke-soft)' : 'none', borderRight: i % 3 !== 2 ? '1px solid var(--stroke-soft)' : 'none' }}>
              <div className="t-eyebrow" style={{ marginBottom: 3 }}>{k}</div>
              <div style={{ fontSize: 13, color: 'var(--forest)', fontWeight: 500 }}>{v}</div>
            </div>
          ))}
        </dl>
      </Card>

      <Card title="Line items" subtitle="GR posted · batch + SSCC captured" eyebrow="Lines" tight>
        <table className="tbl">
          <thead><tr><th>Pos</th><th>Material</th><th className="num">Expected</th><th className="num">Received</th><th>Batch</th><th>SSCC</th><th>Status</th></tr></thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i}>
                <td className="mono">{l.pos}</td>
                <td><div style={{ fontSize: 12 }}>{l.material.name}</div><div className="muted" style={{ fontSize: 11 }}>{l.material.id}</div></td>
                <td className="num">{l.expected.toLocaleString()} {receipt.uom}</td>
                <td className="num">{l.received.toLocaleString()}</td>
                <td className="mono small">{l.batch}</td>
                <td className="mono small">{receipt.sscc ? '003401…' + String(receipt.id).slice(-4) : '—'}</td>
                <td><Pill tone={receipt.status === 'Put away' ? 'green' : receipt.status === 'Expected' ? 'grey' : 'amber'}>{receipt.status}</Pill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Putaway tasks" subtitle="Assigned TOs for this receipt" eyebrow="LTAK / LTAP" tight>
        <table className="tbl">
          <thead><tr><th>TO</th><th>SSCC</th><th>Src</th><th>Dst bin</th><th>Operator</th><th>Status</th></tr></thead>
          <tbody>
            {WM.TOs.slice(0, 3).map((t, i) => (
              <tr key={i}>
                <td className="code">{t.id}</td>
                <td className="mono small">{t.sscc.slice(0, 8)}…{t.sscc.slice(-4)}</td>
                <td className="mono small">915 · Interim</td>
                <td className="mono small">{t.dstBin}</td>
                <td className="small">{t.assignedTo || <span className="muted">unassigned</span>}</td>
                <td><Pill tone={t.status === 'Confirmed' ? 'green' : 'amber'}>{t.status}</Pill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {receipt.neededForToday && (
        <div className="card" style={{ borderColor: 'var(--sunset)', background: 'color-mix(in srgb, var(--sunset) 6%, white)' }}>
          <div className="card-body">
            <div className="t-eyebrow" style={{ color: 'var(--sunset)' }}>Critical path</div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 16, lineHeight: 1.4, color: 'var(--forest)', marginTop: 6 }}>
              Material {receipt.material.id} is reserved for process orders starting today. Fast-track putaway to line-side bin.
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm">Expedite putaway</button>
              <button className="btn btn-secondary btn-sm">Notify production</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


export { Inbound, DockSchedule, ReceiptDetail };
