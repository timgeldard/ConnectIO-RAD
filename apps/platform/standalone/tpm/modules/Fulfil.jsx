/* Module 6 — Customer / Interplant Fulfilment */
const ModuleFulfil = ({ openDrawer }) => {
  const T = window.TPM;
  return (
    <>
      <div className="grid-12 mb-16">
        <div className="col-3"><Kpi label="Allocated post-return" value={31.6} unit="t" delta={+4.2} status="info" spark={[20,22,24,26,28,29,30,31,32]}/></div>
        <div className="col-3"><Kpi label="Customer commitments" value={28} unit="" delta={+2} status="info" spark={[22,23,24,25,26,27,28,28,28]}/></div>
        <div className="col-3"><Kpi label="At-risk shipments" value={12} unit="" delta={+3} status="risk" spark={[6,7,8,9,10,11,11,12,12]}/></div>
        <div className="col-3"><Kpi label="Avg post-return age" value={2.4} unit="d" delta={-0.6} status="ok" spark={[3.4,3.2,3.0,2.8,2.7,2.6,2.5,2.4,2.4]}/></div>
      </div>

      <div className="grid-12 mb-16">
        <div className="col-7">
          <Card title="Allocation flow · TPM → Return plant → Onward" sub="Volume in tonnes">
            <svg viewBox="0 0 600 180" style={{width:'100%', height:180}}>
              {/* Sankey-ish */}
              <rect x="20" y="30" width="14" height="40" fill="var(--sunset)"/>
              <text x="42" y="48" className="axis-label">T801 · 14t</text>
              <rect x="20" y="80" width="14" height="30" fill="var(--sunset)"/>
              <text x="42" y="98" className="axis-label">T802 · 8t</text>
              <rect x="20" y="120" width="14" height="40" fill="var(--sunset)"/>
              <text x="42" y="138" className="axis-label">T803 · 12t</text>

              <rect x="280" y="20" width="14" height="60" fill="var(--valentia-slate)"/>
              <text x="302" y="46" className="axis-label">K310 · 22t</text>
              <rect x="280" y="100" width="14" height="60" fill="var(--valentia-slate)"/>
              <text x="302" y="126" className="axis-label">K330 · 12t</text>

              <rect x="540" y="10" width="14" height="40" fill="var(--jade)"/>
              <text x="488" y="32" className="axis-label" textAnchor="end">PepsiCo · 12t</text>
              <rect x="540" y="60" width="14" height="30" fill="var(--jade)"/>
              <text x="488" y="80" className="axis-label" textAnchor="end">Nestlé · 8t</text>
              <rect x="540" y="100" width="14" height="20" fill="var(--jade)"/>
              <text x="488" y="115" className="axis-label" textAnchor="end">Danone · 4t</text>
              <rect x="540" y="130" width="14" height="40" fill="var(--sage)"/>
              <text x="488" y="153" className="axis-label" textAnchor="end">Interplant · 10t</text>

              {/* simple curves */}
              {[
                ['M34,50 C150,50 160,50 280,50','var(--sunset)'],
                ['M34,95 C150,95 160,130 280,130','var(--sunset)'],
                ['M34,140 C150,140 160,60 280,60','var(--sunset)'],
                ['M294,50 C400,50 420,30 540,30','var(--valentia-slate)'],
                ['M294,55 C400,55 420,75 540,75','var(--valentia-slate)'],
                ['M294,130 C400,130 420,110 540,110','var(--valentia-slate)'],
                ['M294,135 C400,135 420,150 540,150','var(--valentia-slate)'],
              ].map((p,i)=> <path key={i} d={p[0]} stroke={p[1]} strokeOpacity="0.4" strokeWidth="10" fill="none"/>)}
            </svg>
          </Card>
        </div>
        <div className="col-5">
          <Card title="Service-risk by customer" sub="Customers with at-risk commitments this week">
            <table className="tbl">
              <thead><tr><th>Customer</th><th className="num">Orders</th><th className="num">At risk</th><th className="num">Vol (t)</th></tr></thead>
              <tbody>
                <tr className="is-risk-row"><td><b>PepsiCo NA</b></td><td className="num">6</td><td className="num"><span style={{color:'var(--status-risk)'}}>3</span></td><td className="num">18.4</td></tr>
                <tr className="is-warn-row"><td><b>Nestlé EMEA</b></td><td className="num">8</td><td className="num"><span style={{color:'var(--status-pending)'}}>2</span></td><td className="num">12.2</td></tr>
                <tr><td><b>Danone APAC</b></td><td className="num">4</td><td className="num">0</td><td className="num">6.8</td></tr>
                <tr className="is-warn-row"><td><b>Mondelēz NA</b></td><td className="num">3</td><td className="num"><span style={{color:'var(--status-pending)'}}>1</span></td><td className="num">3.2</td></tr>
                <tr><td><b>Interplant K140/K330</b></td><td className="num">7</td><td className="num"><span style={{color:'var(--status-risk)'}}>1</span></td><td className="num">9.6</td></tr>
              </tbody>
            </table>
          </Card>
        </div>
      </div>

      <Card title="Onward fulfilment queue" sub="Customer shipments and interplant transfers after return" flush>
        <table className="tbl">
          <thead><tr>
            <th>Order</th><th>Type</th><th>Customer / destination</th>
            <th>TPM via</th><th>Material</th><th>Batch</th>
            <th className="num">Qty</th><th>Due</th><th>Status</th><th></th>
          </tr></thead>
          <tbody>
            {T.fulfilment.map(f=>(
              <tr key={f.id} className={f.status==='risk'?'is-risk-row':f.status==='pending'?'is-warn-row':''}
                  onClick={()=>openDrawer({type:'fulfil', payload: f})}>
                <td className="code">{f.id}</td>
                <td><span className="stage-badge">{f.kind === 'customer' ? 'Customer SO' : 'Interplant'}</span></td>
                <td><b>{f.cust}</b></td>
                <td><PlantFlow tpm={f.via} dst={f.dst}/></td>
                <td><div style={{fontWeight:600}}>{f.desc}</div><div className="muted code" style={{fontSize:10}}>{f.mat}</div></td>
                <td className="code">{f.batch}</td>
                <td className="num">{T.fmtN(f.qty)}</td>
                <td className="code">{f.due}</td>
                <td>{f.status==='ok'?<Badge kind="ok">On track</Badge>:f.status==='risk'?<Badge kind="risk">{f.risk||'At risk'}</Badge>:<Badge kind="pending">{f.risk||'Watch'}</Badge>}</td>
                <td><Icon name="chevron-r" size={14} className="muted"/></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
};
window.ModuleFulfil = ModuleFulfil;
