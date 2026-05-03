// ui.jsx — shared primitives: icons, sparklines, drawers, persona, etc.

const { useState, useEffect, useRef, useMemo, useCallback, Fragment } = React;

// ============== ICONS (Lucide-style line, 1.75 stroke) ==============
const Icon = ({ name, size = 16, ...rest }) => {
  const paths = ICON_PATHS[name];
  if (!paths) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...rest}>
      {paths}
    </svg>
  );
};
const ICON_PATHS = {
  // nav / module icons
  dashboard: <><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></>,
  layers: <><path d="M12 2 2 7l10 5 10-5z"/><path d="M2 12l10 5 10-5"/><path d="M2 17l10 5 10-5"/></>,
  warehouse: <><path d="M3 21V9l9-6 9 6v12"/><path d="M9 21V12h6v9"/><path d="M3 13h6"/><path d="M15 13h6"/></>,
  scale: <><path d="M12 3v18"/><path d="M5 7h14"/><path d="M5 7l-3 7a4 4 0 0 0 6 0z"/><path d="M19 7l-3 7a4 4 0 0 0 6 0z"/></>,
  trending: <><path d="m3 17 6-6 4 4 8-8"/><path d="M14 7h7v7"/></>,
  alert: <><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></>,
  search: <><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></>,
  bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 15 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.16.39.51.69.91.79H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
  filter: <><path d="M22 3H2l8 9.46V19l4 2v-8.54z"/></>,
  download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></>,
  share: <><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="m16 6-4-4-4 4"/><path d="M12 2v13"/></>,
  bookmark: <><path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></>,
  arrowUp: <><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></>,
  arrowDown: <><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></>,
  arrowRight: <><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></>,
  arrowLeft: <><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></>,
  chevDown: <><path d="m6 9 6 6 6-6"/></>,
  chevRight: <><path d="m9 18 6-6-6-6"/></>,
  chevLeft: <><path d="m15 18-6-6 6-6"/></>,
  chevUp: <><path d="m18 15-6-6-6 6"/></>,
  close: <><path d="M18 6 6 18"/><path d="m6 6 12 12"/></>,
  plus: <><path d="M5 12h14"/><path d="M12 5v14"/></>,
  minus: <><path d="M5 12h14"/></>,
  refresh: <><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></>,
  more: <><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></>,
  check: <><path d="M20 6 9 17l-5-5"/></>,
  clock: <><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></>,
  package: <><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></>,
  factory: <><path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/><path d="M17 18h1"/><path d="M12 18h1"/><path d="M7 18h1"/></>,
  user: <><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></>,
  moon: <><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></>,
  menu: <><path d="M3 12h18"/><path d="M3 6h18"/><path d="M3 18h18"/></>,
  panelLeft: <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/></>,
  filterX: <><path d="M13.013 3H2l8 9.46V19l4 2v-8.54l.9-1.055"/><path d="m22 3-5 5"/><path d="m17 3 5 5"/></>,
  database: <><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/></>,
  branch: <><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></>,
  link: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></>,
  helpCircle: <><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></>,
  flag: <><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></>,
  shield: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>,
  inbox: <><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></>,
  fileText: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></>,
  list: <><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></>,
  grid: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></>,
  zap: <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></>,
  expand: <><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/><path d="M3 8V5a2 2 0 0 1 2-2h3"/></>,
  eye: <><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></>,
  rotate: <><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></>,
  truck: <><path d="M5 18a2 2 0 1 0 4 0 2 2 0 1 0-4 0M15 18a2 2 0 1 0 4 0 2 2 0 1 0-4 0"/><path d="M3 17V6a1 1 0 0 1 1-1h11v12"/><path d="M15 8h4l3 4v5h-3"/></>,
  history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></>,
};

// ============== SPARKLINE ==============
function Sparkline({ data, color = "var(--c-brand)", height = 28, fill = true }) {
  if (!data || data.length === 0) return null;
  const w = 120, h = height;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return [x, y];
  });
  const d = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + "," + p[1].toFixed(1)).join(" ");
  const fillD = d + ` L${w},${h} L0,${h} Z`;
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: "block" }}>
      {fill && <path d={fillD} fill={color} opacity="0.12"/>}
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ============== STACKED BAR ==============
function StackBar({ parts, total, height = 8, label }) {
  const sum = total || parts.reduce((s, p) => s + p.v, 0) || 1;
  return (
    <div className="stack-bar" style={{ height }}>
      {parts.map((p, i) => (
        <span key={i} title={`${p.label}: ${p.v.toLocaleString()}`}
              style={{ width: `${(p.v / sum) * 100}%`, background: p.color }}/>
      ))}
    </div>
  );
}

// ============== BADGE helpers ==============
function StockTypeBadge({ type }) {
  const map = {
    unrestricted: { cls: "success", label: "Unrestr." },
    qi:           { cls: "info",    label: "QI" },
    blocked:      { cls: "danger",  label: "Blocked" },
    restricted:   { cls: "warning", label: "Restr." },
    interim:      { cls: "purple",  label: "Interim" },
  };
  const m = map[type] || { cls: "muted", label: type };
  return <span className={`badge ${m.cls}`}><span className="dot"/>{m.label}</span>;
}

function MismatchBadge({ kind }) {
  if (kind === "match") return <span className="badge success"><span className="dot"/>In sync</span>;
  if (kind === "timing") return <span className="badge info"><span className="dot"/>Timing lag</span>;
  if (kind === "interim") return <span className="badge purple"><span className="dot"/>Interim</span>;
  if (kind === "true") return <span className="badge danger"><span className="dot"/>True variance</span>;
  return null;
}

function SeverityBar({ level }) {
  return (
    <span className={`sev-bar s${level}`} title={`Severity ${level}/4`}>
      <span className="seg"/><span className="seg"/><span className="seg"/><span className="seg"/>
    </span>
  );
}

// ============== TOOLTIP wrapper ==============
function Tip({ tip, children }) {
  return <span title={tip}>{children}</span>;
}

// ============== KPI CARD ==============
function Kpi({ label, value, unit, delta, deltaDir = "up", trend, foot, accent, info, spec }) {
  return (
    <div className={`kpi ${accent ? "accent-" + accent : ""}`} style={{ position: "relative" }}>
      {spec && <span className="spec-tag">{spec}</span>}
      <div className="kpi-eyebrow">
        {label}
        {info && <span className="info-dot" title={info}>i</span>}
      </div>
      <div className="kpi-value">
        {value}{unit && <span className="unit">{unit}</span>}
      </div>
      {delta && (
        <div className={`kpi-delta ${deltaDir}`}>
          <Icon name={deltaDir === "up" ? "arrowUp" : deltaDir === "down" ? "arrowDown" : "minus"} size={11}/>
          {delta}
        </div>
      )}
      {trend && <div className="kpi-spark"><Sparkline data={trend} color={`var(--c-${accent || "brand"})`}/></div>}
      {foot && <div className="kpi-foot">{foot}</div>}
    </div>
  );
}

// ============== DRAWER ==============
function Drawer({ open, onClose, title, eyebrow, children, footer, width }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <>
      <div className={`drawer-shade ${open ? "open" : ""}`} onClick={onClose}/>
      <div className={`drawer ${open ? "open" : ""}`} style={width ? { width } : null}>
        <div className="drawer-h">
          <div style={{ flex: 1, minWidth: 0 }}>
            {eyebrow && <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--c-fg-mute)", marginBottom: 4 }}>{eyebrow}</div>}
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--c-fg-strong)", letterSpacing: "-0.005em", textWrap: "balance" }}>{title}</div>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="close"/></button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-foot">{footer}</div>}
      </div>
    </>
  );
}

// ============== FILTER CHIP ==============
function FilterChip({ label, value, active, onClick, keylabel }) {
  return (
    <button className={`filter-chip ${active ? "active" : ""}`} onClick={onClick}>
      {keylabel && <span className="chip-key">{keylabel}</span>}
      <span>{value || label}</span>
      <Icon name="chevDown" size={12}/>
    </button>
  );
}

// ============== HELPERS ==============
function Bar({ pct, color = "brand", height = 6 }) {
  return (
    <div style={{ height, background: "var(--c-stroke)", borderRadius: 999, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${Math.min(100, Math.max(0, pct))}%`, background: `var(--c-${color})`, borderRadius: 999 }}/>
    </div>
  );
}

function Money(n) {
  if (n >= 1_000_000) return "€" + (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return "€" + (n / 1_000).toFixed(0) + "K";
  return "€" + n.toLocaleString();
}
function K(n) {
  if (n >= 1_000_000) return (n/1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n/1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

window.UI = { Icon, Sparkline, StackBar, StockTypeBadge, MismatchBadge, SeverityBar, Tip, Kpi, Drawer, FilterChip, Bar, Money, K };
