import React from 'react';
import { useI18n } from '@connectio/shared-frontend-i18n';
import WM from '../data/mockData.js';
import { useApi } from '../hooks/useApi.js';
import { Icon, Pill, Progress } from './Primitives.jsx';
import { FilterBar, Card, KPI } from './Shared.jsx';

/* Dispensary Workbench */

const normalizeTask = (task) => {
  const reqBy = task.sched_start ? new Date(task.sched_start) : null;
  return {
    _source: 'api',
    id: task.reservation_no + (task.item_no != null ? '-' + task.item_no : ''),
    po: task.order_id ?? '—',
    material: { id: task.material_id ?? '—', name: task.material_name ?? task.material_id ?? '—' },
    batch: task.batch_id ?? '—',
    qty: task.open_qty ?? task.required_qty ?? 0,
    weighedQty: 0,
    scale: '—',
    operator: null,
    status: 'To Do',
    requiredBy: reqBy,
  };
};

const Dispensary = () => {
  const { t } = useI18n();
  const [tab, setTab] = React.useState('today');
  const [filters, setFilters] = React.useState({ status: 'all', scale: 'all' });

  const { data: tasksResp } = useApi('/api/dispensary');
  const allTasks = React.useMemo(() => {
    const api = tasksResp?.tasks ?? [];
    return api.length > 0 ? api.map(normalizeTask) : WM.DISP_TASKS;
  }, [tasksResp]);

  const rows = React.useMemo(() => {
    let r = allTasks;
    if (filters.status !== 'all') r = r.filter((task) => task.status === filters.status);
    if (filters.scale !== 'all') r = r.filter((task) => task.scale === filters.scale);
    return r;
  }, [allTasks, filters]);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-eyebrow">Dispensary · Weighed micros</div>
          <h1 className="page-title">{t('warehouse.title.dispensary')}</h1>
          <div className="page-desc">Weighed ingredient tasks by scale. Tolerance ± 0.5%. Feeds dispensary-enabled process orders.</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary"><Icon name="qr" size={14}/> {t('warehouse.dispensary.btn.scanBatch')}</button>
          <button className="btn btn-primary"><Icon name="scale" size={14}/> {t('warehouse.dispensary.btn.newWeighing')}</button>
        </div>
      </div>

      <div className="kpi-grid">
        <KPI label={t('warehouse.dispensary.kpi.tasksToday')} value={allTasks.length} tone="ok"/>
        <KPI label={t('warehouse.dispensary.kpi.weighed')} value={allTasks.filter((task) => task.status === 'Weighed').length} tone="ok" barPct={allTasks.length > 0 ? allTasks.filter((task) => task.status === 'Weighed').length / allTasks.length * 100 : 0}/>
        <KPI label={t('warehouse.dispensary.kpi.inProgress')} value={allTasks.filter((task) => task.status === 'Weighing').length} tone="ok"/>
        <KPI label={t('warehouse.dispensary.kpi.todoCritical')} value={allTasks.filter((task) => task.status === 'To Do' && task.requiredBy && WM.minutesFromNow(task.requiredBy) < 60).length} tone="critical"/>
        <KPI label={t('warehouse.dispensary.kpi.readinessVsPlan')} value={WM.KPIs.dispensaryReady.value} unit="%" target="95%" tone="warn" barPct={WM.KPIs.dispensaryReady.value} barTone="amber"/>
        <KPI label={t('warehouse.dispensary.kpi.toleranceBreaches')} value="0" tone="ok" trendLabel=" today"/>
      </div>

      {/* Scales grid */}
      <Card title={t('warehouse.dispensary.card.scales')} subtitle="Four certified scales · last stable reading" eyebrow="Scales" style={{ marginBottom: 16 }}>
        <div className="grid-4">
          {['SC-01', 'SC-02', 'SC-03', 'SC-04'].map((id, i) => {
            const scaleTask = WM.DISP_TASKS.find((task) => task.scale === id && task.status === 'Weighing')
              || WM.DISP_TASKS.find((task) => task.scale === id);
            const inUse = scaleTask?.status === 'Weighing';
            return (
              <div key={id} className="scale-card" style={{ borderColor: inUse ? 'var(--valentia-slate)' : 'var(--stroke-soft)' }}>
                <div className="flex between items-center">
                  <div className="t-eyebrow">{id}</div>
                  <Pill tone={inUse ? 'slate' : 'green'}>{inUse ? t('warehouse.dispensary.scale.inUse') : t('warehouse.dispensary.scale.idle')}</Pill>
                </div>
                <div style={{ fontFamily: 'var(--font-impact)', fontWeight: 800, fontSize: 30, color: 'var(--forest)', lineHeight: 1, marginTop: 8, fontVariantNumeric: 'tabular-nums' }}>
                  {inUse ? (scaleTask.weighedQty || scaleTask.qty * 0.4).toFixed(3) : '0.000'} <span style={{ fontSize: 13, color: 'var(--fg-muted)', fontFamily: 'var(--font-sans)' }}>kg</span>
                </div>
                <div className="muted small" style={{ marginTop: 6 }}>
                  {inUse ? <>Target <span className="mono">{scaleTask.qty.toFixed(3)}</span> kg · ±0.5%</> : 'Last calibrated 08:12'}
                </div>
                <div style={{ marginTop: 8 }}>
                  {inUse ? <Progress pct={(scaleTask.weighedQty || scaleTask.qty * 0.4) / scaleTask.qty * 100} tone="slate"/> : <Progress pct={100}/>}
                </div>
                {inUse && scaleTask && <div className="small muted" style={{ marginTop: 6 }}>{scaleTask.operator} · {scaleTask.material.name}</div>}
              </div>
            );
          })}
        </div>
      </Card>

      <FilterBar
        filters={[
          { key: 'status', label: t('warehouse.dispensary.filter.status'), chips: [
            { value: 'all',      label: t('warehouse.common.all') },
            { value: 'To Do',    label: t('warehouse.dispensary.status.todo') },
            { value: 'Weighing', label: t('warehouse.dispensary.status.weighing') },
            { value: 'Weighed',  label: t('warehouse.dispensary.status.weighed') },
            { value: 'Check',    label: t('warehouse.dispensary.status.check') },
          ] },
          { key: 'scale', label: t('warehouse.dispensary.filter.scale'), chips: [
            { value: 'all', label: t('warehouse.common.all') },
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
              <tr>
                <th>{t('warehouse.dispensary.col.task')}</th>
                <th>{t('warehouse.dispensary.col.processOrder')}</th>
                <th>{t('warehouse.common.col.material')}</th>
                <th>{t('warehouse.common.col.batch')}</th>
                <th className="num">{t('warehouse.dispensary.col.target')}</th>
                <th className="num">{t('warehouse.dispensary.col.weighedQty')}</th>
                <th className="num">{t('warehouse.dispensary.col.delta')}</th>
                <th>{t('warehouse.dispensary.col.scale')}</th>
                <th>{t('warehouse.common.col.operator')}</th>
                <th>{t('warehouse.dispensary.col.required')}</th>
                <th>{t('warehouse.common.col.status')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((task) => {
                const delta = task.weighedQty > 0 ? ((task.weighedQty - task.qty) / task.qty * 100) : null;
                const mins = task.requiredBy ? WM.minutesFromNow(task.requiredBy) : null;
                return (
                  <tr key={task.id} className={task.status === 'To Do' && mins != null && mins < 60 ? 'is-risk-red' : ''}>
                    <td className="code">{task.id}</td>
                    <td><span className="code">{task.po}</span></td>
                    <td><div style={{ fontSize: 12 }}>{task.material.name}</div><div className="muted" style={{ fontSize: 11 }}>{task.material.id}</div></td>
                    <td className="mono small">{task.batch}</td>
                    <td className="num">{task.qty.toFixed(3)} kg</td>
                    <td className="num">{task.weighedQty ? task.weighedQty.toFixed(3) : <span className="muted">—</span>}</td>
                    <td className="num">{delta !== null ? <span className={Math.abs(delta) > 0.5 ? 'red bold' : 'green'}>{delta >= 0 ? '+' : ''}{delta.toFixed(2)}%</span> : <span className="muted">—</span>}</td>
                    <td className="mono small">{task.scale}</td>
                    <td className="small">{task.operator || <span className="muted">{t('warehouse.common.unassigned')}</span>}</td>
                    <td className="mono small">{task.requiredBy ? WM.fmtTime(task.requiredBy) : '—'}<div className={mins != null && mins < 60 ? 'red small bold' : 'muted small'}>{mins == null ? '—' : mins > 0 ? 'in ' + mins + 'm' : Math.abs(mins) + 'm ago'}</div></td>
                    <td><Pill tone={task.status === 'Weighed' ? 'green' : task.status === 'Weighing' ? 'slate' : task.status === 'Check' ? 'amber' : 'grey'}>{task.status}</Pill></td>
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
