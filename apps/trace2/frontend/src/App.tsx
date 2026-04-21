import { CSSProperties, ReactNode, useEffect, useState } from "react";
import type { Batch, DemoState, PageId, Tweaks } from "./types";
import { BATCH, BATCH_FAIL, BATCH_RECALL } from "./data/mock";
import { ParamField } from "./ui";
import { PageRecallReadiness } from "./pages/RecallReadiness";
import { PageBottomUp } from "./pages/BottomUp";
import { PageTopDown } from "./pages/TopDown";
import { PageMassBalance } from "./pages/MassBalance";
import { PageQuality } from "./pages/Quality";
import { PageProductionHistory } from "./pages/ProductionHistory";
import { PageBatchCompare } from "./pages/BatchCompare";
import { PageSupplierRisk } from "./pages/SupplierRisk";
import { PageCoA } from "./pages/CoA";

type PageComponent = (props: { batch: Batch; navigate: (id: PageId) => void }) => JSX.Element;

interface PageDef {
  id: PageId;
  label: string;
  component: PageComponent;
  num: string;
  accent?: "danger";
}

const PAGES: PageDef[] = [
  { id: "recall_readiness", label: "Recall Readiness", component: PageRecallReadiness as PageComponent, num: "01", accent: "danger" },
  { id: "bottom_up", label: "Bottom-Up Trace", component: PageBottomUp as PageComponent, num: "02" },
  { id: "top_down", label: "Top-Down Trace", component: PageTopDown as PageComponent, num: "03" },
  { id: "mass_balance", label: "Mass Balance", component: PageMassBalance as PageComponent, num: "04" },
  { id: "quality", label: "Quality", component: PageQuality as PageComponent, num: "05" },
  { id: "production_history", label: "Production History", component: PageProductionHistory as PageComponent, num: "06" },
  { id: "batch_comparison", label: "Batch Comparison", component: PageBatchCompare as PageComponent, num: "07" },
  { id: "supplier_risk", label: "Supplier Risk", component: PageSupplierRisk as PageComponent, num: "08" },
  { id: "coa", label: "Certificate of Analysis", component: PageCoA as PageComponent, num: "09" },
];

const TWEAK_DEFAULTS: Tweaks = {
  theme: "light",
  accent: "forest",
  density: "comfortable",
  brandName: "Meridian",
  mono: false,
};

const LIGHT_THEME: Record<string, string> = {
  "--paper": "#ffffff",
  "--paper-2": "#f7f7f5",
  "--card": "#ffffff",
  "--ink": "#0f1419",
  "--ink-2": "#4a5159",
  "--ink-3": "#8a9199",
  "--line": "#ececec",
  "--line-2": "#d7d7d7",
  "--hover": "rgba(15,20,25,0.03)",
};

const DARK_THEME: Record<string, string> = {
  "--paper": "#15130e",
  "--paper-2": "#1a1813",
  "--card": "#1f1c16",
  "--ink": "#f0ebdf",
  "--ink-2": "#a8a192",
  "--ink-3": "#6f6858",
  "--line": "#2a2620",
  "--line-2": "#3a352c",
  "--hover": "rgba(240,235,223,0.04)",
};

const ACCENT_MAP: Record<Tweaks["accent"], string> = {
  forest: "oklch(38% 0.06 155)",
  rust: "oklch(52% 0.20 28)",
  navy: "oklch(38% 0.08 250)",
  plum: "oklch(38% 0.08 320)",
};

function NavLink({ page, active, onClick }: { page: PageDef; active: boolean; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: "8px 12px",
        cursor: "pointer",
        background: active ? "var(--card)" : hover ? "var(--hover)" : "transparent",
        borderLeft: `2px solid ${active ? "var(--ink)" : "transparent"}`,
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginBottom: 1,
      }}
    >
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10.5,
          color: active ? "var(--ink)" : "var(--ink-3)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {page.num}
      </span>
      <span
        style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 13,
          color: active ? "var(--ink)" : "var(--ink-2)",
          fontWeight: active ? 500 : 400,
        }}
      >
        {page.label}
      </span>
      {page.accent === "danger" && (
        <span style={{ marginLeft: "auto", width: 5, height: 5, borderRadius: 3, background: "oklch(55% 0.13 40)" }} />
      )}
    </div>
  );
}

function Sidebar({ active, onNavigate, tweaks }: { active: PageId; onNavigate: (id: PageId) => void; tweaks: Tweaks }) {
  return (
    <aside
      style={{
        width: 240,
        flexShrink: 0,
        background: "var(--paper-2)",
        borderRight: "1px solid var(--line)",
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        position: "sticky",
        top: 0,
      }}
    >
      <div style={{ padding: "22px 24px 20px", borderBottom: "1px solid var(--line)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <svg width="22" height="22" viewBox="0 0 22 22">
            <circle cx="11" cy="11" r="10" fill="none" stroke="var(--ink)" strokeWidth="1.2" />
            <path d="M 11 3 L 11 19 M 3 11 L 19 11" stroke="var(--ink)" strokeWidth="0.8" />
            <circle cx="11" cy="11" r="3" fill="oklch(38% 0.06 155)" />
          </svg>
          <div>
            <div
              style={{
                fontFamily: "'Newsreader', Georgia, serif",
                fontSize: 17,
                fontWeight: 500,
                color: "var(--ink)",
                letterSpacing: "-0.01em",
                lineHeight: 1,
              }}
            >
              {tweaks.brandName || "Meridian"}
            </div>
            <div
              style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 10,
                color: "var(--ink-3)",
                textTransform: "uppercase",
                letterSpacing: "0.14em",
                marginTop: 3,
              }}
            >
              Traceability
            </div>
          </div>
        </div>
      </div>

      <nav style={{ padding: "16px 12px", flex: 1, overflowY: "auto" }}>
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9.5,
            color: "var(--ink-3)",
            letterSpacing: "0.16em",
            padding: "4px 12px",
            marginBottom: 4,
            textTransform: "uppercase",
          }}
        >
          Batch analysis
        </div>
        {PAGES.map((p) => (
          <NavLink key={p.id} page={p} active={active === p.id} onClick={() => onNavigate(p.id)} />
        ))}
      </nav>

      <div style={{ padding: "14px 20px", borderTop: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            background: "oklch(38% 0.06 155)",
            color: "var(--paper)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "'Newsreader', Georgia, serif",
            fontSize: 13,
          }}
        >
          H
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, color: "var(--ink)", fontWeight: 500 }}>Dr. H. Vogel</div>
          <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 10.5, color: "var(--ink-3)" }}>Head of Quality</div>
        </div>
      </div>
    </aside>
  );
}

const chevBtn: CSSProperties = {
  width: 22,
  height: 22,
  border: "1px solid var(--line-2)",
  background: "var(--card)",
  color: "var(--ink-2)",
  cursor: "pointer",
  fontSize: 14,
  lineHeight: 1,
  borderRadius: 2,
};

function DepthControl({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <div
        style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 10,
          color: "var(--ink-3)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
        <button onClick={() => onChange(Math.max(1, value - 1))} style={chevBtn}>
          −
        </button>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 13,
            color: "var(--ink)",
            minWidth: 18,
            textAlign: "center",
          }}
        >
          {value}
        </span>
        <button onClick={() => onChange(Math.min(8, value + 1))} style={chevBtn}>
          +
        </button>
      </div>
    </div>
  );
}

function TopBar({
  batch,
  maxLevels,
  setMaxLevels,
  maxInputDepth,
  setMaxInputDepth,
  demoState,
  setDemoState,
}: {
  batch: Batch;
  maxLevels: number;
  setMaxLevels: (v: number) => void;
  maxInputDepth: number;
  setMaxInputDepth: (v: number) => void;
  demoState: DemoState;
  setDemoState: (v: DemoState) => void;
}) {
  const states: { k: DemoState; label: string }[] = [
    { k: "default", label: "Released" },
    { k: "qi", label: "In QI" },
    { k: "recall", label: "Blocked" },
  ];
  return (
    <div
      style={{
        padding: "18px 32px",
        borderBottom: "1px solid var(--line)",
        background: "var(--paper)",
        display: "flex",
        alignItems: "center",
        gap: 28,
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      <div style={{ display: "flex", gap: 24, flex: 1, minWidth: 0 }}>
        <ParamField label="Material ID" value={batch.material_id} emphasize />
        <ParamField label="Material" value={batch.material_desc40} mono={false} emphasize />
        <ParamField label="Batch ID" value={batch.batch_id} emphasize />
        <ParamField label="MFG Date" value={batch.manufacture_date} />
        <ParamField label="Expiry" value={batch.expiry_date} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <DepthControl label="Trace depth ↓" value={maxLevels} onChange={setMaxLevels} />
        <DepthControl label="Input depth ↑" value={maxInputDepth} onChange={setMaxInputDepth} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 4, padding: 3, border: "1px solid var(--line-2)", borderRadius: 2 }}>
        {states.map((s) => (
          <button
            key={s.k}
            onClick={() => setDemoState(s.k)}
            style={{
              padding: "4px 10px",
              fontSize: 11,
              fontFamily: "'Inter', sans-serif",
              background: demoState === s.k ? "var(--ink)" : "transparent",
              color: demoState === s.k ? "var(--paper)" : "var(--ink-2)",
              border: "none",
              borderRadius: 2,
              cursor: "pointer",
            }}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function TweakRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <span style={{ fontSize: 11.5, color: "var(--ink-2)", letterSpacing: "0.02em" }}>{label}</span>
      <div>{children}</div>
    </div>
  );
}

function Segmented<V extends string>({
  options,
  value,
  onChange,
}: {
  options: { k: V; l: string }[];
  value: V;
  onChange: (v: V) => void;
}) {
  return (
    <div style={{ display: "flex", border: "1px solid var(--line-2)", borderRadius: 2 }}>
      {options.map((o) => (
        <button
          key={o.k}
          onClick={() => onChange(o.k)}
          style={{
            padding: "4px 10px",
            fontSize: 11,
            background: value === o.k ? "var(--ink)" : "transparent",
            color: value === o.k ? "var(--paper)" : "var(--ink-2)",
            border: "none",
            cursor: "pointer",
            fontFamily: "'Inter', sans-serif",
          }}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: 34,
        height: 18,
        borderRadius: 9,
        background: checked ? "oklch(38% 0.06 155)" : "var(--line-2)",
        border: "none",
        cursor: "pointer",
        position: "relative",
        padding: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: checked ? 18 : 2,
          width: 14,
          height: 14,
          borderRadius: 7,
          background: "var(--paper)",
          transition: "left 150ms",
        }}
      />
    </button>
  );
}

function BatchPicker({
  materialDraft,
  batchDraft,
  onMaterialChange,
  onBatchChange,
  onApply,
  dirty,
}: {
  materialDraft: string;
  batchDraft: string;
  onMaterialChange: (v: string) => void;
  onBatchChange: (v: string) => void;
  onApply: () => void;
  dirty: boolean;
}) {
  const inputStyle: CSSProperties = {
    padding: "6px 10px",
    border: "1px solid var(--line-2)",
    background: "var(--paper)",
    color: "var(--ink)",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 12,
    borderRadius: 2,
    minWidth: 160,
  };
  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && dirty) onApply();
  }
  return (
    <div
      style={{
        padding: "10px 32px",
        borderBottom: "1px solid var(--line)",
        background: "var(--paper-2)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        fontFamily: "'Inter', sans-serif",
        fontSize: 11.5,
      }}
    >
      <span
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 10,
          color: "var(--ink-3)",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}
      >
        Live batch
      </span>
      <label style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--ink-2)" }}>
        Material
        <input
          value={materialDraft}
          onChange={(e) => onMaterialChange(e.target.value)}
          onKeyDown={handleKey}
          style={inputStyle}
          placeholder="Material ID"
        />
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--ink-2)" }}>
        Batch
        <input
          value={batchDraft}
          onChange={(e) => onBatchChange(e.target.value)}
          onKeyDown={handleKey}
          style={inputStyle}
          placeholder="Batch ID"
        />
      </label>
      <button
        onClick={onApply}
        disabled={!dirty}
        style={{
          padding: "6px 14px",
          fontSize: 11.5,
          background: dirty ? "var(--ink)" : "var(--line)",
          color: dirty ? "var(--paper)" : "var(--ink-3)",
          border: "none",
          borderRadius: 2,
          cursor: dirty ? "pointer" : "not-allowed",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        Load
      </button>
    </div>
  );
}

function TweaksPanel({
  open,
  tweaks,
  setTweaks,
}: {
  open: boolean;
  tweaks: Tweaks;
  setTweaks: (patch: Partial<Tweaks>) => void;
}) {
  if (!open) return null;
  const accents: { k: Tweaks["accent"]; hex: string }[] = [
    { k: "forest", hex: "oklch(38% 0.06 155)" },
    { k: "rust", hex: "oklch(48% 0.15 35)" },
    { k: "navy", hex: "oklch(38% 0.08 250)" },
    { k: "plum", hex: "oklch(38% 0.08 320)" },
  ];
  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        width: 320,
        background: "var(--card)",
        border: "1px solid var(--ink)",
        boxShadow: "0 10px 40px oklch(0% 0 0 / 0.15)",
        zIndex: 100,
        fontFamily: "'Inter', sans-serif",
      }}
    >
      <div
        style={{
          padding: "14px 18px",
          borderBottom: "1px solid var(--line)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontFamily: "'Newsreader', Georgia, serif", fontSize: 15, color: "var(--ink)" }}>Tweaks</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "var(--ink-3)", letterSpacing: "0.1em" }}>
          DESIGN CONTROLS
        </span>
      </div>
      <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
        <TweakRow label="Theme">
          <Segmented<Tweaks["theme"]>
            options={[
              { k: "light", l: "Light" },
              { k: "dark", l: "Dark" },
            ]}
            value={tweaks.theme}
            onChange={(v) => setTweaks({ theme: v })}
          />
        </TweakRow>
        <TweakRow label="Accent">
          <div style={{ display: "flex", gap: 6 }}>
            {accents.map((c) => (
              <button
                key={c.k}
                onClick={() => setTweaks({ accent: c.k })}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  background: c.hex,
                  border: tweaks.accent === c.k ? "2px solid var(--ink)" : "1px solid var(--line-2)",
                  cursor: "pointer",
                  padding: 0,
                }}
              />
            ))}
          </div>
        </TweakRow>
        <TweakRow label="Density">
          <Segmented<Tweaks["density"]>
            options={[
              { k: "comfortable", l: "Comfortable" },
              { k: "compact", l: "Compact" },
            ]}
            value={tweaks.density}
            onChange={(v) => setTweaks({ density: v })}
          />
        </TweakRow>
        <TweakRow label="Brand name">
          <input
            value={tweaks.brandName}
            onChange={(e) => setTweaks({ brandName: e.target.value })}
            style={{
              padding: "5px 8px",
              border: "1px solid var(--line-2)",
              background: "var(--paper)",
              fontFamily: "'Inter', sans-serif",
              fontSize: 12,
              color: "var(--ink)",
              borderRadius: 2,
              width: "100%",
            }}
          />
        </TweakRow>
        <TweakRow label="Monochrome">
          <Toggle checked={tweaks.mono} onChange={(v) => setTweaks({ mono: v })} />
        </TweakRow>
      </div>
    </div>
  );
}

function loadTweaks(): Tweaks {
  try {
    const raw = localStorage.getItem("mi:tweaks");
    if (raw) return { ...TWEAK_DEFAULTS, ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  return TWEAK_DEFAULTS;
}

function loadPage(): PageId {
  const stored = localStorage.getItem("mi:page") as PageId | null;
  if (stored && PAGES.some((p) => p.id === stored)) return stored;
  return "recall_readiness";
}

export default function App() {
  const [page, setPage] = useState<PageId>(loadPage);
  const [maxLevels, setMaxLevels] = useState(3);
  const [maxInputDepth, setMaxInputDepth] = useState(3);
  const [demoState, setDemoState] = useState<DemoState>("default");
  const [tweaksOpen, setTweaksOpen] = useState(false);
  const [tweaks, setTweaksState] = useState<Tweaks>(loadTweaks);

  function setTweaks(patch: Partial<Tweaks>) {
    const next = { ...tweaks, ...patch };
    setTweaksState(next);
    try {
      localStorage.setItem("mi:tweaks", JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    try {
      localStorage.setItem("mi:page", page);
    } catch {
      // ignore
    }
  }, [page]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === ".") setTweaksOpen((o) => !o);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const theme = tweaks.theme === "dark" ? DARK_THEME : LIGHT_THEME;
  const cssVars: CSSProperties = {
    ...(theme as CSSProperties),
    ...({ "--accent": tweaks.mono ? theme["--ink"] : ACCENT_MAP[tweaks.accent] } as CSSProperties),
  };

  const mockBatch: Batch = demoState === "qi" ? BATCH_FAIL : demoState === "recall" ? BATCH_RECALL : BATCH;
  const pageDef = PAGES.find((p) => p.id === page) ?? PAGES[0];
  const PageComponent = pageDef.component;
  const [liveMaterialId, setLiveMaterialId] = useState("20582002");
  const [liveBatchId, setLiveBatchId] = useState("0008898869");
  const [materialDraft, setMaterialDraft] = useState(liveMaterialId);
  const [batchDraft, setBatchDraft] = useState(liveBatchId);
  const batch: Batch = { ...mockBatch, material_id: liveMaterialId, batch_id: liveBatchId };

  return (
    <div style={{ ...cssVars, background: "var(--paper)", minHeight: "100vh", color: "var(--ink)" }}>
      <div style={{ display: "flex" }}>
        <Sidebar active={page} onNavigate={setPage} tweaks={tweaks} />
        <main style={{ flex: 1, minWidth: 0 }}>
          <TopBar
            batch={batch}
            maxLevels={maxLevels}
            setMaxLevels={setMaxLevels}
            maxInputDepth={maxInputDepth}
            setMaxInputDepth={setMaxInputDepth}
            demoState={demoState}
            setDemoState={setDemoState}
          />
          <BatchPicker
            materialDraft={materialDraft}
            batchDraft={batchDraft}
            onMaterialChange={setMaterialDraft}
            onBatchChange={setBatchDraft}
            onApply={() => {
              setLiveMaterialId(materialDraft.trim());
              setLiveBatchId(batchDraft.trim());
            }}
            dirty={materialDraft.trim() !== liveMaterialId || batchDraft.trim() !== liveBatchId}
          />
          <div style={{ padding: tweaks.density === "compact" ? "24px 32px" : "36px 44px", maxWidth: 1440 }}>
            <PageComponent batch={batch} navigate={setPage} />
          </div>
        </main>
      </div>
      <TweaksPanel open={tweaksOpen} tweaks={tweaks} setTweaks={setTweaks} />
    </div>
  );
}
