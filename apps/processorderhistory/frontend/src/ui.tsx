/* eslint-disable jsdoc/require-jsdoc */
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
import { STRINGS } from './i18n/context'
import { KPI, Icon, TopBar as SharedTopBar, Button, StatusPill, DataTable } from '@connectio/shared-ui'
import { LanguageSelector } from '@connectio/shared-frontend-i18n'

export { KPI, Icon, Button, DataTable }

export const I = {
  search:    <Icon name="search" />,
  filter:    <Icon name="filter" />,
  download:  <Icon name="download" />,
  plus:      <Icon name="plus" />,
  chevR:     <Icon name="chevron-right" />,
  chevL:     <Icon name="chevron-left" />,
  chevU:     <Icon name="chevron-up" />,
  chevD:     <Icon name="chevron-down" />,
  arrowL:    <Icon name="arrow-left" />,
  arrowR:    <Icon name="arrow-right" />,
  check:     <Icon name="check" />,
  calendar:  <Icon name="calendar" />,
  factory:   <Icon name="factory" />,
  flask:     <Icon name="flask" />,
  package:   <Icon name="package" />,
  layers:    <Icon name="layers" />,
  clock:     <Icon name="clock" />,
  mapPin:    <Icon name="map-pin" />,
  user:      <Icon name="user" />,
  fileText:  <Icon name="file-text" />,
  fileSheet: <Icon name="file-sheet" />,
  shield:    <Icon name="shield" />,
  history:   <Icon name="history" />,
  beaker:    <Icon name="flask" />,
  trending:  <Icon name="trending-up" />,
  pin:       <Icon name="pin" />,
  refresh:   <Icon name="refresh" />,
  more:      <Icon name="more-horizontal" />,
  bell:      <Icon name="bell" />,
  help:      <Icon name="help-circle" />,
  x:         <Icon name="x" />,
  pause:     <Icon name="pause" />,
  printer:   <Icon name="printer" />,
  copy:      <Icon name="copy" />,
  eye:       <Icon name="eye" />,
  archive:   <Icon name="archive" />,
  hexagon:   <Icon name="hexagon" />,
  warning:   <Icon name="alert-triangle" />,
  alert:     <Icon name="alert-circle" />,
  message:   <Icon name="message-square" />,
  cpu:       <Icon name="cpu" />,
  flag:      <Icon name="flag" />,
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
          <div style={{ fontFamily: 'var(--font-impact)', fontWeight: 'var(--fw-extrabold)', fontSize: 'var(--fs-18)', color: 'var(--fg-on-brand)', letterSpacing: '-.005em', lineHeight: 1 }}>
            {t.operations.toUpperCase()}
          </div>
          <div className="product">{t.productName}</div>
        </div>
      </div>

      <PlantSwitcher />

      <div className="sidebar-label">{t.sectionOperate}</div>
      <div className="sidebar-section">
        <div className={cls('planning')} onClick={() => onNavigate('planning')}>{cloneElement(I.layers as ReactElement, { className: 'ico' })}<span>{t.navPlanning}</span></div>
        <div className={cls('orders')} onClick={() => onNavigate('orders')}>{cloneElement(I.history as ReactElement, { className: 'ico' })}<span>{t.navOrders}</span></div>
        <div className={cls('vessel-planning')} onClick={() => onNavigate('vessel-planning')}>{cloneElement(I.cpu as ReactElement, { className: 'ico' })}<span>{t.navVesselPlanning || 'Vessel planning'}</span></div>
      </div>

      <div className="sidebar-label">{t.sectionInsights}</div>
      <div className="sidebar-section">
        <div className={cls('day-view')} onClick={() => onNavigate('day-view')}>{cloneElement(I.clock as ReactElement, { className: 'ico' })}<span>{t.navDayView || 'Day view'}</span></div>
        <div className={cls('pours')} onClick={() => onNavigate('pours')}>{cloneElement(I.package as ReactElement, { className: 'ico' })}<span>{t.navPours || 'Pour analytics'}</span></div>
        <div className={cls('yield')} onClick={() => onNavigate('yield')}>{cloneElement(I.trending as ReactElement, { className: 'ico' })}<span>{t.navYield}</span></div>
        <div className={cls('quality')} onClick={() => onNavigate('quality')}>{cloneElement(I.shield as ReactElement, { className: 'ico' })}<span>{t.navQuality || 'Quality analytics'}</span></div>
        <div className={cls('equipment-insights')} onClick={() => onNavigate('equipment-insights')}>{cloneElement(I.beaker as ReactElement, { className: 'ico' })}<span>{t.navEquipmentInsights || 'Equipment insights'}</span></div>
      </div>

      <div className="sidebar-foot">
        <div className="avatar">{user?.initials ?? '—'}</div>
        <div>
          <div className="user-name">{user?.name ?? '…'}</div>
        </div>
      </div>
    </aside>
  )
}

// ---------- TopBar ----------
interface TopBarProps {
  trail: string[]
  onTrailClick?: (index: number) => void
}

export function TopBar({ trail, onTrailClick }: TopBarProps) {
  const breadcrumbs = trail.map((label, i) => ({
    label,
    onClick: onTrailClick ? () => onTrailClick(i) : undefined
  }))

  return (
    <SharedTopBar
      breadcrumbs={breadcrumbs}
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <LanguageSelector compact />
          <button className="icon-btn" title="Notifications"><Icon name="bell" /></button>
          <button className="icon-btn" title="Help"><Icon name="help-circle" /></button>
        </div>
      }
    />
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
    closed:    t.statusClosed,
    released:  t.statusReleased,
    onhold:    t.statusOnhold,
    cancelled: t.statusCancelled,
    failed:    t.statusFailed,
  }
  return (
    <StatusPill
      status={status}
      label={map[status] || status}
      className={interactive ? 'interactive' : ''}
      onClick={interactive ? (e) => { e.stopPropagation(); onClick && onClick(status) } : undefined}
    />
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
