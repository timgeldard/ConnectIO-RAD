/** Module and tab definitions ported from cq-icons.jsx. */

export type ModuleId = 'home' | 'trace' | 'envmon' | 'spc' | 'lab' | 'alarms' | 'admin'
export type IconName =
  | 'home' | 'trace' | 'env' | 'spc' | 'bell' | 'settings'
  | 'search' | 'plus' | 'chev' | 'dl' | 'refresh' | 'play' | 'pause'
  | 'flag' | 'alert' | 'check' | 'close' | 'clock' | 'pin' | 'layers' | 'map' | 'target'
  | 'grid' | 'list' | 'user' | 'help' | 'arrow' | 'arrowDown' | 'arrowUp'
  | 'eye' | 'flow' | 'expand'

export interface Module {
  id: ModuleId
  label: string
  sub: string
  icon: IconName
  num: string
  color?: string
  badge?: number
}

export interface Tab {
  id: string
  label: string
  num: string
  pip?: boolean
}

export const MODULES: Module[] = [
  { id: 'home',   label: 'Home',      sub: 'Cross-module overview',          icon: 'home',     num: '00' },
  { id: 'trace',  label: 'Trace',     sub: 'Batch traceability',             icon: 'trace',    num: '01', color: '#005776' },
  { id: 'envmon', label: 'EnvMon',    sub: 'Environmental monitoring',       icon: 'env',      num: '02', color: '#289BA2' },
  { id: 'spc',    label: 'SPC',       sub: 'Statistical process control',    icon: 'spc',      num: '03', color: '#F24A00' },
  { id: 'lab',    label: 'Lab Board', sub: 'Quality lab wallboard',          icon: 'target',   num: '04', color: '#143C5A' },
  { id: 'alarms', label: 'Alarms',    sub: 'Cross-module inbox',             icon: 'bell',     num: '05', badge: 7 },
  { id: 'admin',  label: 'Settings',  sub: 'Admin',                          icon: 'settings', num: '99' },
]

export const TRACE_TABS: Tab[] = [
  { id: 'overview',     label: 'Overview',         num: '01' },
  { id: 'recall',       label: 'Recall Readiness', num: '02', pip: true },
  { id: 'lineage',      label: 'Lineage',          num: '03' },
  { id: 'mass_balance', label: 'Mass Balance',     num: '04' },
  { id: 'quality',      label: 'Quality',          num: '05' },
  { id: 'coa',          label: 'CoA',              num: '06' },
]

export const ENVMON_TABS: Tab[] = [
  { id: 'global',  label: 'Global Map', num: '01' },
  { id: 'site',    label: 'Site',       num: '02' },
  { id: 'floor',   label: 'Floor Plan', num: '03', pip: true },
  { id: 'history', label: 'Time-Lapse', num: '04' },
]

export const SPC_TABS: Tab[] = [
  { id: 'overview',  label: 'Overview',       num: '01' },
  { id: 'flow',      label: 'Process Flow',   num: '02' },
  { id: 'charts',    label: 'Control Charts', num: '03', pip: true },
  { id: 'scorecard', label: 'Scorecard',      num: '04' },
  { id: 'advanced',  label: 'Multivariate',   num: '05' },
]
