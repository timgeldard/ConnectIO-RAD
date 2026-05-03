// =====================================================================
// PEX-E-35 — Main app: grid + drilldown + filters + tweaks
// =====================================================================
const { useState, useMemo, useEffect, useRef } = React;

// Tweakable defaults — written by host via __edit_mode_set_keys
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "density": "operational",
  "statusVisual": "pills",
  "showGantt": true,
  "showExceptionBar": true,
  "darkMode": false,
  "exceptionFirstSort": true
}/*EDITMODE-END*/;

// =====================================================================
// Status visual primitives
// =====================================================================

const TONE_BG = {
  neutral: { bg: "#EDEDE2", fg: "#143700", dot: "#A5A595" },
  info:    { bg: "#CCDDE9", fg: "#003B52", dot: "#005776" },
  success: { bg: "#C7F0DC", fg: "#0F4A2D", dot: "#2BA46C" },
  muted:   { bg: "#E6E6D8", fg: "#3D5230", dot: "#7A8E6A" },
  danger:  { bg: "#FFD1C1", fg: "#7A2300", dot: "#F24A00" },
  warn:    { bg: "#FEE89C", fg: "#5A3208", dot: "#F9C20A" },
};

function StatusPill({ status, dense, variant = "filled" }) {
  const t = TONE_BG[status.tone] || TONE_BG.neutral;
  if (variant === "dot") {
    return (
      <span className="pex-pill-dot" style={{ color: "var(--forest)" }}>
        <span className="pex-dot" style={{ background: t.dot }} />
        {status.label}
      </span>
    );
  }
  return (
    <span className={"pex-pill " + (dense ? "dense " : "") + "tone-" + status.tone}
          style={{ background: t.bg, color: t.fg }}>
      {status.label}
    </span>
  );
}

// Mini-gantt: planned window vs actual progress, anchored to NOW
function MiniGantt({ row, viewStart, viewEnd }) {
  const W = 200;
  const ps = new Date(row.plannedStart).getTime();
  const pf = new Date(row.plannedFinish).getTime();
  const as = row.actualStart ? new Date(row.actualStart).getTime() : null;
  const af = row.actualFinish ? new Date(row.actualFinish).getTime() : null;
  const range = viewEnd - viewStart;
  const x = (t) => Math.max(0, Math.min(W, ((t - viewStart) / range) * W));
  const nowX = x(window.PEX_NOW);
  const px1 = x(ps), px2 = x(pf);
  let actualBar = null;
  if (as) {
    const ax1 = x(as);
    const ax2 = af ? x(af) : Math.min(nowX, x(ps + (pf - ps) * (row.progress || 0)));
    actualBar = { x1: ax1, x2: Math.max(ax1 + 2, ax2) };
  }
  const lateFinish = row.exec.id === "RUNNING" && pf < window.PEX_NOW;
  const lateStart  = row.exec.id === "NOT_STARTED" && ps < window.PEX_NOW;

  const actualColor = lateFinish ? "#F24A00" : (row.exec.id === "COMPLETED" || row.exec.id === "TECH_COMPLETE" ? "#2BA46C" : "#005776");

  return (
    <svg width={W} height="22" className="pex-gantt" aria-hidden="true">
      {/* now line */}
      <line x1={nowX} x2={nowX} y1="0" y2="22" stroke="#143700" strokeOpacity="0.35" strokeDasharray="2 2" strokeWidth="1" />
      {/* planned window */}
      <rect x={px1} y="6" width={Math.max(2, px2 - px1)} height="10"
            fill="none" stroke={lateStart ? "#F24A00" : "#143700"} strokeOpacity={lateStart ? 0.85 : 0.35} strokeWidth="1" rx="2" />
      {/* actual bar */}
      {actualBar && (
        <rect x={actualBar.x1} y="8" width={Math.max(2, actualBar.x2 - actualBar.x1)} height="6"
              fill={actualColor} rx="1" />
      )}
      {/* late-start tick */}
      {lateStart && <circle cx={px1} cy="11" r="3" fill="#F24A00" />}
      {/* late-finish tick */}
      {lateFinish && <circle cx={px2} cy="11" r="3" fill="#F24A00" />}
    </svg>
  );
}

// Exception icons cluster
function FlagCluster({ flags }) {
  if (!flags.length) return <span className="pex-flag-empty">—</span>;
  const top = flags.slice(0, 3);
  return (
    <span className="pex-flags">
      {top.map((f) => (
        <span key={f.id} className={"pex-flag sev-" + f.sev} title={f.label}>
          {flagGlyph(f.id)}
        </span>
      ))}
      {flags.length > 3 && <span className="pex-flag-more">+{flags.length - 3}</span>}
    </span>
  );
}
function flagGlyph(id) {
  const map = {
    LATE_START:    "◐",
    LATE_FINISH:   "◑",
    RUN_NO_STAGING:"⚠",
    RUN_PARTIAL:   "◆",
    READY_IDLE:    "○",
    LOG_LAG:       "↻",
    NON_MAT_BLOCK: "⛌",
    MAT_RISK:      "▲",
  };
  return map[id] || "•";
}

// Material readiness micro-bar
function ReadinessBar({ pct }) {
  const c = pct >= 0.95 ? "#2BA46C" : pct >= 0.7 ? "#F9C20A" : "#F24A00";
  return (
    <div className="pex-readiness" title={`Material readiness ${Math.round(pct * 100)}%`}>
      <div className="pex-readiness-fill" style={{ width: (pct * 100) + "%", background: c }} />
    </div>
  );
}

// =====================================================================
// Filter bar
// =====================================================================
function FilterBar({ filters, setFilters, counts, total, search, setSearch }) {
  const FilterChipGroup = ({ label, value, options, onChange, allLabel = "All" }) => (
    <div className="pex-chipgroup">
      <span className="pex-chipgroup-label">{label}</span>
      <button className={"pex-chip " + (value === null ? "active" : "")} onClick={() => onChange(null)}>{allLabel}</button>
      {options.map((opt) => (
        <button key={opt.id} className={"pex-chip " + (value === opt.id ? "active" : "")} onClick={() => onChange(opt.id)}>
          {opt.label}
          {opt.count !== undefined && <span className="pex-chip-count">{opt.count}</span>}
        </button>
      ))}
    </div>
  );

  const execOpts = Object.values(window.PEX_EXEC).map((e) => ({ id: e.id, label: e.label, count: counts.exec[e.id] || 0 }));
  const stgOpts = Object.values(window.PEX_STAGING).map((s) => ({ id: s.id, label: s.label, count: counts.staging[s.id] || 0 }));
  const plantOpts = window.PEX_PLANTS.map((p) => ({ id: p, label: p.split(" · ")[0], count: counts.plant[p] || 0 }));

  return (
    <div className="pex-filterbar">
      <div className="pex-filterbar-row">
        <div className="pex-search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search order, material, line…" />
        </div>
        <FilterChipGroup label="Plant" value={filters.plant} options={plantOpts} onChange={(v) => setFilters({ ...filters, plant: v })} />
      </div>
      <div className="pex-filterbar-row">
        <FilterChipGroup label="Execution" value={filters.exec} options={execOpts} onChange={(v) => setFilters({ ...filters, exec: v })} />
      </div>
      <div className="pex-filterbar-row">
        <FilterChipGroup label="Staging" value={filters.staging} options={stgOpts} onChange={(v) => setFilters({ ...filters, staging: v })} />
        <div className="pex-filterbar-spacer" />
        <button className={"pex-chip toggle " + (filters.exceptionsOnly ? "active" : "")}
                onClick={() => setFilters({ ...filters, exceptionsOnly: !filters.exceptionsOnly })}>
          ⚠ Exceptions only
        </button>
      </div>
    </div>
  );
}

// =====================================================================
// Exception summary bar (top)
// =====================================================================
function ExceptionBar({ rows, onFilter }) {
  const buckets = [
    { id: "RUN_NO_STAGING", label: "Running · no staging", desc: "Active risk" },
    { id: "LATE_FINISH",    label: "Late finish",          desc: "Past planned end" },
    { id: "LATE_START",     label: "Late start",           desc: "Past planned start" },
    { id: "NON_MAT_BLOCK",  label: "Blocked · materials ready", desc: "Investigate non-material cause" },
    { id: "RUN_PARTIAL",    label: "Running · partial staging", desc: "Material readiness risk" },
    { id: "LOG_LAG",        label: "Logistics lag",        desc: "Done · TR still open" },
    { id: "READY_IDLE",     label: "Ready but idle",       desc: "Staged · not started" },
  ];
  const counts = {};
  rows.forEach((r) => r.flags.forEach((f) => { counts[f.id] = (counts[f.id] || 0) + 1; }));

  const totalExcept = rows.filter((r) => r.flags.length > 0).length;

  return (
    <div className="pex-exception-bar">
      <div className="pex-exc-headline">
        <span className="pex-exc-headline-num">{totalExcept}</span>
        <span className="pex-exc-headline-lbl">orders need attention<br/><em>of {rows.length} on screen</em></span>
      </div>
      <div className="pex-exc-grid">
        {buckets.map((b) => (
          <button key={b.id} className={"pex-exc-card " + ((counts[b.id] || 0) > 0 ? "has" : "empty")}
                  onClick={() => onFilter && counts[b.id] && onFilter(b.id)}
                  disabled={!counts[b.id]}>
            <div className="pex-exc-num">{counts[b.id] || 0}</div>
            <div className="pex-exc-lbl">{b.label}</div>
            <div className="pex-exc-desc">{b.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// =====================================================================
// The grid
// =====================================================================
function OrderGrid({ rows, density, statusVisual, showGantt, onSelect, selectedId, viewStart, viewEnd, sort, setSort }) {
  const SortHead = ({ col, children, align = "left" }) => (
    <th className={"sortable align-" + align + " " + (sort.col === col ? "active" : "")}
        onClick={() => setSort({ col, dir: sort.col === col && sort.dir === "asc" ? "desc" : "asc" })}>
      <span>{children}</span>
      {sort.col === col && <span className="sort-arrow">{sort.dir === "asc" ? "▲" : "▼"}</span>}
    </th>
  );

  return (
    <div className={"pex-grid-wrap density-" + density}>
      <table className="pex-grid">
        <thead>
          <tr>
            <th className="col-flag"></th>
            <SortHead col="orderId">Process Order</SortHead>
            <SortHead col="material">Material</SortHead>
            <SortHead col="line">Line</SortHead>
            <SortHead col="plannedStart">Planned Start</SortHead>
            {showGantt && <th className="col-gantt">Plan vs Actual</th>}
            <SortHead col="exec">Execution</SortHead>
            <SortHead col="staging">Staging</SortHead>
            <th className="col-readiness">Materials</th>
            <th className="col-flags">Flags</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.orderId}
                className={"pex-row " + (selectedId === r.orderId ? "selected " : "") + (r.flags.length ? "has-flags " : "") + (r.riskScore >= 4 ? "high-risk" : "")}
                onClick={() => onSelect(r)}>
              <td className="col-flag">
                {r.riskScore >= 4 && <span className="risk-bar critical" />}
                {r.riskScore >= 2 && r.riskScore < 4 && <span className="risk-bar warn" />}
                {r.riskScore === 1 && <span className="risk-bar low" />}
              </td>
              <td className="col-order">
                <div className="order-id">{r.orderId}</div>
                <div className="order-meta">{r.qty.toLocaleString()} {r.uom}</div>
              </td>
              <td className="col-material">
                <div className="mat-name">{r.materialName}</div>
                <div className="mat-id">{r.materialId}</div>
              </td>
              <td className="col-line">
                <div className="line-name">{r.line}</div>
                <div className="plant-name">{r.plant.split(" · ")[0]}</div>
              </td>
              <td className="col-time">
                <div className="time-clock">{window.pexFmtClock(r.plannedStart)}</div>
                <div className={"time-rel " + (new Date(r.plannedStart).getTime() < window.PEX_NOW ? "past" : "future")}>
                  {window.pexFmtRel(r.plannedStart)}
                </div>
              </td>
              {showGantt && (
                <td className="col-gantt">
                  <MiniGantt row={r} viewStart={viewStart} viewEnd={viewEnd} />
                </td>
              )}
              <td className="col-exec">
                <StatusPill status={r.exec} dense={density==="dense"} variant={statusVisual} />
              </td>
              <td className="col-staging">
                <StatusPill status={r.staging} dense={density==="dense"} variant={statusVisual} />
              </td>
              <td className="col-readiness">
                <ReadinessBar pct={r.matReadiness} />
                <span className="readiness-pct">{Math.round(r.matReadiness * 100)}%</span>
              </td>
              <td className="col-flags">
                <FlagCluster flags={r.flags} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <div className="pex-empty">No orders match the current filters.</div>}
    </div>
  );
}

// =====================================================================
// Drilldown side panel
// =====================================================================
function Drilldown({ row, onClose }) {
  const [tab, setTab] = useState("overview");
  if (!row) return null;
  return (
    <div className="pex-drill-overlay" onClick={onClose}>
      <aside className="pex-drill" onClick={(e) => e.stopPropagation()}>
        <header className="pex-drill-head">
          <div>
            <div className="pex-drill-eyebrow">Process Order</div>
            <div className="pex-drill-title">{row.orderId}</div>
            <div className="pex-drill-sub">{row.materialName} · {row.qty.toLocaleString()} {row.uom}</div>
          </div>
          <button className="pex-drill-close" onClick={onClose} aria-label="Close">×</button>
        </header>

        <div className="pex-drill-status-row">
          <div className="status-block">
            <div className="status-label">Execution</div>
            <StatusPill status={row.exec} variant="filled" />
          </div>
          <div className="status-block">
            <div className="status-label">Staging</div>
            <StatusPill status={row.staging} variant="filled" />
          </div>
          <div className="status-block">
            <div className="status-label">Risk</div>
            <div className={"risk-score risk-" + (row.riskScore >= 4 ? "high" : row.riskScore >= 2 ? "med" : row.riskScore > 0 ? "low" : "none")}>
              {row.riskScore === 0 ? "None" : row.riskScore >= 4 ? "Critical" : row.riskScore >= 2 ? "Elevated" : "Low"}
            </div>
          </div>
        </div>

        {row.flags.length > 0 && (
          <div className="pex-drill-flags">
            <div className="pex-drill-section-title">Why this order is flagged</div>
            <ul>
              {row.flags.map((f) => (
                <li key={f.id} className={"flag-row sev-" + f.sev}>
                  <span className="flag-glyph">{flagGlyph(f.id)}</span>
                  <span className="flag-label">{f.label}</span>
                  <span className="flag-explain">{flagExplain(f.id, row)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <nav className="pex-drill-tabs">
          {["overview", "execution", "materials", "links"].map((t) => (
            <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>
              {tabLabel(t)}
            </button>
          ))}
        </nav>

        <div className="pex-drill-body">
          {tab === "overview"   && <DrillOverview row={row} />}
          {tab === "execution"  && <DrillExecution row={row} />}
          {tab === "materials"  && <DrillMaterials row={row} />}
          {tab === "links"      && <DrillLinks row={row} />}
        </div>
      </aside>
    </div>
  );
}

const tabLabel = (t) => ({ overview: "Overview", execution: "Execution", materials: "Materials & Staging", links: "SAP Links" }[t]);

function flagExplain(id, row) {
  const map = {
    LATE_START: "Planned start passed; order has not begun.",
    LATE_FINISH: "Order is running past its planned finish.",
    RUN_NO_STAGING: "Running but no transfer requirement was created. Active material risk.",
    RUN_PARTIAL: "Running on incomplete picks. Materials may not last the run.",
    READY_IDLE: "Components are at the line but the order has not started.",
    LOG_LAG: "Order is complete but the transfer requirement is still open.",
    NON_MAT_BLOCK: row.nonMaterialBlock || "Materials are ready — block is non-material (equipment, QC, etc).",
    MAT_RISK: "Issued quantity is materially below required.",
  };
  return map[id] || "";
}

// ----- Tab: Overview -----
function DrillOverview({ row }) {
  const ps = new Date(row.plannedStart).getTime();
  const pf = new Date(row.plannedFinish).getTime();
  const dur = (pf - ps) / window.PEX_HOUR;
  return (
    <>
      <section className="drill-section">
        <h4>Header</h4>
        <dl className="drill-dl">
          <dt>Plant</dt><dd>{row.plant}</dd>
          <dt>Line</dt><dd>{row.line}</dd>
          <dt>Material</dt><dd>{row.materialName} <span className="muted">({row.materialId})</span></dd>
          <dt>Family</dt><dd>{row.materialFamily}</dd>
          <dt>Quantity</dt><dd className="mono">{row.qty.toLocaleString()} {row.uom}</dd>
          <dt>Operator</dt><dd>{row.operator}</dd>
          <dt>Order type</dt><dd>{row.orderType}</dd>
        </dl>
      </section>
      <section className="drill-section">
        <h4>Planned vs Actual</h4>
        <TimelineDetail row={row} />
        <dl className="drill-dl">
          <dt>Planned start</dt>  <dd className="mono">{window.pexFmtClock(row.plannedStart)} · {window.pexFmtRel(row.plannedStart)}</dd>
          <dt>Planned finish</dt> <dd className="mono">{window.pexFmtClock(row.plannedFinish)} · {window.pexFmtRel(row.plannedFinish)}</dd>
          <dt>Planned duration</dt><dd className="mono">{dur.toFixed(1)}h</dd>
          <dt>Actual start</dt>   <dd className="mono">{row.actualStart ? `${window.pexFmtClock(row.actualStart)} · ${window.pexFmtRel(row.actualStart)}` : "—"}</dd>
          <dt>Actual finish</dt>  <dd className="mono">{row.actualFinish ? `${window.pexFmtClock(row.actualFinish)} · ${window.pexFmtRel(row.actualFinish)}` : "—"}</dd>
        </dl>
      </section>
    </>
  );
}

function TimelineDetail({ row }) {
  const ps = new Date(row.plannedStart).getTime();
  const pf = new Date(row.plannedFinish).getTime();
  const span = pf - ps;
  // pad view by 25%
  const viewStart = ps - span * 0.25;
  const viewEnd = pf + span * 0.25;
  const W = 460, H = 64;
  const range = viewEnd - viewStart;
  const x = (t) => Math.max(0, Math.min(W, ((t - viewStart) / range) * W));
  const nowX = x(window.PEX_NOW);
  const as = row.actualStart ? new Date(row.actualStart).getTime() : null;
  const af = row.actualFinish ? new Date(row.actualFinish).getTime() :
             as ? Math.min(window.PEX_NOW, ps + span * (row.progress || 0)) : null;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="drill-timeline">
      {/* axis */}
      <line x1="0" x2={W} y1={H-12} y2={H-12} stroke="#143700" strokeOpacity="0.25" strokeWidth="1" />
      {/* now */}
      {nowX >= 0 && nowX <= W && (
        <>
          <line x1={nowX} x2={nowX} y1="0" y2={H} stroke="#143700" strokeOpacity="0.5" strokeDasharray="2 3" />
          <text x={nowX + 4} y="10" fontSize="10" fill="#143700" fontFamily="IBM Plex Mono">NOW</text>
        </>
      )}
      {/* planned */}
      <rect x={x(ps)} y="22" width={Math.max(2, x(pf) - x(ps))} height="16" fill="none" stroke="#143700" strokeOpacity="0.6" rx="2" />
      <text x={x(ps)} y="50" fontSize="10" fill="#143700" fillOpacity="0.7" fontFamily="IBM Plex Mono">Planned</text>
      {/* actual */}
      {as && (
        <rect x={x(as)} y="26" width={Math.max(2, x(af) - x(as))} height="8"
              fill={pf < window.PEX_NOW && !row.actualFinish ? "#F24A00" : (row.exec.id === "COMPLETED" ? "#2BA46C" : "#005776")} rx="1" />
      )}
      {as && <text x={x(as)} y="20" fontSize="10" fill="#005776" fontFamily="IBM Plex Mono">Actual</text>}
    </svg>
  );
}

// ----- Tab: Execution -----
function DrillExecution({ row }) {
  return (
    <>
      <section className="drill-section">
        <h4>Current phase</h4>
        <div className="phase-ladder">
          {["NOT_STARTED","RUNNING","COMPLETED","TECH_COMPLETE"].map((id, i) => {
            const labels = { NOT_STARTED: "Not Started", RUNNING: "Running", COMPLETED: "Completed", TECH_COMPLETE: "Tech. Complete" };
            const reachedOrder = ["NOT_STARTED","RUNNING","COMPLETED","TECH_COMPLETE"];
            const ix = reachedOrder.indexOf(row.exec.id);
            const reached = i <= (row.exec.id === "BLOCKED" ? 0 : ix);
            const current = (row.exec.id === reachedOrder[i]) || (row.exec.id === "BLOCKED" && i === 0);
            return (
              <div key={id} className={"phase " + (reached ? "reached " : "") + (current ? "current " : "") + (row.exec.id === "BLOCKED" && current ? "blocked" : "")}>
                <div className="phase-dot" />
                <div className="phase-label">{labels[id]}</div>
              </div>
            );
          })}
        </div>
        {row.exec.id === "BLOCKED" && (
          <div className="phase-block">
            <span className="block-tag">Blocked</span>
            <span>{row.nonMaterialBlock || "Investigate cause."}</span>
          </div>
        )}
      </section>
      <section className="drill-section">
        <h4>Progress</h4>
        <div className="progress-detail">
          <div className="progress-bar"><div className="progress-fill" style={{ width: ((row.progress || 0) * 100) + "%" }} /></div>
          <div className="progress-meta">
            <span className="mono">{Math.round((row.progress || 0) * 100)}% complete</span>
            <span className="muted">{row.actualStart ? `Started ${window.pexFmtRel(row.actualStart)}` : "Not started"}</span>
          </div>
        </div>
      </section>
    </>
  );
}

// ----- Tab: Materials -----
function DrillMaterials({ row }) {
  const stagingPath = ["TR Created", "Pick Complete", "Staged to Line"];
  return (
    <>
      <section className="drill-section">
        <h4>Component readiness</h4>
        <table className="drill-comp-table">
          <thead>
            <tr><th>Component</th><th>Required</th><th>Issued</th><th>Stage state</th><th>Readiness</th></tr>
          </thead>
          <tbody>
            {row.components.map((c) => {
              const stage = !c.stagingRequired ? "Not required" :
                            c.stagedToLine ? "Staged to Line" :
                            c.pickComplete ? "Pick Complete" :
                            c.trCreated ? "TR Created" : "Required · No TR";
              const pct = c.stagingRequired ? Math.min(1, c.issued / Math.max(1, c.required)) : 1;
              return (
                <tr key={c.id}>
                  <td>
                    <div className="comp-name">{c.name}</div>
                    <div className="comp-id">{c.id}</div>
                  </td>
                  <td className="mono">{c.stagingRequired ? `${c.required} ${c.uom}` : "—"}</td>
                  <td className="mono">{c.stagingRequired ? `${c.issued} ${c.uom}` : "—"}</td>
                  <td>
                    <span className={"comp-stage stage-" + (c.stagedToLine ? "ok" : c.pickComplete ? "warn" : c.trCreated ? "warn2" : c.stagingRequired ? "danger" : "muted")}>
                      {stage}
                    </span>
                  </td>
                  <td><ReadinessBar pct={pct} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      <section className="drill-section">
        <h4>Staging breakdown</h4>
        <div className="staging-flow">
          {stagingPath.map((step, i) => {
            const required = row.components.filter((c) => c.stagingRequired);
            const reached = required.length === 0 ? false :
              i === 0 ? required.every((c) => c.trCreated) :
              i === 1 ? required.every((c) => c.pickComplete) :
              required.every((c) => c.stagedToLine);
            return (
              <div key={step} className={"staging-step " + (reached ? "reached" : "")}>
                <div className="step-num">{i + 1}</div>
                <div className="step-label">{step}</div>
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}

// ----- Tab: Links -----
function DrillLinks({ row }) {
  return (
    <section className="drill-section">
      <h4>Open in SAP (read-only fallback)</h4>
      <div className="sap-links">
        <a className="sap-link" onClick={(e) => e.preventDefault()} href="#">
          <div className="sap-link-tx">COR3</div>
          <div className="sap-link-desc">Display Process Order · {row.orderId}</div>
          <div className="sap-link-arrow">↗</div>
        </a>
        <a className="sap-link" onClick={(e) => e.preventDefault()} href="#">
          <div className="sap-link-tx">COOISPI</div>
          <div className="sap-link-desc">Legacy order list (fallback)</div>
          <div className="sap-link-arrow">↗</div>
        </a>
        <a className="sap-link" onClick={(e) => e.preventDefault()} href="#">
          <div className="sap-link-tx">LB10</div>
          <div className="sap-link-desc">Transfer requirements for {row.orderId}</div>
          <div className="sap-link-arrow">↗</div>
        </a>
      </div>
      <div className="sap-note">
        Links open in SAP GUI. PEX-E-35 is read-only — all transactions remain in SAP.
      </div>
    </section>
  );
}

// =====================================================================
// Top app shell
// =====================================================================
function App() {
  const [tweaks, setTweak] = window.useTweaks(TWEAK_DEFAULTS);
  const [filters, setFilters] = useState({ plant: null, exec: null, staging: null, exceptionsOnly: false });
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState({ col: "risk", dir: "desc" });
  const [selected, setSelected] = useState(null);

  const allRows = window.PEX_DATASET;

  // Apply filters & search
  const filtered = useMemo(() => {
    return allRows.filter((r) => {
      if (filters.plant && r.plant !== filters.plant) return false;
      if (filters.exec && r.exec.id !== filters.exec) return false;
      if (filters.staging && r.staging.id !== filters.staging) return false;
      if (filters.exceptionsOnly && r.flags.length === 0) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!(r.orderId.includes(q) || r.materialName.toLowerCase().includes(q) ||
              r.materialId.toLowerCase().includes(q) || r.line.toLowerCase().includes(q))) return false;
      }
      return true;
    });
  }, [allRows, filters, search]);

  // Sort
  const sorted = useMemo(() => {
    const arr = [...filtered];
    const cmp = (a, b) => {
      let av, bv;
      switch (sort.col) {
        case "orderId":      av = a.orderId; bv = b.orderId; break;
        case "material":     av = a.materialName; bv = b.materialName; break;
        case "line":         av = a.line; bv = b.line; break;
        case "plannedStart": av = new Date(a.plannedStart).getTime(); bv = new Date(b.plannedStart).getTime(); break;
        case "exec":         av = a.exec.label; bv = b.exec.label; break;
        case "staging":      av = a.staging.label; bv = b.staging.label; break;
        case "risk":         av = a.riskScore; bv = b.riskScore; break;
        default:             av = 0; bv = 0;
      }
      if (av < bv) return sort.dir === "asc" ? -1 : 1;
      if (av > bv) return sort.dir === "asc" ? 1 : -1;
      return 0;
    };
    arr.sort(cmp);
    // Always pin highest-risk to top if exceptionFirstSort enabled
    if (tweaks.exceptionFirstSort && sort.col !== "risk") {
      arr.sort((a, b) => b.riskScore - a.riskScore || cmp(a, b));
    } else if (sort.col === "risk") {
      // already by risk
    }
    return arr;
  }, [filtered, sort, tweaks.exceptionFirstSort]);

  // Compute counts (unfiltered, for chip badges)
  const counts = useMemo(() => {
    const c = { exec: {}, staging: {}, plant: {} };
    allRows.forEach((r) => {
      c.exec[r.exec.id] = (c.exec[r.exec.id] || 0) + 1;
      c.staging[r.staging.id] = (c.staging[r.staging.id] || 0) + 1;
      c.plant[r.plant] = (c.plant[r.plant] || 0) + 1;
    });
    return c;
  }, [allRows]);

  // Gantt window: 12h before NOW to 16h after NOW
  const viewStart = window.PEX_NOW - 10 * window.PEX_HOUR;
  const viewEnd = window.PEX_NOW + 14 * window.PEX_HOUR;

  // Quick filter from exception bar
  const filterByFlag = (flagId) => {
    setSearch("");
    if (flagId === "RUN_NO_STAGING") setFilters({ ...filters, exec: "RUNNING", staging: "REQUIRED_NOT_CREATED", exceptionsOnly: true });
    else if (flagId === "LATE_FINISH") setFilters({ plant: filters.plant, exec: "RUNNING", staging: null, exceptionsOnly: true });
    else if (flagId === "LATE_START") setFilters({ plant: filters.plant, exec: "NOT_STARTED", staging: null, exceptionsOnly: true });
    else if (flagId === "NON_MAT_BLOCK") setFilters({ plant: filters.plant, exec: "BLOCKED", staging: null, exceptionsOnly: false });
    else setFilters({ ...filters, exceptionsOnly: true });
  };

  return (
    <div className={"pex-app " + (tweaks.darkMode ? "dark " : "") + "density-" + tweaks.density}>
      <header className="pex-topbar">
        <div className="pex-brand">
          <img src="kerry/kerry-k-icon-slate.png" alt="" className="pex-brand-icon" />
          <div>
            <div className="pex-brand-product">PEX-E-35</div>
            <div className="pex-brand-sub">Process Order Execution &amp; Staging Review</div>
          </div>
        </div>
        <div className="pex-topbar-meta">
          <div className="pex-clock">
            <span className="t-eyebrow">As of</span>
            <span className="mono">{window.pexFmtClock(new Date(window.PEX_NOW).toISOString())}</span>
          </div>
          <div className="pex-userchip">
            <div className="user-avatar">SC</div>
            <div>
              <div className="user-name">Sam Costigan</div>
              <div className="user-role">Process Controller · Beloit</div>
            </div>
          </div>
        </div>
      </header>

      {tweaks.showExceptionBar && (
        <ExceptionBar rows={allRows} onFilter={filterByFlag} />
      )}

      <FilterBar filters={filters} setFilters={setFilters} counts={counts}
                 total={sorted.length} search={search} setSearch={setSearch} />

      <div className="pex-result-meta">
        <span><strong>{sorted.length}</strong> of {allRows.length} orders</span>
        <span className="dot-sep">·</span>
        <span>{sorted.filter((r) => r.flags.length).length} flagged</span>
        <span className="dot-sep">·</span>
        <span>Sort: <strong>{tweaks.exceptionFirstSort && sort.col !== "risk" ? "Risk first, then " + sort.col : sort.col}</strong> {sort.dir === "asc" ? "↑" : "↓"}</span>
      </div>

      <OrderGrid
        rows={sorted}
        density={tweaks.density}
        statusVisual={tweaks.statusVisual}
        showGantt={tweaks.showGantt}
        viewStart={viewStart} viewEnd={viewEnd}
        onSelect={setSelected}
        selectedId={selected?.orderId}
        sort={sort} setSort={setSort}
      />

      <Drilldown row={selected} onClose={() => setSelected(null)} />

      <window.TweaksPanel title="Tweaks">
        <window.TweakSection title="Layout">
          <window.TweakRadio label="Density" value={tweaks.density} onChange={(v) => setTweak("density", v)}
                             options={[
                               { value: "comfortable", label: "Comfortable" },
                               { value: "operational", label: "Operational" },
                               { value: "dense",       label: "Dense" },
                             ]} />
          <window.TweakRadio label="Status visual" value={tweaks.statusVisual} onChange={(v) => setTweak("statusVisual", v)}
                             options={[
                               { value: "filled", label: "Filled pills" },
                               { value: "dot",    label: "Dot + label" },
                             ]} />
          <window.TweakToggle label="Show plan-vs-actual gantt"   value={tweaks.showGantt} onChange={(v) => setTweak("showGantt", v)} />
          <window.TweakToggle label="Show exception summary bar" value={tweaks.showExceptionBar} onChange={(v) => setTweak("showExceptionBar", v)} />
        </window.TweakSection>
        <window.TweakSection title="Behaviour">
          <window.TweakToggle label="Pin high-risk to top of any sort" value={tweaks.exceptionFirstSort} onChange={(v) => setTweak("exceptionFirstSort", v)} />
          <window.TweakToggle label="Dark mode (control-room)" value={tweaks.darkMode} onChange={(v) => setTweak("darkMode", v)} />
        </window.TweakSection>
      </window.TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
