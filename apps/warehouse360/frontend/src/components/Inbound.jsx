import React from 'react';
import { useI18n } from '@connectio/shared-frontend-i18n';
import WM from '../data/mockData.js';
import { useApi } from '../hooks/useApi.js';
import { Icon, Pill, Progress, RiskDot } from './Primitives.jsx';
import { FilterBar, Card, KPI } from './Shared.jsx';

/* Inbound — PO + STO receipts, dock schedule, putaway backlog */

const Inbound = ({ onOpen }) => {
  const { t } = useI18n();
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
          <h1 className="page-title">{t('warehouse.title.inbound')}</h1>
          <div className="page-desc">Receipts against Purchase Orders and Stock Transport Orders. Red flags where materials are needed for today's production.</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary"><Icon name="download" size={14}/> {t('warehouse.inbound.btn.receiptLog')}</button>
          <button className="btn btn-primary"><Icon name="truckIn" size={14}/> {t('warehouse.inbound.btn.bookDock')}</button>
        </div>
      </div>

      <div className="kpi-grid">
        <KPI label={t('warehouse.inbound.kpi.openPOLines')} value={v(counts.all)} tone="ok"/>
        <KPI label={t('warehouse.inbound.kpi.qaInspection')} value={v(counts.qa)} tone={counts.qa > 0 ? 'warn' : 'ok'}/>
        <KPI label={t('warehouse.inbound.kpi.putawayCycle')} value="—" unit=" min" tone="ok"/>
        <KPI label={t('warehouse.inbound.kpi.receiptsToday')} value="—" tone="ok"/>
        <KPI label={t('warehouse.inbound.kpi.overdue')} value="—" tone="ok"/>
        <KPI label={t('warehouse.inbound.kpi.neededToday')} value="—" tone="ok"/>
      </div>

      <div className="grid-2" style={{ marginBottom: 16 }}>
        <Card title={t('warehouse.inbound.card.dockSchedule')} subtitle="Inbound bays · next 10 hours" eyebrow="Docks">
          <DockSchedule type="Inbound" events={allReceipts} onOpen={onOpen}/>
        </Card>
        <Card title={t('warehouse.inbound.card.putawayBacklog')} subtitle="Pallets on interim storage 915 waiting to be put away" eyebrow="Backlog">
          <div className="stack-8">
            <div className="muted small">No live putaway backlog endpoint is available yet.</div>
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--fg-muted)' }}>
            Add an LTAP/LTAK putaway endpoint before showing cycle-time commitments here.
          </div>
        </Card>
      </div>

      <div className="tabs">
        {[
          { id: 'all', label: t('warehouse.inbound.tab.all') },
          { id: 'qa',  label: t('warehouse.inbound.tab.qa') },
        ].map((tabDef) => (
          <button key={tabDef.id} className={`tab ${tab === tabDef.id ? 'is-active' : ''}`} onClick={() => setTab(tabDef.id)}>
            {tabDef.label}<span className="tab-count">{counts[tabDef.id] ?? ''}</span>
          </button>
        ))}
      </div>

      <FilterBar
        filters={[
          { key: 'risk', label: t('warehouse.common.filter.risk'), chips: [
            { value: 'all',   label: t('warehouse.common.all') },
            { value: 'red',   label: t('warehouse.common.risk.critical'), dot: 'red' },
            { value: 'amber', label: t('warehouse.common.risk.atRisk'),  dot: 'amber' },
            { value: 'green', label: t('warehouse.common.risk.onTrack') },
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
                <th>{t('warehouse.inbound.col.doc')}</th>
                <th>{t('warehouse.inbound.col.vendor')}</th>
                <th>{t('warehouse.common.col.material')}</th>
                <th className="num">{t('warehouse.inbound.col.ordered')}</th>
                <th className="num">{t('warehouse.inbound.col.received')}</th>
                <th>{t('warehouse.inbound.col.dueDate')}</th>
                <th>{t('warehouse.inbound.col.qa')}</th>
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
                      {r.qa_status === 'inspection' ? t('warehouse.inbound.qa.inspection') : r.qa_status === 'released' ? t('warehouse.inbound.qa.released') : t('warehouse.inbound.qa.noLot')}
                    </Pill>
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr><td colSpan={7} className="muted small">No live inbound receipts match this plant and filter set.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

const DockSchedule = ({ type, events = [], onOpen }) => {
  const liveEvents = events.filter((event) => event.dock_id || event.dock?.id);
  const docks = Array.from(new Set(liveEvents.map((event) => event.dock_id ?? event.dock?.id))).map((id) => ({ id }));
  const startH = 6;
  const hours = 14;
  const now = new Date();
  const dayStart = (() => { const d = new Date(now); d.setHours(startH, 0, 0, 0); return d; })();
  const xAt = (d) => ((d - dayStart) / (hours * 3600000)) * 100;
  const nowX = xAt(now);
  if (docks.length === 0) {
    return <div className="muted small">No live dock allocation data is available for {type.toLowerCase()} movements.</div>;
  }
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
        const slots = liveEvents.filter((e) => (e.dock_id ?? e.dock?.id) === dock.id);
        return (
          <div key={dock.id} style={{ display: 'grid', gridTemplateColumns: '60px 1fr', alignItems: 'center', marginBottom: 4 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--forest)', fontWeight: 600 }}>{dock.id}</div>
            <div style={{ position: 'relative', height: 28, background: 'var(--stone)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ position: 'absolute', left: nowX + '%', top: 0, bottom: 0, width: 2, background: 'var(--sunset)', zIndex: 2 }}/>
              {slots.slice(0, 4).map((s) => {
                const slotTime = new Date(type === 'Inbound' ? s.delivery_date : s.planned_gi_date);
                if (Number.isNaN(slotTime.getTime())) return null;
                const left = Math.max(0, Math.min(100, xAt(slotTime)));
                const colour = s.risk === 'red' ? 'var(--sunset)' : s.risk === 'amber' ? 'var(--sunrise)' : 'var(--valentia-slate)';
                return (
                  <button key={s.po_id ?? s.delivery_id ?? s.id} onClick={() => onOpen?.(s)} style={{
                    position: 'absolute', left: left + '%', top: 3, bottom: 3, width: '6%', minWidth: 30,
                    background: colour, color: 'white', border: 'none', borderRadius: 3, fontSize: 9,
                    fontFamily: 'var(--font-mono)', padding: '2px 4px', cursor: 'pointer', overflow: 'hidden', textAlign: 'left',
                  }} title={s.po_id ?? s.delivery_id ?? s.id}>
                    {String(s.po_id ?? s.delivery_id ?? s.id).slice(-4)}
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
            <tr><td colSpan={6} className="muted small">No live putaway transfer-order detail endpoint is available yet.</td></tr>
          </tbody>
        </table>
      </Card>
    </div>
  );
};


export { Inbound, DockSchedule, ReceiptDetail };
