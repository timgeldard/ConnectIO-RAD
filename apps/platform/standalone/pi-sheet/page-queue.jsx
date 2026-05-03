/* === Operator Work Queue === */

const StatusBadge = ({ s }) => {
  const map = {
    ready:        { cls: "badge--info",    txt: "Ready" },
    in_progress:  { cls: "badge--brand",   txt: "In progress" },
    exception:    { cls: "badge--warning", txt: "Exception" },
    blocked:      { cls: "badge--danger",  txt: "Blocked" },
    complete:     { cls: "badge--success", txt: "Complete" },
    hold:         { cls: "badge--hold",    txt: "On hold" },
  };
  const m = map[s] || map.ready;
  return <span className={`badge ${m.cls}`}>{m.txt}</span>;
};
window.StatusBadge = StatusBadge;

const PriorityChip = ({ p }) => {
  const map = { high: { c: "var(--pec-danger)", t: "High" }, med: { c: "var(--pec-warning)", t: "Med" }, low: { c: "var(--pec-ink-muted)", t: "Low" } };
  const m = map[p];
  return <span className="mono" style={{fontSize:11,fontWeight:600,letterSpacing:"0.06em",color:m.c,textTransform:"uppercase"}}>{m.t}</span>;
};

const QueuePage = ({ go }) => {
  const [filter, setFilter] = React.useState("all");
  const [q, setQ] = React.useState("");
  const orders = MOCK.PROCESS_ORDERS.filter(o => {
    if (filter === "mine" && !o.isMine) return false;
    if (filter === "exception" && o.status !== "exception" && o.status !== "blocked") return false;
    if (filter === "ready" && o.status !== "ready") return false;
    if (filter === "in_progress" && o.status !== "in_progress") return false;
    if (q && !`${o.id} ${o.material} ${o.batch}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const sevClass = (s) => ({
    blocked:"queue-row__sev--blocked",
    exception:"queue-row__sev--exception",
    in_progress:"queue-row__sev--inprogress",
    ready:"queue-row__sev--ready",
  })[s] || "";

  const counts = {
    all: MOCK.PROCESS_ORDERS.length,
    mine: MOCK.PROCESS_ORDERS.filter(o=>o.isMine).length,
    in_progress: MOCK.PROCESS_ORDERS.filter(o=>o.status==="in_progress").length,
    ready: MOCK.PROCESS_ORDERS.filter(o=>o.status==="ready").length,
    exception: MOCK.PROCESS_ORDERS.filter(o=>o.status==="exception"||o.status==="blocked").length,
  };

  // Find resume target
  const resumeOrder = MOCK.PROCESS_ORDERS.find(o => o.isMine && o.status === "in_progress");

  return (
    <div className="page">
      <div className="page-h">
        <div>
          <div className="eyebrow">Operator queue · Beloit, WI · Shift B</div>
          <h1>Your work, ready to run</h1>
          <p>Orders for your line and resource, sequenced by what's runnable now. Resume in-progress work, claim ready phases, or triage exceptions.</p>
        </div>
        <div className="row-flex">
          <button className="btn"><Icon name="filter" size={14}/> Saved views</button>
          <button className="btn"><Icon name="refresh" size={14}/> Refresh</button>
        </div>
      </div>

      {/* Resume callout */}
      {resumeOrder && (
        <div className="card" style={{marginBottom:16, background:"linear-gradient(135deg, color-mix(in srgb, var(--pec-brand) 6%, var(--pec-surface)), var(--pec-surface))", borderLeft:"4px solid var(--pec-brand)"}}>
          <div className="card__b" style={{display:"flex",alignItems:"center",gap:20}}>
            <div style={{flex:1}}>
              <div className="mono" style={{fontSize:11,letterSpacing:"0.1em",textTransform:"uppercase",color:"var(--pec-brand)",marginBottom:6}}>Resume where you left off</div>
              <div style={{display:"flex",alignItems:"baseline",gap:12,marginBottom:4}}>
                <span className="mono" style={{fontSize:13,color:"var(--pec-ink-muted)"}}>{resumeOrder.id}</span>
                <strong style={{fontSize:18}}>{resumeOrder.material}</strong>
              </div>
              <div style={{fontSize:13,color:"var(--pec-ink-muted)"}}>
                {resumeOrder.line} · Phase {resumeOrder.phase} · {resumeOrder.qty.planned.toLocaleString()} {resumeOrder.qty.uom} · Due {resumeOrder.due}
              </div>
              <div style={{marginTop:12,display:"flex",alignItems:"center",gap:10}}>
                <div style={{flex:1,maxWidth:400,height:6,background:"var(--pec-bg)",borderRadius:999,overflow:"hidden"}}>
                  <div style={{width:`${resumeOrder.progress}%`,height:"100%",background:"var(--pec-brand)"}}></div>
                </div>
                <span className="mono" style={{fontSize:12,color:"var(--pec-ink-muted)"}}>{resumeOrder.progress}% · Phase 3.3 of 8</span>
              </div>
            </div>
            <button className="btn btn--primary btn--lg" onClick={() => go("exec")}>
              <Icon name="play" size={16}/> Resume execution <Icon name="arrowRight" size={14}/>
            </button>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="card">
        <div style={{padding:"12px 16px",borderBottom:"1px solid var(--pec-border)",display:"flex",alignItems:"center",gap:8}}>
          {[
            {id:"all",t:"All"},{id:"mine",t:"Assigned to me"},{id:"in_progress",t:"In progress"},{id:"ready",t:"Ready"},{id:"exception",t:"Exceptions"},
          ].map(t => (
            <button key={t.id} className={`chip ${filter===t.id?"is-active":""}`} onClick={()=>setFilter(t.id)}>
              {t.t} <span className="mono" style={{opacity:0.7,fontSize:11}}>{counts[t.id]}</span>
            </button>
          ))}
          <div style={{flex:1}}></div>
          <div className="app__search" style={{width:280,height:32}}>
            <Icon name="search" size={14}/>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Filter by order, batch, material…" />
          </div>
        </div>

        {/* Header row */}
        <div className="queue-row" style={{background:"var(--pec-surface-alt)",cursor:"default",padding:"8px 16px",borderBottom:"1px solid var(--pec-border)"}}>
          <div></div>
          <div className="mono" style={{fontSize:10,letterSpacing:"0.08em",textTransform:"uppercase",color:"var(--pec-ink-muted)",fontWeight:600}}>Order</div>
          <div className="mono" style={{fontSize:10,letterSpacing:"0.08em",textTransform:"uppercase",color:"var(--pec-ink-muted)",fontWeight:600}}>Material / batch</div>
          <div className="mono" style={{fontSize:10,letterSpacing:"0.08em",textTransform:"uppercase",color:"var(--pec-ink-muted)",fontWeight:600}}>Quantity</div>
          <div className="mono" style={{fontSize:10,letterSpacing:"0.08em",textTransform:"uppercase",color:"var(--pec-ink-muted)",fontWeight:600}}>Phase</div>
          <div className="mono" style={{fontSize:10,letterSpacing:"0.08em",textTransform:"uppercase",color:"var(--pec-ink-muted)",fontWeight:600}}>Resource</div>
          <div className="mono" style={{fontSize:10,letterSpacing:"0.08em",textTransform:"uppercase",color:"var(--pec-ink-muted)",fontWeight:600}}>Due</div>
          <div className="mono" style={{fontSize:10,letterSpacing:"0.08em",textTransform:"uppercase",color:"var(--pec-ink-muted)",fontWeight:600,textAlign:"right"}}>Action</div>
        </div>

        {orders.map(o => (
          <div key={o.id} className={`queue-row ${o.isMine?"is-mine":""}`} onClick={()=>o.isMine && go("exec")}>
            <div className={`queue-row__sev ${sevClass(o.status)}`}></div>
            <div>
              <div className="mono" style={{fontSize:13,fontWeight:600}}>{o.id}</div>
              <PriorityChip p={o.priority}/>
            </div>
            <div>
              <div style={{fontSize:13,fontWeight:600,marginBottom:2}}>{o.material}</div>
              <div className="mono" style={{fontSize:11,color:"var(--pec-ink-muted)"}}>{o.materialNo} · Batch {o.batch}</div>
              {o.exceptionReason && <div style={{fontSize:11,color:"var(--pec-warning)",marginTop:4,display:"flex",alignItems:"center",gap:4}}><Icon name="alert" size={12}/>{o.exceptionReason}</div>}
            </div>
            <div>
              <div className="mono tnum" style={{fontSize:13,fontWeight:600}}>{o.qty.planned.toLocaleString()} {o.qty.uom}</div>
              <div style={{fontSize:11,color:"var(--pec-ink-muted)"}}>{o.customer}</div>
            </div>
            <div>
              <div style={{fontSize:13,marginBottom:4}}>{o.phase}</div>
              <div style={{height:4,background:"var(--pec-bg)",borderRadius:2,overflow:"hidden"}}>
                <div style={{width:`${o.progress}%`,height:"100%",background:o.status==="exception"?"var(--pec-warning)":o.status==="blocked"?"var(--pec-danger)":o.status==="complete"?"var(--pec-success)":"var(--pec-brand)"}}></div>
              </div>
            </div>
            <div style={{fontSize:12,color:"var(--pec-ink-muted)"}}>{o.line}</div>
            <div style={{fontSize:13}}>{o.due}</div>
            <div style={{textAlign:"right"}}>
              <StatusBadge s={o.status}/>
            </div>
          </div>
        ))}
      </div>

      <div style={{marginTop:24,display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
        <div className="kpi">
          <div className="kpi__lbl">Shift target</div>
          <div className="kpi__val">11<span style={{color:"var(--pec-ink-muted)",fontSize:18,fontWeight:400}}>/14 orders</span></div>
          <div className="kpi__sub">3 ahead of plan</div>
        </div>
        <div className="kpi">
          <div className="kpi__lbl">Open exceptions</div>
          <div className="kpi__val">3</div>
          <div className="kpi__sub"><span style={{color:"var(--pec-danger)"}}>1 critical</span> · 2 monitoring</div>
        </div>
        <div className="kpi">
          <div className="kpi__lbl">Avg phase cycle</div>
          <div className="kpi__val">26.4<span style={{fontSize:18,color:"var(--pec-ink-muted)"}}>m</span></div>
          <div className="kpi__sub kpi__delta--up">▲ 6.8% vs plan</div>
        </div>
      </div>
    </div>
  );
};

window.QueuePage = QueuePage;
