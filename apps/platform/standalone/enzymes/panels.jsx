/* The three core panels: Inputs (batches + diluents), Constraints, Results. */

const InputsPanel = ({ order, lots, diluents, onSwap }) => {
  return (
    <section className="pane">
      <header className="pane-head">
        <div>
          <span className="step">Step 01 · Inputs</span>
          <h3>Components &amp; Batches</h3>
          <p className="lede">What's in the warehouse, with measured characteristics.</p>
        </div>
        <button className="iconbtn" title="Swap inventory snapshot"><Icon name="history" /></button>
      </header>

      <div className="pane-body">
        <div className="section-title">
          <h4>Available batches · NPU/g</h4>
          <span className="meta">{lots.length} lots · {lots.reduce((s,l)=>s+l.qty,0).toLocaleString()} kg on hand</span>
        </div>

        <table className="data">
          <thead>
            <tr>
              <th>Lot</th>
              <th className="num">Activity</th>
              <th className="num">Side α</th>
              <th className="num">H₂O</th>
              <th className="num">Age</th>
              <th className="num">On hand</th>
              <th>Flag</th>
            </tr>
          </thead>
          <tbody>
            {lots.map(l => (
              <tr key={l.id} className="row-hover">
                <td><span className="num" style={{ fontWeight: 600 }}>{l.id}</span></td>
                <td className="num">{l.activity.toLocaleString()}</td>
                <td className="num" style={{ color: l.sideAct >= 25 ? "#8B2900" : l.sideAct >= 22 ? "#6B3D0C" : "var(--forest)", fontWeight: l.sideAct >= 22 ? 600 : 400 }}>
                  {l.sideAct}%
                </td>
                <td className="num">{l.moisture}%</td>
                <td className="num">{l.age}d</td>
                <td className="num">{l.qty} kg</td>
                <td>{l.flag ? <StatusBadge status={l.flag} /> : <span className="muted">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="divider" />

        <div className="section-title">
          <h4>Diluents</h4>
          <span className="meta">2 carriers configured</span>
        </div>
        <table className="data">
          <thead>
            <tr><th>Material</th><th>Role</th><th className="num">Available</th></tr>
          </thead>
          <tbody>
            {diluents.map(d => (
              <tr key={d.id}>
                <td><div style={{ fontWeight: 600 }}>{d.name}</div><div className="muted" style={{ fontSize: 11, fontFamily: "var(--font-mono)" }}>{d.id}</div></td>
                <td className="muted" style={{ fontSize: 12 }}>{d.role}</td>
                <td className="num">{d.available.toLocaleString()} kg</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="divider" />
        <div className="section-title">
          <h4>Order target</h4>
        </div>
        <div className="stat-row" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="stat">
            <div className="lbl">Batch size</div>
            <div className="val">{order.qty}</div>
          </div>
          <div className="stat">
            <div className="lbl">Declared activity</div>
            <div className="val">{order.declared}</div>
          </div>
        </div>
      </div>
    </section>
  );
};

const ConstraintsPanel = ({ constraints, control, onChange, onReset }) => {
  return (
    <section className="pane">
      <header className="pane-head">
        <div>
          <span className="step">Step 02 · Constraints</span>
          <h3>Spec &amp; Tolerances</h3>
          <p className="lede">Customer spec, internal targets, and what we're willing to flex.</p>
        </div>
        <button className="iconbtn" title="Reset to spec defaults" onClick={onReset}><Icon name="history" /></button>
      </header>

      <div className="pane-body">
        {constraints.map(c => (
          <div key={c.id} className="constraint-row">
            <div className="head">
              <div className="name">
                {c.critical ? <Icon name="shield" size={13} /> : <Icon name="hex" size={13} />}
                {c.name}
                <span className="unit">{c.unit}</span>
                {c.binding ? <Badge kind="warn" dot>Binding</Badge> : null}
              </div>
              <div className="value">
                <span className="muted">min</span> {c.min}
                <span className="muted" style={{ margin: "0 4px" }}>·</span>
                <span style={{ color: "var(--valentia-slate)", fontWeight: 600 }}>tgt {c.target}</span>
                <span className="muted" style={{ margin: "0 4px" }}>·</span>
                <span className="muted">max</span> {c.max}
              </div>
            </div>
            <RangeBar c={c} showHandles={control === "range-bar"} onChange={(which, v) => onChange(c.id, which, v)} />
            {c.binding ? (
              <p className="muted" style={{ fontSize: 11.5, margin: "14px 0 0", display: "flex", gap: 6, alignItems: "flex-start" }}>
                <Icon name="alert" size={12} />
                <span>{c.desc} <strong style={{ color: "var(--forest)" }}>Relaxing this would unlock €{Math.round(140 + Math.random() * 80)} / batch.</strong></span>
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
};

const ResultsPanel = ({ kpi, constraints, lots, diluents, emphasis, showAi, showSensitivity, scenario, onCompare }) => {
  const isInfeasible = scenario === "infeasible";
  const recipeItems = [
    ...lots.filter(l => l.suggested > 0).map((l, i) => ({
      label: l.id, value: l.suggested, color: PALETTE[i % 3],
    })),
    ...diluents.map((d, i) => ({
      label: d.name, value: d.suggested, color: i === 0 ? "#F1F1E5" : "#CCDDE9", textColor: "#143700",
    })),
  ];

  return (
    <section className="pane">
      <header className="pane-head">
        <div>
          <span className="step">Step 03 · Result</span>
          <h3>Optimised Formula</h3>
          <p className="lede">{isInfeasible ? "Closest feasible solution — 1 violation remains." : "Solver converged · 0.42s · 12 iterations · MILP"}</p>
        </div>
        <div className="flex">
          {isInfeasible
            ? <Badge kind="error" dot>Infeasible</Badge>
            : <Badge kind="innovation" dot>Optimal</Badge>}
          <button className="btn btn-secondary btn-sm" onClick={onCompare}>
            <Icon name="compare" /> Compare
          </button>
        </div>
      </header>

      <div className="pane-body">
        {showAi ? (
          <div className="ai-slot">
            <div className="ico"><Icon name="zap" size={16} /></div>
            <div>
              <h4>AI co-pilot</h4>
              <p>
                Lot <strong>B-24-1203</strong> is high-activity (2,965 NPU/g). Pairing it with <strong>B-24-1218</strong> at a 24:76 split lets you discharge older inventory while staying inside the side-α ceiling. <span style={{ opacity: .7 }}>Confidence 87%.</span>
              </p>
            </div>
            <button className="btn btn-accept">Apply</button>
          </div>
        ) : null}

        <div className="stat-row">
          <div className={`stat ${emphasis === "cost" ? "accent" : ""}`}>
            <div className="lbl">Recipe cost</div>
            <div className="val">€{kpi.optimised.cost.toLocaleString()}</div>
            <div className="delta up">▼ €{(kpi.current.cost - kpi.optimised.cost).toLocaleString()} vs current</div>
          </div>
          <div className={`stat ${emphasis === "constraints" ? "accent" : ""}`}>
            <div className="lbl">Yield to spec</div>
            <div className="val">{kpi.optimised.yield}%</div>
            <div className="delta up">▲ {(kpi.optimised.yield - kpi.current.yield).toFixed(1)} pts</div>
          </div>
          <div className="stat">
            <div className="lbl">Over-declaration</div>
            <div className="val">{kpi.optimised.overDose}%</div>
            <div className="delta up">▼ {(kpi.current.overDose - kpi.optimised.overDose).toFixed(1)} pts</div>
          </div>
          <div className="stat">
            <div className="lbl">Diluent used</div>
            <div className="val">{kpi.optimised.diluentUse} <span style={{ fontSize: 13, color: "var(--fg-muted)" }}>kg</span></div>
            <div className="delta neutral">+{kpi.optimised.diluentUse - kpi.current.diluentUse} kg</div>
          </div>
        </div>

        {isInfeasible ? (
          <div className="bottleneck" style={{ background: "color-mix(in srgb, var(--sunset) 10%, white)" }}>
            <div className="ico"><Icon name="alert" size={16} /></div>
            <div>
              <h4>No feasible solution at current constraints</h4>
              <p>
                Activity floor (<span className="num">2,450 NPU/g</span>) cannot be met from on-hand lots. Closest feasible:
                <strong className="num"> 2,418 NPU/g</strong> — short by <strong className="num">32 NPU/g</strong>.
              </p>
            </div>
            <button className="btn btn-secondary btn-sm">Suggest relaxations</button>
          </div>
        ) : (
          <div className="bottleneck">
            <div className="ico"><Icon name="alert" size={15} /></div>
            <div>
              <h4>Bottleneck: side α-amylase</h4>
              <p>
                Solution sits <span className="num">5.6 pts</span> below the ceiling. Lot <span className="num">B-24-1203</span> drives 62% of the side-α load.
                Loosening the ceiling to <span className="num">28%</span> would unlock <span className="num">€140</span> per batch.
              </p>
            </div>
          </div>
        )}

        <div className="section-title">
          <h4>Constraint slack</h4>
          <span className="meta">distance from nearest bound</span>
        </div>
        <SlackChart constraints={constraints} />

        <div className="divider" />

        <div className="section-title">
          <h4>Recipe composition</h4>
          <span className="meta">{recipeItems.length} components · 1,800 kg</span>
        </div>
        <StackBar items={recipeItems} />

        {showSensitivity ? (
          <>
            <div className="divider" />
            <div className="section-title">
              <h4>Sensitivity — cost vs side-α ceiling</h4>
              <span className="meta">what-if curve</span>
            </div>
            <SensitivityChart />
          </>
        ) : null}
      </div>
    </section>
  );
};

Object.assign(window, { InputsPanel, ConstraintsPanel, ResultsPanel });
