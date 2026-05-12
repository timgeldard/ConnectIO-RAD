/**
 * Shareable view state for the traceability visualisations.
 *
 * The classic graph relies on local component state and `usePersistentMode`
 * for the view toggle.  The advanced view needs more parameters (direction,
 * depth caps, selected node) and we want links to be shareable — copy URL,
 * paste in chat, recipient sees the same view.  This module gives us a
 * single source of truth that serialises to URL query params and rehydrates
 * cleanly on page load.
 *
 * The hook is read-only by default; pass `onChange` to receive updates and
 * push them into your own state store, or use the bundled
 * `useTraceViewState` which manages local React state for you.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'

import type { LineageDirection } from './types'

/** All visualisations of the same data; persistable in URL. */
export type TraceViewMode =
  | 'classic'
  | 'advanced'
  | 'side-by-side'
  | 'sankey'
  | 'table'

/** The serialisable description of the current view. */
export interface TraceViewState {
  /** Active visualisation. */
  view: TraceViewMode
  /** Direction filter from the focal node. */
  direction: LineageDirection
  /** Cap on upstream depth (1-based). */
  depthUpstream: number
  /** Cap on downstream depth (1-based). */
  depthDownstream: number
  /** Currently-selected node id, or `null`. */
  selectedId: string | null
}

const DEFAULT_STATE: TraceViewState = {
  view: 'classic',
  direction: 'both',
  depthUpstream: 99,
  depthDownstream: 99,
  selectedId: null,
}

/** Query-string keys; kept short so URLs stay tweet-able. */
const KEYS = {
  view: 'tv',
  direction: 'td',
  depthUp: 'du',
  depthDown: 'dd',
  selected: 'ts',
} as const

const VALID_VIEWS: readonly TraceViewMode[] = [
  'classic',
  'advanced',
  'side-by-side',
  'sankey',
  'table',
]

const VALID_DIRECTIONS: readonly LineageDirection[] = ['upstream', 'downstream', 'both']

/**
 * Parse a URL search string into a `TraceViewState`.  Unknown / malformed
 * values fall back to the default for that field — so a hand-crafted URL
 * never crashes the page.
 *
 * @param search The `window.location.search` string (or any equivalent).
 * @returns A fully-populated state object.
 */
export function parseTraceViewState(search: string): TraceViewState {
  const params = new URLSearchParams(search)
  const rawView = params.get(KEYS.view)
  const rawDir = params.get(KEYS.direction)
  const rawUp = params.get(KEYS.depthUp)
  const rawDown = params.get(KEYS.depthDown)
  const rawSel = params.get(KEYS.selected)

  const view: TraceViewMode = (VALID_VIEWS as readonly string[]).includes(rawView ?? '')
    ? (rawView as TraceViewMode)
    : DEFAULT_STATE.view
  const direction: LineageDirection = (VALID_DIRECTIONS as readonly string[]).includes(
    rawDir ?? '',
  )
    ? (rawDir as LineageDirection)
    : DEFAULT_STATE.direction
  const depthUpstream = clampDepth(rawUp, DEFAULT_STATE.depthUpstream)
  const depthDownstream = clampDepth(rawDown, DEFAULT_STATE.depthDownstream)
  const selectedId = rawSel && rawSel.length > 0 ? rawSel : null

  return { view, direction, depthUpstream, depthDownstream, selectedId }
}

/** Serialise a state to a `URLSearchParams` (caller appends to its own URL). */
export function serialiseTraceViewState(state: TraceViewState): URLSearchParams {
  const params = new URLSearchParams()
  // Only emit non-defaults to keep URLs short and readable.
  if (state.view !== DEFAULT_STATE.view) params.set(KEYS.view, state.view)
  if (state.direction !== DEFAULT_STATE.direction) params.set(KEYS.direction, state.direction)
  if (state.depthUpstream !== DEFAULT_STATE.depthUpstream)
    params.set(KEYS.depthUp, String(state.depthUpstream))
  if (state.depthDownstream !== DEFAULT_STATE.depthDownstream)
    params.set(KEYS.depthDown, String(state.depthDownstream))
  if (state.selectedId) params.set(KEYS.selected, state.selectedId)
  return params
}

function clampDepth(raw: string | null, fallback: number): number {
  if (raw == null) return fallback
  const n = Number.parseInt(raw, 10)
  if (!Number.isFinite(n) || n < 0) return fallback
  return Math.min(n, 99)
}

/**
 * React hook that owns a {@link TraceViewState} and keeps it synchronised
 * with `window.location.search` via `history.replaceState`.
 *
 * Replaces (rather than pushes) so the browser back button does not gain a
 * new entry every time a user tweaks a slider.  Browser back/forward is
 * still observed via `popstate`, so the URL remains the source of truth
 * across navigations.
 *
 * @param initialOverride Optional overrides applied on top of URL state on
 *   first render (e.g. force `view: 'advanced'` regardless of URL).
 * @returns A `[state, update]` tuple where `update` accepts a partial
 *   patch and merges it into the state.
 */
export function useTraceViewState(
  initialOverride?: Partial<TraceViewState>,
): readonly [TraceViewState, (patch: Partial<TraceViewState>) => void] {
  const [state, setState] = useState<TraceViewState>(() => {
    const fromUrl =
      typeof window !== 'undefined' ? parseTraceViewState(window.location.search) : DEFAULT_STATE
    return { ...fromUrl, ...initialOverride }
  })

  // Browser back/forward: re-read the URL.
  useEffect(() => {
    const handler = () => {
      if (typeof window !== 'undefined') {
        setState(parseTraceViewState(window.location.search))
      }
    }
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [])

  const update = useCallback((patch: Partial<TraceViewState>) => {
    setState((prev) => {
      const next = { ...prev, ...patch }
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href)
        const params = serialiseTraceViewState(next)
        // Preserve unrelated params (e.g. the platform shell's deep-link state).
        for (const key of Object.values(KEYS)) {
          url.searchParams.delete(key)
        }
        params.forEach((v, k) => {
          url.searchParams.set(k, v)
        })
        window.history.replaceState({}, '', url.toString())
      }
      return next
    })
  }, [])

  return useMemo(() => [state, update] as const, [state, update])
}

/** Exported for tests; do not rely on these in production code. */
export const __INTERNAL = { DEFAULT_STATE, KEYS }
