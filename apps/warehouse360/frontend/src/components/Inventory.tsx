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

  const { data: binsResp, loading: binsLoading, error: binsError } = useApi<any>('/api/inventory/bins');
  const { data: linesideResp, loading: linesideLoading, error: linesideError } = useApi<any>('/api/inventory/lineside');

  const allBins = React.useMemo(() => {
    const api = binsResp?.bins ?? [];
    return api.map(normalizeBin);
  }, [binsResp]);

  const allLineside = React.useMemo(() => {
    const api = linesideResp?.lineside ?? [];
    return api.map(normalizeLineside);
  }, [linesideResp]);

  const byType = React.useMemo(() => {
    const typeMap: Record<string, { type: any; bins: any[] }> = {};
    for (const b of allBins) {
      const key = b.storageType.id;
      if (!typeMap[key]) typeMap[key] = { type: b.storageType, bins: [] };
      typeMap[key].bins.push(b);
    }
    return Object.values(typeMap).map(({ type, bins }) => {
      const occ = bins.filter((b: any) => b.status === 'Occupied').length;
      const free = bins.filter((b: any) => b.status === 'Free').length;
      const blocked = bins.filter((b: any) => b.status === 'Blocked').length;
      return { type, bins, occ, free, blocked, pct: bins.length > 0 ? (occ / bins.length) * 100 : 0 };
    }).sort((a: any, b: any) => a.type.id < b.type.id ? -1 : 1);
  }, [allBins]);

  const aged = allBins.filter((b: any) => b.ageHours > 168 && b.status === 'Occupied').slice(0, 12);
  const expiring = allBins.filter((b: any) => b.batchExpiryDays < 30 && b.status === 'Occupied').slice(0, 10);
  const blocked = allBins.filter((b: any) => b.status === 'Blocked').slice(0, 8);

  const binUtilPct = allBins.length > 0
    ? Math.round(allBins.filter((b: any) => b.status === 'Occupied').length / allBins.length * 100)
    : 0;

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
        <KPI label={t('warehouse.inventory.kpi.binUtil')} value={binsLoading ? '...' : binUtilPct} unit="%" target="80%" tone="ok" barPct={binUtilPct}/>
        <KPI label={t('warehouse.inventory.kpi.inventoryAccuracy')} value="—" unit="%" target="99.5%" tone="ok"/>
        <KPI label={t('warehouse.inventory.kpi.blockedQA')} value={allBins.filter((b: any) => b.status === 'Blocked').length} tone="warn"/>
        <KPI label={t('warehouse.inventory.kpi.expiring')} value={expiring.length} tone="critical"/>
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
            <Card title={t('warehouse.inventory.card.storageUtil')} subtitle="Occupied · free · blocked bins" eyebrow="LAGP">
              <div className="stack-8">
                {byType.map((typeRow: any) => (
                  <div key={typeRow.type.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--forest)' }}>{typeRow.type.id} · {typeRow.type.name}</span>
                      <span className="mono small muted">{typeRow.occ}/{typeRow.bins.length} · {Math.round(typeRow.pct)}%</span>
                    </div>
                    <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--stone)' }}>
                      <div style={{ width: (typeRow.occ / typeRow.bins.length * 100) + '%', background: typeRow.pct > 92 ? 'var(--sunset)' : typeRow.pct > 80 ? 'var(--sunrise)' : 'var(--valentia-slate)' }}/>
                      <div style={{ width: (typeRow.blocked / typeRow.bins.length * 100) + '%', background: 'var(--forest)' }}/>
                    </div>
                  </div>
                ))}
                {!binsLoading && byType.length === 0 && <div className="muted small">No live bin stock is available for this plant.</div>}
                {binsError && <div className="red small">Unable to load live bin stock: {binsError}</div>}
              </div>
            </Card>
            <Card title={t('warehouse.inventory.card.binHeatmap')} subtitle="Hover a cell for material & age" eyebrow="Bin map">
              <BinHeatmap bins={allBins.filter((b: any) => b.storageType.id === '001').slice(0, 200)}/>
            </Card>
          </div>

          <Card title={t('warehouse.inventory.card.quants')} subtitle="Material · bin · batch · qty · age" eyebrow="LQUA" tight>
            <div className="scroll-x">
              <table className="tbl">
                <thead><tr><th>{t('warehouse.common.col.material')}</th><th>{t('warehouse.common.col.bin')}</th><th>{t('warehouse.common.col.batch')}</th><th className="num">{t('warehouse.common.col.qty')}</th><th className="num">{t('warehouse.common.col.age')}</th><th>{t('warehouse.inventory.col.expiry')}</th><th>{t('warehouse.common.col.status')}</th></tr></thead>
                <tbody>
                  {allBins.filter((b: any) => b.material).slice(0, 20).map((b: any, i: number) => (
                    <tr key={i}>
                      <td><div style={{ fontSize: 12 }}>{b.material.name}</div><div className="muted" style={{ fontSize: 11 }}>{b.material.id}</div></td>
                      <td className="mono small">{b.id}</td>
                      <td className="mono small">B{String(300000 + i * 13).slice(0, 7)}</td>
                      <td className="num">{b.qty != null ? Math.round(b.qty) : Math.round(b.fillPct * 8)} {b.material.uom}</td>
                      <td className="num">{b.ageHours}h</td>
                      <td><span className={b.batchExpiryDays < 30 ? 'red bold' : ''}>{b.batchExpiryDays}d</span></td>
                      <td><Pill tone={b.status === 'Occupied' ? 'sage' : b.status === 'Blocked' ? 'red' : 'grey'}>{b.status}</Pill></td>
                    </tr>
                  ))}
                  {!binsLoading && allBins.filter((b: any) => b.material).length === 0 && (
                    <tr><td colSpan={7} className="muted small">No live quant rows available for this plant.</td></tr>
                  )}
                  {binsError && (
                    <tr><td colSpan={7} className="red small">Unable to load live quant rows: {binsError}</td></tr>
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
                {!binsLoading && aged.length === 0 && <tr><td colSpan={4} className="muted small">No aged live stock is available for this plant.</td></tr>}
              </tbody>
            </table>
          </Card>
          <Card title={t('warehouse.inventory.card.expiry')} subtitle="< 30 days · prioritise consumption" eyebrow="MCHA" tight>
            <table className="tbl">
              <thead><tr><th>{t('warehouse.common.col.bin')}</th><th>{t('warehouse.common.col.material')}</th><th>{t('warehouse.common.col.batch')}</th><th className="num">Days</th></tr></thead>
              <tbody>
                {expiring.map((b: any, i: number) => (
                  <tr key={i}><td className="mono small">{b.id}</td><td style={{ fontSize: 12 }}>{b.material?.name}</td><td className="mono small">B{String(400000 + i).slice(0, 7)}</td><td className="num red bold">{b.batchExpiryDays}d</td></tr>
                ))}
                {!binsLoading && expiring.length === 0 && <tr><td colSpan={4} className="muted small">No expiring live stock is available for this plant.</td></tr>}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {tab === 'blocked' && (
        <Card title={t('warehouse.inventory.card.blocked')} subtitle="Bins under inspection or on hold" eyebrow="ST 010" tight>
          <table className="tbl">
            <thead><tr><th>{t('warehouse.common.col.bin')}</th><th>{t('warehouse.common.col.material')}</th><th>{t('warehouse.common.col.batch')}</th><th className="num">{t('warehouse.common.col.qty')}</th><th>{t('warehouse.inventory.col.holdReason')}</th><th>{t('warehouse.inventory.col.owner')}</th></tr></thead>
            <tbody>
              {blocked.map((b: any, i: number) => (
                <tr key={i}>
                  <td className="mono small">{b.id}</td>
                  <td style={{ fontSize: 12 }}>{b.material?.name || '—'}</td>
                  <td className="mono small">B{String(500000 + i).slice(0, 7)}</td>
                  <td className="num">{b.qty != null ? Math.round(b.qty) : Math.round(b.fillPct * 5)}</td>
                  <td>{['QA sampling', 'Customer hold', 'Rework', 'Supplier claim', 'Allergen test', 'Pending release', 'Foreign body check', 'Re-analysis'][i % 8]}</td>
                  <td><div className="flex items-center gap-6"><span className="avatar sm slate">QA</span><span className="small">Quality Lab</span></div></td>
                </tr>
              ))}
              {!binsLoading && blocked.length === 0 && <tr><td colSpan={6} className="muted small">No blocked live bins are available for this plant.</td></tr>}
            </tbody>
          </table>
        </Card>
      )}

      {tab === 'cycle' && (
        <Card title={t('warehouse.inventory.card.cycleCount')} subtitle="Fast movers, recent discrepancies, bins not counted in 30+ days" eyebrow="ABC" tight>
          <table className="tbl">
            <thead><tr><th>{t('warehouse.inventory.col.prio')}</th><th>{t('warehouse.common.col.bin')}</th><th>{t('warehouse.common.col.material')}</th><th className="num">{t('warehouse.inventory.col.lastCount')}</th><th className="num">{t('warehouse.inventory.col.delta')}</th><th>{t('warehouse.inventory.col.assign')}</th></tr></thead>
            <tbody>
              {allBins.slice(0, 16).map((b: any, i: number) => (
                <tr key={i}>
                  <td><Pill tone={i < 4 ? 'red' : i < 10 ? 'amber' : 'grey'}>{i < 4 ? 'P1' : i < 10 ? 'P2' : 'P3'}</Pill></td>
                  <td className="mono small">{b.id}</td>
                  <td style={{ fontSize: 12 }}>{b.material?.name || '—'}</td>
                  <td className="num">{[4, 12, 18, 32, 45, 52, 67, 80, 95, 110, 132, 156][i % 12]}d</td>
                  <td className="num">{i % 3 === 0 ? <span className="red">±{i * 2} kg</span> : <span className="muted">—</span>}</td>
                  <td><button className="btn btn-xs btn-secondary">{t('warehouse.inventory.col.assign')}</button></td>
                </tr>
              ))}
              {!binsLoading && allBins.length === 0 && <tr><td colSpan={6} className="muted small">No live bins are available for cycle-count prioritisation.</td></tr>}
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
        return <div key={i} className={cls} title={`${b.id} · ${Math.round(b.fillPct)}%`}/>;
      })}
    </div>
  );
};


export { Inventory, BinHeatmap };
