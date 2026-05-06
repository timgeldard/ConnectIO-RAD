/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { Icon } from './Primitives'
import { minutesFromNow } from '~/utils/time'

/* Shared filter bar + drawer + small cards */

/** Props for the FilterBar component. */
interface FilterBarProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filters: any[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  values: Record<string, any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onChange: (key: string, value: any) => void
  extra?: React.ReactNode
}

/** Filter bar with chip-group or select-dropdown filter controls. */
const FilterBar = ({ filters, values, onChange, extra }: FilterBarProps) => (
  <div className="filter-bar">
    {filters.map((f: any, i: number) => (
      <div className="filter-group" key={i}>
        <span className="filter-label">{f.label}</span>
        {f.chips ? f.chips.map((c: any) => (
          <button key={c.value} className={`filter-chip ${values[f.key] === c.value ? 'is-active' : ''}`}
            onClick={() => onChange(f.key, c.value)}>
            {c.dot && <span className={`risk-dot ${c.dot}`}/>}
            {c.label}
            {typeof c.count === 'number' && <span style={{ opacity: 0.6, fontFamily: 'var(--font-mono)', fontSize: 10 }}>{c.count}</span>}
          </button>
        )) : (
          <select className="filter-select" value={values[f.key] || ''} onChange={(e) => onChange(f.key, e.target.value)}>
            {f.options.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )}
      </div>
    ))}
    <div style={{ marginLeft: 'auto' }}>{extra}</div>
  </div>
);

/** Props for the Drawer slide-in panel. */
interface DrawerProps {
  open: boolean
  onClose: () => void
  title?: string
  subtitle?: string
  children?: React.ReactNode
  actions?: React.ReactNode
}

/** Slide-in detail drawer with backdrop, header, and body. */
const Drawer = ({ open, onClose, title, subtitle, children, actions }: DrawerProps) => {
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

/** Props for the KPI metric card. */
interface KPIProps {
  label?: React.ReactNode
  value?: React.ReactNode
  unit?: string
  trend?: number
  trendLabel?: string
  target?: string
  tone?: string
  barPct?: number
  barTone?: string
}

/** KPI metric card with optional bar and trend indicator. */
const KPI = ({ label, value, unit, trend, trendLabel, target, tone = 'ok', barPct, barTone }: KPIProps) => (
  <div className={`kpi is-${tone}`}>
    <div className="kpi-label">{label}</div>
    <div className="kpi-value">{value}{unit && <span className="unit">{unit}</span>}</div>
    {typeof barPct === 'number' && (
      <div className="kpi-bar"><div className={`kpi-bar-fill ${barTone ? 'is-' + barTone : ''}`} style={{ width: barPct + '%' }}/></div>
    )}
    {(trend !== undefined || target) && (
      <div className={`kpi-trend ${(trend ?? 0) > 0 ? 'is-up' : (trend ?? 0) < 0 ? 'is-down' : ''}`}>
        {(trend ?? 0) > 0 && <Icon name="arrowUp" size={12}/>}
        {(trend ?? 0) < 0 && <Icon name="arrowDown" size={12}/>}
        {trend !== undefined && <span>{Math.abs(trend)}{trendLabel || ''}</span>}
        {target && <span style={{ color: 'var(--fg-muted)', marginLeft: 6 }}>Target {target}</span>}
      </div>
    )}
  </div>
);

/** Props for the Card layout component. */
interface CardProps {
  title?: React.ReactNode
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  children?: React.ReactNode
  style?: React.CSSProperties
  tight?: boolean
  footer?: React.ReactNode
  eyebrow?: string
}

/** Card container with optional header, actions, footer, and eyebrow. */
const Card = ({ title, subtitle, actions, children, style, tight, footer, eyebrow }: CardProps) => (
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

/** Formats a Date as a relative time string (e.g. "in 23m", "2h ago"). */
const formatETA = (d: Date) => {
  const mins = minutesFromNow(d);
  if (Math.abs(mins) < 60) return (mins < 0 ? mins + 'm ago' : 'in ' + mins + 'm');
  const hours = Math.round(mins / 60 * 10) / 10;
  return (hours < 0 ? Math.abs(hours) + 'h ago' : 'in ' + hours + 'h');
};

/** A single breadcrumb item. */
interface CrumbItem {
  label: string
  onClick?: () => void
}

/** Breadcrumb navigation row. */
const Crumbs = ({ items }: { items: CrumbItem[] }) => (
  <div className="crumbs">
    {items.map((c: any, i: number) => (
      <React.Fragment key={i}>
        {i > 0 && <Icon name="chevronRight" size={10}/>}
        {c.onClick ? <a onClick={c.onClick} style={{ cursor: 'pointer' }}>{c.label}</a> : <span>{c.label}</span>}
      </React.Fragment>
    ))}
  </div>
);


export { FilterBar, Drawer, KPI, Card, formatETA, Crumbs }
