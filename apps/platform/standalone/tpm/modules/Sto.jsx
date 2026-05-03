/* Module 2 — STO & In-Transit */
const ModuleSto = ({ openDrawer }) => {
  const T = window.TPM;
  const [tab, setTab] = React.useState('all');
  const list = T.stoList.filter(s => tab === 'all' ? true : tab === 'risk' ? s.status === 'risk' : tab === 'pending' ? s.status === 'pending' : s.status === 'ok');

  // Aggregates
  const totals = T.stoList.reduce((a, s) => {
    a.ord += s.ordered; a.shp += s.shipped; a.rec += s.received;
    return a;
  }, { ord: 0, shp: 0, rec: 0 });

  return (
    <>
      <div className="grid-12 mb-16">
        <div className="col-3"><Kpi label="STOs in flight" value={86} unit="" delta={+5} status="info" spark={[60,62,68,72,76,80,82,84,86]} /></div>
        <div className="col-3"><Kpi label="Volume in transit" value={412} unit="t" delta={+5.4} status="info" spark={[300,320,340,360,380,395,402,410,412]} /></div>
        <div className="col-3"><Kpi label="Delayed in-transit" value={11} unit="STOs" delta={+3} status="risk" spark={[4,5,6,7,8,9,10,11,11]} /></div>
        <div className="col-3"><Kpi label="Avg lead time" value={6.4} unit="d" delta={+0.8} status="pending" spark={[5.6,5.7,5.8,5.9,6.0,6.1,6.2,6.3,6.4]} /></div>
      </div>

      <div className="grid-12 mb-16">
        <div className="col-8">
          <Card title="Ordered → Shipped → Received" sub="In-transit balance · last 30 days">
            <div className="recon" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
              <div className="recon-cell is-balanced"><span className="lbl">Ordered</span><span className="val">{T.fmtN(totals.ord)}</span><span className="delta">kg · 86 STOs</span></div>
              <div className="recon-cell"><span className="lbl">Shipped (PGI)</span><span className="val">{T.fmtN(totals.shp)}</span><span className="delta">{((totals.shp/totals.ord)*100).toFixed(1)}% of ordered</span></div>
              <div className="recon-cell is-mismatch"><span className="lbl">Received (GR)</span><span className="val">{T.fmtN(totals.rec)}</span><span className="delta">gap {T.fmtN(totals.shp - totals.rec)} kg in transit</span></div>
            </div>
            <div className="mt-16">
              <svg viewBox="0 0 600 120" style={{width:'100%', height:120}}>
                {[0,30,60,90,120].map(y=> <line key={y} x1="0" x2="600" y1={y} y2={y} className="gridline"/>)}
                <path d="M0,90 L50,82 L100,75 L150,68 L200,60 L250,55 L300,48 L350,44 L400,42 L450,40 L500,38 L550,35 L600,32" stroke="var(--chart-1)" fill="none" strokeWidth="2"/>
                <path d="M0,95 L50,88 L100,80 L150,72 L200,64 L250,58 L300,52 L350,48 L400,44 L450,40 L500,36 L550,32 L600,28" stroke="var(--chart-3)" fill="none" strokeWidth="2"/>
                <path d="M0,100 L50,98 L100,94 L150,88 L200,80 L250,74 L300,70 L350,68 L400,64 L450,60 L500,55 L550,52 L600,50" stroke="var(--chart-5)" fill="none" strokeWidth="2" strokeDasharray="3 3"/>
              </svg>
              <div className="row gap-16 mt-8" style={{fontSize:11, color:'var(--ink-muted)'}}>
                <span className="row gap-4"><i style={{width:10,height:2,background:'var(--chart-1)'}}/> Ordered</span>
                <span className="row gap-4"><i style={{width:10,height:2,background:'var(--chart-3)'}}/> Shipped</span>
                <span className="row gap-4"><i style={{width:10,height:2,background:'var(--chart-5)',borderTop:'1px dashed'}}/> Received</span>
              </div>
            </div>
          </Card>
        </div>
        <div className="col-4">
          <Card title="Lanes by source → TPM" sub="Volume routed in last 30 days">
            <table className="tbl" style={{fontSize:11.5}}>
              <thead><tr><th>Lane</th><th className="num">Vol (t)</th><th className="num">Late</th></tr></thead>
              <tbody>
                <tr><td><PlantFlow src="K140" tpm="T803"/></td><td className="num">142</td><td className="num"><span style={{color:'var(--status-risk)'}}>6</span></td></tr>
                <tr><td><PlantFlow src="K100" tpm="T801"/></td><td className="num">128</td><td className="num"><span style={{color:'var(--status-pending)'}}>2</span></td></tr>
                <tr><td><PlantFlow src="K220" tpm="T801"/></td><td className="num">96</td><td className="num">0</td></tr>
                <tr><td><PlantFlow src="K100" tpm="T802"/></td><td className="num">82</td><td className="num">0</td></tr>
                <tr><td><PlantFlow src="K220" tpm="T805"/></td><td className="num">68</td><td className="num"><span style={{color:'var(--status-pending)'}}>1</span></td></tr>
                <tr><td><PlantFlow src="K140" tpm="T804"/></td><td className="num">54</td><td className="num">0</td></tr>
              </tbody>
            </table>
          </Card>
        </div>
      </div>

      <Card title="STO explorer" sub={list.length + ' of ' + T.stoList.length + ' STOs'}
            actions={<>
              <button className="btn btn-ghost btn-sm"><Icon name="columns" size={12}/> Columns</button>
              <button className="btn btn-ghost btn-sm"><Icon name="filter" size={12}/> Filter</button>
              <button className="btn btn-sm"><Icon name="download" size={12}/></button>
            </>}
            flush>
        <div style={{padding:'0 12px', borderBottom:'1px solid var(--line-soft)'}}>
          <Tabs value={tab} onChange={setTab} items={[
            {id:'all',label:'All', count: T.stoList.length},
            {id:'risk',label:'Delayed', count: T.stoList.filter(s=>s.status==='risk').length},
            {id:'pending',label:'In transit', count: T.stoList.filter(s=>s.status==='pending').length},
            {id:'ok',label:'Received', count: T.stoList.filter(s=>s.status==='ok').length},
          ]}/>
        </div>
        <div style={{maxHeight: 380, overflow:'auto'}}>
          <table className="tbl">
            <thead><tr>
              <th>STO</th><th>Source → TPM</th><th>Material</th>
              <th className="num">Ordered</th><th className="num">Shipped</th><th className="num">Received</th>
              <th>Progress</th><th>ETA</th><th>Status</th><th></th>
            </tr></thead>
            <tbody>
              {list.map(r => {
                const recPct = r.received / r.ordered;
                return (
                  <tr key={r.id} onClick={() => openDrawer({type:'sto', payload: r})}
                      className={r.status==='risk'?'is-risk-row':r.status==='pending'?'is-warn-row':''}>
                    <td className="code">{r.id}</td>
                    <td><PlantFlow src={r.src} tpm={r.tpm}/></td>
                    <td><div style={{fontWeight:600}}>{r.desc}</div><div className="muted code" style={{fontSize:10}}>{r.mat}</div></td>
                    <td className="num">{T.fmtN(r.ordered)}</td>
                    <td className="num">{T.fmtN(r.shipped)}</td>
                    <td className="num">{r.received ? T.fmtN(r.received) : <span className="muted">—</span>}</td>
                    <td style={{width: 120}}><CellBar value={r.received} max={r.ordered} status={r.status==='risk'?'risk':r.status==='pending'?'pending':'ok'}/></td>
                    <td className="code">{r.eta}{r.delayD>0 && <span style={{color:'var(--status-risk)', marginLeft:6}}>+{r.delayD}d</span>}</td>
                    <td>{r.status==='ok'?<Badge kind="ok">Received</Badge>:r.status==='risk'?<Badge kind="risk">Delayed</Badge>:<Badge kind="pending">In transit</Badge>}</td>
                    <td><Icon name="chevron-r" size={14} className="muted"/></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="card__ft">
          <span>Showing {list.length} of {T.stoList.length} · sorted by ETA ascending</span>
          <span className="row gap-12">
            <span><b className="num">{T.stoList.filter(s=>s.status==='risk').length}</b> delayed</span>
            <span><b className="num">{T.stoList.filter(s=>s.status==='pending').length}</b> in transit</span>
            <span><b className="num">{T.stoList.filter(s=>s.status==='ok').length}</b> received</span>
          </span>
        </div>
      </Card>
    </>
  );
};

window.ModuleSto = ModuleSto;
