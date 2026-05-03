// spec.jsx — Spec & Documentation page

const { Icon } = window.UI;

function Spec({ onNav }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 1100 }}>
      <div className="card">
        <div className="card-h">
          <span className="eyebrow">Functional spec</span>
          <span className="title">SAP Inventory Management — module overview</span>
        </div>
        <div style={{ padding: 24, display: "grid", gap: 20 }}>
          <p style={{ fontSize: 13, color: "var(--c-fg-mute)", maxWidth: 720, lineHeight: 1.6 }}>
            This UI is a single-pane working surface over Kerry's SAP S/4 inventory data, unifying <strong>IM (Inventory Management)</strong> and <strong>WM (Warehouse Management)</strong> views.
            Designed for plant inventory analysts, controllers, and warehouse leads. Reconciliation between the IM book and WM physical state is the central workflow.
          </p>

          <SpecBlock id="M-OV" name="Control Tower (Overview)" persona="All personas — landing page" cta={() => onNav("overview")}
            purpose="Daily situational awareness across plants. Surfaces health, mismatches, value, exceptions, and active activity in one scan."
            data={["MARD (IM stock by sloc)","LQUA / LAGP (WM quants & bins)","MSEG (movements)","Reconciliation engine output"]}
            features={[
              "Alert strip — top 4 critical issues, click to deep-link to source",
              "6 KPI tiles — IM, WM, value, true variance, interim, exceptions (with sparklines & info tooltips)",
              "Plant cards — recon score per plant + drill into IM/WM",
              "Stock status composition with interim-watch callout",
              "Reconciliation summary tiles + aging bar chart",
              "Recent movements table (live feed)",
            ]}/>

          <SpecBlock id="M-IM" name="IM Inventory Explorer" persona="Inventory Analyst, Plant Controller" cta={() => onNav("im")}
            purpose="Browse on-hand inventory at the IM level (plant + storage location). Compare IM book to WM physical, drill into plant/sloc rows."
            data={["MARD","MBEW (valuation)","Material master (MARA/MAKT)","Plant–SLoc–WM mapping (T320)"]}
            features={[
              "Material-grouped table — expand to see plant/sloc breakdown",
              "Stock status split bar (unrestricted/QI/interim/restricted/blocked) with hover detail",
              "ABC/XYZ classification badges",
              "IM ↔ WM delta column with severity coloring",
              "Filter by plant, search, sortable columns, exportable",
            ]}/>

          <SpecBlock id="M-WM" name="WM Warehouse Explorer" persona="Warehouse Lead, Operations" cta={() => onNav("wm")}
            purpose="Drill into warehouse internals — storage types, bins, quants, open transfer orders. Surface interim-storage stuck stock."
            data={["LAGP (storage types)","LQUA (quants)","LTAK/LTAP (transfer orders)","T331 (storage bin master)"]}
            features={[
              "Warehouse hierarchy panel (NS01, BL01, RT01…)",
              "Storage type cards with utilization bars & open-TO counts; interim flagged",
              "Bin-level table with quant detail, status, open TO, last verified",
              "Interim watch — Z921/Z922/Z930 stuck-stock dashboard",
            ]}/>

          <div className="card" style={{ border: "1.5px solid var(--c-warning)", background: "var(--c-warning-soft)" }}>
            <div style={{ padding: 16 }}>
              <SpecBlock inline id="M-RC" name="Reconciliation Workbench  ★ priority module" persona="Plant Controller, Inventory Analyst" cta={() => onNav("recon")}
                purpose="The financial-impact module. Triage every IM/WM mismatch, classify by root cause, assign and resolve. The whole UX collapses if this is weak."
                data={["IM/WM diff engine output","TO timing register","QI status changes","Movement history (MSEG)"]}
                features={[
                  "Status summary strip with click-to-filter (true / timing / interim / sync) + financial exposure",
                  "3 modes: Triage queue (grouped by root cause), Ledger (IM↔WM side-by-side), Stock Flow (Sankey)",
                  "Investigation panel: large IM/WM delta visualization, hypothesis banner, activity timeline, disposition controls",
                  "Bulk select + bulk actions (assign, mark timing, resolve)",
                  "Adjustments post via MI07 / LI20 transactions (mocked)",
                ]}/>
            </div>
          </div>

          <SpecBlock id="M-AN" name="Inventory Analytics & Insights" persona="Plant Controller, Director of Operations" cta={() => onNav("analytics")}
            purpose="Strategic view on aging, obsolescence, ABC/XYZ segmentation, expiry risk, slow movers."
            data={["Aging buckets from movement history","Material classification (LIS / forecast)","Batch master (MCH1) — expiry"]}
            features={[
              "Aging value bar chart with at-risk callouts",
              "ABC × XYZ heatmap matrix (9 cells)",
              "90-day on-hand vs. demand trend",
              "Expiry & slow-mover table with disposition actions (quarantine, promote, write-down)",
            ]}/>

          <SpecBlock id="M-EX" name="Exceptions" persona="Inventory Analyst, Auto-routing" cta={() => onNav("exceptions")}
            purpose="The action queue. All exception types in one place with severity, SLA, ownership, and bulk actions."
            data={["Reconciliation engine","Stock posting errors (IDoc backlog)","Negative stock checks","Aged QI / interim watchers"]}
            features={[
              "Severity bars (1-4) + SLA breach badges + age coloring",
              "Filter chips: All / SEV-4 / SEV-3 / Open / Mine",
              "Bulk multi-select with assign / acknowledge / escalate",
              "Routes to Recon Workbench, IM/WM Explorer, or movement history depending on type",
            ]}/>

          <div className="card" style={{ background: "var(--c-surface-2)" }}>
            <div style={{ padding: 16 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Cross-cutting design notes</h3>
              <ul style={{ fontSize: 12, color: "var(--c-fg-mute)", lineHeight: 1.7, paddingLeft: 18 }}>
                <li><strong>Density:</strong> Bloomberg / Linear-tier — 12px body, 11px secondary, sub-pixel borders. SAP users want maximum information density.</li>
                <li><strong>Color discipline:</strong> Kerry brand teal/green only as signature; semantic colors carry information meaning. Severity = SEV-1 grey → SEV-4 red.</li>
                <li><strong>Mismatch taxonomy:</strong> 4 kinds — In sync (success), Timing lag (info), Interim/status (purple), True variance (danger). Used everywhere consistently.</li>
                <li><strong>Personas:</strong> Switcher in top bar reframes language and default views. Analyst → Recon; Controller → Analytics; Warehouse Lead → WM.</li>
                <li><strong>Tweaks:</strong> theme (light/dark), density (cozy/compact), spec-annotations overlay — toggle from the design tab.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SpecBlock({ id, name, persona, purpose, data, features, cta, inline }) {
  return (
    <div style={{ borderLeft: inline ? "none" : "3px solid var(--c-brand)", paddingLeft: inline ? 0 : 14 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
        <span className="code" style={{ color: "var(--c-brand)" }}>{id}</span>
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>{name}</h2>
        {cta && <button className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }} onClick={cta}>Open module<Icon name="arrowRight" size={12}/></button>}
      </div>
      <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--c-fg-mute)", letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 10 }}>For: {persona}</div>
      <p style={{ fontSize: 13, color: "var(--c-fg)", marginBottom: 12, maxWidth: 720, lineHeight: 1.6 }}>{purpose}</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 16 }}>
        <div>
          <div className="kpi-eyebrow" style={{ marginBottom: 6 }}>SAP data sources</div>
          <ul style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--c-fg-mute)", lineHeight: 1.6, paddingLeft: 14 }}>
            {data.map(d => <li key={d}>{d}</li>)}
          </ul>
        </div>
        <div>
          <div className="kpi-eyebrow" style={{ marginBottom: 6 }}>Features</div>
          <ul style={{ fontSize: 12, color: "var(--c-fg)", lineHeight: 1.6, paddingLeft: 14 }}>
            {features.map(f => <li key={f}>{f}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}

window.Spec = Spec;
