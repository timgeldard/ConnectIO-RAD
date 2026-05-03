/* === Electronic Batch Record / Order Record Review === */

const EBRPage = () => {
  const [active, setActive] = React.useState("4.0");
  const [approval, setApproval] = React.useState(null); // null | "approved" | "rejected"

  const SectionContent = ({num}) => {
    if (num === "1.0") return (
      <>
        <div className="grid-2" style={{gap:16,marginBottom:16}}>
          <div className="ctx-card"><h4>Order header</h4>
            <div className="row"><span className="muted">Process order</span><span className="v mono">PO-1004812</span></div>
            <div className="row"><span className="muted">Material</span><span className="v">MAT-220-91183</span></div>
            <div className="row"><span className="muted">Description</span><span className="v">Savory Roast Chicken Seasoning Blend</span></div>
            <div className="row"><span className="muted">Quantity</span><span className="v mono">1,200 KG</span></div>
            <div className="row"><span className="muted">Customer</span><span className="v">Tyson Foods — Foodservice</span></div>
            <div className="row"><span className="muted">Plant</span><span className="v">Beloit, WI · Line 01</span></div>
          </div>
          <div className="ctx-card"><h4>Control recipe</h4>
            <div className="row"><span className="muted">Recipe</span><span className="v mono">RECIPE-220-V14</span></div>
            <div className="row"><span className="muted">Control recipe</span><span className="v mono">CR-220-91183-04812</span></div>
            <div className="row"><span className="muted">Released by</span><span className="v">M. Henderson · Process Eng</span></div>
            <div className="row"><span className="muted">Released at</span><span className="v mono">2026-05-02 13:38</span></div>
            <div className="row"><span className="muted">Effectivity</span><span className="v">2026-01-15 → ongoing</span></div>
            <div className="row"><span className="muted">Approval</span><span className="v"><span className="badge badge--success">Approved v14</span></span></div>
          </div>
        </div>
        <div className="signature"><div className="signature__avatar">MH</div><div className="signature__meta" style={{flex:1}}><strong>M. Henderson — Process Engineer</strong><span className="when">Released control recipe · 2026-05-02 13:38:14 UTC · 21 CFR Part 11</span></div><Icon name="checkCircle" size={20} style={{color:"var(--pec-success)"}}/></div>
      </>
    );
    if (num === "4.0") return (
      <>
        <div className="grid-3" style={{gap:12,marginBottom:16}}>
          <div className="kpi" style={{padding:12}}><div className="kpi__lbl">Started</div><div style={{fontSize:16,fontWeight:600,fontVariantNumeric:"tabular-nums"}} className="mono">14:28:30</div></div>
          <div className="kpi" style={{padding:12}}><div className="kpi__lbl">Status</div><div style={{fontSize:14,fontWeight:600,color:"var(--pec-brand)"}}>In progress · step 3.3</div></div>
          <div className="kpi" style={{padding:12}}><div className="kpi__lbl">Recorded values</div><div style={{fontSize:16,fontWeight:600,fontVariantNumeric:"tabular-nums"}} className="mono">9</div></div>
        </div>

        <h3 style={{fontSize:14,fontWeight:600,margin:"20px 0 10px"}}>Captured parameters · Phase 3 to date</h3>
        <table className="tbl">
          <thead><tr><th>Step</th><th>Parameter</th><th>Target</th><th>Range</th><th>Recorded</th><th>By</th><th>When</th></tr></thead>
          <tbody>
            <tr><td className="mono">3.1</td><td>Reactor charge total verified</td><td colSpan="2">—</td><td><span className="badge badge--success">Pass</span></td><td>M. Chen</td><td className="mono">14:30:11</td></tr>
            <tr><td className="mono">3.2</td><td>Blender speed</td><td className="mono tnum">160 RPM</td><td className="mono tnum">150–170</td><td className="mono tnum">160 RPM</td><td>M. Chen</td><td className="mono">14:31:42</td></tr>
            <tr><td className="mono">3.2</td><td>Blender start time</td><td>—</td><td>—</td><td className="mono">14:31:48</td><td>M. Chen</td><td className="mono">14:31:48</td></tr>
            <tr style={{background:"var(--pec-brand-soft)"}}><td className="mono">3.3</td><td>Chamber temperature</td><td className="mono tnum">32.0 °C</td><td className="mono tnum">28.0–36.0</td><td className="mono tnum" style={{fontWeight:600}}>31.4 °C</td><td>M. Chen</td><td className="mono">14:39:22</td></tr>
            <tr style={{background:"var(--pec-brand-soft)"}}><td className="mono">3.3</td><td>Ribbon torque</td><td className="mono tnum">14.5 A</td><td className="mono tnum">12.0–17.0</td><td className="mono tnum" style={{fontWeight:600}}>14.2 A</td><td>M. Chen</td><td className="mono">14:39:22</td></tr>
            <tr style={{background:"var(--pec-brand-soft)"}}><td className="mono">3.3</td><td>Chamber pressure</td><td className="mono tnum">0.0 kPa</td><td className="mono tnum">-0.5 to 0.5</td><td className="mono tnum" style={{fontWeight:600}}>0.1 kPa</td><td>M. Chen</td><td className="mono">14:39:22</td></tr>
            <tr style={{background:"var(--pec-brand-soft)"}}><td className="mono">3.3</td><td>Moisture (NIR)</td><td className="mono tnum">4.5 %</td><td className="mono tnum">3.5–5.5</td><td className="mono tnum" style={{fontWeight:600}}>4.3 %</td><td>M. Chen</td><td className="mono">14:39:22</td></tr>
          </tbody>
        </table>

        <h3 style={{fontSize:14,fontWeight:600,margin:"20px 0 10px"}}>Postings & confirmations</h3>
        <div className="card" style={{borderRadius:6}}>
          {[
            {ts:"14:31:48",t:"PI-CON 4 confirmation posted — phase 3 start"},
            {ts:"14:39:22",t:"Process value capture — 4 parameters recorded"},
          ].map((e,i)=>(
            <div key={i} style={{padding:"10px 14px",borderTop:i?"1px solid var(--pec-border)":"0",display:"flex",gap:12,alignItems:"center"}}>
              <span className="mono" style={{fontSize:11,color:"var(--pec-ink-muted)",minWidth:60}}>{e.ts}</span>
              <Icon name="checkCircle" size={14} style={{color:"var(--pec-success)"}}/>
              <span style={{fontSize:13}}>{e.t}</span>
            </div>
          ))}
        </div>
      </>
    );
    if (num === "9.0") return (
      <>
        <p className="muted" style={{fontSize:13}}>Recorded deviations and exceptions for this order. All require disposition before final approval.</p>
        <div className="card" style={{marginTop:12}}>
          <div style={{padding:"14px 16px",borderBottom:"1px solid var(--pec-border)"}}>
            <div className="row-flex" style={{marginBottom:6}}>
              <span className="badge badge--info">Info</span>
              <strong style={{fontSize:14}}>EX-2839 · Flavor charge under target</strong>
              <span style={{marginLeft:"auto",fontSize:11,color:"var(--pec-ink-muted)"}} className="mono">14:23:09</span>
            </div>
            <div style={{fontSize:13,marginBottom:8}}>MAT-440-66301 charged at 95.8 KG vs 96.0 KG planned (−0.21%). Within material spec; flagged for trend analysis.</div>
            <div style={{fontSize:12,color:"var(--pec-ink-muted)"}}>Disposition: Accept-as-is · M. Chen at 14:23:30 · auto-recorded by system</div>
          </div>
        </div>
      </>
    );
    return <div className="muted" style={{padding:"40px 0",textAlign:"center"}}><Icon name="info" size={28}/><div style={{marginTop:8}}>Section content rendered for Section {num}.</div><div style={{fontSize:12,marginTop:6}}>Includes captured values, postings, signatures, and notes for this section.</div></div>;
  };

  return (
    <div className="ebr">
      {/* TOC */}
      <div className="ebr__toc">
        <div className="mono" style={{fontSize:10,letterSpacing:"0.1em",textTransform:"uppercase",color:"var(--pec-ink-muted)",marginBottom:8,padding:"0 8px"}}>Order record · PO-1004812</div>
        <div style={{padding:"0 8px 16px",borderBottom:"1px solid var(--pec-border)",marginBottom:12}}>
          <div style={{fontWeight:700,fontSize:15,letterSpacing:"-0.01em"}}>Savory Roast Chicken<br/>Seasoning Blend</div>
          <div className="mono" style={{fontSize:11,color:"var(--pec-ink-muted)",marginTop:4}}>Batch B26-04812 · 1,200 KG</div>
          <div style={{marginTop:10,display:"flex",gap:6,flexWrap:"wrap"}}>
            <span className="badge badge--warning">Review pending</span>
            <span className="badge badge--info">In progress</span>
          </div>
        </div>
        {MOCK.EBR_SECTIONS.map(s=>(
          <div key={s.num} className={`toc-item ${active===s.num?"is-active":""} ${s.pending?"is-pending":""}`} onClick={()=>setActive(s.num)}>
            <span className="toc-item__num">{s.num}</span>
            <span style={{flex:1,opacity:s.pending?0.5:1}}>{s.title}</span>
            {s.current && <span className="dot" style={{background:"var(--pec-brand)"}}></span>}
            {s.sigs > 0 && <span style={{fontSize:11,color:"var(--pec-success)",display:"flex",alignItems:"center",gap:2}}><Icon name="pen" size={10}/>{s.sigs}</span>}
            {s.count > 0 && !s.current && <span className="toc-item__count">{s.count}</span>}
          </div>
        ))}
      </div>

      {/* Main */}
      <div className="ebr__main">
        <div style={{display:"flex",alignItems:"baseline",gap:14,marginBottom:6}}>
          <div className="mono" style={{fontSize:11,letterSpacing:"0.08em",textTransform:"uppercase",color:"var(--pec-brand)"}}>Electronic Batch Record</div>
          <span style={{color:"var(--pec-ink-muted)",fontSize:11}}>·</span>
          <span className="mono" style={{fontSize:11,color:"var(--pec-ink-muted)"}}>Generated 2026-05-02 14:42 from CR-220-91183-04812</span>
        </div>
        <h1 style={{margin:"0 0 4px",fontSize:28,fontWeight:700,letterSpacing:"-0.015em"}}>Order record — PO-1004812</h1>
        <p className="muted" style={{margin:"0 0 24px",fontSize:14}}>Compiled from execution events, postings, and operator signatures. All entries are timestamped and version-locked.</p>

        <div className="ebr-section">
          <div className="ebr-section__h">
            <span className="ebr-section__num">SECTION {active}</span>
            <h2>{MOCK.EBR_SECTIONS.find(s=>s.num===active)?.title}</h2>
            <span className="meta">{MOCK.EBR_SECTIONS.find(s=>s.num===active)?.count || 0} entries</span>
          </div>
          <SectionContent num={active}/>
        </div>
      </div>

      {/* Approval drawer */}
      <div className="ebr__aside">
        <div style={{marginBottom:16}}>
          <div className="mono" style={{fontSize:10,letterSpacing:"0.1em",textTransform:"uppercase",color:"var(--pec-ink-muted)",marginBottom:8}}>QA Reviewer</div>
          <div className="signature">
            <div className="signature__avatar" style={{background:"var(--pec-warning-bg)",color:"var(--pec-warning)"}}>AR</div>
            <div className="signature__meta" style={{flex:1}}>
              <strong>Aisha Rahman</strong>
              <span className="when">QA · Reviewing</span>
            </div>
          </div>
        </div>

        <div className="ctx-card" style={{marginBottom:12}}>
          <h4><Icon name="shield" size={12}/> Approval state</h4>
          {approval === null && <>
            <div style={{fontSize:13,marginBottom:10}}>Record is open and not yet final. Phase 3 in progress; sections 5–8 will populate as execution proceeds.</div>
            <div className="row" style={{borderTop:"1px solid var(--pec-border)",paddingTop:8}}><span className="muted">Sections complete</span><span className="v mono">3 / 12</span></div>
            <div className="row"><span className="muted">Signatures captured</span><span className="v mono">7</span></div>
            <div className="row"><span className="muted">Open deviations</span><span className="v mono" style={{color:"var(--pec-warning)"}}>1 (info)</span></div>
          </>}
          {approval === "approved" && <>
            <span className="badge badge--success badge--lg">Approved · Phase 3</span>
            <div style={{fontSize:12,color:"var(--pec-ink-muted)",marginTop:8}}>Phase-level approval recorded. Final approval requires sections 5–12 to complete.</div>
          </>}
          {approval === "rejected" && <>
            <span className="badge badge--danger badge--lg">Requires correction</span>
            <div style={{fontSize:12,color:"var(--pec-ink-muted)",marginTop:8}}>Returned to operator with comments. Phase will be re-opened for rework.</div>
          </>}
        </div>

        <div className="col-flex">
          <button className="btn btn--success btn--block" onClick={()=>setApproval("approved")} disabled={approval==="approved"}>
            <Icon name="check" size={14}/> Approve phase 3
          </button>
          <button className="btn btn--block" style={{borderColor:"var(--pec-danger)",color:"var(--pec-danger)"}} onClick={()=>setApproval("rejected")} disabled={approval==="rejected"}>
            <Icon name="x" size={14}/> Request correction
          </button>
          <button className="btn btn--ghost btn--block"><Icon name="notes" size={14}/> Add review comment</button>
          <button className="btn btn--ghost btn--block"><Icon name="download" size={14}/> Download record (PDF)</button>
        </div>

        <div className="ctx-card" style={{marginTop:16}}>
          <h4><Icon name="history" size={12}/> Audit trail · last 5</h4>
          {[
            {t:"14:42:11",who:"system",txt:"Record snapshot generated"},
            {t:"14:39:22",who:"M. Chen",txt:"Captured Step 3.3 parameters"},
            {t:"14:28:30",who:"M. Chen",txt:"Phase 3 started"},
            {t:"14:28:14",who:"M. Chen",txt:"Phase 2 sign-off"},
            {t:"13:38:14",who:"M. Henderson",txt:"Released control recipe v14"},
          ].map((e,i)=>(
            <div key={i} style={{display:"flex",gap:8,padding:"6px 0",borderTop:i?"1px solid var(--pec-border)":"0",fontSize:11}}>
              <span className="mono" style={{color:"var(--pec-ink-muted)",minWidth:48}}>{e.t}</span>
              <span style={{flex:1}}><strong>{e.who}</strong> {e.txt}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

window.EBRPage = EBRPage;
