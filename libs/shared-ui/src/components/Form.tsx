import type { FormHTMLAttributes, ReactNode, CSSProperties } from 'react'

/**
 * Props for the Form component.
 */
export interface FormProps extends FormHTMLAttributes<HTMLFormElement> {
  /** Form controls and field rows. */
  children: ReactNode
  /** Reduces vertical spacing between fields for compact layouts. */
  compact?: boolean
  /** Optional inline styles. */
  style?: CSSProperties
}

/**
 * Shared form wrapper that enforces consistent vertical rhythm and prevents
 * default submit navigation. Compose with {@link Field} for labelled inputs.
 */
export function Form({ children, compact = false, style, onSubmit, ...props }: FormProps) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    onSubmit?.(e)
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: compact ? 8 : 16, ...style }}
      {...props}
    >
      {children}
    </form>
  )
}
