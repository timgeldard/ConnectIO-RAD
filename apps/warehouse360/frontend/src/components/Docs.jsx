import React from 'react';
import { Icon, RiskDot } from './Primitives.jsx';
import { Card } from './Shared.jsx';

/* Docs: Product Concept · KPI Catalogue · Data Model
   Written artefacts from the Warehouse Manager 360° brief.
*/

const DocsTabs = ({ current, onChange }) => (
  <div className="docs-tabs">
    {[
      { id: 'concept', label: 'Product Concept', icon: 'lightning' },
      { id: 'kpis',    label: 'KPI Catalogue',   icon: 'chart' },
      { id: 'data',    label: 'Data Model',      icon: 'layers' },
    ].map((t) => (
      <button key={t.id}
        className={`docs-tab ${current === t.id ? 'is-active' : ''}`}
        onClick={() => onChange(t.id)}>
        <Icon name={t.icon} size={14}/>
        <span>{t.label}</span>
      </button>
    ))}
  </div>
);

/* ================================================================
   1. Product Concept
   ================================================================ */
const DocConcept = () => (
  <div className="doc stack-16">
    <div className="doc-hero">
      <div className="t-eyebrow">Product Concept · v0.4 draft</div>
      <h2 className="doc-hero-title">One pane of glass for the people who run the warehouse floor.</h2>
      <p className="doc-hero-lede">
        Warehouse Manager 360° is a live operational cockpit for Kerry site managers. It consolidates production staging,
        inbound receipts, outbound deliveries, inventory health and exceptions into a single surface — so the next
        decision is never more than two clicks away.
      </p>
      <div className="doc-hero-meta">
        <div><div className="t-eyebrow">Pilot site</div><div>Kerry Naas · IE01 · WH NS01</div></div>
        <div><div className="t-eyebrow">Source of truth</div><div>SAP ECC · EWM · MII</div></div>
        <div><div className="t-eyebrow">Refresh</div><div>30 s soft · 2 min hard</div></div>
        <div><div className="t-eyebrow">Users</div><div>Site Mgr · Shift Lead · Dock Lead · Dispensary Lead</div></div>
      </div>
    </div>

    <div className="grid-2">
      <Card title="The problem" eyebrow="Why now">
        <p>Today a Kerry warehouse manager holds the operational picture in their head plus five tools: SAP GUI,
          the MII shop-floor dashboard, a Power&nbsp;BI report, WhatsApp, and a paper A3 on the wall.</p>
        <ul className="doc-list">
          <li><b>Staging decisions are late.</b> Problems surface when the line is already waiting, not 90 minutes before.</li>
          <li><b>Exception triage is manual.</b> TR/TO faults, QA holds and short-picks live in three different screens.</li>
          <li><b>No shared language.</b> Site managers speak SAP; planners speak product; operators speak bin/line.</li>
          <li><b>Mobile supervision is broken.</b> SAP GUI on a tablet is unusable; nobody does it.</li>
        </ul>
      </Card>
      <Card title="The thesis" eyebrow="What changes">
        <p>Put every operational signal on one screen, keyed to the <b>process order</b>, the <b>delivery</b> or the
          <b>bin</b> — whichever the user is thinking about right now — and surface <b>risk before it becomes failure</b>.</p>
        <ul className="doc-list">
          <li>Live pull of LTAK/LTAP, LIKP/LIPS, EKKO/EKPO, LQUA into a unified domain model.</li>
          <li>Single risk grammar (Critical · At risk · On track) across every screen.</li>
          <li>Plain-language labels with SAP IDs on drill-down — <b>hybrid</b> fidelity, not pure SAP.</li>
          <li>Works on a 32" control-room monitor, a manager's laptop, and a shift lead's tablet.</li>
        </ul>
      </Card>
    </div>

    <Card title="Who it's for" eyebrow="Personas">
      <div className="persona-grid">
        {[
          { name: 'Niamh Murphy', role: 'Warehouse Manager', initials: 'NM', tone: 'slate',
            goals: 'Hit today\u2019s OTIF. No fire-fighting before 08:30 stand-up.',
            pain:  '\u201CI find out about a short-pick when the lorry is at the gate.\u201D',
            kpi:   'OTIF, DIFOT, staging punctuality, stock accuracy' },
          { name: 'Dara Byrne', role: 'Shift Lead · B', initials: 'DB', tone: 'forest',
            goals: 'Keep the 4 lines fed. Resolve TR exceptions in under 10 min.',
            pain:  '\u201CI walk 12km a shift chasing pallets that aren\u2019t where SAP says.\u201D',
            kpi:   'Line-fed minutes, TR confirmation time, exceptions cleared / shift' },
          { name: 'Aoife Kelly', role: 'Dock Lead · Outbound', initials: 'AK', tone: 'sage',
            goals: 'Zero missed cut-offs. Every trailer loaded right-first-time.',
            pain:  '\u201CPaper pick lists. I can\u2019t see staging progress until it\u2019s too late.\u201D',
            kpi:   'On-time loading, short-pick rate, dock turn time' },
          { name: 'Padraig Ryan', role: 'Dispensary Lead', initials: 'PR', tone: 'sunset',
            goals: 'Micros ready before batch start. Zero weigh errors. Traceable.',
            pain:  '\u201CNobody sees the dispensary queue until something blocks.\u201D',
            kpi:   'Dispensary queue depth, weigh variance, batch pass rate' },
        ].map((p) => (
          <div key={p.name} className="persona">
            <div className={`persona-avatar is-${p.tone}`}>{p.initials}</div>
            <div style={{ flex: 1 }}>
              <div className="persona-name">{p.name}</div>
              <div className="persona-role">{p.role}</div>
              <div className="persona-goal"><b>Goal:</b> {p.goals}</div>
              <div className="persona-quote">{p.pain}</div>
              <div className="persona-kpi"><b>KPIs they own:</b> {p.kpi}</div>
            </div>
          </div>
        ))}
      </div>
    </Card>

    <Card title="Core principles" eyebrow="How we build it">
      <div className="principle-grid">
        {[
          { n: '01', h: 'Risk first, detail second',
            p: 'Every list sorts by operational risk by default. Red, amber, green is a universal grammar across screens.' },
          { n: '02', h: 'One object, many lenses',
            p: 'A process order appears in Staging, Dispensary, Inventory and Exceptions — the same object, not four records.' },
          { n: '03', h: 'Plain language on top, SAP underneath',
            p: '"Putaway task" in the UI. TO 0023456 on the drill-down. Site managers switch; operators never need to.' },
          { n: '04', h: 'Time is a first-class dimension',
            p: 'Every row shows ETA, cut-off or start time, and how far we are from it — not just status.' },
          { n: '05', h: 'Actionable, not informational',
            p: 'Every card answers "what should I do next?" before "what is happening?".' },
          { n: '06', h: 'Designed for 32" and 13"',
            p: 'Control-tower wall readability at 3 metres; dense table layouts on the manager\u2019s laptop.' },
        ].map((pr) => (
          <div key={pr.n} className="principle">
            <div className="principle-n">{pr.n}</div>
            <div className="principle-h">{pr.h}</div>
            <div className="principle-p">{pr.p}</div>
          </div>
        ))}
      </div>
    </Card>

    <div className="grid-asym">
      <Card title="Scope — v1 (pilot, Naas)" eyebrow="In" >
        <ul className="doc-list tight">
          <li>Control Tower: shift-level KPIs, live schedule, exception feed, dock board</li>
          <li>Production Staging: process orders 24h horizon, staging progress, dispensary link</li>
          <li>Inbound: PO + STO receipts, dock assignment, putaway progress</li>
          <li>Outbound: deliveries by cut-off, pick/stage/load progress, route/dock view</li>
          <li>Inventory &amp; Bins: bin health, line-side stock, batch expiry, stuck HUs</li>
          <li>Dispensary workbench: queue, weigh progress, scale/station status</li>
          <li>Exceptions command centre: prioritised, assignable, cross-domain</li>
          <li>Performance: 14-day rolling KPIs, per-shift / per-line break-down</li>
        </ul>
      </Card>
      <Card title="Out of scope" eyebrow="Not v1">
        <ul className="doc-list tight">
          <li>Execution — UI does not post to SAP; read-mostly with assign/acknowledge writes</li>
          <li>Operator handhelds (RF) — covered by existing SAPConsole</li>
          <li>Yard management / gate booking</li>
          <li>Planning &amp; MRP — SAP APO remains the authority</li>
          <li>Multi-plant roll-up — Naas only at pilot</li>
          <li>Predictive models — rule-based risk only in v1</li>
        </ul>
      </Card>
    </div>

    <Card title="Release plan" eyebrow="Rollout">
      <div className="roadmap">
        {[
          { phase: 'M0', name: 'Design partner', when: 'Q2', what: 'Naas shift leads co-design. 3 screens shippable.', tone: 'slate' },
          { phase: 'M1', name: 'Pilot — Naas', when: 'Q3', what: 'Full v1 scope. Read-only integration. Daily stand-up wall.', tone: 'forest' },
          { phase: 'M2', name: '3-plant EMEA', when: 'Q4', what: 'Listowel + Charleville. Multi-plant roll-up.', tone: 'sage' },
          { phase: 'M3', name: 'Global GA', when: 'Y+1', what: 'Americas + APAC. Write-back to SAP for acknowledge/assign.', tone: 'sunset' },
        ].map((m) => (
          <div key={m.phase} className={`roadmap-phase is-${m.tone}`}>
            <div className="roadmap-badge">{m.phase}</div>
            <div className="roadmap-name">{m.name}</div>
            <div className="roadmap-when">{m.when}</div>
            <div className="roadmap-what">{m.what}</div>
          </div>
        ))}
      </div>
    </Card>
  </div>
);

/* ================================================================
   2. KPI Catalogue
   ================================================================ */
const KPI_CATALOGUE = [
  { domain: 'Outbound', tone: 'slate', kpis: [
    { name: 'OTIF — On Time In Full',          formula: '(deliveries shipped on time ∧ complete) ÷ total deliveries', target: '≥ 98.5%',  freq: 'Shift',  source: 'LIKP · VBFA · actual GI', owners: 'Site Mgr · Dock Lead' },
    { name: 'Dock turn time',                   formula: 'avg(truck depart − truck arrive)',                              target: '≤ 42 min', freq: 'Daily',  source: 'LIKP · gate log',         owners: 'Dock Lead' },
    { name: 'Short-pick rate',                   formula: 'pick tasks with qty < requested ÷ pick tasks',                 target: '≤ 0.5%',   freq: 'Shift',  source: 'LTAK · LTAP',              owners: 'Shift Lead' },
    { name: 'Loading on-time',                   formula: 'loads completed ≤ cut-off ÷ loads',                            target: '≥ 99%',    freq: 'Shift',  source: 'LIKP · VTFL',              owners: 'Dock Lead' },
    { name: 'Cut-off breach alerts triggered',   formula: 'count(deliveries where pickPct < 80% within 90m of cut-off)', target: '≤ 2/day',  freq: 'Live',   source: 'Derived',                 owners: 'Site Mgr' },
  ]},
  { domain: 'Production staging', tone: 'forest', kpis: [
    { name: 'Staging punctuality',               formula: '(stages complete ≥ start − 20m) ÷ stages',                    target: '≥ 97%',    freq: 'Shift',  source: 'AFKO · LTAK',              owners: 'Shift Lead' },
    { name: 'Line-fed minutes',                   formula: 'minutes the line had material available ÷ planned run mins', target: '≥ 99.2%',  freq: 'Shift',  source: 'PP confirmations',        owners: 'Shift Lead' },
    { name: 'Average staging lead time',         formula: 'stage complete − stage requested',                              target: '≤ 45 min', freq: 'Daily',  source: 'LTAK · LTAP',              owners: 'Shift Lead' },
    { name: 'Split-pick rate',                    formula: 'TOs that could not be picked from a single HU ÷ TOs',        target: '≤ 12%',    freq: 'Daily',  source: 'LTAP · LQUA',              owners: 'Site Mgr' },
  ]},
  { domain: 'Inbound', tone: 'sage', kpis: [
    { name: 'PO receiving variance',             formula: '|received − expected| ÷ expected',                              target: '≤ 0.8%',   freq: 'Daily',  source: 'EKPO · MSEG',              owners: 'Goods-In Lead' },
    { name: 'Putaway cycle time',                 formula: 'avg(putaway confirmed − GR posted)',                           target: '≤ 38 min', freq: 'Daily',  source: 'LTAK · MKPF',              owners: 'Shift Lead' },
    { name: 'QA hold turnaround',                 formula: 'avg(QA released − QA block posted)',                           target: '≤ 4 h',    freq: 'Daily',  source: 'QALS · QINF',              owners: 'QA Lead' },
    { name: 'GR-on-time',                         formula: 'receipts with GR posted ≤ ETA + 30m ÷ receipts',               target: '≥ 95%',    freq: 'Daily',  source: 'EKPO · MKPF',              owners: 'Goods-In Lead' },
  ]},
  { domain: 'Inventory', tone: 'sunset', kpis: [
    { name: 'Stock accuracy (cycle count)',      formula: 'bins with |system − actual| ≤ tolerance ÷ bins counted',       target: '≥ 99.3%',  freq: 'Weekly', source: 'LINV · LIKP',              owners: 'Site Mgr' },
    { name: 'Batch expiry ≤ 30d',                 formula: 'count(LQUA where BBD − now ≤ 30d)',                           target: 'trend ↓',  freq: 'Daily',  source: 'LQUA · MCHA',              owners: 'Site Mgr · Planner' },
    { name: 'Bin utilisation (bulk)',            formula: 'Σ occupied bins ÷ Σ bins, storage type 001',                    target: '65–80%',   freq: 'Daily',  source: 'LQUA · LAGP',              owners: 'Site Mgr' },
    { name: 'Stuck HU count (> 24h no move)',    formula: 'count(HUs where last move > 24h ∧ status ≠ shipped)',          target: '≤ 6',      freq: 'Live',   source: 'LQUA · LTAK',              owners: 'Shift Lead' },
  ]},
  { domain: 'Dispensary', tone: 'sunrise', kpis: [
    { name: 'Weigh variance',                     formula: '|weighed − target| ÷ target',                                  target: '≤ 0.15%',  freq: 'Batch',  source: 'MII scale feed',          owners: 'Dispensary Lead' },
    { name: 'Queue depth',                        formula: 'count(batches awaiting weigh)',                                target: '≤ 6',      freq: 'Live',   source: 'PP · MII',                owners: 'Dispensary Lead' },
    { name: 'Batch ready-before-start',           formula: 'batches where all micros weighed ≥ order start ÷ batches',    target: '≥ 99%',    freq: 'Shift',  source: 'AFKO · MII',              owners: 'Dispensary Lead' },
  ]},
  { domain: 'Exceptions', tone: 'jade', kpis: [
    { name: 'Mean time to acknowledge',          formula: 'avg(ack time − raise time)',                                    target: '≤ 6 min',  freq: 'Shift',  source: 'Derived',                 owners: 'Shift Lead' },
    { name: 'Mean time to resolve',               formula: 'avg(resolve time − raise time)',                               target: '≤ 35 min', freq: 'Shift',  source: 'Derived',                 owners: 'Shift Lead' },
    { name: 'Re-opened exception rate',           formula: 'exceptions re-opened within 4h ÷ resolved',                    target: '≤ 3%',     freq: 'Weekly', source: 'Derived',                 owners: 'Site Mgr' },
  ]},
];

const DocKPIs = () => {
  const [q, setQ] = React.useState('');
  const filtered = KPI_CATALOGUE.map((d) => ({
    ...d,
    kpis: d.kpis.filter((k) => !q || (k.name + k.formula + k.source + k.owners).toLowerCase().includes(q.toLowerCase())),
  })).filter((d) => d.kpis.length);
  const totalCount = KPI_CATALOGUE.reduce((a, d) => a + d.kpis.length, 0);
  return (
    <div className="doc stack-16">
      <div className="doc-hero">
        <div className="t-eyebrow">KPI Catalogue · v0.4 · {totalCount} metrics</div>
        <h2 className="doc-hero-title">Every number, its formula, and who owns it.</h2>
        <p className="doc-hero-lede">
          These are the KPIs Warehouse Manager 360° computes, displays, and alerts on. Each one has a single formula,
          a single data source of truth, and a single accountable role — so when a number moves, everyone knows where
          it came from and who can change it.
        </p>
      </div>

      <div className="doc-search">
        <Icon name="search" size={14}/>
        <input placeholder="Filter by name, formula, source, owner\u2026" value={q} onChange={(e) => setQ(e.target.value)}/>
        {q && <button className="btn-ghost-xs" onClick={() => setQ('')}>Clear</button>}
      </div>

      {filtered.map((d) => (
        <Card key={d.domain} title={d.domain} eyebrow={`${d.kpis.length} metric${d.kpis.length === 1 ? '' : 's'}`} tight>
          <table className="tbl kpi-tbl">
            <colgroup>
              <col style={{ width: '24%' }}/><col style={{ width: '30%' }}/>
              <col style={{ width: '10%' }}/><col style={{ width: '8%' }}/>
              <col style={{ width: '14%' }}/><col style={{ width: '14%' }}/>
            </colgroup>
            <thead><tr>
              <th>Metric</th><th>Formula</th><th>Target</th><th>Freq.</th><th>Source of truth</th><th>Owner</th>
            </tr></thead>
            <tbody>
              {d.kpis.map((k) => (
                <tr key={k.name}>
                  <td><div className="kpi-name">{k.name}</div></td>
                  <td className="kpi-formula">{k.formula}</td>
                  <td><span className={`tag tag-${d.tone === 'sunrise' ? 'forest' : 'slate'}`}>{k.target}</span></td>
                  <td className="m">{k.freq}</td>
                  <td className="m">{k.source}</td>
                  <td>{k.owners}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ))}

      <Card title="Alerting rules" eyebrow="Derived from targets" >
        <div className="alert-rules">
          {[
            { h: 'Cut-off breach',        when: 'Delivery · pickPct < 80% ∧ cut-off < 90 min', where: 'Outbound · Control Tower · Exceptions', whom: 'Dock Lead + Site Mgr' },
            { h: 'Staging at risk',       when: 'Process order · staged < 90% ∧ start < 45 min',   where: 'Staging · Control Tower · Exceptions',   whom: 'Shift Lead' },
            { h: 'Inbound overdue',       when: 'Receipt · ETA + 30 min ∧ status = Expected',       where: 'Inbound · Control Tower',                 whom: 'Goods-In Lead' },
            { h: 'QA hold escalation',     when: 'QA hold age > 4h ∧ needed for today batch',        where: 'Inbound · Exceptions',                    whom: 'QA Lead + Shift Lead' },
            { h: 'Stuck HU',              when: 'HU · last move > 24h ∧ status ≠ shipped',          where: 'Inventory · Exceptions',                  whom: 'Shift Lead' },
            { h: 'Batch expiry',          when: 'Batch · BBD − now ≤ 14d ∧ onHand > 0',             where: 'Inventory',                               whom: 'Planner + Site Mgr' },
            { h: 'Dispensary block',      when: 'Batch · micros < 100% ∧ order start < 30 min',     where: 'Dispensary · Staging · Exceptions',       whom: 'Dispensary Lead' },
          ].map((r) => (
            <div key={r.h} className="alert-rule">
              <div className="alert-rule-h"><RiskDot risk="red"/>{r.h}</div>
              <div className="alert-rule-when"><b>When:</b> {r.when}</div>
              <div className="alert-rule-where"><b>Shown on:</b> {r.where}</div>
              <div className="alert-rule-whom"><b>Notifies:</b> {r.whom}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

/* ================================================================
   3. Data Model
   ================================================================ */

const SAP_TABLE_STATUS = [
  // PP — Production Planning
  { module: 'PP',       table: 'AFKO', desc: 'Production order header',              schemaTable: 'productionorderobject_afko',       present: true  },
  { module: 'PP',       table: 'AFPO', desc: 'Production order item',                schemaTable: 'productionorderobject_afpo',       present: true  },
  { module: 'PP',       table: 'RESB', desc: 'Reservation / dependent requirements', schemaTable: 'reservationrequirement_resb',      present: true  },
  // WM — Warehouse Management
  { module: 'WM',       table: 'LTAK', desc: 'Transfer order header',                schemaTable: 'transferorderobjects_ltak',        present: true  },
  { module: 'WM',       table: 'LTAP', desc: 'Transfer order item',                  schemaTable: 'transferorderobjects_ltap',        present: true  },
  { module: 'WM',       table: 'LTBK', desc: 'Transfer requirement header',          schemaTable: 'transferrequirementobjects_ltbk', present: true  },
  { module: 'WM',       table: 'LAGP', desc: 'Storage bin master',                   schemaTable: 'storagebin_lagp',                 present: true  },
  { module: 'WM',       table: 'LQUA', desc: 'Quants (bin stock)',                   schemaTable: 'quant_lqua',                      present: true  },
  { module: 'WM',       table: 'LINV', desc: 'WM inventory document header',         schemaTable: null, present: false,
    todo: 'Not in either schema. central_services has IKPF (header_physical_inventory_doc_ikpf) + ISEG (physical_inventory_doc_items_iseg) which may cover this — confirm with SAP team before requesting LINV extraction.' },
  // LE/SD — Logistics Execution / Sales & Distribution
  { module: 'LE/SD',    table: 'LIKP', desc: 'Delivery header',                      schemaTable: 'deliveryobjects_likp',            present: true  },
  { module: 'LE/SD',    table: 'LIPS', desc: 'Delivery item',                        schemaTable: 'deliveryobjects_lips',            present: true  },
  { module: 'LE/SD',    table: 'VBFA', desc: 'Sales / delivery document flow',       schemaTable: 'salesorderobject_vbfa',           present: true  },
  { module: 'LE/SD',    table: 'VTFL', desc: 'Delivery / billing document flow',     schemaTable: null, present: false,
    todo: 'Not in either schema. Used for loading on-time KPI. May substitute with LIKP-WADAT_IST (actual GI date); confirm with SAP team before requesting extraction.' },
  // MM — Materials Management
  { module: 'MM',       table: 'EKKO', desc: 'Purchase order header',                schemaTable: 'procurementorderobject_ekko', source: 'central', present: true  },
  { module: 'MM',       table: 'EKPO', desc: 'Purchase order item',                  schemaTable: 'procurementorderobject_ekpo', source: 'central', present: true  },
  { module: 'MM',       table: 'MKPF', desc: 'Material document header',             schemaTable: 'materialdocument_mkpf',           present: true  },
  { module: 'MM',       table: 'MSEG', desc: 'Material document item (GR / GI movements)', schemaTable: 'inventorymovement_mseg',   present: true  },
  // Material / Batch
  { module: 'Material', table: 'MARA', desc: 'Material master — general data',       schemaTable: 'materialmaster_mara',             present: true  },
  { module: 'Material', table: 'MARC', desc: 'Material master — plant data',         schemaTable: 'materialforplant_marc',           present: true  },
  { module: 'Material', table: 'MARD', desc: 'Storage location stock',               schemaTable: 'storagelocationmaterial_mard',    present: true  },
  { module: 'Batch',    table: 'MCHA', desc: 'Batch master data',                    schemaTable: 'batches_mcha', source: 'central', present: true  },
  { module: 'Batch',    table: 'MCH1', desc: 'Cross-plant batch (batch + plant)',    schemaTable: 'crossplantbatch_mch1',            present: true  },
  // HU — Handling Units
  { module: 'HU',       table: 'VEKP', desc: 'Handling unit header (SSCC)',          schemaTable: 'handlingunit_vekp', source: 'central', present: true  },
  { module: 'HU',       table: 'VEPO', desc: 'Handling unit item (contents)',        schemaTable: 'handlingunit_vepo', source: 'central', present: true  },
  // QM — Quality Management
  { module: 'QM',       table: 'QALS', desc: 'Inspection lot',                       schemaTable: 'inspection_qals',                present: true  },
  { module: 'QM',       table: 'QSSR', desc: 'Quality certificate',                  schemaTable: null, present: false,
    todo: 'Required for QA release status. Check whether QALS usage-decision fields (QALS-VKDAT, QALS-ERDAT) are sufficient before requesting QSSR.' },
  { module: 'QM',       table: 'QINF', desc: 'Quality info record',                  schemaTable: null, present: false,
    todo: 'Used for QA hold turnaround KPI (QINF · vendor + material pairing). Confirm with QA lead if QALS status fields cover this use case.' },
];

const SOURCE_LABEL = { sap: 'connected_plant_uat.sap', central: 'published_uat.central_services' };
const SOURCE_COLOR = { sap: 'var(--valentia-slate)', central: 'var(--forest)' };

const DocSapTables = () => {
  const presentCount = SAP_TABLE_STATUS.filter((t) => t.present).length;
  const missingCount = SAP_TABLE_STATUS.filter((t) => !t.present).length;
  const modules = [...new Set(SAP_TABLE_STATUS.map((t) => t.module))];

  return (
    <Card title="SAP table availability" eyebrow={`${presentCount} present · ${missingCount} TODO`} tight>
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        {Object.entries(SOURCE_LABEL).map(([key, label]) => (
          <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: SOURCE_COLOR[key], flexShrink: 0 }}/>
            <span className="mono" style={{ color: 'var(--fg-muted)' }}>{label}</span>
          </span>
        ))}
      </div>
      {modules.map((mod) => {
        const rows = SAP_TABLE_STATUS.filter((t) => t.module === mod);
        return (
          <div key={mod} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--fg-muted)', marginBottom: 6 }}>{mod}</div>
            <table className="tbl" style={{ marginBottom: 0 }}>
              <colgroup>
                <col style={{ width: 40 }}/>
                <col style={{ width: '14%' }}/>
                <col style={{ width: '26%' }}/>
                <col/>
              </colgroup>
              <thead><tr><th></th><th>SAP table</th><th>Description</th><th>Schema table / TODO</th></tr></thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.table}>
                    <td style={{ textAlign: 'center' }}>
                      {t.present
                        ? <span style={{ color: 'var(--jade)', fontWeight: 700, fontSize: 13 }}>✓</span>
                        : <span style={{ color: 'var(--sunset)', fontWeight: 700, fontSize: 13 }}>✗</span>}
                    </td>
                    <td><span className="code">{t.table}</span></td>
                    <td style={{ fontSize: 12 }}>{t.desc}</td>
                    <td style={{ fontSize: 11 }}>
                      {t.present ? (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          {t.source && <span style={{ width: 8, height: 8, borderRadius: 1, background: SOURCE_COLOR[t.source], flexShrink: 0 }}/>}
                          <span className="mono" style={{ color: 'var(--fg-muted)' }}>{t.schemaTable}</span>
                        </span>
                      ) : (
                        <span style={{ color: 'var(--sunset)' }}><b>TODO:</b> {t.todo}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </Card>
  );
};

const DATA_ENTITIES = [
  { id: 'process_order',  label: 'Process Order',     sap: 'AFKO · AFPO',             colour: 'forest',
    attrs: ['id (process_order_no)', 'material', 'line_id', 'planned_start', 'planned_end', 'qty · uom',
            'status', 'staging_method', 'risk', 'shift_id'],
    rels: ['→ transfer_order (1..n)', '→ batch (1..n)', '→ dispensary_batch (0..n)', '→ exception (0..n)'] },
  { id: 'transfer_order', label: 'Transfer Order',    sap: 'LTAK · LTAP',             colour: 'slate',
    attrs: ['id (to_number)', 'type (pick/putaway/replen/internal)', 'material', 'qty · uom',
            'src_bin', 'dst_bin', 'status', 'confirmed_at', 'assigned_to', 'sscc'],
    rels: ['← process_order (0..1)', '← delivery (0..1)', '→ handling_unit (0..1)', '→ exception (0..n)'] },
  { id: 'delivery',       label: 'Outbound Delivery', sap: 'LIKP · LIPS',             colour: 'sunset',
    attrs: ['id (delivery_no)', 'sales_order_no', 'customer', 'carrier', 'dock_id',
            'cut_off_ts', 'status', 'pick_pct', 'stage_pct', 'load_pct', 'weight', 'pallet_count', 'risk'],
    rels: ['→ transfer_order (1..n)', '→ handling_unit (1..n)', '→ exception (0..n)'] },
  { id: 'receipt',        label: 'Receipt (PO/STO)',  sap: 'EKKO · EKPO · MKPF',      colour: 'sage',
    attrs: ['id (po_or_sto_no)', 'type (PO/STO)', 'vendor_or_plant', 'material',
            'expected_qty', 'received_qty · uom', 'eta', 'dock_id', 'status', 'qa_status', 'risk'],
    rels: ['→ batch (0..n)', '→ handling_unit (0..n)', '→ transfer_order (0..n)'] },
  { id: 'handling_unit',  label: 'Handling Unit (HU)', sap: 'VEKP · VEPO · SSCC',     colour: 'valentia',
    attrs: ['id (sscc)', 'packaging_type', 'net_weight', 'gross_weight',
            'location_bin', 'last_move_ts', 'material', 'batch_no', 'status'],
    rels: ['← receipt (0..1)', '← delivery (0..1)', '→ quant (1..n)'] },
  { id: 'quant',          label: 'Quant (bin stock)', sap: 'LQUA',                   colour: 'jade',
    attrs: ['id (synthetic)', 'bin_id', 'material', 'batch_no', 'qty · uom',
            'placed_at', 'expiry_bbd', 'blocked_qty', 'qa_status'],
    rels: ['← storage_bin (1..1)', '← batch (1..1)', '← handling_unit (0..1)'] },
  { id: 'storage_bin',    label: 'Storage Bin',       sap: 'LAGP',                   colour: 'slate',
    attrs: ['id (bin_id)', 'storage_type (001/002/003/005/050/010)', 'aisle · rack · level',
            'status (free/occupied/blocked)', 'max_weight', 'max_volume'],
    rels: ['→ quant (0..n)'] },
  { id: 'batch',          label: 'Batch',             sap: 'MCHA · MCH1',             colour: 'sunrise',
    attrs: ['id (batch_no)', 'material', 'mfg_date', 'bbd_expiry', 'qa_status',
            'origin_receipt · origin_process_order', 'remaining_qty · uom'],
    rels: ['→ quant (0..n)', '→ process_order (0..n consume)', '→ dispensary_weight (0..n)'] },
  { id: 'dispensary',     label: 'Dispensary Batch',  sap: 'MII ext',                 colour: 'sunset',
    attrs: ['id', 'process_order', 'station_id', 'scale_id',
            'required_components (json)', 'weighed_components (json)',
            'queue_position', 'status', 'variance_pct'],
    rels: ['← process_order (1..1)', '→ dispensary_weight (1..n)'] },
  { id: 'exception',      label: 'Exception',         sap: 'Derived',                 colour: 'sunset',
    attrs: ['id', 'type', 'severity (red/amber)', 'raised_ts', 'age_minutes',
            'related_object_id · type', 'assigned_to', 'status (open/ack/resolved)',
            'resolution_ts', 'notes'],
    rels: ['→ any operational object (polymorphic)'] },
  { id: 'material',       label: 'Material Master',   sap: 'MARA · MARC · MARD',      colour: 'forest',
    attrs: ['id (material_no)', 'description', 'uom', 'abc_class',
            'storage_conditions', 'shelf_life_days', 'qa_test_required', 'allergens[]'],
    rels: ['← batch (0..n)', '← quant (0..n)'] },
  { id: 'shift',          label: 'Shift',             sap: 'Calendar',               colour: 'slate',
    attrs: ['id (A/B/C)', 'label', 'start_ts', 'end_ts', 'lead_user'],
    rels: ['→ process_order (0..n)', '→ exception (0..n)'] },
];

const DocData = () => (
  <div className="doc stack-16">
    <div className="doc-hero">
      <div className="t-eyebrow">Data Model · v0.4 · 12 core entities</div>
      <h2 className="doc-hero-title">One unified domain model across five SAP modules.</h2>
      <p className="doc-hero-lede">
        The UI never exposes SAP tables directly. A lightweight domain layer maps LTAK, LIKP, EKPO, LQUA, LAGP,
        MCHA and MII scale events into the twelve entities below. Every screen in Warehouse Manager 360°
        queries this layer — never SAP GUI directly.
      </p>
      <div className="doc-hero-meta">
        <div><div className="t-eyebrow">Access</div><div>Read-mostly · SAP OData + CDS views</div></div>
        <div><div className="t-eyebrow">Write-back</div><div>Assign · Acknowledge only (v1)</div></div>
        <div><div className="t-eyebrow">Cache</div><div>30 s · bin &amp; dispensary live</div></div>
        <div><div className="t-eyebrow">Latency target</div><div>p95 ≤ 1.2 s first paint</div></div>
      </div>
    </div>

    <Card title="Entity relationship" eyebrow="Core domain map" subtitle="Hover any entity to see its SAP source. Arrows indicate cardinality.">
      <ERDiagram/>
    </Card>

    <div className="grid-2">
      {DATA_ENTITIES.map((e) => (
        <div key={e.id} className={`entity-card is-${e.colour}`}>
          <div className="entity-card-head">
            <div className="entity-card-title">{e.label}</div>
            <div className="entity-card-sap">{e.sap}</div>
          </div>
          <div className="entity-card-section">
            <div className="entity-card-section-h">Attributes</div>
            <ul className="entity-attrs">
              {e.attrs.map((a) => {
                const [k, meta] = a.split(/\s+\(/);
                return <li key={a}><span className="entity-attr-k">{k}</span>{meta && <span className="entity-attr-v"> ({meta}</span>}</li>;
              })}
            </ul>
          </div>
          <div className="entity-card-section">
            <div className="entity-card-section-h">Relations</div>
            <ul className="entity-rels">{e.rels.map((r) => <li key={r}>{r}</li>)}</ul>
          </div>
        </div>
      ))}
    </div>

    <Card title="SAP field mapping" eyebrow="Reference · hybrid fidelity" tight>
      <table className="tbl kpi-tbl">
        <colgroup>
          <col style={{ width: '22%' }}/><col style={{ width: '22%' }}/>
          <col style={{ width: '22%' }}/><col style={{ width: '34%' }}/>
        </colgroup>
        <thead><tr><th>UI label</th><th>Domain field</th><th>SAP table · field</th><th>Notes</th></tr></thead>
        <tbody>
          {[
            ['Process order', 'process_order.id', 'AFKO · AUFNR', 'Leading digit indicates plant — prefix shown in drill-down only'],
            ['Transfer Order', 'transfer_order.id', 'LTAK · TANUM', '10-digit. Type from LTAK-BWLVS'],
            ['Delivery', 'delivery.id', 'LIKP · VBELN', 'Outbound only. Inbound deliveries excluded in v1'],
            ['Pick %', 'delivery.pick_pct', 'LIPS · PIKMG ÷ LFIMG', 'Weighted by LIPS-LFIMG to avoid many-small-lines skew'],
            ['Staged %', 'delivery.stage_pct', 'Derived from LTAK', 'LTAK confirmed to storage type 916 (staging)'],
            ['Cut-off', 'delivery.cut_off_ts', 'LIKP · LDDAT + LDTIM', 'Site local TZ, fallback to route master'],
            ['Receipt (PO)', 'receipt.id', 'EKKO · EBELN', 'Header only; body lines collapsed into receipt'],
            ['Received qty', 'receipt.received_qty', 'Σ MSEG · MENGE where BWART in 101/105', 'Excludes reversals 102/106'],
            ['HU', 'handling_unit.id', 'VEKP · EXIDV (SSCC)', '18-digit, displayed 4-chunked'],
            ['Bin', 'storage_bin.id', 'LAGP · LGPLA', 'Display as {type}-{aisle}{rack}-L{level}'],
            ['Batch expiry', 'batch.bbd_expiry', 'MCH1 · VFDAT', 'Site-local, days-to-expiry computed client-side'],
            ['QA hold', 'receipt.qa_status = "QA Hold"', 'QALS · PRUEFLOS + QSSR', 'Released = QSSR-RESULT = "A"'],
          ].map((row) => (
            <tr key={row[1]}>
              <td><b>{row[0]}</b></td>
              <td className="m">{row[1]}</td>
              <td className="m">{row[2]}</td>
              <td>{row[3]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>

    <DocSapTables/>

    <Card title="Integration surface" eyebrow="What talks to what">
      <div className="integration-grid">
        {[
          { sys: 'SAP ECC', role: 'System of record', pulls: 'MARA · AFKO · LTAK · LIKP · EKKO · LQUA · MCHA · QALS', freq: '30 s OData poll · bulk CDS nightly' },
          { sys: 'SAP EWM',  role: 'Warehouse execution', pulls: 'HU moves · task status · bin updates',              freq: 'Event-driven via IDoc' },
          { sys: 'SAP MII',  role: 'Shop-floor',          pulls: 'Dispensary scale feed · line run-state',            freq: 'Live WebSocket' },
          { sys: 'Gate log', role: 'Yard · carrier',      pulls: 'Truck arrive/depart timestamps',                     freq: '2 min poll' },
          { sys: 'SSO',      role: 'Identity',            pulls: 'User · role · plant membership',                     freq: 'OIDC' },
          { sys: 'WM360',    role: 'Derived store',       pulls: 'Exceptions · assignments · acknowledgements',        freq: 'Owned by this app' },
        ].map((s) => (
          <div key={s.sys} className="integration-card">
            <div className="integration-sys">{s.sys}</div>
            <div className="integration-role">{s.role}</div>
            <div className="integration-pulls">{s.pulls}</div>
            <div className="integration-freq"><Icon name="refresh" size={10}/> {s.freq}</div>
          </div>
        ))}
      </div>
    </Card>
  </div>
);

/* ER diagram — hand-drawn SVG with labelled relationships */
const ERDiagram = () => {
  // Positions in a 1000x540 canvas
  const boxes = [
    { id: 'po',  x:  80, y: 210, w: 150, h: 58, label: 'Process Order',  sap: 'AFKO/AFPO',  tone: 'forest' },
    { id: 'to',  x: 320, y: 210, w: 150, h: 58, label: 'Transfer Order', sap: 'LTAK/LTAP',  tone: 'slate' },
    { id: 'del', x: 560, y:  80, w: 150, h: 58, label: 'Delivery',       sap: 'LIKP/LIPS',  tone: 'sunset' },
    { id: 'rec', x: 560, y: 340, w: 150, h: 58, label: 'Receipt',        sap: 'EKKO/MKPF',  tone: 'sage' },
    { id: 'hu',  x: 800, y: 210, w: 140, h: 58, label: 'Handling Unit',  sap: 'VEKP · SSCC', tone: 'valentia' },
    { id: 'qu',  x: 800, y: 420, w: 140, h: 58, label: 'Quant',          sap: 'LQUA',        tone: 'jade' },
    { id: 'bin', x: 560, y: 460, w: 150, h: 58, label: 'Storage Bin',    sap: 'LAGP',        tone: 'slate' },
    { id: 'bat', x: 320, y:  80, w: 150, h: 58, label: 'Batch',          sap: 'MCHA',        tone: 'sunrise' },
    { id: 'dsp', x:  80, y:  80, w: 150, h: 58, label: 'Dispensary',     sap: 'MII',         tone: 'sunset' },
    { id: 'exc', x:  80, y: 420, w: 150, h: 58, label: 'Exception',      sap: 'Derived',     tone: 'sunset' },
    { id: 'mat', x: 320, y: 460, w: 150, h: 58, label: 'Material',       sap: 'MARA',        tone: 'forest' },
  ];
  const bx = Object.fromEntries(boxes.map((b) => [b.id, b]));
  const cx = (b) => b.x + b.w / 2;
  const cy = (b) => b.y + b.h / 2;

  // helper: orthogonal-ish connector between two boxes (smooth curve)
  const curve = (a, b) => {
    const ax = cx(a), ay = cy(a), bxp = cx(b), byp = cy(b);
    const mx = (ax + bxp) / 2;
    return `M${ax},${ay} C${mx},${ay} ${mx},${byp} ${bxp},${byp}`;
  };

  const edges = [
    { from: 'po',  to: 'to',  label: '1..n', style: 'solid' },
    { from: 'po',  to: 'bat', label: '1..n', style: 'solid' },
    { from: 'po',  to: 'dsp', label: '0..n', style: 'solid' },
    { from: 'po',  to: 'exc', label: '0..n', style: 'dashed' },
    { from: 'to',  to: 'del', label: '1..n', style: 'solid' },
    { from: 'to',  to: 'rec', label: '0..n', style: 'solid' },
    { from: 'to',  to: 'hu',  label: '0..1', style: 'solid' },
    { from: 'rec', to: 'bat', label: '0..n', style: 'solid' },
    { from: 'rec', to: 'hu',  label: '0..n', style: 'solid' },
    { from: 'hu',  to: 'qu',  label: '1..n', style: 'solid' },
    { from: 'bin', to: 'qu',  label: '0..n', style: 'solid' },
    { from: 'bat', to: 'qu',  label: '1..1', style: 'solid' },
    { from: 'mat', to: 'bat', label: '1..n', style: 'solid' },
    { from: 'exc', to: 'to',  label: 'polymorphic', style: 'dashed' },
  ];

  return (
    <div className="er-wrap">
      <svg viewBox="0 0 1020 540" className="er-svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--valentia-slate)"/>
          </marker>
          <marker id="arr-dash" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="var(--sunset)"/>
          </marker>
        </defs>
        {edges.map((e, i) => {
          const a = bx[e.from], b = bx[e.to];
          const path = curve(a, b);
          const midx = (cx(a) + cx(b)) / 2, midy = (cy(a) + cy(b)) / 2;
          return (
            <g key={i}>
              <path d={path} className={`er-edge ${e.style === 'dashed' ? 'dashed' : ''}`}
                markerEnd={e.style === 'dashed' ? 'url(#arr-dash)' : 'url(#arr)'}/>
              <g transform={`translate(${midx},${midy})`}>
                <rect x="-22" y="-8" width="44" height="16" rx="3" fill="white" stroke="var(--stroke-soft)"/>
                <text y="4" textAnchor="middle" className="er-edge-label">{e.label}</text>
              </g>
            </g>
          );
        })}
        {boxes.map((b) => (
          <g key={b.id} transform={`translate(${b.x},${b.y})`} className={`er-node is-${b.tone}`}>
            <rect width={b.w} height={b.h} rx="6"/>
            <text x="10" y="22" className="er-node-label">{b.label}</text>
            <text x="10" y="40" className="er-node-sap">{b.sap}</text>
          </g>
        ))}
      </svg>
    </div>
  );
};

/* ================================================================
   Page shell with tabs
   ================================================================ */
const DocsPage = () => {
  const [tab, setTab] = React.useState('concept');
  return (
    <div className="page">
      <DocsTabs current={tab} onChange={setTab}/>
      {tab === 'concept' && <DocConcept/>}
      {tab === 'kpis'    && <DocKPIs/>}
      {tab === 'data'    && <DocData/>}
    </div>
  );
};


export { DocsPage };
