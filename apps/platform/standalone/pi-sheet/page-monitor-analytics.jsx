/* === Supervisor Monitor + Analytics === */

const Sparkline = ({ data, color = "var(--pec-brand)", w=120, h=36 }) => {
  const max = Math.max(...data), min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v,i)=>`${(i/(data.length-1))*w},${h - ((v-min)/range)*(h-4) - 2}`).join(" ");
  return <svg width={w} height={h} style={{display:"block"}}><polyline fill="none" stroke={color} strokeWidth="1.75" points={pts}/></svg>;
};

const SupervisorPage = ({ openExc }) => {
  const [filter, setFilter] = React.useState("all");
  const lines = MOCK.SUPERVISOR_LINES.filter(l => filter==="all" || (filter==="exception" && (l.state==="exception"||l.state==="blocked")));
  return (
    <div className="page">
      <div className="page-h">
        <div>
          <div className="eyebrow">Beloit, WI · Shift B · live</div>
          <h1>Work center monitor</h1>
          <p>Live state of every line, with intervention cues for exceptions, holds, and delays. Updated every 5 s.</p>
        </div>
        <div className="row-flex">
          <span className="badge badge--success"><Icon name="activity" size={11}/> Live · 13:54:22</span>
          <button className="btn"><Icon name="filter" size={14}/> Saved views</button>
        </div>
      </div>

      <div className="grid-4" style={{marginBottom:20}}>
        <div className="kpi"><div className="kpi__lbl">Lines running</div><div className="kpi__val">3<span style={{color:"var(--pec-ink-muted)",fontSize:14}}>/6</span></div><div className="kpi__sub kpi__delta--up">▲ 1 vs avg</div><div style={{position:"absolute",right:8,bottom:8}}><Sparkline data={[2,3,4,3,3,3]} color="var(--pec-brand)"/></div></div>
        <div className="kpi"><div className="kpi__lbl">Plant OEE</div><div className="kpi__val">81%</div><div className="kpi__sub">Target 85%</div><div style={{position:"absolute",right:8,bottom:8}}><Sparkline data={[78,79,80,80,82,81]} color="var(--pec-success)"/></div></div>
        <div className="kpi" style={{borderLeft:"3px solid var(--pec-danger)"}}><div className="kpi__lbl">Critical exceptions</div><div className="kpi__val" style={{color:"var(--pec-danger)"}}>1</div><div className="kpi__sub">Needs intervention</div></div>
        <div className="kpi"><div className="kpi__lbl">Orders due this shift</div><div className="kpi__val">11<span style={{color:"var(--pec-ink-muted)",fontSize:14}}>/14</span></div><div className="kpi__sub">3 ahead of plan</div></div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1.6fr 1fr",gap:20}}>
        <div className="card">
          <div className="card__h">
            <Icon name="factory" size={16} style={{color:"var(--pec-brand)"}}/>
            <h3>Lines · 6</h3>
            <div className="actions">
              <button className={`chip ${filter==="all"?"is-active":""}`} onClick={()=>setFilter("all")}>All</button>
              <button className={`chip ${filter==="exception"?"is-active":""}`} onClick={()=>setFilter("exception")}>Exceptions</button>
            </div>
          </div>
          <div>
            {lines.map(l=>{
              const stateClr = l.state==="running"?"var(--pec-success)":l.state==="exception"?"var(--pec-warning)":l.state==="blocked"?"var(--pec-danger)":l.state==="changeover"?"var(--pec-info)":"var(--pec-ink-soft)";
              return (
                <div key={l.id} style={{display:"grid",gridTemplateColumns:"4px 1.4fr 1fr 1fr 80px 100px",gap:14,padding:"14px 16px",borderBottom:"1px solid var(--pec-border)",alignItems:"center"}}>
                  <div style={{height:36,background:stateClr,borderRadius:2}}></div>
                  <div>
                    <div style={{fontSize:13,fontWeight:600}}>{l.name}</div>
                    <div className="row-flex" style={{marginTop:4}}>
                      <span className="dot" style={{background:stateClr}}></span>
                      <span style={{fontSize:11,color:"var(--pec-ink-muted)",textTransform:"capitalize"}}>{l.state.replace("_"," ")}</span>
                      {l.exceptions>0 && <span className="badge badge--warning" style={{height:18,fontSize:10}}>{l.exceptions} exc</span>}
                    </div>
                  </div>
                  <div>
                    <div className="mono" style={{fontSize:12,fontWeight:600}}>{l.order}</div>
                    <div style={{fontSize:11,color:"var(--pec-ink-muted)"}}>{l.phase}</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:6,fontSize:12}}>
                    <Icon name="user" size={12} style={{color:"var(--pec-ink-muted)"}}/>{l.op}
                  </div>
                  <div className="mono tnum" style={{fontSize:13,fontWeight:600,textAlign:"right"}}>{l.oee}%</div>
                  <div style={{textAlign:"right"}}>
                    {l.state==="exception"||l.state==="blocked" ? <button className="btn btn--ghost" style={{height:28,fontSize:11,color:"var(--pec-warning)"}} onClick={openExc}>Intervene <Icon name="arrowRight" size={11}/></button> : <button className="btn btn--ghost" style={{height:28,fontSize:11}}>View <Icon name="chevronRight" size={11}/></button>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="col-flex">
          <div className="card">
            <div className="card__h"><Icon name="siren" size={16} style={{color:"var(--pec-danger)"}}/><h3>Intervention queue · 2</h3></div>
            <div style={{padding:"4px 0"}}>
              {MOCK.EXCEPTIONS.filter(e=>e.severity!=="info").map(e=>(
                <div key={e.id} style={{padding:"12px 16px",borderTop:"1px solid var(--pec-border)"}}>
                  <div className="row-flex" style={{marginBottom:4}}>
                    <span className="mono" style={{fontSize:12,fontWeight:600}}>{e.id}</span>
                    {e.severity==="critical" && <span className="badge badge--danger">Critical</span>}
                    {e.severity==="blocking" && <span className="badge badge--hold">Blocking</span>}
                    <span style={{marginLeft:"auto",fontSize:11,color:"var(--pec-ink-muted)"}}>{e.openedAt}</span>
                  </div>
                  <div className="mono" style={{fontSize:11,color:"var(--pec-brand)",marginBottom:4}}>{e.order} · {e.phase}</div>
                  <div style={{fontSize:13,marginBottom:8}}>{e.reason}</div>
                  <div className="row-flex">
                    <button className="btn btn--primary" style={{height:30,fontSize:12}} onClick={openExc}>Take action</button>
                    <button className="btn" style={{height:30,fontSize:12}}>Reassign</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card__h"><Icon name="users" size={16} style={{color:"var(--pec-brand)"}}/><h3>Operators on shift · 6</h3></div>
            <div style={{padding:"4px 0"}}>
              {[
                {n:"Mei Chen",l:"Line 01",s:"running"},
                {n:"Raj Patel",l:"Line 02",s:"exception"},
                {n:"Tomi Okafor",l:"Line 04",s:"blocked"},
                {n:"Sofia Garza",l:"Line 05",s:"running"},
                {n:"Daniel Brooks",l:"Floater",s:"available"},
                {n:"Aisha Rahman",l:"QA Lab",s:"running"},
              ].map(o=>(
                <div key={o.n} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 16px",borderTop:"1px solid var(--pec-border)"}}>
                  <div style={{width:28,height:28,borderRadius:"50%",background:"var(--pec-brand-soft)",color:"var(--pec-brand)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:600}}>
                    {o.n.split(" ").map(x=>x[0]).join("")}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:500}}>{o.n}</div>
                    <div style={{fontSize:11,color:"var(--pec-ink-muted)"}}>{o.l}</div>
                  </div>
                  <span className="dot" style={{background:o.s==="running"?"var(--pec-success)":o.s==="exception"?"var(--pec-warning)":o.s==="blocked"?"var(--pec-danger)":"var(--pec-info)"}}></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const AnalyticsPage = () => (
  <div className="page">
    <div className="page-h">
      <div>
        <div className="eyebrow">Databricks Gold · pec_execution_v2</div>
        <h1>Execution analytics</h1>
        <p>30-day performance across queue health, cycle time, exceptions, and yield. Used for trend, not real-time decisions.</p>
      </div>
      <div className="row-flex">
        <span className="badge badge--info"><Icon name="clock" size={11}/> Refreshed 12 min ago</span>
        <button className="btn"><Icon name="download" size={14}/> Export</button>
      </div>
    </div>

    <div className="banner banner--info" style={{marginBottom:20}}>
      <Icon name="info" size={18} className="banner__icon" style={{color:"var(--pec-info)"}}/>
      <div className="banner__body"><strong>Analytical, not transactional.</strong> Numbers below come from the Gold semantic layer with 5-min refresh. For live shop-floor state, use Work Center Monitor.</div>
    </div>

    <div className="grid-3" style={{marginBottom:20}}>
      {MOCK.ANALYTICS_KPIS.map(k=>(
        <div key={k.lbl} className="kpi" style={{paddingBottom:24}}>
          <div className="kpi__lbl">{k.lbl}</div>
          <div className="kpi__val">{k.val}</div>
          <div className={`kpi__sub ${k.delta==="up"?"kpi__delta--up":"kpi__delta--down"}`}>
            {k.delta==="up"?"▲":"▼"} {k.sub}
          </div>
          <div style={{position:"absolute",right:12,bottom:8}}>
            <Sparkline data={k.data} color={k.delta==="up"?"var(--pec-success)":"var(--pec-warning)"} w={140} h={40}/>
          </div>
        </div>
      ))}
    </div>

    <div style={{display:"grid",gridTemplateColumns:"1.4fr 1fr",gap:20}}>
      <div className="card">
        <div className="card__h"><Icon name="chart" size={16} style={{color:"var(--pec-brand)"}}/><h3>Phase cycle time · last 7 days</h3></div>
        <div style={{padding:"16px 24px"}}>
          <svg viewBox="0 0 600 220" style={{width:"100%",height:220}}>
            {/* y grid */}
            {[0,1,2,3,4].map(i=>(
              <line key={i} x1="40" x2="580" y1={20+i*40} y2={20+i*40} stroke="var(--pec-border)" strokeWidth="1"/>
            ))}
            {/* y labels */}
            {[40,32,24,16,8].map((v,i)=>(
              <text key={i} x="32" y={24+i*40} fontSize="10" fill="var(--pec-ink-muted)" textAnchor="end" fontFamily="IBM Plex Mono">{v}m</text>
            ))}
            {/* bars per phase */}
            {[
              {p:"P1",a:14,t:12},{p:"P2",a:28,t:30},{p:"P3",a:26,t:24},{p:"P4",a:18,t:16},{p:"P5",a:12,t:14},{p:"P6",a:22,t:24},{p:"P7",a:10,t:12},{p:"P8",a:8,t:8},
            ].map((b,i)=>{
              const x = 60 + i*64;
              return (
                <g key={i}>
                  <rect x={x} y={180-b.a*4} width="20" height={b.a*4} fill="var(--pec-brand)" rx="2"/>
                  <rect x={x+22} y={180-b.t*4} width="20" height={b.t*4} fill="var(--pec-success)" opacity="0.4" rx="2"/>
                  <text x={x+20} y="200" fontSize="10" fill="var(--pec-ink-muted)" textAnchor="middle" fontFamily="IBM Plex Mono">{b.p}</text>
                </g>
              );
            })}
          </svg>
          <div className="row-flex" style={{justifyContent:"center",gap:24,marginTop:8,fontSize:12}}>
            <span className="row-flex"><span className="dot" style={{background:"var(--pec-brand)"}}></span> Actual</span>
            <span className="row-flex"><span className="dot" style={{background:"var(--pec-success)",opacity:0.6}}></span> Target</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card__h"><Icon name="alert" size={16} style={{color:"var(--pec-warning)"}}/><h3>Exception rate by category</h3></div>
        <div style={{padding:16}}>
          {[
            {n:"Out-of-tolerance parameter",v:42,c:"var(--pec-warning)"},
            {n:"Material variance",v:24,c:"var(--pec-info)"},
            {n:"QA hold",v:18,c:"var(--pec-hold)"},
            {n:"Equipment fault",v:11,c:"var(--pec-danger)"},
            {n:"Operator-raised",v:5,c:"var(--pec-ink-muted)"},
          ].map(r=>(
            <div key={r.n} style={{padding:"8px 0",borderTop:"1px solid var(--pec-border)"}}>
              <div className="row-flex" style={{marginBottom:6}}>
                <span style={{flex:1,fontSize:13}}>{r.n}</span>
                <span className="mono tnum" style={{fontSize:12,fontWeight:600}}>{r.v}%</span>
              </div>
              <div style={{height:6,background:"var(--pec-bg)",borderRadius:999,overflow:"hidden"}}>
                <div style={{width:`${r.v*2}%`,height:"100%",background:r.c}}></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

window.SupervisorPage = SupervisorPage;
window.AnalyticsPage = AnalyticsPage;
window.Sparkline = Sparkline;
