/* === Material & Yield, In-Process Quality, Batch & Genealogy, Exceptions === */

const MaterialPage = () => {
  const totalPlanned = MOCK.COMPONENTS.reduce((a,c)=>a+c.planned,0);
  const totalActual = MOCK.COMPONENTS.reduce((a,c)=>a+c.actual,0);
  const variance = ((totalActual - totalPlanned)/totalPlanned*100).toFixed(2);
  return (
    <div className="page">
      <div className="page-h">
        <div>
          <div className="eyebrow">PO-1004812 · Phase 2 — Charge dry components</div>
          <h1>Material consumption & yield</h1>
          <p>Component issues, batch linkage, and yield variance for the active order.</p>
        </div>
        <div className="row-flex">
          <button className="btn"><Icon name="scan" size={14}/> Scan batch</button>
          <button className="btn btn--primary"><Icon name="plus" size={14}/> Issue component</button>
        </div>
      </div>

      <div className="grid-4" style={{marginBottom:20}}>
        <div className="kpi"><div className="kpi__lbl">Planned charge</div><div className="kpi__val">{totalPlanned.toFixed(0)}<span style={{fontSize:14,color:"var(--pec-ink-muted)"}}> KG</span></div><div className="kpi__sub">7 components</div></div>
        <div className="kpi"><div className="kpi__lbl">Actual issued</div><div className="kpi__val">{totalActual.toFixed(1)}<span style={{fontSize:14,color:"var(--pec-ink-muted)"}}> KG</span></div><div className="kpi__sub">7 GIs posted</div></div>
        <div className="kpi"><div className="kpi__lbl">Charge variance</div><div className="kpi__val" style={{color:"var(--pec-warning)"}}>{variance}%</div><div className="kpi__sub">Within ±0.5% spec</div></div>
        <div className="kpi"><div className="kpi__lbl">Expected yield</div><div className="kpi__val">1,196<span style={{fontSize:14,color:"var(--pec-ink-muted)"}}> KG</span></div><div className="kpi__sub">99.7% of plan</div></div>
      </div>

      <div className="card">
        <div className="card__h">
          <Icon name="package" size={16} style={{color:"var(--pec-brand)"}}/>
          <h3>Component consumption · 7 of 7 issued</h3>
          <div className="actions"><button className="btn btn--ghost" style={{height:28,fontSize:12}}><Icon name="download" size={12}/> Export</button></div>
        </div>
        <table className="tbl">
          <thead><tr><th>Material</th><th>Issued batch</th><th style={{textAlign:"right"}}>Planned</th><th style={{textAlign:"right"}}>Actual</th><th style={{textAlign:"right"}}>Variance</th><th>UoM</th><th>Status</th></tr></thead>
          <tbody>
            {MOCK.COMPONENTS.map(c => {
              const v = c.actual - c.planned;
              const vp = (v / c.planned * 100);
              return (
                <tr key={c.matNo}>
                  <td>
                    <div style={{fontWeight:600}}>{c.name}</div>
                    <div className="mono" style={{fontSize:11,color:"var(--pec-ink-muted)"}}>{c.matNo}</div>
                  </td>
                  <td className="mono">{c.batch}</td>
                  <td className="mono tnum" style={{textAlign:"right"}}>{c.planned.toFixed(1)}</td>
                  <td className="mono tnum" style={{textAlign:"right",fontWeight:600}}>{c.actual.toFixed(1)}</td>
                  <td className="mono tnum" style={{textAlign:"right",color:Math.abs(vp)>0.2?"var(--pec-warning)":"var(--pec-ink-muted)"}}>
                    {v >= 0 ? "+" : ""}{v.toFixed(1)} ({vp >= 0 ? "+" : ""}{vp.toFixed(2)}%)
                  </td>
                  <td className="mono">{c.uom}</td>
                  <td>{c.flag === "low" ? <span className="badge badge--warning">Under target</span> : <span className="badge badge--success">In tolerance</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const IPQCPage = () => {
  const checklist = [
    { id:1, t:"Verify QA sample drawn at correct port (SP-101)", done:true },
    { id:2, t:"Sample container labeled with batch B26-04812 and timestamp", done:true },
    { id:3, t:"Sample sealed and routed via pneumatic tube to QC lab", done:false },
    { id:4, t:"QA receipt confirmed in LIMS", done:false },
  ];
  return (
    <div className="page">
      <div className="page-h">
        <div>
          <div className="eyebrow">PO-1004812 · Phase 4 — In-process QC</div>
          <h1>In-process quality & data capture</h1>
          <p>Quality parameters, checklist, and lab routing for this phase. Out-of-range readings escalate automatically.</p>
        </div>
        <div className="row-flex"><button className="btn"><Icon name="paperclip" size={14}/> Attach SOP</button></div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1.4fr 1fr",gap:20}}>
        <div className="card">
          <div className="card__h"><Icon name="flask" size={16} style={{color:"var(--pec-brand)"}}/><h3>Quality parameters · 3 critical</h3></div>
          <div style={{padding:"4px 16px"}}>
            {[
              {n:"Final blend pH", lo:6.4, hi:7.2, target:6.8, current:6.7, unit:"pH", critical:true},
              {n:"Water activity (aw)", lo:0.30, hi:0.40, target:0.35, current:0.34, unit:"aw", critical:true},
              {n:"Particle size D50", lo:180, hi:240, target:210, current:215, unit:"µm", critical:true},
              {n:"Final moisture", lo:3.5, hi:5.5, target:4.5, current:4.4, unit:"%", critical:false},
            ].map((p,i)=>(
              <div key={i} style={{padding:"14px 0",borderTop: i?"1px solid var(--pec-border)":"0",display:"grid",gridTemplateColumns:"1fr 240px",gap:16,alignItems:"center"}}>
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                    <strong style={{fontSize:14}}>{p.n}</strong>
                    {p.critical && <span className="badge badge--danger">Critical</span>}
                  </div>
                  <div className="mono" style={{fontSize:11,color:"var(--pec-ink-muted)",marginBottom:6}}>Target {p.target} {p.unit} · Range {p.lo}–{p.hi} {p.unit}</div>
                  <ToleranceBar lo={p.lo} hi={p.hi} target={p.target} current={p.current}/>
                </div>
                <div className="row-flex">
                  <input className="input input--lg input--mono" placeholder={String(p.current)} style={{textAlign:"center",fontSize:18}}/>
                  <div className="unit" style={{height:48,minWidth:56,justifyContent:"center"}}>{p.unit}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="col-flex">
          <div className="card">
            <div className="card__h"><Icon name="clipboard" size={16} style={{color:"var(--pec-brand)"}}/><h3>Sample handling checklist</h3></div>
            <div style={{padding:"8px 16px 16px"}}>
              {checklist.map(c=>(
                <div key={c.id} style={{display:"flex",gap:10,padding:"10px 0",borderBottom:"1px solid var(--pec-border)",alignItems:"center"}}>
                  <div style={{width:22,height:22,borderRadius:4,border:"2px solid "+(c.done?"var(--pec-success)":"var(--pec-border-strong)"),background:c.done?"var(--pec-success)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",color:"white",flexShrink:0}}>
                    {c.done && <Icon name="check" size={12}/>}
                  </div>
                  <span style={{fontSize:13,textDecoration:c.done?"line-through":"none",color:c.done?"var(--pec-ink-muted)":"var(--pec-ink)"}}>{c.t}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card__h"><Icon name="pen" size={16} style={{color:"var(--pec-brand)"}}/><h3>Operator acknowledgement</h3></div>
            <div style={{padding:16}}>
              <p style={{fontSize:13,color:"var(--pec-ink-muted)",marginTop:0}}>I confirm sample SP-04812-04 was drawn per SOP-QA-220, sealed, labeled, and routed to QC.</p>
              <div className="signature" style={{marginTop:12}}>
                <div className="signature__avatar">MC</div>
                <div className="signature__meta" style={{flex:1}}>
                  <strong>Mei Chen — Process Operator</strong>
                  <span className="when">Pending signature · 21 CFR Part 11</span>
                </div>
                <button className="btn btn--primary"><Icon name="pen" size={14}/> Sign</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const BatchPage = () => (
  <div className="page">
    <div className="page-h">
      <div>
        <div className="eyebrow">PO-1004812 · Genealogy</div>
        <h1>Batch & genealogy capture</h1>
        <p>Batch creation, characteristic assignment, and full input → output linkage for traceability.</p>
      </div>
    </div>

    <div className="grid-2" style={{marginBottom:20}}>
      <div className="card">
        <div className="card__h"><Icon name="package" size={16} style={{color:"var(--pec-brand)"}}/><h3>Output batch</h3><div className="actions"><span className="badge badge--success">Created</span></div></div>
        <div style={{padding:16,display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
          <div><div className="label">Batch number</div><div className="mono" style={{fontSize:18,fontWeight:600}}>B26-04812</div></div>
          <div><div className="label">Material</div><div style={{fontSize:13,fontWeight:600}}>MAT-220-91183</div></div>
          <div><div className="label">Production date</div><div className="mono">2026-05-02</div></div>
          <div><div className="label">Expiry</div><div className="mono">2027-05-02</div></div>
          <div><div className="label">Country of origin</div><div>USA</div></div>
          <div><div className="label">QA status</div><span className="badge badge--warning">Quality inspection</span></div>
        </div>
      </div>
      <div className="card">
        <div className="card__h"><Icon name="sliders" size={16} style={{color:"var(--pec-brand)"}}/><h3>Batch characteristics · 6 of 8</h3></div>
        <div style={{padding:16}}>
          {[
            ["Allergen profile","Wheat-free, dairy-free"],
            ["Kosher","Pareve — OU certified"],
            ["Halal","Yes — IFANCA"],
            ["Organic","No"],
            ["Non-GMO","Verified"],
            ["Country of origin","USA"],
          ].map(([k,v])=>(
            <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderTop:"1px solid var(--pec-border)",fontSize:13}}>
              <span className="muted">{k}</span><span style={{fontWeight:500}}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>

    <div className="card">
      <div className="card__h"><Icon name="git" size={16} style={{color:"var(--pec-brand)"}}/><h3>Genealogy chain · 7 inputs → 1 output</h3></div>
      <div style={{padding:24,display:"flex",gap:32,alignItems:"flex-start",overflow:"auto"}}>
        <div className="geneal__col" style={{flex:"0 0 auto"}}>
          <div className="mono" style={{fontSize:10,letterSpacing:"0.08em",textTransform:"uppercase",color:"var(--pec-ink-muted)",marginBottom:6}}>Input components (7)</div>
          {MOCK.COMPONENTS.map(c=>(
            <div key={c.matNo} className="geneal__node">
              <strong style={{fontSize:12,display:"block"}}>{c.name}</strong>
              <span className="mat">{c.matNo} · {c.batch}</span>
              <div className="mono tnum" style={{fontSize:11,marginTop:4,color:"var(--pec-ink-muted)"}}>{c.actual} {c.uom}</div>
            </div>
          ))}
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",alignSelf:"stretch",minWidth:80}}>
          <Icon name="arrowRight" size={32} style={{color:"var(--pec-brand)",opacity:0.5}}/>
          <div className="mono" style={{fontSize:10,marginTop:8,color:"var(--pec-ink-muted)",letterSpacing:"0.08em",textTransform:"uppercase"}}>Process</div>
          <div style={{fontSize:11,fontWeight:600,marginTop:2,textAlign:"center"}}>Blend &<br/>homogenize</div>
        </div>
        <div className="geneal__col" style={{flex:"0 0 auto"}}>
          <div className="mono" style={{fontSize:10,letterSpacing:"0.08em",textTransform:"uppercase",color:"var(--pec-ink-muted)",marginBottom:6}}>Output batch</div>
          <div className="geneal__node" style={{borderColor:"var(--pec-brand)",background:"var(--pec-brand-soft)",padding:"14px"}}>
            <strong style={{fontSize:13,display:"block"}}>Savory Roast Chicken Seasoning Blend</strong>
            <span className="mat">MAT-220-91183 · B26-04812</span>
            <div className="mono tnum" style={{fontSize:13,marginTop:6,fontWeight:600,color:"var(--pec-brand)"}}>≈ 1,196 KG (expected)</div>
          </div>
          <div className="geneal__node" style={{marginTop:8,borderStyle:"dashed",opacity:0.6}}>
            <strong style={{fontSize:12,display:"block"}}>Yield loss (calculated)</strong>
            <span className="mat">SCRAP-220 · waste stream</span>
            <div className="mono tnum" style={{fontSize:11,marginTop:4,color:"var(--pec-ink-muted)"}}>≈ 4 KG</div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const ExceptionsPage = () => (
  <div className="page">
    <div className="page-h">
      <div>
        <div className="eyebrow">Plant-wide · Shift B</div>
        <h1>Exceptions & holds</h1>
        <p>Open deviations, batch holds, and validation failures across all active orders. All actions are audited.</p>
      </div>
      <div className="row-flex"><button className="btn"><Icon name="filter" size={14}/> Filter</button><button className="btn btn--primary"><Icon name="plus" size={14}/> Raise exception</button></div>
    </div>

    <div className="grid-3" style={{marginBottom:20}}>
      <div className="kpi" style={{borderLeft:"3px solid var(--pec-danger)"}}><div className="kpi__lbl">Critical · open</div><div className="kpi__val" style={{color:"var(--pec-danger)"}}>1</div><div className="kpi__sub">PO-1004807 — pH out of range</div></div>
      <div className="kpi" style={{borderLeft:"3px solid var(--pec-hold)"}}><div className="kpi__lbl">Active holds</div><div className="kpi__val" style={{color:"var(--pec-hold)"}}>1</div><div className="kpi__sub">PO-1004801 — QA release pending</div></div>
      <div className="kpi" style={{borderLeft:"3px solid var(--pec-warning)"}}><div className="kpi__lbl">Monitoring</div><div className="kpi__val" style={{color:"var(--pec-warning)"}}>1</div><div className="kpi__sub">PO-1004812 — minor variance</div></div>
    </div>

    <div className="card">
      <div className="card__h"><Icon name="alert" size={16} style={{color:"var(--pec-warning)"}}/><h3>Open exceptions · 3</h3></div>
      <table className="tbl">
        <thead><tr><th>ID</th><th>Order / phase</th><th>Reason</th><th>Severity</th><th>Opened</th><th>State</th><th>Action</th></tr></thead>
        <tbody>
          {MOCK.EXCEPTIONS.map(e=>(
            <tr key={e.id}>
              <td className="mono" style={{fontWeight:600}}>{e.id}</td>
              <td>
                <div className="mono" style={{fontWeight:600}}>{e.order}</div>
                <div style={{fontSize:11,color:"var(--pec-ink-muted)"}}>{e.phase}</div>
              </td>
              <td style={{maxWidth:300}}>{e.reason}</td>
              <td>
                {e.severity==="critical" && <span className="badge badge--danger">Critical</span>}
                {e.severity==="blocking" && <span className="badge badge--hold">Blocking</span>}
                {e.severity==="info" && <span className="badge badge--info">Info</span>}
              </td>
              <td>
                <div className="mono" style={{fontSize:12}}>{e.openedAt}</div>
                <div style={{fontSize:11,color:"var(--pec-ink-muted)"}}>by {e.openedBy}</div>
              </td>
              <td>
                {e.state==="open" && <span className="badge badge--warning">Open</span>}
                {e.state==="hold" && <span className="badge badge--hold">On hold</span>}
                {e.state==="monitoring" && <span className="badge badge--info">Monitoring</span>}
              </td>
              <td><button className="btn btn--ghost" style={{height:28,fontSize:12}}>Disposition <Icon name="chevronRight" size={12}/></button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

window.MaterialPage = MaterialPage;
window.IPQCPage = IPQCPage;
window.BatchPage = BatchPage;
window.ExceptionsPage = ExceptionsPage;
