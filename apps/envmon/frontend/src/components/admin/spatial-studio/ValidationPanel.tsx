/* eslint-disable jsdoc/require-jsdoc */
/**
 * ValidationPanel — renders grouped validation issues from a layout validate call.
 *
 * Issues are shown in three severity buckets:
 *   - blocking_error: red — must be resolved before publishing
 *   - warning: yellow — informational, does not block
 *   - suggestion: grey — optional improvements
 *
 * When there are no issues a green "No issues found" message is shown.
 */

import type { ValidationResult } from '~/types';

/** Props for {@link ValidationPanel}. */
export interface ValidationPanelProps {
  /** Validation result from the last validate call. */
  validationResult: ValidationResult;
}

/** Colour and label for each severity bucket. */
const SEVERITY_META = {
  blocking_error: { label: 'Blocking errors', color: 'var(--sunset)' },
  warning: { label: 'Warnings', color: 'var(--sunrise)' },
  suggestion: { label: 'Suggestions', color: 'var(--text-3)' },
} as const;

/** Grouped validation issue list. */
export default function ValidationPanel({ validationResult }: ValidationPanelProps) {
  const { issues } = validationResult;

  if (issues.length === 0) {
    return (
      <div data-testid="validation-panel">
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 8 }}>
          Validation
        </div>
        <div style={{ fontSize: 12, color: 'var(--jade)' }}>✓ No issues found</div>
      </div>
    );
  }

  const buckets: Array<'blocking_error' | 'warning' | 'suggestion'> = ['blocking_error', 'warning', 'suggestion'];

  return (
    <div data-testid="validation-panel">
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 8 }}>
        Validation
      </div>
      {buckets.map((severity) => {
        const group = issues.filter(i => i.severity === severity);
        if (!group.length) return null;
        const { label, color } = SEVERITY_META[severity];
        return (
          <div key={severity} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color, marginBottom: 4 }}>
              {label}
            </div>
            {group.map((issue, i) => (
              <div key={i} style={{ fontSize: 12, marginBottom: 4, color }}>
                <span style={{ fontWeight: 600 }}>{issue.code}</span>
                <span style={{ marginLeft: 4 }}>{issue.message}</span>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
