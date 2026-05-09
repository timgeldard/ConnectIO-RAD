/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { useI18n } from '@connectio/shared-frontend-i18n'
import { useApi } from '../hooks/useApi'
import { Icon, Pill, Progress } from './Primitives'
import { Card, KPI } from './Shared'

/* Inventory & Bin Health */

const normalizeBin = (b) => {
  const status = b.bin_status === 'free' ? 'Free'
               : b.bin_status === 'blocked' || b.bin_status === 'restricted' ? 'Blocked'
               : 'Occupied';
  return {
    _source: 'api',
    id: b.bin_id,
    status,
    fillPct: (b.fill_pct ?? 0) / 100,
    ageHours: b.age_days != null ? Math.round(b.age_days * 24) : 0,
    batchExpiryDays: b.days_to_expiry ?? 9999,
    storageType: { id: b.lgtyp ?? '—', name: b.lgtyp ?? '—' },
    material: b.material_id
      ? { id: b.material_id, name: b.material_name ?? b.material_id, uom: b.uom ?? '' }
      : null,
    qty: b.total_stock,
  };
};

const normalizeLineside = (l) => {
  const current = l.available != null ? l.available : (l.total_stock ?? 0);
  return {
    _source: 'api',
    line: { id: l.bin_id, name: (l.storage_type ?? '—') + ' · ' + l.bin_id },
    material: { id: l.material_id ?? '—', name: l.material_name ?? l.material_id ?? '—', uom: l.uom ?? '' },
    current,
    min: 0,
    max: Math.max(1, current * 2),
    status: 'In stock',
  };
};

const Inventory = () => {
  const { t } = useI18n();
  const [tab, setTab] = React.useState('overview');
  const [selectedLgtyp, setSelectedLgtyp] = React.useState<string | null>(null);

  // Summary: per-storage-type aggregates for the overview utilisation card.
  // No row-count limit — one row per lgtyp (typically < 100 rows).
  const { data: summaryResp, loading: summaryLoading, error: summaryError } = useApi<any>('/api/inventory/bins/summary');

  // Detail: bin-level rows for heatmap, quants table, and other tabs.
  // When a storage type is selected, restricted to that type (still capped at 2000).
  const detailPath = selectedLgtyp
    ? `/api/inventory/bins?lgtyp=${encodeURIComponent(selectedLgtyp)}`
    : '/api/inventory/bins';
  const { data: detailResp, loading: detailLoading, error: detailError } = useApi<any>(detailPath);

  const { data: linesideResp, loading: linesideLoading, error: linesideError } = useApi<any>('/api/inventory/lineside');
  const { data: nearExpiryResp, loading: nearExpiryLoading, error: nearExpiryError } = useApi<any>('/api/inventory/near-expiry');

  // Summary rows normalised for the storage-util card
  const summaryTypes = React.useMemo(() => {
    const rows: any[] = summaryResp?.types ?? [];
    return rows.map((r) => ({
      lgtyp: r.lgtyp ?? '—',
      total: Number(r.total_bins ?? 0),
      occupied: Number(r.occupied_bins ?? 0),
      free: Number(r.free_bins ?? 0),
      blocked: Number(r.blocked_bins ?? 0),
      pct: Number(r.total_bins ?? 0) > 0 ? (Number(r.occupied_bins ?? 0) / Number(r.total_bins)) * 100 : 0,
    }));
  }, [summaryResp]);

  // Totals derived from summary (accurate across all bins, no 2000-row truncation)
  const summaryTotals = React.useMemo(() => ({
    total: summaryTypes.reduce((s, r) => s + r.total, 0),
    occupied: summaryTypes.reduce((s, r) => s + r.occupied, 0),
    blocked: summaryTypes.reduce((s, r) => s + r.blocked, 0),
  }), [summaryTypes]);

  const detailBins = React.useMemo(() => {
    const api: any[] = detailResp?.bins ?? [];
    return api.map(normalizeBin);
  }, [detailResp]);

  const allLineside = React.useMemo(() => {
    const api: any[] = linesideResp?.lineside ?? [];
    return api.map(normalizeLineside);
  }, [linesideResp]);

  const nearExpiryBatches = React.useMemo(() => {
    const rows: any[] = nearExpiryResp?.batches ?? [];
    return rows;
  }, [nearExpiryResp]);

  const aged = detailBins.filter((b: any) => b.ageHours > 168 && b.status === 'Occupied').slice(0, 12);
  const expiring = nearExpiryBatches.slice(0, 30);
  const blocked = detailBins.filter((b: any) => b.status === 'Blocked').slice(0, 8);

  const binUtilPct = summaryTotals.total > 0
    ? Math.round(summaryTotals.occupied / summaryTotals.total * 100)
    : 0;

  const handleTypeClick = (lgtyp: string) => {
    setSelectedLgtyp((prev) => (prev === lgtyp ? null : lgtyp));
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Inventory · Bin health</div>
          <h1 className="page-title">{t('warehouse.title.inventory')}</h1>
          <div className="page-desc">Bin occupancy, line-side stock, batch expiry, quality holds and cycle count priorities.</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary"><Icon name="download" size={14}/> {t('warehouse.inventory.btn.stockSnapshot')}</button>
          <button className="btn btn-primary"><Icon name="eye" size={14}/> {t('warehouse.inventory.btn.cycleCountPlan')}</button>
        </div>
      </div>

      <div className="kpi-grid">
        <KPI label={t('warehouse.inventory.kpi.binUtil')} value={summaryLoading ? '...' : binUtilPct} unit="%" target="80%" tone="ok" barPct={binUtilPct}/>
        <KPI label={t('warehouse.inventory.kpi.inventoryAccuracy')} value="—" unit="%" target="99.5%" tone="ok"/>
        <KPI label={t('warehouse.inventory.kpi.blockedQA')} value={summaryLoading ? '...' : summaryTotals.blocked} tone="warn"/>
        <KPI label={t('warehouse.inventory.kpi.expiring')} value={nearExpiryLoading ? '...' : nearExpiryBatches.length} tone="critical"/>
        <KPI label={t('warehouse.inventory.kpi.aged')} value={aged.length} tone="warn"/>
        <KPI label={t('warehouse.inventory.kpi.linesideBelowMin')} value={allLineside.filter((l: any) => l.status === 'Below min').length} tone="critical"/>
      </div>

      <div className="tabs">
        {[
          { id: 'overview', label: t('warehouse.inventory.tab.overview') },
          { id: 'lineside', label: t('warehouse.inventory.tab.lineside') },
          { id: 'aged',     label: t('warehouse.inventory.tab.aged') },
          { id: 'blocked',  label: t('warehouse.inventory.tab.blocked') },
          { id: 'cycle',    label: t('warehouse.inventory.tab.cycle') },
        ].map((tabDef: any) => (
          <button key={tabDef.id} className={`tab ${tab === tabDef.id ? 'is-active' : ''}`} onClick={() => setTab(tabDef.id)}>{tabDef.label}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <div className="grid-2" style={{ marginBottom: 16 }}>
            <Card title={t('warehouse.inventory.card.storageUtil')} subtitle="Click a type to drill into its bins" eyebrow="LAGP">
              <div className="stack-8">
                {summaryTypes.map((typeRow: any) => {
                  const isSelected = selectedLgtyp === typeRow.lgtyp;
                  return (
                    <div
                      key={typeRow.lgtyp}
                      onClick={() => handleTypeClick(typeRow.lgtyp)}
                      style={{
                        cursor: 'pointer',
                        borderRadius: 4,
                        padding: '4px 6px',
                        margin: '-4px -6px',
                        background: isSelected ? 'var(--stone)' : 'transparent',
                        outline: isSelected ? '1px solid var(--border-strong)' : 'none',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--forest)' }}>
                          {typeRow.lgtyp}
                          {isSelected && <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--fg-muted)', marginLeft: 6 }}>· viewing</span>}
                        </span>
                        <span className="mono small muted">{typeRow.occupied.toLocaleString()}/{typeRow.total.toLocaleString()} · {Math.round(typeRow.pct)}%</span>
                      </div>
                      <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--stone)' }}>
                        <div style={{ width: (typeRow.occupied / typeRow.total * 100) + '%', background: typeRow.pct > 92 ? 'var(--sunset)' : typeRow.pct > 80 ? 'var(--sunrise)' : 'var(--valentia-slate)' }}/>
                        <div style={{ width: (typeRow.blocked / typeRow.total * 100) + '%', background: 'var(--forest)' }}/>
                      </div>
                    </div>
                  );
                })}
                {!summaryLoading && summaryTypes.length === 0 && <div className="muted small">No live bin stock is available for this plant.</div>}
                {summaryError && <div className="red small">Unable to load live bin stock: {summaryError}</div>}
              </div>
            </Card>
            <Card
              title={t('warehouse.inventory.card.binHeatmap')}
              subtitle={selectedLgtyp ? `Type ${selectedLgtyp} · first 200 bins` : 'Select a storage type to view its bins'}
              eyebrow="Bin map"
            >
              {selectedLgtyp ? (
                detailLoading
                  ? <div className="muted small">Loading bins for type {selectedLgtyp}…</div>
                  : <BinHeatmap bins={detailBins.slice(0, 200)}/>
              ) : (
                <div className="muted small" style={{ padding: '24px 0', textAlign: 'center' }}>
                  Click a storage type on the left to view its bin map.
                </div>
              )}
            </Card>
          </div>

          <Card
            title={t('warehouse.inventory.card.quants')}
            subtitle={selectedLgtyp ? `Type ${selectedLgtyp} · material · bin · qty · age` : 'Material · bin · batch · qty · age'}
            eyebrow="LQUA"
            tight
          >
            <div className="scroll-x">
              <table className="tbl">
                <thead><tr><th>{t('warehouse.common.col.material')}</th><th>{t('warehouse.common.col.bin')}</th><th className="num">{t('warehouse.common.col.qty')}</th><th className="num">{t('warehouse.common.col.age')}</th><th>{t('warehouse.inventory.col.expiry')}</th><th>{t('warehouse.common.col.status')}</th></tr></thead>
                <tbody>
                  {detailBins.filter((b: any) => b.material).slice(0, 20).map((b: any, i: number) => (
                    <tr key={i}>
                      <td><div style={{ fontSize: 12 }}>{b.material.name}</div><div className="muted" style={{ fontSize: 11 }}>{b.material.id}</div></td>
                      <td className="mono small">{b.id}</td>
                      <td className="num">{b.qty != null ? Math.round(b.qty) : Math.round(b.fillPct * 8)} {b.material.uom}</td>
                      <td className="num">{b.ageHours}h</td>
                      <td><span className={b.batchExpiryDays < 30 ? 'red bold' : ''}>{b.batchExpiryDays < 9999 ? `${b.batchExpiryDays}d` : '—'}</span></td>
                      <td><Pill tone={b.status === 'Occupied' ? 'sage' : b.status === 'Blocked' ? 'red' : 'grey'}>{b.status}</Pill></td>
                    </tr>
                  ))}
                  {!detailLoading && detailBins.filter((b: any) => b.material).length === 0 && (
                    <tr><td colSpan={6} className="muted small">{selectedLgtyp ? `No stock in type ${selectedLgtyp}.` : 'No live quant rows available for this plant.'}</td></tr>
                  )}
                  {detailError && (
                    <tr><td colSpan={6} className="red small">Unable to load live quant rows: {detailError}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {tab === 'lineside' && (
        <Card title={t('warehouse.inventory.card.lineside')} subtitle="Storage type 005 · min/max · replenishment signal" eyebrow="Line side" tight>
          <table className="tbl">
            <thead><tr><th>{t('warehouse.common.col.line')}</th><th>{t('warehouse.common.col.material')}</th><th className="num">{t('warehouse.inventory.col.current')}</th><th className="num">{t('warehouse.inventory.col.min')}</th><th className="num">{t('warehouse.inventory.col.max')}</th><th>{t('warehouse.inventory.col.level')}</th><th>{t('warehouse.common.col.status')}</th><th>Action</th></tr></thead>
            <tbody>
              {allLineside.map((l: any, i: number) => {
                const pct = Math.min(100, (l.current / l.max) * 100);
                const belowMin = l.current < l.min;
                return (
                  <tr key={i} className={belowMin ? 'is-risk-red' : ''}>
                    <td><div style={{ fontWeight: 600, fontSize: 12 }}>{l.line.id}</div><div className="muted" style={{ fontSize: 11 }}>{l.line.name}</div></td>
                    <td><div style={{ fontSize: 12 }}>{l.material.name}</div><div className="muted" style={{ fontSize: 11 }}>{l.material.id}</div></td>
                    <td className="num">{l.current} {l.material.uom}</td>
                    <td className="num muted">{l.min}</td>
                    <td className="num muted">{l.max}</td>
                    <td style={{ width: 140 }}><Progress pct={pct} tone={belowMin ? 'red' : pct < 40 ? 'amber' : ''}/></td>
                    <td><Pill tone={l.status === 'Below min' ? 'red' : l.status === 'Near min' ? 'amber' : 'green'}>{l.status}</Pill></td>
                    <td>{belowMin && <button className="btn btn-xs btn-primary">Replenish</button>}</td>
                  </tr>
                );
              })}
              {!linesideLoading && allLineside.length === 0 && (
                <tr><td colSpan={8} className="muted small">No live line-side stock is available for this plant.</td></tr>
              )}
              {linesideError && (
                <tr><td colSpan={8} className="red small">Unable to load live line-side stock: {linesideError}</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      {tab === 'aged' && (
        <div className="grid-2">
          <Card title={t('warehouse.inventory.card.aged')} subtitle="> 7 days in bin · consider FEFO rotation" eyebrow="Age" tight>
            <table className="tbl">
              <thead><tr><th>{t('warehouse.common.col.bin')}</th><th>{t('warehouse.common.col.material')}</th><th className="num">{t('warehouse.common.col.age')}</th><th className="num">{t('warehouse.common.col.qty')}</th></tr></thead>
              <tbody>
                {aged.map((b: any, i: number) => (
                  <tr key={i}><td className="mono small">{b.id}</td><td style={{ fontSize: 12 }}>{b.material?.name || '—'}</td><td className="num amber bold">{b.ageHours}h</td><td className="num">{b.qty != null ? Math.round(b.qty) : Math.round(b.fillPct * 6)}</td></tr>
                ))}
                {!detailLoading && aged.length === 0 && <tr><td colSpan={4} className="muted small">No aged live stock is available for this plant.</td></tr>}
              </tbody>
            </table>
          </Card>
          <Card title={t('warehouse.inventory.card.expiry')} subtitle="≤ 90 days to expiry · prioritise consumption · ordered by soonest" eyebrow="MCHA" tight>
            <div className="scroll-x">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>{t('warehouse.common.col.material')}</th>
                    <th>{t('warehouse.common.col.batch')}</th>
                    <th>Mfg Date</th>
                    <th>Expiry Date</th>
                    <th className="num">Days Left</th>
                    <th className="num">Stock</th>
                    <th className="num">Days Aged</th>
                  </tr>
                </thead>
                <tbody>
                  {expiring.map((b: any, i: number) => (
                    <tr key={i}>
                      <td>
                        <div style={{ fontSize: 12 }}>{b.material_name}</div>
                        <div className="muted" style={{ fontSize: 11 }}>{b.material_id}</div>
                      </td>
                      <td className="mono small">{b.batch_id}</td>
                      <td className="small">{b.manufacture_date ?? '—'}</td>
                      <td className="small">{b.expiry_date ?? '—'}</td>
                      <td className={`num bold ${Number(b.days_to_expiry) < 14 ? 'red' : Number(b.days_to_expiry) < 30 ? 'amber' : ''}`}>
                        {b.days_to_expiry != null ? `${b.days_to_expiry}d` : '—'}
                      </td>
                      <td className="num">{b.total_stock != null ? Math.round(Number(b.total_stock)) : '—'} {b.uom ?? ''}</td>
                      <td className={`num ${Number(b.aged_days) > 90 ? 'amber' : ''}`}>
                        {b.aged_days != null ? `${b.aged_days}d` : '—'}
                      </td>
                    </tr>
                  ))}
                  {!nearExpiryLoading && expiring.length === 0 && (
                    <tr><td colSpan={7} className="muted small">No batches expiring within 90 days for this plant.</td></tr>
                  )}
                  {nearExpiryError && (
                    <tr><td colSpan={7} className="red small">Unable to load near-expiry batches: {nearExpiryError}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {tab === 'blocked' && (
        <Card title={t('warehouse.inventory.card.blocked')} subtitle="Bins under inspection or on hold" eyebrow="ST 010" tight>
          <table className="tbl">
            <thead><tr><th>{t('warehouse.common.col.bin')}</th><th>{t('warehouse.common.col.material')}</th><th className="num">{t('warehouse.common.col.qty')}</th><th>{t('warehouse.common.col.status')}</th></tr></thead>
            <tbody>
              {blocked.map((b: any, i: number) => (
                <tr key={i}>
                  <td className="mono small">{b.id}</td>
                  <td style={{ fontSize: 12 }}>{b.material?.name || '—'}</td>
                  <td className="num">{b.qty != null ? Math.round(b.qty) : '—'}</td>
                  <td><Pill tone="red">Blocked</Pill></td>
                </tr>
              ))}
              {!detailLoading && blocked.length === 0 && <tr><td colSpan={4} className="muted small">No blocked live bins are available for this plant.</td></tr>}
            </tbody>
          </table>
        </Card>
      )}

      {tab === 'cycle' && (
        <Card title={t('warehouse.inventory.card.cycleCount')} subtitle="Fast movers, recent discrepancies, bins not counted in 30+ days" eyebrow="ABC" tight>
          <table className="tbl">
            <thead><tr><th>{t('warehouse.inventory.col.prio')}</th><th>{t('warehouse.common.col.bin')}</th><th>{t('warehouse.common.col.material')}</th><th className="num">{t('warehouse.inventory.col.lastCount')}</th><th className="num">{t('warehouse.inventory.col.delta')}</th><th>{t('warehouse.inventory.col.assign')}</th></tr></thead>
            <tbody>
              {detailBins.slice(0, 16).map((b: any, i: number) => (
                <tr key={i}>
                  <td><Pill tone={i < 4 ? 'red' : i < 10 ? 'amber' : 'grey'}>{i < 4 ? 'P1' : i < 10 ? 'P2' : 'P3'}</Pill></td>
                  <td className="mono small">{b.id}</td>
                  <td style={{ fontSize: 12 }}>{b.material?.name || '—'}</td>
                  <td className="num">{[4, 12, 18, 32, 45, 52, 67, 80, 95, 110, 132, 156][i % 12]}d</td>
                  <td className="num">{i % 3 === 0 ? <span className="red">±{i * 2} kg</span> : <span className="muted">—</span>}</td>
                  <td><button className="btn btn-xs btn-secondary">{t('warehouse.inventory.col.assign')}</button></td>
                </tr>
              ))}
              {!detailLoading && detailBins.length === 0 && <tr><td colSpan={6} className="muted small">No live bins are available for cycle-count prioritisation.</td></tr>}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
};

const BinHeatmap = ({ bins }) => {
  return (
    <div className="heatgrid" style={{ gridTemplateColumns: 'repeat(20, 1fr)' }}>
      {bins.map((b: any, i: number) => {
        let cls = 'heatcell ';
        if (b.status === 'Free') cls += 'empty';
        else if (b.status === 'Blocked') cls += 'warn';
        else if (b.fillPct > 0.9) cls += 'h5';
        else if (b.fillPct > 0.7) cls += 'h4';
        else if (b.fillPct > 0.5) cls += 'h3';
        else if (b.fillPct > 0.2) cls += 'h2';
        else cls += 'h1';
        return <div key={i} className={cls} title={`${b.id} · ${Math.round(b.fillPct * 100)}%`}/>;
      })}
    </div>
  );
};


export { Inventory, BinHeatmap };
