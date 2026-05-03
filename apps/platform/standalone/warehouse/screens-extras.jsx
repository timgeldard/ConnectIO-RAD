/* Overview, Consolidated Picking, Layouts, Audit screens */

const ExtraScreens = (() => {
  const { trs, operators, queues, consolidations, auditLog, orders } = window.DATA;

  // ============================================================ Overview
  function Overview() {
    return (
      <div className="page">
        <div className="page-head">
          <div>
            <div className="eyebrow">Module · Workload Health</div>
            <h1 className="h-impact">Overview</h1>
          </div>
          <div className="grow"/>
          <div className="meta">
            <span><b>02 May 2026</b> · 08:14 IST</span>
            <span>Shift A · Day 122</span>
          </div>
        </div>

        <div style={{display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12}}>
          <div className="kpi accent-slate">
            <span className="label">Open TRs</span>
            <span className="value">14</span>
            <span className="sub"><Icon name="arrowDown" size={11} className="delta-up"/><span className="delta-up mono">−3</span> vs yesterday</span>
          </div>
          <div className="kpi accent-jade">
            <span className="label">Picked today</span>
            <span className="value">38</span>
            <span className="sub mono" style={{color:'var(--jade)'}}>83% on-time</span>
          </div>
          <div className="kpi accent-sunset">
            <span className="label">Aged &gt; 30m</span>
            <span className="value">3</span>
            <span className="sub" style={{color:'var(--sunset)'}}>1 critical</span>
          </div>
          <div className="kpi accent-lime">
            <span className="label">Auto-assigned</span>
            <span className="value">12</span>
            <span className="sub mono">avg 1m 12s wait</span>
          </div>
        </div>

        <div className="split" style={{gridTemplateColumns:'1.5fr 1fr', gap:12}}>
          <div className="card">
            <div className="card-head">
              <Icon name="layers" size={14}/>
              <span className="h">Workload — next 24h</span>
              <span className="grow"/>
              <span className="mono" style={{fontSize:10, color:'var(--ink-500)'}}>HOUR · QUEUE</span>
            </div>
            <div className="card-body">
              <div className="heat">
                <div className="row-label"></div>
                {Array.from({length:24}).map((_,i) => <div key={i} className="axis">{String(i).padStart(2,'0')}</div>)}
                {queues.map((q, qi) => (
                  <React.Fragment key={q.id}>
                    <div className="row-label">{q.id}</div>
                    {Array.from({length:24}).map((_,h) => {
                      const peak = (h>=8 && h<=11) || (h>=14 && h<=17);
                      const r = (Math.sin(qi*1.7+h*0.6)+1)/2;
                      const lv = peak ? Math.min(5, Math.round(r*4)+1) : Math.round(r*3);
                      const cls = lv === 0 ? '' : 'l'+lv;
                      return <div key={h} className={'cell ' + cls}/>;
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <Icon name="users" size={14}/>
              <span className="h">Operator load</span>
              <span className="grow"/>
              <span className="mono" style={{fontSize:10, color:'var(--ink-500)'}}>{operators.filter(o=>o.status!=='off').length} on shift</span>
            </div>
            <div className="card-body" style={{display:'flex', flexDirection:'column', gap:6}}>
              {operators.filter(o=>o.status!=='off').slice(0,6).map(o => (
                <div key={o.id} className="op-card" style={{cursor:'default'}}>
                  <span className="av">{o.init}<span className={'pres '+o.status}/></span>
                  <span className="meta">
                    <span className="name">{o.name}</span>
                    <span className="sub">{o.queue} · {o.jobs} jobs</span>
                  </span>
                  <div className="progress" style={{width:80, flex:'none'}}>
                    <div className="fill" style={{width:`${o.load*100}%`, background: o.load>0.8?'var(--sunset)':'var(--valentia-slate)'}}/>
                  </div>
                  <span className="load">{Math.round(o.load*100)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="split" style={{gridTemplateColumns:'1fr 1fr', gap:12}}>
          <div className="card">
            <div className="card-head">
              <Icon name="warn" size={14}/>
              <span className="h">Exceptions</span>
            </div>
            <div className="card-body" style={{padding:0}}>
              <table className="tbl">
                <thead><tr><th>Where</th><th>Issue</th><th>Action</th></tr></thead>
                <tbody>
                  <tr><td className="mono">TR 0010024190</td><td>Stock shortage on yeast extract (42/60 KG)</td><td><a style={{color:'var(--valentia-slate)', fontWeight:600, fontSize:11.5}}>Reroute →</a></td></tr>
                  <tr><td className="mono">TR 0010024191</td><td>Aged 105m, completed but not confirmed</td><td><a style={{color:'var(--valentia-slate)', fontWeight:600, fontSize:11.5}}>Confirm →</a></td></tr>
                  <tr><td className="mono">PO 70044187</td><td>TR not created — see creation log</td><td><a style={{color:'var(--valentia-slate)', fontWeight:600, fontSize:11.5}}>Inspect →</a></td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <Icon name="sparkles" size={14}/>
              <span className="h">Recommendations</span>
            </div>
            <div className="card-body" style={{display:'flex',flexDirection:'column',gap:10}}>
              <div className="why">
                <div className="why-title"><Icon name="merge" size={11}/>Consolidate Salt Microcrystal</div>
                <ul>
                  <li>4 TRs share material 1100-S-MCS-25 in Bulk Storage B.</li>
                  <li>Estimated saving: 52 minutes of operator time.</li>
                </ul>
              </div>
              <div className="why" style={{background:'color-mix(in srgb, var(--sage) 12%, white)', borderColor:'color-mix(in srgb, var(--sage) 35%, white)'}}>
                <div className="why-title"><Icon name="zap" size={11}/>Reassign aged BD job</div>
                <ul>
                  <li>TR 0010024187 has been open 12m, queue Q-WHB-01 has 2 free operators.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================ Consolidated Picking
  function Consolidated() {
    const [sel, setSel] = React.useState(consolidations[1].material);
    const c = consolidations.find(x => x.material === sel);
    return (
      <div className="page">
        <div className="page-head">
          <div>
            <div className="eyebrow">Module · Materials Workbench</div>
            <h1 className="h-impact">Consolidated Picking</h1>
          </div>
          <div className="grow"/>
          <div className="meta">
            <span>Pick the same material in <b>one hit</b> across multiple TRs.</span>
          </div>
        </div>

        <div className="split split-2080">
          <div className="card" style={{padding:0}}>
            <div className="card-head"><span className="h">Supply areas</span></div>
            <div style={{padding:6, display:'flex', flexDirection:'column', gap:2}}>
              {[
                {id:'all', name:'All', count: consolidations.length},
                {id:'BSA', name:'Bulk Storage A', count: 1},
                {id:'BSB', name:'Bulk Storage B', count: 2},
                {id:'DSP', name:'Dispensary', count: 0},
              ].map(s => (
                <button key={s.id} className="op-card" style={{justifyContent:'space-between'}}>
                  <span className="meta"><span className="name">{s.name}</span></span>
                  <span className="mono" style={{fontSize:11, color:'var(--ink-500)'}}>{s.count}</span>
                </button>
              ))}
            </div>
          </div>

          <div style={{display:'flex',flexDirection:'column', gap:12}}>
            <div className="card" style={{padding:0}}>
              <div className="card-head">
                <Icon name="merge" size={14}/>
                <span className="h">Eligible consolidations</span>
                <span className="grow"/>
                <button className="btn btn-secondary btn-sm"><Icon name="filter"/>Filter</button>
              </div>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Material</th>
                    <th>Description</th>
                    <th>Supply area</th>
                    <th className="num">Total req.</th>
                    <th className="num">TRs</th>
                    <th>Time saved</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {consolidations.map(x => (
                    <tr key={x.material} className={sel===x.material?'selected':''} onClick={() => setSel(x.material)}>
                      <td className="mono strong">{x.material}</td>
                      <td>{x.desc}</td>
                      <td>{x.supplyArea}</td>
                      <td className="num">{x.totalReq} {x.unit}</td>
                      <td className="num">{x.satisfies}</td>
                      <td><span className="chip chip-lime"><Icon name="clock" size={10}/>{x.savings}</span></td>
                      <td><Icon name="chevron" size={14}/></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="split" style={{gridTemplateColumns:'1.4fr 1fr', gap:12}}>
              <div className="card">
                <div className="card-head"><Icon name="boxes" size={14}/><span className="h">Build consolidated TR · {c.material}</span></div>
                <div className="card-body" style={{display:'flex',flexDirection:'column', gap:14}}>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                    <Field label="Material" val={c.material} mono/>
                    <Field label="Description" val={c.desc}/>
                    <Field label="Supply area" val={c.supplyArea}/>
                    <Field label="PSA" val={c.psa} mono/>
                    <div>
                      <div className="eyebrow" style={{marginBottom:4}}>Requested qty</div>
                      <div style={{display:'flex',alignItems:'baseline',gap:6}}>
                        <input className="input" defaultValue={c.totalReq} style={{width:120, fontFamily:'var(--font-mono)', fontWeight:600}}/>
                        <span className="mono">{c.unit}</span>
                      </div>
                    </div>
                    <Field label="Satisfies" val={`${c.satisfies} TRs`}/>
                  </div>
                  <div className="eyebrow">TRs satisfied</div>
                  <div style={{display:'flex', flexWrap:'wrap', gap:6}}>
                    {c.trs.map(tr => <span key={tr} className="chip"><Icon name="check" size={10}/>{tr}</span>)}
                  </div>
                  <div style={{display:'flex', gap:8}}>
                    <button className="btn btn-secondary"><Icon name="eye"/>Preview pick path</button>
                    <span className="grow"/>
                    <button className="btn btn-primary"><Icon name="plus"/>Create TR &amp; route to assignment</button>
                  </div>
                </div>
              </div>
              <div className="why">
                <div className="why-title"><Icon name="info" size={11}/>Why "one hit"</div>
                <ul>
                  <li>{c.satisfies} separate TRs all need {c.material} from {c.supplyArea}.</li>
                  <li>Picking once, then splitting at staging, removes {c.satisfies-1} round trips.</li>
                  <li>Estimated saving: <b>{c.savings}</b> at current operator velocity.</li>
                  <li>Resulting TR will appear in Dispatch with type <b>ST</b>.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function Field({ label, val, mono }) {
    return (
      <div>
        <div className="eyebrow" style={{marginBottom:4}}>{label}</div>
        <div className={mono?'mono':''} style={{fontSize:13, fontWeight:500}}>{val}</div>
      </div>
    );
  }

  // ============================================================ Layouts
  function Layouts() {
    const cols = [
      {k:'tr', l:'TR Number', g:'Identity', on:true, locked:true},
      {k:'type', l:'Type', g:'Identity', on:true},
      {k:'status', l:'Status', g:'Identity', on:true},
      {k:'material', l:'Material', g:'Identity', on:true},
      {k:'desc', l:'Description', g:'Identity', on:true},
      {k:'psa', l:'PSA', g:'Routing', on:true},
      {k:'line', l:'Process Line Description', g:'Routing', on:true},
      {k:'srcBin', l:'Source Bin', g:'Routing', on:false},
      {k:'dstBin', l:'Destination Bin', g:'Routing', on:false},
      {k:'linesWM', l:'Lines WM required/picked', g:'Lines', on:true},
      {k:'linesDsp', l:'Lines Dispensary required/picked', g:'Lines', on:true},
      {k:'progress', l:'Progress bar', g:'Lines', on:true},
      {k:'operator', l:'Operator', g:'Assignment', on:true},
      {k:'queue', l:'Queue', g:'Assignment', on:true},
      {k:'shipment', l:'Shipment', g:'Assignment', on:true},
      {k:'sold', l:'Sold-to Description', g:'Assignment', on:false},
      {k:'age', l:'Age', g:'Aging', on:true},
      {k:'created', l:'Created at', g:'Aging', on:false},
      {k:'completed', l:'Completed at', g:'Aging', on:false},
      {k:'priority', l:'Priority', g:'Aging', on:false},
    ];
    const groups = [...new Set(cols.map(c=>c.g))];
    const views = [
      {n:'My Warehouse', d:'Production-relevant TRs only', mine:true, def:true},
      {n:'Dispensary Only', d:'Source = D, Lines Disp ≥ 1'},
      {n:'Aged Jobs', d:'Open TRs older than 30 minutes'},
      {n:'My Queues', d:'Queues I supervise (Q-WHB-01, Q-DSP-01)', mine:true},
      {n:'Operator (RF)', d:'Filter to TRs assigned to current operator', system:true},
      {n:'Floor Manager', d:'KPIs + open exceptions only'},
    ];
    return (
      <div className="page">
        <div className="page-head">
          <div>
            <div className="eyebrow">Module · Personalisation</div>
            <h1 className="h-impact">Layouts &amp; Views</h1>
          </div>
          <div className="grow"/>
          <div className="meta">
            <span>Per-user column layouts replace SAP "change layout" dialog.</span>
          </div>
        </div>

        <div className="split" style={{gridTemplateColumns:'1fr 1fr', gap:12}}>
          <div className="card">
            <div className="card-head">
              <Icon name="column" size={14}/>
              <span className="h">Column manager · Job Assignment</span>
              <span className="grow"/>
              <button className="btn btn-secondary btn-sm"><Icon name="save"/>Save</button>
            </div>
            <div className="card-body" style={{display:'flex',flexDirection:'column',gap:14}}>
              {groups.map(g => (
                <div key={g}>
                  <div className="eyebrow" style={{marginBottom:8}}>{g}</div>
                  <div style={{display:'flex',flexDirection:'column',gap:4}}>
                    {cols.filter(c=>c.g===g).map(c => (
                      <label key={c.k} style={{display:'flex',alignItems:'center',gap:10,padding:'6px 8px',borderRadius:6, background: c.on?'color-mix(in srgb, var(--valentia-slate) 5%, white)':'transparent'}}>
                        <input type="checkbox" className="cb" defaultChecked={c.on} disabled={c.locked}/>
                        <span style={{fontSize:12.5, fontWeight: c.on?500:400}}>{c.l}</span>
                        <span className="grow"/>
                        {c.locked && <Icon name="lock" size={11} style={{color:'var(--ink-400)'}}/>}
                        <Icon name="chevronDown" size={12} style={{color:'var(--ink-400)', transform:'rotate(-90deg)'}}/>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <div className="card">
              <div className="card-head">
                <Icon name="star" size={14}/>
                <span className="h">Saved views</span>
                <span className="grow"/>
                <button className="btn btn-primary btn-sm"><Icon name="plus"/>New view</button>
              </div>
              <div style={{padding:6, display:'flex',flexDirection:'column',gap:2}}>
                {views.map(v => (
                  <div key={v.n} className="op-card" style={{cursor:'default'}}>
                    <span className="av" style={{background: v.def?'var(--innovation)':'var(--stone-100)', color:'var(--forest)'}}>
                      {v.def ? <Icon name="star" size={14}/> : v.system ? <Icon name="settings" size={14}/> : <Icon name="eye" size={14}/>}
                    </span>
                    <span className="meta">
                      <span className="name">{v.n} {v.def && <span className="chip chip-lime" style={{marginLeft:6}}>DEFAULT</span>} {v.system && <span className="chip" style={{marginLeft:6}}>SYSTEM</span>}</span>
                      <span className="sub">{v.d}</span>
                    </span>
                    <Icon name="chevron" size={14}/>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <div className="card-head"><Icon name="users" size={14}/><span className="h">Operator (RF) view</span></div>
              <div className="card-body">
                <div className="why">
                  <div className="why-title"><Icon name="info" size={11}/>Operators see less, on purpose</div>
                  <ul>
                    <li>RF operators only see <b>production-relevant TRs</b> assigned or auto-routed to them.</li>
                    <li>They cannot create or unassign TRs; supervisors retain full control.</li>
                    <li>Layout includes: TR, Material, Bin, Qty, Lines, Status — nothing else.</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================ Audit
  function Audit() {
    const iconMap = { check:'check', x:'x', warn:'warn', plus:'plus', user:'user', merge:'merge', rf:'rf', in:'in' };
    const colorMap = { completed:'var(--jade)', error:'var(--sunset)', warning:'var(--sunrise)', created:'var(--valentia-slate)', assigned:'var(--valentia-slate)', consolidated:'var(--sage)', 'auto-assigned':'var(--innovation)', opened:'var(--ink-400)' };
    return (
      <div className="page">
        <div className="page-head">
          <div>
            <div className="eyebrow">Module · Trust &amp; trace</div>
            <h1 className="h-impact">Audit &amp; Logs</h1>
          </div>
          <div className="grow"/>
          <div className="meta">
            <span>Modern equivalent of the SAP message log — every change tied to who, what, when.</span>
          </div>
        </div>

        <div className="split" style={{gridTemplateColumns:'1.4fr 1fr', gap:12}}>
          <div className="card" style={{padding:0}}>
            <div className="toolbar" style={{borderRadius:'8px 8px 0 0'}}>
              <button className="btn btn-secondary btn-sm"><Icon name="filter"/>All actions</button>
              <button className="btn btn-secondary btn-sm"><Icon name="user"/>Any user</button>
              <button className="btn btn-secondary btn-sm"><Icon name="clock"/>Today</button>
              <span className="grow"/>
              <button className="btn btn-secondary btn-sm"><Icon name="download"/>Export</button>
            </div>
            <div style={{padding:'4px 0'}}>
              {auditLog.map((r,i) => (
                <div key={i} style={{display:'grid', gridTemplateColumns:'72px 22px 1fr auto', gap:12, padding:'10px 14px', borderBottom:'1px solid var(--stone-100)', alignItems:'center'}}>
                  <span className="mono" style={{fontSize:11, color:'var(--ink-500)'}}>{r.ts}</span>
                  <span style={{display:'grid',placeItems:'center', color: colorMap[r.action]||'var(--ink-500)'}}>
                    <Icon name={iconMap[r.icon]||'info'} size={14}/>
                  </span>
                  <span style={{minWidth:0}}>
                    <div style={{fontSize:12.5, lineHeight:1.3}}>
                      <span className="mono" style={{fontWeight:600}}>{r.who}</span>
                      <span style={{color:'var(--ink-500)'}}> · </span>
                      <span style={{textTransform:'uppercase', fontFamily:'var(--font-mono)', fontSize:10, letterSpacing:'0.06em', color: colorMap[r.action]||'var(--forest)'}}>{r.action}</span>
                      <span style={{color:'var(--ink-500)'}}> · </span>
                      <b>{r.target}</b>
                    </div>
                    <div style={{fontSize:11.5, color:'var(--ink-500)', marginTop:1}}>{r.details}</div>
                  </span>
                  <a style={{color:'var(--valentia-slate)', fontSize:11, fontWeight:600}}>Trace →</a>
                </div>
              ))}
            </div>
          </div>

          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            <div className="card">
              <div className="card-head"><Icon name="info" size={14}/><span className="h">Today's activity</span></div>
              <div className="card-body" style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
                <Stat n={42} l="Actions"/>
                <Stat n={3} l="Errors" c="sunset"/>
                <Stat n={6} l="TRs created"/>
                <Stat n={2} l="Reassignments"/>
              </div>
            </div>
            <div className="why">
              <div className="why-title"><Icon name="lock" size={11}/>Retention &amp; integrity</div>
              <ul>
                <li>Logs are append-only and retained 7 years (Kerry IT policy).</li>
                <li>Each entry includes RF terminal ID, IP, plant + warehouse context.</li>
                <li>Stock-check warnings are linked to the SAP simulation trace ID.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function Stat({n, l, c}) {
    return (
      <div style={{padding:10, background:'var(--stone-100)', borderRadius:6}}>
        <div className="mono" style={{fontSize:24, fontWeight:700, color: c?`var(--${c})`:'var(--forest)', lineHeight:1}}>{n}</div>
        <div className="eyebrow" style={{marginTop:4}}>{l}</div>
      </div>
    );
  }

  return { Overview, Consolidated, Layouts, Audit };
})();

window.Overview = ExtraScreens.Overview;
window.Consolidated = ExtraScreens.Consolidated;
window.LayoutsScreen = ExtraScreens.Layouts;
window.Audit = ExtraScreens.Audit;
