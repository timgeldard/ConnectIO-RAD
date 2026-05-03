/* Top-level App + workbench layout. */

const { useState, useMemo } = React;

const TopBar = ({ order, onOpenPicker }) => (
  <header className="topbar">
    <div className="brand">
      <img src="kerry-logo-slate.png" alt="Kerry" />
    </div>
    <span className="product">PEX·E·90 · Formula Optimiser</span>
    <nav className="crumbs" aria-label="Breadcrumb">
      <span>Production</span>
      <span className="sep">›</span>
      <span>Process orders</span>
      <span className="sep">›</span>
      <strong>{order.id}</strong>
    </nav>
    <div className="spacer" />
    <button className="btn btn-ghost btn-sm" style={{ color: "#E9F0E1" }} onClick={onOpenPicker}>
      <Icon name="search" /> Open another order
    </button>
    <button className="iconbtn" style={{ color: "#E9F0E1", borderColor: "#2c4019" }} title="History"><Icon name="history" /></button>
    <div className="user">
      <div className="avatar" aria-hidden>NÓ</div>
      <div>
        <div style={{ color: "#fff", fontWeight: 600, fontSize: 12 }}>Nóra Ó Briain</div>
        <div>Recipe controller · IE</div>
      </div>
    </div>
  </header>
);

const LeftRail = ({ order, kpi, scenario }) => (
  <aside className="rail">
    <div className="rail-section">
      <p className="rail-eyebrow">Process order</p>
      <h2>{order.product.split(" — ")[0]}</h2>
      <p className="subtitle">{order.product.split(" — ")[1]}</p>
      <div style={{ marginTop: 12 }}>
        <dl style={{ margin: 0 }}>
          <div className="meta-row"><dt>PO</dt><dd>{order.id}</dd></div>
          <div className="meta-row"><dt>SKU</dt><dd>{order.sku}</dd></div>
          <div className="meta-row"><dt>Batch size</dt><dd>{order.qty}</dd></div>
          <div className="meta-row"><dt>Declared</dt><dd>{order.declared}</dd></div>
          <div className="meta-row"><dt>Site</dt><dd>{order.site}</dd></div>
          <div className="meta-row"><dt>Line</dt><dd>{order.line}</dd></div>
          <div className="meta-row"><dt>Due</dt><dd>{order.due}</dd></div>
        </dl>
      </div>
    </div>

    <div className="rail-section">
      <p className="rail-eyebrow">Run summary</p>
      <div style={{ display: "grid", gap: 8 }}>
        <div className="flex between">
          <span className="muted" style={{ fontSize: 12 }}>Solver</span>
          <span className="num" style={{ fontSize: 12 }}>MILP · CBC</span>
        </div>
        <div className="flex between">
          <span className="muted" style={{ fontSize: 12 }}>Last run</span>
          <span className="num" style={{ fontSize: 12 }}>14:32 UTC</span>
        </div>
        <div className="flex between">
          <span className="muted" style={{ fontSize: 12 }}>Status</span>
          {scenario === "infeasible" ? <Badge kind="error" dot>Infeasible</Badge> : <Badge kind="innovation" dot>Optimal</Badge>}
        </div>
        <div className="flex between">
          <span className="muted" style={{ fontSize: 12 }}>Iterations</span>
          <span className="num" style={{ fontSize: 12 }}>12</span>
        </div>
      </div>
    </div>

    <div className="rail-section">
      <p className="rail-eyebrow">Sister orders · same SKU</p>
      <div>
        {ENZYME_ORDERS.slice(1, 4).map(o => (
          <button key={o.id} className="rail-link" style={{ paddingLeft: 0, paddingRight: 0 }}>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 500 }}>{o.product.split(" — ")[0]}</div>
              <div className="id">{o.id} · {o.qty}</div>
            </div>
            <span className={`dot ${o.status === "infeasible" ? "red" : o.status === "tight" ? "amber" : "green"}`} />
          </button>
        ))}
      </div>
    </div>

    <div className="rail-section" style={{ marginTop: "auto" }}>
      <p className="rail-eyebrow"><Icon name="globe" size={11} /> Cross-site benchmark</p>
      <p className="muted" style={{ fontSize: 12, margin: 0 }}>
        Rochester achieved <strong className="num" style={{ color: "var(--forest)" }}>99.4%</strong> yield on the same SKU last week.
        <a href="#" style={{ color: "var(--valentia-slate)", textDecoration: "none", fontWeight: 600 }}> View benchmark ›</a>
      </p>
    </div>
  </aside>
);

const ActionBar = ({ stage, onRun, onCompare, onAccept, onReject, isRunning, scenario }) => (
  <div className="actionbar">
    <div className="stage">
      <span className={stage >= 1 ? "active" : ""}>① Inputs</span>
      <span className="arrow">›</span>
      <span className={stage >= 2 ? "active" : ""}>② Constraints</span>
      <span className="arrow">›</span>
      <span className={stage >= 3 ? "active" : ""}>③ Optimise</span>
      <span className="arrow">›</span>
      <span className={stage >= 4 ? "active" : ""}>④ Compare</span>
      <span className="arrow">›</span>
      <span className={stage >= 5 ? "active" : ""}>⑤ Accept</span>
    </div>
    <div className="gap" />
    <button className="btn btn-ghost btn-sm" title="Reset all edits"><Icon name="history" /> Reset</button>
    <button className="btn btn-secondary" onClick={onRun} disabled={isRunning}>
      <Icon name={isRunning ? "pause" : "play"} /> {isRunning ? "Running…" : "Re-optimise"}
    </button>
    <button className="btn btn-secondary" onClick={onCompare}>
      <Icon name="compare" /> Compare
    </button>
    <span style={{ width: 1, height: 24, background: "var(--stroke)" }} />
    <button className="btn btn-reject" onClick={onReject}><Icon name="x" /> Reject</button>
    <button className="btn btn-accept" onClick={onAccept} disabled={scenario === "infeasible"}>
      <Icon name="check" /> Accept &amp; post
    </button>
  </div>
);

const App = () => {
  const [t, setT] = useTweaks(window.__TWEAK_DEFAULTS);

  // density on body so CSS variables flip globally
  React.useEffect(() => {
    document.body.dataset.density = t.density;
  }, [t.density]);

  const [order, setOrder] = useState(ACTIVE_ORDER);
  const [showPicker, setShowPicker] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [running, setRunning] = useState(false);
  const [toast, setToast] = useState(null);
  const [constraints, setConstraints] = useState(CONSTRAINTS);

  // scenario from tweaks: "happy" | "infeasible"
  const scenario = t.scenario;
  const liveConstraints = useMemo(() => {
    if (scenario === "infeasible") {
      return constraints.map(c => c.id === "activity" ? { ...c, optimised: 2418 } : c);
    }
    return constraints;
  }, [constraints, scenario]);

  const liveKpi = useMemo(() => {
    if (scenario === "infeasible") {
      return {
        ...KPI,
        optimised: { ...KPI.optimised, yield: 92.4, overDose: -1.3, cost: 18180 },
      };
    }
    return KPI;
  }, [scenario]);

  const onConstraintChange = (id, which, v) => {
    setConstraints(cs => cs.map(c => c.id === id ? { ...c, [which]: v } : c));
  };
  const onResetConstraints = () => setConstraints(CONSTRAINTS);

  const onRun = () => {
    setRunning(true);
    setTimeout(() => {
      setRunning(false);
      setToast("Solver converged in 0.42s · 12 iterations");
      setTimeout(() => setToast(null), 2400);
    }, 1100);
  };
  const onAccept = () => {
    setShowConfirm(false);
    setToast("Posted to SAP · audit ID AUD-2026-04891");
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="app">
      <TopBar order={order} onOpenPicker={() => setShowPicker(true)} />
      <div className="workbench">
        <LeftRail order={order} kpi={liveKpi} scenario={scenario} />
        <div className="canvas">
          <ActionBar
            stage={5}
            isRunning={running}
            scenario={scenario}
            onRun={onRun}
            onCompare={() => setShowCompare(true)}
            onAccept={() => setShowConfirm(true)}
            onReject={() => { setToast("Optimisation rejected · order returned to manual queue"); setTimeout(() => setToast(null), 2400); }}
          />

          {scenario === "infeasible" ? (
            <div className="infeasible-banner">
              <div className="ico"><Icon name="alert" size={16} /></div>
              <div>
                <h4>Solver returned infeasible — closest feasible solution shown below.</h4>
                <p>One of the 12 constraints cannot be satisfied with on-hand inventory. The result panel highlights the violation and suggests two relaxations.</p>
              </div>
              <button className="btn btn-secondary btn-sm">View IIS</button>
            </div>
          ) : null}

          <div className="panes">
            <InputsPanel order={order} lots={BATCH_LOTS} diluents={DILUENTS} />
            <ConstraintsPanel constraints={liveConstraints} control={t.constraintControl} onChange={onConstraintChange} onReset={onResetConstraints} />
            <ResultsPanel
              kpi={liveKpi}
              constraints={liveConstraints}
              lots={BATCH_LOTS}
              diluents={DILUENTS}
              emphasis={t.resultsEmphasis}
              showAi={t.showAiSlot}
              showSensitivity={t.showSensitivity}
              scenario={scenario}
              onCompare={() => setShowCompare(true)}
            />
          </div>
        </div>
      </div>

      {showPicker ? (
        <OrderPicker
          orders={ENZYME_ORDERS}
          activeId={order.id}
          onSelect={(o) => { setOrder(o); setShowPicker(false); }}
          onClose={() => setShowPicker(false)}
        />
      ) : null}
      {showCompare ? (
        <CompareDialog kpi={liveKpi} constraints={liveConstraints} lots={BATCH_LOTS} diluents={DILUENTS} onClose={() => setShowCompare(false)} />
      ) : null}
      {showConfirm ? (
        <ConfirmDialog kpi={liveKpi} onClose={() => setShowConfirm(false)} onAccept={onAccept} />
      ) : null}

      {toast ? <div className="toast">{toast}</div> : null}

      <TweaksPanel title="Tweaks">
        <TweakSection label="Layout" />
        <TweakRadio label="Density" value={t.density}
          options={["comfortable", "compact"]}
          onChange={(v) => setT("density", v)} />
        <TweakRadio label="Results emphasis" value={t.resultsEmphasis}
          options={["constraints", "cost"]}
          onChange={(v) => setT("resultsEmphasis", v)} />
        <TweakRadio label="Constraint control" value={t.constraintControl}
          options={["range-bar", "static"]}
          onChange={(v) => setT("constraintControl", v)} />
        <TweakSection label="Content" />
        <TweakToggle label="AI co-pilot slot" value={t.showAiSlot}
          onChange={(v) => setT("showAiSlot", v)} />
        <TweakToggle label="Sensitivity chart" value={t.showSensitivity}
          onChange={(v) => setT("showSensitivity", v)} />
        <TweakSection label="Scenario" />
        <TweakRadio label="Solver outcome" value={t.scenario}
          options={["happy", "infeasible"]}
          onChange={(v) => setT("scenario", v)} />
      </TweaksPanel>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
