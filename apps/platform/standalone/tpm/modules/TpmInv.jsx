/* Module 3 — TPM Plant Inventory & WIP */
const ModuleTpmInv = ({ openDrawer }) => {
  const T = window.TPM;
  const [tab, setTab] = React.useState('all');
  const [plant, setPlant] = React.useState('all');
  const inv = T.tpmInv.filter(r => (tab === 'all' || r.kind === tab) && (plant === 'all' || r.plant === plant));

  const sums = T.tpmInv.reduce((a, r) => { a[r.kind] = (a[r.kind]||0) + r.qty; a.total += r.qty; return a; }, { raw:0, wip:0, finished:0, blocked:0, total:0 });

  return (
    <>
      <div className="grid-12 mb-16">
        <div className="col-3"><Kpi label="Total stock at TPM" value={(sums.total/1000).toFixed(1)} unit="t" delta={-2.1} status="info" spark={[42,44,46,45,44,43,42,41,40]} /></div>
        <div className="col-3"><Kpi label="Raw / components" value={(sums.raw/1000).toFixed(1)} unit="t" delta={+1.2} status="info" spark={[18,18,19,19,20,20,21,20,21]} /></div>
        <div className="col-3"><Kpi label="WIP" value={(sums.wip/1000).toFixed(1)} unit="t" delta={-3.4} status="pending" spark={[10,10,9.5,9,8.8,8.5,8.2,8,7.5]} /></div>
        <div className="col-3"><Kpi label="Blocked / hold" value={(sums.blocked/1000).toFixed(1)} unit="t" delta={+8} status="risk" spark={[0.3,0.4,0.5,0.55,0.6,0.65,0.7,0.72,0.72]} /></div>
      </div>

      <div className="grid-12 mb-16">
        <div className="col-7">
          <Card title="Inventory composition by TPM plant" sub="Tonnes by stage of toll lifecycle">
            {['T801','T802','T803','T804','T805'].map(p => {
              const rows = T.tpmInv.filter(r => r.plant === p);
              const total = rows.reduce((s,r)=>s+r.qty,0);
              const buckets = ['raw','wip','finished','blocked'].map(k => rows.filter(r=>r.kind===k).reduce((s,r)=>s+r.qty,0));
              const colors = { raw:'var(--chart-1)', wip:'var(--chart-2)', finished:'var(--chart-3)', blocked:'var(--status-risk)' };
              return (
                <div key={p} style={{marginBottom:10}}>
                  <div className="row between" style={{marginBottom:4}}>
                    <span style={{fontSize:12, fontWeight:600}}><Plant code={p}/> <span className="muted" style={{marginLeft:6}}>{T.plants[p].name}</span></span>
                    <span className="num muted" style={{fontSize:11}}>{T.fmtN(total)} kg · {rows.length} lots</span>
                  </div>
                  <div className="aging">
                    {buckets.map((b, i) => total ? <span key={i} style={{width: (b/total*100)+'%', background: Object.values(colors)[i]}}/> : null)}
                  </div>
                </div>
              );
            })}
            <div className="aging-legend mt-12">
              <span className="sw"><i style={{background:'var(--chart-1)'}}/> Raw</span>
              <span className="sw"><i style={{background:'var(--chart-2)'}}/> WIP</span>
              <span className="sw"><i style={{background:'var(--chart-3)'}}/> Finished — awaiting return</span>
              <span className="sw"><i style={{background:'var(--status-risk)'}}/> Blocked / hold</span>
            </div>
          </Card>
        </div>
        <div className="col-5">
          <Card title="Aged stock alert" sub="Material/batch combinations >21d at TPM">
            <table className="tbl" style={{fontSize:12}}>
              <thead><tr><th>Material</th><th>Batch</th><th>Plant</th><th className="num">Qty</th><th className="num">Age</th></tr></thead>
              <tbody>
                {T.tpmInv.filter(r=>r.age>=18).sort((a,b)=>b.age-a.age).map((r,i)=>(
                  <tr key={i} onClick={()=>openDrawer({type:'batch', payload: T.traceLot})} className={r.age>=28?'is-risk-row':r.age>=21?'is-warn-row':''}>
                    <td><div style={{fontWeight:600,fontSize:11.5}}>{r.desc}</div><div className="muted code" style={{fontSize:10}}>{r.mat}</div></td>
                    <td className="code">{r.batch}</td>
                    <td><Plant code={r.plant}/></td>
                    <td className="num">{T.fmtN(r.qty)}</td>
                    <td className="num"><span style={{color:r.age>=28?'var(--status-risk)':'var(--status-pending)'}}>{r.age}d</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      </div>

      <Card title="TPM inventory & WIP" sub={inv.length + ' of ' + T.tpmInv.length + ' lines'}
            actions={<>
              <button className="btn btn-ghost btn-sm"><Icon name="filter" size={12}/> {plant==='all'?'All plants':plant}</button>
              <button className="btn btn-ghost btn-sm"><Icon name="columns" size={12}/></button>
              <button className="btn btn-sm"><Icon name="download" size={12}/></button>
            </>}
            flush>
        <div style={{padding:'0 12px', borderBottom:'1px solid var(--line-soft)'}}>
          <Tabs value={tab} onChange={setTab} items={[
            {id:'all',label:'All', count: T.tpmInv.length},
            {id:'raw',label:'Raw / components', count: T.tpmInv.filter(r=>r.kind==='raw').length},
            {id:'wip',label:'WIP', count: T.tpmInv.filter(r=>r.kind==='wip').length},
            {id:'finished',label:'Finished — awaiting return', count: T.tpmInv.filter(r=>r.kind==='finished').length},
            {id:'blocked',label:'Blocked / hold', count: T.tpmInv.filter(r=>r.kind==='blocked').length},
          ]}/>
        </div>
        <table className="tbl">
          <thead><tr>
            <th>TPM plant</th><th>Material</th><th>Batch</th><th>Stage</th>
            <th className="num">Qty (kg)</th><th className="num">Age</th>
            <th>Destination</th><th>Next milestone</th><th>Status</th><th></th>
          </tr></thead>
          <tbody>
            {inv.map((r, i) => (
              <tr key={i} className={r.status==='risk'?'is-risk-row':r.status==='pending'?'is-warn-row':''}
                  onClick={()=>openDrawer({type:'batch', payload: T.traceLot})}>
                <td><Plant code={r.plant}/></td>
                <td><div style={{fontWeight:600}}>{r.desc}</div><div className="muted code" style={{fontSize:10}}>{r.mat}</div></td>
                <td className="code">{r.batch}</td>
                <td><span className="stage-badge">{r.kind === 'raw' ? 'Raw' : r.kind === 'wip' ? 'WIP' : r.kind === 'finished' ? 'Finished' : 'Blocked'}</span></td>
                <td className="num">{T.fmtN(r.qty)}</td>
                <td className="num"><span style={{color:r.age>=28?'var(--status-risk)':r.age>=18?'var(--status-pending)':'var(--ink)'}}>{r.age}d</span></td>
                <td><Plant code={r.dest}/></td>
                <td className="muted" style={{fontSize:11.5}}>{r.next}</td>
                <td>{r.status==='ok'?<Badge kind="ok">On track</Badge>:r.status==='risk'?<Badge kind="risk">Risk</Badge>:<Badge kind="pending">Aging</Badge>}</td>
                <td><Icon name="chevron-r" size={14} className="muted"/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
};

window.ModuleTpmInv = ModuleTpmInv;
