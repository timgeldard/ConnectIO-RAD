/* Module 4 — Toll Process / Execution Tracker */
const ModuleProcess = ({ openDrawer }) => {
  const T = window.TPM;
  return (
    <>
      <div className="grid-12 mb-16">
        <div className="col-3"><Kpi label="Active processes" value={124} unit="" delta={-3} status="info" spark={[130,128,128,127,126,125,125,124,124]}/></div>
        <div className="col-3"><Kpi label="Avg yield" value={94.2} unit="%" delta={-0.6} status="pending" spark={[95.1,95,94.8,94.6,94.4,94.3,94.3,94.2,94.2]}/></div>
        <div className="col-3"><Kpi label="Avg turnaround" value={9.8} unit="d" delta={+1.4} status="pending" spark={[8.0,8.2,8.5,8.8,9.0,9.2,9.4,9.6,9.8]}/></div>
        <div className="col-3"><Kpi label="TAT exceeded" value={18} unit="lots" delta={+5} status="risk" spark={[10,11,12,13,14,15,16,17,18]}/></div>
      </div>

      <div className="grid-12 mb-16">
        <div className="col-7">
          <Card title="Process queue throughput" sub="Started · in process · finished — last 14 days">
            <svg viewBox="0 0 600 160" style={{width:'100%', height:160}}>
              {[20,60,100,140].map(y=> <line key={y} x1="0" x2="600" y1={y} y2={y} className="gridline"/>)}
              {[...Array(14)].map((_,i) => {
                const x = 20 + i*42;
                const heights = [60+Math.sin(i)*15, 70+Math.cos(i*0.7)*20, 50+Math.sin(i*1.1)*10];
                return (
                  <g key={i}>
                    <rect x={x} y={140-heights[0]} width="10" height={heights[0]} fill="var(--chart-1)"/>
                    <rect x={x+11} y={140-heights[1]} width="10" height={heights[1]} fill="var(--chart-2)"/>
                    <rect x={x+22} y={140-heights[2]} width="10" height={heights[2]} fill="var(--chart-3)"/>
                  </g>
                );
              })}
            </svg>
            <div className="row gap-16 mt-4" style={{fontSize:11, color:'var(--ink-muted)'}}>
              <span className="row gap-4"><i style={{width:10,height:10,background:'var(--chart-1)'}}/> Started</span>
              <span className="row gap-4"><i style={{width:10,height:10,background:'var(--chart-2)'}}/> In process</span>
              <span className="row gap-4"><i style={{width:10,height:10,background:'var(--chart-3)'}}/> Finished</span>
            </div>
          </Card>
        </div>
        <div className="col-5">
          <Card title="Yield variance by step" sub="Last 30 days · expected vs actual">
            <table className="tbl">
              <thead><tr><th>Step</th><th className="num">Lots</th><th className="num">Yield</th><th className="num">Variance</th></tr></thead>
              <tbody>
                <tr><td>Hydrolysis</td><td className="num">42</td><td className="num">94.8%</td><td className="num"><span style={{color:'var(--status-pending)'}}>−1.2%</span></td></tr>
                <tr><td>Granulation</td><td className="num">28</td><td className="num">91.4%</td><td className="num"><span style={{color:'var(--status-risk)'}}>−4.6%</span></td></tr>
                <tr><td>Microencapsulation</td><td className="num">18</td><td className="num">95.6%</td><td className="num"><span style={{color:'var(--status-ok)'}}>+0.6%</span></td></tr>
                <tr><td>Reaction</td><td className="num">22</td><td className="num">93.2%</td><td className="num"><span style={{color:'var(--status-pending)'}}>−2.8%</span></td></tr>
                <tr><td>Distillation</td><td className="num">14</td><td className="num">91.0%</td><td className="num"><span style={{color:'var(--status-risk)'}}>−3.0%</span></td></tr>
              </tbody>
            </table>
          </Card>
        </div>
      </div>

      <Card title="Process execution queue" sub="Active and recently completed processes at TPM plants" flush>
        <table className="tbl">
          <thead><tr>
            <th>Process</th><th>TPM plant</th><th>Material</th><th>Step</th>
            <th className="num">Qty in</th><th className="num">Qty out</th><th>Yield</th>
            <th>TAT</th><th>Status</th><th></th>
          </tr></thead>
          <tbody>
            {T.processQueue.map(p => (
              <tr key={p.id} className={p.status==='risk'?'is-risk-row':p.status==='pending'?'is-warn-row':''}
                  onClick={()=>openDrawer({type:'process', payload: p})}>
                <td className="code">{p.id}</td>
                <td><Plant code={p.plant}/></td>
                <td><div style={{fontWeight:600}}>{p.desc}</div><div className="muted code" style={{fontSize:10}}>{p.mat}</div></td>
                <td><span className="stage-badge">{p.step}</span></td>
                <td className="num">{T.fmtN(p.qtyIn)}</td>
                <td className="num">{p.qtyOut ? T.fmtN(p.qtyOut) : <span className="muted">—</span>}</td>
                <td style={{width:140}}>
                  {p.yieldPct != null ? (
                    <div className="row gap-8">
                      <span className="num" style={{minWidth:38, color:p.varPct<-3?'var(--status-risk)':p.varPct<-1?'var(--status-pending)':'var(--ink-strong)'}}>{p.yieldPct}%</span>
                      <CellBar value={p.yieldPct} max={100} status={p.varPct<-3?'risk':p.varPct<-1?'pending':'ok'}/>
                    </div>
                  ) : <span className="muted">processing</span>}
                </td>
                <td className="num"><span style={{color:p.tat>p.expTat?'var(--status-risk)':'var(--ink)'}}>{p.tat}d</span><span className="muted" style={{marginLeft:4,fontSize:10}}>/{p.expTat}d</span></td>
                <td>{p.status==='ok'?<Badge kind="ok">On track</Badge>:p.status==='risk'?<Badge kind="risk">TAT/Yield risk</Badge>:p.started?<Badge kind="pending">Aging</Badge>:<Badge kind="neutral">Not started</Badge>}</td>
                <td><Icon name="chevron-r" size={14} className="muted"/></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="card__ft">
          <span><b>Expected lag</b> normal processing window is 5–10d depending on step. <b>True exception</b> = TAT > expected + 50%.</span>
        </div>
      </Card>
    </>
  );
};
window.ModuleProcess = ModuleProcess;
