// ============================================================================
// Shared components for ConnectIO-RAD · Plant Maintenance
// ============================================================================

// ---------- Sparkline ----------
const Sparkline = ({ data, w = 100, h = 28, color = "var(--valentia-slate)", fill = true, stroke = 1.5 }) => {
  if (!data || !data.length) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const dx = w / (data.length - 1);
  const pts = data.map((v, i) => [i * dx, h - ((v - min) / range) * (h - 4) - 2]);
  const path = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = path + ` L${w},${h} L0,${h} Z`;
  return (
    <svg className="kpi-spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      {fill && <path d={area} fill={color} opacity="0.10"/>}
      <path d={path} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r="2.2" fill={color}/>
    </svg>
  );
};

// ---------- KPI Card ----------
const KPICard = ({ label, value, unit, trend, dir = "flat", target, status, spark, sparkColor, onClick, hint }) => {
  const dirSym = { up: "▲", "up-bad": "▲", down: "▼", "down-good": "▼", flat: "—" }[dir];
  return (
    <div className="kpi" data-status={status} onClick={onClick} role="button" tabIndex={0}>
      <div className="kpi-accent"/>
      <div className="kpi-label">
        <span>{label}</span>
        {hint && <span className="info-dot" title={hint}><Icon name="alert" size={11}/></span>}
      </div>
      <div className="kpi-value">
        {typeof value === "number" ? (Number.isInteger(value) ? value.toLocaleString() : value.toFixed(1)) : value}
        {unit && <span className="unit">{unit}</span>}
      </div>
      <div className="kpi-meta">
        {trend && <span className="kpi-trend" data-dir={dir}>{dirSym} {trend}</span>}
        {target != null && <span className="muted">Target {target}{unit === "%" ? "%" : ""}</span>}
      </div>
      {spark && <Sparkline data={spark} color={sparkColor || (
        status === "critical" ? "var(--critical)" :
        status === "watch"    ? "var(--watch)"    :
        status === "ok"       ? "var(--ok)"       : "var(--valentia-slate)"
      )} h={28}/>}
    </div>
  );
};

// ---------- Severity Badge ----------
const Sev = ({ tone = "neutral", children, dot = true }) => (
  <span className={`sev sev-${tone}`}>
    {dot && <span className="dot"/>}
    {children}
  </span>
);

// ---------- Priority pill ----------
const Prio = ({ p }) => {
  const map = {
    P1: { tone: "critical", label: "P1" },
    P2: { tone: "watch",    label: "P2" },
    P3: { tone: "info",     label: "P3" },
    P4: { tone: "neutral",  label: "P4" },
  };
  const c = map[p] || map.P4;
  return <Sev tone={c.tone} dot={false}>{c.label}</Sev>;
};

// ---------- Status pipeline ----------
const Pipeline = ({ steps, current }) => (
  <div className="pipe">
    {steps.map((s, i) => {
      const state = i < current ? "done" : i === current ? "active" : "todo";
      return <div key={i} className="pipe-step" data-state={state}>{s}</div>;
    })}
  </div>
);

// ---------- Filter Chip ----------
const Chip = ({ children, active, count, onClick, removable, onRemove, icon }) => (
  <button className="chip" data-active={active} onClick={onClick}>
    {icon && <Icon name={icon} size={13}/>}
    {children}
    {count != null && <span className="count">{count}</span>}
    {removable && (
      <span className="x" onClick={(e) => { e.stopPropagation(); onRemove?.(); }}>
        <Icon name="x" size={11}/>
      </span>
    )}
  </button>
);

// ---------- Toggle group ----------
const ToggleGroup = ({ value, onChange, options }) => (
  <div className="chip-toggle-group">
    {options.map(o => (
      <button key={o.value} data-active={value === o.value} onClick={() => onChange(o.value)}>{o.label}</button>
    ))}
  </div>
);

// ---------- Freshness ----------
const Freshness = ({ asOf = "2 min ago", stale = false }) => (
  <span className="fresh" data-stale={stale}>
    <span className="pulse"/>
    {stale ? "Snapshot " : "Live · "}{asOf}
  </span>
);

// ---------- Avatar ----------
const Avatar = ({ initials, name, sm }) => (
  <span className={"avatar" + (sm ? " avatar-sm" : "")} title={name}
    style={{background: pickAvatarColor(name)}}>
    {initials}
  </span>
);
function pickAvatarColor(name = "") {
  const palette = ["#005776", "#289BA2", "#143700", "#B26A00", "#5A6C66", "#7A4E2D"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return palette[Math.abs(h) % palette.length];
}

// ---------- Stat ----------
const Stat = ({ label, value, unit, tone, mono = true }) => (
  <div className="vstack" style={{gap: 2}}>
    <div className="text-xs muted">{label}</div>
    <div style={{
      fontFamily: mono ? "var(--font-mono)" : "var(--font-sans)",
      fontSize: 16, fontWeight: 600,
      color: tone === "critical" ? "var(--critical)" : tone === "watch" ? "var(--watch)" : tone === "ok" ? "var(--ok)" : "var(--ink-strong)"
    }}>
      {value}{unit && <span style={{fontSize: 12, color: "var(--ink-3)", marginLeft: 2}}>{unit}</span>}
    </div>
  </div>
);

// ---------- Alert strip ----------
const AlertStrip = ({ tone = "critical", icon = "alert", children, action }) => (
  <div className="alert-strip" data-tone={tone}>
    <Icon name={icon} size={18} className="alert-icon"/>
    <div className="alert-body">{children}</div>
    {action}
  </div>
);

// ---------- Empty state ----------
const Empty = ({ title, sub, icon = "inbox", action }) => (
  <div className="empty">
    <div className="empty-icon"><Icon name={icon} size={20}/></div>
    <div style={{fontWeight: 600, color: "var(--ink)"}}>{title}</div>
    {sub && <div className="text-sm">{sub}</div>}
    {action}
  </div>
);

// ---------- Section header ----------
const SectionHead = ({ eyebrow, title, sub, right }) => (
  <div className="hstack between" style={{marginBottom: 12}}>
    <div className="vstack" style={{gap: 2}}>
      {eyebrow && <div className="section-eyebrow">{eyebrow}</div>}
      <h3 className="section-title">{title}</h3>
      {sub && <div className="text-sm muted">{sub}</div>}
    </div>
    {right && <div className="hstack gap-2">{right}</div>}
  </div>
);

// ---------- Page header ----------
const PageHeader = ({ eyebrow, title, sub, right }) => (
  <div className="hstack between" style={{marginBottom: 16, flexWrap: "wrap", gap: 12}}>
    <div className="vstack" style={{gap: 2}}>
      {eyebrow && <div className="page-eyebrow">{eyebrow}</div>}
      <h1 className="page-title">{title}</h1>
      {sub && <p className="page-sub">{sub}</p>}
    </div>
    {right && <div className="hstack gap-2">{right}</div>}
  </div>
);

// ---------- Bar chart (horizontal) ----------
const HBar = ({ data, valueKey = "value", labelKey = "label", colorKey = "color", max, unit = "", showShare = false, mono = true }) => {
  const m = max || Math.max(...data.map(d => d[valueKey]));
  return (
    <div className="vstack" style={{gap: 8}}>
      {data.map((d, i) => {
        const w = (d[valueKey] / m) * 100;
        const color = d[colorKey] || "var(--chart-1)";
        return (
          <div key={i} className="hstack" style={{gap: 10}}>
            <div style={{flex: "0 0 130px", fontSize: 12, color: "var(--ink-2)"}}>{d[labelKey]}</div>
            <div style={{flex: 1, position: "relative"}}>
              <div style={{height: 14, borderRadius: 3, background: "var(--surface-sunken)", overflow: "hidden"}}>
                <div style={{
                  width: `${w}%`, height: "100%",
                  background: color,
                  transition: "width 480ms var(--ease-out)"
                }}/>
              </div>
            </div>
            <div className={mono ? "text-mono" : ""} style={{flex: "0 0 70px", textAlign: "right", fontSize: 12, color: "var(--ink-strong)", fontWeight: 600}}>
              {typeof d[valueKey] === "number" ? d[valueKey].toLocaleString() : d[valueKey]}{unit}
            </div>
            {showShare && d.share != null && (
              <div className="text-mono" style={{flex: "0 0 50px", textAlign: "right", fontSize: 11, color: "var(--ink-3)"}}>
                {d.share}%
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ---------- Donut ----------
const Donut = ({ data, size = 140, thickness = 18, valueKey = "value" }) => {
  const total = data.reduce((s, d) => s + d[valueKey], 0) || 1;
  const r = size / 2 - thickness / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--surface-sunken)" strokeWidth={thickness}/>
      {data.map((d, i) => {
        const len = (d[valueKey] / total) * c;
        const off = c - acc;
        acc += len;
        return (
          <circle key={i} cx={size/2} cy={size/2} r={r}
            fill="none" stroke={d.color} strokeWidth={thickness}
            strokeDasharray={`${len} ${c - len}`}
            strokeDashoffset={off}
            transform={`rotate(-90 ${size/2} ${size/2})`}
            style={{transition: "stroke-dasharray 480ms var(--ease-out)"}}/>
        );
      })}
    </svg>
  );
};

// ---------- Line chart (multi-series) ----------
const LineChart = ({ series, w = 600, h = 200, padding = {t:10, r:12, b:24, l:36}, yMin, yMax, xLabels, fmt = (v) => v, threshold }) => {
  const innerW = w - padding.l - padding.r;
  const innerH = h - padding.t - padding.b;
  const all = series.flatMap(s => s.data);
  const min = yMin ?? Math.min(...all);
  const max = yMax ?? Math.max(...all);
  const range = (max - min) || 1;
  const xLen = series[0].data.length;
  const x = i => padding.l + (i / (xLen - 1)) * innerW;
  const y = v => padding.t + innerH - ((v - min) / range) * innerH;

  const yTicks = 4;
  const ticks = Array.from({length: yTicks + 1}, (_, i) => min + (range * i / yTicks));

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="chart-svg">
      {/* gridlines */}
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={padding.l} x2={w - padding.r} y1={y(t)} y2={y(t)} stroke="var(--border-1)" strokeDasharray={i === 0 ? "" : "2 3"}/>
          <text x={padding.l - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fontFamily="var(--font-mono)" fill="var(--ink-3)">{fmt(t)}</text>
        </g>
      ))}
      {/* threshold */}
      {threshold != null && (
        <g>
          <line x1={padding.l} x2={w - padding.r} y1={y(threshold)} y2={y(threshold)} stroke="var(--watch)" strokeWidth="1.2" strokeDasharray="4 4"/>
          <text x={w - padding.r - 4} y={y(threshold) - 4} textAnchor="end" fontSize="10" fontFamily="var(--font-mono)" fill="var(--watch)">target {fmt(threshold)}</text>
        </g>
      )}
      {/* x labels */}
      {xLabels && xLabels.map((lbl, i) => (
        <text key={i} x={x(i)} y={h - 6} textAnchor="middle" fontSize="10" fontFamily="var(--font-mono)" fill="var(--ink-3)">{lbl}</text>
      ))}
      {/* series */}
      {series.map((s, si) => {
        const path = s.data.map((v, i) => (i === 0 ? "M" : "L") + x(i).toFixed(1) + " " + y(v).toFixed(1)).join(" ");
        return (
          <g key={si}>
            <path d={path} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
            {s.data.map((v, i) => (
              <circle key={i} cx={x(i)} cy={y(v)} r="2.5" fill={s.color}/>
            ))}
          </g>
        );
      })}
    </svg>
  );
};

// ---------- Heat cell (availability) ----------
const HeatGrid = ({ rows, cols, matrix, rowLabels, colLabels }) => {
  const colorFor = (v) => {
    if (v >= 95) return "var(--ok)";
    if (v >= 80) return "color-mix(in srgb, var(--ok) 50%, var(--watch))";
    if (v >= 50) return "var(--watch)";
    if (v >= 20) return "color-mix(in srgb, var(--watch) 40%, var(--critical))";
    return "var(--critical)";
  };
  return (
    <div style={{display: "grid", gridTemplateColumns: `60px repeat(${cols}, 1fr)`, gap: 1}}>
      <div/>
      {colLabels.map((c, i) => (
        <div key={i} className="text-mono text-xs muted" style={{textAlign: "center", padding: "2px 0"}}>{c}</div>
      ))}
      {matrix.map((row, ri) => (
        <React.Fragment key={ri}>
          <div className="text-mono text-xs muted" style={{textAlign: "right", padding: "2px 6px"}}>{rowLabels[ri]}</div>
          {row.map((v, ci) => (
            <div key={ci} title={`${rowLabels[ri]} ${colLabels[ci]}: ${v}%`}
              style={{
                aspectRatio: "1", borderRadius: 2,
                background: v >= 95 ? "var(--ok-bg)" : v >= 80 ? "color-mix(in srgb, var(--watch-bg) 70%, var(--ok-bg))" : v >= 50 ? "var(--watch-bg)" : "var(--critical-bg)",
                border: `1px solid ${v >= 95 ? "var(--ok-border)" : v >= 50 ? "var(--watch-border)" : "var(--critical-border)"}`,
                opacity: v >= 95 ? 0.55 : 1,
                position: "relative",
              }}>
              {v < 50 && (
                <div style={{position: "absolute", inset: 1, background: colorFor(v), borderRadius: 1, opacity: (50 - v) / 50}}/>
              )}
            </div>
          ))}
        </React.Fragment>
      ))}
    </div>
  );
};

// ---------- Backlog age × priority matrix ----------
const BacklogMatrix = ({ ages, priorities, matrix }) => {
  const max = Math.max(...matrix.flat());
  const colorFor = (v, prio) => {
    const intensity = Math.max(0.10, v / max);
    let base = "var(--valentia-slate)";
    if (prio === "P1 Emergency") base = "var(--critical)";
    else if (prio === "P2 High") base = "var(--watch)";
    else if (prio === "P3 Medium") base = "var(--valentia-slate)";
    else base = "var(--ink-3)";
    return `color-mix(in srgb, ${base} ${(intensity * 90).toFixed(0)}%, white)`;
  };
  return (
    <div style={{display: "grid", gridTemplateColumns: `120px repeat(${ages.length}, 1fr)`, gap: 4, fontSize: 12}}>
      <div/>
      {ages.map((a, i) => <div key={i} className="text-mono text-xs muted" style={{textAlign: "center"}}>{a}</div>)}
      {priorities.map((p, ri) => (
        <React.Fragment key={ri}>
          <div className="text-xs" style={{display: "flex", alignItems: "center", color: "var(--ink-2)", fontWeight: 500}}>{p}</div>
          {matrix[ri].map((v, ci) => (
            <div key={ci}
              style={{
                background: colorFor(v, p),
                borderRadius: 4,
                padding: "10px 6px",
                textAlign: "center",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                fontWeight: 600,
                color: v / max > 0.5 ? "#fff" : "var(--ink)",
                cursor: "pointer",
              }}>
              {v}
            </div>
          ))}
        </React.Fragment>
      ))}
    </div>
  );
};

// ---------- Searchable dropdown (mock) ----------
const Select = ({ value, options, onChange, icon, placeholder, width = 160 }) => {
  return (
    <div className="hstack" style={{
      width, height: 30, padding: "0 10px",
      background: "var(--surface-panel)",
      border: "1px solid var(--border-2)",
      borderRadius: 6, gap: 6, color: "var(--ink-2)", fontSize: 12, fontWeight: 500,
      cursor: "pointer"
    }}>
      {icon && <Icon name={icon} size={13}/>}
      <span style={{flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}>
        {options?.find(o => o.value === value)?.label || placeholder}
      </span>
      <Icon name="chevD" size={13}/>
    </div>
  );
};

// ---------- Tabs ----------
const Tabs = ({ value, onChange, tabs }) => (
  <div className="tabs">
    {tabs.map(t => (
      <button key={t.value} className="tab" aria-selected={value === t.value} onClick={() => onChange(t.value)}>
        {t.label}
        {t.count != null && <span className="pip">{t.count}</span>}
      </button>
    ))}
  </div>
);

// expose globally
Object.assign(window, {
  Sparkline, KPICard, Sev, Prio, Pipeline, Chip, ToggleGroup,
  Freshness, Avatar, Stat, AlertStrip, Empty, SectionHead, PageHeader,
  HBar, Donut, LineChart, HeatGrid, BacklogMatrix, Select, Tabs,
});
