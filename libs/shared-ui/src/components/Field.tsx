import type { ReactNode, CSSProperties } from 'react'

/**
 * Props for the Field component.
 */
export interface FieldProps {
  /** The `for` attribute value that links this label to its input. */
  htmlFor?: string
  /** Label text displayed above the input. */
  label: string
  /** Appends a red asterisk to indicate required fields. */
  required?: boolean
  /** Validation error message — displayed in risk colour below the input. */
  error?: string
  /** Help text displayed below the input in muted colour. */
  help?: string
  /** The input element or other control. */
  children: ReactNode
  /** Optional inline styles on the field wrapper. */
  style?: CSSProperties
}

/**
 * Labelled field wrapper for consistent form layouts.
 * Renders a `<label>`, an input slot, and optional help/error text.
 */
export function Field({ htmlFor, label, required, error, help, children, style }: FieldProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, ...style }}>
      <label
        htmlFor={htmlFor}
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--text-2)',
          letterSpacing: '0.02em',
        }}
      >
        {label}
        {required && (
          <span aria-hidden="true" style={{ color: 'var(--status-risk)', marginLeft: 2 }}>*</span>
        )}
      </label>

      {children}

      {error && (
        <span
          role="alert"
          style={{ fontSize: 11, color: 'var(--status-risk)', fontWeight: 600 }}
        >
          {error}
        </span>
      )}

      {!error && help && (
        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
          {help}
        </span>
      )}
    </div>
  )
}
