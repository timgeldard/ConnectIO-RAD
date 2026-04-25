import React from 'react';
import WM from '../data/mockData.js';
import { Icon, Pill, Progress } from './Primitives.jsx';
import { FilterBar, Card, KPI } from './Shared.jsx';

/* Dispensary Workbench */

const Dispensary = () => {
  const [tab, setTab] = React.useState('today');
  const [filters, setFilters] = React.useState({ status: 'all', scale: 'all' });

  const rows = React.useMemo(() => {
    let r = WM.DISP_TASKS;
    if (filters.status !== 'all') r = r.filter((t) => t.status === filters.status);
    if (filters.scale !== 'all') r = r.filter((t) => t.scale === filters.scale);
    return r;
  }, [filters]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Dispensary · Weighed micros</div>
          <h1 className="page-title">Dispensary Workbench</h1>
          <div className="page-desc">Weighed ingredient tasks by scale. Tolerance ± 0.5%. Feeds dispensary-enabled process orders.</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary"><Icon name="qr" size={14}/> Scan batch</button>
          <button className="btn btn-primary"><Icon name="scale" size={14}/> New weighing</button>
        </div>
      </div>

      <div className="kpi-grid">
        <KPI label="Tasks today" value={WM.DISP_TASKS.length} tone="ok"/>
        <KPI label="Weighed" value={WM.DISP_TASKS.filter((t) => t.status === 'Weighed').length} tone="ok" barPct={WM.DISP_TASKS.filter((t) => t.status === 'Weighed').length / WM.DISP_TASKS.length * 100}/>
        <KPI label="In progress" value={WM.DISP_TASKS.filter((t) => t.status === 'Weighing').length} tone="ok"/>
        <KPI label="To do · < 1h required" value={WM.DISP_TASKS.filter((t) => t.status === 'To Do' && WM.minutesFromNow(t.requiredBy) < 60).length} tone="critical"/>
        <KPI label="Readiness vs plan" value={WM.KPIs.dispensaryReady.value} unit="%" target="95%" tone="warn" barPct={WM.KPIs.dispensaryReady.value} barTone="amber"/>
        <KPI label="Tolerance breaches" value="0" tone="ok" trendLabel=" today"/>
      </div>

      {/* Scales grid */}
      <Card title="Scales · live status" subtitle="Four certified scales · last stable reading" eyebrow="Scales" style={{ marginBottom: 16 }}>
        <div className="grid-4">
          {['SC-01', 'SC-02', 'SC-03', 'SC-04'].map((id, i) => {
            const task = WM.DISP_TASKS.find((t) => t.scale === id && t.status === 'Weighing')
              || WM.DISP_TASKS.find((t) => t.scale === id);
            const inUse = task?.status === 'Weighing';
            return (
              <div key={id} className="scale-card" style={{ borderColor: inUse ? 'var(--valentia-slate)' : 'var(--stroke-soft)' }}>
                <div className="flex between items-center">
                  <div className="t-eyebrow">{id}</div>
                  <Pill tone={inUse ? 'slate' : 'green'}>{inUse ? 'In use' : 'Idle'}</Pill>
                </div>
                <div style={{ fontFamily: 'var(--font-impact)', fontWeight: 800, fontSize: 30, color: 'var(--forest)', lineHeight: 1, marginTop: 8, fontVariantNumeric: 'tabular-nums' }}>
                  {inUse ? (task.weighedQty || task.qty * 0.4).toFixed(3) : '0.000'} <span style={{ fontSize: 13, color: 'var(--fg-muted)', fontFamily: 'var(--font-sans)' }}>kg</span>
                </div>
                <div className="muted small" style={{ marginTop: 6 }}>
                  {inUse ? <>Target <span className="mono">{task.qty.toFixed(3)}</span> kg · ±0.5%</> : 'Last calibrated 08:12'}
                </div>
                <div style={{ marginTop: 8 }}>
                  {inUse ? <Progress pct={(task.weighedQty || task.qty * 0.4) / task.qty * 100} tone="slate"/> : <Progress pct={100}/>}
                </div>
                {inUse && task && <div className="small muted" style={{ marginTop: 6 }}>{task.operator} · {task.material.name}</div>}
              </div>
            );
          })}
        </div>
      </Card>

      <FilterBar
        filters={[
          { key: 'status', label: 'Status', chips: [
            { value: 'all', label: 'All' },
            { value: 'To Do', label: 'To do' },
            { value: 'Weighing', label: 'Weighing' },
            { value: 'Weighed', label: 'Weighed' },
            { value: 'Check', label: 'Check' },
          ] },
          { key: 'scale', label: 'Scale', chips: [
            { value: 'all', label: 'All' },
            { value: 'SC-01', label: 'SC-01' }, { value: 'SC-02', label: 'SC-02' },
            { value: 'SC-03', label: 'SC-03' }, { value: 'SC-04', label: 'SC-04' },
          ] },
        ]}
        values={filters}
        onChange={(k, v) => setFilters({ ...filters, [k]: v })}
      />

      <Card title={`${rows.length} dispensary tasks`} tight>
        <div className="scroll-x">
          <table className="tbl">
            <thead>
              <tr><th>Task</th><th>Process order</th><th>Material</th><th>Batch</th>
                <th className="num">Target</th><th className="num">Weighed</th><th className="num">Δ</th>
                <th>Scale</th><th>Operator</th><th>Required</th><th>Status</th></tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const delta = t.weighedQty > 0 ? ((t.weighedQty - t.qty) / t.qty * 100) : null;
                const mins = WM.minutesFromNow(t.requiredBy);
                return (
                  <tr key={t.id} className={t.status === 'To Do' && mins < 60 ? 'is-risk-red' : ''}>
                    <td className="code">{t.id}</td>
                    <td><span className="code">{t.po}</span></td>
                    <td><div style={{ fontSize: 12 }}>{t.material.name}</div><div className="muted" style={{ fontSize: 11 }}>{t.material.id}</div></td>
                    <td className="mono small">{t.batch}</td>
                    <td className="num">{t.qty.toFixed(3)} kg</td>
                    <td className="num">{t.weighedQty ? t.weighedQty.toFixed(3) : <span className="muted">—</span>}</td>
                    <td className="num">{delta !== null ? <span className={Math.abs(delta) > 0.5 ? 'red bold' : 'green'}>{delta >= 0 ? '+' : ''}{delta.toFixed(2)}%</span> : <span className="muted">—</span>}</td>
                    <td className="mono small">{t.scale}</td>
                    <td className="small">{t.operator || <span className="muted">unassigned</span>}</td>
                    <td className="mono small">{WM.fmtTime(t.requiredBy)}<div className={mins < 60 ? 'red small bold' : 'muted small'}>{mins > 0 ? 'in ' + mins + 'm' : Math.abs(mins) + 'm ago'}</div></td>
                    <td><Pill tone={t.status === 'Weighed' ? 'green' : t.status === 'Weighing' ? 'slate' : t.status === 'Check' ? 'amber' : 'grey'}>{t.status}</Pill></td>
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


export { Dispensary };
