/* === Hold / exception modal === */

const HoldModal = ({ open, onClose }) => {
  const [reason, setReason] = React.useState("");
  const [severity, setSeverity] = React.useState("warning");
  const [category, setCategory] = React.useState("");
  const [escalate, setEscalate] = React.useState(true);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal--lg" onClick={e=>e.stopPropagation()}>
        <div className="modal__h">
          <div style={{width:32,height:32,borderRadius:8,background:"var(--pec-warning-bg)",color:"var(--pec-warning)",display:"flex",alignItems:"center",justifyContent:"center"}}><Icon name="alert" size={18}/></div>
          <div>
            <h2>Place phase on hold</h2>
            <div style={{fontSize:12,color:"var(--pec-ink-muted)",fontFamily:"var(--font-mono)"}}>PO-1004812 · Phase 3 · Step 3.3</div>
          </div>
          <button className="btn btn--ghost close" onClick={onClose}><Icon name="x" size={16}/></button>
        </div>
        <div className="modal__b">
          <div className="banner banner--warning" style={{marginBottom:16}}>
            <Icon name="info" size={18} className="banner__icon" style={{color:"var(--pec-warning)"}}/>
            <div className="banner__body"><strong>This action is auditable.</strong> The hold reason, your signature, and resume conditions will be written to the order record.</div>
          </div>

          <div className="grid-2" style={{marginBottom:16}}>
            <div>
              <div className="label">Severity</div>
              <div className="row-flex" style={{gap:6,flexWrap:"wrap"}}>
                {[
                  {v:"info",t:"Info",c:"var(--pec-info)"},
                  {v:"warning",t:"Warning",c:"var(--pec-warning)"},
                  {v:"critical",t:"Critical",c:"var(--pec-danger)"},
                  {v:"hold",t:"Block / hold",c:"var(--pec-hold)"},
                ].map(o=>(
                  <button key={o.v} className={`chip ${severity===o.v?"is-active":""}`} onClick={()=>setSeverity(o.v)} style={severity===o.v?{background:o.c,borderColor:o.c}:{}}>
                    <span className="dot" style={{background:o.c}}></span>{o.t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="label">Category</div>
              <select className="input" value={category} onChange={e=>setCategory(e.target.value)}>
                <option value="">Select category…</option>
                <option>Out-of-tolerance parameter</option>
                <option>Material variance</option>
                <option>Equipment fault</option>
                <option>QA hold required</option>
                <option>Operator-raised concern</option>
                <option>Procedure clarification needed</option>
              </select>
            </div>
          </div>

          <div className="label">Reason &amp; observations</div>
          <textarea
            className="input"
            value={reason}
            onChange={e=>setReason(e.target.value)}
            placeholder="Describe the deviation. Include observations, sensor readings, and any actions already taken…"
            style={{height:96,padding:10,resize:"vertical",fontFamily:"inherit",lineHeight:1.5}}
          />
          <div className="help">Required. Will be visible in the order record and to the supervisor.</div>

          <div className="grid-2" style={{marginTop:16,marginBottom:16}}>
            <div>
              <div className="label">Resume condition</div>
              <select className="input">
                <option>Supervisor disposition</option>
                <option>QA approval</option>
                <option>Re-sample &amp; re-test</option>
                <option>Equipment reset confirmed</option>
                <option>Engineering review complete</option>
              </select>
            </div>
            <div>
              <div className="label">Notify</div>
              <div className="row-flex" style={{gap:6,flexWrap:"wrap",marginTop:4}}>
                <span className="chip is-active" onClick={()=>setEscalate(!escalate)}><Icon name="user" size={11}/> Shift Lead</span>
                <span className="chip is-active"><Icon name="shield" size={11}/> QA on-call</span>
                <span className="chip"><Icon name="users" size={11}/> Process Eng</span>
              </div>
            </div>
          </div>

          <div className="ctx-card" style={{background:"var(--pec-surface-alt)"}}>
            <h4>Operator signature · 21 CFR Part 11</h4>
            <div className="grid-2">
              <div><div className="label">User ID</div><input className="input input--mono" defaultValue="mchen" disabled/></div>
              <div><div className="label">Password</div><input className="input" type="password" placeholder="Required to commit hold"/></div>
            </div>
          </div>
        </div>
        <div className="modal__f">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn--ghost"><Icon name="download" size={14}/> Save as draft</button>
          <button className="btn btn--danger" onClick={onClose} disabled={!reason}><Icon name="pause" size={14}/> Place on hold &amp; notify</button>
        </div>
      </div>
    </div>
  );
};

window.HoldModal = HoldModal;
