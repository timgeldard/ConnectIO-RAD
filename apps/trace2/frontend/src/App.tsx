import { useEffect, useState, useMemo } from "react";
import { I18nProvider, LanguageSelector, useI18n } from "@connectio/shared-frontend-i18n";
import {
  AppShell,
  Sidebar,
  TopBar,
  Icon,
  parseCrossAppContext,
  type NavGroup,
  type Breadcrumb
} from "@connectio/shared-ui";
import type { Batch, PageId, Tweaks } from "./types";
import { BATCH } from "./data/mock";
import { fetchBatchHeader } from "./data/api";
import { ParamField, SimBanner, StatusPill } from "./ui";
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
import enResources from "./i18n/locales/en.json";

const loadResource = async (lang: string) => {
  return (await import(`./i18n/locales/${lang}.json`)).default;
};

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
  labelKey: string;
  component: PageComponent;
  num: string;
  groupKey: string;
}

const PAGES: PageDef[] = [
  { id: "overview",             labelKey: "trace.page.overview",             component: PageOverview as unknown as PageComponent,             num: "01", groupKey: "trace.nav.group.360" },
  { id: "mass_balance",         labelKey: "trace.page.massBalance",          component: PageMassBalance as unknown as PageComponent,         num: "02", groupKey: "trace.nav.group.360" },
  { id: "bottom_up",            labelKey: "trace.page.bottomUp",             component: PageBottomUp as unknown as PageComponent,            num: "03", groupKey: "trace.nav.group.lineage" },
  { id: "top_down",             labelKey: "trace.page.topDown",              component: PageTopDown as unknown as PageComponent,             num: "04", groupKey: "trace.nav.group.lineage" },
  { id: "customers_deliveries", labelKey: "trace.page.customersDeliveries",  component: PageCustomersDeliveries as unknown as PageComponent, num: "05", groupKey: "trace.nav.group.lineage" },
  { id: "quality",              labelKey: "trace.page.quality",              component: PageQuality as unknown as PageComponent,             num: "06", groupKey: "trace.nav.group.quality" },
  { id: "production_history",   labelKey: "trace.page.productionHistory",    component: PageProductionHistory as unknown as PageComponent,   num: "07", groupKey: "trace.nav.group.quality" },
  { id: "batch_comparison",     labelKey: "trace.page.batchComparison",      component: PageBatchCompare as unknown as PageComponent,        num: "08", groupKey: "trace.nav.group.quality" },
  { id: "supplier_risk",        labelKey: "trace.page.supplierRisk",         component: PageSupplierRisk as unknown as PageComponent,        num: "09", groupKey: "trace.nav.group.quality" },
  { id: "recall_readiness",     labelKey: "trace.page.recallReadiness",      component: PageRecallReadiness as unknown as PageComponent,     num: "10", groupKey: "trace.nav.group.readiness" },
  { id: "coa",                  labelKey: "trace.page.coa",                  component: PageCoA as unknown as PageComponent,                 num: "11", groupKey: "trace.nav.group.readiness" },
];

const TWEAK_DEFAULTS: Tweaks = {
  theme: "light",
  density: "comfortable",
  brandName: "Kerry",
};

function BatchPicker({
  materialDraft, batchDraft, onMaterialChange, onBatchChange, onApply, dirty,
}: {
  materialDraft: string; batchDraft: string;
  onMaterialChange: (v: string) => void; onBatchChange: (v: string) => void;
  onApply: () => void; dirty: boolean;
}) {
  const { t } = useI18n();
  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && dirty) onApply();
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, width: "100%" }}>
      <span style={{
        fontFamily: "var(--font-mono)", fontSize: 10,
        color: "var(--text-3)", letterSpacing: "0.14em",
        textTransform: "uppercase",
      }}>{t("trace.batch.live")}</span>
      <label style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-2)", fontSize: 12.5 }}>
        {t("trace.field.material")}
        <input
          value={materialDraft}
          onChange={(e) => onMaterialChange(e.target.value)}
          onKeyDown={handleKey}
          placeholder={t("trace.placeholder.materialId")}
          style={{
            padding: "4px 10px",
            border: "1px solid var(--line-1)",
            borderRadius: 4,
            background: "var(--surface-0)",
            color: "var(--text-1)",
            fontFamily: "var(--font-mono)",
            fontSize: 12
          }}
        />
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-2)", fontSize: 12.5 }}>
        {t("trace.field.batch")}
        <input
          value={batchDraft}
          onChange={(e) => onBatchChange(e.target.value)}
          onKeyDown={handleKey}
          placeholder={t("trace.placeholder.batchId")}
          style={{
            padding: "4px 10px",
            border: "1px solid var(--line-1)",
            borderRadius: 4,
            background: "var(--surface-0)",
            color: "var(--text-1)",
            fontFamily: "var(--font-mono)",
            fontSize: 12
          }}
        />
      </label>
      <button
        onClick={onApply}
        disabled={!dirty}
        className={`btn btn-sm ${dirty ? 'btn-primary' : 'btn-subtle'}`}
        style={{ height: 28, fontSize: 11.5 }}
      >{t("trace.action.load")}</button>
    </div>
  );
}

/**
 * Renders a centred empty-state card for the live batch context panel.
 * @param title - Heading displayed in the card.
 * @param message - Body text describing the current state.
 * @param tone - Visual style: `"error"` renders borders and labels in red; defaults to `"default"`.
 * @returns A centred card JSX element.
 */
function TraceEmptyState({
  title,
  message,
  tone = "default",
}: {
  title: string;
  message: string;
  tone?: "default" | "error";
}) {
  return (
    <div style={{
      minHeight: 360,
      display: "grid",
      placeItems: "center",
      padding: 24,
    }}>
      <div style={{
        width: "min(680px, 100%)",
        background: "var(--card)",
        border: `1px solid ${tone === "error" ? "var(--sunset)" : "var(--line)"}`,
        borderRadius: 8,
        padding: "28px 32px",
        boxShadow: "0 1px 2px rgba(20,55,0,0.025)",
      }}>
        <div style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: tone === "error" ? "var(--sunset)" : "var(--text-3)",
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          marginBottom: 10,
        }}>Live batch context</div>
        <h2 style={{ margin: 0, color: "var(--text-1)", fontSize: 22, fontWeight: 600 }}>{title}</h2>
        <p style={{ margin: "10px 0 0", color: "var(--text-2)", lineHeight: 1.5 }}>{message}</p>
      </div>
    </div>
  );
}

function TraceApp() {
  const { t } = useI18n();
  const [page, setPage] = useState<PageId>(() => {
    const stored = localStorage.getItem("mi:page") as PageId | null;
    if (stored && PAGES.some((p) => p.id === stored)) return stored;
    return "overview";
  });
  const [maxLevels, setMaxLevels] = useState(3);
  const [maxInputDepth, setMaxInputDepth] = useState(3);
  const [sim, setSim] = useState(false);
  const [tweaks, _setTweaksState] = useState<Tweaks>(() => {
    try {
      const raw = localStorage.getItem("mi:tweaks");
      if (raw) return { ...TWEAK_DEFAULTS, ...JSON.parse(raw) };
    } catch { }
    return TWEAK_DEFAULTS;
  });

  useEffect(() => { localStorage.setItem("mi:page", page); }, [page]);

  const pageDef = PAGES.find((p) => p.id === page) ?? PAGES[0];
  const PageComp = pageDef.component;

  const initialContext = (() => {
    const params = new URLSearchParams(window.location.search);
    const ctx = parseCrossAppContext();
    return {
      material: ctx?.materialId ?? params.get("material") ?? params.get("material_id") ?? "",
      batch: ctx?.batchId ?? params.get("batch") ?? params.get("batch_id") ?? "",
      demo: params.get("demo") === "1" || params.get("demo") === "true",
    };
  })();
  const demoBatch: Batch | null = initialContext.demo ? BATCH : null;
  const [liveMaterialId, setLiveMaterialId] = useState(initialContext.material);
  const [liveBatchId, setLiveBatchId] = useState(initialContext.batch);
  const [materialDraft, setMaterialDraft] = useState(liveMaterialId);
  const [batchDraft, setBatchDraft] = useState(liveBatchId);
  const [liveBatch, setLiveBatch] = useState<Batch | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);

  useEffect(() => {
    if (!liveMaterialId || !liveBatchId) {
      setLiveBatch(null);
      setLiveLoading(false);
      setLiveError(null);
      return;
    }
    let cancelled = false;
    setLiveBatch(null);
    setLiveLoading(true);
    setLiveError(null);
    fetchBatchHeader(liveMaterialId, liveBatchId)
      .then((payload) => {
        if (!cancelled) {
          setLiveBatch(payload.batch);
          setLiveLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setLiveError(err.message || "Unable to load this batch from the live backend.");
          setLiveLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [liveMaterialId, liveBatchId]);

  // Only fall back to demo data when no live IDs have been entered; once the user types
  // live IDs we show loading/error state rather than misleading demo values in the header.
  const batch = liveBatch ?? (liveMaterialId || liveBatchId ? null : demoBatch);

  const navGroups: NavGroup[] = useMemo(() => {
    const groups = [
      { key: "trace.nav.group.360",      icon: "eye" as const },
      { key: "trace.nav.group.lineage",  icon: "git-branch" as const },
      { key: "trace.nav.group.quality",  icon: "activity" as const },
      { key: "trace.nav.group.readiness", icon: "shield" as const },
    ];
    return groups.map(g => ({
      label: t(g.key),
      items: PAGES.filter(p => p.groupKey === g.key).map(p => ({
        id: p.id,
        label: t(p.labelKey),
        icon: g.icon,
        tag: p.num
      }))
    }));
  }, [t]);

  const breadcrumbs: Breadcrumb[] = [
    { label: t("trace.top.globalOps"), icon: "home" },
    { label: batch?.batch_id || liveBatchId || "No batch selected" }
  ];

  return (
    <AppShell
      sidebar={
        <Sidebar
          appTag="Traceability"
          groups={navGroups}
          activeId={page}
          onNavigate={(id) => setPage(id as PageId)}
          footer={
            <div style={{ display: "flex", alignItems: "center", gap: 10, width: "100%" }}>
              <div style={{
                width: 28, height: 28, borderRadius: 999,
                background: "var(--sage)", color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: 11, flexShrink: 0,
              }}>TR</div>
              <div style={{ fontSize: 11.5, lineHeight: 1.3, minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 600, color: "var(--text-1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {t("trace.footer.version")}
                </div>
              </div>
            </div>
          }
        />
      }
      topbar={
        <TopBar
          breadcrumbs={breadcrumbs}
          actions={
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 12,
                padding: "4px 12px",
                background: "var(--surface-sunken)",
                border: "1px solid var(--line-1)",
                borderRadius: 6,
              }}>
                <ParamField label={t("trace.field.material")} value={batch?.material_id || liveMaterialId || "—"} />
                <div style={{ width: 1, height: 20, background: "var(--line-1)" }} />
                <ParamField label={t("trace.field.description")} value={batch?.material_desc40 || "—"} mono={false} />
                <div style={{ width: 1, height: 20, background: "var(--line-1)" }} />
                <StatusPill status={batch?.batch_status || "UNKNOWN"} size="sm" />
              </div>
              <LanguageSelector compact />
              <button className="icon-btn" onClick={() => window.location.reload()}>
                <Icon name="refresh" size={15} />
              </button>
            </div>
          }
        />
      }
      filterBar={
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
      }
    >
      <div style={{ padding: "24px 32px", maxWidth: 1600, margin: "0 auto" }}>
        {batch && sim && (
          <div style={{ marginBottom: 20 }}>
            <SimBanner batchId={batch.batch_id} onClear={() => setSim(false)} />
          </div>
        )}
        {liveLoading && (
          <TraceEmptyState
            title={t("trace.live.loading.title")}
            message={t("trace.live.loading.message", { material: liveMaterialId, batch: liveBatchId })}
          />
        )}
        {!liveLoading && liveError && (
          <TraceEmptyState
            tone="error"
            title={t("trace.live.error.title")}
            message={t("trace.live.error.message")}
          />
        )}
        {!liveLoading && !liveError && !batch && (
          <TraceEmptyState
            title={t("trace.live.select.title")}
            message={t("trace.live.select.message")}
          />
        )}
        {!liveLoading && !liveError && batch && (
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
        )}
      </div>
    </AppShell>
  );
}

export default function App() {
  return (
    <I18nProvider
      appName="trace2"
      resources={{ en: enResources }}
      loadResource={loadResource}
    >
      <TraceApp />
    </I18nProvider>
  );
}
