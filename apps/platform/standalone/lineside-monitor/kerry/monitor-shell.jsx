/* Monitor shell — header, body, footer, rotation engine, config panel */

const { useState: useStateM, useEffect: useEffectM, useRef: useRefM } = React;

const PANEL_DEFS = [
  { id: "now",      num: "01", title: "Now Running",       question: "What is running right now?",                 component: "PanelNowRunning" },
  { id: "activity", num: "02", title: "Current Activity",  question: "What phase are we in?",                       component: "PanelActivity" },
  { id: "next",     num: "03", title: "What's Next",       question: "What will run next if nothing goes wrong?",   component: "PanelWhatsNext" },
  { id: "blocked",  num: "04", title: "Blocked / At Risk", question: "What is stopping progress?",                  component: "PanelBlocked" },
  { id: "staging",  num: "05", title: "Staging Readiness", question: "Are materials ready to support execution?",   component: "PanelStaging" },
  { id: "plan",     num: "06", title: "Plan vs Actual",    question: "Are we on track today?",                      component: "PanelPlanActual" },
];

/* Build a rotation sequence honoring "Blocked appears 2x as often" when
   the user has Blocked panel enabled and there are blocks/risks present. */
function buildSequence(enabledPanelIds, hasBlocks) {
  const enabled = PANEL_DEFS
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => enabledPanelIds.includes(p.id));

  if (enabled.length === 0) return [0];

  const blockedIdx = enabled.findIndex(({ p }) => p.id === "blocked");
  if (blockedIdx === -1 || !hasBlocks) {
    return enabled.map(({ i }) => i);
  }
  // Interleave blocked between every other panel
  const seq = [];
  enabled.forEach(({ p, i }, idx) => {
    if (p.id !== "blocked") {
      seq.push(i);
      seq.push(enabled[blockedIdx].i);
    }
  });
  return seq.length ? seq : enabled.map(({ i }) => i);
}

function useRotation(panelDuration, sequence) {
  const [stepIdx, setStepIdx] = useStateM(0);
  useEffectM(() => { setStepIdx(0); }, [sequence.join(",")]);
  useEffectM(() => {
    const t = setInterval(() => setStepIdx(i => (i + 1) % sequence.length), panelDuration);
    return () => clearInterval(t);
  }, [panelDuration, sequence.length]);
  return [sequence[stepIdx] ?? 0, stepIdx];
}

function useClock(seedTime) {
  const [now, setNow] = useStateM(() => {
    const [h, m] = seedTime.split(":").map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  });
  useEffectM(() => {
    const t = setInterval(() => setNow(prev => new Date(prev.getTime() + 60000)), 8000);
    return () => clearInterval(t);
  }, []);
  return now;
}
function fmtClock(d) { return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`; }

/* ===== Header ===== */

function MonitorHeader({ plant, shift, time, refreshSec, onConfig }) {
  return (
    <div className="lsm-header">
      <div className="lsm-header-left">
        <img src="kerry/assets/kerry-logo-white.png" alt="Kerry" className="lsm-logo" />
        <div className="lsm-divider-v" />
        <div className="lsm-system-label">
          <div className="eyebrow">PEX-E-35 · Lineside Monitor</div>
          <div className="name">Production Status</div>
        </div>
      </div>
      <div className="lsm-header-center">
        <div className="lsm-plant">{plant}</div>
        <div className="lsm-shift">{shift}</div>
      </div>
      <div className="lsm-header-right">
        <div className="lsm-clock">
          <div className="time">{fmtClock(time)}</div>
          <div className="updated">
            <span className="lsm-pulse-dot" />
            Updated · refresh {refreshSec}s
          </div>
        </div>
        <button className="lsm-cog" onClick={onConfig} aria-label="Configuration" title="Configuration (Shift+C)">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h0a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v0a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

/* ===== Footer ticker ===== */

function MonitorFooter({ lines, staging }) {
  const blockedCount = lines.reduce((a, l) => a + l.blocked.length, 0);
  const atRiskCount  = lines.reduce((a, l) => a + l.atRisk.length, 0);
  const stagedCount  = staging.staged;
  const notReady     = staging.noTR + staging.trCreated;

  return (
    <div className="lsm-footer">
      <div className="lsm-footer-cell">
        <div className="label">Blocked Orders</div>
        <div className={`value ${blockedCount > 0 ? "danger" : "ok"}`}>{blockedCount}<span className="unit">{blockedCount === 1 ? "order" : "orders"}</span></div>
      </div>
      <div className="lsm-footer-cell">
        <div className="label">At Risk</div>
        <div className={`value ${atRiskCount > 0 ? "warn" : "ok"}`}>{atRiskCount}<span className="unit">{atRiskCount === 1 ? "order" : "orders"}</span></div>
      </div>
      <div className="lsm-footer-cell">
        <div className="label">Staged to Line</div>
        <div className="value ok">{stagedCount}<span className="unit">orders</span></div>
      </div>
      <div className="lsm-footer-cell">
        <div className="label">Awaiting Picks</div>
        <div className={`value ${notReady > 5 ? "warn" : ""}`}>{notReady}<span className="unit">orders</span></div>
      </div>
      <div className="lsm-footer-tag">PEX-E-35 · Read-only · Auto-refresh</div>
    </div>
  );
}

function RotationIndicator({ sequence, stepIdx, panelDuration }) {
  // De-duplicate panel positions so each unique panel gets one dot
  const uniquePanels = Array.from(new Set(sequence));
  const activePanel = sequence[stepIdx];
  return (
    <div className="lsm-rot">
      {uniquePanels.map((pi, i) => (
        <div key={pi} className={`lsm-rot-dot ${pi === activePanel ? "active" : ""}`}>
          {pi === activePanel && <div className="fill" style={{ animationDuration: `${panelDuration}ms` }} />}
        </div>
      ))}
    </div>
  );
}

function ActivePanel({ idx, data }) {
  const def = PANEL_DEFS[idx];
  const Comp = window[def.component];
  if (!Comp) return null;
  return (
    <div className="lsm-panel" key={`${idx}-${data.signature}`}>
      <h2 className="lsm-panel-title">{def.title}</h2>
      <Comp lines={data.lines} staging={data.staging} plan={data.plan} />
    </div>
  );
}

/* ===== Config Panel — hidden in running mode ===== */

function ConfigPanel({ open, config, onChange, onClose }) {
  if (!open) return null;
  const data = window.MonitorData;

  function toggleLine(id) {
    const set = new Set(config.lineIds);
    set.has(id) ? set.delete(id) : set.add(id);
    onChange({ ...config, lineIds: Array.from(set) });
  }
  function togglePanel(id) {
    const set = new Set(config.panels);
    set.has(id) ? set.delete(id) : set.add(id);
    onChange({ ...config, panels: Array.from(set) });
  }

  const linesForPlant = data.LINES.filter(l => l.plantId === config.plantId);

  return (
    <div className="lsm-cfg-overlay" onClick={onClose}>
      <div className="lsm-cfg" onClick={e => e.stopPropagation()}>
        <div className="lsm-cfg-header">
          <div>
            <div className="lsm-cfg-eyebrow">PEX-E-35 · Lineside Monitor</div>
            <div className="lsm-cfg-title">Configuration</div>
          </div>
          <button className="lsm-cfg-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="lsm-cfg-body">
          <div className="lsm-cfg-section">
            <div className="lsm-cfg-label">Plant</div>
            <div className="lsm-cfg-radios">
              {data.PLANTS.map(p => (
                <label key={p.id} className={`lsm-cfg-radio ${config.plantId === p.id ? "on" : ""}`}>
                  <input type="radio" name="plant" checked={config.plantId === p.id} onChange={() => onChange({ ...config, plantId: p.id, lineIds: data.LINES.filter(l => l.plantId === p.id).map(l => l.id).slice(0,1) })} />
                  <div className="lsm-cfg-radio-body">
                    <div className="name">{p.name}</div>
                    <div className="sub">{p.shift}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="lsm-cfg-section">
            <div className="lsm-cfg-label">Lines for this monitor</div>
            <div className="lsm-cfg-help">Pick one or more. Multiple concurrent process orders per line are supported.</div>
            <div className="lsm-cfg-checks">
              {linesForPlant.map(l => (
                <label key={l.id} className={`lsm-cfg-check ${config.lineIds.includes(l.id) ? "on" : ""}`}>
                  <input type="checkbox" checked={config.lineIds.includes(l.id)} onChange={() => toggleLine(l.id)} />
                  <div className="lsm-cfg-check-body">
                    <div className="name">{l.name}</div>
                    <div className="sub">
                      {l.runningOrders.length} running · {l.blocked.length} blocked · {l.nextOrders.length} queued
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="lsm-cfg-row">
            <div className="lsm-cfg-section" style={{ flex: 1 }}>
              <div className="lsm-cfg-label">Refresh interval</div>
              <div className="lsm-cfg-help">How often the monitor polls the gold layer.</div>
              <div className="lsm-cfg-slider-wrap">
                <input type="range" min={5} max={120} step={5} value={config.refreshSec} onChange={e => onChange({ ...config, refreshSec: +e.target.value })} className="lsm-cfg-slider" />
                <div className="lsm-cfg-slider-value">{config.refreshSec}s</div>
              </div>
            </div>
            <div className="lsm-cfg-section" style={{ flex: 1 }}>
              <div className="lsm-cfg-label">Panel rotation speed</div>
              <div className="lsm-cfg-help">How long each panel stays on screen.</div>
              <div className="lsm-cfg-slider-wrap">
                <input type="range" min={5000} max={30000} step={1000} value={config.panelDuration} onChange={e => onChange({ ...config, panelDuration: +e.target.value })} className="lsm-cfg-slider" />
                <div className="lsm-cfg-slider-value">{(config.panelDuration/1000).toFixed(0)}s</div>
              </div>
            </div>
          </div>

          <div className="lsm-cfg-section">
            <div className="lsm-cfg-label">Panels in rotation</div>
            <div className="lsm-cfg-help">Disable any panel to skip it. Blocked / At Risk auto-runs 2× per spec when active.</div>
            <div className="lsm-cfg-panels">
              {PANEL_DEFS.map(p => (
                <label key={p.id} className={`lsm-cfg-panel ${config.panels.includes(p.id) ? "on" : ""}`}>
                  <input type="checkbox" checked={config.panels.includes(p.id)} onChange={() => togglePanel(p.id)} />
                  <div className="num">{p.num}</div>
                  <div className="lsm-cfg-panel-body">
                    <div className="name">{p.title}</div>
                    <div className="sub">{p.question}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="lsm-cfg-footer">
          <div className="lsm-cfg-tag">Press <kbd>Shift</kbd> + <kbd>C</kbd> to open · <kbd>Esc</kbd> to close</div>
          <button className="lsm-cfg-apply" onClick={onClose}>Apply &amp; resume</button>
        </div>
      </div>
    </div>
  );
}

/* ===== Top-level Monitor ===== */

function LinesideMonitor({ config, onConfigChange }) {
  const data = window.MonitorData;
  const time = useClock(data.SEED_TIME);
  const [cfgOpen, setCfgOpen] = useStateM(false);

  // Keyboard shortcut: Shift+C
  useEffectM(() => {
    function onKey(e) {
      if (e.shiftKey && (e.key === "C" || e.key === "c")) { setCfgOpen(true); }
      if (e.key === "Escape") setCfgOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const plant = data.PLANTS.find(p => p.id === config.plantId) || data.PLANTS[0];
  const allLines = data.LINES.filter(l => l.plantId === config.plantId);
  const lines    = allLines.filter(l => config.lineIds.includes(l.id));

  const hasBlocks = lines.some(l => l.blocked.length > 0 || l.atRisk.length > 0);
  const sequence  = buildSequence(config.panels, hasBlocks);
  const [activePanel, stepIdx] = useRotation(config.panelDuration, sequence);
  const def = PANEL_DEFS[activePanel];

  // signature forces panel re-mount + animation when scope changes
  const signature = `${config.plantId}|${config.lineIds.join(",")}`;

  if (lines.length === 0) {
    return (
      <div className="lsm-stage" data-screen-label="Lineside Monitor">
        <MonitorHeader plant={plant.name} shift={plant.shift} time={time} refreshSec={config.refreshSec} onConfig={() => setCfgOpen(true)} />
        <div className="lsm-body">
          <div className="lsm-panel" style={{ alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontFamily: "var(--font-impact)", fontWeight: 800, textTransform: "uppercase", fontSize: 64, color: "var(--fg-muted)" }}>No Lines Selected</div>
            <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontSize: 22, color: "var(--fg-muted)", marginTop: 12 }}>
              Press Shift + C or tap the gear to choose lines.
            </div>
          </div>
        </div>
        <MonitorFooter lines={lines} staging={data.STAGING_24H} />
        <ConfigPanel open={cfgOpen} config={config} onChange={onConfigChange} onClose={() => setCfgOpen(false)} />
      </div>
    );
  }

  return (
    <div className="lsm-stage" data-screen-label="Lineside Monitor">
      <MonitorHeader plant={plant.name} shift={plant.shift} time={time} refreshSec={config.refreshSec} onConfig={() => setCfgOpen(true)} />
      <div className="lsm-body">
        <div className="lsm-panel-meta">
          <div className="lsm-panel-id">
            <span className="num">PANEL {def.num}</span>
            <span className="question">"{def.question}"</span>
          </div>
          <RotationIndicator sequence={sequence} stepIdx={stepIdx} panelDuration={config.panelDuration} />
        </div>
        <ActivePanel idx={activePanel} data={{ lines, staging: data.STAGING_24H, plan: data.PLAN_VS_ACTUAL, signature }} />
      </div>
      <MonitorFooter lines={lines} staging={data.STAGING_24H} />
      <ConfigPanel open={cfgOpen} config={config} onChange={onConfigChange} onClose={() => setCfgOpen(false)} />
    </div>
  );
}

window.LinesideMonitor = LinesideMonitor;
window.PANEL_DEFS = PANEL_DEFS;
