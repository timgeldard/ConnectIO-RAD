/* eslint-disable jsdoc/require-jsdoc */
/**
 * CommandBar — top toolbar for the Spatial Studio authoring session.
 *
 * Renders mode tabs (Structure / Place / Review), a dirty-state indicator,
 * a Validate shortcut, and a Publish button. Publish is only enabled in
 * Review mode when the layout has no blocking validation errors.
 */

import type { StudioMode } from '~/types';

const MODE_LABELS: Record<StudioMode, string> = {
  structure: 'Structure',
  place: 'Place',
  review: 'Review',
};

const MODES: StudioMode[] = ['structure', 'place', 'review'];

/** Props for {@link CommandBar}. */
export interface CommandBarProps {
  /** Currently active authoring mode. */
  activeMode: StudioMode;
  /** Whether unsaved zone changes exist since last save. */
  isDirty: boolean;
  /** Whether a draft revision is open (controls button enablement). */
  hasDraft: boolean;
  /** Whether validation is currently in flight. */
  isValidating: boolean;
  /** Whether publish is currently in flight. */
  isPublishing: boolean;
  /** Whether the layout passed the last validation check (no blocking errors). */
  isPublishable: boolean;
  /** Called when the user clicks a mode tab. */
  onModeChange: (mode: StudioMode) => void;
  /** Called when the user clicks the Validate button. */
  onValidate: () => void;
  /** Called when the user clicks the Publish button. */
  onPublish: () => void;
}

/** Top command bar for Spatial Studio — mode tabs, validate, publish. */
export default function CommandBar({
  activeMode,
  isDirty,
  hasDraft,
  isValidating,
  isPublishing,
  isPublishable,
  onModeChange,
  onValidate,
  onPublish,
}: CommandBarProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 16px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
        flexShrink: 0,
      }}
    >
      {/* Mode tabs */}
      <div
        role="tablist"
        aria-label="Studio mode"
        style={{ display: 'flex', gap: 2, marginRight: 8 }}
      >
        {MODES.map((mode) => (
          <button
            key={mode}
            role="tab"
            aria-selected={activeMode === mode}
            onClick={() => onModeChange(mode)}
            style={{
              padding: '4px 12px',
              borderRadius: 4,
              border: 'none',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: activeMode === mode ? 600 : 400,
              background: activeMode === mode ? 'var(--accent)' : 'transparent',
              color: activeMode === mode ? 'var(--on-accent)' : 'var(--text-2)',
            }}
          >
            {MODE_LABELS[mode]}
          </button>
        ))}
      </div>

      {/* Dirty indicator */}
      {isDirty && (
        <span
          style={{
            fontSize: 11,
            color: 'var(--sunrise)',
            padding: '2px 8px',
            borderRadius: 4,
            background: 'color-mix(in srgb, var(--sunrise) 12%, transparent)',
          }}
        >
          Unsaved changes
        </span>
      )}

      <div style={{ flex: 1 }} />

      {/* Validate */}
      <button
        className="btn btn-sm btn-ghost"
        onClick={onValidate}
        disabled={!hasDraft || isValidating}
        style={{ fontSize: 13 }}
        aria-label="Validate layout"
      >
        {isValidating ? 'Validating…' : 'Validate'}
      </button>

      {/* Publish */}
      <button
        className="btn btn-sm btn-primary"
        onClick={onPublish}
        disabled={!hasDraft || !isPublishable || activeMode !== 'review' || isPublishing}
        style={{ fontSize: 13 }}
        aria-label="Publish layout"
      >
        {isPublishing ? 'Publishing…' : 'Publish'}
      </button>
    </div>
  );
}
