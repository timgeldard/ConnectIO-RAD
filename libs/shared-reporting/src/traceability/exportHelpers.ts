/**
 * Pure helpers for exporting lineage views.
 *
 * The actual DOM-to-image work lives in the view components — keeping the
 * pure pieces (filename composition, DOM-to-blob orchestration) here makes
 * them unit-testable in jsdom without spinning up React Flow.
 */
import type { AdvancedLineageFocal } from './types'

/** Supported export formats. */
export type LineageExportFormat = 'png' | 'svg'

/**
 * Build a stable, filesystem-safe download filename for an export.
 *
 * Format: ``lineage-<material_id>-<batch_id>-<view>-<yyyymmddTHHMM>.<ext>``.
 * Investigators paste these into recall reports; the date stamp lets a
 * reader tell which run a screenshot came from at a glance.
 *
 * @param focal The focal batch (provides material + batch in the name).
 * @param view Short view label, e.g. `'advanced'` or `'sankey'`.
 * @param format File extension (without the dot).
 * @param now Optional clock for deterministic tests.
 * @returns A filename safe to pass to a `<a download>` attribute.
 */
export function buildExportFilename(
  focal: Pick<AdvancedLineageFocal, 'material_id' | 'batch_id'>,
  view: string,
  format: LineageExportFormat,
  now: Date = new Date(),
): string {
  const stamp = formatTimestamp(now)
  const matId = sanitise(focal.material_id) || 'material'
  const batId = sanitise(focal.batch_id) || 'batch'
  const v = sanitise(view) || 'view'
  return `lineage-${matId}-${batId}-${v}-${stamp}.${format}`
}

/**
 * Trigger a browser download of a `Blob` with the given filename.
 *
 * Centralised so tests can stub it once.  The browser's anchor download
 * mechanism is fiddly enough that scattering it across components leads
 * to subtle inconsistencies (missing `revokeObjectURL`, double-clicks).
 *
 * @param blob The payload (PNG bytes, SVG XML, CSV bytes, ...).
 * @param filename Display name for the download.
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  } finally {
    // Delay revocation slightly so Firefox/Safari finish reading the URL
    // before we release it.  Tests stub this so they don't see the timer.
    setTimeout(() => URL.revokeObjectURL(url), 250)
  }
}

/** Format a `Date` as ``yyyymmddTHHMM`` in local time. */
function formatTimestamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `T${pad(d.getHours())}${pad(d.getMinutes())}`
  )
}

/** Replace anything outside `[A-Za-z0-9_-]` with `_` for filesystem safety. */
function sanitise(s: string): string {
  return s.replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '')
}

/**
 * Convert a raw SVG string into a `Blob` (XML mime type).  Centralised so
 * consumers don't reinvent the data-URI vs Blob trade-off.
 *
 * @param svg The full ``<svg ...>...</svg>`` string.
 * @returns A `Blob` with type ``image/svg+xml;charset=utf-8``.
 */
export function svgStringToBlob(svg: string): Blob {
  return new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
}

/**
 * Convert an `image/png` data URI returned by ECharts'
 * `chart.getDataURL()` into a `Blob`.  Used by the Sankey view's PNG export.
 *
 * @param dataUrl A ``data:image/png;base64,...`` URI.
 * @returns A `Blob` with type ``image/png``.
 * @throws TypeError if the input is not a recognised PNG data URI.
 */
export function pngDataUrlToBlob(dataUrl: string): Blob {
  const match = /^data:image\/png;base64,(.+)$/.exec(dataUrl)
  if (!match) throw new TypeError('expected a base64 PNG data URI')
  const binary = atob(match[1])
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type: 'image/png' })
}
