/* === Process Execution Workspace — wizard-style === */

const PhaseStepper = ({ phases, current }) => (
  <div className="stepper">
    {phases.map((p, i) => {
      const cls = p.status === "done" ? "is-done" : p.status === "current" ? "is-current" : p.status === "blocked" ? "is-blocked" : "";
      return (
        <div key={p.id} className={`stepper__step ${cls}`}>
          <div className="dot-num">
            {p.status === "done" ? <Icon name="check" size={14}/> : p.id}
          </div>
          <div className="lbl">
            <small>Phase {p.id}</small>
            <strong>{p.name}</strong>
          </div>
        </div>
      );
    })}
  </div>
);

const ToleranceBar = ({ lo, hi, target, current }) => {
  const range = hi - lo;
  const pct = (v) => Math.max(0, Math.min(100, ((v - lo) / range) * 100));
  // green band = full lo–hi range
  return (
    <div>
      <div className="tol">
        <div className="tol__band" style={{left:"4%",right:"4%"}}></div>
        <div className="tol__marker" style={{left:`${pct(target)}%`,opacity:0.4}}></div>
        <div className="tol__marker" style={{left:`${pct(current)}%`,background:"var(--pec-brand)"}}></div>
      </div>
      <div className="tol__caps">
        <span>{lo}</span>
        <span style={{color:"var(--pec-brand)",fontWeight:600}}>● live · {current}</span>
        <span>{hi}</span>
      </div>
    </div>
  );
};

const ParamRow = ({ p, value, onChange, captured }) => {
  const inRange = value !== "" && Number(value) >= p.lo && Number(value) <= p.hi;
  const outOfRange = value !== "" && !inRange;
  return (
    <div className="param">
      <div className="param__info">
        <div className="row-flex" style={{marginBottom:6}}>
          <Icon name={p.icon} size={16} style={{color:"var(--pec-brand)"}}/>
          <div className="name">{p.name}</div>
          {captured && <span className="badge badge--success">Captured</span>}
          {outOfRange && <span className="badge badge--danger">Out of tolerance</span>}
        </div>
        <div className="desc">{p.desc}</div>
        <div className="param__targets">
          <div><small>Target</small><span>{p.target} {p.unit}</span></div>
          <div><small>Lower</small><span>{p.lo} {p.unit}</span></div>
          <div><small>Upper</small><span>{p.hi} {p.unit}</span></div>
        </div>
        <ToleranceBar lo={p.lo} hi={p.hi} target={p.target} current={p.current}/>
      </div>
      <div className="param__entry">
        <label className="label">Actual reading</label>
        <div className="row">
          <input
            className="input input--xl input--mono"
            placeholder={String(p.current)}
            value={value}
            onChange={e => onChange(e.target.value)}
            style={outOfRange ? {borderColor:"var(--pec-danger)",background:"var(--pec-danger-bg)"} : inRange ? {borderColor:"var(--pec-success)"} : {}}
          />
          <div className="unit" style={{height:72,fontSize:18,minWidth:64,justifyContent:"center"}}>{p.unit}</div>
        </div>
        <div className="row" style={{justifyContent:"space-between"}}>
          <button className="btn btn--ghost" style={{height:32,fontSize:12}} onClick={() => onChange(String(p.current))}>
            <Icon name="activity" size={12}/> Pull from sensor
          </button>
          {outOfRange && <span style={{fontSize:12,color:"var(--pec-danger)",fontWeight:500}}>Will require deviation note</span>}
        </div>
      </div>
    </div>
  );
};

const ExecutionPage = ({ go, openHold }) => {
  const [stepIdx, setStepIdx] = React.useState(2); // step 3.3
  const [paramValues, setParamValues] = React.useState({});
  const [captured, setCaptured] = React.useState({});
  const [showCompleteToast, setShowCompleteToast] = React.useState(false);

  const allFilled = MOCK.STEP_3_3_PARAMS.every(p => paramValues[p.id] !== undefined && paramValues[p.id] !== "");

  const completeStep = () => {
    setCaptured(Object.fromEntries(MOCK.STEP_3_3_PARAMS.map(p => [p.id, true])));
    setShowCompleteToast(true);
    setTimeout(() => setShowCompleteToast(false), 2400);
  };

  return (
    <div className="exec">
      {/* Order header */}
      <div className="exec__head">
        <div className="exec__head-top">
          <div className="meta" style={{flex:1}}>
            <div className="exec__order">
              <span style={{color:"var(--pec-brand)",fontWeight:600}}>{MOCK.ACTIVE_ORDER.id}</span>
              <span style={{margin:"0 8px",color:"var(--pec-ink-soft)"}}>·</span>
              Control recipe {MOCK.ACTIVE_ORDER.controlRecipe}
              <span style={{margin:"0 8px",color:"var(--pec-ink-soft)"}}>·</span>
              Batch {MOCK.ACTIVE_ORDER.batch}
            </div>
            <h1 className="exec__title">{MOCK.ACTIVE_ORDER.material}</h1>
            <div style={{fontSize:12,color:"var(--pec-ink-muted)",marginTop:2}}>
              {MOCK.ACTIVE_ORDER.line} · {MOCK.ACTIVE_ORDER.qtyPlanned.toLocaleString()} {MOCK.ACTIVE_ORDER.uom} planned · {MOCK.ACTIVE_ORDER.customer}
            </div>
          </div>
          <div className="exec__head-stats">
            <div className="stat"><span className="l">Phase</span><span className="v">3 / 8</span></div>
            <div className="stat"><span className="l">Step</span><span className="v">3.3 / 3.5</span></div>
            <div className="stat"><span className="l">Elapsed</span><span className="v">1h 12m</span></div>
            <div className="stat"><span className="l">Due</span><span className="v" style={{color:"var(--pec-warning)"}}>18:30</span></div>
          </div>
        </div>
      </div>

      {/* Phase stepper */}
      <div className="exec__phase-rail">
        <PhaseStepper phases={MOCK.PHASES} current={3}/>
      </div>

      {/* Body */}
      <div className="exec__body">
        <div className="exec__main">
          {/* Step header / instruction card */}
          <div className="instruction">
            <div className="instruction__pre">
              <span className="num">STEP 3.3</span>
              <span>Phase 3 — Blend & homogenize</span>
              <span style={{marginLeft:"auto",color:"var(--pec-ink-muted)"}}>3 of 5 steps in this phase</span>
            </div>
            <h2 className="instruction__title">Capture mid-blend process parameters</h2>
            <p className="instruction__desc">After 8 minutes of blend time, record temperature, ribbon torque, chamber pressure, and online NIR moisture. All four values must be within tolerance before you can advance to Step 3.4.</p>

            <div className="banner banner--info" style={{marginBottom:8}}>
              <Icon name="info" size={18} className="banner__icon" style={{color:"var(--pec-info)"}}/>
              <div className="banner__body">
                <strong>Process instruction PI-3.3.1</strong>
                Open T-101 RTD reading on the operator panel; allow 30 seconds for the value to stabilize before recording. NIR moisture should be averaged over the most recent 60 seconds.
              </div>
            </div>
          </div>

          {/* Parameters */}
          <div className="card">
            <div className="card__h">
              <Icon name="target" size={16} style={{color:"var(--pec-brand)"}}/>
              <h3>Process parameters · 4 values to capture</h3>
              <div className="actions">
                <span className="badge badge--info"><Icon name="activity" size={11}/> Live from PLC</span>
                <button className="btn btn--ghost" style={{height:28,fontSize:12}}><Icon name="refresh" size={12}/> Re-read all</button>
              </div>
            </div>
            <div className="card__b" style={{paddingTop:0,paddingBottom:0}}>
              {MOCK.STEP_3_3_PARAMS.map(p => (
                <ParamRow
                  key={p.id}
                  p={p}
                  value={paramValues[p.id] ?? ""}
                  captured={captured[p.id]}
                  onChange={v => setParamValues({...paramValues, [p.id]: v})}
                />
              ))}
            </div>
          </div>

          {/* Sub-steps in phase */}
          <div className="card">
            <div className="card__h">
              <Icon name="layers" size={16} style={{color:"var(--pec-brand)"}}/>
              <h3>Steps in Phase 3</h3>
              <div className="actions">
                <span className="mono" style={{fontSize:11,color:"var(--pec-ink-muted)"}}>2 done · 1 current · 2 pending</span>
              </div>
            </div>
            <div>
              {MOCK.PHASE_3_STEPS.map(s => {
                const isCurrent = s.status === "current";
                return (
                  <div key={s.id} style={{
                    display:"grid",gridTemplateColumns:"24px 60px 1fr auto",gap:14,alignItems:"center",
                    padding:"10px 16px",borderBottom:"1px solid var(--pec-border)",
                    background: isCurrent ? "color-mix(in srgb, var(--pec-brand) 4%, transparent)" : "transparent"
                  }}>
                    <div>
                      {s.status==="done" ? <div style={{width:20,height:20,borderRadius:"50%",background:"var(--pec-success)",color:"white",display:"flex",alignItems:"center",justifyContent:"center"}}><Icon name="check" size={12}/></div> :
                       isCurrent ? <div style={{width:20,height:20,borderRadius:"50%",background:"var(--pec-brand)",color:"white",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 0 4px color-mix(in srgb, var(--pec-brand) 20%, transparent)"}}><div style={{width:6,height:6,borderRadius:"50%",background:"white"}}></div></div> :
                       <div style={{width:20,height:20,borderRadius:"50%",border:"2px solid var(--pec-border-strong)"}}></div>}
                    </div>
                    <span className="mono" style={{fontSize:12,color:"var(--pec-ink-muted)",fontWeight:600}}>{s.id}</span>
                    <div>
                      <div style={{fontSize:13,fontWeight:isCurrent?600:500}}>{s.title}</div>
                      <div style={{fontSize:11,color:"var(--pec-ink-muted)",marginTop:2}}>{s.desc}</div>
                    </div>
                    <div>
                      {s.status==="done" && <span className="badge badge--success">Done</span>}
                      {s.status==="current" && <span className="badge badge--brand">Current</span>}
                      {s.status==="pending" && <span className="badge badge--ghost">Pending</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Side drawer — context */}
        <div className="exec__aside">
          <div className="ctx-card">
            <h4><Icon name="package" size={12}/> Components consumed <span className="more" onClick={()=>go("material")}>View all →</span></h4>
            {MOCK.COMPONENTS.slice(0,4).map(c => (
              <div key={c.matNo} className="row">
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:500,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{c.name}</div>
                  <div className="mono" style={{fontSize:10,color:"var(--pec-ink-muted)"}}>{c.batch}</div>
                </div>
                <span className="v mono">{c.actual} {c.uom}</span>
              </div>
            ))}
          </div>

          <div className="ctx-card">
            <h4><Icon name="history" size={12}/> Phase activity</h4>
            <div style={{maxHeight:200,overflow:"auto",margin:"-4px"}}>
              {MOCK.ALL_PHASES_TIMELINE.slice(-6).reverse().map((e,i) => (
                <div key={i} style={{display:"flex",gap:8,padding:"6px 4px",borderTop: i ? "1px solid var(--pec-border)" : "0"}}>
                  <span className="mono" style={{fontSize:10,color:"var(--pec-ink-muted)",minWidth:54,whiteSpace:"nowrap"}}>{e.ts}</span>
                  <span style={{fontSize:11,flex:1}}>{e.txt}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="ctx-card">
            <h4><Icon name="info" size={12}/> Order header</h4>
            <div className="row"><span className="muted">Order</span><span className="v mono">{MOCK.ACTIVE_ORDER.id}</span></div>
            <div className="row"><span className="muted">Batch</span><span className="v mono">{MOCK.ACTIVE_ORDER.batch}</span></div>
            <div className="row"><span className="muted">Recipe</span><span className="v mono">{MOCK.ACTIVE_ORDER.recipe}</span></div>
            <div className="row"><span className="muted">Started</span><span className="v">{MOCK.ACTIVE_ORDER.startedAt.split(" ")[1]}</span></div>
            <div className="row"><span className="muted">Operator</span><span className="v">{MOCK.ACTIVE_ORDER.operator}</span></div>
          </div>

          <div className="ctx-card" style={{borderColor:"color-mix(in srgb, var(--pec-warning) 30%, transparent)",background:"color-mix(in srgb, var(--pec-warning) 4%, var(--pec-surface))"}}>
            <h4 style={{color:"var(--pec-warning)"}}><Icon name="alert" size={12}/> Active flags · 1</h4>
            <div style={{fontSize:12,color:"var(--pec-ink)",lineHeight:1.5}}>
              Flavor charge for MAT-440-66301 was <strong>0.21% under target</strong> in Phase 2. Logged for review; no action required at this step.
            </div>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="exec__action-bar">
        <button className="btn"><Icon name="chevronLeft" size={14}/> Previous</button>
        <button className="btn"><Icon name="notes" size={14}/> Add note</button>
        <button className="btn" onClick={openHold}><Icon name="pause" size={14}/> Hold / escalate</button>
        <button className="btn"><Icon name="download" size={14}/> Save draft</button>
        <div className="spacer"></div>
        <span className="muted" style={{fontSize:12,marginRight:8}}>{Object.keys(paramValues).filter(k=>paramValues[k]!=="").length} of 4 captured</span>
        <button
          className="btn btn--primary btn--lg"
          disabled={!allFilled}
          onClick={completeStep}
        >
          <Icon name="check" size={16}/> Complete step & advance <Icon name="arrowRight" size={14}/>
        </button>
      </div>

      {showCompleteToast && (
        <div style={{position:"fixed",bottom:96,left:"50%",transform:"translateX(-50%)",background:"var(--pec-success)",color:"white",padding:"12px 20px",borderRadius:8,fontWeight:600,boxShadow:"var(--pec-shadow-pop)",display:"flex",alignItems:"center",gap:10,zIndex:40}}>
          <Icon name="checkCircle" size={18}/> Step 3.3 captured — advancing to 3.4 (Confirm blend duration)
        </div>
      )}
    </div>
  );
};

window.ExecutionPage = ExecutionPage;
