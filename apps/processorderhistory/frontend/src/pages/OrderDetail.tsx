// @ts-nocheck
import React, { useEffect, useMemo, useState } from 'react'
import { useT } from '../i18n/context'
import { I as DI, fmt as dfmt, TopBar, StatusBadge } from '../ui'
import { buildDetail } from '../data/mock'

// ----- helpers -----
function fmtSeconds(s) {
  if (!s && s !== 0) return '—';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}
function fmtKg(n) {
  if (n == null) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
function fmtDate(ms) {
  if (!ms) return '—';
  const d = new Date(ms);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function fmtDateTime(ms) {
  if (!ms) return '—';
  const d = new Date(ms);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function OrderDetail({ order, onBack }) {
  const { t } = useT();
  const detail = useMemo(() => buildDetail(order), [order]);
  const [insView, setInsView] = useState('table'); // 'table' | 'tiles' — Tweak

  // Listen for the host's edit-mode messages and expose tweaks
  React.useEffect(() => {
    const onMsg = (e) => {
      const msg = e?.data;
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === '__activate_edit_mode') setTweaksOpen(true);
      if (msg.type === '__deactivate_edit_mode') setTweaksOpen(false);
    };
    window.addEventListener('message', onMsg);
    window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);
  const [tweaksOpen, setTweaksOpen] = useState(false);

  return (
    <>
      <TopBar
        trail={[t.operations, t.crumbManufacturing, t.crumbOrders, order.processOrderId]}
        onTrailClick={(i) => { if (i === 2) onBack(); }}
      />

      <div className="detail-head">
        <a className="back-link" onClick={onBack}>{DI.arrowL}<span>{t.backAll}</span></a>

        <div className="detail-id-row">
          <div className="id-block">
            <div className="detail-eyebrow">{DI.hexagon}<span>{t.detailEyebrow}</span></div>
            <h1 className="detail-title">
              <span style={{fontFamily:'var(--font-mono)',fontSize:28,fontWeight:500,color:'var(--valentia-slate)',letterSpacing:'.01em'}}>{order.processOrderId}</span>
              <StatusBadge status={order.status} interactive={false} />
            </h1>
            <div className="detail-product">
              {order.product.fullName || order.materialDescription}
              <span className="sku">{t.sumMaterial} <span style={{fontFamily:'var(--font-mono)'}}>{order.materialId}</span> · {order.product.category}</span>
            </div>
          </div>

          <div className="detail-actions">
            <button className="btn secondary">{DI.printer}<span>{t.actionPrintMBR}</span></button>
            <button className="btn primary">{DI.download}<span>{t.actionExportBundle}</span></button>
          </div>
        </div>

        <SummaryStrip order={order} detail={detail} t={t} />

        <SubMetaStrip order={order} detail={detail} t={t} />
      </div>

      <div className="section-anchors">
        <a href="#sec-timeline" className="anchor">{DI.clock}<span>{t.secTimelineLogs || 'Timeline & logs'}</span></a>
        <a href="#sec-phases" className="anchor">{DI.layers}<span>{t.secPhases || 'Phases & timing'}</span><span className="pill">{detail.phases.length}</span></a>
        <a href="#sec-materials" className="anchor">{DI.package}<span>{t.tabMaterials}</span><span className="pill">{detail.materials.length}</span></a>
        <a href="#sec-qa" className="anchor">{DI.beaker}<span>{t.secInspections || 'Inspections'}</span><span className="pill">{detail.inspections.length}</span></a>
        <a href="#sec-docs" className="anchor">{DI.fileText}<span>{t.tabDocuments}</span><span className="pill">{detail.docs.length}</span></a>
      </div>

      <div className="all-sections">
        <section id="sec-timeline" className="section-block">
          <SectionHeader icon={DI.clock} label={t.secTimelineLogs || 'Timeline & logs'} />
          <TimelineSection detail={detail} order={order} t={t} />
        </section>

        <section id="sec-phases" className="section-block">
          <SectionHeader icon={DI.layers} label={t.secPhases || 'Phases & timing'} />
          <PhasesSection detail={detail} t={t} />
        </section>

        <section id="sec-materials" className="section-block">
          <SectionHeader icon={DI.package} label={t.tabMaterials} />
          <MaterialsSection detail={detail} t={t} />
        </section>

        <section id="sec-qa" className="section-block">
          <SectionHeader icon={DI.beaker} label={t.secInspections || 'Inspections'} />
          <InspectionsSection detail={detail} t={t} view={insView} setView={setInsView} />
        </section>

        <section id="sec-docs" className="section-block">
          <SectionHeader icon={DI.fileText} label={t.tabDocuments} />
          <DocsSection detail={detail} t={t} />
        </section>
      </div>

      {tweaksOpen && (
        <TweaksPanel
          insView={insView} setInsView={(v) => {
            setInsView(v);
            window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { insView: v } }, '*');
          }}
          onClose={() => {
            setTweaksOpen(false);
            window.parent.postMessage({ type: '__edit_mode_dismissed' }, '*');
          }}
        />
      )}
    </>
  );
}

// ----- Summary strip -----
function SummaryStrip({ order, detail, t }) {
  const { qtyIssuedKg, qtyReceivedKg } = detail.movementSummary;
  const yieldStr = qtyReceivedKg && qtyIssuedKg ? ((qtyReceivedKg / qtyIssuedKg) * 100).toFixed(1) : null;
  const cells = [
    { label: t.sumPOID || 'Process order',   value: <span style={{fontFamily:'var(--font-mono)'}}>{order.processOrderId}</span>, sub: order.plantId + ' · ' + order.plant.name },
    { label: t.sumStatus || 'Order status',   value: <StatusBadge status={order.status} interactive={false} />, sub: order.orderStatus, valueRaw: true },
    { label: t.sumMaterial || 'Material',     value: <span style={{fontFamily:'var(--font-mono)',fontSize:15}}>{order.materialId}</span>, sub: order.product.category },
    { label: t.sumBatch || 'Batch ID',        value: <span style={{fontFamily:'var(--font-mono)',fontSize:15}}>{order.batchId}</span>, sub: 'Supplier ' + order.supplierBatchId },
    { label: t.sumQtyIssued || 'Qty issued',  value: <>{fmtKg(qtyIssuedKg)}<span className="unit">kg</span></>,   sub: '6 components · 261 movements' },
    { label: t.sumQtyReceived || 'Qty received', value: <>{fmtKg(qtyReceivedKg)}<span className="unit">kg</span></>, sub: order.status === 'running' ? 'In progress' : '101 receipt to FG' },
    { label: t.sumYieldShort || 'Yield',      value: yieldStr ? yieldStr + '%' : '—', sub: t.sumYieldTarget, valueColor: yieldStr ? (Number(yieldStr) >= 95 ? '#1F6E4A' : '#8B6E0C') : 'var(--ink-400)' },
    { label: t.sumSetupTime || 'Setup time',  value: fmtSeconds(detail.timeSummary.setupS), sub: 'Σ across phases', mono: true },
    { label: t.sumMachineTime || 'Machine time', value: fmtSeconds(detail.timeSummary.machS), sub: 'Σ across phases', mono: true },
    { label: t.sumCleaningTime || 'Cleaning time', value: fmtSeconds(detail.timeSummary.cleanS), sub: 'Σ across phases', mono: true },
  ];
  return (
    <div className="summary-strip">
      {cells.map((c, i) => (
        <div className="sum-cell" key={i}>
          <div className="label">{c.label}</div>
          <div className="value" style={{
            color: c.valueColor || undefined,
            fontFamily: c.mono ? 'var(--font-mono)' : undefined,
            fontSize: c.mono ? 16 : undefined,
            fontWeight: c.mono ? 500 : undefined,
          }}>{c.value}</div>
          <div className="sub">{c.sub}</div>
        </div>
      ))}
    </div>
  );
}

// ----- Sub meta strip (allergens / DOM / expiry) -----
function SubMetaStrip({ order, detail, t }) {
  return (
    <div className="submeta-strip">
      <div className="sm-pill">
        <span className="sm-icon">{DI.calendar}</span>
        <div className="sm-body">
          <div className="sm-label">{t.sumDOM || 'Date of manufacture'}</div>
          <div className="sm-value">{fmtDate(order.manufactureDate)}</div>
        </div>
      </div>
      <div className="sm-pill">
        <span className="sm-icon">{DI.calendar}</span>
        <div className="sm-body">
          <div className="sm-label">{t.sumExpiry || 'Shelf life expiry'}</div>
          <div className="sm-value">{fmtDate(order.expiryDate)}</div>
        </div>
      </div>
      <div className="sm-pill allergens">
        <span className="sm-icon">{DI.alert}</span>
        <div className="sm-body">
          <div className="sm-label">{t.sumAllergens || 'Allergens'}</div>
          <div className="sm-value mono-up">{order.allergens}</div>
        </div>
      </div>
      <div className="sm-pill" style={{marginLeft:'auto'}}>
        <span className="sm-icon">{DI.shield}</span>
        <div className="sm-body">
          <div className="sm-label">Inspection lot</div>
          <div className="sm-value mono">{detail.inspectionLotId}</div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ icon, label }) {
  return (
    <div className="section-header">
      <span className="section-icon">{icon}</span>
      <h2 className="section-title">{label}</h2>
      <span className="section-rule" />
    </div>
  );
}

// ----- Timeline & logs section -----
function TimelineSection({ detail, order, t }) {
  return (
    <div className="detail-grid timeline-grid">
      <div className="detail-card">
        <div className="detail-card-head">
          {DI.clock}<h3>{t.cardTimeline}</h3>
          <span className="meta">{detail.timeline.length} {t.cardEvents}</span>
        </div>
        <div className="detail-card-body">
          <div className="timeline">
            {detail.timeline.map((ev, i) => (
              <div key={i} className={`tl-row ${ev.state}`}>
                <div className="tl-time">
                  {dfmt.time(ev.date)}
                  <span className="day">{dfmt.shortDate(ev.date)}</span>
                </div>
                <div className="tl-axis"><span className="node" /></div>
                <div className="tl-content">
                  <div className="tl-event">{ev.event}</div>
                  <div className="tl-meta">
                    <span style={{fontWeight:600,letterSpacing:'.04em',fontSize:10.5,fontFamily:'var(--font-mono)',textTransform:'uppercase',color:'var(--valentia-slate)'}}>{ev.time}</span>
                    <span className="actor">{ev.actor}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Operator notes */}
        <div className="detail-card-head" style={{borderTop:'1px solid var(--stone-100)',marginTop:0}}>
          {DI.message}<h3>{t.cardComments || 'Operator notes'}</h3>
          <span className="meta">{detail.comments.length}</span>
        </div>
        <div className="comments-list">
          {detail.comments.length === 0 ? (
            <div className="empty-state">{t.noComments}</div>
          ) : detail.comments.map((c, i) => (
            <div key={i} className="comment-row">
              <div className="comment-head">
                <span className="comment-author">{c.SENDER}</span>
                <span className="comment-time">{fmtDateTime(c.CREATED)} · phase {c.PHASE_ID}</span>
              </div>
              <div className="comment-body">{c.NOTES}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="side-stack">
        <DowntimeCard detail={detail} t={t} />
        <EquipmentCard detail={detail} t={t} />
        <div className="detail-card">
          <div className="detail-card-head">{DI.user}<h3>{t.cardPeople}</h3></div>
          <dl className="def-list">
            <div className="row"><dt>{t.operator}</dt><dd>{order.operator}</dd></div>
            <div className="row"><dt>{t.qaReviewer}</dt><dd>T. Berg</dd></div>
            <div className="row"><dt>{t.planner}</dt><dd>L. Park</dd></div>
            <div className="row"><dt>{t.releasedBy}</dt><dd>K. Okafor</dd></div>
          </dl>
        </div>
      </div>
    </div>
  );
}

function DowntimeCard({ detail, t }) {
  const totalDur = detail.downtime.reduce((a, d) => a + d.DURATION, 0);
  return (
    <div className="detail-card">
      <div className="detail-card-head">
        {DI.alert}<h3>{t.cardDowntime || 'Downtime & issues'}</h3>
        <span className="meta">{detail.downtime.length === 0 ? 'none' : detail.downtime.length + ' · ' + Math.round(totalDur / 60) + ' min'}</span>
      </div>
      {detail.downtime.length === 0 ? (
        <div className="empty-state">{t.noDowntime || 'No downtime recorded.'}</div>
      ) : (
        <ul className="issue-list">
          {detail.downtime.map((d, i) => (
            <li key={i} className="issue-row">
              <div className="issue-tag">{d.ISSUE_TYPE}</div>
              <div className="issue-body">
                <div className="issue-title">{d.ISSUE_TITLE}</div>
                <div className="issue-meta">
                  <span className="mono">{Math.round(d.DURATION / 60)}m</span>
                  <span>·</span>
                  <span>{d.REASON_CODE}/{d.SUB_REASON_CODE}</span>
                  <span>·</span>
                  <span>{fmtDateTime(d.START_TIME)}</span>
                </div>
                {d.OPERATORS_COMMENTS && <div className="issue-comment">{d.OPERATORS_COMMENTS}</div>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EquipmentCard({ detail, t }) {
  return (
    <div className="detail-card">
      <div className="detail-card-head">
        {DI.cpu}<h3>{t.cardEquipment || 'Equipment activity'}</h3>
        <span className="meta">{detail.equipment.length}</span>
      </div>
      {detail.equipment.length === 0 ? (
        <div className="empty-state">{t.noEquipment}</div>
      ) : (
        <ul className="eq-list">
          {detail.equipment.map((e, i) => (
            <li key={i} className="eq-row">
              <div className="eq-instr">
                <span className="eq-type">{e.EQUIPMENT_TYPE}</span>
                <span className="eq-id mono">{e.INSTRUMENT_ID}</span>
              </div>
              <div className="eq-trans">
                <span className="eq-from">{e.STATUS_FROM}</span>
                <span className="eq-arrow">{DI.arrowR}</span>
                <span className="eq-to">{e.STATUS_TO}</span>
              </div>
              <div className="eq-time">{fmtDateTime(e.CHANGE_AT)}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ----- Phases section -----
function PhasesSection({ detail, t }) {
  // Find max so all bars share scale
  const maxDur = Math.max(...detail.phases.map(p => (p.setupH + p.machH + p.cleanH)));

  return (
    <div className="detail-card">
      <div className="detail-card-head">
        {DI.layers}<h3>{t.cardPhaseList || 'Process phases'}</h3>
        <span className="meta">{detail.phases.length} phases · {fmtSeconds(detail.timeSummary.setupS + detail.timeSummary.machS + detail.timeSummary.cleanS)}</span>
        <div className="phase-legend">
          <span className="leg leg-setup"><i /> {t.phaseSetup}</span>
          <span className="leg leg-mach"><i /> {t.phaseMachine}</span>
          <span className="leg leg-clean"><i /> {t.phaseCleaning}</span>
        </div>
      </div>

      <table className="phase-tbl">
        <thead>
          <tr>
            <th style={{paddingLeft:18, width:80}}>{t.phaseColId}</th>
            <th>{t.phaseColDesc}</th>
            <th className="right" style={{width:130}}>{t.phaseColQty}</th>
            <th style={{width:110}}>{t.phaseColStartUser}</th>
            <th style={{width:110}}>{t.phaseColEndUser}</th>
            <th style={{width:340, paddingRight:18}}>{t.phaseColTime}</th>
          </tr>
        </thead>
        <tbody>
          {detail.phases.map((p, i) => {
            const setupPct = (p.setupH / maxDur) * 100;
            const machPct  = (p.machH  / maxDur) * 100;
            const cleanPct = (p.cleanH / maxDur) * 100;
            const total = p.setupH + p.machH + p.cleanH;
            return (
              <tr key={p.PHASE_ID}>
                <td style={{paddingLeft:18}}>
                  <span className="phase-id mono">{p.PHASE_ID}</span>
                </td>
                <td>
                  <div className="mat-name">{p.PHASE_DESCRIPTION}</div>
                  <div className="mat-sub">{p.PHASE_TEXT}</div>
                </td>
                <td className="right mono">
                  {p.OPERATION_QUANTITY.toLocaleString()} <span style={{color:'var(--ink-400)',fontSize:11}}>{p.OPERATION_QUANTITY_UOM}</span>
                </td>
                <td className="mono" style={{fontSize:11.5,color:'var(--ink-500)'}}>{p.START_USER}</td>
                <td className="mono" style={{fontSize:11.5,color:'var(--ink-500)'}}>{p.END_USER}</td>
                <td style={{paddingRight:18}}>
                  <div className="phase-bar-wrap">
                    <div className="phase-bar">
                      <div className="bar-setup" style={{width: setupPct + '%'}} title={`Setup ${(p.setupH).toFixed(2)}h`} />
                      <div className="bar-mach"  style={{width: machPct  + '%'}} title={`Machine ${(p.machH).toFixed(2)}h`} />
                      <div className="bar-clean" style={{width: cleanPct + '%'}} title={`Cleaning ${(p.cleanH).toFixed(2)}h`} />
                    </div>
                    <div className="phase-bar-meta mono">{total.toFixed(2)} h</div>
                  </div>
                </td>
              </tr>
            );
          })}
          <tr style={{background:'var(--stone)',fontWeight:600}}>
            <td style={{paddingLeft:18}} colSpan={5}>{t.phaseTotal}</td>
            <td style={{paddingRight:18}}>
              <div className="phase-bar-wrap">
                <div className="phase-time-pills">
                  <span className="pill-setup mono">{fmtSeconds(detail.timeSummary.setupS)}</span>
                  <span className="pill-mach mono">{fmtSeconds(detail.timeSummary.machS)}</span>
                  <span className="pill-clean mono">{fmtSeconds(detail.timeSummary.cleanS)}</span>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ----- Materials & Movements section -----
function MaterialsSection({ detail, t }) {
  const totalPlanned = detail.materials.reduce((a, m) => a + m.planned, 0);
  const totalUsed = detail.materials.reduce((a, m) => a + m.used, 0);
  const shortItems = detail.materials.filter(m => m.isShort);
  return (
    <div className="detail-card">
      <div className="detail-card-head">
        {DI.package}<h3>{t.cardBOM}</h3>
        <span className="meta">{detail.materials.length} {t.items} · {totalUsed.toFixed(1)} kg {t.consumed}</span>
        {shortItems.length > 0 && (
          <span className="bom-short-banner">
            {DI.alert}
            <span>
              <strong>{shortItems.length}</strong> {shortItems.length === 1 ? 'component short' : 'components short'} · {shortItems.reduce((a,m)=>a+m.shortBy,0).toFixed(1)} kg below required
            </span>
          </span>
        )}
      </div>
      <table className="mat-tbl">
        <thead>
          <tr>
            <th style={{paddingLeft:18}}>{t.matMaterial}</th>
            <th>{t.matLotSupplier}</th>
            <th className="right">{t.matPlanned}</th>
            <th className="right">On hand</th>
            <th className="right">{t.matActual}</th>
            <th className="right">{t.matVariance}</th>
            <th className="right" style={{paddingRight:18}}>{t.matUnit}</th>
          </tr>
        </thead>
        <tbody>
          {detail.materials.map((m, i) => {
            const variance = ((m.used - m.planned) / m.planned) * 100;
            const cls = Math.abs(variance) < 1.5 ? 'var-good' : Math.abs(variance) < 4 ? 'var-ok' : 'var-bad';
            const issueMov = detail.movements.find(mv => mv.MATERIAL_ID === m.sku);
            return (
              <tr key={i} className={m.isShort ? 'mat-short' : ''}>
                <td style={{paddingLeft:18}}>
                  <div className="mat-name">
                    {m.isShort && <span className="mat-short-pill" title="Material shortage">{t.bomShortageBadge || 'SHORT'}</span>}
                    {m.name}
                  </div>
                  <div className="mat-sub mono">{m.sku}</div>
                </td>
                <td>
                  <div className="mat-name mono" style={{fontSize:12.5,fontWeight:400,color:'var(--forest)'}}>{issueMov ? issueMov.BATCH_ID : '—'}</div>
                  <div className="mat-sub">{issueMov ? issueMov.supplier : '—'}</div>
                </td>
                <td className="right">{m.planned.toFixed(1)}</td>
                <td className={`right ${m.isShort ? 'onhand-short' : 'onhand-ok'}`}>
                  {m.onHand.toFixed(1)}
                  {m.isShort && <div className="onhand-shortby">−{m.shortBy.toFixed(1)} kg</div>}
                </td>
                <td className="right">{m.used.toFixed(1)}</td>
                <td className={`right ${cls}`}>{variance >= 0 ? '+' : ''}{variance.toFixed(1)}%</td>
                <td className="right" style={{paddingRight:18,color:'var(--ink-500)',fontFamily:'var(--font-mono)',fontSize:11.5}}>{m.unit}</td>
              </tr>
            );
          })}
          <tr style={{background:'var(--stone)',fontWeight:600}}>
            <td style={{paddingLeft:18,fontWeight:600}} colSpan={2}>{t.matTotal}</td>
            <td className="right">{totalPlanned.toFixed(1)}</td>
            <td className="right" style={{color:'var(--ink-500)'}}>—</td>
            <td className="right">{totalUsed.toFixed(1)}</td>
            <td className="right var-good">{(((totalUsed - totalPlanned) / totalPlanned) * 100).toFixed(2)}%</td>
            <td className="right" style={{paddingRight:18,color:'var(--ink-500)',fontFamily:'var(--font-mono)',fontSize:11.5}}>kg</td>
          </tr>
        </tbody>
      </table>

      {/* Material movements */}
      <div className="detail-card-head" style={{borderTop:'1px solid var(--stone-100)',marginTop:0}}>
        {DI.arrowR}<h3>{t.cardMovements || 'Material movements'}</h3>
        <span className="meta">{detail.movements.length} entries</span>
      </div>
      <table className="mov-tbl">
        <thead>
          <tr>
            <th style={{paddingLeft:18, width:130}}>{t.movColDate}</th>
            <th style={{width:60}}>{t.movColType}</th>
            <th>{t.movColMaterial}</th>
            <th className="mono" style={{width:130}}>{t.movColBatch}</th>
            <th className="right" style={{width:110}}>{t.movColQty}</th>
            <th style={{width:80}}>{t.movColStorage}</th>
            <th style={{width:120, paddingRight:18}}>{t.movColUser}</th>
          </tr>
        </thead>
        <tbody>
          {detail.movements.map((mv, i) => (
            <tr key={i}>
              <td className="mono" style={{paddingLeft:18,fontSize:11.5,color:'var(--ink-500)'}}>{fmtDateTime(mv.DATE_TIME_OF_ENTRY)}</td>
              <td>
                <span className={`mvt-pill ${mv.MOVEMENT_TYPE === '101' ? 'receipt' : 'issue'}`}>{mv.MOVEMENT_TYPE}</span>
              </td>
              <td>
                <div className="mat-name" style={{fontSize:13}}>{mv.MATERIAL_NAME}</div>
                <div className="mat-sub mono">{mv.MATERIAL_ID}</div>
              </td>
              <td className="mono" style={{fontSize:11.5,color:'var(--forest)'}}>{mv.BATCH_ID}</td>
              <td className="right mono">{mv.QUANTITY.toLocaleString()} <span style={{color:'var(--ink-400)',fontSize:11}}>{mv.UOM}</span></td>
              <td className="mono" style={{fontSize:11.5,color:'var(--ink-500)'}}>{mv.STORAGE_ID}</td>
              <td className="mono" style={{fontSize:11.5,color:'var(--ink-500)',paddingRight:18}}>{mv.USER_NAME}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ----- Inspections section -----
function InspectionsSection({ detail, t, view, setView }) {
  const allPass = detail.inspections.every(x => x.JUDGEMENT === 'A');
  return (
    <div className="detail-grid">
      <div className="detail-card">
        <div className="detail-card-head">
          {DI.beaker}<h3>{t.cardInspectionResults || 'Inspection results'}</h3>
          <span className="meta">{allPass ? t.allWithinSpec : 'Has rejections'}</span>
          <div className="view-toggle">
            <button className={view === 'table' ? 'active' : ''} onClick={() => setView('table')}>{t.viewTable || 'Table'}</button>
            <button className={view === 'tiles' ? 'active' : ''} onClick={() => setView('tiles')}>{t.viewTiles || 'Tiles'}</button>
          </div>
        </div>

        {view === 'table' ? (
          <table className="ins-tbl">
            <thead>
              <tr>
                <th style={{paddingLeft:18, width:100}}>ID</th>
                <th>{t.insColChar}</th>
                <th>{t.insColSpec}</th>
                <th style={{width:110}}>{t.insColResult}</th>
                <th style={{width:90}}>{t.insColSample}</th>
                <th style={{width:80}}>{t.insColJudge}</th>
                <th style={{width:120, paddingRight:18}}>{t.insColInspector}</th>
              </tr>
            </thead>
            <tbody>
              {detail.inspections.map((ins, i) => {
                const result = ins.QUANTITATIVE_RESULT ?? ins.QUALITATIVE_RESULT;
                return (
                  <tr key={i}>
                    <td style={{paddingLeft:18}} className="mono" >{ins.CHARACTERISTIC_ID}</td>
                    <td>
                      <div className="mat-name" style={{fontSize:13}}>{ins.CHARACTERISTIC_DESCRIPTION}</div>
                    </td>
                    <td className="mono" style={{fontSize:11.5,color:'var(--ink-500)'}}>{ins.SPECIFICATION}</td>
                    <td className="mono" style={{fontSize:13,fontWeight:500}}>
                      {result} <span style={{color:'var(--ink-400)',fontSize:11}}>{ins.UOM}</span>
                    </td>
                    <td className="mono" style={{fontSize:11.5}}>{ins.SAMPLE_ID}</td>
                    <td>
                      <span className={`judge-pill ${ins.JUDGEMENT === 'A' ? 'pass' : 'fail'}`}>{ins.JUDGEMENT}</span>
                    </td>
                    <td className="mono" style={{fontSize:11.5,color:'var(--ink-500)',paddingRight:18}}>{ins.INSPECTOR}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="qa-grid">
            {detail.inspections.map((ins, i) => {
              const result = ins.QUANTITATIVE_RESULT ?? ins.QUALITATIVE_RESULT;
              return (
                <div key={i} className="qa-cell">
                  <div className="label">{ins.CHARACTERISTIC_DESCRIPTION}</div>
                  <div className={`val ${ins.JUDGEMENT === 'A' ? 'pass' : 'fail'}`}>
                    {result}{ins.UOM && <span style={{fontSize:13,color:'var(--ink-500)',marginLeft:3}}>{ins.UOM}</span>}
                  </div>
                  <div className="target mono">{ins.SPECIFICATION}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="side-stack">
        <UsageDecisionCard ud={detail.usageDecision} t={t} />
        <div className="detail-card">
          <div className="detail-card-head">{DI.shield}<h3>{t.cardCompliance}</h3></div>
          <dl className="def-list">
            <div className="row"><dt>{t.haccp}</dt><dd className="mono" style={{color:'#1F6E4A'}}>{t.haccpVal}</dd></div>
            <div className="row"><dt>{t.fssc}</dt><dd className="mono" style={{color:'#1F6E4A'}}>{t.fsscVal}</dd></div>
            <div className="row"><dt>{t.allergen}</dt><dd className="mono">{detail.inspections[0]?.SPECIFICATION ? '—' : '—'}</dd></div>
            <div className="row"><dt>{t.retention}</dt><dd>{t.retentionVal}</dd></div>
          </dl>
        </div>
      </div>
    </div>
  );
}

function UsageDecisionCard({ ud, t }) {
  if (!ud) {
    return (
      <div className="detail-card ud-card pending">
        <div className="detail-card-head">{DI.flag}<h3>{t.cardUsageDecision || 'Usage decision'}</h3></div>
        <div className="ud-body">
          <div className="ud-pending">{t.udPending || 'Pending decision'}</div>
          <div className="ud-sub">Awaiting QA review · no decision recorded yet.</div>
        </div>
      </div>
    );
  }
  const accepted = ud.VALUATION_CODE === 'A';
  return (
    <div className={`detail-card ud-card ${accepted ? 'accept' : 'reject'}`}>
      <div className="detail-card-head">
        {DI.flag}<h3>{t.cardUsageDecision || 'Usage decision'}</h3>
        <span className={`ud-badge ${accepted ? 'accept' : 'reject'}`}>{accepted ? 'A' : 'R'}</span>
      </div>
      <div className="ud-body">
        <div className="ud-headline">{ud.description}</div>
        <div className="ud-meta-grid">
          <div><div className="ud-l">{t.udCode}</div><div className="ud-v mono">{ud.USAGE_DECISION_CODE}</div></div>
          <div><div className="ud-l">{t.udValuation}</div><div className="ud-v mono">{ud.VALUATION_CODE}</div></div>
          <div><div className="ud-l">{t.udQualityScore}</div><div className="ud-v mono" style={{fontSize:18,fontWeight:600,color:accepted?'#1F6E4A':'#A74545'}}>{ud.QUALITY_SCORE}</div></div>
        </div>
        <div className="ud-foot">
          {t.udBy} <strong>{ud.USAGE_DECISION_CREATED_BY}</strong> {t.udOn} {fmtDate(ud.USAGE_DECISION_CREATED_DATE)}
        </div>
      </div>
    </div>
  );
}

// ----- Docs -----
function DocsSection({ detail, t }) {
  return (
    <div className="detail-grid">
      <div className="detail-card">
        <div className="detail-card-head">
          {DI.fileText}<h3>{t.cardDocs}</h3>
          <span className="meta">{detail.docs.length} {t.files}</span>
        </div>
        <div className="doc-list">
          {detail.docs.map((d, i) => (
            <div key={i} className="doc">
              <div className="doc-icon">{d.type === 'XLSX' ? DI.fileSheet : DI.fileText}</div>
              <div className="doc-info">
                <div className="doc-name">{d.name}</div>
                <div className="doc-meta">{d.type} · {d.size} · {d.date}</div>
              </div>
              <button className="doc-dl" title="Download">{DI.download}</button>
            </div>
          ))}
        </div>
      </div>

      <div className="side-stack">
        <div className="detail-card">
          <div className="detail-card-head">{DI.shield}<h3>{t.cardCompliance}</h3></div>
          <dl className="def-list">
            <div className="row"><dt>{t.haccp}</dt><dd className="mono" style={{color:'#1F6E4A'}}>{t.haccpVal}</dd></div>
            <div className="row"><dt>{t.fssc}</dt><dd className="mono" style={{color:'#1F6E4A'}}>{t.fsscVal}</dd></div>
            <div className="row"><dt>{t.retention}</dt><dd>{t.retentionVal}</dd></div>
          </dl>
        </div>
      </div>
    </div>
  );
}

// ----- Tweaks panel -----
function TweaksPanel({ insView, setInsView, onClose }) {
  return (
    <div className="tweaks-panel">
      <div className="tweaks-head">
        <span style={{fontFamily:'var(--font-impact)',fontWeight:800,textTransform:'uppercase',fontSize:13,letterSpacing:'.02em'}}>Tweaks</span>
        <button className="tweaks-close" onClick={onClose} aria-label="Close">{DI.x}</button>
      </div>
      <div className="tweaks-body">
        <div className="tweak-section">
          <div className="tweak-label">Inspection results layout</div>
          <div className="tweak-radio">
            <button className={insView === 'table' ? 'active' : ''} onClick={() => setInsView('table')}>Table</button>
            <button className={insView === 'tiles' ? 'active' : ''} onClick={() => setInsView('tiles')}>Tiles</button>
          </div>
          <div className="tweak-help">Switch between a dense data table (default) and KPI-style tiles for the inspection characteristics.</div>
        </div>
      </div>
    </div>
  );
}

export { OrderDetail }
