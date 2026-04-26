import React from 'react';
import WM from '../data/mockData.js';
import { useApi } from '../hooks/useApi.js';
import { Icon, Pill, Progress, RiskDot, Hbar } from './Primitives.jsx';
import { FilterBar, Card, KPI } from './Shared.jsx';

/* Inbound — PO + STO receipts, dock schedule, putaway backlog */

const Inbound = ({ onOpen }) => {
  const [tab, setTab] = React.useState('all');
  const [filters, setFilters] = React.useState({ risk: 'all' });
  const { data: resp, loading } = useApi('/api/inbound');
  const allReceipts = resp?.receipts ?? [];

  const rows = React.useMemo(() => {
    let r = allReceipts;
    if (tab === 'qa') r = r.filter((x) => x.qa_status === 'inspection');
    if (filters.risk !== 'all') r = r.filter((x) => x.risk === filters.risk);
    return r;
  }, [tab, filters, allReceipts]);

  const counts = React.useMemo(() => ({
    all: allReceipts.length,
    qa:  allReceipts.filter((x) => x.qa_status === 'inspection').length,
  }), [allReceipts]);

  const v = (n) => loading ? '...' : n;

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
        <KPI label="Open PO lines" value={v(counts.all)} tone="ok"/>
        <KPI label="QA / Inspection" value={v(counts.qa)} tone={counts.qa > 0 ? 'warn' : 'ok'}/>
        <KPI label="Putaway cycle" value={WM.KPIs.putawayCycle.value} unit=" min" tone="warn"/>
        <KPI label="Receipts today" value="—" tone="ok"/>
        <KPI label="Overdue" value="—" tone="ok"/>
        <KPI label="Needed for today" value="—" tone="ok"/>
      </div>

      <div className="grid-2" style={{ marginBottom: 16 }}>
        <Card title="Dock schedule" subtitle="Inbound bays · next 10 hours" eyebrow="Docks">
          <DockSchedule type="Inbound" onOpen={onOpen}/>
        </Card>
        <Card title="Putaway backlog by storage type" subtitle="Pallets on interim storage 915 waiting to be put away" eyebrow="Backlog">
          <div className="stack-8">
            {WM.STORAGE_TYPES.slice(0, 5).map((s, i) => {
              const val = [12, 8, 5, 3, 2][i];
              const tone = val > 10 ? 'red' : val > 6 ? 'amber' : 'jade';
              return <Hbar key={i} label={`${s.id} · ${s.name}`} value={val} max={15} tone={tone}/>;
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
          { id: 'qa',  label: 'QA hold' },
        ].map((t) => (
          <button key={t.id} className={`tab ${tab === t.id ? 'is-active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}<span className="tab-count">{counts[t.id] ?? ''}</span>
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

      <Card title={`${rows.length} inbound receipts`} subtitle="Click a row for line detail"
        eyebrow="EKKO / EKPO" tight>
        <div className="scroll-x">
          <table className="tbl">
            <thead>
              <tr>
                <th>Doc</th><th>Vendor</th><th>Material</th>
                <th className="num">Ordered</th><th className="num">Received</th>
                <th>Due date</th><th>QA</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.po_id + '-' + r.po_item} onClick={() => onOpen(r)}>
                  <td>
                    <div className="code">{r.po_id}</div>
                    <div className="muted" style={{ fontSize: 11 }}>item {r.po_item}</div>
                  </td>
                  <td>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{r.vendor_name || '—'}</div>
                    <div className="muted" style={{ fontSize: 11 }}>{r.vendor_id}</div>
                  </td>
                  <td>
                    <div style={{ fontSize: 12 }}>{r.material_name || '—'}</div>
                    <div className="muted" style={{ fontSize: 11 }}>{r.material_id}</div>
                  </td>
                  <td className="num">{r.ordered_qty != null ? Number(r.ordered_qty).toLocaleString() : '—'} {r.uom}</td>
                  <td className="num">{r.gr_qty != null ? Number(r.gr_qty).toLocaleString() : '—'}</td>
                  <td className="mono small">{r.delivery_date || '—'}</td>
                  <td>
                    <Pill tone={r.qa_status === 'inspection' ? 'amber' : r.qa_status === 'released' ? 'green' : 'grey'} noDot>
                      {r.qa_status === 'inspection' ? 'Inspection' : r.qa_status === 'released' ? 'Released' : 'No lot'}
                    </Pill>
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
                const colour = s.risk === 'red' ? 'var(--sunset)' : s.risk === 'amber' ? 'var(--sunrise)' : 'var(--valentia-slate)';
                return (
                  <button key={s.id} onClick={() => onOpen?.(s)} style={{
                    position: 'absolute', left: left + '%', top: 3, bottom: 3, width: '6%', minWidth: 30,
                    background: colour, color: 'white', border: 'none', borderRadius: 3, fontSize: 9,
                    fontFamily: 'var(--font-mono)', padding: '2px 4px', cursor: 'pointer', overflow: 'hidden', textAlign: 'left',
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

  const id       = receipt.po_id       ?? receipt.id;
  const vendName = receipt.vendor_name ?? receipt.vendor?.name ?? '—';
  const vendId   = receipt.vendor_id   ?? receipt.vendor?.id   ?? '—';
  const matName  = receipt.material_name ?? receipt.material?.name ?? '—';
  const matId    = receipt.material_id   ?? receipt.material?.id   ?? '—';
  const orderedQ = receipt.ordered_qty   ?? receipt.expectedQty ?? 0;
  const receivedQ= receipt.gr_qty        ?? receipt.receivedQty ?? 0;
  const uom      = receipt.uom ?? '';
  const dueDate  = receipt.delivery_date ?? (receipt.eta ? WM.fmtTime(receipt.eta) : '—');
  const qaStatus = receipt.qa_status
    ? (receipt.qa_status === 'inspection' ? 'Inspection' : receipt.qa_status === 'released' ? 'Released' : 'No lot')
    : (receipt.qa ?? '—');
  const docType  = receipt.doc_type ?? receipt.type ?? 'PO';

  return (
    <div className="stack-16">
      <div className="grid-2">
        <div className="scale-card">
          <div className="t-eyebrow">Ordered · Received</div>
          <div style={{ fontFamily: 'var(--font-impact)', fontWeight: 800, fontSize: 28, color: 'var(--forest)', lineHeight: 1, marginTop: 4 }}>
            {Number(receivedQ).toLocaleString()}
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--fg-muted)', fontWeight: 500 }}> / {Number(orderedQ).toLocaleString()} {uom}</span>
          </div>
          <Progress pct={orderedQ > 0 ? receivedQ / orderedQ * 100 : 0} tone={receivedQ < orderedQ ? 'amber' : ''}/>
        </div>
        <div className="scale-card">
          <div className="t-eyebrow">Due Date</div>
          <div style={{ fontFamily: 'var(--font-impact)', fontWeight: 800, fontSize: 28, color: 'var(--forest)', lineHeight: 1, marginTop: 4 }}>{dueDate}</div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{qaStatus}</div>
        </div>
      </div>

      <Card title="Document" eyebrow={docType === 'NB' || docType === 'PO' ? 'EKKO · EKPO' : 'STO · LIKP'} tight>
        <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
          {[
            ['Document',  id],
            ['Type',      docType === 'NB' ? 'Purchase Order' : docType],
            ['Vendor',    vendName],
            ['Vendor ID', vendId],
            ['Material',  matName],
            ['Mat. ID',   matId],
          ].map(([k, val], i) => (
            <div key={i} style={{ padding: '12px 16px', borderBottom: i < 3 ? '1px solid var(--stroke-soft)' : 'none', borderRight: i % 3 !== 2 ? '1px solid var(--stroke-soft)' : 'none' }}>
              <div className="t-eyebrow" style={{ marginBottom: 3 }}>{k}</div>
              <div style={{ fontSize: 13, color: 'var(--forest)', fontWeight: 500 }}>{val}</div>
            </div>
          ))}
        </dl>
      </Card>

      <Card title="Putaway tasks" subtitle="Assigned TOs for this receipt" eyebrow="LTAK / LTAP" tight>
        <table className="tbl">
          <thead><tr><th>TO</th><th>SSCC</th><th>Src</th><th>Dst bin</th><th>Operator</th><th>Status</th></tr></thead>
          <tbody>
            {WM.TOs.slice(0, 3).map((t, i) => (
              <tr key={i}>
                <td className="code">{t.id}</td>
                <td className="mono small">{t.sscc.slice(0, 8)}â€¦{t.sscc.slice(-4)}</td>
                <td className="mono small">915 · Interim</td>
                <td className="mono small">{t.dstBin}</td>
                <td className="small">{t.assignedTo || <span className="muted">unassigned</span>}</td>
                <td><Pill tone={t.status === 'Confirmed' ? 'green' : 'amber'}>{t.status}</Pill></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
};


export { Inbound, DockSchedule, ReceiptDetail };
