/* Panels 4–6 of the Lineside Monitor.
   Blocked / At Risk, Staging Readiness, Plan vs Actual. */

const { useMemo: useMemo46 } = React;

/* ===== Block-type icon vocabulary ===== */

function BlockIcon({ type, size = 64 }) {
  const stroke = type === "late" ? "var(--sunset)" :
                 type === "material" ? "var(--sunset)" :
                 type === "staging"  ? "var(--sunrise)" :
                                       "var(--fg-muted)";
  const common = { width: size, height: size, viewBox: "0 0 100 100", fill: "none", stroke, strokeWidth: 6, strokeLinecap: "round", strokeLinejoin: "round" };
  if (type === "material") {
    // Bricks — material missing
    return (
      <svg {...common}>
        <rect x="14" y="22" width="72" height="56" rx="4"/>
        <line x1="14" y1="40" x2="86" y2="40"/>
        <line x1="14" y1="60" x2="86" y2="60"/>
        <line x1="40" y1="22" x2="40" y2="40"/>
        <line x1="60" y1="40" x2="60" y2="60"/>
        <line x1="38" y1="60" x2="38" y2="78"/>
        <line x1="64" y1="60" x2="64" y2="78"/>
      </svg>
    );
  }
  if (type === "staging") {
    // Pallet
    return (
      <svg {...common}>
        <rect x="20" y="22" width="60" height="38" rx="3"/>
        <line x1="20" y1="42" x2="80" y2="42"/>
        <rect x="14" y="64" width="72" height="10" rx="2"/>
        <line x1="30" y1="74" x2="30" y2="84"/>
        <line x1="50" y1="74" x2="50" y2="84"/>
        <line x1="70" y1="74" x2="70" y2="84"/>
      </svg>
    );
  }
  if (type === "late") {
    // Clock
    return (
      <svg {...common}>
        <circle cx="50" cy="52" r="34"/>
        <polyline points="50,32 50,52 66,62"/>
        <line x1="50" y1="14" x2="50" y2="22"/>
      </svg>
    );
  }
  // other / gear
  return (
    <svg {...common}>
      <circle cx="50" cy="50" r="14"/>
      <path d="M50 18 L50 30 M50 70 L50 82 M18 50 L30 50 M70 50 L82 50 M28 28 L36 36 M64 64 L72 72 M28 72 L36 64 M64 36 L72 28"/>
    </svg>
  );
}

function blockTypeLabel(t) {
  return ({ material: "Material", staging: "Staging", late: "Late", other: "Other" })[t] || "Issue";
}

/* ===== PANEL 4 — Blocked / At Risk ===== */

function PanelBlocked({ lines }) {
  const all = [];
  lines.forEach(l => {
    l.blocked.forEach(b => all.push({ ...b, severity: "blocked" }));
    l.atRisk.forEach(b => all.push({ ...b, severity: "risk" }));
  });
  all.sort((a, b) => b.blockedMin - a.blockedMin);

  if (all.length === 0) {
    return (
      <div className="lsm-col" style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16 }}>
        <div style={{ fontFamily: "var(--font-impact)", fontWeight: 800, textTransform: "uppercase", fontSize: 88, color: "var(--fg-muted)" }}>
          Nothing Blocked
        </div>
        <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 24, color: "var(--fg-muted)" }}>
          All running orders are on track.
        </div>
      </div>
    );
  }

  return (
    <div className="lsm-col" style={{ flex: 1, gap: 18 }}>
      {all.map((b, i) => (
        <div key={i} className="lsm-row" style={{
          gap: 28,
          padding: "26px 28px",
          background: b.severity === "blocked" ? "rgba(242,74,0,0.06)" : "rgba(249,194,10,0.08)",
          border: `2px solid ${b.severity === "blocked" ? "var(--sunset)" : "var(--sunrise)"}`,
          borderRadius: 12,
          alignItems: "center",
        }}>
          <BlockIcon type={b.type} size={72} />
          <div className="lsm-col" style={{ flex: 1, gap: 8 }}>
            <div className="lsm-row" style={{ gap: 14, alignItems: "center" }}>
              <span className="lsm-mono" style={{ fontSize: 14, color: "var(--fg-muted)" }}>{b.id}</span>
              <span className="lsm-mono" style={{ fontSize: 14, color: "var(--fg-muted)" }}>·</span>
              <span className="lsm-mono" style={{ fontSize: 14, color: "var(--fg-muted)" }}>{b.line}</span>
              <StatusPill kind={b.severity === "blocked" ? "danger" : "warn"}>
                {b.severity === "blocked" ? "Blocked" : "At Risk"} · {blockTypeLabel(b.type)}
              </StatusPill>
            </div>
            <div style={{
              fontFamily: "var(--font-sans)",
              fontWeight: 600,
              fontSize: 30,
              lineHeight: 1.2,
              color: "var(--forest)",
              letterSpacing: "-0.005em",
            }}>
              {b.reason}
            </div>
          </div>
          <div className="lsm-col" style={{ alignItems: "flex-end", gap: 4, minWidth: 200 }}>
            <div className="lsm-eye muted">Duration</div>
            <div className="lsm-mono" style={{
              fontSize: 56,
              fontWeight: 500,
              color: b.severity === "blocked" ? "var(--sunset)" : "var(--sunrise)",
              lineHeight: 1,
              fontVariantNumeric: "tabular-nums",
            }}>
              {fmtMin(b.blockedMin)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ===== PANEL 5 — Staging Readiness ===== */

function PanelStaging({ staging }) {
  const segments = [
    { key: "staged",       label: "Staged to Line",       value: staging.staged,        tone: "ok" },
    { key: "pickComplete", label: "Pick Complete",         value: staging.pickComplete,  tone: "ok-warn" },
    { key: "trCreated",    label: "TR Created",            value: staging.trCreated,     tone: "warn" },
    { key: "noTR",         label: "Required · No TR",      value: staging.noTR,          tone: "danger" },
    { key: "notRequired",  label: "Not Required",          value: staging.notRequired,   tone: "idle" },
  ];
  const total = segments.reduce((a, s) => a + s.value, 0);

  const toneColor = (t) =>
    t === "ok"      ? "var(--jade)" :
    t === "ok-warn" ? "var(--sage)" :
    t === "warn"    ? "var(--sunrise)" :
    t === "danger"  ? "var(--sunset)" :
                      "rgba(20,55,0,0.18)";

  return (
    <div className="lsm-col" style={{ flex: 1, gap: 32 }}>
      <div className="lsm-row" style={{ gap: 24, alignItems: "stretch", flex: 1 }}>
        {segments.map(s => (
          <div key={s.key} className="lsm-col" style={{
            flex: s.value || 1,
            background: "var(--stone)",
            borderRadius: 12,
            padding: 28,
            gap: 12,
            border: `1px solid rgba(20,55,0,0.06)`,
            position: "relative",
            overflow: "hidden",
          }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 6, background: toneColor(s.tone) }} />
            <div className="lsm-eye" style={{ color: toneColor(s.tone), opacity: s.tone === "idle" ? 0.6 : 1 }}>
              {s.label}
            </div>
            <div className="lsm-mono" style={{
              fontSize: 96,
              fontWeight: 500,
              color: "var(--forest)",
              lineHeight: 1,
              fontVariantNumeric: "tabular-nums",
            }}>
              {s.value}
            </div>
            <div className="lsm-mono" style={{ fontSize: 12, color: "var(--fg-muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              orders
            </div>
          </div>
        ))}
      </div>

      {/* Stacked bar */}
      <div className="lsm-col" style={{ gap: 10 }}>
        <div className="lsm-row" style={{ justifyContent: "space-between" }}>
          <div className="lsm-eye muted">Next 24 hours of production</div>
          <div className="lsm-mono" style={{ fontSize: 14, color: "var(--fg-muted)" }}>
            {total} orders total
          </div>
        </div>
        <div className="lsm-row" style={{ height: 22, borderRadius: 999, overflow: "hidden", background: "rgba(20,55,0,0.06)" }}>
          {segments.map(s => (
            <div key={s.key} style={{
              flex: s.value,
              background: toneColor(s.tone),
              opacity: s.tone === "idle" ? 0.35 : 1,
            }} title={`${s.label}: ${s.value}`} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ===== PANEL 6 — Plan vs Actual ===== */

function PanelPlanActual({ plan }) {
  const pctActual    = Math.round((plan.actualUnits / plan.plannedUnits) * 100);
  const pctElapsed   = plan.shiftPctElapsed;
  const variance     = plan.variancePct;
  const isBehind     = variance < 0;

  return (
    <div className="lsm-col" style={{ flex: 1, gap: 36 }}>
      <div className="lsm-row" style={{ gap: 56, alignItems: "flex-start" }}>
        {/* Big number */}
        <div className="lsm-col" style={{ gap: 8, flex: 1 }}>
          <div className="lsm-eye muted">Output this shift</div>
          <div className="lsm-row" style={{ alignItems: "baseline", gap: 16 }}>
            <div className="lsm-mono" style={{
              fontSize: 220,
              fontWeight: 500,
              color: "var(--valentia-slate)",
              lineHeight: 0.9,
              letterSpacing: "-0.02em",
              fontVariantNumeric: "tabular-nums",
            }}>
              {plan.actualUnits}
            </div>
            <div className="lsm-mono" style={{
              fontSize: 64,
              fontWeight: 400,
              color: "var(--fg-muted)",
              lineHeight: 0.9,
              fontVariantNumeric: "tabular-nums",
            }}>
              / {plan.plannedUnits}
            </div>
          </div>
          <div className="lsm-mono" style={{ fontSize: 14, color: "var(--fg-muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            orders completed / planned
          </div>
        </div>

        {/* Variance pill */}
        <div className="lsm-col" style={{ gap: 16, alignItems: "flex-end" }}>
          <div className="lsm-eye muted">Variance</div>
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 12,
            padding: "20px 32px",
            background: isBehind ? "rgba(249,194,10,0.18)" : "rgba(68,207,147,0.18)",
            border: `2px solid ${isBehind ? "var(--sunrise)" : "var(--jade)"}`,
            borderRadius: 16,
          }}>
            <span style={{ fontSize: 48, lineHeight: 1, color: isBehind ? "var(--sunrise)" : "var(--jade)" }}>
              {isBehind ? "▼" : "▲"}
            </span>
            <span className="lsm-mono" style={{
              fontSize: 80,
              fontWeight: 500,
              color: "var(--forest)",
              lineHeight: 1,
              fontVariantNumeric: "tabular-nums",
            }}>
              {Math.abs(variance)}%
            </span>
          </div>
          <div className="lsm-mono" style={{ fontSize: 14, color: "var(--fg-muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            {isBehind ? "Behind plan" : "Ahead of plan"}
          </div>
        </div>
      </div>

      {/* Dual progress bars */}
      <div className="lsm-col" style={{ gap: 22, marginTop: "auto" }}>
        <DualBar label="Shift elapsed"   pct={pctElapsed} color="var(--forest)" />
        <DualBar label="Output complete" pct={pctActual}  color="var(--valentia-slate)" />
      </div>
    </div>
  );
}

function DualBar({ label, pct, color }) {
  return (
    <div className="lsm-col" style={{ gap: 8 }}>
      <div className="lsm-row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <div className="lsm-eye muted">{label}</div>
        <div className="lsm-mono" style={{ fontSize: 28, fontWeight: 500, color: "var(--forest)", fontVariantNumeric: "tabular-nums" }}>
          {pct}%
        </div>
      </div>
      <div style={{ height: 18, background: "rgba(20,55,0,0.08)", borderRadius: 999, overflow: "hidden" }}>
        <div style={{
          width: `${pct}%`,
          height: "100%",
          background: color,
          borderRadius: 999,
          transition: "width 1s var(--ease-out)",
        }} />
      </div>
    </div>
  );
}

Object.assign(window, {
  PanelBlocked, PanelStaging, PanelPlanActual, BlockIcon
});
