/* eslint-disable jsdoc/require-jsdoc */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'
import { minutesFromNow } from '~/utils/time'
import { Icon, KPI, Card, DataTable } from './Primitives'
import type { Column } from '@connectio/shared-ui'

export { Icon, KPI, Card, DataTable, type Column }

/** A breadcrumb navigation item. */
export type CrumbItem = { label: string; onClick?: () => void }

/** Formats an ETA timestamp for display as HH:MM. */
export const formatETA = (value: Date | string | number): string => {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

/** A single filter chip within a FilterBar filter group. */
interface Chip { value: string; label: string; dot?: string; count?: number | string }

/** A single filter group shown in FilterBar. */
interface Filter {
  key: string
  label: string
  /** Preferred chips array. */
  chips?: Chip[]
  /** Backward-compat alias for `chips`; used by callers that pre-date the `chips` rename. */
  options?: Chip[]
}

/** Props for the shared chip-based FilterBar. */
interface FilterBarProps {
  filters: Filter[]
  values: Record<string, string>
  onChange: (key: string, value: string) => void
}

/** Horizontal chip-based filter bar for warehouse cockpit pages. */
export const FilterBar = ({ filters, values, onChange }: FilterBarProps) => (
  <div style={{ display: 'flex', gap: 16, padding: '8px 0', flexWrap: 'wrap', alignItems: 'center' }}>
    {filters.map((f) => (
      <div key={f.key} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginRight: 4 }}>
          {f.label}
        </span>
        {(f.chips ?? f.options ?? []).map((c) => (
          <button
            key={c.value}
            onClick={() => onChange(f.key, c.value)}
            style={{
              fontSize: 11,
              padding: '3px 10px',
              borderRadius: 12,
              border: '1px solid var(--line-1)',
              cursor: 'pointer',
              background: values[f.key] === c.value ? 'var(--surface-3)' : 'var(--surface-1)',
              color: values[f.key] === c.value ? 'var(--text-1)' : 'var(--text-3)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {c.dot && (
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: c.dot === 'red' ? 'var(--status-risk)' : c.dot === 'amber' ? 'var(--status-warn)' : 'var(--status-ok)',
                flexShrink: 0,
              }} />
            )}
            {c.label}
          </button>
        ))}
      </div>
    ))}
  </div>
)

/** Props for the slide-in Drawer panel. */
interface DrawerProps {
  open: boolean
  onClose: () => void
  title?: string
  subtitle?: string
  actions?: React.ReactNode
  children?: React.ReactNode
}

/** Right-side sliding detail drawer for warehouse cockpit pages. */
export const Drawer = ({ open, onClose, title, subtitle, actions, children }: DrawerProps) => {
  if (!open) return null
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
      <div
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }}
      />
      <div style={{
        position: 'absolute', top: 0, right: 0, bottom: 0, width: 480,
        background: 'var(--surface-1)', display: 'flex', flexDirection: 'column',
        overflow: 'hidden', boxShadow: '-8px 0 32px rgba(0,0,0,0.2)',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          padding: '20px 24px', borderBottom: '1px solid var(--line-1)',
        }}>
          <div>
            {title && <div style={{ fontWeight: 600, fontSize: 15 }}>{title}</div>}
            {subtitle && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{subtitle}</div>}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {actions}
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-3)', padding: 4 }}
            >
              ×
            </button>
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>{children}</div>
      </div>
    </div>
  )
}

/** Breadcrumb navigation row. */
export const Crumbs = ({ items }: { items: CrumbItem[] }) => (
  <div className="crumbs">
    {items.map((c: any, i: number) => (
      <React.Fragment key={i}>
        {i > 0 && <Icon name="chevron-right" size={10}/>}
        {c.onClick ? <a onClick={c.onClick} style={{ cursor: 'pointer' }}>{c.label}</a> : <span>{c.label}</span>}
      </React.Fragment>
    ))}
  </div>
)
