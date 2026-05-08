/** Module and tab definitions ported from cq-icons.jsx. */

export type ModuleId = 'home' | 'lab' | 'alarms' | 'admin'
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
  { id: 'lab',    label: 'Lab Board', sub: 'Quality lab wallboard',          icon: 'target',   num: '04', color: '#143C5A' },
  { id: 'alarms', label: 'Alarms',    sub: 'Cross-module inbox',             icon: 'bell',     num: '05', badge: 7 },
  { id: 'admin',  label: 'Settings',  sub: 'Admin',                          icon: 'settings', num: '99' },
]
