/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { useI18n } from '@connectio/shared-frontend-i18n'
import { useApi } from '../hooks/useApi'
import { Icon, Pill, Progress } from './Primitives'
import { Card, KPI } from './Shared'
import { DataTable, type Column } from '@connectio/shared-ui'

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
  const [quantsSortKey, setQuantsSortKey] = React.useState('qty');
  const [quantsSortDir, setQuantsSortDir] = React.useState<'asc' | 'desc'>('desc');
  const [quantsFilter, setQuantsFilter] = React.useState('');

  // Summary: per-storage-type aggregates for the overview utilisation card.
  const { data: summaryResp, loading: summaryLoading, error: summaryError } = useApi<any>('/api/inventory/bins/summary');

  // All bins (unfiltered by lgtyp) for the quants table
  const { data: allBinsResp } = useApi<any>('/api/inventory/bins');

  // Detail: bin-level rows for heatmap, quants table, and other tabs.
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

  // Totals derived from summary
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

  const allWmBins = React.useMemo(() => {
    const api: any[] = allBinsResp?.bins ?? [];
    return api.map(normalizeBin);
  }, [allBinsResp]);

  // Quants: all WM bins with material, sorted/filtered, top-20 by volume.
  const sortedQuants = React.useMemo(() => {
    const filterLc = quantsFilter.toLowerCase();
    const filtered = allWmBins.filter((b: any) => {
      if (!b.material) return false;
      if (!filterLc) return true;
      return (
        b.material.name.toLowerCase().includes(filterLc) ||
        b.material.id.toLowerCase().includes(filterLc)
      );
    });
    return [...filtered].sort((a: any, b: any) => {
      let av: any;
      let bv: any;
      if (quantsSortKey === 'materialName') { av = a.material?.name ?? ''; bv = b.material?.name ?? ''; }
      else if (quantsSortKey === 'binId') { av = a.id ?? ''; bv = b.id ?? ''; }
      else if (quantsSortKey === 'qty') { av = Number(a.qty ?? 0); bv = Number(b.qty ?? 0); }
      else if (quantsSortKey === 'ageHours') { av = a.ageHours ?? 0; bv = b.ageHours ?? 0; }
      else if (quantsSortKey === 'batchExpiryDays') { av = a.batchExpiryDays ?? 9999; bv = b.batchExpiryDays ?? 9999; }
      else if (quantsSortKey === 'status') { av = a.status ?? ''; bv = b.status ?? ''; }
      else { av = ''; bv = ''; }
      const an = Number(av); const bn = Number(bv);
      const cmp = Number.isFinite(an) && Number.isFinite(bn)
        ? an - bn
        : String(av).localeCompare(String(bv));
      return quantsSortDir === 'asc' ? cmp : -cmp;
    });
  }, [allWmBins, quantsSortKey, quantsSortDir, quantsFilter]);

  const downloadStockSnapshot = () => {
    const rows = allWmBins;
    if (rows.length === 0) return;
    const headers = ['Bin', 'Storage Type', 'Material ID', 'Material Name', 'Qty', 'UOM', 'Status', 'Age (days)', 'Days to Expiry'];
    const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csvLines = [
      headers.map(escape).join(','),
      ...rows.map((b: any) => [
        b.id,
        b.storageType?.id ?? '',
        b.material?.id ?? '',
        b.material?.name ?? '',
        b.qty != null ? Math.round(Number(b.qty)) : '',
        b.material?.uom ?? '',
        b.status,
        b.ageHours != null ? (b.ageHours / 24).toFixed(1) : '',
        b.batchExpiryDays < 9999 ? b.batchExpiryDays : '',
      ].map(escape).join(',')),
    ];
    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stock-snapshot-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const aged = detailBins.filter((b: any) => b.ageHours > 168 && b.status === 'Occupied').slice(0, 12);
  const expiring = nearExpiryBatches.slice(0, 30);
  const blocked = detailBins.filter((b: any) => b.status === 'Blocked').slice(0, 8);

  const binUtilPct = summaryTotals.total > 0
    ? Math.round(summaryTotals.occupied / summaryTotals.total * 100)
    : 0;

  const handleTypeClick = (lgtyp: string) => {
    setSelectedLgtyp((prev) => (prev === lgtyp ? null : lgtyp));
  };

  const quantsColumns: Column<any>[] = [
    {
      header: t('warehouse.common.col.material'),
      render: (b) => (
        <>
          <div style={{ fontSize: 12 }}>{b.material.name}</div>
          <div className="muted" style={{ fontSize: 11 }}>{b.material.id}</div>
        </>
      ),
      sortKey: 'materialName'
    },
    {
      header: t('warehouse.common.col.bin'),
      key: 'id',
      mono: true,
      sortKey: 'binId'
    },
    {
      header: t('warehouse.common.col.qty'),
      align: 'right',
      render: (b) => `${b.qty != null ? Math.round(b.qty) : Math.round(b.fillPct * 8)} ${b.material.uom}`,
      sortKey: 'qty'
    },
    {
      header: t('warehouse.common.col.age'),
      align: 'right',
      render: (b) => `${b.ageHours}h`,
      sortKey: 'ageHours'
    },
    {
      header: t('warehouse.inventory.col.expiry'),
      render: (b) => (
        <span className={b.batchExpiryDays < 30 ? 'red bold' : ''}>
          {b.batchExpiryDays < 9999 ? `${b.batchExpiryDays}d` : '—'}
        </span>
      ),
      sortKey: 'batchExpiryDays'
    },
    {
      header: t('warehouse.common.col.status'),
      render: (b) => <Pill tone={b.status === 'Occupied' ? 'sage' : b.status === 'Blocked' ? 'red' : 'grey'}>{b.status}</Pill>,
      sortKey: 'status'
    }
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Inventory · Bin health</div>
          <h1 className="page-title">{t('warehouse.title.inventory')}</h1>
          <div className="page-desc">Bin occupancy, line-side stock, batch expiry, quality holds and cycle count priorities.</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={downloadStockSnapshot} disabled={allWmBins.length === 0} title={allWmBins.length === 0 ? 'Loading…' : `Download ${allWmBins.length.toLocaleString()} bin rows as CSV`}><Icon name="download" size={14}/> {t('warehouse.inventory.btn.stockSnapshot')}</button>
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
              title={selectedLgtyp ? `Bin map · storage type ${selectedLgtyp}` : 'Bin map'}
              subtitle={selectedLgtyp ? `Type ${selectedLgtyp} · first 200 bins` : 'Select a storage type to view its bins'}
              eyebrow="LAGP"
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
            subtitle="All WM inventory · sorted by volume · top 20"
            eyebrow="LQUA"
            noPad
          >
            <div style={{ padding: '12px 16px 8px' }}>
              <input
                type="text"
                placeholder="Filter by material…"
                value={quantsFilter}
                onChange={(e) => setQuantsFilter(e.target.value)}
                style={{ fontSize: 12, fontFamily: 'var(--font-mono)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 8px', color: 'var(--text-1)', width: 220 }}
              />
              <span style={{ marginLeft: 12, fontSize: 12, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
                {sortedQuants.length > 20
                  ? `Showing top 20 of ${sortedQuants.length.toLocaleString()} matched`
                  : `${sortedQuants.length.toLocaleString()} rows`}
              </span>
            </div>
            <div className="scroll-x">
              <DataTable
                columns={quantsColumns}
                rows={sortedQuants.slice(0, 20)}
                rowKey={(b, i) => i}
                dense
                sortKey={quantsSortKey}
                sortDir={quantsSortDir}
                onSort={(key, dir) => {
                  setQuantsSortKey(key);
                  setQuantsSortDir(dir);
                }}
              />
              {detailError && (
                <div style={{ padding: 16, color: 'var(--status-risk)' }}>
                  Unable to load live quant rows: {detailError}
                </div>
              )}
            </div>
          </Card>
        </>
      )}

      {tab === 'lineside' && (
        <Card title={t('warehouse.inventory.card.lineside')} subtitle="Storage type 005 · min/max · replenishment signal" eyebrow="Line side" noPad>
          <DataTable
            columns={[
              { header: t('warehouse.common.col.line'), render: (l) => <><div style={{ fontWeight: 600, fontSize: 12 }}>{l.line.id}</div><div className="muted" style={{ fontSize: 11 }}>{l.line.name}</div></> },
              { header: t('warehouse.common.col.material'), render: (l) => <><div style={{ fontSize: 12 }}>{l.material.name}</div><div className="muted" style={{ fontSize: 11 }}>{l.material.id}</div></> },
              { header: t('warehouse.inventory.col.current'), align: 'right', render: (l) => `${l.current} ${l.material.uom}` },
              { header: t('warehouse.inventory.col.min'), align: 'right', key: 'min', muted: true },
              { header: t('warehouse.inventory.col.max'), align: 'right', key: 'max', muted: true },
              { header: t('warehouse.inventory.col.level'), width: 140, render: (l) => {
                const pct = Math.min(100, (l.current / l.max) * 100);
                const belowMin = l.current < l.min;
                return <Progress pct={pct} tone={belowMin ? 'red' : pct < 40 ? 'amber' : ''}/>
              }},
              { header: t('warehouse.common.col.status'), render: (l) => <Pill tone={l.status === 'Below min' ? 'red' : l.status === 'Near min' ? 'amber' : 'green'}>{l.status}</Pill> },
              { header: 'Action', render: (l) => l.current < l.min && <button className="btn btn-xs btn-primary">Replenish</button> }
            ]}
            rows={allLineside}
            rowKey={(l, i) => i}
            dense
            loading={linesideLoading}
            emphasize={(l) => l.current < l.min}
          />
        </Card>
      )}

      {tab === 'aged' && (
        <div className="grid-2">
          <Card title={t('warehouse.inventory.card.aged')} subtitle="> 7 days in bin · consider FEFO rotation" eyebrow="Age" noPad>
            <DataTable
              columns={[
                { header: t('warehouse.common.col.bin'), key: 'id', mono: true },
                { header: t('warehouse.common.col.material'), render: (b) => b.material?.name || '—' },
                { header: t('warehouse.common.col.age'), align: 'right', render: (b) => <span className="amber bold">{b.ageHours}h</span> },
                { header: t('warehouse.common.col.qty'), align: 'right', render: (b) => b.qty != null ? Math.round(b.qty) : Math.round(b.fillPct * 6) }
              ]}
              rows={aged}
              rowKey={(b, i) => i}
              dense
            />
          </Card>
          <Card title={t('warehouse.inventory.card.expiry')} subtitle="≤ 90 days to expiry · prioritise consumption · ordered by soonest" eyebrow="MCHA" noPad>
            <DataTable
              columns={[
                { header: t('warehouse.common.col.material'), render: (b) => <><div style={{ fontSize: 12 }}>{b.material_name}</div><div className="muted" style={{ fontSize: 11 }}>{b.material_id}</div></> },
                { header: t('warehouse.common.col.batch'), key: 'batch_id', mono: true },
                { header: 'Mfg Date', key: 'manufacture_date' },
                { header: 'Expiry Date', key: 'expiry_date' },
                { header: 'Days Left', align: 'right', render: (b) => <span className={`bold ${Number(b.days_to_expiry) < 14 ? 'red' : Number(b.days_to_expiry) < 30 ? 'amber' : ''}`}>{b.days_to_expiry}d</span> },
                { header: 'Stock', align: 'right', render: (b) => `${Math.round(Number(b.total_stock))} ${b.uom ?? ''}` },
                { header: 'Days Aged', align: 'right', render: (b) => <span className={Number(b.aged_days) > 90 ? 'amber' : ''}>{b.aged_days}d</span> }
              ]}
              rows={expiring}
              rowKey={(b, i) => i}
              dense
              loading={nearExpiryLoading}
            />
          </Card>
        </div>
      )}

      {tab === 'blocked' && (
        <Card title={t('warehouse.inventory.card.blocked')} subtitle="Bins under inspection or on hold" eyebrow="ST 010" noPad>
          <DataTable
            columns={[
              { header: t('warehouse.common.col.bin'), key: 'id', mono: true },
              { header: t('warehouse.common.col.material'), render: (b) => b.material?.name || '—' },
              { header: t('warehouse.common.col.qty'), align: 'right', render: (b) => b.qty != null ? Math.round(b.qty) : '—' },
              { header: t('warehouse.common.col.status'), render: () => <Pill tone="red">Blocked</Pill> }
            ]}
            rows={blocked}
            rowKey={(b, i) => i}
            dense
          />
        </Card>
      )}

      {tab === 'cycle' && (
        <Card title={t('warehouse.inventory.card.cycleCount')} subtitle="Fast movers, recent discrepancies, bins not counted in 30+ days" eyebrow="ABC" noPad>
          <DataTable
            columns={[
              { header: t('warehouse.inventory.col.prio'), render: (b, i) => <Pill tone={i < 4 ? 'red' : i < 10 ? 'amber' : 'grey'}>{i < 4 ? 'P1' : i < 10 ? 'P2' : 'P3'}</Pill> },
              { header: t('warehouse.common.col.bin'), key: 'id', mono: true },
              { header: t('warehouse.common.col.material'), render: (b) => b.material?.name || '—' },
              { header: t('warehouse.inventory.col.lastCount'), align: 'right', render: (b, i) => `${[4, 12, 18, 32, 45, 52, 67, 80, 95, 110, 132, 156][i % 12]}d` },
              { header: t('warehouse.inventory.col.delta'), align: 'right', render: (b, i) => i % 3 === 0 ? <span className="red">±{i * 2} kg</span> : <span className="muted">—</span> },
              { header: t('warehouse.inventory.col.assign'), render: () => <button className="btn btn-xs btn-secondary">{t('warehouse.inventory.col.assign')}</button> }
            ]}
            rows={detailBins.slice(0, 16)}
            rowKey={(b, i) => i}
            dense
          />
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
