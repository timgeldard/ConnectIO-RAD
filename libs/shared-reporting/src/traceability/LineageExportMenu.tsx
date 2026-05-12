/**
 * Floating export-button cluster for lineage views.
 *
 * Renders a compact ``Export ▾`` button that opens a menu with PNG / SVG
 * choices.  The actual capture work is the consumer's responsibility — we
 * accept ``onPng`` and ``onSvg`` async callbacks and let them throw if
 * a renderer is not ready.
 *
 * Keeping capture out of this component means the menu can sit above any
 * canvas — React Flow's viewport, an ECharts container, an HTML table —
 * without depending on which library is rendering the underlying view.
 */
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'

import type { LineageExportFormat } from './exportHelpers'

export interface LineageExportMenuProps {
  /** Whether the export menu should be rendered at all. */
  enabled?: boolean
  /** Async PNG capture handler.  Must throw on failure. */
  onPng?: () => Promise<void>
  /** Async SVG capture handler.  Must throw on failure. */
  onSvg?: () => Promise<void>
  /** Anchor corner.  Default `'top-right'`. */
  anchor?: 'top-right' | 'top-left'
  /** Optional inline label override (default ``Export``). */
  label?: string
}

/**
 * Render the export-button cluster.
 *
 * @param props See {@link LineageExportMenuProps}.
 * @returns A `<div>` containing the toggle button and (when open) the menu,
 *   or `null` when neither PNG nor SVG handlers are configured.
 */
export function LineageExportMenu({
  enabled = true,
  onPng,
  onSvg,
  anchor = 'top-right',
  label = 'Export',
}: LineageExportMenuProps) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<LineageExportFormat | null>(null)
  const ref = useRef<HTMLDivElement | null>(null)

  // Close on outside click / escape — mirrors the AdvancedLineageGraph
  // context menu pattern for consistency.
  useEffect(() => {
    if (!open) return
    const dismiss = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', dismiss)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('mousedown', dismiss)
      document.removeEventListener('keydown', key)
    }
  }, [open])

  if (!enabled || (!onPng && !onSvg)) return null

  const dispatch = (fmt: LineageExportFormat, handler?: () => Promise<void>) => {
    if (!handler) return
    setBusy(fmt)
    void handler()
      .catch((err: unknown) => {
        // eslint-disable-next-line no-console
        console.error('[LineageExportMenu] export failed:', err)
      })
      .finally(() => {
        setBusy(null)
        setOpen(false)
      })
  }

  const isBusy = busy != null
  const posStyle =
    anchor === 'top-right'
      ? { top: 8, right: 8 }
      : { top: 8, left: 8 }

  return (
    <div
      ref={ref}
      data-testid="lineage-export-menu"
      style={{ position: 'absolute', zIndex: 5, ...posStyle }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={isBusy}
        aria-haspopup="menu"
        aria-expanded={open}
        data-testid="lineage-export-menu-toggle"
        style={{
          padding: '4px 10px',
          fontFamily: 'var(--font-sans, system-ui)',
          fontSize: 12,
          background: 'var(--bg-surface, #ffffff)',
          color: 'var(--ink-1, #16202a)',
          border: '1px solid var(--line, #e3e7ec)',
          borderRadius: 4,
          cursor: isBusy ? 'wait' : 'pointer',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        }}
      >
        {isBusy ? `Saving ${busy?.toUpperCase()}…` : `${label} ▾`}
      </button>
      {open && !isBusy && (
        <div
          role="menu"
          data-testid="lineage-export-menu-items"
          style={{
            marginTop: 4,
            background: 'var(--bg-surface, #ffffff)',
            border: '1px solid var(--line, #e3e7ec)',
            borderRadius: 4,
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            padding: '4px 0',
            minWidth: 140,
            fontFamily: 'var(--font-sans, system-ui)',
            fontSize: 12.5,
          }}
        >
          {onPng && (
            <button
              type="button"
              role="menuitem"
              onClick={() => dispatch('png', onPng)}
              data-testid="lineage-export-png"
              style={menuItemStyle}
            >
              Save PNG
            </button>
          )}
          {onSvg && (
            <button
              type="button"
              role="menuitem"
              onClick={() => dispatch('svg', onSvg)}
              data-testid="lineage-export-svg"
              style={menuItemStyle}
            >
              Save SVG
            </button>
          )}
        </div>
      )}
    </div>
  )
}

const menuItemStyle: CSSProperties = {
  display: 'block',
  width: '100%',
  padding: '6px 12px',
  background: 'transparent',
  border: 'none',
  textAlign: 'left',
  cursor: 'pointer',
  color: 'var(--ink-1, #16202a)',
  fontFamily: 'inherit',
  fontSize: 'inherit',
}
