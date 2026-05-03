/* Panels 1–3 of the Lineside Monitor.
   Now Running supports MULTIPLE concurrent process orders per line. */

function fmtMin(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${m.toString().padStart(2, "0")}m`;
}

function StatusPill({ kind, children }) {
  return (
    <span className={`lsm-pill ${kind}`}>
      <span className="dot"></span>
      {children}
    </span>
  );
}

function StagingBadge({ status }) {
  if (status === "staged")  return <StatusPill kind="ok">Staged to Line</StatusPill>;
  if (status === "pick")    return <StatusPill kind="warn">Pick Complete</StatusPill>;
  if (status === "tr")      return <StatusPill kind="warn">TR Created</StatusPill>;
  if (status === "none")    return <StatusPill kind="danger">Not Ready</StatusPill>;
  return <StatusPill kind="idle">Not Required</StatusPill>;
}

function ProgressBar({ pct, tone = "ok" }) {
  const fillColor =
    tone === "warn"   ? "var(--sunrise)" :
    tone === "danger" ? "var(--sunset)"  :
                        "var(--valentia-slate)";
  return (
    <div style={{ width: "100%", height: 14, background: "rgba(20,55,0,0.08)", borderRadius: 999, overflow: "hidden", position: "relative" }}>
      <div style={{ width: `${pct}%`, height: "100%", background: fillColor, borderRadius: 999, transition: "width 1s var(--ease-out)", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)", animation: "lsm-shimmer 2.4s linear infinite" }} />
      </div>
      <style>{`@keyframes lsm-shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }`}</style>
    </div>
  );
}

function projectFinish(o) {
  const remaining = Math.round((100 - o.pctComplete) / Math.max(o.pctComplete, 1) * o.elapsedMin);
  return fmtMin(remaining) + " remaining";
}

function KV({ label, value, small }) {
  return (
    <div className="lsm-col" style={{ gap: 4 }}>
      <div className="lsm-eye muted" style={{ fontSize: small ? 10 : 12 }}>{label}</div>
      <div style={{ fontFamily: "var(--font-sans)", fontWeight: 500, fontSize: small ? 16 : 22, color: "var(--forest)" }}>{value}</div>
    </div>
  );
}

function BigStat({ label, value, accent, small }) {
  return (
    <div className="lsm-col" style={{ gap: 6 }}>
      <div className="lsm-eye muted">{label}</div>
      <div className="lsm-mono" style={{ fontSize: small ? 28 : 56, fontWeight: 500, color: accent ? "var(--valentia-slate)" : "var(--forest)", lineHeight: 1 }}>{value}</div>
    </div>
  );
}

/* ===== PANEL 1 — Now Running =====
   Flattens all running orders across selected lines and lays them out.
   1 order  → hero treatment
   2 orders → split 50/50 (works for 1 line × 2 concurrent orders, OR 2 lines × 1)
   3-4      → 2x2 grid
*/

function PanelNowRunning({ lines }) {
  const cards = [];
  lines.forEach(line => {
    line.runningOrders.forEach(o => cards.push({ line, order: o }));
  });
  const idleLines = lines.filter(l => l.runningOrders.length === 0);

  if (cards.length === 0) {
    return (
      <div className="lsm-col" style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16 }}>
        <div style={{ fontFamily: "var(--font-impact)", fontWeight: 800, textTransform: "uppercase", fontSize: 88, color: "var(--fg-muted)" }}>No Active Execution</div>
        <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 22, color: "var(--fg-muted)" }}>All selected lines are between orders.</div>
      </div>
    );
  }

  if (cards.length === 1 && idleLines.length === 0) {
    return <NowRunningHero line={cards[0].line} order={cards[0].order} />;
  }

  const cols = cards.length === 2 ? 2 : 2;
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 20, flex: 1, minHeight: 0 }}>
      {cards.map((c, i) => (
        <NowRunningTile key={c.order.id} line={c.line} order={c.order} compact={cards.length > 2} multi={c.line.runningOrders.length > 1} />
      ))}
      {idleLines.map(line => (
        <div key={line.id} className="lsm-col" style={{ background: "var(--stone)", borderRadius: 12, padding: 24, gap: 12, justifyContent: "center", alignItems: "flex-start", border: "1px dashed rgba(20,55,0,0.18)" }}>
          <div className="lsm-eye muted">{line.name}</div>
          <div style={{ fontFamily: "var(--font-impact)", textTransform: "uppercase", fontWeight: 800, fontSize: 32, color: "var(--fg-muted)" }}>No Active Execution</div>
        </div>
      ))}
    </div>
  );
}

function NowRunningHero({ line, order }) {
  return (
    <div className="lsm-col" style={{ flex: 1, gap: 28 }}>
      <div className="lsm-row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div className="lsm-col" style={{ gap: 8 }}>
          <div className="lsm-eye">{line.name} · Order {order.id}</div>
          <div style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 64, lineHeight: 1.05, letterSpacing: "-0.015em", color: "var(--forest)", maxWidth: 1200 }}>{order.product}</div>
          <div className="lsm-mono" style={{ fontSize: 16, color: "var(--fg-muted)", marginTop: 8 }}>{order.material} &nbsp;·&nbsp; Batch {order.batch}</div>
        </div>
        <StatusPill kind="ok">Running</StatusPill>
      </div>
      <div className="lsm-col" style={{ gap: 16, marginTop: 8 }}>
        <div className="lsm-row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums", fontSize: 132, fontWeight: 500, color: "var(--valentia-slate)", lineHeight: 1, letterSpacing: "-0.01em" }}>
            {order.pctComplete}<span style={{ fontSize: 56, color: "var(--fg-muted)" }}>%</span>
          </div>
          <div className="lsm-col" style={{ alignItems: "flex-end", gap: 4 }}>
            <div className="lsm-eye muted">Elapsed / Planned</div>
            <div className="lsm-mono" style={{ fontSize: 40, fontWeight: 500, color: "var(--forest)" }}>
              {fmtMin(order.elapsedMin)} <span style={{ color: "var(--fg-muted)" }}>/ {fmtMin(order.plannedMin)}</span>
            </div>
          </div>
        </div>
        <ProgressBar pct={order.pctComplete} />
        <div className="lsm-row" style={{ gap: 32, marginTop: 4 }}>
          <KV label="Phase"            value={order.phaseLabel} />
          <KV label="Activity"         value={order.activityType} />
          <KV label="Time in phase"    value={fmtMin(order.phaseStartedMin)} />
          <KV label="Projected finish" value={projectFinish(order)} />
        </div>
      </div>
    </div>
  );
}

function NowRunningTile({ line, order, compact, multi }) {
  return (
    <div className="lsm-col" style={{
      background: "var(--stone)",
      borderRadius: 12,
      padding: compact ? 22 : 28,
      gap: 14,
      border: "1px solid rgba(20,55,0,0.06)",
      minHeight: 0,
      borderLeft: multi ? "4px solid var(--valentia-slate)" : "1px solid rgba(20,55,0,0.06)",
    }}>
      <div className="lsm-row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
        <div className="lsm-col" style={{ gap: 4 }}>
          <div className="lsm-eye">{line.name}{multi ? " · concurrent" : ""}</div>
          <div className="lsm-mono" style={{ fontSize: 12, color: "var(--fg-muted)" }}>{order.id} · Batch {order.batch}</div>
        </div>
        <StatusPill kind="ok">Running</StatusPill>
      </div>
      <div style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: compact ? 26 : 32, lineHeight: 1.1, letterSpacing: "-0.01em", color: "var(--forest)" }}>
        {order.product}
      </div>
      <div className="lsm-row" style={{ justifyContent: "space-between", alignItems: "baseline", marginTop: 4 }}>
        <div className="lsm-mono" style={{ fontSize: compact ? 56 : 72, fontWeight: 500, color: "var(--valentia-slate)", lineHeight: 1 }}>
          {order.pctComplete}<span style={{ fontSize: compact ? 24 : 32, color: "var(--fg-muted)" }}>%</span>
        </div>
        <div className="lsm-mono" style={{ fontSize: 14, color: "var(--fg-muted)" }}>
          {fmtMin(order.elapsedMin)} / {fmtMin(order.plannedMin)}
        </div>
      </div>
      <ProgressBar pct={order.pctComplete} />
      <div className="lsm-row" style={{ gap: 20, marginTop: 6 }}>
        <KV small label="Phase"    value={order.phaseLabel} />
        <KV small label="Activity" value={order.activityType} />
      </div>
    </div>
  );
}

/* ===== PANEL 2 — Current Activity ===== */

function PanelActivity({ lines }) {
  const cards = [];
  lines.forEach(line => line.runningOrders.forEach(o => cards.push({ line, order: o })));

  if (cards.length === 0) {
    return (
      <div className="lsm-col" style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16 }}>
        <div className="lsm-hex" style={{ color: "var(--fg-muted)", width: 80 }}></div>
        <div style={{ fontFamily: "var(--font-impact)", fontWeight: 800, textTransform: "uppercase", fontSize: 56, color: "var(--fg-muted)" }}>No Active Execution</div>
        <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 22, color: "var(--fg-muted)" }}>All lines are between orders.</div>
      </div>
    );
  }

  if (cards.length === 1) {
    const { line, order: o } = cards[0];
    return (
      <div className="lsm-col" style={{ flex: 1, gap: 36, justifyContent: "space-between" }}>
        <div className="lsm-col" style={{ gap: 16 }}>
          <div className="lsm-eye">{line.name} · Order {o.id}</div>
          <div className="lsm-row" style={{ alignItems: "center", gap: 24 }}>
            <ActivityIcon type={o.activityType} />
            <div style={{ fontFamily: "var(--font-impact)", fontWeight: 800, textTransform: "uppercase", fontSize: 124, lineHeight: 0.95, letterSpacing: "-0.01em", color: "var(--forest)" }}>
              {o.phaseLabel}
            </div>
          </div>
          <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 26, color: "var(--fg-muted)", maxWidth: 1100 }}>
            On {o.product} — currently in the {o.activityType.toLowerCase()} phase.
          </div>
        </div>
        <div className="lsm-row" style={{ gap: 56, alignItems: "flex-end" }}>
          <BigStat label="Time in phase"    value={fmtMin(o.phaseStartedMin)} />
          <BigStat label="Activity type"    value={o.activityType} />
          <BigStat label="Order progress"   value={`${o.pctComplete}%`} accent />
          <div className="lsm-grow" />
          <StatusPill kind="ok">Running</StatusPill>
        </div>
      </div>
    );
  }

  const cols = cards.length === 2 ? 2 : 2;
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 20, flex: 1, minHeight: 0 }}>
      {cards.map(({ line, order: o }) => (
        <div key={o.id} className="lsm-col" style={{
          background: "var(--stone)", borderRadius: 12, padding: 28, gap: 16,
          border: "1px solid rgba(20,55,0,0.06)",
          borderLeft: line.runningOrders.length > 1 ? "4px solid var(--valentia-slate)" : "1px solid rgba(20,55,0,0.06)",
        }}>
          <div className="lsm-eye">{line.name} · {o.id}</div>
          <div className="lsm-row" style={{ alignItems: "center", gap: 16 }}>
            <ActivityIcon type={o.activityType} small />
            <div style={{ fontFamily: "var(--font-impact)", fontWeight: 800, textTransform: "uppercase", fontSize: 52, lineHeight: 1, color: "var(--forest)" }}>
              {o.phaseLabel}
            </div>
          </div>
          <div className="lsm-row" style={{ gap: 32, marginTop: 8 }}>
            <BigStat small label="Time in phase" value={fmtMin(o.phaseStartedMin)} />
            <BigStat small label="Type"          value={o.activityType} />
            <BigStat small label="Progress"      value={`${o.pctComplete}%`} accent />
          </div>
        </div>
      ))}
    </div>
  );
}

function ActivityIcon({ type, small }) {
  const size = small ? 44 : 88;
  if (type === "Clean") {
    return (<svg width={size} height={size} viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="none" stroke="var(--sage)" strokeWidth="8" /><circle cx="50" cy="50" r="14" fill="var(--sage)" /></svg>);
  }
  if (type === "Setup") {
    return (<svg width={size} height={size} viewBox="0 0 100 100"><polygon points="50,8 88,30 88,70 50,92 12,70 12,30" fill="none" stroke="var(--valentia-slate)" strokeWidth="8" strokeLinejoin="round"/></svg>);
  }
  return (<svg width={size} height={size} viewBox="0 0 100 100"><circle cx="50" cy="50" r="38" fill="var(--valentia-slate)" /><polygon points="42,32 70,50 42,68" fill="var(--white)" /></svg>);
}

/* ===== PANEL 3 — What's Next ===== */

function PanelWhatsNext({ lines }) {
  const allNext = [];
  lines.forEach(line => line.nextOrders.forEach(o => allNext.push({ ...o, line: line.name })));
  allNext.sort((a, b) => a.plannedStart.localeCompare(b.plannedStart));
  const top = allNext.slice(0, 5);

  return (
    <div className="lsm-col" style={{ flex: 1, gap: 16 }}>
      <div className="lsm-row" style={{ gap: 28, padding: "0 8px 8px 8px", borderBottom: "1px solid rgba(20,55,0,0.10)" }}>
        <div className="lsm-eye muted" style={{ width: 110 }}>Planned</div>
        <div className="lsm-eye muted" style={{ flex: 1 }}>Order &amp; Product</div>
        <div className="lsm-eye muted" style={{ width: 220 }}>Line</div>
        <div className="lsm-eye muted" style={{ width: 220, textAlign: "right" }}>Staging</div>
      </div>
      <div className="lsm-col" style={{ flex: 1, gap: 8 }}>
        {top.map((o, i) => (
          <div key={o.id} className="lsm-row" style={{
            gap: 28, padding: "20px 8px",
            borderBottom: i < top.length - 1 ? "1px solid rgba(20,55,0,0.06)" : "none",
            alignItems: "center",
          }}>
            <div className="lsm-mono" style={{ width: 110, fontSize: 32, fontWeight: 500, color: i === 0 ? "var(--valentia-slate)" : "var(--forest)", fontVariantNumeric: "tabular-nums" }}>
              {o.plannedStart}
            </div>
            <div className="lsm-col" style={{ flex: 1, gap: 4 }}>
              <div style={{ fontFamily: "var(--font-sans)", fontWeight: 600, fontSize: 26, color: "var(--forest)", lineHeight: 1.15 }}>{o.product}</div>
              <div className="lsm-mono" style={{ fontSize: 13, color: "var(--fg-muted)" }}>{o.id} · {o.material}</div>
            </div>
            <div style={{ width: 220, fontFamily: "var(--font-sans)", fontWeight: 500, fontSize: 16, color: "var(--forest)" }}>{o.line}</div>
            <div style={{ width: 220, display: "flex", justifyContent: "flex-end" }}><StagingBadge status={o.staging} /></div>
          </div>
        ))}
        {top.length === 0 && (
          <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 22, color: "var(--fg-muted)", padding: 24 }}>
            No upcoming orders for the selected line(s).
          </div>
        )}
      </div>
    </div>
  );
}

Object.assign(window, {
  PanelNowRunning, PanelActivity, PanelWhatsNext,
  StatusPill, StagingBadge, ProgressBar, fmtMin, KV, BigStat
});
