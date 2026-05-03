/* Module 5 — Return & Receipt */
const ModuleReturns = ({ openDrawer }) => {
  const T = window.TPM;
  const [tab, setTab] = React.useState('all');
  const list = T.returns.filter(r => tab==='all'?true: tab==='overdue'?r.daysLate>0: tab==='diff'?(r.diff!=null&&r.diff!==0): tab==='ready'?r.status==='ok':true);

  return (
    <>
      <div className="grid-12 mb-16">
        <div className="col-3"><Kpi label="Expected this week" value={42} unit="lots" delta={+4} status="info" spark={[30,32,34,36,38,40,41,42,42]}/></div>
        <div className="col-3"><Kpi label="Overdue receipts" value={11} unit="" delta={+3} status="risk" spark={[5,6,7,8,9,10,11,11,11]}/></div>
        <div className="col-3"><Kpi label="Qty discrepancy" value={6} unit="lots" delta={+2} status="pending" spark={[3,3,4,4,5,5,6,6,6]}/></div>
        <div className="col-3"><Kpi label="Ready for onward" value={284} unit="t" delta={+18} status="ok" spark={[200,210,225,240,255,265,275,280,284]}/></div>
      </div>

      <div className="grid-12 mb-16">
        <div className="col-12">
          <Card title="Expected returns calendar" sub="Next 14 days · width = expected qty">
            <div style={{display:'grid', gridTemplateColumns:'repeat(14,1fr)', gap:4}}>
              {[...Array(14)].map((_,i)=>{
                const d = new Date(2026, 4, 1+i);
                const overdue = i < 2;
                const heavy = [3,5,7,11].includes(i);
                const med = [1,4,8,9,12].includes(i);
                return (
                  <div key={i} style={{
                    background: overdue?'var(--status-risk-bg)':heavy?'var(--status-info-bg)':med?'var(--surface-3)':'var(--surface-2)',
                    border:'1px solid '+(overdue?'var(--status-risk)':'var(--line)'),
                    borderRadius:6, padding:8, minHeight:80, display:'flex', flexDirection:'column', gap:4
                  }}>
                    <div className="mono" style={{fontSize:10, color:'var(--ink-muted)'}}>{d.toLocaleDateString('en-US',{weekday:'short'}).toUpperCase()}</div>
                    <div className="mono" style={{fontSize:14, fontWeight:600, color: overdue?'var(--status-risk)':'var(--ink-strong)'}}>{d.getDate()}</div>
                    {overdue && <Badge kind="risk">{i===0?6:3}d late</Badge>}
                    {heavy && <span className="num" style={{fontSize:11, color:'var(--ink)'}}>{(8+i*0.7).toFixed(1)}t</span>}
                    {med && <span className="num" style={{fontSize:11, color:'var(--ink-muted)'}}>{(2+i*0.3).toFixed(1)}t</span>}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      <Card title="Return receipts" sub={list.length+' lots'} flush>
        <div style={{padding:'0 12px', borderBottom:'1px solid var(--line-soft)'}}>
          <Tabs value={tab} onChange={setTab} items={[
            {id:'all',label:'All', count:T.returns.length},
            {id:'overdue',label:'Overdue', count:T.returns.filter(r=>r.daysLate>0).length},
            {id:'diff',label:'Qty discrepancy', count:T.returns.filter(r=>r.diff!=null&&r.diff!==0).length},
            {id:'ready',label:'Ready for onward', count:T.returns.filter(r=>r.status==='ok').length},
          ]}/>
        </div>
        <table className="tbl">
          <thead><tr>
            <th>GR</th><th>TPM → Return plant</th><th>Material</th><th>Batch</th>
            <th className="num">Expected</th><th className="num">Received</th><th className="num">Diff</th>
            <th>Due / late</th><th>Exception</th><th>Status</th><th></th>
          </tr></thead>
          <tbody>
            {list.map(r=>(
              <tr key={r.id} className={r.status==='risk'?'is-risk-row':r.status==='pending'?'is-warn-row':''}
                  onClick={()=>openDrawer({type:'batch', payload: T.traceLot})}>
                <td className="code">{r.id}</td>
                <td><PlantFlow tpm={r.tpm} dst={r.dst}/></td>
                <td><div style={{fontWeight:600}}>{r.desc}</div><div className="muted code" style={{fontSize:10}}>{r.mat}</div></td>
                <td className="code">{r.batch}</td>
                <td className="num">{T.fmtN(r.expQty)}</td>
                <td className="num">{r.recQty!=null ? T.fmtN(r.recQty) : <span className="muted">—</span>}</td>
                <td className="num">{r.diff!=null ? <span style={{color:r.diff===0?'var(--status-ok)':'var(--status-risk)'}}>{r.diff>0?'+':''}{T.fmtN(r.diff)}</span> : <span className="muted">—</span>}</td>
                <td className="code">{r.eta}{r.daysLate>0 && <span style={{color:'var(--status-risk)',marginLeft:6}}>+{r.daysLate}d</span>}</td>
                <td>{r.exception ? <Badge kind={r.status==='risk'?'risk':'pending'}>{r.exception}</Badge> : <span className="muted">—</span>}</td>
                <td>{r.status==='ok'?<Badge kind="ok">Ready</Badge>:r.status==='risk'?<Badge kind="risk">Risk</Badge>:<Badge kind="pending">Pending</Badge>}</td>
                <td><Icon name="chevron-r" size={14} className="muted"/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
};
window.ModuleReturns = ModuleReturns;
