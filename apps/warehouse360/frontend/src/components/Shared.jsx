import React from 'react';
import WM from '../data/mockData.js';
import { Icon } from './Primitives.jsx';

/* Shared filter bar + drawer + small cards */

const FilterBar = ({ filters, values, onChange, extra }) => (
  <div className="filter-bar">
    {filters.map((f, i) => (
      <div className="filter-group" key={i}>
        <span className="filter-label">{f.label}</span>
        {f.chips ? f.chips.map((c) => (
          <button key={c.value} className={`filter-chip ${values[f.key] === c.value ? 'is-active' : ''}`}
            onClick={() => onChange(f.key, c.value)}>
            {c.dot && <span className={`risk-dot ${c.dot}`}/>}
            {c.label}
            {typeof c.count === 'number' && <span style={{ opacity: 0.6, fontFamily: 'var(--font-mono)', fontSize: 10 }}>{c.count}</span>}
          </button>
        )) : (
          <select className="filter-select" value={values[f.key] || ''} onChange={(e) => onChange(f.key, e.target.value)}>
            {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )}
      </div>
    ))}
    <div style={{ marginLeft: 'auto' }}>{extra}</div>
  </div>
);

const Drawer = ({ open, onClose, title, subtitle, children, actions }) => {
  if (!open) return null;
  return (
    <>
      <div className="drawer-backdrop" onClick={onClose}/>
      <aside className="drawer" role="dialog" aria-modal="true">
        <div className="drawer-header">
          <div style={{ flex: 1 }}>
            <div className="drawer-title">{title}</div>
            {subtitle && <div className="drawer-subtitle">{subtitle}</div>}
          </div>
          {actions}
          <button className="drawer-close" onClick={onClose} aria-label="Close">
            <Icon name="close" size={18}/>
          </button>
        </div>
        <div className="drawer-body">{children}</div>
      </aside>
    </>
  );
};

const KPI = ({ label, value, unit, trend, trendLabel, target, tone = 'ok', barPct, barTone }) => (
  <div className={`kpi is-${tone}`}>
    <div className="kpi-label">{label}</div>
    <div className="kpi-value">{value}{unit && <span className="unit">{unit}</span>}</div>
    {typeof barPct === 'number' && (
      <div className="kpi-bar"><div className={`kpi-bar-fill ${barTone ? 'is-' + barTone : ''}`} style={{ width: barPct + '%' }}/></div>
    )}
    {(trend !== undefined || target) && (
      <div className={`kpi-trend ${trend > 0 ? 'is-up' : trend < 0 ? 'is-down' : ''}`}>
        {trend > 0 && <Icon name="arrowUp" size={12}/>}
        {trend < 0 && <Icon name="arrowDown" size={12}/>}
        {trend !== undefined && <span>{Math.abs(trend)}{trendLabel || ''}</span>}
        {target && <span style={{ color: 'var(--fg-muted)', marginLeft: 6 }}>Target {target}</span>}
      </div>
    )}
  </div>
);

const Card = ({ title, subtitle, actions, children, style, tight, footer, eyebrow }) => (
  <div className="card" style={style}>
    {(title || actions) && (
      <div className="card-header">
        <div style={{ flex: 1 }}>
          {eyebrow && <div className="t-eyebrow" style={{ marginBottom: 2 }}>{eyebrow}</div>}
          <div className="card-title">{title}</div>
          {subtitle && <div className="card-subtitle">{subtitle}</div>}
        </div>
        {actions}
      </div>
    )}
    <div className={`card-body${tight ? ' tight' : ''}`}>{children}</div>
    {footer && <div className="card-footer">{footer}</div>}
  </div>
);

// Time helpers for UI
const formatETA = (d) => {
  const mins = WM.minutesFromNow(d);
  if (Math.abs(mins) < 60) return (mins < 0 ? mins + 'm ago' : 'in ' + mins + 'm');
  const hours = Math.round(mins / 60 * 10) / 10;
  return (hours < 0 ? Math.abs(hours) + 'h ago' : 'in ' + hours + 'h');
};

const Crumbs = ({ items }) => (
  <div className="crumbs">
    {items.map((c, i) => (
      <React.Fragment key={i}>
        {i > 0 && <Icon name="chevronRight" size={10}/>}
        {c.onClick ? <a onClick={c.onClick} style={{ cursor: 'pointer' }}>{c.label}</a> : <span>{c.label}</span>}
      </React.Fragment>
    ))}
  </div>
);


export { FilterBar, Drawer, KPI, Card, formatETA, Crumbs };
