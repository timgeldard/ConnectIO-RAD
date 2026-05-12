/**
 * Filter controls for the advanced traceability view.
 *
 * Combines depth sliders, direction toggle, link-type chips, and the
 * group-by selector into a single bar that consumers can drop above
 * `AdvancedLineageGraph`.  State is fully controlled — the parent owns the
 * source of truth (typically via `useTraceViewState`) so multiple views can
 * subscribe to the same filters and the URL stays in sync.
 *
 * Why a single component instead of three?
 * ----------------------------------------
 * The depth and direction filters compose: changing direction to
 * `'upstream'` should not lose the downstream depth value.  Keeping all
 * three controls in one component makes that easier to reason about and
 * lets us share label/style tokens.  Consumers that only want one or two
 * controls can pass `show={{ depth: true, direction: false, links: true }}`.
 */
import type { CSSProperties, ReactNode } from 'react'

import type { AdvancedLinkType, LineageDirection } from './types'

/** Group-by strategies surfaced in the toolbar.  See `graphTransformers`. */
export type GroupByMode = 'none' | 'plant' | 'material'

/** Toolbar value bag.  Mirrors the subset of `TraceViewState` it owns. */
export interface TraceFilterValue {
  direction: LineageDirection
  depthUpstream: number
  depthDownstream: number
  groupBy: GroupByMode
  /** Link types selected for display; empty set means "show all". */
  enabledLinks: ReadonlySet<AdvancedLinkType>
}

/** Subset of controls to render.  All true by default. */
export interface TraceFilterVisibility {
  depth?: boolean
  direction?: boolean
  links?: boolean
  group?: boolean
}

export interface TraceFilterControlsProps {
  /** Current value (controlled). */
  value: TraceFilterValue
  /** Patch handler — receives the keys that changed. */
  onChange: (patch: Partial<TraceFilterValue>) => void
  /** Maximum depth visible on the slider; defaults to 10. */
  maxDepth?: number
  /** Toggle individual controls on/off. */
  show?: TraceFilterVisibility
  /** All link types that can be filtered; defaults to the four canonical kinds. */
  availableLinks?: readonly AdvancedLinkType[]
  /** Optional inline styles override for the outer wrapper. */
  style?: CSSProperties
}

const DEFAULT_LINKS: readonly AdvancedLinkType[] = [
  'RECEIPT',
  'INTERNAL',
  'CONSUMPTION',
  'SALES_ORDER',
]

const LINK_COLOR: Record<string, string> = {
  RECEIPT: '#289BA2',
  INTERNAL: '#8A9E6A',
  CONSUMPTION: '#F9C20A',
  SALES_ORDER: '#005776',
}

/**
 * Render the toolbar.  See module docstring for design rationale.
 *
 * @param props See {@link TraceFilterControlsProps}.
 * @returns A `<div>` containing the requested control groups.
 */
export function TraceFilterControls({
  value,
  onChange,
  maxDepth = 10,
  show = {},
  availableLinks = DEFAULT_LINKS,
  style,
}: TraceFilterControlsProps) {
  const visible: Required<TraceFilterVisibility> = {
    depth: show.depth ?? true,
    direction: show.direction ?? true,
    links: show.links ?? true,
    group: show.group ?? true,
  }

  return (
    <div
      role="toolbar"
      aria-label="Lineage filter controls"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 16,
        padding: '8px 12px',
        background: 'var(--bg-surface-2, #f1f5f9)',
        borderBottom: '1px solid var(--line, #e3e7ec)',
        fontFamily: 'var(--font-sans, system-ui)',
        fontSize: 12.5,
        ...style,
      }}
      data-testid="trace-filter-controls"
    >
      {visible.direction && (
        <Group label="Direction">
          <SegmentedButton
            ariaLabel="Lineage direction filter"
            options={[
              { value: 'both', label: 'Both' },
              { value: 'upstream', label: 'Upstream' },
              { value: 'downstream', label: 'Downstream' },
            ]}
            value={value.direction}
            onChange={(v) => onChange({ direction: v as LineageDirection })}
          />
        </Group>
      )}

      {visible.depth && value.direction !== 'downstream' && (
        <Group label="Upstream depth">
          <DepthSlider
            value={value.depthUpstream}
            max={maxDepth}
            onChange={(v) => onChange({ depthUpstream: v })}
            testId="depth-upstream"
          />
        </Group>
      )}

      {visible.depth && value.direction !== 'upstream' && (
        <Group label="Downstream depth">
          <DepthSlider
            value={value.depthDownstream}
            max={maxDepth}
            onChange={(v) => onChange({ depthDownstream: v })}
            testId="depth-downstream"
          />
        </Group>
      )}

      {visible.group && (
        <Group label="Group by">
          <SegmentedButton
            ariaLabel="Group lineage nodes by"
            options={[
              { value: 'none', label: 'None' },
              { value: 'plant', label: 'Plant' },
              { value: 'material', label: 'Material' },
            ]}
            value={value.groupBy}
            onChange={(v) => onChange({ groupBy: v as GroupByMode })}
          />
        </Group>
      )}

      {visible.links && (
        <Group label="Link types">
          <div style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
            {availableLinks.map((link) => {
              const isOn =
                value.enabledLinks.size === 0 || value.enabledLinks.has(link)
              return (
                <LinkChip
                  key={link}
                  link={link}
                  active={isOn}
                  onToggle={() => toggleLink(value.enabledLinks, link, onChange, availableLinks)}
                />
              )
            })}
          </div>
        </Group>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* internal building blocks                                           */
/* ------------------------------------------------------------------ */

function Group({ label, children }: { label: string; children: ReactNode }) {
  // `<label>` is reserved for form controls.  The grouped controls inside
  // (radiogroups, sliders) already have their own accessible names via
  // `aria-label`, so the visual label is wrapped in a plain `<div>` with
  // a non-interactive span — keeping screen readers from announcing
  // the group title twice or treating it as a single labelled control.
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span style={{ color: 'var(--ink-3, #6b7280)', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      {children}
    </div>
  )
}

function SegmentedButton<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: ReadonlyArray<{ value: T; label: string }>
  value: T
  onChange: (next: T) => void
  ariaLabel: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      style={{
        display: 'inline-flex',
        borderRadius: 4,
        overflow: 'hidden',
        border: '1px solid var(--line, #e3e7ec)',
      }}
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            style={{
              padding: '4px 10px',
              fontFamily: 'inherit',
              fontSize: 'inherit',
              background: active ? 'var(--brand, #003C52)' : 'var(--bg-surface, #fff)',
              color: active ? '#fff' : 'var(--ink-1, #16202a)',
              border: 'none',
              borderRight: '1px solid var(--line, #e3e7ec)',
              cursor: 'pointer',
              minWidth: 56,
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Compact depth slider — uses native `<input type="range">` so it works in
 * jsdom without extra wiring and is keyboard-accessible by default.
 */
function DepthSlider({
  value,
  max,
  onChange,
  testId,
}: {
  value: number
  max: number
  onChange: (next: number) => void
  testId: string
}) {
  // Clamp displayed value so a stored 99 (the "unlimited" sentinel) does
  // not push the slider off the end.
  const displayValue = Math.min(value, max)
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <input
        type="range"
        min={0}
        max={max}
        step={1}
        value={displayValue}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="depth"
        data-testid={testId}
        style={{ width: 100 }}
      />
      <span
        style={{
          fontFamily: 'var(--font-mono, ui-monospace, monospace)',
          fontSize: 11,
          color: 'var(--ink-2, #4b5563)',
          minWidth: 18,
          textAlign: 'right',
        }}
      >
        {value >= max ? `${max}+` : value}
      </span>
    </div>
  )
}

function LinkChip({
  link,
  active,
  onToggle,
}: {
  link: AdvancedLinkType
  active: boolean
  onToggle: () => void
}) {
  const colour = LINK_COLOR[link] ?? 'var(--ink-3, #6b7280)'
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      style={{
        padding: '2px 8px',
        fontFamily: 'inherit',
        fontSize: 11,
        background: active ? colour : 'var(--bg-surface, #fff)',
        color: active ? '#fff' : 'var(--ink-2, #4b5563)',
        border: `1px solid ${colour}`,
        borderRadius: 999,
        cursor: 'pointer',
        opacity: active ? 1 : 0.6,
        letterSpacing: '0.02em',
      }}
    >
      {link}
    </button>
  )
}

/**
 * Toggle a link in the enabled-set.  When the user clicks a chip while all
 * chips are on (empty set = "all"), we materialise the explicit set with
 * the clicked link removed.  When the result is the full set, collapse
 * back to the empty-set ("all") representation for URL compactness.
 */
function toggleLink(
  current: ReadonlySet<AdvancedLinkType>,
  link: AdvancedLinkType,
  onChange: (patch: Partial<TraceFilterValue>) => void,
  all: readonly AdvancedLinkType[],
) {
  const next = new Set<AdvancedLinkType>(current.size === 0 ? all : current)
  if (next.has(link)) {
    next.delete(link)
  } else {
    next.add(link)
  }
  // Empty set after removing the only enabled link → keep one item, never zero
  if (next.size === 0) {
    onChange({ enabledLinks: new Set([link]) })
    return
  }
  // Full set → "all"
  if (next.size === all.length) {
    onChange({ enabledLinks: new Set() })
    return
  }
  onChange({ enabledLinks: next })
}
