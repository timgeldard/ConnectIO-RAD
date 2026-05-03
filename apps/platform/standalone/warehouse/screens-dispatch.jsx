/* Job Assignment / Dispatch screen */

const Dispatch = (() => {
  const { trs, operators, queues } = window.DATA;

  function StatusChip({ s }) {
    const map = { A: ['chip-A', 'Open'], B: ['chip-B', 'WIP'], C: ['chip-C', 'Done'] };
    const [cls, lbl] = map[s] || ['chip-A','—'];
    return <span className={'chip '+cls}><span className="dot"/>{s} {lbl}</span>;
  }
  function TypeChip({ t }) {
    const map = { BD: 'Bulk Drop', TR: 'Disp. Pick', DC: 'Disp. Repl.', ST: 'Staging' };
    return <span className="chip" title={map[t]}>{t}</span>;
  }
  function ProgressFor({ tr }) {
    const tot = (tr.linesWM||0) + (tr.linesDsp||0);
    const done = (tr.pickedWM||0) + (tr.pickedDsp||0);
    const pct = tot ? Math.round(done/tot*100) : 0;
    return (
      <div style={{display:'flex', alignItems:'center', gap:8, minWidth:120}}>
        <div className={'progress' + (tr.status==='C'?' ok':'')}><div className="fill" style={{width: pct+'%'}}/></div>
        <span className="mono" style={{fontSize:10.5, color:'var(--ink-500)', minWidth:38, textAlign:'right'}}>{done}/{tot}</span>
      </div>
    );
  }
  function AgeChip({ age }) {
    if (age >= 30) return <span className="chip chip-warn"><Icon name="clock" size={10}/>{age}m</span>;
    if (age >= 60) return <span className="chip chip-danger"><Icon name="warn" size={10}/>{age}m</span>;
    return <span className="mono" style={{fontSize:11, color:'var(--ink-500)'}}>{age}m</span>;
  }

  function Dispatch() {
    const [tab, setTab] = React.useState('Open');
    const [selTR, setSelTR] = React.useState('0010024190');
    const [stockBusy, setStockBusy] = React.useState(false);
    const [stockResult, setStockResult] = React.useState(null);
    const [autoOn, setAutoOn] = React.useState(true);

    const filtered = trs.filter(t => {
      if (tab === 'Open') return t.status === 'A';
      if (tab === 'WIP') return t.status === 'B';
      if (tab === 'Done') return t.status === 'C';
      if (tab === 'Auto-assign') return t.autoAssign;
      return true;
    });
    const sel = trs.find(t => t.tr === selTR);

    const runStockCheck = () => {
      setStockBusy(true);
      setStockResult(null);
      setTimeout(() => {
        setStockBusy(false);
        setStockResult(sel?.stockOk ? { ok: true, msg: `Stock confirmed for ${sel.qty} ${sel.unit}` } : { ok: false, msg: sel?.stockMsg });
      }, 900);
    };

    return (
      <div className="page">
        <div className="page-head">
          <div>
            <div className="eyebrow">Module · Dispatch</div>
            <h1 className="h-impact">Job Assignment</h1>
          </div>
          <div className="grow"/>
          <div className="meta">
            <span><b>{trs.filter(t=>t.status==='A').length}</b> open</span>
            <span><b>{trs.filter(t=>t.status==='B').length}</b> WIP</span>
            <span><b>{trs.filter(t=>t.autoAssign).length}</b> auto-queued</span>
            <span><b>{operators.filter(o=>o.status!=='off').length}</b> operators on shift</span>
          </div>
          <button className={'btn ' + (autoOn?'btn-lime':'btn-secondary')} onClick={() => setAutoOn(!autoOn)}>
            <Icon name="rf"/>RF auto-assign · {autoOn?'ON':'OFF'}
          </button>
        </div>

        <div className="split split-3070">
          <div className="card" style={{padding:0, overflow:'hidden'}}>
            <div className="tabs">
              {['Open','WIP','Done','Auto-assign'].map(t => (
                <button key={t} className={'tab' + (tab===t?' active':'')} onClick={() => setTab(t)}>
                  {t}
                  <span className="count">{
                    t==='Open'?trs.filter(x=>x.status==='A').length :
                    t==='WIP'?trs.filter(x=>x.status==='B').length :
                    t==='Done'?trs.filter(x=>x.status==='C').length :
                    trs.filter(x=>x.autoAssign).length
                  }</span>
                </button>
              ))}
            </div>
            <div className="toolbar" style={{borderRadius:0}}>
              <button className="btn btn-secondary btn-sm"><Icon name="filter"/>Status: any</button>
              <button className="btn btn-secondary btn-sm"><Icon name="users"/>Operator: any</button>
              <button className="btn btn-secondary btn-sm"><Icon name="queue"/>Queue: any</button>
              <button className="btn btn-secondary btn-sm"><Icon name="clock"/>Age: any</button>
              <div className="grow"/>
              <button className="btn btn-secondary btn-sm"><Icon name="column"/>Columns</button>
            </div>
            <div style={{maxHeight:'calc(100vh - 360px)', overflow:'auto'}}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>TR</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Material · Description</th>
                    <th>Process Line</th>
                    <th>Lines WM</th>
                    <th>Lines Disp.</th>
                    <th>Progress</th>
                    <th>Operator</th>
                    <th>Queue</th>
                    <th>Age</th>
                    <th>Shipment</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(t => {
                    const op = operators.find(o => o.id === t.operator);
                    return (
                      <tr key={t.tr} className={(selTR===t.tr?'selected ':'') + (t.age>=30?'is-aged':'')} onClick={() => setSelTR(t.tr)}>
                        <td className="mono strong">{t.tr}</td>
                        <td><TypeChip t={t.type}/></td>
                        <td><StatusChip s={t.status}/></td>
                        <td>
                          <div style={{display:'flex',flexDirection:'column',lineHeight:1.2}}>
                            <span className="strong">{t.desc}</span>
                            <span className="mono" style={{fontSize:10.5, color:'var(--ink-500)'}}>{t.material}</span>
                          </div>
                        </td>
                        <td>{t.line}</td>
                        <td className="mono">{t.linesWM ? `${t.pickedWM}/${t.linesWM}` : '—'}</td>
                        <td className="mono">{t.linesDsp ? `${t.pickedDsp}/${t.linesDsp}` : '—'}</td>
                        <td><ProgressFor tr={t}/></td>
                        <td>{op ? (
                          <span style={{display:'inline-flex', alignItems:'center', gap:6}}>
                            <span style={{width:20, height:20, borderRadius:999, background:'var(--valentia-slate)', color:'#fff', display:'inline-grid', placeItems:'center', fontSize:9, fontWeight:700}}>{op.init}</span>
                            <span style={{fontSize:11.5}}>{op.name.split(' ')[0]}</span>
                          </span>
                        ) : t.autoAssign ? <span className="chip chip-lime"><Icon name="zap" size={10}/>Auto</span> : <span className="muted" style={{fontSize:11}}>—</span>}</td>
                        <td className="mono" style={{fontSize:11}}>{t.queue || '—'}</td>
                        <td><AgeChip age={t.age}/></td>
                        <td className="mono" style={{fontSize:11}}>{t.shipment}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{display:'flex',flexDirection:'column', gap:12}}>
            {sel && <AssignPanel tr={sel} runStockCheck={runStockCheck} stockBusy={stockBusy} stockResult={stockResult}/>}
            <AutoAssignPanel autoOn={autoOn}/>
          </div>
        </div>
      </div>
    );
  }

  function AssignPanel({ tr, runStockCheck, stockBusy, stockResult }) {
    const [mode, setMode] = React.useState('operator'); // operator | queue | sequence
    const [opSel, setOpSel] = React.useState(null);
    return (
      <div className="card">
        <div className="card-head">
          <Icon name="radio" size={14}/>
          <span className="h">Assign · {tr.tr}</span>
          <span className="grow"/>
          <span style={{fontSize:11, color:'var(--ink-500)'}} className="mono">{tr.material}</span>
        </div>
        <div className="card-body" style={{display:'flex', flexDirection:'column', gap:14}}>
          <div style={{display:'flex', gap:6}}>
            {[
              {k:'operator', l:'Operator', i:'user'},
              {k:'queue',    l:'Queue',    i:'queue'},
              {k:'sequence', l:'Sequence', i:'layers'},
            ].map(t => (
              <button key={t.k} className={'btn ' + (mode===t.k?'btn-primary':'btn-secondary')+' btn-sm'} onClick={() => setMode(t.k)}>
                <Icon name={t.i}/>{t.l}
              </button>
            ))}
          </div>

          {mode === 'operator' && (
            <>
              <div className="eyebrow">Available · {tr.queue || 'all queues'}</div>
              <div style={{display:'flex',flexDirection:'column', gap:2, maxHeight:240, overflow:'auto'}}>
                {operators.filter(o => !tr.queue || o.queue === tr.queue || tr.type==='BD').map(o => (
                  <button key={o.id} className={'op-card' + (opSel===o.id?' selected':'')} onClick={() => setOpSel(o.id)}>
                    <span className="av">{o.init}<span className={'pres '+o.status}/></span>
                    <span className="meta">
                      <span className="name">{o.name}</span>
                      <span className="sub">{o.queue} · {o.shift} · {o.jobs} jobs</span>
                    </span>
                    <span className="load">{Math.round(o.load*100)}%</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {mode === 'queue' && (
            <div style={{display:'flex',flexDirection:'column', gap:8}}>
              {queues.map(q => (
                <button key={q.id} className={'op-card' + (opSel===q.id?' selected':'')} onClick={() => setOpSel(q.id)}>
                  <span className="av" style={{background:`var(--${q.color==='slate'?'valentia-slate':q.color==='sage'?'sage':'sunset'})`}}>
                    <Icon name="queue" size={14}/>
                  </span>
                  <span className="meta">
                    <span className="name">{q.name}</span>
                    <span className="sub">{q.id} · {q.operators} ops · {q.jobs} jobs</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {mode === 'sequence' && (
            <div style={{display:'flex',flexDirection:'column', gap:8}}>
              <div className="eyebrow">Pick sequence</div>
              {[1,2,3,4].map(n => (
                <div key={n} className="op-card" style={{cursor:'default'}}>
                  <span className="av" style={{background:'var(--stone-100)', color:'var(--forest)'}}>{n}</span>
                  <span className="meta">
                    <span className="name">{n===1?tr.tr:`TR 001002419${n+5}`}</span>
                    <span className="sub">{n===1?'Current selection':'Drag to re-order'}</span>
                  </span>
                  <Icon name="chevronDown" size={14}/>
                </div>
              ))}
            </div>
          )}

          <div style={{display:'flex', gap:8}}>
            <button className="btn btn-secondary" onClick={runStockCheck} disabled={stockBusy}>
              <Icon name="sparkles"/>{stockBusy?'Checking…':'Stock check'}
            </button>
            <span className="grow"/>
            <button className="btn btn-ghost btn-sm">Campaign pick</button>
            <button className="btn btn-primary"><Icon name="check"/>Assign</button>
          </div>

          {stockResult && (
            <div className={'why'} style={stockResult.ok ? {} : {background:'color-mix(in srgb, var(--sunset) 10%, white)', borderColor:'color-mix(in srgb, var(--sunset) 30%, white)'}}>
              <div className="why-title">
                <Icon name={stockResult.ok?'check':'warn'} size={11}/>
                Stock simulation result
              </div>
              <ul>
                <li>{stockResult.msg}</li>
                <li>Source bin checked: <span className="mono">{tr.srcBin}</span></li>
                {!stockResult.ok && <li>Suggested: split TR, or release backup batch.</li>}
              </ul>
            </div>
          )}

          {!stockResult && (
            <div className="why">
              <div className="why-title"><Icon name="info" size={11}/>Why this would route to {tr.queue}</div>
              <ul>
                <li>Material {tr.material} is bound to PSA {tr.psa}.</li>
                <li>{tr.line} is mapped to queue {tr.queue} in routing rules.</li>
                <li>Operator filter: dispensary-trained staff only ({tr.type==='TR'||tr.type==='DC'?'enabled':'not required'}).</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  }

  function AutoAssignPanel({ autoOn }) {
    return (
      <div className="card">
        <div className="card-head">
          <Icon name="rf" size={14}/>
          <span className="h">RF Auto-Assign</span>
          <span className="grow"/>
          <span className={'chip ' + (autoOn?'chip-lime':'chip-warn')}>{autoOn?'ENABLED':'PAUSED'}</span>
        </div>
        <div className="card-body" style={{display:'flex', flexDirection:'column', gap:10, fontSize:12}}>
          <div style={{color:'var(--ink-500)', fontSize:11.5}}>
            When an operator logs into an RF gun, the system assigns the first available job from their queue. Aged jobs jump to the front.
          </div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8}}>
            <div className="kpi accent-lime" style={{padding:'10px 12px'}}>
              <span className="label">Next up</span>
              <span className="value" style={{fontSize:22}}>2</span>
              <span className="sub">queued for auto-pick</span>
            </div>
            <div className="kpi accent-slate" style={{padding:'10px 12px'}}>
              <span className="label">Avg wait</span>
              <span className="value" style={{fontSize:22}}>1m 12s</span>
              <span className="sub">login → job</span>
            </div>
          </div>
          <div className="eyebrow" style={{marginTop:4}}>Will auto-assign next</div>
          <div style={{display:'flex',flexDirection:'column', gap:6}}>
            {trs.filter(t=>t.autoAssign).map(t => (
              <div key={t.tr} style={{display:'flex',alignItems:'center', gap:8, padding:'6px 8px', background:'var(--stone-100)', borderRadius:6}}>
                <span className="chip chip-lime"><Icon name="zap" size={10}/>NEXT</span>
                <span className="mono" style={{fontWeight:600, fontSize:11.5}}>{t.tr}</span>
                <span style={{fontSize:11, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{t.desc}</span>
                <span className="mono" style={{fontSize:10.5, color:'var(--ink-500)'}}>{t.queue}</span>
              </div>
            ))}
          </div>
          <button className="btn btn-secondary btn-sm" style={{alignSelf:'flex-start'}}>
            <Icon name="sliders"/>Auto-assign rules
          </button>
        </div>
      </div>
    );
  }

  return { Dispatch };
})();

window.Dispatch = Dispatch.Dispatch;
