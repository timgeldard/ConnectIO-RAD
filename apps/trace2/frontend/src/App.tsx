import { CSSProperties, ReactNode, useEffect, useState } from "react";
import type { Batch, DemoState, PageId, Tweaks } from "./types";
import { BATCH, BATCH_FAIL, BATCH_RECALL } from "./data/mock";
import { fetchOverview } from "./data/api";
import { HexMark, ParamField, SimBanner, StatusPill } from "./ui";
import { PageRecallReadiness } from "./pages/RecallReadiness";
import { PageBottomUp } from "./pages/BottomUp";
import { PageTopDown } from "./pages/TopDown";
import { PageMassBalance } from "./pages/MassBalance";
import { PageQuality } from "./pages/Quality";
import { PageProductionHistory } from "./pages/ProductionHistory";
import { PageBatchCompare } from "./pages/BatchCompare";
import { PageSupplierRisk } from "./pages/SupplierRisk";
import { PageCoA } from "./pages/CoA";
import { PageOverview } from "./pages/Overview";
import { PageCustomersDeliveries } from "./pages/CustomersDeliveries";

export type PageProps = {
  batch: Batch;
  navigate: (id: PageId) => void;
  sim?: boolean;
  onSim?: (v: boolean) => void;
  maxLevels?: number;
  setMaxLevels?: (v: number) => void;
  maxInputDepth?: number;
  setMaxInputDepth?: (v: number) => void;
};
type PageComponent = (props: PageProps) => JSX.Element;

interface PageDef {
  id: PageId;
  label: string;
  component: PageComponent;
  num: string;
  group: string;
}

const NAV_GROUPS = ["360°", "Lineage", "Quality & production", "Readiness"] as const;

const PAGES: PageDef[] = [
  { id: "overview",             label: "Overview",               component: PageOverview as unknown as PageComponent,             num: "01", group: "360°" },
  { id: "mass_balance",         label: "Mass Balance",           component: PageMassBalance as unknown as PageComponent,         num: "02", group: "360°" },
  { id: "bottom_up",            label: "Bottom-Up Trace",        component: PageBottomUp as unknown as PageComponent,            num: "03", group: "Lineage" },
  { id: "top_down",             label: "Top-Down Trace",         component: PageTopDown as unknown as PageComponent,             num: "04", group: "Lineage" },
  { id: "customers_deliveries", label: "Customers & Deliveries", component: PageCustomersDeliveries as unknown as PageComponent, num: "05", group: "Lineage" },
  { id: "quality",              label: "Quality",                component: PageQuality as unknown as PageComponent,             num: "06", group: "Quality & production" },
  { id: "production_history",   label: "Production History",     component: PageProductionHistory as unknown as PageComponent,   num: "07", group: "Quality & production" },
  { id: "batch_comparison",     label: "Batch Comparison",       component: PageBatchCompare as unknown as PageComponent,        num: "08", group: "Quality & production" },
  { id: "supplier_risk",        label: "Suppliers",              component: PageSupplierRisk as unknown as PageComponent,        num: "09", group: "Quality & production" },
  { id: "recall_readiness",     label: "Issue Readiness",        component: PageRecallReadiness as unknown as PageComponent,     num: "10", group: "Readiness" },
  { id: "coa",                  label: "Certificate of Analysis",component: PageCoA as unknown as PageComponent,                 num: "11", group: "Readiness" },
];

const TWEAK_DEFAULTS: Tweaks = {
  theme: "light",
  density: "comfortable",
  brandName: "Kerry",
};

const LIGHT_THEME: Record<string, string> = {
  "--paper":          "#FFFFFF",
  "--paper-2":        "#F8F8EE",
  "--card":           "#FFFFFF",
  "--panel":          "#FAFAF2",
  "--ink":            "#143700",
  "--ink-2":          "color-mix(in srgb, #143700 68%, white)",
  "--ink-3":          "color-mix(in srgb, #143700 45%, white)",
  "--ink-4":          "color-mix(in srgb, #143700 28%, white)",
  "--line":           "color-mix(in srgb, #143700 12%, transparent)",
  "--line-2":         "color-mix(in srgb, #143700 22%, transparent)",
  "--hover":          "color-mix(in srgb, #005776 7%, transparent)",
  "--brand":          "#005776",
  "--brand-deep":     "#003C52",
  "--brand-20":       "color-mix(in srgb, #005776 14%, white)",
  "--brand-10":       "color-mix(in srgb, #005776 7%, white)",
  "--slate-surface":  "#E3EEF3",
  "--forest-surface": "#E8EDE1",
  "--stone":          "#F1F1E5",
  "--valentia-slate": "#005776",
  "--forest":         "#143700",
  "--sage":           "#289BA2",
  "--jade":           "#44CF93",
  "--sunrise":        "#F9C20A",
  "--sunset":         "#F24A00",
  "--innovation":     "#DFFF11",
  "--font-sans":      "'Noto Sans', ui-sans-serif, system-ui, sans-serif",
  "--font-serif":     "'Noto Serif', ui-serif, Georgia, serif",
  "--font-impact":    "'Noto Sans Condensed', 'Noto Sans', sans-serif",
  "--font-mono":      "'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace",
};

const DARK_THEME: Record<string, string> = {
  "--paper":          "#14120D",
  "--paper-2":        "#1A1813",
  "--card":           "#1F1C16",
  "--panel":          "#17150F",
  "--ink":            "#F0EBD8",
  "--ink-2":          "color-mix(in srgb, #F0EBD8 70%, #1A1813)",
  "--ink-3":          "color-mix(in srgb, #F0EBD8 42%, #1A1813)",
  "--ink-4":          "color-mix(in srgb, #F0EBD8 25%, #1A1813)",
  "--line":           "rgba(240,235,216,0.08)",
  "--line-2":         "rgba(240,235,216,0.14)",
  "--hover":          "rgba(0,87,118,0.12)",
  "--brand":          "#3A9BBE",
  "--brand-deep":     "#005776",
  "--brand-20":       "rgba(58,155,190,0.18)",
  "--brand-10":       "rgba(58,155,190,0.09)",
  "--slate-surface":  "rgba(58,155,190,0.12)",
  "--forest-surface": "rgba(40,155,162,0.1)",
  "--stone":          "#1A1813",
  "--valentia-slate": "#3A9BBE",
  "--forest":         "#F0EBD8",
  "--sage":           "#4CC4CB",
  "--jade":           "#55DFA0",
  "--sunrise":        "#FBC632",
  "--sunset":         "#FF6B2B",
  "--innovation":     "#DFFF11",
  "--font-sans":      "'Noto Sans', ui-sans-serif, system-ui, sans-serif",
  "--font-serif":     "'Noto Serif', ui-serif, Georgia, serif",
  "--font-impact":    "'Noto Sans Condensed', 'Noto Sans', sans-serif",
  "--font-mono":      "'IBM Plex Mono', ui-monospace, SFMono-Regular, monospace",
};

function NavLink({ page, active, onClick }: { page: PageDef; active: boolean; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: "7px 14px",
        cursor: "pointer",
        background: active ? "rgba(255,255,255,0.08)" : hover ? "rgba(255,255,255,0.05)" : "transparent",
        borderLeft: `3px solid ${active ? "var(--innovation)" : "transparent"}`,
        display: "flex",
        alignItems: "center",
        gap: 10,
        borderRadius: "0 4px 4px 0",
        marginBottom: 1,
        transition: "background 150ms ease",
      }}
    >
      <span style={{
        fontFamily: "var(--font-mono)",
        fontSize: 10.5,
        color: active ? "var(--innovation)" : "rgba(255,255,255,0.5)",
        fontVariantNumeric: "tabular-nums",
        flexShrink: 0,
      }}>
        {page.num}
      </span>
      <span style={{
        fontFamily: "var(--font-sans)",
        fontSize: 13,
        color: active ? "#fff" : "rgba(255,255,255,0.78)",
        fontWeight: active ? 500 : 400,
      }}>
        {page.label}
      </span>
    </div>
  );
}

function Sidebar({ active, onNavigate }: { active: PageId; onNavigate: (id: PageId) => void }) {
  const groups = NAV_GROUPS.map((g) => ({ label: g, pages: PAGES.filter((p) => p.group === g) }));
  return (
    <aside style={{
      width: 248,
      flexShrink: 0,
      background: "var(--valentia-slate)",
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      position: "sticky",
      top: 0,
      zIndex: 20,
    }}>
      <div style={{ padding: "20px 20px 16px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ marginBottom: 6 }}>
          <img src="/kerry-logo-white.png" alt="Kerry" style={{ height: 26, display: "block" }} />
        </div>
        <div style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9.5, color: "rgba(255,255,255,0.5)",
          textTransform: "uppercase", letterSpacing: "0.14em",
        }}>
          Global Ops · Batch Traceability
        </div>
      </div>

      <nav style={{ padding: "14px 8px", flex: 1, overflowY: "auto" }}>
        {groups.map((g) => (
          <div key={g.label} style={{ marginBottom: 16 }}>
            <div style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9, color: "rgba(255,255,255,0.45)",
              letterSpacing: "0.18em", padding: "2px 14px 6px",
              textTransform: "uppercase",
            }}>{g.label}</div>
            {g.pages.map((p) => (
              <NavLink key={p.id} page={p} active={active === p.id} onClick={() => onNavigate(p.id)} />
            ))}
          </div>
        ))}
      </nav>

      <div style={{ padding: "12px 20px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "rgba(255,255,255,0.38)", letterSpacing: "0.08em" }}>
          Batch Traceability · v2
        </div>
      </div>
    </aside>
  );
}

function GhostIconButton({ children, title, onClick }: { children: ReactNode; title?: string; onClick?: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 32, height: 32,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: hover ? "var(--slate-surface)" : "var(--paper)",
        color: hover ? "var(--brand)" : "var(--ink-3)",
        border: `1px solid ${hover ? "var(--brand)" : "var(--line-2)"}`,
        borderRadius: 4, cursor: "pointer",
        fontSize: 15, fontFamily: "var(--font-sans)",
        transition: "all 150ms ease",
      }}
    >{children}</button>
  );
}

function TopBar({ batch }: { batch: Batch }) {
  return (
    <div style={{
      height: 64,
      padding: "0 28px",
      borderBottom: "1px solid var(--line)",
      background: "var(--paper)",
      display: "flex",
      alignItems: "center",
      gap: 20,
      position: "sticky",
      top: 0,
      zIndex: 10,
    }}>
      <div style={{
        fontFamily: "var(--font-mono)",
        fontSize: 10, color: "var(--ink-3)",
        textTransform: "uppercase", letterSpacing: "0.12em",
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}>
        Global Ops{" "}
        <span style={{ opacity: 0.5 }}>/</span>{" "}
        <span style={{ color: "var(--brand)", fontWeight: 500 }}>{batch.batch_id}</span>
      </div>

      <div style={{ flex: 1, display: "flex", justifyContent: "center", overflow: "hidden" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 12,
          padding: "8px 14px",
          background: "var(--panel)",
          border: "1px solid var(--line-2)",
          borderRadius: 6,
          maxWidth: 860, overflow: "hidden",
        }}>
          <img src="/kerry-k.png" alt="" style={{ height: 20, display: "block", flexShrink: 0 }} />
          <ParamField label="Material" value={batch.material_id} />
          <div style={{ width: 1, height: 26, background: "var(--line-2)", flexShrink: 0 }} />
          <ParamField label="Description" value={batch.material_desc40} mono={false} />
          <div style={{ width: 1, height: 26, background: "var(--line-2)", flexShrink: 0 }} />
          <ParamField label="Batch" value={batch.batch_id} emphasize />
          <div style={{ width: 1, height: 26, background: "var(--line-2)", flexShrink: 0 }} />
          <ParamField label="Plant" value={batch.plant_name || batch.plant_id} mono={false} />
          <StatusPill status={batch.batch_status} size="sm" />
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <GhostIconButton title="Refresh" onClick={() => window.location.reload()}>↻</GhostIconButton>
      </div>
    </div>
  );
}

function TweakRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <span style={{ fontSize: 11.5, color: "var(--ink-2)", fontFamily: "var(--font-sans)" }}>{label}</span>
      <div>{children}</div>
    </div>
  );
}

function Segmented<V extends string>({
  options, value, onChange,
}: {
  options: { k: V; l: string }[];
  value: V;
  onChange: (v: V) => void;
}) {
  return (
    <div style={{ display: "flex", border: "1px solid var(--line-2)", borderRadius: 3, overflow: "hidden" }}>
      {options.map((o) => (
        <button key={o.k} onClick={() => onChange(o.k)} style={{
          padding: "4px 10px", fontSize: 11,
          background: value === o.k ? "var(--ink)" : "transparent",
          color: value === o.k ? "var(--paper)" : "var(--ink-2)",
          border: "none", cursor: "pointer",
          fontFamily: "var(--font-sans)",
        }}>{o.l}</button>
      ))}
    </div>
  );
}

function BatchPicker({
  materialDraft, batchDraft, onMaterialChange, onBatchChange, onApply, dirty,
}: {
  materialDraft: string; batchDraft: string;
  onMaterialChange: (v: string) => void; onBatchChange: (v: string) => void;
  onApply: () => void; dirty: boolean;
}) {
  const inputStyle: CSSProperties = {
    padding: "5px 9px",
    border: "1px solid var(--line-2)",
    background: "var(--paper)",
    color: "var(--ink)",
    fontFamily: "var(--font-mono)",
    fontSize: 12, borderRadius: 3,
    minWidth: 148,
    outline: "none",
  };
  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && dirty) onApply();
  }
  return (
    <div style={{
      padding: "8px 28px",
      borderBottom: "1px solid var(--line)",
      background: "var(--paper-2)",
      display: "flex", alignItems: "center", gap: 12,
    }}>
      <span style={{
        fontFamily: "var(--font-mono)", fontSize: 9.5,
        color: "var(--ink-3)", letterSpacing: "0.14em",
        textTransform: "uppercase",
      }}>Live batch</span>
      <label style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--ink-2)", fontFamily: "var(--font-sans)", fontSize: 11.5 }}>
        Material
        <input value={materialDraft} onChange={(e) => onMaterialChange(e.target.value)} onKeyDown={handleKey} style={inputStyle} placeholder="Material ID" />
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--ink-2)", fontFamily: "var(--font-sans)", fontSize: 11.5 }}>
        Batch
        <input value={batchDraft} onChange={(e) => onBatchChange(e.target.value)} onKeyDown={handleKey} style={inputStyle} placeholder="Batch ID" />
      </label>
      <button
        onClick={onApply}
        disabled={!dirty}
        style={{
          padding: "5px 13px", fontSize: 11.5,
          background: dirty ? "var(--brand)" : "var(--line)",
          color: dirty ? "#fff" : "var(--ink-3)",
          border: "none", borderRadius: 3,
          cursor: dirty ? "pointer" : "not-allowed",
          fontFamily: "var(--font-sans)",
        }}
      >Load</button>
    </div>
  );
}

function TweaksPanel({
  open, tweaks, setTweaks, demoState, setDemoState,
}: {
  open: boolean; tweaks: Tweaks; setTweaks: (patch: Partial<Tweaks>) => void;
  demoState: DemoState; setDemoState: (v: DemoState) => void;
}) {
  if (!open) return null;
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, width: 320,
      background: "var(--card)", border: "1px solid var(--line-2)",
      boxShadow: "0 10px 40px rgba(20,55,0,0.12)",
      zIndex: 100, borderRadius: 8,
    }}>
      <div style={{
        padding: "14px 18px", borderBottom: "1px solid var(--line)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 600, color: "var(--forest)" }}>Design controls</span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9.5, color: "var(--ink-3)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
          Ctrl+.
        </span>
      </div>
      <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
        <TweakRow label="Theme">
          <Segmented<Tweaks["theme"]>
            options={[{ k: "light", l: "Light" }, { k: "dark", l: "Dark" }]}
            value={tweaks.theme}
            onChange={(v) => setTweaks({ theme: v })}
          />
        </TweakRow>
        <TweakRow label="Density">
          <Segmented<Tweaks["density"]>
            options={[{ k: "comfortable", l: "Comfortable" }, { k: "compact", l: "Compact" }]}
            value={tweaks.density}
            onChange={(v) => setTweaks({ density: v })}
          />
        </TweakRow>
        <TweakRow label="Demo state">
          <Segmented<DemoState>
            options={[{ k: "default", l: "Released" }, { k: "qi", l: "In QI" }, { k: "recall", l: "Blocked" }]}
            value={demoState}
            onChange={setDemoState}
          />
        </TweakRow>
        <TweakRow label="Brand name">
          <input
            value={tweaks.brandName}
            onChange={(e) => setTweaks({ brandName: e.target.value })}
            style={{
              padding: "5px 8px", border: "1px solid var(--line-2)",
              background: "var(--paper)", fontFamily: "var(--font-sans)",
              fontSize: 12, color: "var(--ink)", borderRadius: 3, width: "100%",
            }}
          />
        </TweakRow>
      </div>
    </div>
  );
}

function loadTweaks(): Tweaks {
  try {
    const raw = localStorage.getItem("mi:tweaks");
    if (raw) return { ...TWEAK_DEFAULTS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return TWEAK_DEFAULTS;
}

function loadPage(): PageId {
  const stored = localStorage.getItem("mi:page") as PageId | null;
  if (stored && PAGES.some((p) => p.id === stored)) return stored;
  return "overview";
}

export default function App() {
  const [page, setPage] = useState<PageId>(loadPage);
  const [maxLevels, setMaxLevels] = useState(3);
  const [maxInputDepth, setMaxInputDepth] = useState(3);
  const [demoState, setDemoState] = useState<DemoState>("default");
  const [sim, setSim] = useState(false);
  const [tweaksOpen, setTweaksOpen] = useState(false);
  const [tweaks, setTweaksState] = useState<Tweaks>(loadTweaks);

  function setTweaks(patch: Partial<Tweaks>) {
    const next = { ...tweaks, ...patch };
    setTweaksState(next);
    try { localStorage.setItem("mi:tweaks", JSON.stringify(next)); } catch { /* ignore */ }
  }

  useEffect(() => {
    try { localStorage.setItem("mi:page", page); } catch { /* ignore */ }
  }, [page]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ".") setTweaksOpen((o) => !o);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const theme = tweaks.theme === "dark" ? DARK_THEME : LIGHT_THEME;
  const cssVars: CSSProperties = { ...(theme as CSSProperties) };

  const mockBatch: Batch = demoState === "qi" ? BATCH_FAIL : demoState === "recall" ? BATCH_RECALL : BATCH;
  const pageDef = PAGES.find((p) => p.id === page) ?? PAGES[0];
  const PageComp = pageDef.component;

  const [liveMaterialId, setLiveMaterialId] = useState("20582002");
  const [liveBatchId, setLiveBatchId] = useState("0008898869");
  const [materialDraft, setMaterialDraft] = useState(liveMaterialId);
  const [batchDraft, setBatchDraft] = useState(liveBatchId);
  const [liveBatch, setLiveBatch] = useState<Batch | null>(null);

  useEffect(() => {
    if (!liveMaterialId || !liveBatchId) return;
    let cancelled = false;
    setLiveBatch(null);
    fetchOverview(liveMaterialId, liveBatchId)
      .then((payload) => { if (!cancelled) setLiveBatch(payload.batch); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [liveMaterialId, liveBatchId]);

  const batch: Batch = liveBatch ?? { ...mockBatch, material_id: liveMaterialId, batch_id: liveBatchId };

  return (
    <div style={{ ...cssVars, minHeight: "100vh", color: "var(--ink)" }}>
      <div style={{ display: "flex" }}>
        <Sidebar active={page} onNavigate={setPage} />
        <main style={{ flex: 1, minWidth: 0, background: "var(--stone)" }}>
          <TopBar batch={batch} />
          {sim && (
            <div style={{ padding: "12px 28px 0" }}>
              <SimBanner batchId={batch.batch_id} onClear={() => setSim(false)} />
            </div>
          )}
          <BatchPicker
            materialDraft={materialDraft}
            batchDraft={batchDraft}
            onMaterialChange={setMaterialDraft}
            onBatchChange={setBatchDraft}
            onApply={() => {
              setLiveMaterialId(materialDraft.trim());
              setLiveBatchId(batchDraft.trim());
              setSim(false);
            }}
            dirty={materialDraft.trim() !== liveMaterialId || batchDraft.trim() !== liveBatchId}
          />
          <div style={{ padding: tweaks.density === "compact" ? "24px 28px" : "36px 40px", maxWidth: 1440 }}>
            <PageComp
              batch={batch}
              navigate={setPage}
              sim={sim}
              onSim={setSim}
              maxLevels={maxLevels}
              setMaxLevels={setMaxLevels}
              maxInputDepth={maxInputDepth}
              setMaxInputDepth={setMaxInputDepth}
            />
          </div>
        </main>
      </div>
      <TweaksPanel
        open={tweaksOpen}
        tweaks={tweaks}
        setTweaks={setTweaks}
        demoState={demoState}
        setDemoState={setDemoState}
      />
      {tweaksOpen && (
        <div
          onClick={() => setTweaksOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 99 }}
        />
      )}
    </div>
  );
}
