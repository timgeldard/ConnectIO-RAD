/* Reusable visual primitives — icons, badges, range bar, stack bar. */

const Icon = ({ name, size = 14, stroke = 1.75 }) => {
  const props = {
    width: size, height: size, viewBox: "0 0 24 24",
    fill: "none", stroke: "currentColor", strokeWidth: stroke,
    strokeLinecap: "round", strokeLinejoin: "round",
    className: "ic",
  };
  switch (name) {
    case "play":     return <svg {...props}><polygon points="6 4 20 12 6 20 6 4"/></svg>;
    case "pause":    return <svg {...props}><rect x="6" y="5" width="4" height="14"/><rect x="14" y="5" width="4" height="14"/></svg>;
    case "check":    return <svg {...props}><polyline points="20 6 9 17 4 12"/></svg>;
    case "x":        return <svg {...props}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
    case "alert":    return <svg {...props}><path d="M12 9v4M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/></svg>;
    case "info":     return <svg {...props}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>;
    case "spark":    return <svg {...props}><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2 2M16.4 16.4l2 2M5.6 18.4l2-2M16.4 7.6l2-2"/></svg>;
    case "down":     return <svg {...props}><polyline points="6 9 12 15 18 9"/></svg>;
    case "right":    return <svg {...props}><polyline points="9 18 15 12 9 6"/></svg>;
    case "compare":  return <svg {...props}><path d="M16 3h5v5"/><path d="M8 21H3v-5"/><path d="M21 3 13 11"/><path d="M3 21l8-8"/></svg>;
    case "lock":     return <svg {...props}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>;
    case "search":   return <svg {...props}><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;
    case "filter":   return <svg {...props}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>;
    case "zap":      return <svg {...props}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>;
    case "shield":   return <svg {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
    case "user":     return <svg {...props}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
    case "history":  return <svg {...props}><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/></svg>;
    case "hex":      return <svg {...props}><polygon points="12 2 21 7 21 17 12 22 3 17 3 7 12 2"/></svg>;
    case "flask":    return <svg {...props}><path d="M9 2v6L4 18a2 2 0 0 0 1.7 3h12.6A2 2 0 0 0 20 18L15 8V2"/><line x1="9" y1="2" x2="15" y2="2"/></svg>;
    case "globe":    return <svg {...props}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15 15 0 0 1 0 20a15 15 0 0 1 0-20"/></svg>;
    default: return null;
  }
};

const Badge = ({ kind = "ghost", children, dot = false }) => (
  <span className={`badge b-${kind}`}>
    {dot ? <span className="dot" /> : null}
    {children}
  </span>
);

const StatusBadge = ({ status }) => {
  const map = {
    feasible:    { kind: "success", label: "Feasible" },
    binding:     { kind: "warn",    label: "Binding" },
    infeasible:  { kind: "error",   label: "Infeasible" },
    tight:       { kind: "warn",    label: "Tight" },
    optimal:     { kind: "innovation", label: "Optimal" },
    ready:       { kind: "info",    label: "Ready to optimise" },
    high:        { kind: "error",   label: "High" },
    med:         { kind: "warn",    label: "Med" },
    low:         { kind: "ghost",   label: "Low" },
    preferred:   { kind: "info",    label: "Preferred" },
    "high-act":  { kind: "warn",    label: "High activity" },
    weak:        { kind: "ghost",   label: "Weak — skip" },
    fresh:       { kind: "success", label: "Fresh" },
  };
  const m = map[status] || { kind: "ghost", label: status };
  return <Badge kind={m.kind} dot>{m.label}</Badge>;
};

/* RangeBar — central constraint visualisation
 * Shows: min/max bounds (allowed band), target band, current marker, optimised marker.
 * x = a numeric value in [axisMin..axisMax]
 */
const RangeBar = ({ c, showHandles = false, onChange }) => {
  const span = c.axisMax - c.axisMin;
  const pct  = (v) => ((v - c.axisMin) / span) * 100;
  const allowedL = pct(c.min);
  const allowedW = pct(c.max) - allowedL;
  // Target band — narrow window around target (±2% of span as a soft band)
  const tGap = span * 0.02;
  const tL = pct(Math.max(c.min, c.target - tGap));
  const tW = pct(Math.min(c.max, c.target + tGap)) - tL;

  const ref = React.useRef(null);
  const dragRef = React.useRef(null);

  const valueAtX = (clientX) => {
    const r = ref.current.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - r.left, 0), r.width);
    return c.axisMin + (x / r.width) * span;
  };

  const onDown = (which) => (e) => {
    if (!showHandles || !onChange) return;
    e.preventDefault();
    dragRef.current = which;
    const move = (ev) => {
      const v = valueAtX(ev.clientX);
      onChange(which, +v.toFixed(c.unit === "µm" ? 0 : 1));
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  return (
    <div className="range" ref={ref}>
      <div className="axis" />
      <div className="allowed" style={{ left: `${allowedL}%`, width: `${allowedW}%` }} />
      <div className="target"  style={{ left: `${tL}%`, width: `${Math.max(tW, 1.4)}%` }} />
      <div className="ticks">
        <span>{c.axisMin}</span><span>{c.axisMax}</span>
      </div>
      {showHandles ? (
        <>
          <div className="range-handle" style={{ left: `${pct(c.min)}%` }} onMouseDown={onDown("min")} title={`Min: ${c.min}`} />
          <div className="range-handle" style={{ left: `${pct(c.max)}%` }} onMouseDown={onDown("max")} title={`Max: ${c.max}`} />
        </>
      ) : null}
      {c.current != null ? (
        <div className="marker" style={{ left: `${pct(c.current)}%` }}>
          <span className="lab" style={{ color: "var(--fg-muted)", bottom: "-13px" }}>
            now {c.current}
          </span>
        </div>
      ) : null}
      {c.optimised != null ? (
        <div className="marker opt" style={{ left: `${pct(c.optimised)}%` }}>
          <span className="lab" style={{ color: "var(--forest)", fontWeight: 700, top: "-14px", bottom: "auto" }}>
            opt {c.optimised}
          </span>
        </div>
      ) : null}
    </div>
  );
};

/* StackBar — recipe composition (component %) */
const PALETTE = ["#005776", "#289BA2", "#44CF93", "#F9C20A", "#F24A00", "#143700", "#FFC2B3"];
const StackBar = ({ items }) => {
  const total = items.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div>
      <div className="stack-bar">
        {items.map((it, i) => {
          const pct = (it.value / total) * 100;
          if (pct < 0.5) return null;
          return (
            <div key={i} className="stack-seg"
                 style={{ width: `${pct}%`, background: it.color || PALETTE[i % PALETTE.length], color: it.textColor || "#fff" }}
                 title={`${it.label}: ${it.value}`}>
              {pct > 8 ? `${pct.toFixed(0)}%` : ""}
            </div>
          );
        })}
      </div>
      <div className="stack-legend">
        {items.map((it, i) => (
          <div key={i} className="item">
            <span className="sw" style={{ background: it.color || PALETTE[i % PALETTE.length] }} />
            <span style={{ flex: 1 }}>{it.label}</span>
            <span className="num muted" style={{ fontSize: 11 }}>{it.value} kg</span>
          </div>
        ))}
      </div>
    </div>
  );
};

Object.assign(window, { Icon, Badge, StatusBadge, RangeBar, StackBar, PALETTE });
