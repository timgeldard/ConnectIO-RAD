/** Platform shell types — module contract, app composition manifest, and shared context types. */

/** Plant / material / batch context displayed in the 40px context bar. */
export interface CtxState {
  plant: string
  material: string
  batch: string
}


export type Domain = 'quality' | 'process-order' | 'warehouse' | 'platform'

export interface KPIStat {
  value: string
  label: string
  tone?: 'good' | 'warn' | 'bad' | 'neutral'
}

export interface ModuleTab {
  id: string
  label: string
  /** Display ordinal e.g. '01' — used in SubNav. */
  num: string
  /** Orange pip attention signal. */
  pip?: boolean
}

export interface LandingCard {
  /** Short descriptor e.g. 'Batch traceability · 11 pages'. */
  tag: string
  /** 2–3 sentence landing card body. */
  desc: string
  stats: KPIStat[]
}

/**
 * Contract every ConnectIO module must satisfy.
 * The shell (LeftRail, SubNav, Home landing cards) is fully driven by this manifest.
 */
export interface ConnectIOModule {
  /** Kebab-case identifier e.g. 'trace', 'order-list'. */
  moduleId: string
  /** TopBar breadcrumb label e.g. 'Trace'. */
  displayName: string
  /** UPPERCASE rail label e.g. 'TRACE'. */
  shortName: string
  /** Rail tooltip / sub-label e.g. 'Batch traceability'. */
  tagline: string
  domain: Domain
  /**
   * Which icon registry to resolve `icon` against.
   * 'cq' = CQ's bespoke SVG set (exported from shared-ui Icon).
   * 'shared-ui' = shared-ui's Lucide-style SVG set.
   */
  iconSet: 'cq' | 'shared-ui'
  /** Icon name within the selected iconSet. */
  icon: string
  /** CSS value for module accent colour e.g. '#005776'. */
  color: string
  /** Sidebar group e.g. 'main' | 'platform' | 'admin' | 'operate' | 'insights'. */
  sidebarGroup: string
  /** Sort position within group (ascending). */
  sidebarOrder: number
  /** Id of the first tab ('' for single-page modules). */
  defaultTab: string
  /** Tab definitions. Empty for single-page modules. */
  tabs: ModuleTab[]
  /** Omit for utility modules (alarms, admin) that don't appear on the Home landing. */
  landingCard?: LandingCard
  /** True = this module activates the 40px context bar row (CQ plant/material/batch bar). */
  contextBarSlot: boolean
  /**
   * 'fullscreen' hides the rail, topbar, and context bar — used for kiosk/wallboard modules.
   * Defaults to 'default' when omitted.
   */
  layoutMode?: 'default' | 'fullscreen'
  /** Future URL segment e.g. '/trace'. Not used by the state-machine shell yet. */
  routeBase: string
  /** i18n namespace e.g. 'cq.trace', 'poh.order-list'. */
  i18nNamespace: string
  /** User can toggle this module on/off in preferences. */
  isUserSelectable: boolean
  /** Appears in the pinned section on Home by default. */
  isPinnedByDefault: boolean
  /** Cannot be disabled — always loaded (e.g. 'home', 'admin'). */
  isMandatory: boolean
  /** API prefix for this module's backend endpoints e.g. '/api/cq', '/api'. */
  backendPrefix: string
}

export interface SidebarBranding {
  logoSrc?: string
  logoAlt?: string
  /** Short label shown after the logo e.g. 'Quality', 'Operations'. */
  appTag: string
}

export interface SidebarBottomItem {
  id: string
  icon: string
  iconSet: 'cq' | 'shared-ui'
  tooltip: string
  action: 'navigate' | 'modal' | 'external'
  /** moduleId for 'navigate', URL for 'external'. */
  target: string
}

export interface LandingConfig {
  greetingPrefix: string
  operatingConsoleLabel: string
  showInbox: boolean
  showPlantHealth: boolean
  showPinned: boolean
  inboxTitle: string
  plantHealthTitle: string
  pinnedTitle: string
}

/**
 * Cross-app navigation context passed via URL query parameters when navigating
 * from one ConnectIO app to another within the platform deployment.
 *
 * Example URL: /poh?entity=processOrder&processOrderId=1001234&from=cq.trace
 */
export interface CrossAppContext {
  /** Business entity type the target app should navigate to. */
  entity: 'processOrder' | 'pourAnalytics'
  /** Process order ID when entity = 'processOrder'. */
  processOrderId?: string
  /** Originating module identifier e.g. 'cq.trace' — used for back-navigation. */
  from?: string
}

/**
 * Parse cross-app navigation context from the current page's URL query string.
 * Returns null if no `entity` param is present (normal standalone navigation).
 */
export function parseCrossAppContext(): CrossAppContext | null {
  const params = new URLSearchParams(window.location.search)
  const entity = params.get('entity') as CrossAppContext['entity'] | null
  if (!entity) return null
  return {
    entity,
    processOrderId: params.get('processOrderId') ?? undefined,
    from: params.get('from') ?? undefined,
  }
}

/**
 * Declares which modules a Databricks App deployable enables and how the shell is configured.
 * Multiple apps can share the same module code while each having their own composition.
 */
export interface AppComposition {
  /** Kebab-case app identifier e.g. 'connectedquality'. */
  appId: string
  appDisplayName: string
  appTagline: string
  /** Must match the `name` field in app.yaml. */
  databricksAppName: string
  /** All moduleIds this app can render. */
  enabledModules: string[]
  /** Subset of enabledModules that cannot be disabled by the user. */
  mandatoryModules: string[]
  /** moduleId activated on first load. */
  defaultModule: string
  sidebarBranding: SidebarBranding
  sidebarBottomItems: SidebarBottomItem[]
  landingConfig: LandingConfig
  featureFlags: Record<string, boolean>
  /** Validated at startup by the Python backend. */
  requiredEnvVars: string[]
  /** Python router module paths mounted in main.py — informational, not runtime. */
  backendRouters: string[]
}
