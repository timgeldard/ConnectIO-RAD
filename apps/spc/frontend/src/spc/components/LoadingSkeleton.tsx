interface LoadingSkeletonProps {
  variant?: 'spinner' | 'lines'
  message?: string
  lines?: number
  minHeight?: string
}

const shimmer: React.CSSProperties = {
  background: 'var(--surface-sunken)',
  borderRadius: 4,
}

import type React from 'react'

export default function LoadingSkeleton({
  variant = 'spinner',
  message = 'Loading…',
  lines = 5,
  minHeight,
}: LoadingSkeletonProps) {
  if (variant === 'lines') {
    return (
      <div style={{ ...(minHeight ? { minHeight } : {}), padding: '1.5rem 0', display: 'grid', gap: 8 }}>
        {Array.from({ length: lines }, (_, i) => (
          <div
            key={i}
            aria-hidden="true"
            style={{
              ...shimmer,
              width: i % 3 === 0 ? '100%' : i % 3 === 1 ? `${83 + (i % 2) * 4}%` : '66%',
              height: '2.5rem',
            }}
          />
        ))}
        <span className="sr-only">{message}</span>
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        padding: '1.5rem',
        color: 'var(--text-3)',
      }}
      aria-live="polite"
      aria-label={message}
    >
      <span
        style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          border: '2px solid var(--line-1)',
          borderTopColor: 'var(--valentia-slate)',
          animation: 'spc-spin 0.7s linear infinite',
          display: 'block',
        }}
        aria-hidden="true"
      />
      <span style={{ fontSize: '0.875rem' }}>{message}</span>
    </div>
  )
}
