// @ts-nocheck
/**
 * UI primitives ported from the design prototype's components.jsx.
 *
 * The prototype published `Sidebar`, `TopBar`, `StatusBadge`, `Check`,
 * `Sparkline`, formatters and inline icons via `window.KERRY_UI`. Here we
 * re-export them as named module exports so pages can `import { Sidebar, I,
 * fmt } from "~/ui"`. Behaviour is preserved 1:1 — the only structural change
 * is replacing the global `window.KERRY_I18N` lookup with the local
 * `useT()` hook from `~/i18n/context`.
 */
import {
  cloneElement,
  Fragment,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'
import { useT } from './i18n/context'
import { STRINGS } from './i18n/dictionary'

// ---------- Inline icon helpers (Lucide-style, stroke 1.75) ----------
const Icon = ({
  d,
  size = 16,
  stroke = 1.75,
  className = '',
  children,
}: {
  d?: string
  size?: number
  stroke?: number
  className?: string
  children?: ReactNode
}) => (
  <svg
    className={`ico ${className}`}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={stroke}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children || <path d={d} />}
  </svg>
)

export const I = {
  search:    <Icon><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></Icon>,
  filter:    <Icon><path d="M3 6h18M6 12h12M10 18h4"/></Icon>,
  download:  <Icon><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></Icon>,
  plus:      <Icon><path d="M12 5v14M5 12h14"/></Icon>,
  chevR:     <Icon><path d="m9 6 6 6-6 6"/></Icon>,
  chevL:     <Icon><path d="m15 6-6 6 6 6"/></Icon>,
  chevU:     <Icon><path d="m6 15 6-6 6 6"/></Icon>,
  chevD:     <Icon><path d="m6 9 6 6 6-6"/></Icon>,
  arrowL:    <Icon><path d="M19 12H5m0 0 6-6m-6 6 6 6"/></Icon>,
  arrowR:    <Icon><path d="M5 12h14m0 0-6-6m6 6-6 6"/></Icon>,
  check:     <Icon stroke={3}><path d="M20 6 9 17l-5-5"/></Icon>,
  calendar:  <Icon><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></Icon>,
  factory:   <Icon><path d="M2 20V8l6 4V8l6 4V8l6 4v8H2z"/><path d="M6 14v2M10 14v2M14 14v2M18 14v2"/></Icon>,
  flask:     <Icon><path d="M9 3h6M10 3v6L4 19a2 2 0 0 0 1.7 3h12.6a2 2 0 0 0 1.7-3L14 9V3"/><path d="M7 14h10"/></Icon>,
  package:   <Icon><path d="M16.5 9.4 7.5 4.21M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.27 6.96 12 12.01l8.73-5.05M12 22.08V12"/></Icon>,
  layers:    <Icon><path d="m12 2 9 5-9 5-9-5 9-5z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/></Icon>,
  clock:     <Icon><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></Icon>,
  mapPin:    <Icon><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></Icon>,
  user:      <Icon><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></Icon>,
  fileText:  <Icon><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6"/></Icon>,
  fileSheet: <Icon><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8M8 9h2"/></Icon>,
  shield:    <Icon><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></Icon>,
  history:   <Icon><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/></Icon>,
  beaker:    <Icon><path d="M4.5 3h15M6 3v6.5L3 19.5A2 2 0 0 0 4.7 22h14.6a2 2 0 0 0 1.7-2.5L18 9.5V3"/></Icon>,
  trending:  <Icon><path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/></Icon>,
  pin:       <Icon><path d="M12 17v5M9 10.76V6h-1V4h8v2h-1v4.76l3 3.24v2H6v-2l3-3.24z"/></Icon>,
  refresh:   <Icon><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></Icon>,
  more:      <Icon><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></Icon>,
  bell:      <Icon><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9z"/><path d="M10 21a2 2 0 0 0 4 0"/></Icon>,
  help:      <Icon><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></Icon>,
  x:         <Icon><path d="M18 6 6 18M6 6l12 12"/></Icon>,
  pause:     <Icon><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></Icon>,
  printer:   <Icon><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></Icon>,
  copy:      <Icon><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></Icon>,
  eye:       <Icon><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></Icon>,
  archive:   <Icon><rect x="3" y="3" width="18" height="5" rx="1"/><path d="M5 8v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8M10 12h4"/></Icon>,
  hexagon:   <Icon><path d="M12 2 3 7v10l9 5 9-5V7l-9-5z"/></Icon>,
  warning:   <Icon><path d="M12 2 1 22h22L12 2z"/><path d="M12 9v5M12 18h.01"/></Icon>,
  alert:     <Icon><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></Icon>,
  message:   <Icon><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></Icon>,
  cpu:       <Icon><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3"/></Icon>,
  flag:      <Icon><path d="M4 22V4a1 1 0 0 1 1-1h13l-3 5 3 5H5"/></Icon>,
} as const

// ---------- Format helpers ----------
export const fmt = {
  num: (n?: number | null) => (n == null ? '—' : n.toLocaleString('en-US')),
  date: (ms: number) => {
    const d = new Date(ms)
    return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
  },
  time: (ms: number) => {
    const d = new Date(ms)
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  },
  shortDate: (ms: number) => {
    const d = new Date(ms)
    return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })
  },
  duration: (h?: number | null) =>
    h == null ? '—' : h < 1 ? `${Math.round(h * 60)} min` : `${h.toFixed(1)} h`,
}

// ---------- Sidebar ----------
const PLANTS = [
  { code: 'NAA', name: 'Naas',    country: 'Ireland' },
  { code: 'RUN', name: 'Runcorn', country: 'United Kingdom' },
  { code: 'GRA', name: 'Grasse',  country: 'France' },
  { code: 'MOZ', name: 'Mozzo',   country: 'Italy' },
]

function PlantSwitcher() {
  const { t } = useT()
  return (
    <div className="plant-switch">
      <div className="plant-pill" style={{ cursor: 'default' }}>
        <span className="pp-icon">{I.mapPin}</span>
        <div className="pp-text">
          <div className="pp-label">{t.plantLabel}</div>
          <div className="pp-name">Runcorn, United Kingdom</div>
        </div>
      </div>
    </div>
  )
}

interface SidebarProps {
  active?: string
  onNavigate?: (key: string) => void
  user?: { name: string; initials: string } | null
}

export function Sidebar({ active = 'orders', onNavigate = () => {}, user }: SidebarProps) {
  const { t } = useT()
  const cls = (key: string) => 'nav-item' + (active === key ? ' active' : '')
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img src="/kerry-k-icon.png" alt="Kerry" />
        <div>
          <div style={{ fontFamily: 'var(--font-impact)', fontWeight: 800, fontSize: 18, color: '#fff', letterSpacing: '-.005em', lineHeight: 1 }}>
            {t.operations.toUpperCase()}
          </div>
          <div className="product">{t.productName}</div>
        </div>
      </div>

      <PlantSwitcher />

      <div className="sidebar-label">{t.sectionOperate}</div>
      <div className="sidebar-section">
        <div className={cls('planning')} onClick={() => onNavigate('planning')}>{cloneElement(I.layers as ReactElement, { className: 'ico' })}<span>{t.navPlanning}</span></div>
        <div className={cls('lines')} onClick={() => onNavigate('lines')}>{cloneElement(I.factory as ReactElement, { className: 'ico' })}<span>{t.navLines}</span></div>
        <div className={cls('orders')} onClick={() => onNavigate('orders')}>{cloneElement(I.history as ReactElement, { className: 'ico' })}<span>{t.navOrders}</span><span className="count">1,370</span></div>
        <div className={cls('materials')} onClick={() => onNavigate('materials')}>{cloneElement(I.package as ReactElement, { className: 'ico' })}<span>{t.navMaterials}</span></div>
      </div>

      <div className="sidebar-label">{t.sectionQuality}</div>
      <div className="sidebar-section">
        <div className={cls('qa')} onClick={() => onNavigate('qa')}>{cloneElement(I.beaker as ReactElement, { className: 'ico' })}<span>{t.navQA}</span></div>
      </div>

      <div className="sidebar-label">{t.sectionInsights}</div>
      <div className="sidebar-section">
        <div className={cls('pours')} onClick={() => onNavigate('pours')}>{cloneElement(I.package as ReactElement, { className: 'ico' })}<span>{t.navPours || 'Pour analytics'}</span></div>
        <div className={cls('yield')} onClick={() => onNavigate('yield')}>{cloneElement(I.trending as ReactElement, { className: 'ico' })}<span>{t.navYield}</span></div>
      </div>

      <div className="sidebar-foot">
        <div className="avatar">{user?.initials ?? '—'}</div>
        <div>
          <div className="user-name">{user?.name ?? '…'}</div>
          <div className="user-role">{t.userRole}</div>
        </div>
      </div>
    </aside>
  )
}

// ---------- Language switcher ----------
export function LangSwitcher() {
  const { lang, setLang } = useT()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])
  const langs: Array<keyof typeof STRINGS> = ['en', 'fr', 'de', 'es']
  const current = STRINGS[lang]
  return (
    <div className="lang-switch" ref={ref}>
      <button className={`lang-btn ${open ? 'open' : ''}`} onClick={() => setOpen(o => !o)}>
        <span className="lang-btn-code">{current.code}</span>
        <span className="lang-btn-name">{current.name}</span>
        {cloneElement(I.chevD as ReactElement, { className: 'lang-btn-chev' })}
      </button>
      {open && (
        <div className="lang-menu">
          {langs.map(l => {
            const info = STRINGS[l]
            return (
              <button
                key={l}
                className={`lang-opt ${lang === l ? 'active' : ''}`}
                onClick={() => { setLang(l); setOpen(false) }}
              >
                <span className="lang-opt-code">{info.code}</span>
                <span className="lang-opt-dash">—</span>
                <span className="lang-opt-name">{info.name}</span>
                {lang === l && <span className="lang-opt-check">{I.check}</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---------- TopBar ----------
interface TopBarProps {
  trail: string[]
  onTrailClick?: (index: number) => void
}

export function TopBar({ trail, onTrailClick }: TopBarProps) {
  return (
    <div className="topbar">
      <div className="crumbs">
        {trail.map((segment, i) => (
          <Fragment key={i}>
            {i > 0 && <span className="sep">/</span>}
            {i < trail.length - 1
              ? <a onClick={() => onTrailClick && onTrailClick(i)}>{segment}</a>
              : <span className="here">{segment}</span>}
          </Fragment>
        ))}
      </div>
      <div className="topbar-spacer" />
      <div className="topbar-actions">
        <LangSwitcher />
        <button className="icon-btn" title="Notifications">{I.bell}</button>
        <button className="icon-btn" title="Help">{I.help}</button>
      </div>
    </div>
  )
}

// ---------- Status badge ----------
interface StatusBadgeProps {
  status: string
  onClick?: (status: string) => void
  interactive?: boolean
}

export function StatusBadge({ status, onClick, interactive = true }: StatusBadgeProps) {
  const { t } = useT()
  const map: Record<string, string> = {
    running:   t.statusRunning,
    completed: t.statusCompleted,
    onhold:    t.statusOnhold,
    released:  t.statusReleased,
    cancelled: t.statusCancelled,
    failed:    t.statusFailed,
  }
  return (
    <span
      className={`status-badge ${status}`}
      onClick={interactive ? (e) => { e.stopPropagation(); onClick && onClick(status) } : undefined}
      title={interactive ? `Filter by ${map[status]}` : map[status]}
      style={!interactive ? { cursor: 'default' } : undefined}
    >
      <span className={`dot status-${status}`} />
      {map[status]}
    </span>
  )
}

// ---------- Checkbox ----------
interface CheckProps {
  checked?: boolean
  indeterminate?: boolean
  onClick?: () => void
}

export function Check({ checked, indeterminate, onClick }: CheckProps) {
  const cls = indeterminate ? 'check indeterminate' : checked ? 'check checked' : 'check'
  return (
    <span
      className={cls}
      onClick={(e) => { e.stopPropagation(); onClick && onClick() }}
    >
      {checked && !indeterminate && I.check}
    </span>
  )
}

// ---------- KPI sparkline ----------
interface SparklineProps {
  data: number[]
  color?: string
}

export function Sparkline({ data, color = 'var(--valentia-slate)' }: SparklineProps) {
  const w = 100
  const h = 28
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ')
  const areaPts = `0,${h} ${pts} ${w},${h}`
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polygon points={areaPts} fill={color} fillOpacity="0.10" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
