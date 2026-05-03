/* Module 7 — Traceability & Reconciliation Workbench */
const ModuleTrace = ({ openDrawer }) => {
  const T = window.TPM;
  const lot = T.traceLot;
  const r = lot.recon;
  return (
    <>
      <div className="grid-12 mb-16">
        <div className="col-3">
          <Card title="Selected lot" sub="Investigative scope" flush>
            <div style={{padding:14}}>
              <div className="t-cap">Batch</div>
              <div className="t-h2 mono mt-4">{lot.lot}</div>
              <div className="muted mt-4">{lot.material}</div>
              <div style={{fontSize:12, marginTop:6}}>{lot.desc}</div>
              <div className="mt-12"><Badge kind="risk">Mismatch · −12,450 kg at return</Badge></div>
              <div className="row gap-8 mt-12">
                <button className="btn btn-sm"><Icon name="search" size={11}/> Change lot</button>
                <button className="btn btn-sm"><Icon name="link" size={11}/> Relations</button>
              </div>
            </div>
          </Card>
          <Card className="mt-16" title="Root-cause grouping" sub="Mismatches with same signature">
            <div className="row between" style={{fontSize:12, marginBottom:6}}><span>Return overdue + Saraburi</span><Badge kind="risk">11 lots</Badge></div>
            <div className="row between" style={{fontSize:12, marginBottom:6}}><span>Yield variance &gt;3% · granulation</span><Badge kind="pending">7 lots</Badge></div>
            <div className="row between" style={{fontSize:12, marginBottom:6}}><span>Missing batch link · T802</span><Badge kind="pending">3 lots</Badge></div>
            <div className="row between" style={{fontSize:12}}><span>Qty short on return &lt;2%</span><Badge kind="neutral">5 lots</Badge></div>
          </Card>
        </div>

        <div className="col-9">
          <Card title="Quantity reconciliation across lifecycle" sub="Source → TPM in → Process out → Return → Onward"
                actions={<button className="btn btn-ghost btn-sm"><Icon name="refresh" size={12}/> Recompute</button>}>
            <div className="recon">
              <div className="recon-cell is-balanced"><span className="lbl">Source GI · K140</span><span className="val">{T.fmtN(r.source)}</span><span className="delta">kg · STO 4400188412</span></div>
              <div className="recon-cell is-balanced"><span className="lbl">TPM GR · T803</span><span className="val">{T.fmtN(r.tpmIn)}</span><span className="delta">Δ 0 · balanced</span></div>
              <div className="recon-cell"><span className="lbl">Process out</span><span className="val">{T.fmtN(r.processOut)}</span><span className="delta" style={{color:'var(--status-pending)'}}>yield 94.3% · Δ −750</span></div>
              <div className="recon-cell is-mismatch"><span className="lbl">Return GR</span><span className="val">{T.fmtN(r.returnRcv)}</span><span className="delta">expected {T.fmtN(r.returnExp)} · 6d late</span></div>
              <div className="recon-cell"><span className="lbl">Customer / onward</span><span className="val">{T.fmtN(r.fulfil)}</span><span className="delta">SO-7700981221</span></div>
              <div style={{display:'flex', alignItems:'center', justifyContent:'center', padding:'0 8px'}}>
                <Badge kind="risk">Δ −12,450 kg</Badge>
              </div>
            </div>

            <div className="section-h" style={{marginTop:20}}>Chain of custody</div>
            <div className="grid-12" style={{gap:0}}>
              <div className="col-12">
                <div style={{display:'grid', gridTemplateColumns:'repeat(7,1fr)', alignItems:'stretch', gap:0}}>
                  {lot.chain.map((n,i)=>{
                    const stage = T.stages.find(s=>s.id===n.stage);
                    const cls = n.status==='risk'?'risk':n.status==='warn'?'warn':n.status==='pending'?'pending':'ok';
                    const color = n.status==='risk'?'var(--status-risk)':n.status==='warn'?'var(--status-pending)':n.status==='pending'?'var(--ink-faint)':'var(--status-ok)';
                    return (
                      <div key={i} style={{padding:14, borderRight: i<lot.chain.length-1?'1px solid var(--line-soft)':'0', position:'relative'}}>
                        <div style={{display:'flex', alignItems:'center', gap:6, marginBottom:6}}>
                          <span style={{width:18, height:18, borderRadius:'50%', background: color+'22', border:'2px solid '+color, color, display:'inline-flex', alignItems:'center', justifyContent:'center'}}>
                            {n.status==='risk' ? <Icon name="alert" size={9}/> : n.status==='ok' ? <Icon name="check" size={9}/> : <Icon name="clock" size={9}/>}
                          </span>
                          <span className="t-cap" style={{fontSize:9}}>{stage?stage.short:n.stage}</span>
                        </div>
                        <div style={{fontSize:12, fontWeight:700, color:'var(--ink-strong)'}}>{n.ttl}</div>
                        <div className="muted mono" style={{fontSize:10, marginTop:4}}>{n.id}</div>
                        <div className="muted mono" style={{fontSize:10}}>{n.plant.split(' ')[0]}</div>
                        <div className="num" style={{marginTop:6, fontSize:13, fontWeight:600}}>{n.qty!=null? T.fmtN(n.qty) : '—'}</div>
                        <div className="muted" style={{fontSize:10}}>{n.meta}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </Card>

          <div className="grid-12 mt-16">
            <div className="col-7">
              <Card title="Document & batch linkage" sub="Hops between source documents, deliveries, GRs, batches">
                <table className="tbl">
                  <thead><tr><th>Hop</th><th>Document</th><th>Batch</th><th>Type</th><th>Status</th></tr></thead>
                  <tbody>
                    <tr><td>Source PR/PO</td><td className="code">PO 4500218714</td><td className="code">B-K140-77508-A019</td><td>Parent</td><td><Badge kind="ok">Linked</Badge></td></tr>
                    <tr><td>STO</td><td className="code">STO-4400188412</td><td className="code">B-K140-77508-A019</td><td>Move</td><td><Badge kind="ok">Linked</Badge></td></tr>
                    <tr><td>Outbound delivery</td><td className="code">PGI 8000266</td><td className="code">B-K140-77508-A019</td><td>Issue</td><td><Badge kind="ok">Linked</Badge></td></tr>
                    <tr><td>GR @ TPM</td><td className="code">GR 5101204881</td><td className="code">B-2510-D</td><td>Split</td><td><Badge kind="ok">Linked</Badge></td></tr>
                    <tr><td>Process</td><td className="code">PRC-088240</td><td className="code">B-2510-D</td><td>In/Out</td><td><Badge kind="pending">Yield −5.7%</Badge></td></tr>
                    <tr className="is-risk-row"><td>Return GR</td><td className="code muted">— missing</td><td className="code">B-2510-D</td><td>Receive</td><td><Badge kind="risk">Not posted</Badge></td></tr>
                    <tr className="is-warn-row"><td>Customer SO</td><td className="code">SO-7700981221</td><td className="code">B-2510-D</td><td>Allocate</td><td><Badge kind="pending">Awaiting GR</Badge></td></tr>
                  </tbody>
                </table>
              </Card>
            </div>
            <div className="col-5">
              <Card title="Timing analysis" sub="Lag vs true exception">
                <div style={{padding:'4px 0'}}>
                  {[
                    {l:'STO → GR @ TPM', actual: 3, exp: 4, ok: true},
                    {l:'GR → Process start', actual: 0, exp: 1, ok: true},
                    {l:'Process duration', actual: 16, exp: 10, ok: false, sev: 'risk'},
                    {l:'Process end → Return ship', actual: 6, exp: 2, ok: false, sev: 'risk'},
                    {l:'Return transit', actual: '—', exp: 4, pending: true},
                    {l:'Return → Onward allocation', actual: '—', exp: 1, pending: true},
                  ].map((s,i)=>(
                    <div key={i} style={{display:'grid', gridTemplateColumns:'1fr auto auto', gap:10, alignItems:'center', padding:'7px 0', borderBottom:i<5?'1px solid var(--line-soft)':'0'}}>
                      <div style={{fontSize:12}}>{s.l}</div>
                      <div className="num" style={{fontSize:12, color: s.pending?'var(--ink-muted)':!s.ok?'var(--status-risk)':'var(--ink-strong)'}}>
                        {s.actual}{!s.pending && 'd'} <span className="muted" style={{marginLeft:4, fontSize:10}}>/ {s.exp}d</span>
                      </div>
                      <div style={{minWidth:60}}>
                        {s.pending ? <Badge kind="neutral">Pending</Badge> : s.ok ? <Badge kind="ok">In tolerance</Badge> : <Badge kind="risk">Exception</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
                <Alert kind="info" ttl="Lag vs exception logic" body="Within expected window = lag (informational). Beyond expected + 50% = true exception (escalates)." />
              </Card>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
window.ModuleTrace = ModuleTrace;
