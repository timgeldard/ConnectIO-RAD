import React from 'react';

/* Icons & small shared primitives (Lucide-style line icons, 24px, 1.75 stroke) */
const Icon = ({ name, size = 18, stroke = 1.75, color = 'currentColor', style }) => {
  const common = {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: color, strokeWidth: stroke, strokeLinecap: 'round', strokeLinejoin: 'round',
    style,
  };
  const paths = {
    dashboard: <><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></>,
    factory: <><path d="M2 20h20"/><path d="M4 20V9l6 4V9l6 4V6h4v14"/><path d="M8 20v-4"/><path d="M12 20v-4"/><path d="M16 20v-4"/></>,
    truckIn: <><path d="M14 18V6H3v12h11z"/><path d="M14 9h5l3 3v6h-8"/><circle cx="7" cy="19" r="2"/><circle cx="17" cy="19" r="2"/></>,
    truckOut: <><path d="M10 18V6h11v12H10z"/><path d="M10 9H5l-3 3v6h8"/><circle cx="17" cy="19" r="2"/><circle cx="7" cy="19" r="2"/></>,
    boxes: <><path d="M21 8V21H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/></>,
    scale: <><path d="M12 3v18"/><path d="M3 9l4-6h10l4 6"/><path d="M3 9c0 3 1.5 5 4 5s4-2 4-5"/><path d="M13 9c0 3 1.5 5 4 5s4-2 4-5"/></>,
    alert: <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>,
    chart: <><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></>,
    bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></>,
    filter: <><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></>,
    close: <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>,
    chevronRight: <><polyline points="9 18 15 12 9 6"/></>,
    chevronDown: <><polyline points="6 9 12 15 18 9"/></>,
    arrowUp: <><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></>,
    arrowDown: <><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></>,
    arrowRight: <><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></>,
    check: <><polyline points="20 6 9 17 4 12"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></>,
    pin: <><path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/></>,
    user: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
    menu: <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>,
    layers: <><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></>,
    pallet: <><rect x="3" y="3" width="18" height="12"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="6" y1="15" x2="6" y2="21"/><line x1="12" y1="15" x2="12" y2="21"/><line x1="18" y1="15" x2="18" y2="21"/></>,
    barcode: <><path d="M3 5v14M7 5v14M10 5v14M13 5v14M17 5v14M21 5v14"/></>,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
    refresh: <><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></>,
    plus: <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
    minus: <><line x1="5" y1="12" x2="19" y2="12"/></>,
    chat: <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></>,
    external: <><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></>,
    qr: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3z M20 14v3 M14 20h3 M17 17h4v4"/></>,
    eye: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></>,
    lightning: <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></>,
    trend: <><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></>,
    mobile: <><rect x="7" y="2" width="10" height="20" rx="2"/><line x1="12" y1="18" x2="12" y2="18.01"/></>,
    flag: <><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></>,
    link: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></>,
    thermometer: <><path d="M14 4v10.54a4 4 0 1 1-4 0V4a2 2 0 0 1 4 0z"/></>,
  };
  return <svg {...common}>{paths[name] || null}</svg>;
};

const Pill = ({ tone = 'grey', children, noDot, style }) => (
  <span className={`pill pill-${tone}${noDot ? ' no-dot' : ''}`} style={style}>{children}</span>
);

const Progress = ({ pct, tone, w }) => (
  <div className="progress" style={{ width: w || '100%' }}>
    <div className={`progress-fill${tone ? ' is-' + tone : ''}`} style={{ width: Math.max(0, Math.min(100, pct)) + '%' }}/>
  </div>
);

const RiskDot = ({ risk }) => <span className={`risk-dot ${risk === 'green' ? '' : risk}`}/>;

const riskLabel = (r) => r === 'red' ? 'Critical' : r === 'amber' ? 'At risk' : r === 'green' ? 'On track' : '—';
const riskTone = (r) => r === 'red' ? 'red' : r === 'amber' ? 'amber' : 'green';

// Small donut
const Donut = ({ pct, colour = 'var(--valentia-slate)', label, sub }) => {
  const r = 54, c = 2 * Math.PI * r;
  const off = c - (pct / 100) * c;
  return (
    <div className="donut-wrap">
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--stone)" strokeWidth="12"/>
        <circle cx="70" cy="70" r={r} fill="none" stroke={colour} strokeWidth="12"
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
          transform="rotate(-90 70 70)"/>
      </svg>
      <div className="donut-center">
        <div className="big">{label || pct + '%'}</div>
        {sub && <div className="small">{sub}</div>}
      </div>
    </div>
  );
};

const Hbar = ({ label, value, max, tone = '' }) => (
  <div className="hbar">
    <div className="hbar-label">{label}</div>
    <div className="hbar-track"><div className={`hbar-fill ${tone}`} style={{ width: Math.min(100, (value / max) * 100) + '%' }}/></div>
    <div className="hbar-value">{value}</div>
  </div>
);

const SparkBars = ({ data, tone = 'slate', height = 36 }) => {
  const max = Math.max(...data);
  const toneColor = { slate: 'var(--valentia-slate)', jade: 'var(--jade)', sunset: 'var(--sunset)', sunrise: 'var(--sunrise)', sage: 'var(--sage)', forest: 'var(--forest)' }[tone];
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height }}>
      {data.map((v, i) => (
        <div key={i} style={{
          flex: 1, height: (v / max) * height, background: toneColor,
          borderRadius: 2, opacity: 0.4 + 0.6 * (v / max),
        }}/>
      ))}
    </div>
  );
};


export { Icon, Pill, Progress, RiskDot, riskLabel, riskTone, Donut, Hbar, SparkBars };
