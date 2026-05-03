/* TPM Cockpit — shared UI primitives */

const { useState, useEffect, useMemo, useRef } = React;

// ---------- Sparkline ----------
const Spark = ({ data = [], width = 100, height = 24, color = 'var(--valentia-slate)', area = true }) => {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const pts = data.map((d, i) => [i * step, height - ((d - min) / range) * (height - 4) - 2]);
  const path = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const areaPath = path + ` L${width.toFixed(1)} ${height} L0 ${height} Z`;
  return (
    <svg width={width} height={height} className="spark" style={{ width, height }}>
      {area && <path d={areaPath} fill={color} fillOpacity="0.10" />}
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
};

// ---------- Bar (cell) ----------
const CellBar = ({ value, max, status }) => {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className={'bar ' + (status || '')}>
      <span style={{ width: pct + '%' }} />
    </div>
  );
};

// ---------- Badge ----------
const Badge = ({ kind = 'neutral', dot = true, children }) => (
  <span className={'badge badge--' + kind}>
    {dot && <span className="dot" />}
    {children}
  </span>
);

// ---------- Plant pill ----------
const Plant = ({ code }) => {
  const p = window.TPM.plants[code];
  if (!p) return <span className="plant">{code}</span>;
  return <span className={'plant ' + p.kind} title={p.name}>{code}</span>;
};

const PlantFlow = ({ src, tpm, dst }) => (
  <span className="row gap-4">
    {src && <Plant code={src} />}
    {src && tpm && <Icon name="arrow-r" size={11} className="arrow-flow" />}
    {tpm && <Plant code={tpm} />}
    {tpm && dst && <Icon name="arrow-r" size={11} className="arrow-flow" />}
    {dst && <Plant code={dst} />}
  </span>
);

// ---------- Severity ----------
const Sev = ({ level }) => (
  <span className={'sev sev--' + level}>
    <span className="marker" />
    {level.toUpperCase()}
  </span>
);

// ---------- KPI Card ----------
const Kpi = ({ label, value, unit, delta, status = 'info', spark, hint, accent = true, onClick }) => {
  const cls = `kpi ${accent ? 'kpi--accent' : ''} kpi--${status}`;
  const dirCls = delta == null ? 'flat' : delta > 0 ? 'up' : 'down';
  const arrow = delta == null ? '' : delta > 0 ? '▲' : '▼';
  const showAsRiskUp = (status === 'risk' || status === 'pending') && delta > 0;
  const showAsOkDown = status === 'ok' && delta < 0;
  return (
    <div className={cls} onClick={onClick}>
      <div className="kpi__lbl">{label}{hint && <span className="muted" style={{textTransform:'none', fontWeight: 400, fontSize: 10}}>· {hint}</span>}</div>
      <div className="kpi__val">{value}{unit && <span className="unit">{unit}</span>}</div>
      <div className="row between">
        <span className={'kpi__delta ' + dirCls} style={{ color: showAsRiskUp ? 'var(--status-risk)' : (showAsOkDown ? 'var(--status-risk)' : undefined) }}>
          {arrow} {delta != null ? Math.abs(delta) + (Number.isInteger(delta) ? '' : '%') : '—'} <span className="faint" style={{marginLeft: 4}}>vs 7d</span>
        </span>
        {spark && <Spark data={spark} width={80} height={22} color={
          status === 'risk' ? 'var(--status-risk)' :
          status === 'pending' ? 'var(--status-pending)' :
          status === 'ok' ? 'var(--status-ok)' : 'var(--valentia-slate)'
        } />}
      </div>
    </div>
  );
};

// ---------- Card ----------
const Card = ({ title, sub, actions, children, flush, footer, className = '' }) => (
  <div className={'card ' + className}>
    {(title || actions) && (
      <div className="card__hd">
        <div>
          {title && <div className="ttl">{title}</div>}
          {sub && <div className="sub">{sub}</div>}
        </div>
        {actions && <div className="actions">{actions}</div>}
      </div>
    )}
    <div className={'card__bd ' + (flush ? 'card__bd--flush' : '')}>{children}</div>
    {footer && <div className="card__ft">{footer}</div>}
  </div>
);

// ---------- Filter chip ----------
const Chip = ({ label, value, active, onRemove, onClick }) => (
  <button className={'chip ' + (active ? 'is-active' : '')} onClick={onClick}>
    {label && <span className="label">{label}:</span>}
    <span className="val">{value}</span>
    {onRemove && <Icon name="x" size={11} className="x" />}
  </button>
);

// ---------- Page header (filter bar built per-module) ----------
const PageTitle = ({ eyebrow, name }) => (
  <div className="filterbar__title">
    <span className="eyebrow">{eyebrow}</span>
    <span className="name">{name}</span>
  </div>
);

// ---------- Funnel step ----------
const FlowStep = ({ data, onClick }) => {
  const cls = data.status === 'risk' ? 'is-risk' : data.status === 'pending' ? 'is-warn' : '';
  return (
    <div className={'flow-step ' + cls} onClick={onClick}>
      <div>
        <div className="flow-step__top">
          <span className="flow-step__lbl">{data.label}</span>
          {data.delay > 5 && <Badge kind="risk">+{data.delay}d</Badge>}
          {data.delay > 0 && data.delay <= 5 && <Badge kind="pending">+{data.delay}d</Badge>}
        </div>
        <div className="flow-step__val">{data.value} <span style={{fontSize: 12, color: 'var(--ink-muted)'}}>t</span></div>
        <div className="flow-step__qty">{data.count} lots</div>
      </div>
      <div className="flow-step__bar">
        <i className="ok" />
        <i className={data.delay > 0 ? 'pending' : 'ok'} />
        <i className={data.delay > 5 ? 'risk' : (data.delay > 0 ? 'pending' : '')} />
      </div>
    </div>
  );
};

// ---------- Aging row ----------
const AgingRow = ({ label, buckets }) => {
  const total = buckets.reduce((s, x) => s + x, 0);
  return (
    <div style={{ marginBottom: 8 }}>
      <div className="row between" style={{marginBottom: 4}}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>{label}</span>
        <span className="num muted" style={{fontSize: 11}}>{total} t</span>
      </div>
      <div className="aging">
        {buckets.map((b, i) => (
          <span key={i} className={`s${i+1}`} style={{ width: total ? (b/total*100)+'%' : 0 }} title={`${b} t`} />
        ))}
      </div>
    </div>
  );
};

// ---------- Alert ----------
const Alert = ({ kind = 'info', ttl, body, cta, onCta }) => (
  <div className={'alert alert--' + kind}>
    <Icon name={kind === 'risk' ? 'alert' : kind === 'pending' ? 'clock' : kind === 'ok' ? 'check' : 'database'} size={18} />
    <div style={{flex: 1}}>
      <div className="ttl">{ttl}</div>
      <div className="body" style={{fontSize: 11.5}}>{body}</div>
    </div>
    {cta && <button className="btn btn-sm" onClick={onCta}>{cta} <Icon name="chevron-r" size={12}/></button>}
  </div>
);

// ---------- Tabs ----------
const Tabs = ({ items, value, onChange }) => (
  <div className="tabs">
    {items.map(it => (
      <button key={it.id} className={'tab ' + (value === it.id ? 'is-active' : '')}
              onClick={() => onChange(it.id)}>
        {it.label}{it.count != null && <span className="count">{it.count}</span>}
      </button>
    ))}
  </div>
);

// ---------- Empty state ----------
const Empty = ({ icon = 'inbox', ttl, desc, cta }) => (
  <div className="state">
    <div className="ico"><Icon name={icon} size={28} /></div>
    <div className="ttl">{ttl}</div>
    <div className="desc">{desc}</div>
    {cta && <button className="btn btn-sm mt-12">{cta}</button>}
  </div>
);

// ---------- Skeleton ----------
const Skel = ({ w = '100%', h = 12, mb = 8 }) => (
  <div className="skel" style={{ width: w, height: h, marginBottom: mb }} />
);

Object.assign(window, {
  Spark, CellBar, Badge, Plant, PlantFlow, Sev, Kpi, Card, Chip, PageTitle,
  FlowStep, AgingRow, Alert, Tabs, Empty, Skel,
});
